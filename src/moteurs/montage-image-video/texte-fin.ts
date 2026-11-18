/**
 * IMAGE → VIDÉO · Texte dit d'une fin. PUR et SANS import de valeur.
 *
 * Isolé de `fins.ts` parce que les écrans (composants client : `vue.ts`) et `secours.ts` en ont besoin : `fins.ts` tire
 * `./emprunts` → `socle-will` → `contexte-axion` → `services/auth` (server-only) et ferait échouer le `next build`.
 * Ici, seulement `import type` : aucun cycle de valeurs avec `fins.ts`.
 */
import type { FinIV } from "./fins";

/** 17/11 (D4) : phrase montrée sur l'écran du script, même texte que `FIN_AUCUNE_CHOISIE` du Tableau (le test les compare). */
export const FIN_AUCUNE_IV = "Fin : aucune (votre choix). Aucune phrase n'est ajoutée à la voix ni à l'écran.";

/** Texte dit d'une fin du plan : la question de commentaire, puis les phrases de la banque. */
export function texteDeFinIV(f: Pick<FinIV, "question" | "appels">): string {
  return [f.question?.dit ?? "", ...f.appels.map((a) => a.dit)]
    .map((t) => t.trim())
    .filter(Boolean)
    .join(" ");
}
