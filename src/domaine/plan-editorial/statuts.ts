/** Statuts du plan : tableau unique des transitions, garde « l'usine n'écrit pas programme/publie/echec ». PUR. */
import type { Tonalite } from "@/domaine/libelles";
import { IDS_RESEAUX_PLAN } from "./correspondances";
import type { AuteurPlan, CreneauEditorial, OrigineEntree, ResultatTransition, StatutPlan } from "./types";

export const STATUTS_PLAN: readonly StatutPlan[] = ["propose", "a_valider", "valide", "programme", "publie", "echec", "archive"];

/**
 * États internes du cycle de vie. Les sept statuts enregistrés, plus deux états lus, jamais écrits tels quels :
 * « refusee » (archivé avec une trace de refus) et « manquee » (jour passé sans que rien soit parti).
 */
export type EtatInterne = StatutPlan | "refusee" | "manquee";
export const ETATS_INTERNES: readonly EtatInterne[] = [...STATUTS_PLAN, "refusee", "manquee"];

/**
 * TABLE UNIQUE des passages permis : de → vers. Tout le reste est refusé.
 * Le tableau des statuts enregistrés (TRANSITIONS) en est tiré : « refusee » s'y écrit « archive », « manquee » n'y est jamais écrite.
 */
export const TRANSITIONS_CYCLE: Readonly<Record<EtatInterne, readonly EtatInterne[]>> = {
  propose: ["a_valider", "refusee", "manquee", "archive"],
  a_valider: ["valide", "propose", "refusee", "manquee", "archive"],
  valide: ["programme", "a_valider", "manquee", "archive"],
  programme: ["publie", "echec", "valide"],
  publie: ["archive"],
  echec: ["programme", "valide", "archive"],
  // Manquée : il faut une nouvelle date et une nouvelle validation, ou l'archive. Jamais programmée ni publiée telle quelle.
  manquee: ["a_valider", "archive"],
  // Refusée : définitif, rien n'est supprimé (la proposition est archivée avec son motif).
  refusee: [],
  archive: [],
};

/** Vrai si le passage « de → vers » est dans la table (tout nom inconnu est refusé). */
export function passageAutorise(de: string, vers: string): boolean {
  return Object.hasOwn(TRANSITIONS_CYCLE, de) && TRANSITIONS_CYCLE[de as EtatInterne].some((v) => v === vers);
}

/** Passages entre statuts enregistrés, tirés de TRANSITIONS_CYCLE (aucune seconde table à tenir à jour). */
export const TRANSITIONS: Readonly<Record<StatutPlan, readonly StatutPlan[]>> = Object.fromEntries(
  STATUTS_PLAN.map((de) => {
    const vers = TRANSITIONS_CYCLE[de].flatMap((v): StatutPlan[] => (v === "manquee" ? [] : v === "refusee" ? ["archive"] : [v]));
    return [de, [...new Set(vers)]];
  }),
) as unknown as Record<StatutPlan, readonly StatutPlan[]>;

/** Seuls statuts que l'usine peut écrire. */
export const STATUTS_ECRITS_PAR_USINE: readonly StatutPlan[] = ["propose", "a_valider", "archive"];

export function transitionAutorisee(de: StatutPlan, vers: StatutPlan): boolean {
  return TRANSITIONS[de].includes(vers);
}

export function transitionner(c: CreneauEditorial, vers: StatutPlan, auteur: AuteurPlan): ResultatTransition {
  if (!transitionAutorisee(c.statut, vers)) return { ok: false, raison: `Transition refusée : ${c.statut} → ${vers}.` };
  if (auteur === "usine" && !STATUTS_ECRITS_PAR_USINE.includes(vers)) return { ok: false, raison: `L'usine n'écrit jamais « ${vers} ».` };
  // La validation est un geste tracé du fondateur : elle ne passe jamais par ici (jamais publiée sans validation).
  if (c.statut === "a_valider" && vers === "valide") return { ok: false, raison: "Une proposition se valide par validerProposition (trace du fondateur), pas par un simple changement de statut." };
  // Un retour en arrière efface l'ancienne trace : une nouvelle validation ne reprend pas la précédente.
  if (vers === "a_valider" || vers === "propose") {
    const { valideeLe: _le, valideePar: _par, ...reste } = c;
    return { ok: true, creneau: { ...reste, statut: vers } };
  }
  return { ok: true, creneau: { ...c, statut: vers } };
}

/** Les deux seules origines d'une entrée. */
export const ORIGINES_ENTREE: readonly OrigineEntree[] = ["vous", "usine"];

