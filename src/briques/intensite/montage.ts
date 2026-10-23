/**
 * ORCHESTRATION D'UN MONTAGE (lot du 02/10, D1) — la courbe UNIQUE appliquée à une vidéo : brique commune, PURE,
 * paramétrée par ce que le moteur lui passe (plans du découpage, sous-titres du mélange, sons validés, niveau).
 *
 * 1. Chaque effet DEMANDE sa place : la structure du découpage (coupes, recadrages poitrine, second angle,
 *    illustrations — déjà réglée par les règles du format, elle n'est ni décalée ni sautée), puis le zoom lent, les
 *    incrustations (peuvent apparaître plus tard dans leur plan), les accents des sous-titres (Impact, Bandeau, souligné).
 * 2. L'orchestrateur décide (`orchestrerIntensite`) ; les décisions sont appliquées : zoom sauté → plan fixe ;
 *    incrustation décalée → `decalageSec`, sautée → retirée ; accent sauté → groupe rendu à la base. Un choix verrouillé
 *    par Will ne bouge jamais.
 * 3. Les bruitages se placent ENSUITE, sur ce qui reste à l'image, un par un, contre la même courbe.
 * Sortie : plans, sous-titres, bruitages placés et le rapport (courbe pour l'Aperçu, dépassements pour le contrôle).
 */
import type { AngleVisage, BruitageDisponible, NiveauIntensite, RapportIntensite, ReglageBruitages, SegmentSousTitres } from "@/domaine/types";
import type { PlanProduit } from "@/moteurs/types";
import { candidatsBruitages, choisirVariante, declencheurIllustration, dureePosee, GAIN_SOUS_VOIX_DB, refusBruitage, type DeclencheurVu } from "./bruitages";
import { chargeA, effetsRetenus, orchestrerIntensite, prioriteEffective, rapportDe, type EffetPlace } from "./orchestrateur";
import { PLAFOND_PAR_NIVEAU, POIDS_EFFETS, REGLES_INTENSITE, type BruitagePlace, type DecisionEffet, type DemandeEffet } from "./types";

export interface EntreeOrchestrationMontage {
  niveau: NiveauIntensite;
  dureeSec: number;
  plans: PlanProduit[];
  segments: SegmentSousTitres[];
  /** Angle du second plan (« profil » pour l'avocat) : une coupe vers lui est un « second angle ». */
  angleSecond?: AngleVisage;
  /** Instants des relances du script (début de chaque bloc après l'accroche). */
  relancesSec?: number[];
  bruitages?: { reglage: ReglageBruitages; disponibles: BruitageDisponible[]; graine: number };
  /**
   * Remixage (« retirer / ajouter le son » après fabrication) : tout ce qui est à l'image est FIGÉ (verrouillé), seuls
   * les bruitages sont replacés. Absent : orchestration complète.
   */
  fige?: boolean;
}

export interface SortieOrchestrationMontage {
  plans: PlanProduit[];
  segments: SegmentSousTitres[];
  bruitages: BruitagePlace[];
  rapport: RapportIntensite;
  decisions: DecisionEffet[];
}

/** Durée minimale d'une incrustation visible après décalage (s). */
export const INCRUSTATION_VISIBLE_MIN_SEC = 1;
const idPlan = (p: PlanProduit) => `plan-${p.ordre}`;
const aUnChiffre = (s: SegmentSousTitres) => s.mots.some((m) => /\d/.test(m.mot));

