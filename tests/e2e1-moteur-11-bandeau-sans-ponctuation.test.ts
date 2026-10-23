/**
 * E2E-1 n° 11 (MINEUR, 03/10) — le bandeau d'accent (majuscules) ne garde pas la ponctuation finale : « TOUT DE
 * SUITE » et non « TOUT DE SUITE : » (deux-points collé ou séparé, point, virgule, point-virgule).
 */
import { describe, expect, it } from "vitest";
import type { SegmentSousTitres } from "@/domaine/types";
import { donneesCalque } from "@/briques/sous-titres";
import { sceneAuTemps } from "@/briques/sous-titres/scene";

const COULEURS = { texte: "#F3EDE4", accent: "#E07040", contour: "#16120F" };
const mot = (m: string, d: number, f: number) => ({ mot: m, debutSec: d, finSec: f });
const seg = (mots: ReturnType<typeof mot>[], style: SegmentSousTitres["style"]): SegmentSousTitres =>
  ({ id: "s", debutSec: mots[0].debutSec, finSec: mots.at(-1)!.finSec, mots, style, importance: 1, souligne: null, position: "haut", inclinaison: 0 }) as SegmentSousTitres;
const textes = (s: SegmentSousTitres) => sceneAuTemps(donneesCalque({ segments: [s], base: "karaoke", couleurs: COULEURS, reseaux: ["tiktok"] }), 0.5)!.mots.map((m) => m.texte);

describe("E2E-1 n° 11 · bandeau sans ponctuation finale", () => {
  it("deux-points séparé (typographie française) : le signe seul disparaît", () => {
    expect(textes(seg([mot("tout", 0, 0.2), mot("de", 0.2, 0.3), mot("suite", 0.3, 0.6), mot(":", 0.6, 0.7)], "bandeau"))).toEqual(["tout", "de", "suite"]);
  });

  it("deux-points collé (espace insécable) ou point : retirés", () => {
    expect(textes(seg([mot("tout", 0, 0.2), mot("de", 0.2, 0.3), mot("suite :", 0.3, 0.7)], "bandeau")).at(-1)).toBe("suite");
    expect(textes(seg([mot("tout", 0, 0.2), mot("supprimé.", 0.2, 0.7)], "impact")).at(-1)).toBe("supprimé");
  });

  it("sous-titres normaux : la ponctuation reste", () => {
    expect(textes(seg([mot("tout", 0, 0.2), mot("de", 0.2, 0.3), mot("suite", 0.3, 0.6), mot(":", 0.6, 0.7)], "base")).at(-1)).toBe(":");
  });
});
