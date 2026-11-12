/**
 * RC-33 : planificateur du stock de messages (PUR : aucune écriture, aucun réseau, aucune horloge).
 * Priorité : 1) entrées du stock avec échéance, 2) entrées du stock par priorité, 3) sujets proposés par l'usine.
 * Quotas par jour et par réseau, écart en heures, jour sans publication (week-end LinkedIn) : chaque candidat est
 * vérifié par le noyau de cadence (L3-16 : verifierEspacement) avec les réglages par réseau de L7-10 ; ce service ne
 * porte aucune règle d'espacement à lui. Les entrées du stock déjà « planifié » ne comptent que si l'appelant les
 * recopie dans `existants` (le stock ne porte pas leur jour). Une entrée du stock n'est jamais supprimée ni remplacée par
 * un sujet de l'usine : au pire elle est décalée (échéance dépassée, signalée) ou reste en stock (aucun créneau, signalée).
 * Une date choisie par le fondateur n'est jamais déplacée. Les dates sont des jours AAAA-MM-JJ (heure de Paris).
 * Une entrée = un créneau : ses réseaux sont les réseaux acceptés ; sans réseau, tous sont acceptés.
 */
import { jourValide, RANG_PRIORITE, estActif, reseauxDe, type MessageStock } from "@/domaine/stock-messages";
import type { IdReseau } from "@/domaine/types";
import { REGLES_PAR_DEFAUT, verifierEspacement, type Constat, type PostPlanifie, type ReglesEspacement } from "@/domaine/cadence/verifier";
import { lireHeure, normaliserReglagesCadence, REGLAGES_CADENCE_DEFAUT, type ReglagesCadence } from "@/domaine/cadence/reglages";

export type EntreeStock = MessageStock & {
  /** Jour choisi par le fondateur (AAAA-MM-JJ) : jamais déplacé. */
  dateChoisie?: string;
};

export interface SujetUsine {
  id: string;
  /** Réseaux acceptés ; absent ou vide = tous. */
  reseaux?: IdReseau[];
}

export interface CreneauLibre {
  id: string;
  reseau: IdReseau;
  jour: string;
  heure?: string;
}

export interface PostOccupe {
  reseau: IdReseau;
  jour: string;
  /** HH:MM (Paris) ; absent ou illisible = 09:00. */
  heure?: string;
}

export interface EntreePlanificateur {
  stock: readonly EntreeStock[];
  sujets: readonly SujetUsine[];
  creneaux: readonly CreneauLibre[];
  existants?: readonly PostOccupe[];
  /** Réglages de cadence L7-10 (quota par jour et écart en minutes, par réseau) ; absent ou illisible = valeurs de départ. */
  reglages?: ReglagesCadence;
}

export interface Affectation {
  id: string;
  origine: "stock" | "usine";
  reseau: IdReseau;
  jour: string;
  heure?: string;
  /** Absent si la date choisie ne correspond à aucun créneau libre. */
  creneauId?: string;
  epingle: boolean;
}

export type CodeAlerte =
  | "echeance-impossible"
  | "quota-depasse"
  | "ecart-non-respecte"
  | "weekend-interdit"
  | "date-illisible"
  | "date-sans-reseau";
export interface Alerte {
  id: string;
  code: CodeAlerte;
  message: string;
}

export interface PlanStock {
  affectations: Affectation[];
  alertes: Alerte[];
  /** Entrées du stock restées en stock faute de créneau : jamais supprimées. */
  nonPlaces: { id: string; raison: "aucun-creneau" }[];
  sujetsSansCreneau: string[];
}

function rangPriorite(m: MessageStock): number {
  const p = m.priorite ?? "normale";
  return Object.hasOwn(RANG_PRIORITE, p) ? RANG_PRIORITE[p] : 3;
}

const comparer = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);