/** Demandes de la structure et des effets des plans. */
export function demandesDesPlans(plans: PlanProduit[], angleSecond?: AngleVisage): DemandeEffet[] {
  const d: DemandeEffet[] = [];
  plans.forEach((p, i) => {
    const planId = idPlan(p);
    const base = { debutSec: p.debutSec, finSec: p.finSec, origine: "decoupage", planId };
    // Structure (décidée par le découpage du format) : jamais déplacée ici. Le premier plan n'est pas une coupe.
    if (p.sourceImage === "illustration") d.push({ ...base, id: `${planId}:illustration`, type: "illustration", priorite: "verrouille" });
    else if (i > 0) {
      const type = p.angle && p.angle === angleSecond ? "second-angle" : p.cadrage?.valeur === "poitrine" ? "poitrine" : "coupe";
      d.push({ ...base, id: `${planId}:${type}`, type, priorite: "verrouille" });
    }
    if (p.sourceImage !== "illustration" && p.cadrage?.zoomFin !== undefined && Math.abs(p.cadrage.zoomFin - p.cadrage.zoom) > 1e-6) d.push({ ...base, id: `${planId}:zoom-lent`, type: "zoom-lent", priorite: "normale" });
    if (p.incrustation) {
      const debut = +(p.debutSec + (p.incrustation.decalageSec ?? 0)).toFixed(3);
      // Un montant affiché est le chiffre clé de la vidéo : il passe toujours (décision de Will, 02/10).
      const priorite = p.incrustation.type === "montant" ? "verrouille" : "normale";
      d.push({ ...base, debutSec: debut, id: `${planId}:incrustation`, type: "incrustation", priorite, origine: "incrustations", decalageMaxSec: Math.max(0, +(p.finSec - debut - INCRUSTATION_VISIBLE_MIN_SEC).toFixed(3)), decalageSens: "plus-tard" });
    }
  });
  return d;
}

/** Demandes des accents des sous-titres (Impact, Bandeau, souligné) ; un groupe verrouillé passe toujours. */
export function demandesDesSousTitres(segments: SegmentSousTitres[]): DemandeEffet[] {
  const d: DemandeEffet[] = [];
  for (const s of segments) {
    // Un groupe qui porte un chiffre passe avant les autres accents (jamais retiré au profit d'un simple effet).
    const priorite = s.verrouille ? "verrouille" : aUnChiffre(s) ? "relance" : "normale";
    const base = { debutSec: s.debutSec, finSec: s.finSec, origine: "sous-titres", priorite } as const;
    if (s.style === "impact") d.push({ ...base, id: `st-${s.id}:impact`, type: "impact" });
    else if (s.style === "bandeau") d.push({ ...base, id: `st-${s.id}:bandeau`, type: "bandeau" });
    if (s.souligne !== null && s.souligne !== undefined && s.mots[s.souligne]) d.push({ ...base, debutSec: s.mots[s.souligne].debutSec, id: `st-${s.id}:souligne`, type: "souligne" });
  }
  return d;
}

/** Applique les décisions aux plans (zoom, incrustation). La structure ne change pas. */
export function appliquerAuxPlans(plans: PlanProduit[], decisions: Map<string, DecisionEffet>): PlanProduit[] {
  return plans.map((p) => {
    const id = idPlan(p);
    let q = p;
    const zoom = decisions.get(`${id}:zoom-lent`);
    if (zoom?.decision === "saute") q = { ...q, cadrage: { ...q.cadrage, zoomFin: undefined } };
    const inc = decisions.get(`${id}:incrustation`);
    if (inc && q.incrustation) {
      if (inc.decision === "saute") q = { ...q, incrustation: undefined };
      else {
        const decalage = +(inc.debutSec - p.debutSec).toFixed(3);
        q = { ...q, incrustation: { ...q.incrustation, ...(decalage > 1e-3 ? { decalageSec: decalage } : { decalageSec: undefined }) } };
        if (q.incrustation && q.incrustation.decalageSec === undefined) delete q.incrustation.decalageSec;
      }
    }
    return q;
  });
}

/** Applique les décisions aux groupes : un accent sauté redevient la base (jamais un groupe verrouillé). */
export function appliquerAuxSousTitres(segments: SegmentSousTitres[], decisions: Map<string, DecisionEffet>): SegmentSousTitres[] {
  return segments.map((s) => {
    if (s.verrouille) return s;
    let n = s;
    const accent = decisions.get(`st-${s.id}:impact`) ?? decisions.get(`st-${s.id}:bandeau`);
    if (accent?.decision === "saute") n = { ...n, style: "base", importance: Math.min(2, n.importance ?? 0), position: "auto", inclinaison: 0 };
    if (decisions.get(`st-${s.id}:souligne`)?.decision === "saute") n = { ...n, souligne: null };
    return n;
  });
}

