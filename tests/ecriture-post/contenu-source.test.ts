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
    { type: "T27", titre: "Avant d'écrire", lignes: [{ texte: "Relisez le devis envoyé" }, { texte: "Notez la date d'envoi" }] },
    { type: "T10", message: "Un message court vaut mieux qu'un long" },
    { type: "T22", titre: "Idée reçue", mythe: "Relancer dérange le client", realite: "Une relance polie rassure souvent" },
    { type: "T28", titre: "Le parcours", noeuds: [{ texte: "Devis envoyé" }, { texte: "Relance par SMS" }] },
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

  it("une description vide est refusée", () => {
    expect(() => contenuDepuisVideoImportee({ titre: "Visite", description: "   ", dureeSec: 10 })).toThrow();
  });
});
