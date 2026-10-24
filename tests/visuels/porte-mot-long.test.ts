import { describe, expect, it, vi } from "vitest";
import { controlerCarrousel } from "../../src/domaine/controles-visuel/porte";
import { capaciteMotCarte } from "../../src/briques/visuels/registre-pages";
import type { ContextePorte } from "../../src/domaine/visuels/contrats";
import { PLACE_T29, PLACES_T26, placesT02, placesT20Maquettes, placesT23, placesT24, placesT28 } from "../../src/briques/visuels/places-mots";
import { largeurAuFacteur1 } from "../../studio-rendu/compositions/visuels/commun/geometrie";
import { colonnesT02 } from "../../studio-rendu/compositions/visuels/pages/T02";
import { colonnesT20Maquettes } from "../../studio-rendu/compositions/visuels/pages/T20";
import { colonnesT23 } from "../../studio-rendu/compositions/visuels/pages/T23";
import { colonnesT24, VARIANTES_T24 } from "../../studio-rendu/compositions/visuels/pages/T24";
import { COLONNES_T26, texteBandeauT26 } from "../../studio-rendu/compositions/visuels/pages/T26";
import { colonnesT28, VARIANTES_T28 } from "../../studio-rendu/compositions/visuels/pages/T28";
import { COLONNE_RAPPEL_T29 } from "../../studio-rendu/compositions/visuels/pages/T29";

// Sans les dépendances de studio-rendu (CI ciblée des visuels), « remotion » est simulé : les composants se chargent quand même.
// Installé, le vrai module est chargé (son chemin résolu n'est pas « remotion »), le test reste le même.
vi.mock("remotion", () => ({ cancelRender: () => undefined, continueRender: () => undefined, delayRender: () => 0, AbsoluteFill: () => null }));

const ctx: ContextePorte = { interditsDans: () => [], faitsDisponibles: false };
const carte = (titre: string) => ({ titre, corps: "Un texte court." });
const dense = (titres: string[]) => ({ type: "T02", titre: "Les bases", cartes: titres.map(carte) });
const spec = (page: object) => ({
  version: "carrousel/1",
  alt: "Carrousel d'exemple",
  pages: [{ type: "T01", titre: "Une couverture" }, page, { type: "T06", titre: "Une liste", points: [{ texte: "Un" }, { texte: "Deux" }, { texte: "Trois" }] }, { type: "T21" }],
});
const motsTropLongs = (page: object) => controlerCarrousel(spec(page), ctx).rapport.controles.filter((c) => c.code === "MOT_TROP_LONG");