/** Ordre du stock : avec échéance d'abord (échéance, priorité), puis par priorité, puis ancienneté, puis identifiant. */
function ordreStock(a: EntreeStock, b: EntreeStock): number {
  const ea = a.echeance && jourValide(a.echeance) ? a.echeance : undefined;
  const eb = b.echeance && jourValide(b.echeance) ? b.echeance : undefined;
  if ((ea === undefined) !== (eb === undefined)) return ea === undefined ? 1 : -1;
  return (
    (ea && eb ? comparer(ea, eb) : 0) ||
    rangPriorite(a) - rangPriorite(b) ||
    comparer(a.creeLe ?? "", b.creeLe ?? "") ||
    comparer(a.id, b.id)
  );
}

const HEURE_DEFAUT = "09:00";
const CANDIDAT = "__candidat__";
const heureLisible = (h: unknown): string => lireHeure(h) ?? HEURE_DEFAUT;

export function planifierStock(entree: EntreePlanificateur): PlanStock {
  const reglages = normaliserReglagesCadence(entree.reglages ?? REGLAGES_CADENCE_DEFAUT);
  const reglesDe = (r: IdReseau): ReglesEspacement => ({
    ...REGLES_PAR_DEFAUT,
    ecartMinH: reglages.reseaux[r].ecartMinMinutes / 60,
    quotaParJour: reglages.reseaux[r].quotaParJour,
  });

  // Créneaux lisibles, sans doublon d'identifiant, du plus proche au plus lointain.
  const vus = new Set<string>();
  const creneaux = entree.creneaux
    .filter((c) => jourValide(c.jour) && !vus.has(c.id) && vus.add(c.id))
    .map((c) => ({ ...c }))
    .sort((a, b) => comparer(a.jour, b.jour) || comparer(a.heure ?? "", b.heure ?? "") || comparer(a.id, b.id));
  const pris = new Set<string>();

  // Posts déjà retenus (existants lisibles + affectations du plan), au format du noyau de cadence.
  // Chaque post a son propre pilier : la règle pilier+cible ne s'applique pas à des textes distincts du stock.
  const posts: PostPlanifie[] = [];
  const retenir = (id: string, r: IdReseau, jour: string, heure?: string) =>
    posts.push({ id, reseau: r, jour, heure: heureLisible(heure), pilier: `post:${id}`, cible: "" });
  (entree.existants ?? []).forEach((e, i) => {
    if (jourValide(e.jour)) retenir(`existant:${i}`, e.reseau, e.jour, e.heure);
  });

  /** Constats du noyau (violations et avertissements) qui touchent un post candidat posé à ce créneau. */
  const constatsDe = (r: IdReseau, jour: string, heure?: string): Constat[] => {
    const candidat: PostPlanifie = { id: CANDIDAT, reseau: r, jour, heure: heureLisible(heure), pilier: CANDIDAT, cible: "" };
    return verifierEspacement([...posts.filter((p) => p.reseau === r), candidat], reglesDe(r)).filter((c) => c.posts.includes(CANDIDAT));
  };
  const libre = (r: IdReseau, jour: string, heure?: string): boolean => constatsDe(r, jour, heure).length === 0;

  const plan: PlanStock = { affectations: [], alertes: [], nonPlaces: [], sujetsSansCreneau: [] };
  const accepte = (reseaux: readonly IdReseau[], r: IdReseau) => reseaux.length === 0 || reseaux.includes(r);
  const premier = (reseaux: readonly IdReseau[], jusquau?: string) =>
    creneaux.find((c) => !pris.has(c.id) && accepte(reseaux, c.reseau) && libre(c.reseau, c.jour, c.heure) && (!jusquau || c.jour <= jusquau));
  const poser = (origine: Affectation["origine"], id: string, c: CreneauLibre, epingle: boolean): Affectation => {
    pris.add(c.id);
    retenir(`${origine}:${id}`, c.reseau, c.jour, c.heure);
    const a: Affectation = { id, origine, reseau: c.reseau, jour: c.jour, heure: c.heure, creneauId: c.id, epingle };
    plan.affectations.push(a);
    return a;
  };

  const actives = entree.stock.filter(estActif);

  // 0) Dates choisies : placées d'office à leur jour, jamais déplacées (au pire hors quota, signalé).
  const libres: EntreeStock[] = [];
  const fixes: { m: EntreeStock; jour: string }[] = [];
  for (const m of [...actives].sort(ordreStock)) {
    if (m.dateChoisie === undefined) libres.push(m);
    else if (jourValide(m.dateChoisie)) fixes.push({ m, jour: m.dateChoisie });
    else {
      plan.alertes.push({ id: m.id, code: "date-illisible", message: "La date choisie est illisible : le message est placé selon sa priorité." });
      libres.push(m);
    }
  }
  fixes.sort((a, b) => comparer(a.jour, b.jour) || ordreStock(a.m, b.m));
  for (const { m, jour } of fixes) {
    const reseaux = reseauxDe(m);
    const c = creneaux.find((x) => !pris.has(x.id) && x.jour === jour && accepte(reseaux, x.reseau));
    const reseau = c?.reseau ?? reseaux[0];
    if (!reseau) {
      // Sans réseau ni créneau ce jour-là, rien à poser : le message reste en stock, avec une alerte dédiée.
      plan.alertes.push({ id: m.id, code: "date-sans-reseau", message: `La date choisie (${jour}) n'a pas de réseau : choisissez un réseau pour la placer.` });
      plan.nonPlaces.push({ id: m.id, raison: "aucun-creneau" });
      continue;
    }
    const constats = constatsDe(reseau, jour, c?.heure);
    let a: Affectation;
    if (c) a = poser("stock", m.id, c, true);
    else {
      retenir(`stock:${m.id}`, reseau, jour);
      a = { id: m.id, origine: "stock", reseau, jour, epingle: true };
      plan.affectations.push(a);
    }
    const alerte = (code: CodeAlerte, message: string) => plan.alertes.push({ id: m.id, code, message });
    if (constats.some((x) => x.code === "quota")) alerte("quota-depasse", `La date choisie dépasse le quota du ${jour} : elle est conservée.`);
    if (constats.some((x) => x.code === "ecart")) alerte("ecart-non-respecte", `La date choisie (${jour}) ne respecte pas l'écart minimal entre deux publications : elle est conservée.`);
    if (constats.some((x) => x.code === "weekend")) alerte("weekend-interdit", `Pas de publication le week-end sur ce réseau (${jour}) : la date choisie est conservée.`);
  }

  // 1-2) Stock libre : échéance, puis priorité.
  for (const m of libres) {
    const reseaux = reseauxDe(m);
    const echeance = m.echeance && jourValide(m.echeance) ? m.echeance : undefined;
    let c = premier(reseaux, echeance);
    if (!c) {
      c = premier(reseaux);
      if (echeance) plan.alertes.push({ id: m.id, code: "echeance-impossible", message: `L'échéance du ${echeance} ne peut pas être tenue.` });
    }
    if (c) poser("stock", m.id, c, false);
    else plan.nonPlaces.push({ id: m.id, raison: "aucun-creneau" });
  }

  // 3) Sujets de l'usine : seulement dans les créneaux que le stock a laissés.
  for (const s of entree.sujets) {
    const c = premier(s.reseaux ?? []);
    if (c) poser("usine", s.id, c, false);
    else plan.sujetsSansCreneau.push(s.id);
  }

  // Ordre de sortie : stock avant usine, puis jour et heure.
  plan.affectations.sort(
    (a, b) => (a.origine === b.origine ? 0 : a.origine === "stock" ? -1 : 1) || comparer(a.jour, b.jour) || comparer(a.heure ?? "", b.heure ?? "") || comparer(a.id, b.id),
  );
  return plan;
}