/** Garde « jamais publiée sans validation » : seul un créneau « valide » portant la trace du fondateur est publiable. PUR. */
export function estPubliable(c: CreneauEditorial): { ok: true } | { ok: false; raison: string } {
  if (c.statut !== "valide") return { ok: false, raison: `Statut « ${c.statut} » : non publiable sans validation.` };
  if (!c.valideeLe || !c.valideePar) return { ok: false, raison: "Aucune trace de validation par le fondateur." };
  return { ok: true };
}

const INSTANT_UTC = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d{1,3})?)?Z$/;

/** Vrai si la chaîne est un instant ISO UTC lisible (« AAAA-MM-JJTHH:MM[:SS[.mmm]]Z ») d'un jour qui existe. */
function instantUtcValide(v: string): boolean {
  return INSTANT_UTC.test(v) && jourExiste(v.slice(0, 10)) && !Number.isNaN(Date.parse(v));
}

/** Validation : réservée au Studio, depuis « a_valider » seulement ; pose valideeLe (instant ISO UTC) et valideePar. */
export function validerProposition(c: CreneauEditorial, auteur: AuteurPlan, le: string, par: string): ResultatTransition {
  if (auteur !== "studio") return { ok: false, raison: "Seul le fondateur valide une proposition." };
  if (c.statut !== "a_valider") return { ok: false, raison: `Statut « ${c.statut} » : seule une proposition « a_valider » se valide.` };
  if (!le || !par) return { ok: false, raison: "Date et auteur de la validation requis." };
  if (!instantUtcValide(le)) return { ok: false, raison: "Date de validation illisible (instant ISO en UTC attendu)." };
  return { ok: true, creneau: { ...c, statut: "valide", valideeLe: le, valideePar: par } };
}

/** Refus : geste du fondateur (Studio seulement) ; la proposition est archivée avec un motif facultatif, jamais supprimée. */
export function refuserProposition(c: CreneauEditorial, auteur: AuteurPlan, motif: string | undefined, le: string): ResultatTransition {
  if (auteur !== "studio") return { ok: false, raison: "Seul le fondateur refuse une proposition." };
  if (!instantUtcValide(le)) return { ok: false, raison: "Date du refus illisible (instant ISO en UTC attendu)." };
  if (c.statut !== "propose" && c.statut !== "a_valider") return { ok: false, raison: `Statut « ${c.statut} » : seule une proposition se refuse.` };
  const m = motif?.trim();
  const { motifRefus: _ancien, ...reste } = c;
  return { ok: true, creneau: { ...reste, statut: "archive", refuseLe: le, ...(m ? { motifRefus: m } : {}) } };
}

const JOUR = /^\d{4}-\d{2}-\d{2}$/;

/** Vrai si la chaîne AAAA-MM-JJ désigne un jour qui existe au calendrier. */
function jourExiste(jour: string): boolean {
  if (!JOUR.test(jour)) return false;
  const [a, m, j] = jour.split("-").map(Number);
  return new Date(Date.UTC(a, m - 1, j)).toISOString().slice(0, 10) === jour;
}

/** Liste des erreurs (vide = créneau valide). */
export function validerCreneau(c: CreneauEditorial): string[] {
  const e: string[] = [];
  if (!c.id) e.push("Identifiant manquant.");
  if (!jourExiste(c.jourVise)) e.push("Jour visé invalide (AAAA-MM-JJ).");
  if (!c.compteCible) e.push("Compte cible manquant.");
  if (c.videoId && c.visuelId) e.push("Une vidéo et un visuel ensemble sont refusés : choisir l'un des deux.");
  if (!STATUTS_PLAN.includes(c.statut)) e.push("Statut inconnu.");
  if (c.origine !== undefined && !ORIGINES_ENTREE.includes(c.origine)) e.push("Origine inconnue.");
  if (!Number.isInteger(c.decalages) || c.decalages < 0) e.push("Le nombre de décalages doit être un entier positif ou nul.");
  for (const [reseau, h] of Object.entries(c.heuresParReseau)) {
    if (!IDS_RESEAUX_PLAN.includes(reseau as never)) e.push(`Réseau inconnu : ${reseau}.`);
    else if (!h || !instantUtcValide(h)) e.push(`Heure invalide pour ${reseau} (ISO en UTC attendu).`);
  }
  return e;
}

/** Ajoute un décalage (copie). */
export function enregistrerDecalage(c: CreneauEditorial): CreneauEditorial {
  return { ...c, decalages: c.decalages + 1 };
}

/** Garde de mise à jour : le nombre de décalages ne baisse jamais. */
export function verifierMiseAJour(ancien: CreneauEditorial, nouveau: CreneauEditorial): { ok: true } | { ok: false; raison: string } {
  if (nouveau.decalages < ancien.decalages) return { ok: false, raison: `Les décalages ne peuvent pas baisser (${ancien.decalages} → ${nouveau.decalages}).` };
  return { ok: true };
}

