/**
 * IMAGE → VIDÉO · Texte dit d'une fin. PUR et SANS import de valeur.
 *
 * Isolé de `fins.ts` parce que les écrans (composants client : `vue.ts`) et `secours.ts` en ont besoin : `fins.ts` tire
 * `./emprunts` → `socle-will` → `contexte-axion` → `services/auth` (server-only) et ferait échouer le `next build`.
 * Ici, seulement `import type` : aucun cycle de valeurs avec `fins.ts`.
 */
import type { FinIV } from "./fins";

/** Texte dit d'une fin du plan : la question de commentaire, puis les phrases de la banque. */
export function texteDeFinIV(f: Pick<FinIV, "question" | "appels">): string {
  return [f.question?.dit ?? "", ...f.appels.map((a) => a.dit)]
    .map((t) => t.trim())
    .filter(Boolean)
    .join(" ");
}
