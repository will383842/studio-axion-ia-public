/** C3-UT-3.10b-a : affichage seul de l'archive des extraits. Rendu serveur (jsdom absent) : le clic n'est pas rejoué. */
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { EcranSourcesExtraits, type ProprietesEcranSourcesExtraits } from "@/components/bibliotheque/EcranSourcesExtraits";
import type { FicheSourceExtraits, PlageExtrait } from "@/domaine/archive-extraits";

const plage = (id: string, etat: PlageExtrait["etat"], raison?: string): PlageExtrait => ({
  id, debutSec: 0, finSec: 12, texte: `Texte ${id}`, motsCles: [], avecVisage: false, texteIncruste: false, etat, raisonExclusion: raison,
});
const fiche = (plages: PlageExtrait[]): FicheSourceExtraits => ({
  videoId: "v1", versionId: "ver1", sortieId: "s1", ratio: "9:16", licence: {} as FicheSourceExtraits["licence"],
  famille: [], plages, rangee: false, sourcePreferee: false,
});
const rendre = (p: Partial<ProprietesEcranSourcesExtraits>): string =>
  renderToStaticMarkup(createElement(EcranSourcesExtraits, { fiches: [], titres: { v1: "Ma vidéo" }, inscriptionActive: true, politique: "publiees", ...p }));
const trois = fiche([plage("a", "utilisable"), plage("b", "a_verifier"), plage("c", "exclue", "Visage visible")]);

describe("EcranSourcesExtraits", () => {
  it("inscription éteinte : bandeau et liste vide", () => {
    const h = rendre({ inscriptionActive: false, fiches: [trois] });
    expect(h).toContain("Archive des extraits éteinte");
    expect(h).not.toContain("Ma vidéo");
  });
  it("0 fiche allumée : pas d'erreur", () => {
    expect(() => rendre({})).not.toThrow();
  });
  it("3 plages : 3 lignes, pastilles et raison en clair", () => {
    const h = rendre({ fiches: [trois], ouvertesAuDepart: ["v1"] });
    expect(h.match(/data-plage=/g)).toHaveLength(3);
    for (const m of ["Utilisable", "À vérifier", "Exclue", "Visage visible", "Ma vidéo"]) expect(h).toContain(m);
  });
  it("aucun <video avant le clic, même avec une adresse", () => {
    const h = rendre({ fiches: [trois], ouvertesAuDepart: ["v1"], adresseApercu: () => "https://x/y.mp4" });
    expect(h).not.toContain("<video");
    expect(h).toContain("Voir l&#x27;aperçu");
  });
  it("« Cocher » seulement en politique cochées", () => {
    const surCocher = () => {};
    expect(rendre({ fiches: [trois], surCocher })).not.toContain("Cocher");
    expect(rendre({ fiches: [trois], surCocher, politique: "cochees" })).toContain("Cocher");
  });
  it("« Valider » absent sur une exclue, présent sur à vérifier", () => {
    const surValider = () => {};
    const h = rendre({ fiches: [fiche([plage("c", "exclue", "r")])], ouvertesAuDepart: ["v1"], surValider });
    expect(h).not.toContain("Valider");
    expect(rendre({ fiches: [fiche([plage("b", "a_verifier")])], ouvertesAuDepart: ["v1"], surValider })).toContain("Valider");
  });
  it("sans rappel, aucun bouton d'action", () => {
    const h = rendre({ fiches: [trois], ouvertesAuDepart: ["v1"] });
    for (const m of ["Valider", "Écarter", "Rétablir", "Ranger", "Cocher"]) expect(h).not.toContain(m);
  });
});
