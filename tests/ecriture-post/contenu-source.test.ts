/**
 * L3-01 · contrat ContenuSource : un carrousel ou une vidéo importée devient le « texte validé » du rôle de publication.
 * Aucun appel réel, données fictives.
 */
import { describe, expect, it } from "vitest";
import { CarrouselSpec } from "@/domaine/visuels/schema";
import { ContenuSource, texteDesPages, verifierFaits } from "@/domaine/ecriture-post/contenu-source";
import { contenuDepuisCarrousel, contenuDepuisVideoImportee } from "@/domaine/ecriture-post/adaptateurs";
import { donneesPublicationDepuisSource, evaluerPublication, simulerPublication, entreePublication } from "@/generateur/roles/publication";

const carrousel = CarrouselSpec.parse({
  version: "carrousel/1",
  alt: "Cinq gestes pour relancer un devis",
  pages: [
    { type: "T01", titre: "Relancer un devis sans insister", sousTitre: "Trois étapes simples" },
    { type: "T27", titre: "Avant d'écrire", lignes: [{ texte: "Relisez le devis envoyé" }, { texte: "Notez la date d'envoi" }, { texte: "Choisissez le canal" }, { texte: "Préparez une phrase" }] },
    { type: "T10", message: "Un message court vaut mieux qu'un long" },
    { type: "T22", titre: "Idée reçue", mythe: "Relancer dérange le client", realite: "Une relance polie rassure souvent" },
    { type: "T28", titre: "Le parcours", noeuds: [{ texte: "Devis envoyé" }, { texte: "Relance par SMS" }, { texte: "Réponse du client" }] },
    { type: "T29", relance: "À vous de relancer", rappels: [{ texte: "Un SMS le lendemain" }, { texte: "Une seule phrase" }] },
  ],
});

describe("L3-01 · carrousel → ContenuSource", () => {
  it("un carrousel de 6 pages donne un contenu source et des DonneesPublication valides", () => {
    expect(carrousel.pages).toHaveLength(6);
    const r = contenuDepuisCarrousel({ titre: "Relancer un devis", spec: carrousel, reseaux: ["linkedin"], faits: ["Un SMS le lendemain"] });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(ContenuSource.safeParse(r.contenu).success).toBe(true);
    expect(r.contenu.origine).toBe("carrousel");
    expect(r.contenu.texteValide).toContain("Relancer un devis sans insister");
    expect(r.contenu.texteValide).toContain("Une seule phrase");
    expect(r.contenu.texteValide).not.toContain("T29");
    const d = donneesPublicationDepuisSource(r.contenu, { reseau: "linkedin", mention: "", credits: [], regles: [] });
    expect(d.texteValide).toBe(r.contenu.texteValide);
    expect(d.titre).toBe("Relancer un devis");
    const sortie = simulerPublication(entreePublication(d));
    expect(evaluerPublication(sortie, d, { critiques: true })).toEqual([]);
  });

  it("un fait absent des pages est refusé, et le refus nomme le fait", () => {
    const r = contenuDepuisCarrousel({ titre: "Relancer un devis", spec: carrousel, reseaux: ["linkedin"], faits: ["Un SMS le lendemain", "Taux de réponse de 80 %"] });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.refus).toEqual(["Taux de réponse de 80 %"]);
  });

  it("verifierFaits ignore la casse, les accents et les espaces", () => {
    expect(verifierFaits("Une relance polie  rassure", ["UNE RELANCE POLIE rassure"])).toEqual([]);
    expect(verifierFaits("Une relance", ["Une relance polie"])).toEqual(["Une relance polie"]);
  });

  it("un fait chiffré n'est pas accepté comme morceau d'un autre nombre (80 vs 180, 3 vs 13)", () => {
    expect(verifierFaits("Plus de 180 artisans formés", ["80 artisans"])).toEqual(["80 artisans"]);
    expect(verifierFaits("Un parcours en 13 étapes", ["3 étapes"])).toEqual(["3 étapes"]);
    expect(verifierFaits("Plus de 180 artisans formés", ["180 artisans"])).toEqual([]);
    expect(verifierFaits("Plus de 80 artisans, formés.", ["80 artisans"])).toEqual([]);
  });

  it("un fait n'est pas accepté comme morceau d'un nombre à milliers ou à virgule (200 vs 1 200, 80 vs 80,5)", () => {
    expect(verifierFaits("Plus de 1 200 clients", ["200 clients"])).toEqual(["200 clients"]);
    expect(verifierFaits("Plus de 1\u00a0200 clients", ["200 clients"])).toEqual(["200 clients"]);
    expect(verifierFaits("Plus de 1\u202f200 clients", ["200 clients"])).toEqual(["200 clients"]);
    expect(verifierFaits("Plus de 1 200 clients", ["1 200 clients"])).toEqual([]);
    expect(verifierFaits("Plus de 1200 clients", ["1 200 clients"])).toEqual([]);
    expect(verifierFaits("Taux de 80,5 % sur l'année", ["80"])).toEqual(["80"]);
    expect(verifierFaits("Taux de 80,5 % sur l'année", ["5 %"])).toEqual(["5 %"]);
    expect(verifierFaits("Taux de 80 % sur l'année", ["80 %"])).toEqual([]);
  });

  it("la ponctuation finale d'un fait est ignorée (« Pas de 12 jours. »)", () => {
    expect(verifierFaits("Pas de 12 jours", ["Pas de 12 jours."])).toEqual([]);
    expect(verifierFaits("Pas de 12 jours, jamais", ["Pas de 12 jours !"])).toEqual([]);
  });

  it("texteDesPages ne garde que les textes lus (ni type, ni icône)", () => {
    const t = texteDesPages(carrousel);
    expect(t.split("\n")).toContain("Relancer dérange le client");
    expect(t).not.toMatch(/\bT\d\d/);
  });
});

describe("L3-01 · adaptateur « video-importee »", () => {
  it("transforme une vidéo importée et sa phrase de description en ContenuSource", () => {
    const c = contenuDepuisVideoImportee({ titre: "Visite de l'atelier", description: "Une visite de l'atelier en cinq minutes.", dureeSec: 300 });
    expect(c.origine).toBe("video-importee");
    expect(c.texteValide).toBe("Une visite de l'atelier en cinq minutes.");
    expect(c.dureeSec).toBe(300);
    expect(ContenuSource.safeParse(c).success).toBe(true);
    const d = donneesPublicationDepuisSource(c, { reseau: "linkedin", mention: "", credits: [], regles: [] });
    expect(d.dureeSec).toBe(300);
    expect(d.texteValide).toBe(c.texteValide);
  });

  it("une durée de 0 est refusée par le schéma au lieu d'être retirée", () => {
    expect(() => contenuDepuisVideoImportee({ titre: "Visite", description: "Une visite.", dureeSec: 0 })).toThrow();
  });

  it("une description vide est refusée", () => {
    expect(() => contenuDepuisVideoImportee({ titre: "Visite", description: "   ", dureeSec: 10 })).toThrow();
  });
});
