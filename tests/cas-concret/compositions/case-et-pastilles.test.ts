/**
 * FIX-CC-ECRANS : la case d'une liste de tâches finit avant le texte, et le schéma « outils reliés » ne dessine
 * que les pastilles qui ont un texte. Valeurs « master » (cas c et e) recopiées du calcul d'avant la correction.
 */
import { describe, expect, it } from "vitest";
import type { BoitePx } from "../../../src/briques/ecrans-motion";
import { planListeTaches } from "../../../studio-rendu/compositions/cas-concret/plans/ListeTaches";
import { planOutilsRelies } from "../../../studio-rendu/compositions/cas-concret/plans/OutilsRelies";

const liste = (textes: string[], largeur: number, hauteur: number) =>
  planListeTaches(
    {
      boite: { x: 0, y: 0, largeur, hauteur },
      t: 0,
      tVideo: 0,
      fond: "ivoire",
      textes,
    } as never,
    100,
  );
const outils = (textes: string[] | undefined) =>
  planOutilsRelies(
    {
      boite: { x: 0, y: 0, largeur: 520, hauteur: 600 },
      t: 0,
      tVideo: 0,
      fond: "ivoire",
      ...(textes ? { textes } : {}),
    } as never,
    100,
  );

const CASES_MASTER_4_TACHES: BoitePx[] = [
  {
    x: 52,
    y: 80.08928571428572,
    largeur: 64.82142857142857,
    hauteur: 64.82142857142857,
  },
  {
    x: 52,
    y: 245.08928571428572,
    largeur: 64.82142857142857,
    hauteur: 64.82142857142857,
  },
  {
    x: 52,
    y: 410.0892857142857,
    largeur: 64.82142857142857,
    hauteur: 64.82142857142857,
  },
  {
    x: 52,
    y: 575.0892857142857,
    largeur: 64.82142857142857,
    hauteur: 64.82142857142857,
  },
];
const OUTILS_MASTER_3_TEXTES = {
  boite: {
    x: 0,
    y: 0,
    largeur: 520,
    hauteur: 600,
  },
  ombre: "#1414134d",
  police: {
    famille: "Axion Inter Bold",
    graisse: 700,
    couleur: "#141413",
  },
  pastilles: [
    {
      index: 0,
      boite: {
        x: 10.4,
        y: 30,
        largeur: 322.4,
        hauteur: 102.00000000000001,
      },
      rond: {
        x: 43.244,
        y: 57.540000000000006,
        diametre: 46.92000000000001,
        couleur: "#141413",
      },
      texte: {
        texte: "A",
        boite: {
          x: 104.24000000000002,
          y: 30,
          largeur: 200.40799999999996,
          hauteur: 102.00000000000001,
        },
        taille: 42.84,
        tient: true,
      },
      opacite: 1,
      echelle: 1,
      rotation: 0,
    },
    {
      index: 1,
      boite: {
        x: 187.2,
        y: 249,
        largeur: 322.4,
        hauteur: 102.00000000000001,
      },
      rond: {
        x: 220.04399999999998,
        y: 276.54,
        diametre: 46.92000000000001,
        couleur: "#D97757",
      },
      texte: {
        texte: "B",
        boite: {
          x: 281.04,
          y: 249,
          largeur: 200.40799999999996,
          hauteur: 102.00000000000001,
        },
        taille: 42.84,
        tient: true,
      },
      opacite: 1,
      echelle: 1,
      rotation: 0,
    },
    {
      index: 2,
      boite: {
        x: 10.4,
        y: 468,
        largeur: 322.4,
        hauteur: 102.00000000000001,
      },
      rond: {
        x: 43.244,
        y: 495.54,
        diametre: 46.92000000000001,
        couleur: "#141413",
      },
      texte: {
        texte: "C",
        boite: {
          x: 104.24000000000002,
          y: 468,
          largeur: 200.40799999999996,
          hauteur: 102.00000000000001,
        },
        taille: 42.84,
        tient: true,
      },
      opacite: 1,
      echelle: 1,
      rotation: 0,
    },
  ],
  rayonPastille: 51.00000000000001,
  fil: {
    points: [
      {
        x: 171.6,
        y: 81,
      },
      {
        x: 348.4,
        y: 300,
      },
      {
        x: 171.6,
        y: 519,
      },
    ],
    trace: 1,
    epaisseur: 7.2,
    couleur: "#D97757",
  },
  point: {
    x: 197.79716482420088,
    y: 113.4501080118778,
    visible: true,
    diametre: 27,
    couleur: "#D97757",
    halo: "#FAF9F5",
  },
  textes: ["A", "B", "C"],
};
const OUTILS_MASTER_SANS_TEXTES = {
  boite: {
    x: 0,
    y: 0,
    largeur: 520,
    hauteur: 600,
  },
  ombre: "#1414134d",
  police: {
    famille: "Axion Inter Bold",
    graisse: 700,
    couleur: "#141413",
  },
  pastilles: [
    {
      index: 0,
      boite: {
        x: 10.4,
        y: 30,
        largeur: 322.4,
        hauteur: 102.00000000000001,
      },
      rond: {
        x: 43.244,
        y: 57.540000000000006,
        diametre: 46.92000000000001,
        couleur: "#141413",
      },
      texte: null,
      opacite: 1,
      echelle: 1,
      rotation: 0,
    },
    {
      index: 1,
      boite: {
        x: 187.2,
        y: 249,
        largeur: 322.4,
        hauteur: 102.00000000000001,
      },
      rond: {
        x: 220.04399999999998,
        y: 276.54,
        diametre: 46.92000000000001,
        couleur: "#D97757",
      },
      texte: null,
      opacite: 1,
      echelle: 1,
      rotation: 0,
    },
    {
      index: 2,
      boite: {
        x: 10.4,
        y: 468,
        largeur: 322.4,
        hauteur: 102.00000000000001,
      },
      rond: {
        x: 43.244,
        y: 495.54,
        diametre: 46.92000000000001,
        couleur: "#141413",
      },
      texte: null,
      opacite: 1,
      echelle: 1,
      rotation: 0,
    },
  ],
  rayonPastille: 51.00000000000001,
  fil: {
    points: [
      {
        x: 171.6,
        y: 81,
      },
      {
        x: 348.4,
        y: 300,
      },
      {
        x: 171.6,
        y: 519,
      },
    ],
    trace: 1,
    epaisseur: 7.2,
    couleur: "#D97757",
  },
  point: {
    x: 197.79716482420088,
    y: 113.4501080118778,
    visible: true,
    diametre: 27,
    couleur: "#D97757",
    halo: "#FAF9F5",
  },
  textes: [],
};

