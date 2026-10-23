/**
 * MIGRATION — étape 13, lot A2 (« Mes images » et illustrations réelles, `docs/BRANCHEMENTS-EXECUTION.md`).
 * Règles (contrat d'exécution) : idempotente, testée, AUCUNE suppression ; renvoie un résumé (ou null si rien n'a
 * changé), rangé dans `rapport.lots["mes-images"]`. Une base neuve (démonstration) n'a rien à migrer.
 *  1. une illustration fabriquée et payée avant le lot (`fabrique: true`) reçoit `origine: fabriquee` ;
 *  2. une image personnelle SANS contrôle de confidentialité repasse « à vérifier » (jamais utilisée sans Will).
 * Les illustrations de démonstration ne sont pas touchées (une banque y est une simple licence, pas une origine) ;
 * celles de Will ne sont jamais marquées « exemple ».
 */
import type { Depots } from "@/domaine/depots";

export async function etape13MesImages(d: Depots, maintenant: string): Promise<Record<string, unknown> | null> {
  const illustrations = await d.elements.lister((e) => e.type === "illustration-image" || e.type === "illustration-video");
  const fabriquees: string[] = [];
  const aVerifier: string[] = [];
  for (const e of illustrations) {
    if (!e.origine && e.fabrique) {
      await d.elements.modifier(e.id, { origine: "fabriquee", modifieLe: maintenant });
      fabriquees.push(e.id);
    }
    if (e.origine === "personnelle" && !e.confidentialite) {
      await d.elements.modifier(e.id, { confidentialite: { statut: "a_verifier", zones: [] }, modifieLe: maintenant });
      aVerifier.push(e.id);
    }
  }
  if (!fabriquees.length && !aVerifier.length) return null;
  return { fabriquees, aVerifier };
}
