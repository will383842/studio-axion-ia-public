/**
 * Contrôles du PLAN, avant toute prose (étape 6 ; plan v5 B.7.2 C62, C71, C30 bis, C39). PUR.
 * Les secondes du modèle ne sont qu'une intention : le code les recalcule (C27).
 */
import type { PlanScript } from "@/domaine/types";
import type { ViolationControle } from "./types";

const b = (controle: string, message: string, segmentIndex?: number): ViolationControle => ({ controle, message, bloquant: true, niveau: "bloquant", segmentIndex });

export function controlerPlan(plan: PlanScript, options: { exceptionValidee?: boolean; exceptionProposee?: boolean } = {}): ViolationControle[] {
  const out: ViolationControle[] = [];
  const segs = plan.segments;
  const total = segs.reduce((s, x) => s + Math.max(0, x.secondes), 0) || 1;
  const debuts: number[] = [];
  segs.reduce((t, x) => (debuts.push(t), t + Math.max(0, x.secondes)), 0);
  const indexAppel = segs.findIndex((s) => s.fonction.includes("cta"));

  // C62 : chaque question ouverte est fermée ; la principale après 55 % et avant l'appel ; chaque segment du corps relié.
  const ouvertes = segs.flatMap((s, i) => (s.ouvre ? [{ id: s.ouvre.id, i }] : []));
  for (const o of ouvertes) {
    const k = segs.findIndex((s, j) => j > o.i && s.ferme === o.id);
    if (k < 0) out.push(b("C62", `Question « ${o.id} » ouverte et jamais fermée.`, o.i));
  }
  const principale = ouvertes[0];
  if (principale) {
    const k = segs.findIndex((s, j) => j > principale.i && s.ferme === principale.id);
    if (k >= 0) {
      if (debuts[k] / total < 0.55) out.push(b("C62", `Question principale fermée à ${Math.round((debuts[k] / total) * 100)} % (après 55 % attendu).`, k));
      if (indexAppel >= 0 && k > indexAppel) out.push(b("C62", "Question principale fermée après l'appel.", k));
    }
  }
  const corps = segs.map((s, i) => ({ s, i })).filter(({ s, i }) => i > 0 && !s.fonction.includes("cta") && i !== segs.length - 1);
  for (const { s, i } of corps.slice(1)) if (!s.lien) out.push(b("C62", "Segment relié au précédent par un simple ajout (ni cause, ni opposition, ni conséquence).", i));

  // C71 : promesse tenue.
  const promesses = new Set(segs.filter((s) => s.promesseId && !s.fonction.includes("livraison")).map((s) => s.promesseId!));
  for (const p of promesses) if (!segs.some((s) => s.fonction.includes("livraison") && s.promesseId === p)) out.push(b("C71", `La livraison ne porte pas la promesse « ${p} ».`));

  // C30 bis : une limite proposée par la machine ne passe jamais dans un bloc dit.
  if (options.exceptionProposee && !options.exceptionValidee && plan.exceptionIndex >= 0) out.push(b("C30 bis", "Limite proposée par la machine placée dans le texte : emplacement « [LIMITE À VALIDER] » attendu.", plan.exceptionIndex));

  // C39 : au plus 2 segments « solution » de suite.
  let suite = 0;
  segs.forEach((s, i) => {
    suite = s.fonction.includes("solution") ? suite + 1 : 0;
    if (suite === 3) out.push(b("C39", "3 segments « solution » de suite dans le plan.", i));
  });
  return out;
}
