/** UI-1 : messages de la fiche (rendu en cours, blocage, refus, corbeille, simulation) et pastille de la carte. */
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { CarteCarrousel } from "@/components/visuels/CarteCarrousel";
import { MessagesFiche } from "@/components/visuels/MessagesFiche";
import type { VueCarrouselFiche } from "@/domaine/visuels/contrats";

const base: VueCarrouselFiche = {
  id: "vis_a", titre: "T", statut: "a_valider", libelleStatut: "À valider", nbPages: 2, modifieLe: "2026-10-23T10:00:00.000Z",
  modeTexte: "session", pourquoi: [], pages: [], entree: "sujet", renduEnCours: false, pdfTelechargement: false, refus: [], actionsPermises: [], generateurAllume: true,
};
const rendu = (f: Partial<VueCarrouselFiche>) => renderToStaticMarkup(createElement(MessagesFiche, { fiche: { ...base, ...f } }));

describe("fiche : rendu en cours", () => {
  it("rendu récent : message de la minute et page qui s'actualise", () => {
    const h = rendu({ statut: "ecrit", libelleStatut: "Texte écrit", renduEnCours: true });
    expect(h).toContain("Rendu en cours, environ une minute : cette page se met à jour toute seule");
    expect(h).toContain('http-equiv="refresh"');
  });
  it("pas d'actualisation hors rendu en cours ni à la corbeille", () => {
    expect(rendu({})).not.toContain("refresh");
    expect(rendu({ statut: "ecrit", renduEnCours: true, joursRestantsCorbeille: 3 })).not.toContain("refresh");
  });
  it("rendu périmé : « Le rendu semble bloqué »", () => {
    expect(rendu({ statut: "rendu_en_cours", actionsPermises: ["relancer_rendu"] })).toContain("Le rendu semble bloqué");
  });
});

describe("fiche bloquée", () => {
  it("sujet : propose « Refaire » seulement si l'action est permise", () => {
    expect(rendu({ statut: "bloque", actionsPermises: ["refaire"] })).toContain("« Refaire »");
    expect(rendu({ statut: "bloque", actionsPermises: [] })).not.toContain("« Refaire »");
  });
  it("texte déposé : « Déposez un texte corrigé » + lien vers le mode session, jamais « Refaire »", () => {
    const h = rendu({ statut: "bloque", entree: "session", actionsPermises: [] });
    expect(h).toMatch(/Le texte est bloqué par la porte : <a [^>]*href="\/carrousels\/nouveau\?entree=session"[^>]*>déposez un texte corrigé<\/a>\./);
    expect(h.match(/déposez un texte corrigé/gi)).toHaveLength(1);
    expect(h).not.toContain("Refaire");
  });
});

describe("fiche : rendu refusé pour la mise en page", () => {
  const erreur = "La page 2 ne tient pas dans la mise en page (zone réservée de LinkedIn) : raccourcissez ce texte ou changez de type de page.";
  it("sans « Relancer le rendu » : un texte à corriger, lien de dépôt", () => {
    const h = rendu({ statut: "echec_rendu", erreur, actionsPermises: [] });
    expect(h).toContain("zone réservée de LinkedIn");
    expect(h).not.toContain("Relancer");
    expect(h).toContain('href="/carrousels/nouveau?entree=session"');
  });
  it("« Refaire » proposé quand il est permis", () => {
    expect(rendu({ statut: "echec_rendu", erreur, actionsPermises: ["refaire"] })).toContain("« Refaire »");
  });
  it("un échec de rendu ordinaire n'ajoute rien", () => {
    expect(rendu({ statut: "echec_rendu", erreur: "Le rendu a échoué : réessayez avec « Relancer le rendu »", actionsPermises: ["relancer_rendu"] })).not.toContain("carrousels/nouveau");
  });
});

describe("fiche refusée", () => {
  const refus = [{ motif: "ton" as const, libelleMotif: "Le ton", commentaire: "Trop familier", page: 1, le: "2026-10-22T09:00:00.000Z" }];
  it("affiche le motif, le commentaire, la page et la date", () => {
    const h = rendu({ statut: "refuse", libelleStatut: "Refusé", refus });
    expect(h).toContain("Le ton");
    expect(h).toContain("Trop familier");
    expect(h).toContain("page 2");
    expect(h).toContain("22/10/2026");
  });
  it("texte déposé : lien « Déposer un texte corrigé »", () => {
    expect(rendu({ statut: "refuse", entree: "session", refus })).toContain("Déposer un texte corrigé");
    expect(rendu({ statut: "refuse", entree: "sujet", refus })).not.toContain("Déposer un texte corrigé");
  });
});

describe("fiche à la corbeille", () => {
  it("bandeau avec le nombre de jours", () => {
    expect(rendu({ joursRestantsCorbeille: 12 })).toContain("À la corbeille : supprimée définitivement dans 12 jours");
    expect(rendu({ joursRestantsCorbeille: 1 })).toContain("supprimée définitivement dans 1 jour<");
  });
});

describe("fiche : texte d'exemple (simulation)", () => {
  it("dit que c'est un texte d'exemple et pourquoi le sujet n'a pas été repris", () => {
    const h = rendu({ modeTexte: "simulation", noteTexte: "votre sujet n'a pas été repris comme titre parce qu'il contient un nombre" });
    expect(h).toContain("Simulation : texte d&#x27;exemple");
    expect(h).toContain("Simulation : texte d&#x27;exemple");
    expect(h.replace(/&#x27;/g, "'")).toContain("votre sujet n'a pas été repris comme titre parce qu'il contient un nombre");
  });
  it("texte de session : pas de mention de simulation", () => {
    expect(rendu({ modeTexte: "session" })).not.toContain("Simulation");
  });
});

describe("liste : pastille de la porte", () => {
  const carte = { id: "vis_a", titre: "T", statut: "echec_rendu" as const, libelleStatut: "Le rendu a échoué", verdict: "vert" as const, nbPages: 2, modifieLe: "x" };
  it("masquée en cas d'échec de rendu", () => {
    expect(renderToStaticMarkup(createElement(CarteCarrousel, { carrousel: carte }))).not.toContain("Vert");
  });
  it("sinon libellée « Porte : vert »", () => {
    expect(renderToStaticMarkup(createElement(CarteCarrousel, { carrousel: { ...carte, statut: "a_valider", libelleStatut: "À valider" } }))).toContain("Porte : vert");
  });
});
