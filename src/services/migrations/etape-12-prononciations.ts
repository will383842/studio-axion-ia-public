/**
 * MIGRATION — étape 12 (lot A1, `docs/BRANCHEMENTS-EXECUTION.md`) :
 *  1. prononciations de départ (Axion-IA, IA, PV, RGPD, TVA, PME, TPE, CRM, API, SEO, Excel, Telegram, ChatGPT, Claude,
 *     HeyGen), `source: 'depart'`, à valider à l'écoute (sans `ecouteeLe`). Un mot déjà présent — actif OU archivé, sous
 *     n'importe quelle variante — n'est JAMAIS réécrit ni rajouté (un mot archivé par Will reste archivé) ;
 *  2. réglage `voix.choixWill` = « je garde » (Will, 02/10, à l'écoute de sa voix HeyGen : « elle me convient »), posé
 *     s'il manque, jamais écrasé.
 * Idempotente, AUCUNE suppression ; renvoie un résumé (ou null si rien n'a changé), rangé dans `rapport.lots["prononciations"]`.
 */
import type { Depots } from "@/domaine/depots";
import { cleMot, PRONONCIATIONS_DEPART } from "@/domaine/prononciations";

export const CHOIX_VOIX_WILL = { decision: "je garde", fournisseur: "heygen", voix: "DJI_04_20261001_231540", date: "2026-10-02" } as const;

export async function etape12Prononciations(d: Depots, maintenant: string): Promise<Record<string, unknown> | null> {
  const existantes = await d.prononciations.lister();
  const connues = new Set(existantes.flatMap((p) => [cleMot(p.mot), p.ecriture ? cleMot(p.ecriture) : ""]).filter(Boolean));
  const ajoutees: string[] = [];
  for (const depart of PRONONCIATIONS_DEPART) {
    const cle = cleMot(depart.mot);
    if (connues.has(cle)) continue;
    await d.prononciations.enregistrer({ id: `pr-depart-${cle}`, mot: depart.mot, prononciation: depart.prononciation, source: "depart", creeLe: maintenant, modifieLe: maintenant });
    connues.add(cle);
    ajoutees.push(depart.mot);
  }
  let choixPose = false;
  if (!(await d.parametres.obtenir("voix.choixWill"))) {
    await d.parametres.enregistrer({ id: "voix.choixWill", valeur: CHOIX_VOIX_WILL, creeLe: maintenant, modifieLe: maintenant });
    choixPose = true;
  }
  if (!ajoutees.length && !choixPose) return null;
  if (ajoutees.length) {
    await d.evenements.enregistrer({
      id: `ev-migration-prononciations-${maintenant}`,
      type: "migration",
      message: `Prononciations de départ ajoutées, à valider à l'écoute (${ajoutees.length})`,
      date: maintenant,
      creeLe: maintenant,
      modifieLe: maintenant,
    });
  }
  return { prononciationsAjoutees: ajoutees, choixVoixWillPose: choixPose };
}