describe("MOT_TROP_LONG : mot le plus long d'un titre de carte T02 (mesuré au rendu réel)", () => {
  it("budgets du registre : 10 signes pour 4 à 6 cartes, 15 pour 2 et 3", () => {
    expect([2, 3, 4, 5, 6].map(capaciteMotCarte)).toEqual([15, 15, 10, 10, 10]);
  });
  it.each([4, 5, 6])("%i cartes : un mot de 11 signes ou plus est rouge, 10 passe", (n) => {
    const titres = (mot: string) => Array.from({ length: n }, (_, i) => (i === 1 ? mot : "Planifier"));
    const rouges = motsTropLongs(dense(titres("communicatio")));
    expect(rouges).toHaveLength(1);
    expect(rouges[0]).toMatchObject({ niveau: "rouge", page: 2, chemin: "pages.1.cartes.1.titre" });
    expect(rouges[0].phrase).toMatch(/communicatio/);
    expect(motsTropLongs(dense(titres("communicat")))).toEqual([]);
    expect(motsTropLongs(dense(titres("communicati")))).toHaveLength(1);
  });
  it("2 cartes : 15 passe, 16 est rouge", () => {
    expect(motsTropLongs(dense(["automatiquement", "Ranger"]))).toEqual([]);
    expect(motsTropLongs(dense(["automatiquementx", "Ranger"]))).toHaveLength(1);
  });
  it("le tiret sépare les mots, l'apostrophe non (le navigateur ne coupe pas après une apostrophe)", () => {
    expect(motsTropLongs(dense(["Ranger", "Tenir l'agenda", "Lire", "Noter-tout"]))).toEqual([]);
    for (const apo of ["'", "’", "ʼ"]) {
      const rouges = motsTropLongs(dense(["Ranger", `Un d${apo}organisation`, "Lire", "Noter"]));
      expect(rouges).toHaveLength(1);
      expect(rouges[0].phrase).toMatch(/organisation/);
    }
    expect(motsTropLongs(dense(["Ranger", "Un accompagnement-bis", "Lire", "Noter"]))).toHaveLength(1);
    expect(motsTropLongs(dense(["Ranger", "Un accompa\u2010gnement", "Lire", "Noter"]))).toEqual([]);
  });
  it("l'espace insécable ne permet pas de retour à la ligne : il reste dans le mot", () => {
    expect(motsTropLongs(dense(["Ranger", "Un\u00A0accompagnement", "Lire", "Noter"]))).toHaveLength(1);
    expect(motsTropLongs(dense(["Ranger", "Les\u00A0bases", "Lire", "Noter"]))).toEqual([]);
  });
  it("les autres pages ne sont pas concernées", () => {
    const liste = { type: "T06", titre: "Une liste", points: [{ texte: "Accompagnement automatiquement" }, { texte: "Deux" }, { texte: "Trois" }] };
    expect(controlerCarrousel({ version: "carrousel/1", alt: "x", pages: [{ type: "T01", titre: "Une couverture" }, liste, { type: "T21" }] }, ctx).rapport.controles.filter((c) => c.code === "MOT_TROP_LONG")).toEqual([]);
  });
});

/**
 * Tour 2 : un mot insécable plus large que sa colonne (chasses réelles d'Inter Bold) est refusé PAR LA PORTE, avant le rendu, dans les
 * gabarits à colonnes : T26 (lignes, outils, « vous »), T28, T24, T23, T02, T27. « professionnalisation » y tient ; des lettres larges non.
 */
