/**
 * RAP-1 · Rapatriement des publications du diffuseur : LECTURE chez Zernio (`listerPosts` seulement), écriture locale seulement
 * par `creerSiAbsente` (jamais de modification). Toutes les dépendances sont injectées ; le client est restreint à `listerPosts`
 * par son type : aucune écriture chez le diffuseur n'est possible d'ici. Cette PR ne branche aucune boucle (c'est RAP-2).
 */
import "server-only";
import { deciderRapatriement, STATUTS_RAPATRIES, type ConnusLocaux, type PublicationARapatrier, type RaisonEcart } from "@/domaine/rapatriement-zernio";
import type { Publication } from "@/domaine/types";
import type { ClientZernio, PostZernio } from "@/fournisseurs/publication/zernio-client";
import { depots, horodatage, maintenant, sousVerrou } from "./_commun";
import { clientZernio, comptesZernioEnregistres, listerToutesLesPagesZernio } from "./zernio";

const LIMITE_PAGE = 100;

export interface DepsRapatriement {
  client: Pick<ClientZernio, "listerPosts">;
  publications(): Promise<Publication[]>;
  clesCreneaux(): Promise<Set<string>>;
  nomsComptes(): Promise<Map<string, string>>;
  /** Sous le verrou : `obtenir(id)` puis création, jamais de modification. */
  creerSiAbsente(p: PublicationARapatrier): Promise<"creee" | "existait">;
  instant(): string;
  /** Requêtes permises pour ce passage (décompté ici). */
  budget: { restant: number };
}

export interface ResultatRapatriement {
  lus: number;
  crees: number;
  existaient: number;
  ecarts: { postId: string; raison: RaisonEcart }[];
  lectureComplete: boolean;
  posts: PostZernio[];
}

/**
 * Lit les posts `scheduled`, puis `draft`, puis `publishing`, par pages de 100, en s'arrêtant à la première page incomplète.
 * Chaque page coûte 1 au budget. Budget épuisé ou erreur : `complete:false` (l'écart est alors « non vérifié », jamais 0).
 */
export async function lirePostsAVenirZernio(client: Pick<ClientZernio, "listerPosts">, budget: { restant: number }): Promise<{ posts: PostZernio[]; complete: boolean }> {
  const posts: PostZernio[] = [];
  const vus = new Set<string>();
  const ajouter = (lus: PostZernio[]): void => {
    for (const p of lus) {
      if (vus.has(p._id)) continue;
      vus.add(p._id);
      posts.push(p);
    }
  };
  for (const status of STATUTS_RAPATRIES) {
    if (budget.restant <= 0) return { posts, complete: false };
    const pagesMax = budget.restant;
    const sortie = { posts: [] as PostZernio[], requetes: 0 };
    try {
      await listerToutesLesPagesZernio(client, { status }, LIMITE_PAGE, pagesMax, sortie);
    } catch {
      budget.restant -= sortie.requetes;
      ajouter(sortie.posts);
      return { posts, complete: false };
    }
    budget.restant -= sortie.requetes;
    ajouter(sortie.posts);
    // Plafond atteint sur une page encore pleine : il peut en rester.
    if (sortie.requetes >= pagesMax && sortie.posts.length >= pagesMax * LIMITE_PAGE) return { posts, complete: false };
  }
  return { posts, complete: true };
}

async function connusLocaux(d: DepsRapatriement): Promise<ConnusLocaux> {
  const pubs = await d.publications();
  return {
    idsExternes: new Set([...pubs.map((p) => p.idExterne), ...pubs.map((p) => p.id)].filter((x): x is string => typeof x === "string")),
    clesEnvoi: new Set(pubs.map((p) => p.cleEnvoi).filter((x): x is string => typeof x === "string")),
    clesCreneaux: await d.clesCreneaux(),
  };
}

/** `aBlanc` (vrai par défaut) : on lit, on décide et on compte, sans aucune écriture locale. */
export async function rapatrierPostsZernio(d: DepsRapatriement, o: { aBlanc?: boolean } = {}): Promise<ResultatRapatriement> {
  const aBlanc = o.aBlanc !== false;
  const { posts, complete } = await lirePostsAVenirZernio(d.client, d.budget);
  const connus = await connusLocaux(d);
  const decision = deciderRapatriement(posts, connus, { instant: d.instant(), nomsComptes: await d.nomsComptes() });
  let crees = 0;
  let existaient = 0;
  if (!aBlanc) {
    for (const p of decision.aCreer) {
      if ((await d.creerSiAbsente(p)) === "creee") crees++;
      else existaient++;
    }
  }
  return { lus: posts.length, crees, existaient, ecarts: decision.ecarts, lectureComplete: complete, posts };
}

/** Dépendances du serveur : dépôts du processus, comptes enregistrés, client du diffuseur (restreint à la lecture). */
export async function depsRapatriementServeur(): Promise<DepsRapatriement> {
  return {
    client: { listerPosts: (q) => clientZernio().listerPosts(q) },
    publications: () => depots().publications.lister(),
    clesCreneaux: async () => new Set((await depots().envoisPlanifies.lister()).map((e) => e.cleDiffuseur ?? e.cle).filter((k): k is string => typeof k === "string")),
    nomsComptes: async () => new Map((await comptesZernioEnregistres())?.comptes.map((c) => [c.id, c.nom] as const) ?? []),
    creerSiAbsente: (p) =>
      sousVerrou(async () => {
        if (await depots().publications.obtenir(p.id)) return "existait" as const;
        await depots().publications.enregistrer({ ...p, ...horodatage() });
        return "creee" as const;
      }),
    instant: () => maintenant(),
    budget: { restant: 6 },
  };
}
