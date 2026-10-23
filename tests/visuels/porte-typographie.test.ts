import { describe, expect, it } from "vitest";
import { corrigerTypographie } from "../../src/domaine/controles-visuel/typographie.js";
import { controlerCarrousel } from "../../src/domaine/controles-visuel/porte.js";
import { textesDe } from "../../src/domaine/controles-visuel/textes-de.js";
import type { CarrouselSpecType } from "../../src/domaine/visuels/types.js";

const FINE = " ";
const INS = " ";
const spec = (message: string, sousTitre = "Un sous-titre"): CarrouselSpecType => ({
  version: "carrousel/1",
  alt: "Carrousel d’exemple",
  pages: [
    { type: "T01", titre: "Un titre", sousTitre },
    { type: "T10", message },
    { type: "T21" },
  ],
});
const message = (s: CarrouselSpecType) => (s.pages[1] as { message: string }).message;

describe("typographie française", () => {
  it("espace fine insécable avant ; ! ?", () => {
    const { specCorrige } = corrigerTypographie(spec("Vraiment ? Oui ! Voyons; non"));
    expect(message(specCorrige)).toBe(`Vraiment${FINE}? Oui${FINE}! Voyons${FINE}; non`);
  });
  it("remplace une espace ordinaire ou absente par l'espace fine, sans doubler", () => {
    expect(message(corrigerTypographie(spec("Quoi?")).specCorrige)).toBe(`Quoi${FINE}?`);
    expect(message(corrigerTypographie(spec("Quoi  ?")).specCorrige)).toBe(`Quoi${FINE}?`);
    expect(message(corrigerTypographie(spec("Quoi ?!")).specCorrige)).toBe(`Quoi${FINE}?!`);
  });
  it("espace insécable avant :, sauf dans une heure comme 10:30", () => {
    expect(message(corrigerTypographie(spec("Notez : voilà")).specCorrige)).toBe(`Notez${INS}: voilà`);
    expect(message(corrigerTypographie(spec("Notez: voilà")).specCorrige)).toBe(`Notez${INS}: voilà`);
    expect(message(corrigerTypographie(spec("Rendez-vous à 10:30")).specCorrige)).toBe("Rendez-vous à 10:30");
  });
  it("guillemets français et apostrophe typographique", () => {
    expect(message(corrigerTypographie(spec('Dites "bonjour" à l\'équipe')).specCorrige)).toBe(`Dites «${INS}bonjour${INS}» à l’équipe`);
    expect(message(corrigerTypographie(spec("Dites «bonjour»")).specCorrige)).toBe(`Dites «${INS}bonjour${INS}»`);
  });
  it("corrige aussi les autres champs et ne touche pas aux identifiants", () => {
    const { specCorrige } = corrigerTypographie(spec("Calme", "L'essentiel ?"));
    expect(textesDe(specCorrige).find((t) => t.chemin === "pages.0.sousTitre")?.texte).toBe(`L’essentiel${FINE}?`);
    expect(specCorrige.pages.map((p) => p.type)).toEqual(["T01", "T10", "T21"]);
    expect(specCorrige.version).toBe("carrousel/1");
  });
  it("ne modifie pas la spec d'origine", () => {
    const origine = spec("Quoi?");
    corrigerTypographie(origine);
    expect(message(origine)).toBe("Quoi?");
  });
  it("décrit chaque correction en français et n'en renvoie aucune si tout est déjà correct", () => {
    const r = corrigerTypographie(spec("Quoi?"));
    expect(r.corrections).toHaveLength(1);
    expect(r.corrections[0]).toMatch(/^Page 2 : /);
    expect(corrigerTypographie(spec("Calme")).corrections).toEqual([]);
  });
  it("est idempotente : deux passages = un", () => {
    const s = spec('Dites "oui" ? Notez: l\'été ; vite !');
    const un = corrigerTypographie(s);
    const deux = corrigerTypographie(un.specCorrige);
    expect(deux.specCorrige).toEqual(un.specCorrige);
    expect(deux.corrections).toEqual([]);
  });
  it("la porte la propose sans changer le niveau", () => {
    const avec = controlerCarrousel(spec("Vraiment?"), { interditsDans: () => [], faitsDisponibles: false });
    const sans = controlerCarrousel(spec("Vraiment"), { interditsDans: () => [], faitsDisponibles: false });
    expect(avec.rapport.verdict).toBe(sans.rapport.verdict);
    expect(avec.rapport.controles).toEqual(sans.rapport.controles);
    expect(avec.rapport.corrections).toHaveLength(1);
    expect(message(avec.specCorrige as CarrouselSpecType)).toBe(`Vraiment${FINE}?`);
    expect(sans.specCorrige).toBeUndefined();
  });
});
