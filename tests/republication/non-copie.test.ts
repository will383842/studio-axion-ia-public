/** L8-10 : contrôle de non-copie pour la republication. Fonctions pures, aucun appel réel. */
import { describe, expect, it } from "vitest";
import { TAILLE_ALERTE_POST } from "@/domaine/ecriture-commune/memoire-posts";
import { SEUIL_PROXIMITE_REPUBLICATION, TAILLE_COPIE_REPUBLICATION, controlerNonCopie } from "@/domaine/republication/non-copie";

const ORIGINE = "Notre équipe automatise vos relances clients chaque lundi matin sans effort ni oubli pour gagner du temps.";

describe("non-copie à la republication", () => {
  it("réutilise la constante de L3-13 (une seule valeur) et marque le seuil de proximité hypothese", () => {
    expect(TAILLE_COPIE_REPUBLICATION).toBe(TAILLE_ALERTE_POST);
    expect(TAILLE_COPIE_REPUBLICATION).toBe(6);
    expect(SEUIL_PROXIMITE_REPUBLICATION).toEqual({ statut: "hypothese", valeur: 0.6 });
  });

  it("refuse un texte identique", () => {
    const r = controlerNonCopie(ORIGINE, [ORIGINE]);
    expect(r.ok).toBe(false);
    expect(r.motif).toBe("identique");
  });

  it("refuse un texte identique à la casse et à la ponctuation près", () => {
    expect(controlerNonCopie(ORIGINE.toUpperCase().replace(".", " !"), [ORIGINE]).motif).toBe("identique");
  });

  it("refuse 6 mots copiés d'affilée hors citation", () => {
    const r = controlerNonCopie("Bonjour à tous, découvrez comment automatise vos relances clients chaque lundi matin avec nous.", [ORIGINE]);
    expect(r.ok).toBe(false);
    expect(r.motif).toBe("reprise");
    expect(r.reprises.length).toBeGreaterThan(0);
  });

  it("refuse une proximité de 0,6 ou plus", () => {
    const proche = "Vos relances clients chaque lundi matin automatisées : gagner du temps, sans oubli ni effort, par notre équipe.";
    const r = controlerNonCopie(proche, [ORIGINE]);
    expect(r.ok).toBe(false);
    expect(r.proximite).toBeGreaterThanOrEqual(0.6);
  });

  it("accepte un texte neuf", () => {
    const r = controlerNonCopie("Trois idées pour fidéliser une clientèle locale : écoute, rapidité, petit geste inattendu.", [ORIGINE]);
    expect(r).toMatchObject({ ok: true, motif: null });
    expect(r.proximite).toBeLessThan(0.6);
  });

  it("tolère une citation entre guillemets", () => {
    const texte = `Un client nous écrit : « ${ORIGINE.replace(/\.$/, "")} » et cela change tout pour lui.`;
    const r = controlerNonCopie(texte, [ORIGINE]);
    expect(r.ok).toBe(true);
  });

  it("5 mots communs seulement : accepté", () => {
    const r = controlerNonCopie("Voici pourquoi relances clients chaque lundi matin demandent une vraie méthode plutôt qu'un hasard.", [ORIGINE]);
    expect(r.ok).toBe(true);
  });

  it("sans texte d'origine : accepté ; n'altère pas ses entrées", () => {
    const origines = [ORIGINE];
    expect(controlerNonCopie("Un texte quelconque.", []).ok).toBe(true);
    controlerNonCopie("Autre texte.", origines);
    expect(origines).toEqual([ORIGINE]);
  });
});
