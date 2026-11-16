import { describe, expect, it } from "vitest";
import { empreinteV4, empreinteCartes, axesDesChoix, fusionnerAxes } from "@/services/variete-commune/empreintes-b";
import { CATALOGUE_V4 } from "@/moteurs/montage-facecam-animee/realisateur/catalogue-v4";
import { VERSION_EMPREINTE } from "@/briques/variete-commune";
import type { HistoriqueVideo } from "@/moteurs/montage-facecam-animee/realisateur/regles";
import type { Choix } from "@/briques/bibliotheque-video/types";

const LE = "2026-11-16T10:00:00.000Z";

describe("empreintes-b", () => {
  it("v4 : historique de test → empreinte attendue", () => {
    const h: HistoriqueVideo = { types: [], entrees: [], familles: ["etiquette", "chiffre", "etiquette", "liste"] };
    const e = empreinteV4("v1", LE, h);
    expect(e.version).toBe(VERSION_EMPREINTE);
    expect(e.videoId).toBe("v1");
    expect(e.le).toBe(LE);
    expect(e.axes.ouverture).toEqual(["autre:facecam-animee:etiquette"]);
    expect(e.axes.objets).toEqual(["autre:facecam-animee:chiffre", "autre:facecam-animee:etiquette", "autre:facecam-animee:liste"]);
    expect(e.axes.typo).toEqual(["montserrat-v4"]);
    expect(e.axes.palette).toHaveLength(1);
  });
  it("v4 sans famille : ni ouverture ni objets", () => {
    const e = empreinteV4("v2", LE, { types: [], entrees: [] });
    expect(e.axes.ouverture).toBeUndefined();
    expect(e.axes.objets).toBeUndefined();
    expect(e.axes.typo).toEqual(["montserrat-v4"]);
  });
  it("cartes : 1re carte = ouverture, modèles = objets", () => {
    const e = empreinteCartes("c1", LE, "avocat-9x16", [{ modele: "B", debutSec: 5 }, { modele: "A", debutSec: 1 }, { modele: "B", debutSec: 9 }]);
    expect(e.formatId).toBe("avocat-9x16");
    expect(e.axes.ouverture).toEqual(["autre:cartes:A"]);
    expect(e.axes.objets).toEqual(["autre:cartes:A", "autre:cartes:B"]);
  });
  it("cartes vides : aucun axe objets", () => {
    const e = empreinteCartes("c2", LE, "f", []);
    expect(e.axes.objets).toBeUndefined();
    expect(e.axes.ouverture).toBeUndefined();
  });
  it("axesDesChoix : correspondances et choix inconnu ignoré", () => {
    const choix: Choix[] = [
      { capacite: "texte.style-varie", cle: "x", signature: "sig-1" },
      { capacite: "son.musique", cle: "m1" },
      { capacite: "etalonnage.chaud", cle: "e1" },
      { capacite: "transition.volet", cle: "t1" },
      { capacite: "fond.inconnu", cle: "z" },
      { capacite: "texte.autre", cle: "y" },
    ];
    expect(axesDesChoix(choix)).toEqual({
      sousTitres: ["sig-1"], sons: ["m1"], palette: ["e1"], transitions: ["t1"],
    });
    expect(() => axesDesChoix([{ capacite: "bizarre" as never, cle: "" }])).not.toThrow();
    expect(axesDesChoix([])).toEqual({});
  });
  it("fusionnerAxes : union triée sans doublon", () => {
    expect(fusionnerAxes({ sons: ["b", "a"] }, { sons: ["a", "c"], palette: ["p"] })).toEqual({ sons: ["a", "b", "c"], palette: ["p"] });
    expect(fusionnerAxes()).toEqual({});
  });
  it("CATALOGUE_V4 jamais modifié", () => {
    const avant = JSON.stringify(CATALOGUE_V4);
    empreinteV4("v", LE, { types: [], entrees: [], familles: CATALOGUE_V4.map((f) => f.famille) });
    expect(JSON.stringify(CATALOGUE_V4)).toBe(avant);
  });
});
