import { Pastille } from "@/components/ui/Pastille";
import type { Tonalite } from "@/domaine/libelles";

/** Les six états qu'une personne lit dans le calendrier (ceux de la maquette validée). */
export type EtatCalendrier = "brouillon" | "a_valider" | "programme" | "publie" | "a_corriger" | "idee";

/** Ordre de la légende. */
export const ETATS_CALENDRIER: readonly EtatCalendrier[] = ["brouillon", "a_valider", "programme", "publie", "a_corriger", "idee"];

/**
 * État affiché. Les six états de la maquette sont fermés, mais une table de libellés fournie de l'extérieur (CAL-10)
 * peut en nommer d'autres (« Refusée », « Manquée »…) : d'où le mot libre.
 */
export type EtatAffiche = EtatCalendrier | (string & {});

export interface LibelleEtat {
  libelle: string;
  ton: Tonalite;
}

/** Table « état → libellé et ton ». */
export type TableLibelles = Readonly<Record<string, LibelleEtat>>;

/** Table « statut interne → état affiché » ; `null` : l'entrée n'a pas sa place dans le calendrier. */
export type TableStatuts = Readonly<Record<string, string | null>>;

/** Libellé et ton de chaque état. Le ton dit l'état, jamais le réseau. */
export const LIBELLES_ETAT: Readonly<Record<EtatCalendrier, LibelleEtat>> = {
  brouillon: { libelle: "Brouillon", ton: "neutre" },
  a_valider: { libelle: "À valider", ton: "ambre" },
  programme: { libelle: "Programmé", ton: "sauge" },
  publie: { libelle: "Publié", ton: "contour" },
  a_corriger: { libelle: "À corriger", ton: "brique" },
  idee: { libelle: "Idée de l'IA", ton: "pointille" },
};

/** Ce qu'on montre quand un état n'est dans aucune table : on le dit, on ne le prend pas pour un brouillon. */
export const LIBELLE_ETAT_INCONNU: LibelleEtat = { libelle: "État à vérifier", ton: "neutre" };

/**
 * Libellé d'un état. `libelles` (fournie de l'extérieur) complète et l'emporte sur la table par défaut.
 * `connu` est faux si l'état n'est dans aucune table.
 */
export function libelleEtat(etat: EtatAffiche, libelles?: TableLibelles): LibelleEtat & { connu: boolean } {
  const trouve = libelles && Object.hasOwn(libelles, etat) ? libelles[etat] : Object.hasOwn(LIBELLES_ETAT, etat) ? LIBELLES_ETAT[etat as EtatCalendrier] : null;
  return trouve ? { ...trouve, connu: true } : { ...LIBELLE_ETAT_INCONNU, connu: false };
}

/** Statuts internes (plan éditorial et publications) → état affiché. Table par défaut, remplaçable (CAL-10). */
export const STATUTS_VERS_ETAT: TableStatuts = {
  propose: "idee",
  a_valider: "a_valider",
  // Validée mais pas encore programmée : rien n'est parti, il reste quelque chose à faire.
  valide: "brouillon",
  programme: "programme",
  programmee: "programme",
  publie: "publie",
  publiee: "publie",
  echec: "a_corriger",
  a_corriger: "a_corriger",
  brouillon: "brouillon",
  idee: "idee",
  archive: null,
};

const vide = (statut: string | null | undefined) => (statut ?? "").trim() === "";

/** Vrai si le statut est vide (un brouillon sans statut) ou nommé dans la table. */
export function statutConnu(statut: string | null | undefined, table: TableStatuts = STATUTS_VERS_ETAT): boolean {
  return vide(statut) || Object.hasOwn(table, (statut ?? "").trim());
}

/**
 * État affiché d'un statut interne. `null` : l'entrée n'a pas sa place dans le calendrier (archivée), ou son statut
 * n'est dans aucune table (jamais présenté comme « Brouillon » : voir `statutConnu` pour le signaler).
 * Statut vide : « brouillon » (rien n'a encore été décidé).
 */
export function etatDepuisStatut(statut: string | null | undefined, table: TableStatuts = STATUTS_VERS_ETAT): EtatAffiche | null {
  if (vide(statut)) return "brouillon";
  const cle = (statut ?? "").trim();
  return Object.hasOwn(table, cle) ? table[cle] : null;
}

export interface ProprietesPastilleStatutPlan {
  etat: EtatAffiche;
  /** Table de libellés fournie de l'extérieur (CAL-10) ; complète la table par défaut. */
  libelles?: TableLibelles;
  className?: string;
}

/** Pastille d'état d'une entrée du calendrier : un libellé court, un ton par état. */
export function PastilleStatutPlan({ etat, libelles, className }: ProprietesPastilleStatutPlan) {
  const { libelle, ton } = libelleEtat(etat, libelles);
  return (
    <Pastille ton={ton} className={className}>
      {libelle}
    </Pastille>
  );
}
