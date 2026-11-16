/**
 * SEO-02 · Service de la fiche de page : stockage en mémoire injectable, statut, validation, hub.
 * Aucun appel réel, aucun envoi, aucune page du site créée.
 * Règle : les champs remplis par le fondateur ne sont JAMAIS exposés par ce service avant la validation (statut).
 */
import {
  BESOINS_ENTREPRISE,
  CHAMPS_REMPLIS_PAR_LE_FONDATEUR,
  CHEMIN_PAGES,
  CLES_CONTENU,
  TYPES_AUTOMATISATION,
  classerParHub,
  controlerFiche,
  dateValide,
  genererDonneesStructurees,
  identifiantValide,
  robotsDe,
  slugValide,
  type Classement,
  type Defaut,
  type ContenuFiche,
  type FicheDePage,
} from "@/domaine/fiche-de-page";

export interface DepotFiches {
  lire(id: string): FicheDePage | undefined;
  ecrire(fiche: FicheDePage): void;
  tous(): FicheDePage[];
}

export function creerDepotMemoire(): DepotFiches {
  const m = new Map<string, FicheDePage>();
  return {
    lire: (id) => (m.has(id) ? structuredClone(m.get(id)!) : undefined),
    ecrire: (f) => void m.set(f.id, structuredClone(f)),
    tous: () => [...m.values()].map((f) => structuredClone(f)),
  };
}

/** Ce que le service laisse sortir : la fiche (sans les champs du fondateur tant qu'elle n'est pas validée) + le généré. */
export type VueFiche = Omit<FicheDePage, (typeof CHAMPS_REMPLIS_PAR_LE_FONDATEUR)[number]> &
  Partial<Pick<FicheDePage, (typeof CHAMPS_REMPLIS_PAR_LE_FONDATEUR)[number]>> & {
    canonique?: string;
    langue: "fr";
    robots: "index,follow" | "noindex,nofollow";
    donneesStructurees?: Array<Record<string, unknown>>;
  };

/** Valeurs de modification : `null` efface le champ. */
export type ModificationFiche = { [K in keyof ContenuFiche]?: ContenuFiche[K] | null };

const FORME: Record<keyof ContenuFiche, "chaine" | "tableau" | "objet"> = {
  slug: "chaine", titre: "chaine", metaDescription: "chaine", h1: "chaine", resume: "chaine", gain: "chaine", appelAction: "chaine",
  transcription: "chaine", auteur: "chaine", relecteur: "chaine", type: "chaine",
  pourQui: "tableau", sousTitres: "tableau", questions: "tableau", limites: "tableau", besoins: "tableau", pagesLiees: "tableau", images: "tableau", sources: "tableau",
  avantApres: "objet", commentCaMarche: "objet", video: "objet", imagePartage: "objet",
};
const formeOk = (cle: keyof ContenuFiche, v: unknown): boolean =>
  FORME[cle] === "chaine" ? typeof v === "string" : FORME[cle] === "tableau" ? Array.isArray(v) : typeof v === "object" && v !== null && !Array.isArray(v);

/** Contrôle sans jamais lever : une valeur de forme inattendue devient un défaut, pas une panne. */
function controleSur(f: FicheDePage): Defaut[] {
  try {
    return controlerFiche(f);
  } catch {
    return [{ champ: "forme", message: "Une valeur n'a pas la forme attendue : la fiche ne peut pas être contrôlée." }];
  }
}

export type Resultat<T> = { ok: true; fiche: T } | { ok: false; erreurs: string[] };

const refus = (...erreurs: string[]): { ok: false; erreurs: string[] } => ({ ok: false, erreurs });
const validee = (f: FicheDePage): boolean => f.statut === "valide" || f.statut === "publie";

function vueDe(f: FicheDePage): VueFiche {
  const vue = structuredClone(f) as unknown as Record<string, unknown>;
  if (!validee(f)) for (const k of CHAMPS_REMPLIS_PAR_LE_FONDATEUR) delete vue[k];
  vue.langue = "fr";
  vue.robots = robotsDe(f.statut);
  if (f.slug) vue.canonique = `${CHEMIN_PAGES}/${f.slug}`;
  if (validee(f) && f.slug) vue.donneesStructurees = genererDonneesStructurees(f, `${CHEMIN_PAGES}/${f.slug}`, { datePublication: f.datePublication, dateMiseAJour: f.dateMiseAJour });
  return vue as unknown as VueFiche;
}

export interface OptionsService {
  depot?: DepotFiches;
  /** Date du jour AAAA-MM-JJ (injectable pour les tests). */
  maintenant?: () => string;
}

