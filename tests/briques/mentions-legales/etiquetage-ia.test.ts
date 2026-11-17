import { describe, expect, it } from "vitest";
import {
  GENERATEURS_MENTION_IA,
  LONGUEUR_MAX_MENTION_IA,
  TEXTE_MENTION_IA_PAR_DEFAUT,
  cleInterrupteurMentionIA,
  cleTexteMentionIA,
  mentionIAAAfficher,
} from "../../../src/briques/mentions-legales/etiquetage-ia";
import { readFileSync } from "node:fs";

const depuis = (m: Record<string, unknown>) => async (id: string, defaut: unknown) => (id in m ? m[id] : defaut);

describe("mention étiquetage IA (C10-14)", () => {
  it("éteint par défaut pour tous les générateurs : rien d'affiché", async () => {
    for (const g of GENERATEURS_MENTION_IA) expect(await mentionIAAAfficher(g, depuis({}))).toBeNull();
  });
  it("seul `true` strict allume", async () => {
    for (const v of ["true", 1, "oui", null, {}]) {
      expect(await mentionIAAAfficher("facecam", depuis({ [cleInterrupteurMentionIA("facecam")]: v }))).toBeNull();
    }
    expect(await mentionIAAAfficher("facecam", depuis({ [cleInterrupteurMentionIA("facecam")]: true }))).toBe(TEXTE_MENTION_IA_PAR_DEFAUT);
  });
  it("l'interrupteur est par générateur", async () => {
    const l = depuis({ [cleInterrupteurMentionIA("facecam")]: true });
    expect(await mentionIAAAfficher("cas-concret", l)).toBeNull();
  });
  it("texte modifiable ; texte vide ou trop long = défaut", async () => {
    const k = cleInterrupteurMentionIA("avocat");
    const t = cleTexteMentionIA("avocat");
    expect(await mentionIAAAfficher("avocat", depuis({ [k]: true, [t]: "  Contenu généré par IA " }))).toBe("Contenu généré par IA");
    expect(await mentionIAAAfficher("avocat", depuis({ [k]: true, [t]: "  " }))).toBe(TEXTE_MENTION_IA_PAR_DEFAUT);
    expect(await mentionIAAAfficher("avocat", depuis({ [k]: true, [t]: "x".repeat(LONGUEUR_MAX_MENTION_IA + 1) }))).toBe(TEXTE_MENTION_IA_PAR_DEFAUT);
  });
  it("lecture en échec = éteint", async () => {
    expect(await mentionIAAAfficher("facecam", async () => { throw new Error("x"); })).toBeNull();
  });
  it("aucun code n'écrit le réglage", () => {
    const src = readFileSync("src/briques/mentions-legales/etiquetage-ia.ts", "utf8");
    expect(src).not.toMatch(/ecrireParametre|\.enregistrer\(/);
  });
});
