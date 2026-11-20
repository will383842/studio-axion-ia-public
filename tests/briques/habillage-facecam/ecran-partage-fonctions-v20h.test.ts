import { describe, expect, it } from "vitest";
import {
  dispositionQuiTient,
  planifierEcransPartages,
  poserEcransPartages,
  REGLES_ECRAN_PARTAGE,
} from "../../../src/briques/habillage-facecam/ecran-partage";
import { choisirModeleTous } from "../../../src/briques/motion/choix-etendu";
import type { PlanScene } from "../../../src/briques/composition/scene";

const AVANT_APRES = "On passe de 12 % à 45 % en trois mois";

const plan = (debutSec: number, finSec: number, type: PlanScene["type"] = "double"): PlanScene => ({
  debutSec,
  finSec,
  type,
  angle: "principal",
  cadrage: { zoom: 1.2, zoomFin: 1.4 } as PlanScene["cadrage"],
});

describe("planifierEcransPartages", () => {
  it("retient une phrase qui porte un avant / après, bornée à 3 s au moins", () => {
    const r = planifierEcransPartages([{ texte: AVANT_APRES, debutSec: 3, finSec: 7 }], 40);
    expect(r).toHaveLength(1);
    expect(r[0].debutSec).toBe(3);
    expect(r[0].finSec).toBe(7);
    expect(r[0].carte.modele).toBe("avant-apres");
    expect(r[0].raison).toBe("un passage d'une valeur à une autre");
  });
  it("liste vide, phrase sans motif ou confiance trop basse : aucun passage", () => {
    expect(planifierEcransPartages([], 40)).toEqual([]);
    expect(planifierEcransPartages([{ texte: "Bonjour tout le monde", debutSec: 3, finSec: 7 }], 40)).toEqual([]);
    expect(planifierEcransPartages([{ texte: "Avant, tout était lent ; après, tout est rapide.", debutSec: 3, finSec: 9 }], 40)).toEqual([]);
  });
  it("jamais pendant l'accroche : le début est ramené à 2 s", () => {
    const r = planifierEcransPartages([{ texte: AVANT_APRES, debutSec: 0, finSec: 6 }], 40);
    expect(r[0].debutSec).toBe(REGLES_ECRAN_PARTAGE.pasAvantSec);
    expect(r[0].finSec).toBe(6);
  });
  it("durée bornée à 8 s", () => {
    const r = planifierEcransPartages([{ texte: AVANT_APRES, debutSec: 10, finSec: 30 }], 100);
    expect(r[0].finSec - r[0].debutSec).toBe(8);
  });
  it("25 % de la vidéo au plus : trop court pour 3 s → rien", () => {
    expect(planifierEcransPartages([{ texte: AVANT_APRES, debutSec: 3, finSec: 7 }], 10)).toEqual([]);
  });
  it("écart minimal de 6 s entre deux passages ; trié par début", () => {
    const phrases = [
      { texte: AVANT_APRES, debutSec: 10, finSec: 14 },
      { texte: AVANT_APRES, debutSec: 16, finSec: 20 },
      { texte: AVANT_APRES, debutSec: 30, finSec: 34 },
    ];
    const r = planifierEcransPartages(phrases, 100);
    expect(r.map((p) => [p.debutSec, p.finSec])).toEqual([
      [10, 14],
      [30, 34],
    ]);
  });
  it("3 passages par vidéo au plus", () => {
    const phrases = [10, 30, 50, 70].map((d) => ({ texte: AVANT_APRES, debutSec: d, finSec: d + 4 }));
    expect(planifierEcransPartages(phrases, 200)).toHaveLength(3);
  });
  it("ne modifie pas l'entrée", () => {
    const phrases = [{ texte: AVANT_APRES, debutSec: 3, finSec: 7 }];
    const copie = JSON.parse(JSON.stringify(phrases));
    planifierEcransPartages(phrases, 40);
    expect(phrases).toEqual(copie);
  });
});