/** Fusion de deux compteurs : le plus grand l'emporte, jamais de baisse. */
export function fusionnerDecalages(a: number, b: number): number {
  return Math.max(a, b);
}

/** Instant UTC → « HH:MM » à Paris. */
export function heureAffichageParis(instantUtc: string): string {
  return new Intl.DateTimeFormat("fr-FR", { timeZone: "Europe/Paris", hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(instantUtc));
}

/* ------------------------------------------------------------------ */
/* Horloge de Paris                                                    */
/* ------------------------------------------------------------------ */

const FORMAT_JOUR_PARIS = new Intl.DateTimeFormat("fr-CA", { timeZone: "Europe/Paris", year: "numeric", month: "2-digit", day: "2-digit" });

/** Jour « AAAA-MM-JJ » à Paris à l'instant donné (jamais le jour UTC). Lève une erreur si l'horloge est illisible. */
export function jourParis(maintenant: Date): string {
  return FORMAT_JOUR_PARIS.format(maintenant);
}

/** Jour de Paris de `maintenant` (instant, ou déjà un jour « AAAA-MM-JJ »), `null` s'il est illisible. */
function jourDeReference(maintenant: Date | string): string | null {
  if (typeof maintenant === "string") return jourExiste(maintenant) ? maintenant : null;
  try {
    return jourParis(maintenant);
  } catch {
    return null;
  }
}

/** Vrai si le jour est strictement avant le jour de Paris. Une date ou une horloge illisible compte pour passée (on verrouille). */
export function estPasse(jour: string, maintenant: Date | string): boolean {
  const aujourdhui = jourDeReference(maintenant);
  return aujourdhui === null || !jourExiste(jour) || jour < aujourdhui;
}

/** État interne d'un créneau, à l'heure de Paris. `null` : statut inconnu (jamais pris pour un brouillon). */
export function etatInterne(c: Pick<CreneauEditorial, "statut" | "jourVise" | "refuseLe">, maintenant: Date | string): EtatInterne | null {
  if (!Object.hasOwn(TRANSITIONS, c.statut)) return null;
  if (c.statut === "archive") return c.refuseLe ? "refusee" : "archive";
  const pasParti = c.statut === "propose" || c.statut === "a_valider" || c.statut === "valide";
  const aujourdhui = jourDeReference(maintenant);
  if (pasParti && aujourdhui !== null && jourExiste(c.jourVise) && c.jourVise < aujourdhui) return "manquee";
  return c.statut;
}

/* ------------------------------------------------------------------ */
/* Table unique « état interne → libellé affiché »                     */
/* ------------------------------------------------------------------ */

/** Les six états qu'une personne lit dans le calendrier (ceux de la maquette validée). */
export type EtatCalendrier = "brouillon" | "a_valider" | "programme" | "publie" | "a_corriger" | "idee";

/** Ordre de la légende. */
export const ETATS_CALENDRIER: readonly EtatCalendrier[] = ["brouillon", "a_valider", "programme", "publie", "a_corriger", "idee"];

export interface LibelleEtat {
  libelle: string;
  ton: Tonalite;
}

/** Table « état → libellé et ton » fournie de l'extérieur. */
export type TableLibelles = Readonly<Record<string, LibelleEtat>>;

/** Table « statut interne → état affiché » ; `null` : l'entrée n'a pas sa place dans le calendrier. */
export type TableStatuts = Readonly<Record<string, string | null>>;

const BROUILLON: LibelleEtat = { libelle: "Brouillon", ton: "neutre" };
const A_CORRIGER: LibelleEtat = { libelle: "À corriger", ton: "brique" };
const IDEE: LibelleEtat = { libelle: "Idée de l'IA", ton: "pointille" };

/**
 * LA table : chaque état interne (et chaque état affiché) a son libellé et son ton, ici et nulle part ailleurs.
 * Le ton dit l'état, jamais le réseau. « Échec diffuseur » (echec) s'affiche « À corriger ».
 */
export const LIBELLES_ETAT: Readonly<Record<EtatCalendrier | EtatInterne, LibelleEtat>> = {
  brouillon: BROUILLON,
  a_valider: { libelle: "À valider", ton: "ambre" },
  programme: { libelle: "Programmé", ton: "sauge" },
  publie: { libelle: "Publié", ton: "contour" },
  a_corriger: A_CORRIGER,
  idee: IDEE,
  propose: IDEE,
  // Validée mais pas encore programmée : rien n'est parti, il reste quelque chose à faire.
  valide: BROUILLON,
  echec: A_CORRIGER,
  refusee: { libelle: "Refusée", ton: "contour" },
  manquee: { libelle: "Manquée", ton: "brique" },
  archive: { libelle: "Archivée", ton: "neutre" },
};

/** Ce qu'on montre quand un état n'est dans aucune table : on le dit, on ne le prend pas pour un brouillon. */
export const LIBELLE_ETAT_INCONNU: LibelleEtat = { libelle: "État à vérifier", ton: "neutre" };

/** Les six états de la légende, tirés de la table unique (pas une seconde table). C'est le défaut d'une pastille. */
const LIBELLES_ETAT_CALENDRIER: Readonly<Record<string, LibelleEtat>> = Object.fromEntries(ETATS_CALENDRIER.map((e) => [e, LIBELLES_ETAT[e]]));

function chercher(table: Readonly<Record<string, LibelleEtat>>, etat: string): (LibelleEtat & { connu: boolean }) | null {
  return Object.hasOwn(table, etat) ? { ...table[etat], connu: true } : null;
}

/**
 * Libellé d'un état affiché. `libelles` (fournie de l'extérieur, par exemple LIBELLES_ETAT en entier pour nommer
 * « Refusée » et « Manquée ») l'emporte ; sans elle, les six états de la légende. `connu` est faux sinon.
 */
export function libelleEtat(etat: string, libelles?: TableLibelles): LibelleEtat & { connu: boolean } {
  return (libelles && chercher(libelles, etat)) || chercher(LIBELLES_ETAT_CALENDRIER, etat) || { ...LIBELLE_ETAT_INCONNU, connu: false };
}

/** Libellé affiché d'un état interne (table unique, tous les états). */
export function libelleStatut(etat: string): LibelleEtat & { connu: boolean } {
  return chercher(LIBELLES_ETAT, etat) || { ...LIBELLE_ETAT_INCONNU, connu: false };
}

/** Statuts internes (plan éditorial et publications) → état affiché. Table par défaut, remplaçable. */
export const STATUTS_VERS_ETAT: TableStatuts = {
  propose: "idee",
  a_valider: "a_valider",
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
export function etatDepuisStatut(statut: string | null | undefined, table: TableStatuts = STATUTS_VERS_ETAT): string | null {
  if (vide(statut)) return "brouillon";
  const cle = (statut ?? "").trim();
  return Object.hasOwn(table, cle) ? table[cle] : null;
}

/* ------------------------------------------------------------------ */
/* Boutons du tiroir selon l'état                                      */
/* ------------------------------------------------------------------ */

/** Bouton principal de chaque état affiché (maquette validée). Absent : aucun bouton principal. */
const BOUTON_PRINCIPAL: Readonly<Record<string, string>> = {
  brouillon: "Compléter le texte",
  a_valider: "Valider et programmer",
  programme: "Modifier le texte",
  a_corriger: "Corriger et renvoyer",
  idee: "Accepter l'idée",
};

export type RaisonVerrouTiroir = "publiee" | "passee" | "illisible" | "inconnu" | "archivee";

export interface BoutonsTiroir {
  /** Libellé du bouton principal ; `null` : aucun (publiée, passée, archivée, état inconnu). */
  principal: string | null;
  /** Autres gestes, dans l'ordre d'affichage. */
  secondaires: string[];
  verrouille: boolean;
  raison: RaisonVerrouTiroir | null;
}

/**
 * Boutons du tiroir d'une entrée. `maintenant` : l'instant, ou le jour de Paris « AAAA-MM-JJ ».
 * Une entrée publiée ou passée (jour de Paris) est verrouillée : pas de bouton principal. Le jour même reste ouvert.
 */
export function boutonsTiroir(etat: string, jour: string, maintenant: Date | string): BoutonsTiroir {
  const dupliquer = "Dupliquer vers un autre réseau";
  const affiche = Object.hasOwn(STATUTS_VERS_ETAT, etat) ? STATUTS_VERS_ETAT[etat] : etat;
  const verrou = (raison: RaisonVerrouTiroir, secondaires: string[] = []): BoutonsTiroir => ({ principal: null, secondaires, verrouille: true, raison });
  if (affiche === "publie") return verrou("publiee", ["Voir sur le réseau", dupliquer]);
  if (affiche !== null && !Object.hasOwn(LIBELLES_ETAT, affiche)) return verrou("inconnu");
  const aujourdhui = jourDeReference(maintenant);
  if (aujourdhui === null || !jourExiste(jour)) return verrou("illisible");
  if (jour < aujourdhui) return verrou("passee", affiche === "manquee" ? ["Déplacer au…", dupliquer] : [dupliquer]);
  if (affiche === null || affiche === "refusee" || affiche === "archive") return verrou("archivee");
  return {
    principal: BOUTON_PRINCIPAL[affiche] ?? null,
    secondaires: [dupliquer, affiche === "idee" ? "Refuser l'idée" : "Retirer du calendrier"],
    verrouille: false,
    raison: null,
  };
}
