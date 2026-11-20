/**
 * RAP-1 · Rapatriement des publications du diffuseur : LECTURE chez Zernio (`listerPosts` seulement), écriture locale seulement
 * par `creerSiAbsente` (jamais de modification). Toutes les dépendances sont injectées ; le client est restreint à `listerPosts`
 * par son type : aucune écriture chez le diffuseur n'est possible d'ici. Cette PR ne branche aucune boucle (c'est RAP-2).
 */
import "server-only";
import { deciderRapatriement, reseauDepuisPlateforme, STATUTS_RAPATRIES, type ConnusLocaux, type PublicationARapatrier, type RaisonEcart } from "@/domaine/rapatriement-zernio";
import type { Publication } from "@/domaine/types";
import type { ClientZernio, PostZernio } from "@/fournisseurs/publication/zernio-client";
import { cleJour } from "@/lib/dates";
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

/** Un post du diffuseur qui n'est pas (ou pas encore) au calendrier : jamais de texte, jamais d'adresse. */
export interface PostAbsent {
  postId: string;
  raison: RaisonEcart;
  /** Réseau du Studio, sinon le nom de plateforme du diffuseur (« threads »…). */
  reseau: string;
  /** Jour de Paris (AAAA-MM-JJ), ou « sans date ». */
  jour: string;
}

export interface ResultatRapatriement {
  lus: number;
  crees: number;
  existaient: number;
  ecarts: { postId: string; raison: RaisonEcart }[];
  /** RAP-2 · posts du diffuseur absents du calendrier APRÈS ce passage (à blanc : ceux qui seraient créés, plus les écarts impossibles). */
  absents: PostAbsent[];
  lectureComplete: boolean;
  /** RAP-2 · vrai si rien n'a été créé parce que la lecture était incomplète (jamais de création sur une lecture partielle). */
  creationsSuspendues: boolean;
  posts: PostZernio[];
}

function absentDe(post: PostZernio, raison: RaisonEcart): PostAbsent {
  const pf = Array.isArray(post.platforms) ? post.platforms[0] : undefined;
  const nom = String(pf?.platform ?? "inconnu");
  const date = typeof post.scheduledFor === "string" ? Date.parse(post.scheduledFor) : NaN;
  return { postId: post._id, raison, reseau: reseauDepuisPlateforme(nom) ?? nom, jour: Number.isFinite(date) ? cleJour(new Date(date)) : "sans date" };
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

/**
 * `aBlanc` (vrai par défaut) : on lit, on décide et on compte, sans aucune écriture locale.
 * RAP-2 : une lecture INCOMPLÈTE (budget épuisé, erreur) ne crée jamais rien, même hors « à blanc » : on ne bâtit pas le calendrier
 * sur une vue partielle du diffuseur ; l'écart est alors « non vérifié ».
 */
export async function rapatrierPostsZernio(d: DepsRapatriement, o: { aBlanc?: boolean } = {}): Promise<ResultatRapatriement> {
  const { posts, complete } = await lirePostsAVenirZernio(d.client, d.budget);
  const aBlanc = o.aBlanc !== false || !complete;
  const connus = await connusLocaux(d);
  const decision = deciderRapatriement(posts, connus, { instant: d.instant(), nomsComptes: await d.nomsComptes() });
  let crees = 0;
  let existaient = 0;
  const parId = new Map(posts.map((p) => [p._id, p] as const));
  const absents: PostAbsent[] = decision.ecarts.map((e) => absentDe(parId.get(e.postId)!, e.raison));
  if (aBlanc) {
    // Rien n'est créé : ces posts restent absents du calendrier. Un post à plusieurs plateformes compte pour un seul.
    for (const id of new Set(decision.aCreer.map((p) => p.idExterne!))) absents.push(absentDe(parId.get(id)!, "absent"));
  } else {
    for (const p of decision.aCreer) {
      if ((await d.creerSiAbsente(p)) === "creee") crees++;
      else existaient++;
    }
  }
  return { lus: posts.length, crees, existaient, ecarts: decision.ecarts, absents, lectureComplete: complete, creationsSuspendues: o.aBlanc === false && !complete, posts };
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
