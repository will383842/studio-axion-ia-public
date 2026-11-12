/**
 * GV-ST-01 : l'étoile « style par défaut d'un format » de la Bibliothèque sert de défaut à la fabrication, pour les
 * six types de style, avec la même règle à l'écran, à l'aperçu et à la commande. Aucune musique par défaut.
 * Fonctions pures : aucun dépôt, aucun réseau.
 */
import { describe, expect, it } from "vitest";
import { musiqueRetenue, obtenirFormat, styleParDefautRetenu, type TypeStyleParDefaut } from "@/formats";
import { DECOR_DEFAUT_AVOCAT, decorParDefaut } from "@/domaine/decors";
import { LUT_AUCUNE } from "@/donnees/luts-axion";

const format = obtenirFormat("facecam");

const TYPES: { style: TypeStyleParDefaut; type: string }[] = [
  { style: "lut", type: "lut" },
  { style: "sousTitres", type: "style-sous-titres" },
  { style: "habillage", type: "habillage" },
  { style: "styleMontage", type: "style-montage" },
  { style: "profilSon", type: "profil-son" },
  { style: "decor", type: "decor" },
];

function element(id: string, type: string, formatsParDefaut: string[], archiveLe?: string) {
  return { id, type, formatsParDefaut, ...(archiveLe ? { archiveLe } : {}) };
}

describe("styleParDefautRetenu : l'étoile de la Bibliothèque pour les six types", () => {
  for (const { style, type } of TYPES) {
    describe(style, () => {
      it("vidéo sans choix : l'élément étoilé pour le format", () => {
        expect(styleParDefautRetenu(format, style, undefined, [element("etoile-x", type, ["facecam"])])).toBe("etoile-x");
      });
      it("vidéo avec choix : le choix de la vidéo", () => {
        expect(styleParDefautRetenu(format, style, "choix-y", [element("etoile-x", type, ["facecam"])])).toBe("choix-y");
      });
      it("sans étoile : le défaut du code du format", () => {
        expect(styleParDefautRetenu(format, style, undefined, [element("autre", type, [])])).toBe(format.stylesParDefaut[style]);
      });
      it("élément étoilé archivé : ignoré", () => {
        expect(styleParDefautRetenu(format, style, undefined, [element("etoile-x", type, ["facecam"], "2026-01-01T00:00:00.000Z")])).toBe(format.stylesParDefaut[style]);
      });
      it("étoile d'un autre format ou d'un autre type : ignorée", () => {
        const elements = [element("autre-format", type, ["podcast"]), element("autre-type", type === "lut" ? "decor" : "lut", ["facecam"])];
        expect(styleParDefautRetenu(format, style, undefined, elements)).toBe(format.stylesParDefaut[style]);
      });
    });
  }

  it("deux étoiles pour le même format : celle qui est le défaut du code, sinon la première", () => {
    const defaut = format.stylesParDefaut.lut as string;
    const deux = [element("lut-autre", "lut", ["facecam"]), element(defaut, "lut", ["facecam"])];
    expect(styleParDefautRetenu(format, "lut", undefined, deux)).toBe(defaut);
    const sansDefaut = [element("lut-a", "lut", ["facecam"]), element("lut-b", "lut", ["facecam"])];
    expect(styleParDefautRetenu(format, "lut", undefined, sansDefaut)).toBe("lut-a");
  });

  it("un identifiant vide choisi par la vidéo reste le choix de la vidéo (comme l'ancien ??)", () => {
    expect(styleParDefautRetenu(format, "lut", "", [element("lut-etoile", "lut", ["facecam"])])).toBe("");
  });

  it("décor de l'avocat : N1 Halo orange prime sur l'étoile « Noir chaud » (règle decorParDefaut conservée)", () => {
    const avocat = obtenirFormat("avocat");
    const elements = [element("fond-noir-chaud", "decor", ["avocat"]), element(DECOR_DEFAUT_AVOCAT, "decor", [])];
    const retenu = decorParDefaut(avocat.id, elements, styleParDefautRetenu(avocat, "decor", undefined, elements));
    expect(retenu).toBe(DECOR_DEFAUT_AVOCAT);
  });

  it("décor d'un autre format : l'étoile est lue", () => {
    const elements = [element("decor-etoile", "decor", ["facecam"])];
    expect(decorParDefaut(format.id, elements, styleParDefautRetenu(format, "decor", undefined, elements))).toBe("decor-etoile");
  });

  it("LUT_AUCUNE choisie par la vidéo reste prioritaire sur l'étoile", () => {
    expect(styleParDefautRetenu(format, "lut", LUT_AUCUNE, [element("lut-etoile", "lut", ["facecam"])])).toBe(LUT_AUCUNE);
  });
});

describe("musiqueRetenue : aucune musique par défaut", () => {
  const elements = [element("mus-etoilee", "musique", ["facecam", "podcast"])];
  it("musique étoilée, vidéo sans choix : aucune musique", () => {
    expect(musiqueRetenue(obtenirFormat("podcast"), undefined, elements)).toBeUndefined();
    expect(musiqueRetenue(format, undefined, elements)).toBeUndefined();
  });
  it("le choix explicite de la vidéo est respecté", () => {
    expect(musiqueRetenue(obtenirFormat("podcast"), "mus-choisie", elements)).toBe("mus-choisie");
  });
});
