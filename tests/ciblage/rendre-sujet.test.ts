/** Lot C2 : le sujet envoyé au modèle porte la cible (bornée, anonymisée) et le type d'automatisation. */
import { describe, expect, it } from "vitest";
import { rendreSujet, type DonneesGeneration } from "@/generateur/contexte";

function donnees(sujet: Partial<DonneesGeneration["sujet"]>, nomsSensibles: string[] = []): DonneesGeneration {
  return {
    maintenant: "2026-11-09T08:00:00.000Z",
    sujet: { idee: "Les relances de factures", objectif: "notoriete", niveauConscience: "connait-le-probleme", adresse: "vous", mode: "will", reseaux: ["tiktok"], formatId: "face-camera", ...sujet },
    choix: {} as DonneesGeneration["choix"],
    combinaisons: [],
    matieres: [],
    preuves: [],
    nomsSensibles,
  } as DonneesGeneration;
}

describe("rendreSujet : cible et type d'automatisation", () => {
  it("écrit la cible avec son niveau et l'obligation de la nommer dans les 5 premières secondes", () => {
    const t = rendreSujet(donnees({ ciblage: { niveau: "metier", libelle: "Plombier", origine: "saisie" } }));
    expect(t).toContain("Cible : Plombier (métier), à nommer dans les 5 premières secondes");
  });
  it("dit le niveau secteur et taille", () => {
    expect(rendreSujet(donnees({ ciblage: { niveau: "secteur", libelle: "Bâtiment", origine: "saisie" } }))).toContain("Cible : Bâtiment (secteur), à nommer");
    expect(rendreSujet(donnees({ ciblage: { niveau: "taille", libelle: "TPE", origine: "saisie" } }))).toContain("Cible : TPE (taille), à nommer");
  });
  it("écrit le type d'automatisation par son libellé", () => {
    const t = rendreSujet(donnees({ typeAutomatisation: "devis-factures" }));
    expect(t).toContain("Type d'automatisation : Devis et factures");
  });
  it("borne le libellé à 80 caractères sur une ligne", () => {
    const long = `Plombier ${"x".repeat(150)}\nsecond`;
    const ligne = rendreSujet(donnees({ ciblage: { niveau: "metier", libelle: long, origine: "saisie" } })).split("\n").find((l) => l.startsWith("Cible : "))!;
    const libelle = ligne.slice("Cible : ".length, ligne.indexOf(" (métier)"));
    expect(libelle.length).toBeLessThanOrEqual(80);
    expect(libelle).not.toContain("second");
  });
  it("anonymise le libellé avant la consigne", () => {
    const t = rendreSujet(donnees({ ciblage: { niveau: "metier", libelle: "Cabinet Dupont", origine: "saisie" } }, ["Dupont"]));
    expect(t).not.toContain("Dupont");
    expect(t).toContain("Cible : ");
  });
  it("sans cible ni type : aucune de ces deux lignes, et l'ancienne cible libre reste dite", () => {
    const sans = rendreSujet(donnees({}));
    expect(sans).not.toContain("Cible :");
    expect(sans).not.toContain("Type d'automatisation");
    expect(rendreSujet(donnees({ cible: "Dirigeants de PME" }))).toContain("Cible : Dirigeants de PME");
  });
});
