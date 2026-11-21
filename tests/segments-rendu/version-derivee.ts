// VC-EMPREINTES-a : version DÉRIVÉE des empreintes des compositions (plus de compteur tenu à la main).
// Module pur : aucun import de `studio-rendu/**` (piège tsc/remotion), lu par le test du registre et par
// `outils/images-reference/rendre-et-comparer.mts`.
import { createHash } from "node:crypto";

/** Chemin relatif à `studio-rendu/compositions/` → SHA-256 (64 hex) du contenu du fichier. */
export type Empreintes = Record<string, string>;

function trie(e: Empreintes): Empreintes {
  const res: Empreintes = {};
  for (const k of Object.keys(e).sort()) res[k] = e[k];
  return res;
}

/** Identifiant de contenu « v-<12 hex> » : change dès qu'une empreinte change, qu'une clé arrive ou part ; indépendant de l'ordre d'insertion. */
export function versionDerivee(e: Empreintes): string {
  const texte = Object.keys(e)
    .sort()
    .map((k) => k + "\t" + e[k] + "\n")
    .join("");
  return "v-" + createHash("sha256").update(texte, "utf8").digest("hex").slice(0, 12);
}

/** Texte exact de `tests/segments-rendu/version-compositions.json` : une ligne par fichier, clés triées, fin de ligne finale. */
export function texteCanonique(e: Empreintes): string {
  return JSON.stringify({ empreintes: trie(e) }, null, 2) + "\n";
}