/** Ce qui, à l'image, appelle un son : sur les effets RETENUS seulement. */
export function declencheursVus(plans: PlanProduit[], segments: SegmentSousTitres[]): DeclencheurVu[] {
  const vus: DeclencheurVu[] = [];
  for (const p of plans) {
    if (p.sourceImage === "illustration") vus.push({ declencheur: declencheurIllustration(p.illustration?.requete), instantSec: p.debutSec, planId: idPlan(p) });
    if (p.incrustation?.type === "montant") vus.push({ declencheur: "chiffre", instantSec: +(p.debutSec + (p.incrustation.decalageSec ?? 0)).toFixed(3), planId: idPlan(p) });
    if (p.incrustation?.type === "objet") vus.push({ declencheur: declencheurIllustration(p.texte), instantSec: +(p.debutSec + (p.incrustation.decalageSec ?? 0)).toFixed(3), planId: idPlan(p) });
  }
  for (const s of segments) if (s.style === "impact") vus.push({ declencheur: aUnChiffre(s) ? "chiffre" : "impact", instantSec: s.debutSec });
  return vus;
}

/**
 * L'orchestration complète d'une vidéo, en trois passages contre la MÊME courbe :
 *  1. structure, incrustations, Impact et Bandeau ;
 *  2. les bruitages, sur ce qui reste à l'image (un son lié à ce qu'on voit passe avant un simple souligné) ;
 *  3. les soulignés et le zoom lent, dans la place qui reste (jamais un zoom sur la coupe d'un son).
 */
