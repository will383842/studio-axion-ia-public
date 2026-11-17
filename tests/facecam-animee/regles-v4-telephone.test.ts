/**
 * C4-U4.9a-b : `resoudreElementsV4` accepte le téléphone (« telephone-video ») SEULEMENT si le 3ᵉ paramètre facultatif
 * vaut `{ telephoneVideo: true }` (true exact). Sans option : sortie identique à celle de master (instantané pris avant la
 * modification, le 17/11, recopié ci-dessous). Aucun appel à Claude, aucun réseau.
 */
import { describe, expect, it } from "vitest";
import type { ElementV4Plan } from "@/domaine/facecam-animee/plan";
import { FICHE_TELEPHONE_VIDEO_V4 } from "@/moteurs/montage-facecam-animee/realisateur/catalogue-v4-extensions";
import { ficheV4 } from "@/moteurs/montage-facecam-animee/realisateur/catalogue-v4";
import { resoudreElementsV4 } from "@/moteurs/montage-facecam-animee/realisateur/regles-v4";

const DUREE = 22;
const PLAN_REF: ElementV4Plan[] = [
  { id: "EtiquetteTete", debut: 1, fin: 2.5, mots: ["DEVIS"] },
  { id: "Interjection", debut: 4, fin: 5, mots: ["ATTENTION."] },
];
const ERREUR_INCONNU = "D0 — élément v4 1 : « PlaquetteQuiNexistePas » n'existe pas dans le catalogue v4 (26 plaquettes actives).";
const ERREUR_TEL = "D0 — élément v4 1 : « telephone-video » n'existe pas dans le catalogue v4 (26 plaquettes actives).";
const tel = (debut: number, fin: number): ElementV4Plan[] => [{ id: "telephone-video", debut, fin, recherches: ["axion:x"] }];

/** Sortie de master (avant C4-U4.9a-b) pour PLAN_REF : mêmes fiches du catalogue, aucune erreur. */
const attenduRef = () => ({
  elements: [
    { fiche: ficheV4("EtiquetteTete"), debut: 1, fin: 2.5, mots: ["DEVIS"], lignes: [], instants: [], recherches: [], rang: 1 },
    { fiche: ficheV4("Interjection"), debut: 4, fin: 5, mots: ["ATTENTION."], lignes: [], instants: [], recherches: [], rang: 2 },
  ],
  erreurs: [],
});

describe("C4-U4.9a-b · éteint = identique à master", () => {
  it("plan de référence : sans option, option false, option absurde → même sortie que master", () => {
    for (const sortie of [
      resoudreElementsV4(PLAN_REF, DUREE),
      resoudreElementsV4(PLAN_REF, DUREE, undefined),
      resoudreElementsV4(PLAN_REF, DUREE, {}),
      resoudreElementsV4(PLAN_REF, DUREE, { telephoneVideo: false }),
      resoudreElementsV4(PLAN_REF, DUREE, { telephoneVideo: "true" }),
      resoudreElementsV4(PLAN_REF, DUREE, { telephoneVideo: 1 }),
    ]) expect(sortie).toEqual(attenduRef());
  });
  it("id inconnu : erreur D0 inchangée, avec ou sans option", () => {
    const plan: ElementV4Plan[] = [{ id: "PlaquetteQuiNexistePas", debut: 1, fin: 2 }];
    const attendu = { elements: [], erreurs: [ERREUR_INCONNU] };
    expect(resoudreElementsV4(plan, DUREE)).toEqual(attendu);
    expect(resoudreElementsV4(plan, DUREE, { telephoneVideo: false })).toEqual(attendu);
    expect(resoudreElementsV4(plan, DUREE, { telephoneVideo: true })).toEqual(attendu);
  });
  it("plan qui cite telephone-video : « n'existe pas » inchangé sans option, avec false et avec une valeur qui n'est pas true", () => {
    const attendu = { elements: [], erreurs: [ERREUR_TEL] };
    expect(resoudreElementsV4(tel(1, 4), DUREE)).toEqual(attendu);
    expect(resoudreElementsV4(tel(1, 4), DUREE, { telephoneVideo: false })).toEqual(attendu);
    expect(resoudreElementsV4(tel(1, 4), DUREE, { telephoneVideo: "oui" })).toEqual(attendu);
  });
});

describe("C4-U4.9a-b · option { telephoneVideo: true }", () => {
  it("plan de référence : sortie inchangée (les plaquettes v4 se résolvent comme avant)", () => {
    expect(resoudreElementsV4(PLAN_REF, DUREE, { telephoneVideo: true })).toEqual(attenduRef());
  });
  it("téléphone de 3 s : aucune erreur D0, élément résolu avec la fiche du téléphone", () => {
    const r = resoudreElementsV4(tel(1, 4), DUREE, { telephoneVideo: true });
    expect(r.erreurs).toEqual([]);
    expect(r.elements).toHaveLength(1);
    expect(r.elements[0].fiche).toBe(FICHE_TELEPHONE_VIDEO_V4);
    expect(r.elements[0]).toMatchObject({ debut: 1, fin: 4, recherches: ["axion:x"], rang: 1 });
  });
  it("durée hors [2, 4] : erreur D0 de durée (trop court, trop long)", () => {
    const court = resoudreElementsV4(tel(1, 2), DUREE, { telephoneVideo: true }).erreurs;
    const long = resoudreElementsV4(tel(1, 6), DUREE, { telephoneVideo: true }).erreurs;
    expect(court).toHaveLength(1);
    expect(court[0]).toMatch(/^D0 — élément v4 1 « telephone-video » : 1,00 s à l'écran, la fiche prévoit de 2,00 s à 4,00 s\./);
    expect(long).toHaveLength(1);
    expect(long[0]).toMatch(/^D0 — élément v4 1 « telephone-video » : 5,00 s à l'écran/);
  });
  it("téléphone qui finit après la vidéo : D0 de fin de vidéo", () => {
    const e = resoudreElementsV4(tel(20, 23), DUREE, { telephoneVideo: true }).erreurs;
    expect(e.some((m) => m.includes("après la fin de la vidéo"))).toBe(true);
  });
});
