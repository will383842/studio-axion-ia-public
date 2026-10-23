import { describe, expect, it } from "vitest";
import { messageDebordement } from "../../studio-rendu/compositions/visuels/commun/debordement";

const boite = (largeur: number, hauteur: number, contenuL = largeur, contenuH = hauteur) => ({
  clientWidth: largeur,
  clientHeight: hauteur,
  scrollWidth: contenuL,
  scrollHeight: contenuH,
});

describe("débordement du texte d'une carte : détection pure", () => {
  it("rien à signaler quand le contenu tient", () => {
    expect(messageDebordement(boite(300, 250), "Trier le courrier")).toBeNull();
    expect(messageDebordement(boite(300, 250, 300, 251), "Trier le courrier")).toBeNull(); // arrondi d'un pixel
  });
  it("signale un contenu plus haut que la carte, avec le titre de la carte", () => {
    const m = messageDebordement(boite(300, 250, 300, 700), "Trier le courrier");
    expect(m).toMatch(/Trier le courrier/);
    expect(m).toMatch(/700/);
    expect(m).toMatch(/250/);
  });
  it("signale un contenu plus large que la carte", () => {
    expect(messageDebordement(boite(300, 250, 420, 250), "Une carte")).toMatch(/largeur/);
  });
  it("nomme la zone mesurée (la carte par défaut)", () => {
    expect(messageDebordement(boite(300, 250, 300, 700), "Étapes", "la zone")).toMatch(/^Le texte de la zone « Étapes »/);
    expect(messageDebordement(boite(300, 250, 300, 700), "Étapes")).toMatch(/^Le texte de la carte « Étapes »/);
  });
});
