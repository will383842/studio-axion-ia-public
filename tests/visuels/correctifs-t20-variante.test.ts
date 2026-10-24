// Correctifs mineurs de la variante « étapes à mini-maquettes » de T20 : ses maquettes sont des dessins (L7, même dessin jamais deux fois)
// et la clé `variante` est un identifiant, pas un texte lu.
import { describe, expect, it } from "vitest";
import { dessinsDuCarrousel } from "../../src/briques/visuels/choix-illustration";
import { maquettesDesEtapes } from "../../src/briques/visuels/maquettes-etapes";
import { controlesStructure } from "../../src/domaine/controles-visuel/rythme";
import { mots } from "../../src/domaine/controles-visuel/texte";
import { textesDe } from "../../src/domaine/controles-visuel/textes-de";
import { CarrouselSpec } from "../../src/domaine/visuels/schema";
import type { CarrouselSpecType } from "../../src/domaine/visuels/types";

const couverture = { type: "T01", titre: "Mieux organiser sa semaine", sousTitre: "Des gestes simples pour souffler" };
const grille = { type: "T02", titre: "Les bases", cartes: [{ titre: "Planifier", corps: "Poser ses priorités." }, { titre: "Déléguer", corps: "Confier ce qui peut l’être." }] };
const liste = { type: "T06", titre: "Votre routine", points: [{ texte: "Un café avant de commencer" }, { texte: "Une liste courte et claire" }, { texte: "Une pause à midi" }] };
const message = { type: "T10", message: "Le calme se prépare" };
const fin = { type: "T21" };
const ETAPES = [{ titre: "Noter", corps: "Écrire ce qui compte." }, { titre: "Trier", corps: "Garder l’essentiel." }, { titre: "Agir", corps: "Avancer pas à pas." }];
const etapes = (titre: string, variante?: "maquettes") => ({ type: "T20", titre, etapes: ETAPES, ...(variante ? { variante } : {}) });
const lu = (...pages: unknown[]) => CarrouselSpec.parse({ version: "carrousel/1", alt: "Carrousel exemple type sur l’organisation", pages }) as CarrouselSpecType;
const doubles = (s: CarrouselSpecType) => controlesStructure(s).filter((c) => c.code === "DESSIN_DOUBLE");

describe("T20 à mini-maquettes : les maquettes sont des dessins (L7)", () => {
  it("une T20 à maquettes liste ses maquettes ; sans variante, aucun dessin", () => {
    const s = lu(couverture, etapes("Le parcours", "maquettes"), fin);
    expect(dessinsDuCarrousel(s).filter((d) => d.page === 2)).toEqual(maquettesDesEtapes(ETAPES).map((m) => ({ page: 2, dessin: `maquette-${m}` })));
    expect(dessinsDuCarrousel(lu(couverture, etapes("Le parcours"), fin)).filter((d) => d.page === 2)).toEqual([]);
  });
  it("deux T20 à maquettes non voisines qui réutilisent la même maquette : DESSIN_DOUBLE", () => {
    const r = doubles(lu(couverture, etapes("Le parcours", "maquettes"), grille, liste, etapes("Le retour", "maquettes"), message, fin));
    expect(r.length).toBeGreaterThan(0);
    expect(r[0]).toMatchObject({ niveau: "rouge", page: 5 });
  });
  it("une seule T20 à maquettes : aucune alerte", () => {
    expect(doubles(lu(couverture, etapes("Le parcours", "maquettes"), grille, liste, message, fin))).toEqual([]);
  });
  it("deux T20 sans variante : inchangé, aucune alerte", () => {
    expect(doubles(lu(couverture, etapes("Le parcours"), grille, liste, etapes("Le retour"), message, fin))).toEqual([]);
  });
});

describe("T20 à mini-maquettes : `variante` n'est pas un texte lu", () => {
  it("textesDe ne renvoie pas pages.N.variante", () => {
    const chemins = textesDe(lu(couverture, etapes("Le parcours", "maquettes"), fin)).map((t) => t.chemin);
    expect(chemins).not.toContain("pages.1.variante");
  });
  it("le compte de mots d'une page T20 ne dépend pas de la variante", () => {
    const compte = (p: unknown) => textesDe({ pages: [p] }).reduce((n, t) => n + mots(t.texte).length, 0);
    expect(compte(etapes("Le parcours", "maquettes"))).toBe(compte(etapes("Le parcours")));
  });
});
