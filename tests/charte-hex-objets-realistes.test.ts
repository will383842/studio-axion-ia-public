import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

// V7-07 : objets-realistes.ts. Les hex de la palette de marque remplacent les anciens hex de marque.
// Les couleurs propres aux objets réalistes (bleu, jaune, rouge, vert, violet, métaux, verre) sont une DÉCISION
// DE RENDU EN ATTENTE (D1) : elles ne changent pas ici et sont listées explicitement ; aucun test n'exige leur présence.
const PALETTE = ["#FAF9F5", "#E8E6DC", "#141413", "#B23F16", "#D97757", "#B0AEA5"];
const OBJETS_EN_ATTENTE = [
  "#1D74E0", "#5BB8FF", "#F5C52B", "#FFE27A", "#FFD54A", "#F9B233", "#E8344F", "#FF6A7F", "#FF8A5C",
  "#2DB84A", "#6EE07A", "#8E5BD9",
  "#ECECEC", "#F2F2F2", "#B9BDC4", "#7E838C", "#A9ADB4", "#6B7078", "#2B2D31", "#9AA0A8", "#8C8E91", "#55585D",
  "#9A9CA0", "#B8BABE", "#4A4C50", "#050505", "#06070A",
];
const FICHIER = "studio-rendu/compositions/commune/effets/objets-realistes.ts";

function hexTrouves(texte: string): string[] {
  const sansCommentaires = texte.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
  return (sansCommentaires.match(/#[0-9A-Fa-f]{3,8}\b/g) ?? []).map((h) => h.toUpperCase());
}

describe("V7-07 objets-realistes.ts", () => {
  const trouves = hexTrouves(readFileSync(FICHIER, "utf8"));
  it("n'utilise que la palette de marque et la liste explicite des couleurs d'objets en attente", () => {
    const hors = [...new Set(trouves.filter((h) => !PALETTE.includes(h) && !OBJETS_EN_ATTENTE.includes(h)))];
    expect(hors).toEqual([]);
  });
  it("n'emploie plus de dégradé de fond d'écran ni d'ancien hex de halo, et passe par la pile de polices de la charte", () => {
    const src = readFileSync(FICHIER, "utf8");
    expect(src).not.toMatch(/rgba\(240,\s*140,\s*80|rgba\(198,\s*90,\s*46/);
    expect(src).not.toMatch(/\bInter\b/);
    expect(src).toContain("PILE_CSS");
    expect(src).not.toMatch(/fond\.addColorStop/);
  });
  it("met les pictos de l'écran clair en terracotta, pas en orange (réservé au noir)", () => {
    const src = readFileSync(FICHIER, "utf8");
    expect(src).toMatch(/i === 1 \|\| i === 3 \? ORANGE :/);
    expect(src).not.toMatch(/\? "#D97757"/);
  });
});
