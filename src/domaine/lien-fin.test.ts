import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { BANQUE_APPELS } from "@/briques/fins/banque";
import { lienDeFin } from "./lien-fin";

const rdv = BANQUE_APPELS.filter((a) => a.objectif === "RENDEZ_VOUS" && a.lien !== "");

describe("lien des fins « rendez-vous » (constructeur unique)", () => {
  it("la base 7 porte des fins rendez-vous avec lien", () => {
    expect(rdv.length).toBeGreaterThanOrEqual(6);
  });

  it("une fin par réseau : le lien porte le code de la vidéo, le réseau et l'activité, jamais l'en-tête", () => {
    for (const a of rdv) {
      for (const reseau of a.reseaux) {
        const code = "0042-TB-IG";
        const lien = lienDeFin(a, { reseau, codeVersion: code, activite: "clients" });
        expect(lien, `${a.code} · ${reseau}`).not.toBeNull();
        expect(lien!.complet).toBe(`https://axion-ia.com/fr/appel?utm_source=${reseau}&utm_medium=video&utm_campaign=${code}&utm_content=clients&depuis=video-${reseau}`);
        expect(lien!.complet).not.toContain("entete");
        expect(lien!.court).toBe("axion-ia.com/fr/appel");
      }
    }
  });

  it("l'exemple de la consigne : 0042-TB-IG contient utm_campaign=0042-TB-IG", () => {
    const a = BANQUE_APPELS.find((x) => x.code === "fin-ig-rdv-seul")!;
    expect(lienDeFin(a, { reseau: "instagram", codeVersion: "0042-TB-IG", activite: "clients" })!.complet).toContain("utm_campaign=0042-TB-IG");
  });

  it("une fin sans lien rend null", () => {
    const a = BANQUE_APPELS.find((x) => x.lien === "")!;
    expect(lienDeFin(a, { reseau: a.reseaux[0]!, codeVersion: "0042-TB-IG", activite: "clients" })).toBeNull();
  });

  it("sans code de version, code invalide ou réseau non couvert : refus, aucun lien", () => {
    const a = BANQUE_APPELS.find((x) => x.code === "fin-ig-rdv-seul")!;
    expect(() => lienDeFin(a, { reseau: "instagram", codeVersion: undefined, activite: "clients" })).toThrow();
    expect(() => lienDeFin(a, { reseau: "instagram", codeVersion: "n'importe quoi", activite: "clients" })).toThrow();
    expect(() => lienDeFin(a, { reseau: "facebook", codeVersion: "0042-TB-FB", activite: "clients" })).toThrow(/ne couvre pas/);
  });

  it("un gabarit hors du site ou d'une page non permise est refusé", () => {
    const base = BANQUE_APPELS.find((x) => x.code === "fin-ig-rdv-seul")!;
    expect(() => lienDeFin({ ...base, lien: "https://exemple.com/fr/appel" }, { reseau: "instagram", codeVersion: "0042-TB-IG", activite: "clients" })).toThrow();
    expect(() => lienDeFin({ ...base, lien: "https://axion-ia.com/fr/autre" }, { reseau: "instagram", codeVersion: "0042-TB-IG", activite: "clients" })).toThrow(/non permise/);
  });
});

describe("garde : plus de `depuis=entete` écrit à la main dans le code", () => {
  it("aucun fichier de src (hors copie JSON de la base 7 et tests) ne le contient", () => {
    const racine = join(__dirname, "..");
    const fautifs: string[] = [];
    const parcourir = (d: string) => {
      for (const n of readdirSync(d)) {
        const p = join(d, n);
        if (statSync(p).isDirectory()) parcourir(p);
        else if (/\.(ts|tsx|mts)$/.test(n) && !n.includes(".test.") && readFileSync(p, "utf8").includes("depuis=entete")) fautifs.push(p.slice(racine.length));
      }
    };
    parcourir(racine);
    expect(fautifs).toEqual([]);
  });
});
