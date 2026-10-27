/**
 * Chemin complet du style tiré : jugerFiche garde le style tiré/imposé dans la fiche, la fabrication
 * (avecStyleTableau, pagesDuStyle) le rend tel quel ; une vidéo déjà notée garde son style ; styleImpose inconnu : avertissement.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DESSINS } from "@/briques/dessins";
import { styleTableauDe, type StyleTableau } from "@/briques/tableau-scene/trois-styles/styles";
import { jugerFiche, partiesDuDecoupage, type EntreeDecoupage } from "@/moteurs/montage-tableau/decoupage";
import { pagesDuStyle } from "@/moteurs/montage-tableau/densite";
import { avecStyleTableau, type FicheTableau } from "@/moteurs/montage-tableau/fiche";
import { styleDuDecoupage, tirerStyleTableau, type EntreeHistoriqueStyle } from "@/moteurs/montage-tableau/tirage-style";

// biome-ignore lint/suspicious/noExplicitAny: fixture JSON
type Cas = { texteScript: string; motsDouleur: string[] | null; parties: unknown; reponse: Record<string, any> };
const cas: Cas = JSON.parse(readFileSync(join(__dirname, "temoins", "decoupage-v-365dd2ae67ee.json"), "utf8"));

function entree(extra: Partial<EntreeDecoupage> = {}): EntreeDecoupage {
  const b = cas.reponse;
  const preuveIds = new Set<string>();
  for (const s of b.scenes) for (const e of s.elements) if (e.type === "preuve") preuveIds.add(e.preuveId);
  const parties = partiesDuDecoupage(cas.parties);
  return {
    texteScript: cas.texteScript, structure: b.structure, serie: b.serie, douleur: b.douleur, gesteMinute: b.gesteMinute,
    preuves: [...preuveIds].map((id) => ({ id, resume: "x" })),
    dessins: DESSINS.map((d) => ({ id: d.id, motsCles: d.motsCles })),
    videoId: b.videoId, versionId: b.versionId, habillage: b.habillage, stylo: b.stylo, ratio: b.ratio,
    controle: { aujourdhui: "2026-10-18", sourcesChiffres: [], preuves: [], matieres: [...preuveIds].map((id) => ({ id, type: "demonstration", statut: "validee" })), ...(cas.motsDouleur ? { motsDouleur: cas.motsDouleur } : {}) },
    ...(parties ? { parties } : {}),
    ...extra,
  } as EntreeDecoupage;
}
const reponse = () => structuredClone(cas.reponse) as Record<string, unknown>;
const sansStyle = () => { const r = reponse(); delete r.styleTableau; return r; };

afterEach(() => vi.restoreAllMocks());

describe("jugerFiche garde le style tiré", () => {
  it("tirage: {} → fiche.styleTableau === tirerStyleTableau(videoId)", () => {
    const e = entree({ tirage: {} });
    const j = jugerFiche(sansStyle(), e);
    expect(j.ok ? "ok" : j.refus).toBe("ok");
    if (j.ok) expect(j.fiche.styleTableau).toBe(tirerStyleTableau(e.videoId));
  });

  it("styleImpose valide → gardé dans la fiche", () => {
    const j = jugerFiche(sansStyle(), entree({ styleImpose: "ardoise" }));
    if (!j.ok) throw new Error(j.refus.join("|"));
    expect(j.fiche.styleTableau).toBe("ardoise");
  });

  it("ni tirage ni style imposé : comportement d'avant (pas de style dans la fiche)", () => {
    const j = jugerFiche(sansStyle(), entree());
    if (!j.ok) throw new Error(j.refus.join("|"));
    expect(j.fiche.styleTableau).toBeUndefined();
  });

  it("jusqu'à la fabrication (avecStyleTableau, pagesDuStyle) : le style rendu est le style tiré, jamais celui de la série", () => {
    const base = entree();
    // un historique qui impose un style différent de celui de la série
    const serieStyle = styleTableauDe({ serie: base.serie });
    const autre = (["tableau-blanc", "ardoise", "paperboard"] as StyleTableau[]).find((s) => s !== serieStyle)!;
    const historique: EntreeHistoriqueStyle[] = [{ videoId: base.videoId, style: autre }];
    const e = entree({ tirage: { historique } });
    const j = jugerFiche(sansStyle(), e);
    if (!j.ok) throw new Error(j.refus.join("|"));
    expect(j.fiche.styleTableau).toBe(autre);
    const fabriquee = avecStyleTableau(j.fiche);
    expect(styleTableauDe(fabriquee)).toBe(autre);
    expect((pagesDuStyle(fabriquee) as FicheTableau).styleTableau).toBe(autre);
  });
});

describe("vidéo existante", () => {
  it("historique contient videoId : le style noté pour elle est rendu", () => {
    const h: EntreeHistoriqueStyle[] = [{ videoId: "v-a", style: "ardoise" }, { videoId: "v-b", style: "paperboard" }, { videoId: "v-c", style: "tableau-blanc" }];
    expect(tirerStyleTableau("v-a", h)).toBe("ardoise");
    expect(tirerStyleTableau("v-b", h)).toBe("paperboard");
  });

  it("nouveau découpage garde son style, même si les 2 dernières vidéos ont changé", () => {
    const id = "v-existante";
    const h1: EntreeHistoriqueStyle[] = [{ videoId: id, style: "ardoise" }];
    const h2: EntreeHistoriqueStyle[] = [...h1, { videoId: "x", style: "ardoise" }, { videoId: "y", style: "paperboard" }];
    expect(tirerStyleTableau(id, h2)).toBe("ardoise");
  });

  it("styleImpose = style de l'ancienne fiche : la vidéo d'avant garde le style de sa série", () => {
    const ancienne = { serie: { code: "formation" } };
    const impose = styleTableauDe(ancienne);
    expect(styleDuDecoupage({ videoId: "v-z", serie: ancienne.serie, styleImpose: impose, tirage: {} })).toBe(impose);
  });
});

describe("styleImpose invalide", () => {
  it("avertit (court) et bascule sur le tirage", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const s = styleDuDecoupage({ videoId: "v-q", serie: { code: "formation" }, styleImpose: "tableau_blanc", tirage: {} });
    expect(s).toBe(tirerStyleTableau("v-q"));
    expect(warn).toHaveBeenCalledTimes(1);
    expect(String(warn.mock.calls[0]![0])).not.toContain("v-q");
  });

  it("styleImpose absent ou valide : aucun avertissement", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    styleDuDecoupage({ videoId: "v-q", serie: {}, tirage: {} });
    styleDuDecoupage({ videoId: "v-q", serie: {}, styleImpose: "ardoise" });
    expect(warn).not.toHaveBeenCalled();
  });
});