export function creerServiceFichesDePage(options: OptionsService = {}) {
  const depot = options.depot ?? creerDepotMemoire();
  const aujourdhui = options.maintenant ?? (() => new Date().toISOString().slice(0, 10));
  const slugPris = (slug: string, sauf?: string) => depot.tous().some((f) => f.slug === slug && f.id !== sauf);

  return {
    creer(id: string, slug: string): Resultat<VueFiche> {
      if (!identifiantValide(id)) return refus("Identifiant : forme AUTO-014 attendue.");
      if (depot.lire(id)) return refus("Identifiant déjà utilisé : il n'est jamais réutilisé.");
      if (!slugValide(slug)) return refus("Adresse : 3 à 6 mots, minuscules, tirets, sans date.");
      if (slugPris(slug)) return refus("Adresse déjà prise : une adresse est unique.");
      const jour = aujourdhui();
      if (!dateValide(jour)) return refus("Date du jour invalide.");
      const f: FicheDePage = { id, slug, statut: "brouillon", dateMiseAJour: jour };
      depot.ecrire(f);
      return { ok: true, fiche: vueDe(f) };
    },

    /** Modification à la main de n'importe quel champ de contenu. Tout changement réel ramène la fiche en brouillon. */
    modifier(id: string, champs: ModificationFiche): Resultat<VueFiche> {
      const f = depot.lire(id);
      if (!f) return refus("Fiche introuvable.");
      const inconnus = Object.keys(champs).filter((k) => !(CLES_CONTENU as readonly string[]).includes(k));
      if (inconnus.length > 0) return refus(`Champ non modifiable : ${inconnus.join(", ")}.`);
      const mal = (Object.keys(champs) as Array<keyof ContenuFiche>).filter((k) => champs[k] !== null && champs[k] !== undefined && !formeOk(k, champs[k]));
      if (mal.length > 0) return refus(`Forme de valeur inattendue : ${mal.join(", ")}.`);
      if (champs.type != null && !(TYPES_AUTOMATISATION as readonly string[]).includes(champs.type)) return refus("Type d'automatisation : valeur hors liste fermée.");
      if (champs.besoins != null && champs.besoins.some((b) => !(BESOINS_ENTREPRISE as readonly string[]).includes(b))) return refus("Besoin d'entreprise : valeur hors liste fermée.");
      if (champs.slug === null) return refus("Adresse : elle ne s'efface pas.");
      if (champs.slug !== undefined && champs.slug !== f.slug) {
        if (f.statut === "publie" || f.dejaPublie) return refus("Adresse : elle ne change jamais après publication.");
        if (!slugValide(champs.slug)) return refus("Adresse : 3 à 6 mots, minuscules, tirets, sans date.");
        if (slugPris(champs.slug, id)) return refus("Adresse déjà prise : une adresse est unique.");
      }
      const suivante: FicheDePage = { ...f };
      let change = false;
      for (const cle of CLES_CONTENU) {
        const v = champs[cle];
        if (v === undefined) continue;
        if (JSON.stringify(v) !== JSON.stringify(f[cle] ?? null)) change = true;
        if (v === null) delete suivante[cle];
        else (suivante as unknown as Record<string, unknown>)[cle] = structuredClone(v);
      }
      if (change) {
        suivante.dateMiseAJour = aujourdhui();
        if (f.statut === "publie") suivante.dejaPublie = true;
        suivante.statut = "brouillon"; // une validation ne couvre pas un texte modifié depuis
        depot.ecrire(suivante);
      }
      return { ok: true, fiche: vueDe(change ? suivante : f) };
    },

    lire(id: string): VueFiche | undefined {
      const f = depot.lire(id);
      return f ? vueDe(f) : undefined;
    },

    /** Défauts à corriger (noms de champs seulement, jamais le contenu). */
    controler(id: string): { ok: true; defauts: Defaut[] } | { ok: false; erreurs: string[] } {
      const f = depot.lire(id);
      if (!f) return refus("Fiche introuvable.");
      return { ok: true, defauts: controleSur(f) };
    },

    /** Brouillon → à valider, seulement si le contrôle automatique ne relève aucun défaut. */
    soumettre(id: string): Resultat<VueFiche> {
      const f = depot.lire(id);
      if (!f) return refus("Fiche introuvable.");
      if (f.statut !== "brouillon") return refus("Seul un brouillon peut être soumis.");
      const defauts = controleSur(f);
      if (defauts.some((d) => d.champ === "forme")) return refus(...defauts.map((d) => d.message));
      const autres = depot.tous().filter((x) => x.id !== id);
      if (f.titre && autres.some((x) => x.titre === f.titre)) defauts.push({ champ: "titre", message: "Titre de page : déjà utilisé par une autre page (un titre par page)." });
      const adresses = new Set(autres.map((x) => x.slug));
      const liees = f.pagesLiees ?? [];
      if (new Set(liees.map((p) => p.adresse)).size !== liees.length) defauts.push({ champ: "pagesLiees", message: "Pages liées : une même page ne compte qu'une fois." });
      for (const p of liees) {
        const cible = autres.find((x) => x.slug === p.adresse);
        if (cible && !(cible.type === f.type || (cible.besoins ?? []).some((b) => (f.besoins ?? []).includes(b)))) {
          defauts.push({ champ: "pagesLiees", message: "Pages liées : une page liée a le même type ou un besoin commun." });
        }
      }
      if (f.pagesLiees?.some((p) => !adresses.has(p.adresse))) defauts.push({ champ: "pagesLiees", message: "Pages liées : une adresse ne correspond à aucune page (aucun lien cassé)." });
      if (defauts.length > 0) return refus(...defauts.map((d) => d.message));
      f.statut = "a_valider";
      depot.ecrire(f);
      return { ok: true, fiche: vueDe(f) };
    },

    /** À valider → validé, sur validation écrite du fondateur uniquement. La publication reste hors périmètre. */
    valider(id: string, preuve: { validationEcrite: boolean }): Resultat<VueFiche> {
      const f = depot.lire(id);
      if (!f) return refus("Fiche introuvable.");
      if (f.statut !== "a_valider") return refus("Seule une fiche à valider peut être validée.");
      if (preuve.validationEcrite !== true) return refus("Rien n'est validé sans validation écrite du fondateur.");
      f.statut = "valide";
      depot.ecrire(f);
      return { ok: true, fiche: vueDe(f) };
    },

    /** Classement du hub (fiches validées seulement : le fond du fondateur n'y figure pas). */
    hub(): Classement {
      return classerParHub(depot.tous());
    },
  };
}
