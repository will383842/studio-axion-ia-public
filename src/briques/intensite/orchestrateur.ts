/**
 * CHEF D'ORCHESTRE DE L'INTENSITÉ (lot du 02/10, D1 ; consigne `INTENSITE-ET-BRUITAGES.md` §1). Brique commune, PURE,
 * déterministe, sans aucun format : les moteurs et les briques DEMANDENT, l'orchestrateur DÉCIDE.
 *
 * Modèle (écrit une fois, testé sur 20 scripts et 3 niveaux, `tests/d1-orchestrateur.test.ts`) :
 *  - un effet pèse à son INSTANT D'APPARITION (`debutSec`) : c'est là que l'œil le reçoit ;
 *  - charge d'une fenêtre = somme des poids apparus dans ]t − 3 s ; t] ; plafond selon le niveau (3 · 5 · 7) ;
 *  - un effet « fort » (poids ≥ 2) occupe l'écran de `debutSec` à `finSec` : jamais deux forts en même temps, et
 *    aucun fort ne commence moins de 1,5 s après la fin d'un autre (respiration) ;
 *  - ordre d'examen : verrouillé (choix de Will, passe TOUJOURS, n'est jamais décalé) > accroche (0-2 s) > relance >
 *    normale ; à priorité égale, la structure (illustration, incrustation, angle, recadrage, coupe) avant les accents
 *    (Impact, Bandeau, souligné), puis le zoom lent et enfin les bruitages ; puis l'ordre du temps ;
 *  - un effet qui ne tient pas est DÉCALÉ (pas de 0,1 s, au plus `decalageMaxSec`, le plus proche d'abord, plus tard
 *    avant plus tôt à écart égal) ou SAUTÉ, avec la raison en clair.
 * Seuls deux verrouillés peuvent ensemble dépasser le plafond : le rapport le montre (alerte « intensite »).
 */
import type { NiveauIntensite, RapportIntensite } from "@/domaine/types";
import { PLAFOND_PAR_NIVEAU, POIDS_EFFETS, REGLES_INTENSITE, type DecisionEffet, type DemandeEffet, type OptionsOrchestration, type OrchestrerIntensite, type PrioriteEffet, type ResultatOrchestration, type TypeEffet } from "./types";

export const EPS = 1e-6;
const r3 = (x: number) => Math.round(x * 1000) / 1000;

const RANG_PRIORITE: Record<PrioriteEffet, number> = { verrouille: 0, accroche: 1, relance: 2, normale: 3 };
/** À priorité égale : la structure du montage d'abord, les accents ensuite, les bruitages en dernier. */
export const RANG_TYPE: Record<TypeEffet, number> = {
  illustration: 0,
  incrustation: 1,
  "second-angle": 2,
  poitrine: 3,
  coupe: 4,
  impact: 5,
  bandeau: 6,
  souligne: 7,
  "zoom-lent": 8,
  bruitage: 9,
};
/** Autour d'une relance du script, les effets passent avant les autres (s, des deux côtés). */
export const RAYON_RELANCE_SEC = 1;

/** Un effet retenu (garde ou décalé), tel que la courbe le compte. */
export interface EffetPlace {
  id: string;
  type: TypeEffet;
  debutSec: number;
  finSec: number;
  poids: number;
  verrouille: boolean;
}

export const estFort = (type: TypeEffet) => POIDS_EFFETS[type] >= REGLES_INTENSITE.poidsFort;

/** Priorité effective : « normale » devient « accroche » avant 2 s, « relance » près d'une relance du script. */
export function prioriteEffective(d: DemandeEffet, relancesSec: number[] = []): PrioriteEffet {
  if (d.priorite !== "normale") return d.priorite;
  if (d.debutSec < REGLES_INTENSITE.accrocheSec - EPS) return "accroche";
  if (relancesSec.some((r) => Math.abs(r - d.debutSec) <= RAYON_RELANCE_SEC + EPS)) return "relance";
  return "normale";
}

/** Charge de la fenêtre ]t − 3 ; t] (poids des effets apparus dedans). */
export function chargeA(effets: Pick<EffetPlace, "debutSec" | "poids">[], t: number): number {
  const f = REGLES_INTENSITE.fenetreSec;
  let s = 0;
  for (const e of effets) if (e.debutSec > t - f + EPS && e.debutSec <= t + EPS) s += e.poids;
  return Math.round(s * 100) / 100;
}