export function orchestrerMontage(e: EntreeOrchestrationMontage): SortieOrchestrationMontage {
  const toutes = [...demandesDesPlans(e.plans, e.angleSecond), ...demandesDesSousTitres(e.segments)].map((d) => (e.fige ? { ...d, priorite: "verrouille" as const } : d));
  const secondaire = (d: DemandeEffet) => d.type === "souligne" || d.type === "zoom-lent";
  const options = { niveau: e.niveau, dureeSec: e.dureeSec, relancesSec: e.relancesSec };
  const premiers = toutes.filter((d) => !secondaire(d));
  const r1 = orchestrerIntensite(premiers, options);
  let places: EffetPlace[] = effetsRetenus(premiers, r1, e.relancesSec);
  const decisions = [...r1.decisions];
  const bruitages: BruitagePlace[] = [];
  const fixes = (): DemandeEffet[] => places.map((p) => ({ id: p.id, type: p.type, debutSec: p.debutSec, finSec: p.finSec, priorite: "verrouille", origine: "retenu" }));
  const parId1 = new Map(r1.decisions.map((d) => [d.id, d]));
  const plans1 = appliquerAuxPlans(e.plans, parId1);
  const segments1 = appliquerAuxSousTitres(e.segments, parId1);

  // 2. Bruitages. Remixage (tout figé) : les zooms déjà à l'image écartent un son de leur coupe.
  if (e.bruitages && e.bruitages.disponibles.length) {
    const zoomsSec = e.fige ? toutes.filter((d) => d.type === "zoom-lent").map((d) => d.debutSec) : [];
    const entree = { reglage: e.bruitages.reglage, disponibles: e.bruitages.disponibles, vus: declencheursVus(plans1, segments1), dureeSec: e.dureeSec, zoomsSec, graine: e.bruitages.graine, plans: plans1.map((p) => ({ id: idPlan(p), debutSec: p.debutSec, finSec: p.finSec, choix: p.bruitage })) };
    const rangs = new Map<string, number>();
    const dernieres = new Map<string, string>();
    for (const c of candidatsBruitages(entree)) {
      const refus = refusBruitage(c, bruitages, entree);
      if (refus) {
        decisions.push({ id: c.demande.id, decision: "saute", debutSec: c.demande.debutSec, finSec: c.demande.finSec, raison: refus });
        continue;
      }
      // Contre la courbe : tout ce qui est déjà retenu est fixe, le son se plie (ou saute).
      const d = orchestrerIntensite([...fixes(), c.demande], options).decisions.at(-1)!;
      decisions.push(d);
      if (d.decision === "saute") continue;
      const sons = e.bruitages.disponibles.filter((s) => s.declencheur === c.declencheur);
      const voulu = c.elementId ? sons.find((s) => s.elementId === c.elementId) : undefined;
      const son = voulu ?? choisirVariante(sons, rangs.get(c.declencheur) ?? 0, e.bruitages.graine, dernieres.get(c.declencheur));
      if (!son) continue;
      rangs.set(c.declencheur, (rangs.get(c.declencheur) ?? 0) + 1);
      dernieres.set(c.declencheur, son.elementId);
      bruitages.push({ elementId: son.elementId, declencheur: c.declencheur, debutSec: d.debutSec, dureeSec: +dureePosee(c.declencheur, son.dureeSec).toFixed(3), gainDb: GAIN_SOUS_VOIX_DB, ...(c.demande.planId ? { planId: c.demande.planId } : {}) });
      places = [...places, { id: c.demande.id, type: "bruitage", debutSec: d.debutSec, finSec: d.finSec, poids: POIDS_EFFETS.bruitage, verrouille: prioriteEffective(c.demande) === "verrouille" }];
    }
  }

  // 3. Soulignés et zoom lent dans la place qui reste ; un zoom ne commence jamais sur la coupe d'un son.
  const seconds = toutes.filter(secondaire);
  const surUnSon = (d: DemandeEffet) => d.type === "zoom-lent" && d.priorite !== "verrouille" && bruitages.some((b) => Math.abs(b.debutSec - d.debutSec) < 0.3);
  const ecartes = seconds.filter(surUnSon).map((d): DecisionEffet => ({ id: d.id, decision: "saute", debutSec: d.debutSec, finSec: d.finSec, raison: "même coupe qu'un son" }));
  const restants = seconds.filter((d) => !surUnSon(d));
  const r3 = orchestrerIntensite([...fixes(), ...restants], options);
  const decisions3 = r3.decisions.filter((d) => restants.some((x) => x.id === d.id));
  decisions.push(...ecartes, ...decisions3);
  places = [...places, ...effetsRetenus(restants, { decisions: decisions3, rapport: r3.rapport }, e.relancesSec)];

  const parId = new Map([...decisions3, ...ecartes].map((d) => [d.id, d]));
  const plans = appliquerAuxPlans(plans1, parId);
  const segments = appliquerAuxSousTitres(segments1, parId);
  const compte = {
    effetsGardes: decisions.filter((x) => x.decision === "garde").length,
    effetsDecales: decisions.filter((x) => x.decision === "decale").length,
    effetsSautes: decisions.filter((x) => x.decision === "saute").length,
  };
  bruitages.sort((x, y) => x.debutSec - y.debutSec);
  return { plans, segments, bruitages, rapport: rapportDe(places, e.niveau, e.dureeSec, compte), decisions };
}

/**
 * ALLÈGEMENT DE LA STRUCTURE (Sobre surtout) : si les coupes, recadrages et illustrations du découpage dépassent À EUX
 * SEULS le plafond d'une fenêtre, une coupe entre deux plans du double est retirée (les deux plans fusionnent), la plus
 * tardive de la fenêtre d'abord, seulement si la fusion reste propre : même angle, aucune double incrustation, au plus
 * `plafondPlanSec`, et un cadrage différent de chaque voisin (jamais deux plans identiques qui se suivent). Les plans
 * sont renumérotés. Appelé par le découpage du format (avant toute fabrication). PUR.
 */
