/** L8-08 : règles de republication par réseau. Fonctions pures, aucun réseau. */
import { describe, expect, it } from "vitest";
import {
  REGLES_REPUBLICATION,
  RESEAUX_REPUBLICATION,
  evaluerRepublication,
  regleRepublication,
} from "@/domaine/republication/regles";

const JOUR = 24 * 3600 * 1000;
const ORIGINE = Date.parse("2026-01-01T00:00:00Z");

describe("règles de republication", () => {
  it("couvre tous les réseaux, et toute valeur chiffrée porte l'étiquette hypothese ou une source", () => {
    expect(RESEAUX_REPUBLICATION.length).toBe(6);
    for (const id of RESEAUX_REPUBLICATION) {
      const r = REGLES_REPUBLICATION[id];
      expect(r.delaiMinJours.statut === "hypothese" || (r.delaiMinJours.statut === "source" && r.delaiMinJours.source.length > 0)).toBe(true);
      expect(r.delaiMinJours.valeur).toBeGreaterThan(0);
      expect(r.seuilPerformance.statut).toBe("hypothese");
    }
  });

  it("une republication est toujours un contenu neuf dérivé, pour tous les réseaux", () => {
    for (const id of RESEAUX_REPUBLICATION) expect(regleRepublication(id).contenuNeufDerive).toBe(true);
  });

  it("TikTok refuse le contenu identique et le filigrane", () => {
    const r = regleRepublication("tiktok");
    expect(r.refuseIdentique).toBe(true);
    expect(r.refuseFiligrane).toBe(true);
  });

  it("refuse un contenu identique sur TikTok", () => {
    const v = evaluerRepublication({ reseau: "tiktok", datePublication: ORIGINE, maintenant: ORIGINE + 400 * JOUR, identique: true, filigrane: false });
    expect(v.autorise).toBe(false);
    expect(v.motifs).toContain("contenu-identique");
  });

  it("refuse un contenu avec filigrane sur TikTok", () => {
    const v = evaluerRepublication({ reseau: "tiktok", datePublication: ORIGINE, maintenant: ORIGINE + 400 * JOUR, identique: false, filigrane: true });
    expect(v.autorise).toBe(false);
    expect(v.motifs).toContain("filigrane");
  });

  it("refuse un délai trop court, autorise un contenu neuf après le délai", () => {
    const d = regleRepublication("instagram").delaiMinJours.valeur;
    const tot = evaluerRepublication({ reseau: "instagram", datePublication: ORIGINE, maintenant: ORIGINE + (d - 1) * JOUR, identique: false, filigrane: false });
    expect(tot.autorise).toBe(false);
    expect(tot.motifs).toContain("delai-trop-court");
    const ok = evaluerRepublication({ reseau: "instagram", datePublication: ORIGINE, maintenant: ORIGINE + d * JOUR, identique: false, filigrane: false });
    expect(ok.autorise).toBe(true);
    expect(ok.motifs).toEqual([]);
  });

  it("est pure : mêmes entrées, même verdict, entrées non modifiées", () => {
    const e = { reseau: "linkedin" as const, datePublication: ORIGINE, maintenant: ORIGINE, identique: true, filigrane: false };
    const copie = { ...e };
    expect(evaluerRepublication(e)).toEqual(evaluerRepublication(e));
    expect(e).toEqual(copie);
  });
});
