/**
 * Lecture commune d'une version avant les contrôles (lot G3). PUR.
 * Une seule horloge (B.7.1), une seule liste de segments assemblés (ouverture + corps + fin), le rôle de chaque segment
 * lu dans la recette (`roles`), jamais écrit en dur.
 */
import type { BlocScript, Matiere, Preuve, SegmentScript } from "@/domaine/types";
import { horodaterSegments, MARGE_AVANT_MESURE } from "./horloge";
import { NIVEAUX } from "./niveaux";
import type { EntreeControle, NiveauControle, ViolationControle } from "./types";

export type PartieSegment = "ouverture" | "corps" | "fin";

export interface SegmentLu {
  index: number;
  partie: PartieSegment;
  blocRecette: string;
  role: "accroche" | "promesse" | "corps" | "appel" | "boucle";
  segment: SegmentScript;
  texte: string;
  dit: string;
  debutSec: number;
  finSec: number;
  marqueurs: string[];
  /** G6 : durée réelle / durée estimée du segment (les durées de phrases de C26 suivent le débit réel). */
  facteurReel?: number;
}

export interface Analyse {
  segments: SegmentLu[];
  dureeSec: number;
  /** Segments dits (hors boucle et appel compris). */
  accroche: SegmentLu[];
  promesse: SegmentLu[];
  corps: SegmentLu[];
  appel: SegmentLu[];
  boucle: SegmentLu[];
  preuves: Map<string, Preuve>;
  matieres: Map<string, Matiere>;
  /** Facteur appliqué aux seuils de position tant que le débit n'est pas mesuré (B.4.2, n° 76). */
  marge: number;
}

export function analyser(e: EntreeControle): Analyse {
  const parties: [PartieSegment, BlocScript[]][] = [
    ["ouverture", e.ouverture],
    ["corps", e.corps],
    ["fin", e.fin],
  ];
  const blocs = parties.flatMap(([, b]) => b);
  const horloge = horodaterSegments(blocs, e.debit);
  const segments: SegmentLu[] = [];
  let i = 0;
  for (const [partie, bs] of parties) {
    for (const b of bs) {
      for (const s of b.segments) {
        // G6 : l'horodatage réel du segment (vidéo fabriquée) remplace l'estimation quand il existe.
        const estime = horloge[i];
        const reel = e.horodatageReel?.[i];
        const h = reel ?? estime;
        const facteurReel = reel && estime.dureeSec > 0 ? (reel.finSec - reel.debutSec) / estime.dureeSec : undefined;
        const r = e.recette.roles;
        const role: SegmentLu["role"] =
          b.blocRecette === r.accroche ? "accroche" : b.blocRecette === r.promesse ? "promesse" : b.blocRecette === r.appel ? "appel" : b.blocRecette === r.boucle ? "boucle" : partie === "ouverture" ? "promesse" : partie === "fin" ? "appel" : "corps";
        segments.push({
          index: i,
          partie,
          blocRecette: b.blocRecette,
          role,
          segment: s,
          texte: s.texte,
          dit: (s as SegmentScript & { texteDit?: string }).texteDit ?? s.texte,
          debutSec: h.debutSec,
          finSec: h.finSec,
          marqueurs: s.marqueurs ?? [],
          ...(facteurReel !== undefined ? { facteurReel } : {}),
        });
        i++;
      }
    }
  }
  const de = (role: SegmentLu["role"]) => segments.filter((s) => s.role === role);
  return {
    segments,
    dureeSec: segments.length ? Math.max(...segments.map((s) => s.finSec)) : 0,
    accroche: de("accroche"),
    promesse: de("promesse"),
    corps: de("corps"),
    appel: de("appel"),
    boucle: de("boucle"),
    preuves: new Map(e.preuves.map((p) => [p.id, p])),
    matieres: new Map(e.matieres.map((m) => [m.id, m])),
    marge: e.debitMesure || e.horodatageReel ? 1 : MARGE_AVANT_MESURE,
  };
}

/** Crée une violation au niveau fixé par la table B.7.2 pour l'auteur ; null si le contrôle ne s'applique pas à lui. */
export function violation(
  code: string,
  e: Pick<EntreeControle, "auteur">,
  message: string,
  extra: { segmentIndex?: number; regleId?: string; niveau?: NiveauControle } = {},
): ViolationControle | null {
  const niveau = extra.niveau ?? NIVEAUX[code]?.[e.auteur];
  if (!niveau) return null;
  return { controle: code, message, bloquant: niveau === "bloquant", niveau, segmentIndex: extra.segmentIndex, regleId: extra.regleId };
}

/** Collecteur : ignore les violations nulles (contrôle sans objet pour cet auteur). */
export class Collecte {
  readonly violations: ViolationControle[] = [];
  constructor(private readonly e: Pick<EntreeControle, "auteur">) {}
  ajouter(code: string, message: string, extra: { segmentIndex?: number; regleId?: string; niveau?: NiveauControle } = {}): void {
    const v = violation(code, this.e, message, extra);
    if (v) this.violations.push(v);
  }
}

/** Segments parlés (hors segments vides). */
export function segmentsParles(a: Analyse): SegmentLu[] {
  return a.segments.filter((s) => s.texte.trim());
}