export function allegerStructure(plans: PlanProduit[], niveau: NiveauIntensite, options: { angleSecond?: AngleVisage; plafondPlanSec: number; coupesProtegees?: number[] }): PlanProduit[] {
  let courant = plans.map((p) => ({ ...p }));
  const plafond = PLAFOND_PAR_NIVEAU[niveau];
  const valeur = (p: PlanProduit | undefined) => (p && p.sourceImage !== "illustration" ? `${p.angle ?? ""}:${p.cadrage?.valeur ?? "large"}` : null);
  for (let garde = 0; garde < plans.length; garde++) {
    const structure = demandesDesPlans(courant, options.angleSecond).filter((d) => d.type !== "zoom-lent" && d.type !== "incrustation");
    const effets = structure.map((d) => ({ debutSec: d.debutSec, poids: POIDS_EFFETS[d.type] }));
    const fin = [...new Set(effets.map((x) => x.debutSec))].sort((a, b) => a - b).find((t) => chargeA(effets, t) > plafond + 1e-6);
    if (fin === undefined) break;
    // Coupes de la fenêtre ]fin − 3 ; fin], de la plus tardive à la plus ancienne.
    const candidats = courant
      .map((p, i) => ({ p, i }))
      .filter(({ p, i }) => i > 0 && p.debutSec > fin - REGLES_INTENSITE.fenetreSec + 1e-6 && p.debutSec <= fin + 1e-6)
      .reverse();
    let fait = false;
    for (const { i } of candidats) {
      const w = courant[i - 1];
      const x = courant[i];
      if (w.sourceImage === "illustration" || x.sourceImage === "illustration" || w.angle !== x.angle) continue;
      if (w.incrustation && x.incrustation) continue;
      if (x.finSec - w.debutSec > options.plafondPlanSec + 1e-6) continue;
      // G6 : une coupe imposée (raccord des versions par réseau) n'est jamais retirée.
      if (options.coupesProtegees?.some((t) => Math.abs(t - x.debutSec) < 0.002)) continue;
      const avant = valeur(courant[i - 2]);
      const apres = valeur(courant[i + 1]);
      const choix = [x, w].find((c) => valeur(c) !== avant && valeur(c) !== apres);
      if (!choix) continue;
      const fusion: PlanProduit = {
        ...w,
        finSec: x.finSec,
        texte: [w.texte, x.texte].filter(Boolean).join(" "),
        motsEnValeur: [...(w.motsEnValeur ?? []), ...(x.motsEnValeur ?? [])],
        cadrage: { ...choix.cadrage, zoomFin: undefined },
        incrustation: w.incrustation ?? x.incrustation,
        ...(w.incrustation ? {} : x.incrustation ? { incrustation: { ...x.incrustation, decalageSec: +(x.debutSec - w.debutSec + (x.incrustation.decalageSec ?? 0)).toFixed(3) } } : {}),
      };
      courant = [...courant.slice(0, i - 1), fusion, ...courant.slice(i + 1)];
      fait = true;
      break;
    }
    if (!fait) break;
  }
  return courant.map((p, i) => ({ ...p, ordre: i + 1 }));
}

/** Clé de `CommandeFabrication.entrees` : choix « retirer / ajouter le son » faits APRÈS fabrication, par ordre de plan. */
export const ENTREE_BRUITAGES_PLANS = "bruitagesPlans";

/**
 * Choix « retirer / ajouter le son » de chaque plan produit. Après fabrication : par ordre de plan (`parOrdre`, le
 * service les range dans `entrees.bruitagesPlans`). À l'Aperçu (avant fabrication) : le choix d'un plan indicatif vaut
 * pour les plans produits de la même phrase (« ajouter » : seulement le premier). PUR.
 */
export function avecChoixBruitages<P extends { ordre: number; segmentId?: string; bruitage?: PlanProduit["bruitage"] }>(
  produits: P[],
  indicatifs: { segmentId?: string; bruitage?: PlanProduit["bruitage"] }[],
  parOrdre?: Record<string, PlanProduit["bruitage"] | null> | undefined,
): P[] {
  const premiers = new Set<string>();
  return produits.map((p) => {
    const { bruitage: _ancien, ...reste } = p;
    void _ancien;
    const apres = parOrdre?.[String(p.ordre)];
    if (apres !== undefined) return (apres ? { ...reste, bruitage: apres } : reste) as P;
    const ind = p.segmentId ? indicatifs.find((x) => x.segmentId === p.segmentId && x.bruitage) : undefined;
    const premier = !!p.segmentId && !premiers.has(p.segmentId);
    if (p.segmentId) premiers.add(p.segmentId);
    if (!ind?.bruitage || (ind.bruitage.mode === "ajoute" && !premier)) return reste as P;
    return { ...reste, bruitage: ind.bruitage } as P;
  });
}
