/** C9-32a — émojis plats Fluent embarqués, ÉTEINTS. */
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { EMOJIS_ACTIFS, EMOJIS_FLUENT, emojiPermis } from "../../src/briques/motion/petits-objets/emojis";

const RACINE = join(__dirname, "..", "..");
const DOSSIER = join(RACINE, "src", "briques", "motion", "petits-objets", "emojis");
const MOTS_REFUSES = ["face", "person", "hand", "man", "woman"] as const;

describe("C9-32a émojis Fluent", () => {
  it("24 à 40 symboles, chacun avec un .svg propre et léger", () => {
    expect(EMOJIS_FLUENT.length).toBeGreaterThanOrEqual(24);
    expect(EMOJIS_FLUENT.length).toBeLessThanOrEqual(40);
    for (const e of EMOJIS_FLUENT) {
      const p = join(DOSSIER, e.fichier);
      expect(existsSync(p), e.id).toBe(true);
      expect(statSync(p).size, e.id).toBeLessThanOrEqual(20 * 1024);
      const t = readFileSync(p, "utf8");
      expect(t.startsWith("<svg"), e.id).toBe(true);
      expect(t).not.toContain("<script");
      expect(t).not.toContain('href="http');
      expect(t).not.toContain("<image");
    }
    expect(readdirSync(join(DOSSIER, "svg")).sort()).toEqual(EMOJIS_FLUENT.map((e) => e.fichier.replace("svg/", "")).sort());
  });
  it("aucun nom avec visage, personne, main, homme, femme", () => {
    for (const e of EMOJIS_FLUENT) for (const m of MOTS_REFUSES) {
      expect(e.id.toLowerCase().includes(m), `${e.id} / ${m}`).toBe(false);
      expect(e.nom.toLowerCase().includes(m), `${e.nom} / ${m}`).toBe(false);
    }
  });
  it("éteint : emojiPermis faux partout ; allumé : vrai seulement pour la liste", () => {
    expect(EMOJIS_ACTIFS).toBe(false);
    for (const x of [...EMOJIS_FLUENT.map((e) => e.id), "inconnu", ""]) expect(emojiPermis(x)).toBe(false);
    for (const e of EMOJIS_FLUENT) expect(emojiPermis(e.id, true)).toBe(true);
    expect(emojiPermis("inconnu", true)).toBe(false);
  });
  it("la licence MIT de Microsoft est embarquée", () => {
    const l = readFileSync(join(DOSSIER, "LICENCE-Fluent-Emoji.txt"), "utf8");
    expect(l).toContain("MIT License");
    expect(l).toContain("Microsoft Corporation");
  });
  it("docs/droits/emojis.md cite la date et chaque fichier", () => {
    const d = readFileSync(join(RACINE, "docs", "droits", "emojis.md"), "utf8");
    expect(d).toContain("17/11/2026");
    for (const f of readdirSync(join(DOSSIER, "svg"))) expect(d, f).toContain(f);
  });
});
