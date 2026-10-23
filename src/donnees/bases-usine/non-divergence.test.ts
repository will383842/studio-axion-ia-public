/**
 * NON-DIVERGENCE : `BANQUE_APPELS` (`src/briques/fins/banque.ts`, recopiée à la main) doit être IDENTIQUE à la base 7
 * synchronisée depuis l'Usine (une seule source), au `lien` près : la banque n'en garde que la page (ADR 0002). Si ce test échoue : soit la base 7 a changé (resynchroniser puis
 * mettre `banque.ts` à jour dans une PR à part), soit `banque.ts` a été modifié à la main (le rétablir d'après la base 7).
 *
 * La base 7 comparée doit être GARANTIE CONFORME à la source (ADR 0001, garde interne) : sinon un JSON modifié à la main
 * suffirait à rendre ce test vert. Le premier test échoue donc dès que la copie ne correspond plus à `source.json`.
 */
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { BANQUE_APPELS } from "@/briques/fins/banque";
import { ecartsInternes } from "./empreintes";
import { ligneDeBanque } from "./rendu-banque";
import { ETATS_BASE, sourceDesBases, tousLesAppels } from "./index";

function ecarts(): string[] {
  const base = new Map(tousLesAppels({ etats: ETATS_BASE }).map((a) => [a.code, ligneDeBanque(a) as unknown as Record<string, unknown>]));
  const banque = new Map(BANQUE_APPELS.map((a) => [a.code, a as unknown as Record<string, unknown>]));
  const liste: string[] = [];
  for (const code of base.keys()) if (!banque.has(code)) liste.push(`${code} : dans la base 7, absent de banque.ts`);
  for (const code of banque.keys()) if (!base.has(code)) liste.push(`${code} : dans banque.ts, absent de la base 7`);
  for (const [code, b] of base) {
    const l = banque.get(code);
    if (!l) continue;
    for (const champ of new Set([...Object.keys(b), ...Object.keys(l)])) {
      if (JSON.stringify(b[champ]) !== JSON.stringify(l[champ])) liste.push(`${code} · ${champ} : base 7 ${JSON.stringify(b[champ])} ≠ banque.ts ${JSON.stringify(l[champ])}`);
    }
  }
  const ordreBase = [...base.keys()].filter((c) => banque.has(c));
  const ordreBanque = [...banque.keys()].filter((c) => base.has(c));
  if (JSON.stringify(ordreBase) !== JSON.stringify(ordreBanque)) liste.push("ordre des lignes différent entre la base 7 et banque.ts");
  return liste;
}

describe("non-divergence banque.ts ⇄ base 7", () => {
  it("la copie de la base 7 est conforme à source.json (sinon la comparaison ne prouve rien)", () => {
    const dossier = join(__dirname, "donnees");
    const copie: Record<string, string> = {};
    for (const f of readdirSync(dossier).filter((n) => n.endsWith(".json") && n !== "source.json").sort()) copie[f] = readFileSync(join(dossier, f), "utf8");
    expect(ecartsInternes(sourceDesBases(), copie)).toEqual([]);
  });

  it("BANQUE_APPELS est identique à la base 7 synchronisée", () => {
    const liste = ecarts();
    expect(
      liste,
      `${liste.length} écart(s) entre banque.ts et la base 7 (commit ${sourceDesBases().commit ?? "?"}) :\n- ${liste.join("\n- ")}`,
    ).toEqual([]);
  });
});
