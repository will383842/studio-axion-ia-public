/** RC-45 : réponse à copier (garde TikTok) et « Ouvrir sur le réseau » sûr. Cartes et liens fictifs, rien n'est envoyé. */
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { EcranATraiter } from "@/components/a-traiter/EcranATraiter";
import type { CarteATraiter } from "@/services/a-traiter-types";

const PHRASE_TIKTOK = "TikTok : réponse trop longue ou avec un @, écrivez-la vous-même.";
const carte = (reseau: CarteATraiter["reseau"], sur: Partial<CarteATraiter> = {}): CarteATraiter => ({
  idEvenement: `evt-fictif-${reseau}`,
  reseau,
  post: "post_fictif_1",
  lienPost: null,
  mot: "GUIDE",
  motif: "mot_manuel",
  extrait: "Extrait fictif",
  creeLe: "2026-11-11T10:00:00.000Z",
  statut: "a_traiter",
  kit: "Merci pour votre intérêt !",
  ...sur,
});
const services = { fait: vi.fn(), ignorer: vi.fn(), stop: vi.fn() };
const rendre = (c: CarteATraiter) => renderToStaticMarkup(createElement(EcranATraiter, { vue: { etat: "normal" as const, cartes: [c], compteur: 1 }, services, compte: "" } as never));
const boutonCopier = (h: string) => h.match(/<button[^>]*>Copier la réponse<\/button>/)?.[0] ?? "";

describe("LinkedIn", () => {
  const h = rendre(carte("linkedin", { lienPost: "https://www.linkedin.com/feed/update/exemple" }));
  it("montre la réponse, Copier la réponse actif et Ouvrir sur le réseau vers le bon domaine", () => {
    expect(h).toContain("Réponse proposée");
    expect(boutonCopier(h)).not.toBe("");
    expect(boutonCopier(h)).not.toContain("disabled");
    expect(h).toMatch(/<a [^>]*href="https:\/\/www\.linkedin\.com\/feed\/update\/exemple"[^>]*>Ouvrir sur le réseau<\/a>/);
    expect(h).toContain('rel="noopener noreferrer"');
    expect(h).not.toContain("Ouvrir le post");
  });
  it("geste complet en trois clics : copier, ouvrir, Fait ; les boutons passent à la ligne", () => {
    expect(h.match(/<(button|a) [^>]*>(Copier la réponse|Ouvrir sur le réseau|Fait)<\//g)).toHaveLength(3);
    for (const l of ["Copier la réponse", "Ouvrir sur le réseau", ">Fait<"]) expect(h).toContain(l);
    expect(h).toContain("flex flex-wrap");
  });
  it("lien d'un autre domaine ou non sûr : pas de bouton Ouvrir sur le réseau", () => {
    for (const lien of ["https://exemple.fr/x", "http://www.linkedin.com/x", "https://linkedin.com.exemple.fr/x", null]) {
      const r = rendre(carte("linkedin", { lienPost: lien }));
      expect(r).not.toContain("Ouvrir sur le réseau");
      expect(r).not.toContain("Ouvrir le post");
    }
  });
});

describe("TikTok", () => {
  const lien = "https://www.tiktok.com/@exemple/video/1";
  it("réponse courte sans @ : copie active, Ouvrir sur le réseau, pas de phrase d'écart", () => {
    const h = rendre(carte("tiktok", { lienPost: lien }));
    expect(boutonCopier(h)).not.toContain("disabled");
    expect(h).toContain("Ouvrir sur le réseau");
    expect(h).not.toContain(PHRASE_TIKTOK);
  });
  it("plus de 150 caractères : copie désactivée et phrase affichée", () => {
    const h = rendre(carte("tiktok", { lienPost: lien, kit: "a".repeat(151) }));
    expect(boutonCopier(h)).toContain("disabled");
    expect(h).toContain(PHRASE_TIKTOK);
  });
  it("un @ : copie désactivée et phrase affichée", () => {
    const h = rendre(carte("tiktok", { lienPost: lien, kit: "Merci @exemple !" }));
    expect(boutonCopier(h)).toContain("disabled");
    expect(h).toContain(PHRASE_TIKTOK);
  });
  it("lien refusé : pas de bouton Ouvrir sur le réseau", () => {
    expect(rendre(carte("tiktok", { lienPost: "https://exemple.fr/x" }))).not.toContain("Ouvrir sur le réseau");
  });
});

describe("autres réseaux et carte opposée", () => {
  it("Instagram, Facebook, YouTube : « Ouvrir le post » inchangé, aucune phrase TikTok", () => {
    for (const r of ["instagram", "facebook", "youtube"] as const) {
      const h = rendre(carte(r, { lienPost: "https://exemple.fr/p" }));
      expect(h).toContain("Ouvrir le post");
      expect(h).not.toContain("Ouvrir sur le réseau");
      expect(h).not.toContain(PHRASE_TIKTOK);
    }
  });
  it("libellés conservés", () => {
    const h = rendre(carte("linkedin"));
    for (const l of ["Copier la réponse", "Fait", "Ignorer", "STOP", "Réponse proposée"]) expect(h).toContain(l);
  });
  it("carte opposée : seulement Classer la carte, ni copie ni ouverture", () => {
    const h = rendre(carte("tiktok", { opposee: true, lienPost: "https://www.tiktok.com/@exemple/video/1" }));
    expect(h).toContain("Classer la carte");
    for (const l of ["Copier la réponse", "Ouvrir sur le réseau", "Ouvrir le post", ">Fait<", "STOP"]) expect(h).not.toContain(l);
  });
});