/** Pourquoi `e` ne tient pas parmi `places` (null : il tient). Deux verrouillés ne se gênent jamais. */
function obstacle(e: EffetPlace, places: EffetPlace[], plafond: number): string | null {
  const f = REGLES_INTENSITE.fenetreSec;
  if (e.verrouille) return null;
  // Plafond : chaque fenêtre qui contient l'apparition de `e` finit à un instant d'apparition dans [e ; e + 3 s[.
  const avec = [...places, e];
  const fins = [e.debutSec, ...places.filter((p) => p.debutSec >= e.debutSec - EPS && p.debutSec < e.debutSec + f - EPS).map((p) => p.debutSec)];
  for (const t of fins) if (chargeA(avec, t) > plafond + EPS) return "plafond de la fenêtre de 3 s atteint";
  if (estFort(e.type)) {
    const resp = REGLES_INTENSITE.respirationApresFortSec;
    for (const p of places) {
      if (!estFort(p.type)) continue;
      if (e.debutSec < p.finSec - EPS && p.debutSec < e.finSec - EPS) return "deux effets forts en même temps";
      if (e.debutSec >= p.finSec - EPS && e.debutSec < p.finSec + resp - EPS) return "respiration après un effet fort";
      if (p.debutSec >= e.finSec - EPS && p.debutSec < e.finSec + resp - EPS) return "respiration avant un effet fort";
    }
  }
  return null;
}

/** Instants essayés pour décaler : 0, +0,1, −0,1, +0,2, −0,2… jusqu'à `decalageMaxSec`, dans la vidéo. */
function essais(d: DemandeEffet, dureeSec: number): number[] {
  const max = Math.max(0, d.decalageMaxSec ?? 0);
  const duree = Math.max(0, d.finSec - d.debutSec);
  const sorties: number[] = [d.debutSec];
  for (let k = 1; k * 0.1 <= max + EPS; k++) {
    for (const s of d.decalageSens === "plus-tard" ? [1] : d.decalageSens === "plus-tot" ? [-1] : [1, -1]) {
      const t = r3(d.debutSec + s * k * 0.1);
      if (t < -EPS || t + duree > dureeSec + EPS) continue;
      sorties.push(t);
    }
  }
  return sorties;
}

/** Courbe et dépassements d'un ensemble d'effets retenus. */
export function rapportDe(places: EffetPlace[], niveau: NiveauIntensite, dureeSec: number, compte: Pick<RapportIntensite, "effetsGardes" | "effetsDecales" | "effetsSautes">): RapportIntensite {
  const plafond = PLAFOND_PAR_NIVEAU[niveau];
  const pas = REGLES_INTENSITE.pasCourbeSec;
  const courbe: RapportIntensite["courbe"] = [];
  for (let t = 0; t <= dureeSec + EPS; t = r3(t + pas)) courbe.push({ tSec: t, charge: chargeA(places, t) });
  // Dépassements exacts : à chaque instant d'apparition (la charge ne monte qu'à ces instants), fusionnés.
  const depassements: RapportIntensite["depassements"] = [];
  const instants = [...new Set(places.map((p) => p.debutSec))].sort((a, b) => a - b);
  const facultatifs = places.filter((p) => !p.verrouille);
  for (const t of instants) {
    const charge = chargeA(places, t);
    if (charge <= plafond + EPS) continue;
    // Un surplus fait SEULEMENT d'effets qui passent toujours (structure, montant, choix de Will) n'est pas une faute.
    if (chargeA(facultatifs, t) <= EPS) continue;
    const debut = r3(Math.max(0, t - REGLES_INTENSITE.fenetreSec));
    const dernier = depassements.at(-1);
    if (dernier && debut <= dernier.finSec + EPS) {
      dernier.finSec = r3(t);
      dernier.charge = Math.max(dernier.charge, charge);
    } else depassements.push({ debutSec: debut, finSec: r3(t), charge });
  }
  return { niveau, plafond, courbe, depassements, ...compte };
}

