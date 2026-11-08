/**
 * PLAN DE SCÈNES D'UNE VIDÉO ENTIÈRE (lot R2) — pour les générateurs qui rendent leur vidéo d'un seul tenant (Facecam,
 * Facecam animée) : mots calés sur la voix (secondes) → phrases (segments) → `adapterPlan`. Le résultat est un MÉMO
 * (clé = entrée) que l'appelant garde dans son état : une reprise ne rappelle pas l'IA tant que le texte, le minutage et
 * le format sont les mêmes.
 */
import { fnv1a64, jsonCanonique } from "../plan-scenes/empreinte";
import type { AppelClaude } from "../plan-scenes/generateur";
import type { FormatPlan, MotMinute, PlanValide } from "../plan-scenes/schema";
import type { Remarque } from "../plan-scenes/validateur";
import { adapterPlan, type SegmentCale } from "./adaptateur";
import type { IdGenerateurPlan } from "./reglage";

export interface MotEnSecondes {
  texte: string;
  debutSec: number;
  finSec: number;
}

export interface MemoPlanVideo {
  entree: string;
  plan: PlanValide | null;
  remarques: Remarque[];
}

/** Phrases : coupées à la ponctuation forte, ou toutes les 12 mots au plus. */
export function segmenterEnPhrases(mots: MotMinute[]): SegmentCale[] {
  const segments: SegmentCale[] = [];
  let debut = 0;
  mots.forEach((m, i) => {
    if (/[.!?…]$/.test(m.texte) || i - debut >= 11 || i === mots.length - 1) {
      const groupe = mots.slice(debut, i + 1);
      segments.push({ texte: groupe.map((x) => x.texte).join(" "), debutMs: groupe[0]!.debutMs, finMs: m.finMs, mots: groupe });
      debut = i + 1;
    }
  });
  return segments;
}

export const enMillisecondes = (mots: MotEnSecondes[]): MotMinute[] =>
  mots
    .filter((m) => m.texte.trim() && Number.isFinite(m.debutSec) && Number.isFinite(m.finSec))
    .map((m) => ({ texte: m.texte.trim(), debutMs: Math.round(m.debutSec * 1000), finMs: Math.max(Math.round(m.finSec * 1000), Math.round(m.debutSec * 1000) + 40) }));

export async function planPourVideo(o: { generateur: IdGenerateurPlan; mots: MotEnSecondes[]; dureeSec: number; facecam: boolean; format: FormatPlan; appeler?: AppelClaude; memo?: MemoPlanVideo }): Promise<MemoPlanVideo> {
  const mots = enMillisecondes(o.mots);
  const dureeMs = Math.round(o.dureeSec * 1000);
  const entree = fnv1a64(jsonCanonique({ g: o.generateur, mots, dureeMs, facecam: o.facecam, format: o.format, ia: !!o.appeler }));
  if (o.memo && o.memo.entree === entree) return o.memo;
  if (!mots.length) return { entree, plan: null, remarques: [] };
  const segments = segmenterEnPhrases(mots);
  const r = await adapterPlan({ generateur: o.generateur, script: mots.map((m) => m.texte).join(" "), segments, format: o.format, facecam: o.facecam, dureeMs }, { appeler: o.appeler });
  return { entree, plan: r.plan, remarques: r.remarques };
}
