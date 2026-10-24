import { describe, expect, it } from "vitest";
import { formaterMesure } from "../../studio-rendu/compositions/visuels/mesure/protocole";
import { CLES_MESURE_TOILE, extraireMesureToile, ID_COMPOSITION_TOILE } from "../../studio-rendu/compositions/visuels/continu/mesure/protocole-toile";
import { dansCoinReserve, horsMarge, surCouture, traverseCouture } from "../../studio-rendu/compositions/visuels/continu/mesure/regles-toile";

const complete = () => Object.fromEntries(CLES_MESURE_TOILE.map((c) => [c, c === "taillePoliceMin" ? 30 : c === "pages" ? 4 : 0]));
const boite = (gauche: number, haut: number, droite: number, bas: number) => ({ gauche, haut, droite, bas });

describe("continu P2 : protocole de mesure de la toile", () => {
  it("les clés attendues", () => {
    expect([...CLES_MESURE_TOILE].sort()).toEqual(
      ["debordements", "taillePoliceMin", "textes", "textesSurCouture", "textesHorsMarge", "textesCoinReserve", "intrusionsMetaP1", "chevauchements", "debordCouture1", "traitsFinsSurCouture", "pages", "largeur", "hauteur"].sort(),
    );
    expect(ID_COMPOSITION_TOILE).toBe("ToileContinueMesuree");
  });
  it("accepte une ligne de toile complète portant le nonce", () => {
    expect(extraireMesureToile(["bruit", formaterMesure("n1", complete())], "n1")).toEqual(complete());
  });
  it("refuse une ligne sans textesSurCouture, ou d'un autre nonce", () => {
    const { textesSurCouture: _retire, ...sans } = complete();
    expect(extraireMesureToile([formaterMesure("n1", sans)], "n1")).toBeNull();
    expect(extraireMesureToile([formaterMesure("n2", complete())], "n1")).toBeNull();
  });
});

describe("continu P2 : règles de position sur la toile (pures)", () => {
  it("un texte dans la bande de ±80 px d'une couture interne", () => {
    expect(surCouture(boite(1100, 400, 1300, 440), 3)).toBe(true);
    expect(surCouture(boite(1170, 400, 1300, 440), 3)).toBe(false);
    expect(surCouture(boite(900, 400, 1005, 440), 3)).toBe(true);
    expect(surCouture(boite(2100, 400, 2200, 440), 2)).toBe(false);
  });
  it("un texte hors de la marge sûre de 80 px de sa page", () => {
    expect(horsMarge(boite(80, 80, 1000, 1270), 1350)).toBe(false);
    expect(horsMarge(boite(1150, 300, 1200, 330), 1350)).toBe(false);
    expect(horsMarge(boite(70, 300, 400, 330), 1350)).toBe(true);
    expect(horsMarge(boite(200, 1300, 400, 1330), 1350)).toBe(true);
  });
  it("un texte dans le coin réservé 200 × 200 en bas à droite de chaque page", () => {
    expect(dansCoinReserve(boite(900, 1200, 1000, 1240), 1350)).toBe(true);
    expect(dansCoinReserve(boite(1980, 1200, 2050, 1240), 1440)).toBe(false);
    expect(dansCoinReserve(boite(1980, 1300, 2050, 1330), 1440)).toBe(true);
    expect(dansCoinReserve(boite(80, 1200, 700, 1240), 1350)).toBe(false);
  });
  it("un objet qui traverse une couture", () => {
    expect(traverseCouture(boite(900, 0, 1300, 400), 1080)).toBe(true);
    expect(traverseCouture(boite(900, 0, 1080, 400), 1080)).toBe(false);
  });
});
