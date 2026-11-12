import { describe, expect, it } from "vitest";
import { ErreurLienSuivi } from "@/domaine/mesures";
import { RESEAUX_LIEN_PROFIL, codeLienProfil, lienProfil, liensProfilParReseau } from "@/domaine/liens-bio";

describe("liens du profil suivis par réseau (L8-14)", () => {
  it("construit un lien de nature profil par le constructeur unique", () => {
    const l = lienProfil({ compte: "studio", reseau: "linkedin", activite: "clients", page: "/fr/appel" });
    expect(l).toBe("https://axion-ia.com/fr/appel?utm_source=linkedin&utm_medium=profil&utm_campaign=mot-studio-linkedin&utm_content=clients&depuis=profil-linkedin");
  });
  it("un code unique par compte et par réseau", () => {
    const liens = liensProfilParReseau({ compte: "studio", activite: "clients", page: "/fr/guide-ia" });
    expect(liens.map((x) => x.reseau)).toEqual([...RESEAUX_LIEN_PROFIL]);
    expect(new Set(liens.map((x) => x.code)).size).toBe(RESEAUX_LIEN_PROFIL.length);
    expect(new Set(liens.map((x) => x.lien)).size).toBe(RESEAUX_LIEN_PROFIL.length);
    expect(codeLienProfil("autre", "tiktok")).not.toBe(codeLienProfil("studio", "tiktok"));
  });
  it("le code est stable", () => {
    expect(codeLienProfil("Studio", "TikTok")).toBe("mot-studio-tiktok");
  });
  it("refuse un compte ou un réseau invalide, sans corriger", () => {
    expect(() => lienProfil({ compte: "a b", reseau: "linkedin", activite: "clients", page: "/fr/appel" })).toThrow(ErreurLienSuivi);
    expect(() => lienProfil({ compte: "", reseau: "linkedin", activite: "clients", page: "/fr/appel" })).toThrow(ErreurLienSuivi);
    expect(() => lienProfil({ compte: "studio", reseau: "myspace", activite: "clients", page: "/fr/appel" })).toThrow(ErreurLienSuivi);
    expect(() => lienProfil({ compte: "studio", reseau: "linkedin", activite: "clients", page: "/fr/autre" })).toThrow(ErreurLienSuivi);
  });
  it("refuse un code trop long", () => {
    expect(() => lienProfil({ compte: "x".repeat(60), reseau: "linkedin", activite: "clients", page: "/fr/appel" })).toThrow(ErreurLienSuivi);
  });
  it("aucune écriture vers les réseaux : module pur, sans réseau ni fetch", async () => {
    const src = (await import("node:fs")).readFileSync("src/domaine/liens-bio.ts", "utf8");
    expect(src).not.toMatch(/fetch\(|XMLHttpRequest|node:http|axios/);
  });
});
