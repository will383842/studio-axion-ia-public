import { describe, expect, it } from "vitest";
import { motsClesParDefaut, refusTextesCas } from "@/moteurs/montage-cas-concret/gardes-textes-cas";

const refus = (texte: string, options: Record<string, { scene?: boolean }> = {}) => refusTextesCas([{ nom: "Champ", texte }], options);

describe("gardes des textes d'un cas (une règle, un test)", () => {
  it("un texte propre n'a aucun refus", () => {
    expect(refus("Vos devis sont relancés au bon moment.")).toEqual([]);
  });
  it("un champ vide est ignoré", () => {
    expect(refus("   ")).toEqual([]);
  });
  it("nombre (chiffres)", () => {
    expect(refus("Vos devis en 3 jours")[0]).toMatch(/^Champ : contient un nombre/);
  });
  it("nom propre", () => {
    expect(refus("Le devis part chez Dupont")[0]).toMatch(/^Champ : contient un nom propre/);
  });
  it("tournure d'usage réel", () => {
    expect(refus("On utilise un outil pour relancer.").join("|")).toMatch(/usage réel/);
  });
  it("première personne : je, j', nous, notre, nos (apostrophes droite et courbe)", () => {
    for (const t of ["Je relance", "J'envoie le devis", "J’envoie le devis", "Nous relançons", "Notre outil relance", "Nos devis partent"]) expect(refus(t).join("|"), t).toMatch(/première personne/);
    expect(refus("Les nombreux devis partent")).toEqual([]);
  });
  it("tutoiement", () => {
    expect(refus("Relance tes devis").join("|")).toMatch(/tutoie/);
  });
  it("Grenoble, aucun gain garanti, j'aide, faites-le vous-même", () => {
    expect(refus("Un dirigeant de Grenoble").join("|")).toMatch(/Grenoble/);
    expect(refus("Aucun gain garanti ici").join("|")).toMatch(/aucun gain garanti/i);
    expect(refus("J'aide les dirigeants").join("|")).toMatch(/j'aide/);
    expect(refus("Faites-le vous-même demain").join("|")).toMatch(/faites-le vous-même/);
  });
  it("mot interdit du format", () => {
    expect(refus("Une machine relance vos devis").join("|")).toMatch(/interdit/);
  });
  it("conformité sans phrase validée", () => {
    expect(refus("Vos données sont conformes au RGPD").join("|")).toMatch(/conformité/);
  });
  it("scène qui raconte un client (seulement pour un champ scène)", () => {
    const t = "Chez un client, le devis part et personne ne demande la réponse.";
    expect(refus(t)).toEqual([]);
    expect(refus(t, { Champ: { scene: true } }).join("|")).toMatch(/raconte un client/);
  });
});

describe("mots clés par défaut du sujet", () => {
  it("2 ou 3 mots les plus longs, dans l'ordre du sujet, hors mots vides", () => {
    const m = motsClesParDefaut("Vos devis restent sans réponse.");
    expect(m.length).toBeGreaterThanOrEqual(2);
    expect(m.length).toBeLessThanOrEqual(3);
    expect(m).toContain("devis");
    expect(m).not.toContain("sans");
    expect(motsClesParDefaut("Les clients oublient leurs rendez-vous d'atelier")).toEqual(["clients", "oublient", "rendez-vous"]);
  });
  it("chaque mot clé figure dans le sujet", () => {
    const sujet = "Chaque relance oubliée coûte une réponse";
    for (const m of motsClesParDefaut(sujet)) expect(sujet.toLowerCase()).toContain(m.toLowerCase());
  });
});
