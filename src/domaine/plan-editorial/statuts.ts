/** Statuts du plan : tableau unique des transitions, garde « l'usine n'écrit pas programme/publie/echec ». PUR. */
import { IDS_RESEAUX_PLAN } from "./correspondances";
import type { AuteurPlan, CreneauEditorial, OrigineEntree, ResultatTransition, StatutPlan } from "./types";

export const STATUTS_PLAN: readonly StatutPlan[] = ["propose", "a_valider", "valide", "programme", "publie", "echec", "archive"];

/** Tableau unique : de → vers autorisés. Tout le reste est refusé. */
export const TRANSITIONS: Readonly<Record<StatutPlan, readonly StatutPlan[]>> = {
  propose: ["a_valider", "archive"],
  a_valider: ["valide", "propose", "archive"],
  valide: ["programme", "a_valider", "archive"],
  programme: ["publie", "echec", "valide"],
  publie: ["archive"],
  echec: ["programme", "valide", "archive"],
  archive: [],
};

/** Seuls statuts que l'usine peut écrire. */
export const STATUTS_ECRITS_PAR_USINE: readonly StatutPlan[] = ["propose", "a_valider", "archive"];

export function transitionAutorisee(de: StatutPlan, vers: StatutPlan): boolean {
  return TRANSITIONS[de].includes(vers);
}

export function transitionner(c: CreneauEditorial, vers: StatutPlan, auteur: AuteurPlan): ResultatTransition {
  if (!transitionAutorisee(c.statut, vers)) return { ok: false, raison: `Transition refusée : ${c.statut} → ${vers}.` };
  if (auteur === "usine" && !STATUTS_ECRITS_PAR_USINE.includes(vers)) return { ok: false, raison: `L'usine n'écrit jamais « ${vers} ».` };
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

/** Validation : réservée au Studio, depuis « a_valider » seulement ; pose valideeLe et valideePar. */
export function validerProposition(c: CreneauEditorial, auteur: AuteurPlan, le: string, par: string): ResultatTransition {
  if (auteur !== "studio") return { ok: false, raison: "Seul le fondateur valide une proposition." };
  if (c.statut !== "a_valider") return { ok: false, raison: `Statut « ${c.statut} » : seule une proposition « a_valider » se valide.` };
  if (!le || !par) return { ok: false, raison: "Date et auteur de la validation requis." };
  return { ok: true, creneau: { ...c, statut: "valide", valideeLe: le, valideePar: par } };
}

/** Refus : la proposition est archivée avec un motif facultatif, jamais supprimée. */
export function refuserProposition(c: CreneauEditorial, motif: string | undefined, le: string): ResultatTransition {
  if (c.statut !== "propose" && c.statut !== "a_valider") return { ok: false, raison: `Statut « ${c.statut} » : seule une proposition se refuse.` };
  const m = motif?.trim();
  const { motifRefus: _ancien, ...reste } = c;
  return { ok: true, creneau: { ...reste, statut: "archive", refuseLe: le, ...(m ? { motifRefus: m } : {}) } };
}

const JOUR = /^\d{4}-\d{2}-\d{2}$/;
const INSTANT_UTC = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d{1,3})?)?Z$/;

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
  if (!Number.isInteger(c.decalages) || c.decalages < 0) e.push("Le nombre de décalages doit être un entier positif ou nul.");
  for (const [reseau, h] of Object.entries(c.heuresParReseau)) {
    if (!IDS_RESEAUX_PLAN.includes(reseau as never)) e.push(`Réseau inconnu : ${reseau}.`);
    else if (!h || !INSTANT_UTC.test(h) || !jourExiste(h.slice(0, 10)) || Number.isNaN(Date.parse(h))) e.push(`Heure invalide pour ${reseau} (ISO en UTC attendu).`);
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
