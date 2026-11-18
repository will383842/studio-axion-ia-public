import { describe, expect, it } from "vitest";
import {
  ENTREES,
  INTENSITES,
  VITESSES,
  appliquerFiche,
  decrireFiche,
  empreinteFiche,
  schemaFicheAnimation,
} from "../../../src/briques/animation-element";

describe("animation-element : listes fermées", () => {
  it("expose exactement les choix de la liste proposée", () => {
    expect([...ENTREES]).toEqual(["fondu", "glisse", "zoom", "pop", "ecrit"]);
    expect([...VITESSES]).toEqual(["lent", "normal", "rapide"]);
    expect([...INTENSITES]).toEqual(["douce", "normale", "forte"]);
  });
  it("le schéma accepte une fiche vide, refuse une clé inconnue", () => {
    expect(schemaFicheAnimation.safeParse({}).success).toBe(true);
    expect(schemaFicheAnimation.safeParse({ rebond: true }).success).toBe(false);
    expect(schemaFicheAnimation.safeParse({ moment: { surMot: -1 } }).success).toBe(false);
    expect(schemaFicheAnimation.safeParse({ moment: { surMot: 2 } }).success).toBe(true);
  });
});

describe("animation-element : appliquerFiche", () => {
  it("fusionne champ par champ", () => {
    const r = appliquerFiche({ entree: "glisse" }, { vitesse: "rapide" });
    expect(r).toEqual({ ok: true, fiche: { entree: "glisse", vitesse: "rapide" } });
  });
  it("refuse une valeur hors liste, en français, sans exception", () => {
    const r = appliquerFiche({ entree: "glisse" }, { vitesse: "turbo" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.raison).toMatch(/vitesse/);
    expect(() => appliquerFiche(undefined, 42)).not.toThrow();
    expect(appliquerFiche(undefined, null).ok).toBe(false);
  });
  it("refuse une place hors de la liste injectée, ou sans liste", () => {
    const zones = ["haut", "bas"];
    expect(appliquerFiche({}, { place: "haut" }, { zones })).toEqual({ ok: true, fiche: { place: "haut" } });
    const r = appliquerFiche({}, { place: "milieu" }, { zones });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.raison).toMatch(/place/);
    expect(appliquerFiche({}, { place: "haut" }).ok).toBe(false);
  });
  it("fusionne le moment et ignore les champs non fournis", () => {
    expect(appliquerFiche({ entree: "zoom" }, { moment: { surMot: 4 }, vitesse: undefined })).toEqual({
      ok: true,
      fiche: { entree: "zoom", moment: { surMot: 4 } },
    });
  });
  it("ne modifie pas la fiche courante", () => {
    const courante = { entree: "pop" } as const;
    appliquerFiche(courante, { intensite: "forte" });
    expect(courante).toEqual({ entree: "pop" });
  });
});

describe("animation-element : decrireFiche", () => {
  it("donne une ligne lisible, sans montant", () => {
    expect(decrireFiche({ entree: "glisse", vitesse: "rapide" })).toBe("entrée glisse, vitesse rapide");
    expect(decrireFiche({ intensite: "forte", moment: { surMot: 3 } })).toBe("intensité forte, sur le mot 3");
    expect(decrireFiche({})).toBe("aucun réglage");
    expect(decrireFiche(undefined)).not.toMatch(/€/);
  });
});

describe("animation-element : empreinteFiche", () => {
  it("fiche vide et absence de fiche ont la même empreinte", () => {
    expect(empreinteFiche({})).toBe(empreinteFiche(undefined));
    expect(empreinteFiche({ entree: undefined })).toBe(empreinteFiche(undefined));
  });
  it("l'ordre des clés est sans effet, un changement change l'empreinte", () => {
    const a = empreinteFiche({ entree: "fondu", vitesse: "lent", moment: { surMot: 1 } });
    const b = empreinteFiche({ moment: { surMot: 1 }, vitesse: "lent", entree: "fondu" });
    expect(a).toBe(b);
    expect(empreinteFiche({ entree: "fondu", vitesse: "normal" })).not.toBe(a);
  });
});
