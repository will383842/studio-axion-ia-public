/**
 * RC-33 : planificateur du stock de messages (PUR : aucune écriture, aucun réseau, aucune horloge).
 * Priorité : 1) entrées du stock avec échéance, 2) entrées du stock par priorité, 3) sujets proposés par l'usine.
 * Quotas par jour et par réseau et espacement respectés. Une entrée du stock n'est jamais supprimée ni remplacée par
 * un sujet de l'usine : au pire elle est décalée (échéance dépassée, signalée) ou reste en stock (aucun créneau, signalée).
 * Une date choisie par le fondateur n'est jamais déplacée. Les dates sont des jours AAAA-MM-JJ (heure de Paris).
 * Une entrée = un créneau : ses réseaux sont les réseaux acceptés ; sans réseau, tous sont acceptés.
 */
import { jourValide, RANG_PRIORITE, estActif, reseauxDe, type MessageStock } from "@/domaine/stock-messages";
import type { IdReseau } from "@/domaine/types";

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
}

export interface EntreePlanificateur {
  stock: readonly EntreeStock[];
  sujets: readonly SujetUsine[];
  creneaux: readonly CreneauLibre[];
  existants?: readonly PostOccupe[];
  /** Posts par jour et par réseau (entier ≥ 0 ; invalide = 1). */
  quotaParJour?: number;
  quotaParReseau?: Partial<Record<IdReseau, number>>;
  /** Écart minimal en jours entre deux jours de publication d'un même réseau (invalide = 0). */
  ecartMinJours?: number;
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

export type CodeAlerte = "echeance-impossible" | "quota-depasse" | "date-illisible";
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

function entierOu(v: unknown, defaut: number): number {
  return typeof v === "number" && Number.isInteger(v) && v >= 0 ? v : defaut;
}

function numeroJour(j: string): number {
  const [a, m, d] = j.split("-").map(Number);
  return Date.UTC(a, m - 1, d) / 86_400_000;
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

export function planifierStock(entree: EntreePlanificateur): PlanStock {
  const quotaDefaut = entierOu(entree.quotaParJour, 1);
  const quotaDe = (r: IdReseau) => entierOu(entree.quotaParReseau?.[r], quotaDefaut);
  const ecart = entierOu(entree.ecartMinJours, 0);

  // Créneaux lisibles, sans doublon d'identifiant, du plus proche au plus lointain.
  const vus = new Set<string>();
  const creneaux = entree.creneaux
    .filter((c) => jourValide(c.jour) && !vus.has(c.id) && vus.add(c.id))
    .map((c) => ({ ...c }))
    .sort((a, b) => comparer(a.jour, b.jour) || comparer(a.heure ?? "", b.heure ?? "") || comparer(a.id, b.id));
  const pris = new Set<string>();

  // Posts déjà retenus par réseau (existants lisibles + affectations du plan).
  const jours = new Map<IdReseau, Map<string, number>>();
  const compter = (r: IdReseau, j: string) => {
    const m = jours.get(r) ?? new Map<string, number>();
    m.set(j, (m.get(j) ?? 0) + 1);
    jours.set(r, m);
  };
  for (const e of entree.existants ?? []) if (jourValide(e.jour)) compter(e.reseau, e.jour);

  const libre = (r: IdReseau, j: string): boolean => {
    const m = jours.get(r);
    if (!m) return true;
    if ((m.get(j) ?? 0) >= quotaDe(r)) return false;
    if (ecart > 0) for (const autre of m.keys()) if (autre !== j && Math.abs(numeroJour(autre) - numeroJour(j)) < ecart) return false;
    return true;
  };

  const plan: PlanStock = { affectations: [], alertes: [], nonPlaces: [], sujetsSansCreneau: [] };
  const accepte = (reseaux: readonly IdReseau[], r: IdReseau) => reseaux.length === 0 || reseaux.includes(r);
  const premier = (reseaux: readonly IdReseau[], jusquau?: string) =>
    creneaux.find((c) => !pris.has(c.id) && accepte(reseaux, c.reseau) && libre(c.reseau, c.jour) && (!jusquau || c.jour <= jusquau));
  const poser = (origine: Affectation["origine"], id: string, c: CreneauLibre, epingle: boolean): Affectation => {
    pris.add(c.id);
    compter(c.reseau, c.jour);
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
      // Sans réseau ni créneau ce jour-là, rien à poser : le message reste en stock, signalé.
      plan.nonPlaces.push({ id: m.id, raison: "aucun-creneau" });
      continue;
    }
    const depasse = !libre(reseau, jour);
    let a: Affectation;
    if (c) a = poser("stock", m.id, c, true);
    else {
      compter(reseau, jour);
      a = { id: m.id, origine: "stock", reseau, jour, epingle: true };
      plan.affectations.push(a);
    }
    if (depasse) plan.alertes.push({ id: m.id, code: "quota-depasse", message: `La date choisie dépasse le quota du ${a.jour} : elle est conservée.` });
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