describe("MOT_TROP_LONG : gabarits à colonnes (largeur réelle du mot)", () => {
  const LARGE = "MWMWMWMWMWMWMWMW";
  const t26 = { type: "T26", titre: "Un exemple type", avant: ["Les mails s'empilent", "On répond tard"], avec: ["Les demandes sont triées", "Un brouillon attend"], outils: ["Messagerie"], vous: "Vous relisez et vous envoyez" };
  it("T26 : « professionnalisation » tient partout ; 16 lettres larges dans une ligne « avec nous » sont refusées, avec le chemin du champ", () => {
    expect(motsTropLongs({ ...t26, avec: ["La professionnalisation", "Professionnalisation"] })).toEqual([]);
    const r = motsTropLongs({ ...t26, avec: [LARGE, "Un brouillon attend"] });
    expect(r).toHaveLength(1);
    expect(r[0]).toMatchObject({ niveau: "rouge", page: 2, chemin: "pages.1.avec.0" });
    expect(r[0].phrase).toContain(LARGE);
  });
  it("T26 : le cas vu en prod passe ; un « vous » de 44 signes larges passe (il se coupe aux espaces)", () => {
    expect(motsTropLongs({ type: "T26", titre: "Un exemple type", avant: ["Les mails s'empilent le lundi", "On répond le soir, fatigué"], avec: ["Les demandes sont triées", "Un brouillon attend votre relecture"], outils: ["Messagerie", "Assistant IA"], vous: "Vous relisez et vous envoyez" })).toEqual([]);
    expect(motsTropLongs({ ...t26, vous: "MWQ MWQM WQMW QMWQ MWQM WQMW QMWQ MWQM WQMW" })).toEqual([]);
  });
  it("T26 : une pastille d'outil ne se coupe pas (tout l'outil doit tenir) ; 16 signes larges tiennent encore", () => {
    expect(motsTropLongs({ ...t26, outils: [LARGE] })).toEqual([]);
  });
  it("T28 : 3 nœuds « professionnalisation » passent (le corps descend) ; 24 lettres larges sont refusées", () => {
    const noeuds = (t: string) => [{ texte: t }, { texte: "Elle est triée" }, { texte: "Vous validez" }];
    expect(motsTropLongs({ type: "T28", titre: "Le trajet", noeuds: noeuds("Professionnalisation") })).toEqual([]);
    expect(motsTropLongs({ type: "T28", titre: "Le trajet", noeuds: noeuds("MWMWMWMWMWMWMWMWMWMWMWMW") })).toMatchObject([{ chemin: "pages.1.noeuds.0.texte" }]);
  });
  it("T23 : une question faite de lettres larges est refusée ; « professionnalisation » passe", () => {
    const q = (question: string) => [{ question, aide: "Une aide." }, { question: "Qui essaie ?", aide: "Une personne." }, { question: "Quand ?", aide: "Lundi." }, { question: "Où ?", aide: "Ici." }];
    expect(motsTropLongs({ type: "T23", titre: "Avant", questions: q("La professionnalisation ?"), annotation: "Simple." })).toEqual([]);
    expect(motsTropLongs({ type: "T23", titre: "Avant", questions: q(`${LARGE}MW ?`), annotation: "Simple." })).toMatchObject([{ chemin: "pages.1.questions.0.question" }]);
  });
  it("T24 : « professionnalisation » (20 signes) reste refusée par le budget en signes (15), une seule fois par case", () => {
    const lignes = [{ sans: "Improvisation", avec: "Professionnalisation" }, { sans: "Oublié", avec: "Relancé" }, { sans: "Refait", avec: "Prêt" }];
    expect(motsTropLongs({ type: "T24", titre: "La différence", lignes })).toHaveLength(1);
  });
  it("T02 : le texte d'une carte en lettres larges est refusé sur deux colonnes", () => {
    const cartes = Array.from({ length: 4 }, (_, i) => ({ titre: "Trier", corps: i === 2 ? `Un ${LARGE}` : "Un texte court." }));
    expect(motsTropLongs({ type: "T02", titre: "Les bases", cartes })).toMatchObject([{ chemin: "pages.1.cartes.2.corps" }]);
  });
});

describe("MOT_TROP_LONG : la place de la porte est celle du gabarit (copie vérifiée de la géométrie de studio-rendu)", () => {
  it("T26, T28, T24, T23, T02, T29, T20 à maquettes : mêmes largeurs au facteur 1", () => {
    expect(PLACES_T26.avant).toBe(largeurAuFacteur1(COLONNES_T26.avant));
    expect(PLACES_T26.avec).toBe(largeurAuFacteur1(COLONNES_T26.avec));
    expect(PLACES_T26.outil).toBe(largeurAuFacteur1(COLONNES_T26.outils) - 2 * 16 - 2 * 2);
    expect(PLACES_T26.vous).toBeLessThanOrEqual(texteBandeauT26(150, 1).droite - texteBandeauT26(150, 1).gauche);
    for (let n = 3; n <= 5; n++) {
      expect(placesT28(n), `T28 ${n}`).toEqual(colonnesT28(n, VARIANTES_T28 - 1).map(largeurAuFacteur1));
      expect(placesT24(n), `T24 ${n}`).toEqual(colonnesT24(VARIANTES_T24 - 1, n).map((c) => largeurAuFacteur1(c.avec)));
    }
    for (let n = 2; n <= 4; n++) expect(placesT23(n), `T23 ${n}`).toEqual(colonnesT23(n, true).map(largeurAuFacteur1));
    for (let n = 2; n <= 6; n++) expect(placesT02(n), `T02 ${n}`).toEqual(colonnesT02(n).map(largeurAuFacteur1));
    expect(PLACE_T29).toBe(largeurAuFacteur1(COLONNE_RAPPEL_T29));
    for (let n = 3; n <= 5; n++) expect(placesT20Maquettes(n), `T20 maquettes ${n}`).toEqual(colonnesT20Maquettes(n).map(largeurAuFacteur1));
  });
});