describe("poserEcransPartages", () => {
  const passage = { debutSec: 4, finSec: 8, carte: "avant-apres", sourceY: 120 };
  it("sans passage : les plans sont rendus tels quels", () => {
    const plans = [plan(0, 10)];
    expect(poserEcransPartages(plans, [], 800)).toBe(plans);
  });
  it("coupe le plan aux bornes et pose l'écran partagé sur le morceau du passage", () => {
    const r = poserEcransPartages([plan(0, 10)], [passage], 800);
    expect(r.map((p) => [p.debutSec, p.finSec])).toEqual([
      [0, 4],
      [4, 8],
      [8, 10],
    ]);
    expect(r[0].ecranPartage).toBeUndefined();
    expect(r[2].ecranPartage).toBeUndefined();
    expect(r[1].ecranPartage).toEqual({
      carte: "entree:avant-apres",
      hauteurHaut: 800,
      sourceY: 120,
      entreeImages: REGLES_ECRAN_PARTAGE.entreeImages,
      carteDebutSec: 0,
    });
    expect(r[1].cadrage.zoom).toBe(1);
    expect(r[1].cadrage.zoomFin).toBe(1);
  });
  it("un plan d'illustration dans le passage reste plein écran ; préfixe non doublé", () => {
    const r = poserEcransPartages([plan(4, 8, "illustration")], [{ ...passage, carte: "entree:deja" }], 800);
    expect(r).toHaveLength(1);
    expect(r[0].ecranPartage).toBeUndefined();
    const r2 = poserEcransPartages([plan(4, 8)], [{ ...passage, carte: "entree:deja" }], 800, 5);
    expect(r2[0].ecranPartage?.carte).toBe("entree:deja");
    expect(r2[0].ecranPartage?.entreeImages).toBe(5);
  });
  it("seul le premier plan du passage porte l'entrée ; les suivants lisent la carte décalée", () => {
    const r = poserEcransPartages([plan(4, 6), plan(6, 8)], [passage], 800);
    expect(r[0].ecranPartage?.entreeImages).toBe(9);
    expect(r[1].ecranPartage?.entreeImages).toBe(0);
    expect(r[1].ecranPartage?.carteDebutSec).toBe(2);
  });
  it("côte à côte (F1) : champs ajoutés seulement avec cote « gauche »", () => {
    const r = poserEcransPartages([plan(4, 8)], [{ ...passage, cote: "gauche", largeurCarte: 540, sourceX: 30 }], 800);
    expect(r[0].ecranPartage).toMatchObject({ cote: "gauche", largeurCarte: 540, sourceX: 30 });
    const r2 = poserEcransPartages([plan(4, 8)], [passage], 800);
    expect(r2[0].ecranPartage).not.toHaveProperty("cote");
  });
  it("ne modifie pas les plans d'entrée", () => {
    const plans = [plan(0, 10)];
    const copie = JSON.parse(JSON.stringify(plans));
    poserEcransPartages(plans, [passage], 800);
    expect(plans).toEqual(copie);
  });
});

describe("dispositionQuiTient", () => {
  const liste = choisirModeleTous("Trois étapes : un, deux, trois.")?.carte;
  it("une liste courte tient dans la moitié haute", () => {
    expect(liste?.modele).toBe("liste");
    expect(dispositionQuiTient(liste, "moitie-haute")).toBe("moitie-haute");
  });
  it("plein écran, carte absente ou carte non-liste : disposition inchangée", () => {
    expect(dispositionQuiTient(liste, "plein-ecran")).toBe("plein-ecran");
    expect(dispositionQuiTient(undefined, "moitie-haute")).toBe("moitie-haute");
    const avantApres = choisirModeleTous(AVANT_APRES)?.carte;
    expect(dispositionQuiTient(avantApres, "moitie-haute")).toBe("moitie-haute");
  });
  it("une liste trop longue passe en plein écran", () => {
    if (!liste || liste.modele !== "liste") throw new Error("liste attendue");
    const longue = {
      ...liste,
      donnees: {
        ...liste.donnees,
        elements: Array.from({ length: 12 }, (_, i) => ({ ...liste.donnees.elements[0], texte: `Un point assez long numéro ${i + 1} qui prend de la place` })),
      },
    };
    expect(dispositionQuiTient(longue, "moitie-haute")).toBe("plein-ecran");
  });
});
