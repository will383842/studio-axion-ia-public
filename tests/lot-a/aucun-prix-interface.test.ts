/**
 * LOT A (08/11/2026) — décision de Will : aucun budget ni prix dans le studio, jamais affiché.
 *
 * Deux gardes :
 *  1. Les écrans déjà nettoyés par le lot A (« Mon script ») ne disent aucun prix.
 *  2. Cliquet : l'interface (src/app, src/components, src/assistant) mentionne encore le prix dans les fichiers de la liste
 *     `prix-interface-restants.json` (reste à faire, voir docs/blocages-inventaire.md). Un NOUVEAU fichier qui parle de
 *     prix/budget fait rougir ce test ; une fois un fichier nettoyé, il sort de la liste (le test rougit aussi s'il y reste).
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";
import restants from "./prix-interface-restants.json";

const RACINE = join(__dirname, "../..");
const DOSSIERS = ["src/app", "src/components", "src/assistant"];
const MOTIF = /\b(prix|budget|plafond|coût|couts?|tarif|devis)\b|€/i;

function fichiers(dir: string): string[] {
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    if (statSync(p).isDirectory()) return fichiers(p);
    return /\.tsx$/.test(n) && !/\.test\./.test(n) ? [p] : [];
  });
}

/** Le code sans commentaires ni identifiants : seuls les textes affichés comptent. */
function textesAffiches(src: string): string {
  const sansCommentaires = src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
  const chaines = sansCommentaires.match(/"(?:[^"\\\n]|\\.)*"|'(?:[^'\\\n]|\\.)*'|`(?:[^`\\]|\\.)*`|>[^<>{}]+</g) ?? [];
  return chaines.filter((c) => !/^["'`]?(?:@\/|\.\/|\.\.\/)/.test(c)).join("\n");
}

const mentionnent = DOSSIERS.flatMap((d) => fichiers(join(RACINE, d)))
  .filter((f) => MOTIF.test(textesAffiches(readFileSync(f, "utf8"))))
  .map((f) => relative(RACINE, f).split("\\").join("/"))
  .sort();

describe("aucun prix ni budget dans l'interface", () => {
  it("l'écran « Mon script » et son formulaire ne disent aucun prix", () => {
    for (const f of ["src/components/formats/cas-concret/script-fourni/FormulaireScriptFourni.tsx", "src/app/(studio)/cas-concret/script/[casId]/page.tsx"]) {
      expect(mentionnent, f).not.toContain(f);
    }
  });

  it("aucun NOUVEAU fichier de l'interface ne parle de prix ou de budget (cliquet)", () => {
    const connus = new Set<string>(restants);
    expect(mentionnent.filter((f) => !connus.has(f))).toEqual([]);
  });

  it("la liste des restes ne garde aucun fichier déjà nettoyé", () => {
    const actuels = new Set(mentionnent);
    expect((restants as string[]).filter((f) => !actuels.has(f))).toEqual([]);
  });
});