/** L'orchestrateur (signature figée `OrchestrerIntensite`). */
export const orchestrerIntensite: OrchestrerIntensite = (demandes: DemandeEffet[], options: OptionsOrchestration): ResultatOrchestration => {
  const plafond = PLAFOND_PAR_NIVEAU[options.niveau] ?? PLAFOND_PAR_NIVEAU.equilibre;
  const ordre = demandes
    .map((d, i) => ({ d, i, p: prioriteEffective(d, options.relancesSec) }))
    .sort((a, b) => RANG_PRIORITE[a.p] - RANG_PRIORITE[b.p] || RANG_TYPE[a.d.type] - RANG_TYPE[b.d.type] || a.d.debutSec - b.d.debutSec || a.i - b.i);
  const places: EffetPlace[] = [];
  const decisions = new Map<string, DecisionEffet>();
  for (const { d, p } of ordre) {
    const duree = Math.max(0, d.finSec - d.debutSec);
    const base: Omit<EffetPlace, "debutSec" | "finSec"> = { id: d.id, type: d.type, poids: POIDS_EFFETS[d.type], verrouille: p === "verrouille" };
    let premiere: string | null = null;
    let retenu: number | null = null;
    for (const t of p === "verrouille" ? [d.debutSec] : essais(d, options.dureeSec)) {
      const raison = obstacle({ ...base, debutSec: t, finSec: r3(t + duree) }, places, plafond);
      if (!raison) {
        retenu = t;
        break;
      }
      premiere ??= raison;
    }
    if (retenu === null) {
      decisions.set(d.id, { id: d.id, decision: "saute", debutSec: d.debutSec, finSec: d.finSec, raison: premiere ?? undefined });
      continue;
    }
    places.push({ ...base, debutSec: retenu, finSec: r3(retenu + duree) });
    const decale = Math.abs(retenu - d.debutSec) > EPS;
    decisions.set(d.id, { id: d.id, decision: decale ? "decale" : "garde", debutSec: retenu, finSec: decale ? r3(retenu + duree) : d.finSec, ...(decale ? { raison: premiere ?? undefined } : {}) });
  }
  const liste = demandes.map((d) => decisions.get(d.id)!);
  const compte = {
    effetsGardes: liste.filter((x) => x.decision === "garde").length,
    effetsDecales: liste.filter((x) => x.decision === "decale").length,
    effetsSautes: liste.filter((x) => x.decision === "saute").length,
  };
  return { decisions: liste, rapport: rapportDe(places, options.niveau, options.dureeSec, compte) };
};

/**
 * Oracle des tests et du contrôle qualité : vérifie qu'un ensemble d'effets retenus respecte les règles (plafond hors
 * verrouillés seuls, un fort à la fois, respiration). Renvoie la liste des manquements en clair (vide : conforme).
 */
export function verifierIntensite(places: EffetPlace[], niveau: NiveauIntensite): string[] {
  const plafond = PLAFOND_PAR_NIVEAU[niveau];
  const fautes: string[] = [];
  for (const t of [...new Set(places.map((p) => p.debutSec))]) {
    const charge = chargeA(places, t);
    const chargeLibre = chargeA(places.filter((p) => !p.verrouille), t);
    if (charge > plafond + EPS && chargeLibre > 0) fautes.push(`fenêtre finissant à ${t.toFixed(2)} s : charge ${charge} > ${plafond}`);
  }
  const forts = places.filter((p) => estFort(p.type)).sort((a, b) => a.debutSec - b.debutSec);
  for (let i = 0; i < forts.length; i++)
    for (let j = i + 1; j < forts.length; j++) {
      const a = forts[i];
      const b = forts[j];
      if (a.verrouille && b.verrouille) continue;
      if (b.debutSec < a.finSec - EPS) fautes.push(`${a.id} et ${b.id} : deux effets forts en même temps`);
      else if (b.debutSec < a.finSec + REGLES_INTENSITE.respirationApresFortSec - EPS) fautes.push(`${a.id} puis ${b.id} : respiration trop courte`);
    }
  return fautes;
}

/** Les effets retenus d'un résultat (pour l'oracle et le second passage des bruitages). */
export function effetsRetenus(demandes: DemandeEffet[], resultat: ResultatOrchestration, relancesSec: number[] = []): EffetPlace[] {
  const parId = new Map(resultat.decisions.map((d) => [d.id, d]));
  return demandes.flatMap((d) => {
    const x = parId.get(d.id);
    if (!x || x.decision === "saute") return [];
    return [{ id: d.id, type: d.type, debutSec: x.debutSec, finSec: x.finSec, poids: POIDS_EFFETS[d.type], verrouille: prioriteEffective(d, relancesSec) === "verrouille" }];
  });
}