describe("liste-taches : la case ne passe pas sous le texte", () => {
  it.each([
    ["1 tâche 600x760", ["Traiter la demande"], 600, 760],
    ["1 tâche 860x720", ["Traiter la demande"], 860, 720],
    [
      "2 tâches 600x760",
      ["Traiter la demande", "Répondre au client"],
      600,
      760,
    ],
  ] as const)("%s", (_n, textes, w, h) => {
    const p = liste([...textes], w, h);
    expect(p.rangs).toHaveLength(textes.length);
    for (const r of p.rangs)
      expect(r.caseBoite.x + r.caseBoite.largeur).toBeLessThanOrEqual(
        r.boite.x,
      );
  });

  it("4 tâches 860x720 (l'exemple) : cases identiques à master", () => {
    expect(
      liste(["Un", "Deux", "Trois", "Quatre"], 860, 720).rangs.map(
        (r) => r.caseBoite,
      ),
    ).toEqual(CASES_MASTER_4_TACHES);
  });
});

describe("outils-relies : pas de pastille vide", () => {
  it("2 textes : 2 pastilles avec texte, fil de 2 points", () => {
    const p = outils(["Formulaire", "CRM"]);
    expect(p.pastilles).toHaveLength(2);
    expect(p.pastilles.map((x) => x.texte?.texte)).toEqual([
      "Formulaire",
      "CRM",
    ]);
    expect(p.pastilles.map((x) => x.index)).toEqual([0, 2]);
    expect(p.fil.points).toHaveLength(2);
  });

  it("1 texte : 1 pastille au milieu, fil sans trace, point caché", () => {
    const p = outils(["CRM"]);
    expect(p.pastilles).toHaveLength(1);
    expect(p.pastilles[0].index).toBe(1);
    expect(p.pastilles[0].texte?.texte).toBe("CRM");
    expect(p.fil.points).toHaveLength(1);
    expect(p.fil.trace).toBe(0);
    expect(p.point.visible).toBe(false);
  });

  it("texte blanc ou balises seules : non compté", () => {
    expect(outils(["Formulaire", "  ", "CRM"]).pastilles).toHaveLength(2);
  });

  it("3 textes : plan identique à master", () => {
    expect(JSON.parse(JSON.stringify(outils(["A", "B", "C"])))).toEqual(
      OUTILS_MASTER_3_TEXTES,
    );
  });

  it("textes absents ou vides : comportement actuel (3 places), identique à master", () => {
    expect(JSON.parse(JSON.stringify(outils(undefined)))).toEqual(
      OUTILS_MASTER_SANS_TEXTES,
    );
    expect(outils([]).pastilles).toHaveLength(3);
    expect(outils(["", " "]).pastilles).toHaveLength(3);
  });
});
