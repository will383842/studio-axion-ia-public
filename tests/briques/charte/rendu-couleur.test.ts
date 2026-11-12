/**
 * GV-LU-01 : une seule table « format → LUT → intensité ». Fonctions pures, aucun dépôt, aucun réseau.
 */
import { describe, expect, it } from "vitest";
import { RENDU_COULEUR, renduCouleurDe } from "@/briques/charte/rendu-couleur";
import { listerFormats, obtenirFormat, styleParDefautRetenu } from "@/formats";
import { LUTS_AXION } from "@/donnees/luts-axion";

/** Écarts connus entre la table et les fiches de format (nettoyage des fiches = fiche suivante). */
const ECARTS_CONNUS = ["podcast", "createur-b", "ecran-partage", "motion", "ugc", "selfie"];
const DESSINES = ["tableau-anime", "cas-concret", "image-video", "tutoriel-outil"];
const tousLesFormats = listerFormats({ inclureMasques: true, inclureReservesAWill: true });

describe("table RENDU_COULEUR", () => {
  it("chaque format du registre (actif, bientôt ou masqué) a une ligne", () => {
    for (const f of tousLesFormats) expect(RENDU_COULEUR[f.id], f.id).toBeDefined();
  });
  it("la LUT de la table existe dans LUTS_AXION ou vaut null", () => {
    const ids = LUTS_AXION.map((l) => l.id);
    for (const [id, r] of Object.entries(RENDU_COULEUR)) {
      if (r.lut !== null) expect(ids, id).toContain(r.lut);
    }
  });
  it("hors écarts connus, la table égale la fiche du format (LUT et intensité)", () => {
    for (const f of tousLesFormats.filter((x) => !ECARTS_CONNUS.includes(x.id))) {
      const r = renduCouleurDe(f.id);
      expect(r.lut, f.id).toBe(f.stylesParDefaut.lut ?? null);
      expect(r.intensite, f.id).toBe(f.stylesParDefaut.intensiteLut ?? 70);
    }
  });
  it("valeurs d'aujourd'hui inchangées : avocat 70, face caméra naturel 70", () => {
    expect(renduCouleurDe("avocat")).toEqual({ lut: "lut-avocat-v1", intensite: 70, nature: "filme" });
    for (const id of ["facecam", "facecam-animee", "demo-facecam"]) expect(renduCouleurDe(id)).toEqual({ lut: "lut-axion-naturel", intensite: 70, nature: "filme" });
  });
  it("générateurs dessinés : rendu neutre déclaré, sans LUT", () => {
    for (const id of DESSINES) expect(renduCouleurDe(id), id).toMatchObject({ lut: null, nature: "dessine" });
  });
  it("format inconnu : neutre, intensité 70", () => {
    expect(renduCouleurDe("inconnu")).toMatchObject({ lut: null, intensite: 70 });
  });
});

describe("ordre vidéo > étoile > table (même montage que stylesResolus)", () => {
  const avec = (id: string) => {
    const f = obtenirFormat(id);
    return { ...f, stylesParDefaut: { ...f.stylesParDefaut, lut: renduCouleurDe(id).lut ?? undefined } };
  };
  it("sans choix ni étoile : la LUT de la table", () => {
    expect(styleParDefautRetenu(avec("avocat"), "lut", undefined, [])).toBe("lut-avocat-v1");
    expect(styleParDefautRetenu(avec("tableau-anime"), "lut", undefined, [])).toBeUndefined();
  });
  it("étoile : elle passe devant la table, même sur un générateur dessiné", () => {
    const etoile = [{ id: "lut-x", type: "lut", formatsParDefaut: ["tableau-anime"] }];
    expect(styleParDefautRetenu(avec("tableau-anime"), "lut", undefined, etoile)).toBe("lut-x");
  });
  it("choix de la vidéo : il passe devant tout", () => {
    expect(styleParDefautRetenu(avec("avocat"), "lut", "lut-choisie", [])).toBe("lut-choisie");
  });
});
