/** C9-40c : planche des émojis Fluent (outil local). Rien n'est allumé : EMOJIS_ACTIFS reste false. */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { FORMATS_EMOJIS, PlancheEmojis } from "../../outils/planche-emojis/PlancheEmojis";
import { EMOJIS_ACTIFS, EMOJIS_FLUENT, emojiPermis } from "../../src/briques/motion/petits-objets/emojis";

const RACINE = join(__dirname, "..", "..");
const DOSSIER_EMOJIS = join(RACINE, "src", "briques", "motion", "petits-objets", "emojis");
const lire = (p: string) => readFileSync(join(RACINE, p), "utf8");
const FONDS = ["ivoire", "noir"] as const;
/** Chemin réel : les vrais fichiers SVG du dépôt. */
const SVGS: Record<string, string> = Object.fromEntries(EMOJIS_FLUENT.map((e) => [e.id, readFileSync(join(DOSSIER_EMOJIS, e.fichier), "utf8")]));
const rendre = (fond: (typeof FONDS)[number], format: (typeof FORMATS_EMOJIS)[number], svgs: Readonly<Record<string, string>> = SVGS) =>
  renderToStaticMarkup(createElement(PlancheEmojis, { fond, format, svgs }));
function fichiers(dossier: string): string[] {
  return readdirSync(join(RACINE, dossier)).flatMap((n) => {
    const rel = `${dossier}/${n}`;
    if (n === "node_modules" || n.startsWith(".")) return [];
    return statSync(join(RACINE, rel)).isDirectory() ? fichiers(rel) : /\.(ts|tsx|mts)$/.test(n) ? [rel] : [];
  });
}

describe("C9-40c planche des émojis", () => {
  it("formats 9x16 et 4x5", () => {
    expect([...FORMATS_EMOJIS]).toEqual(["9x16", "4x5"]);
  });
  for (const fond of FONDS) {
    for (const format of FORMATS_EMOJIS) {
      it(`${fond} ${format} : une case par émoji, dans l'ordre, avec son nom`, () => {
        const h = rendre(fond, format);
        expect(EMOJIS_FLUENT.length).toBe(29);
        const ids = [...h.matchAll(/data-emoji="([^"]+)"/g)].map((m) => m[1]);
        expect(ids).toEqual(EMOJIS_FLUENT.map((e) => e.id));
        expect(h).not.toContain("data-manque");
        expect(h).toContain("Manrope");
        for (const e of EMOJIS_FLUENT) expect(h, e.id).toContain(`>${e.nom}<`);
      });
      it(`${fond} ${format} : aucune image extérieure`, () => {
        const h = rendre(fond, format);
        expect(h).not.toMatch(/http|<image|<script/);
        for (const m of h.matchAll(/<img[^>]*>/g)) expect(m[0]).toMatch(/src="data:image\/svg\+xml;base64,/);
      });
      it(`${fond} ${format} : une entrée absente donne une case data-manque, les 28 autres restent`, () => {
        const { alarm_clock: _a, ...reste } = SVGS;
        const h = rendre(fond, format, reste);
        expect(h.match(/data-manque="alarm_clock"/g)?.length).toBe(1);
        expect(h.match(/data-manque=/g)?.length).toBe(1);
        expect(h.match(/data-emoji=/g)?.length).toBe(29);
        expect(h).toContain("data:image/svg+xml;base64,");
      });
      it(`${fond} ${format} : même entrée, même balisage`, () => {
        expect(rendre(fond, format)).toBe(rendre(fond, format));
      });
    }
  }
  it("aucune couleur écrite en dur dans le composant", () => {
    expect(lire("outils/planche-emojis/PlancheEmojis.tsx")).not.toMatch(/#[0-9a-fA-F]{3,8}\b|rgba?\(/);
  });
  it("gardes statiques : entrée temporaire supprimée, outil importé par rien, pas de services", () => {
    const s = lire("outils/planche-emojis/planche.mts");
    expect(s).toMatch(/finally\s*\{[^}]*rmSync/);
    expect(s).toContain(".planche-emojis-tmp");
    for (const f of [...fichiers("src"), ...fichiers("studio-rendu")]) expect(lire(f), f).not.toMatch(/outils\/planche-emojis|PlancheEmojis/);
    for (const f of ["outils/planche-emojis/PlancheEmojis.tsx", "outils/planche-emojis/planche.mts"]) {
      expect(lire(f), f).not.toMatch(/@\/services|src\/services|Racine|mention-ia/);
    }
  });
  it("la planche n'allume rien", () => {
    expect(EMOJIS_ACTIFS).toBe(false);
    for (const e of EMOJIS_FLUENT) expect(emojiPermis(e.id), e.id).toBe(false);
  });
});
