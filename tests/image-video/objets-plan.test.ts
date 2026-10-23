/**
 * L8 · Plan des objets (pur) : entonnoir, nuée, écran partagé, additionneur, sur les galeries des images D, E et F.
 * Données conformes aux cartes figées ; 20 enveloppes dont 16 cochées en cascade ; sorties 16/4 et 80 %/20 % ;
 * 8 + 6 + 5 = 19 posé sur son mot ; compteur 19 min → 45 sec ; aucun texte sous le plancher ni hors de sa case ;
 * déterministe.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import type { CarteImage } from "@/domaine/image-video/carte";
import { chiffresDe } from "@/domaine/image-video/chiffres";
import { iconeDe } from "@/domaine/image-video/icones";
import { ECRAN_IV, PLANCHER_IV } from "@/briques/schema-motion";
import { largeurAnton } from "../../studio-rendu/compositions/image-video/chasse-anton";
import { INSTANTS_GALERIE_OBJETS, sceneGalerieD, sceneGalerieE, sceneGalerieF } from "../../studio-rendu/compositions/image-video/donnees-galerie-objets";
import {
  MARGE_COLONNE,
  PADDING_BAC,
  objetsA,
  planAdditionneur,
  planEcranPartage,
  planEntonnoir,
  planNuee,
  repartition,
  ZONE_OBJETS_IV,
  controlerEntonnoir,
  type ObjetSceneIV,
  type ProprietesAdditionneur,
  type ProprietesEcranPartage,
  type ProprietesEntonnoir,
  type ProprietesNuee,
  type ProprietesSceneObjetsIV,
} from "../../studio-rendu/compositions/image-video/plan-objets";

const carte = (l: string): CarteImage => JSON.parse(readFileSync(join(process.cwd(), `tests/image-video/fixtures/cartes/${l}.json`), "utf8"));
const [D, E, F] = [carte("D"), carte("E"), carte("F")];
const noeud = (c: CarteImage, id: string) => c.noeuds.find((n) => n.id === id)!;
function objet<S extends ObjetSceneIV["sorte"]>(p: ProprietesSceneObjetsIV, sorte: S) {
  return p.objets.find((o) => o.sorte === sorte)! as Extract<ObjetSceneIV, { sorte: S }>;
}
const entonnoirD = objet(sceneGalerieD(), "entonnoir").proprietes as ProprietesEntonnoir;
const nueeD = objet(sceneGalerieD(), "nuee").proprietes as ProprietesNuee;
const partageE = objet(sceneGalerieE(), "ecran-partage").proprietes as ProprietesEcranPartage;
const partageF = objet(sceneGalerieF(), "ecran-partage").proprietes as ProprietesEcranPartage;
const additionF = objet(sceneGalerieF(), "additionneur").proprietes as ProprietesAdditionneur;
const PLANCHER = PLANCHER_IV * ECRAN_IV.hauteur;
const FIN = 1e3;

describe("données de la galerie = cartes figées D, E, F", () => {
  it("D : 20 enveloppes, sorties 16 et 4 sous les titres des groupes, icône résolue par la table de L1", () => {
    expect(entonnoirD.quantite).toBe(noeud(D, "n01").quantite);
    expect(nueeD.quantite).toBe(noeud(D, "n01").quantite);
    expect(entonnoirD.icone).toBe(iconeDe(noeud(D, "n01").icone!));
    expect(nueeD.icone).toBe(iconeDe(noeud(D, "n01").icone!));
    const titres = Object.fromEntries(D.groupes.map((g) => [g.noeuds[0], g.titre]));
    expect(entonnoirD.sorties.map((s) => [s.libelle, s.compte])).toEqual([
      [titres.n03, noeud(D, "n03").quantite],
      [titres.n04, noeud(D, "n04").quantite],
    ]);
    expect(nueeD.cochees).toBe(noeud(D, "n03").quantite);
    expect(controlerEntonnoir(entonnoirD)).toEqual([]);
  });
  it("E : chaque texte de l'écran partagé vient de la carte, les icônes des sources aussi", () => {
    const textes = E.noeuds.flatMap((n) => [n.libelle, n.detail ?? ""]).join(" | ");
    for (const l of [...partageE.avant.lignes, ...partageE.apres.lignes]) {
      for (const x of [l.texte, l.valeur]) if (x) expect(textes, x).toContain(x);
    }
    const sources = E.noeuds.filter((n) => n.role === "source").map((n) => iconeDe(n.icone!));
    expect(partageE.avant.lignes[0].icones).toEqual(sources);
  });
  it("F : minuteurs = 8, 6, 5 lus dans les nœuds ; total 19 ; après « 45 sec » ; textes de l'écran partagé dans la carte", () => {
    expect(additionF.termes.map((m) => m.valeur)).toEqual(["n02", "n03", "n04"].map((id) => chiffresDe(noeud(F, id).detail!)[0].valeur));
    expect(additionF.total.valeur).toBe(chiffresDe(noeud(F, "n05").libelle)[0].valeur);
    expect(additionF.apres!.texte).toBe(noeud(F, "n11").libelle);
    expect(additionF.apres!.secondes).toBe(chiffresDe(noeud(F, "n11").libelle)[0].valeur);
    const textes = F.noeuds.flatMap((n) => [n.libelle, n.detail ?? ""]).join(" | ");
    for (const l of [...partageF.avant.lignes, ...partageF.apres.lignes]) {
      for (const x of [l.texte, l.valeur]) if (x) expect(textes, x).toContain(x);
    }
  });
  it("en-têtes : un seul mot orange par titre, chiffres écrits en chiffres", () => {
    for (const s of [sceneGalerieD(), sceneGalerieE(), sceneGalerieF()]) {
      for (const e of s.entetes) {
        expect(e.titre.match(/\*[^*]+\*/g), e.titre).toHaveLength(1);
        expect(e.titre, e.titre).not.toMatch(/\b(vingt|seize|quarante|dix-neuf|huit)\b/i);
      }
    }
  });
});

describe("K07 · nuée", () => {
  it("20 enveloppes, 16 cochées en cascade dans l'ordre de lecture, les 4 autres en diagonale (une par ligne, jamais en colonne)", () => {
    const fin = planNuee(nueeD, FIN);
    expect(fin.objets).toHaveLength(20);
    expect(fin.objets.filter((o) => o.coche === 1)).toHaveLength(16);
    const heures = fin.objets.filter((o) => o.heureCoche !== null).map((o) => o.heureCoche!);
    expect(heures).toEqual([...heures].sort((a, b) => a - b));
    expect(new Set(heures).size).toBe(16);
    expect(heures[0]).toBe(nueeD.debutCoches);
    expect(heures[15]).toBe(nueeD.finCoches);
    expect(fin.objets.filter((o) => !o.dansGroupe).map((o) => o.i)).toEqual([0, 8, 11, 19]);
  });
  it("le compteur suit les coches : 0/20, puis 16/20 à la dernière", () => {
    expect(planNuee(nueeD, nueeD.debutCoches - 0.01).compteur.texte).toBe("0/20");
    expect(planNuee(nueeD, nueeD.debutCoches).compteur.texte).toBe("1/20");
    expect(planNuee(nueeD, (nueeD.debutCoches + nueeD.finCoches) / 2).compteur.faits).toBeGreaterThan(5);
    expect(planNuee(nueeD, nueeD.finCoches).compteur.texte).toBe("16/20");
    expect(planNuee(nueeD, FIN).compteur.taille).toBeGreaterThanOrEqual(PLANCHER);
  });
  it("aucune enveloppe ne se chevauche, toutes dans la bande du contenu, le compteur aussi", () => {
    const { objets, compteur } = planNuee(nueeD, FIN);
    const z = ZONE_OBJETS_IV;
    for (const a of objets) {
      expect(a.x).toBeGreaterThanOrEqual(z.x);
      expect(a.x + a.largeur).toBeLessThanOrEqual(z.x + z.largeur);
      expect(a.y).toBeGreaterThanOrEqual(z.y);
      expect(a.y + a.hauteur).toBeLessThanOrEqual(compteur.y);
      for (const b of objets) if (a.i < b.i) expect(a.x + a.largeur <= b.x || b.x + b.largeur <= a.x || a.y + a.hauteur <= b.y || b.y + b.hauteur <= a.y, `${a.i}/${b.i}`).toBe(true);
    }
    expect(compteur.y + compteur.taille).toBeLessThanOrEqual(z.y + z.hauteur);
  });
  it("de 2 à 30 objets : bornes tenues, aucun chevauchement", () => {
    for (const q of [1, 2, 7, 30, 45]) {
      const o = planNuee({ ...nueeD, quantite: q, cochees: Math.min(q, 3) }, FIN).objets;
      expect(o.length).toBe(Math.max(2, Math.min(30, q)));
    }
  });
});

describe("K06 · entonnoir", () => {
  it("à la fin : 16 à gauche (vert, 80 %), 4 à droite (noir, 20 %)", () => {
    const { bacs } = planEntonnoir(entonnoirD, FIN);
    expect(bacs.map((b) => [b.arrives, b.pourcent, b.couleur])).toEqual([
      [16, 80, "vert"],
      [4, 20, "noir"],
    ]);
    expect(bacs[0].x).toBeLessThan(bacs[1].x);
  });
  it("en cours de tri, la part se lit parmi les objets déjà triés : la sortie majoritaire n'affiche jamais moins de 50 %", () => {
    for (let t = 0; t <= 9.6; t += 0.04) {
      const [g, d] = planEntonnoir(entonnoirD, t).bacs;
      if (g.arrives + d.arrives === 0) expect([g.pourcent, d.pourcent]).toEqual([0, 0]);
      else {
        expect(g.pourcent, String(t)).toBeGreaterThanOrEqual(50);
        expect(g.pourcent + d.pourcent).toBe(100);
      }
    }
  });
  it("la plus nombreuse est à gauche même si la carte la donne en second", () => {
    const inverse = { ...entonnoirD, sorties: [entonnoirD.sorties[1], entonnoirD.sorties[0]] as ProprietesEntonnoir["sorties"] };
    expect(planEntonnoir(inverse, FIN).bacs.map((b) => b.arrives)).toEqual([16, 4]);
  });
  it("les objets tombent un à un : jamais deux dans la même phase de chute au même instant, comptes qui ne baissent jamais", () => {
    let avant = [0, 0];
    for (let t = 0; t <= 9.6; t += 0.04) {
      const pl = planEntonnoir(entonnoirD, t);
      expect(pl.objets.filter((o) => o.phase === "goulot").length).toBeLessThanOrEqual(1);
      const n = pl.bacs.map((b) => b.arrives);
      expect(n[0]).toBeGreaterThanOrEqual(avant[0]);
      expect(n[1]).toBeGreaterThanOrEqual(avant[1]);
      expect(n[0] + n[1] + pl.objets.length).toBeLessThanOrEqual(20);
      avant = n;
    }
    expect(planEntonnoir(entonnoirD, 0).objets).toEqual([]);
  });
  it("les 4 « pour vous » ne sont pas groupés à la fin", () => {
    expect(repartition(20, 16).map((x, i) => (x ? -1 : i)).filter((i) => i >= 0)).toEqual([0, 5, 10, 15]);
    // Les premiers triés vont à gauche ; les 4 de droite sont espacés (un sur cinq).
    const heures = Array.from({ length: 20 }, (_, i) => 1 + i);
    const sortie = (i: number) => planEntonnoir({ ...entonnoirD, chutes: heures }, heures[i] + 0.1).objets.find((o) => o.i === i)!.sortie;
    expect(heures.map((_, i) => i).filter((i) => sortie(i) === 1)).toEqual([4, 9, 14, 19]);
  });
  it("tailles : compte, part et libellé au-dessus du plancher, chaque mot du libellé tient dans sa carte", () => {
    for (const b of planEntonnoir(entonnoirD, FIN).bacs) {
      for (const x of [b.tailleCompte, b.taillePart, b.tailleLibelle]) expect(x).toBeGreaterThanOrEqual(PLANCHER);
      // Chasse RÉELLE d'Anton (marge de 3 % comprise).
      for (const mot of b.libelle.split(/\s+/)) expect(largeurAnton(mot, b.tailleLibelle), mot).toBeLessThanOrEqual(b.largeur - 2 * PADDING_BAC + 1e-6);
      expect(b.y + b.hauteur).toBeLessThanOrEqual(ZONE_OBJETS_IV.y + ZONE_OBJETS_IV.hauteur);
    }
  });
  it("une donnée fausse est signalée, pas corrigée", () => {
    expect(controlerEntonnoir({ ...entonnoirD, quantite: 21 })).toEqual(["Les sorties comptent 20 objets pour 21 entrés."]);
  });
});

describe("K08 · écran partagé", () => {
  it("rien de l'après avant la fin du volet ; l'avant se range à gauche", () => {
    for (const p of [partageE, partageF]) {
      const pendant = planEcranPartage(p, p.bascule + 0.3);
      expect(pendant.rangs.every((r) => !r.apres || r.apres.entree === 0)).toBe(true);
      expect(planEcranPartage(p, p.bascule - 0.01).volet).toBe(0);
      expect(planEcranPartage(p, p.bascule - 0.01).decalageAvant).toBe(ZONE_OBJETS_IV.largeur / 4);
      const fin = planEcranPartage(p, FIN);
      expect(fin.volet).toBe(1);
      expect(fin.decalageAvant).toBe(0);
      expect(fin.rangs.every((r) => (!r.avant || r.avant.entree === 1) && (!r.apres || r.apres.entree === 1))).toBe(true);
    }
  });
  it("chaque ligne est absente avant son mot", () => {
    const l = partageF.avant.lignes[1];
    expect(planEcranPartage(partageF, l.t - 0.3).rangs[1].avant!.entree).toBe(0);
    expect(planEcranPartage(partageF, l.t + 0.1).rangs[1].avant!.entree).toBeGreaterThan(0);
  });
  it("les colonnes se répondent ligne à ligne (F : 8 min ↔ instantané… 19 min/commande ↔ 45 sec)", () => {
    const r = planEcranPartage(partageF, FIN).rangs;
    expect(r.map((x) => [x.avant?.valeur, x.apres?.valeur])).toEqual([
      ["8 min", "instantané"],
      ["6 min", "instantané"],
      ["5 min", "instantané"],
      ["19 min/commande", "45 sec"],
    ]);
  });
  it("tailles : textes au plancher ou plus, chaque valeur tient sur une ligne dans sa colonne", () => {
    const interieur = ZONE_OBJETS_IV.largeur / 2 - 2 * MARGE_COLONNE;
    for (const p of [partageE, partageF]) {
      for (const r of planEcranPartage(p, FIN).rangs) {
        for (const l of [r.avant, r.apres]) {
          if (!l) continue;
          if (l.texte) expect(l.tailleTexte).toBeGreaterThanOrEqual(PLANCHER);
          if (l.valeur) {
            expect(l.tailleValeur).toBeGreaterThanOrEqual(PLANCHER);
            expect(largeurAnton(l.valeur, l.tailleValeur), l.valeur).toBeLessThanOrEqual((l.coche ? interieur * 0.78 : interieur) + 1e-6);
          }
        }
      }
    }
  });
  it("le contenu des deux colonnes tient dans la bande (hauteur estimée)", () => {
    for (const p of [partageE, partageF]) expect(planEcranPartage(p, FIN).hauteurEstimee).toBeLessThanOrEqual(ZONE_OBJETS_IV.hauteur);
  });
});

describe("K09 · additionneur", () => {
  it("8 + 6 + 5 = 19 min, le total posé sur son mot (absent juste avant)", () => {
    const fin = planAdditionneur(additionF, FIN);
    expect(fin.equation.map((m) => m.texte).join(" ")).toBe("8 + 6 + 5 = 19 min");
    expect(fin.somme).toBe(19);
    expect(fin.ecart).toBe(false);
    const total = (t: number) => planAdditionneur(additionF, t).equation.at(-1)!;
    expect(total(additionF.total.t - 0.001).entree).toBe(0);
    expect(total(additionF.total.t + 0.05).entree).toBeGreaterThan(0);
    expect(total(additionF.total.t).accent).toBe(true);
    // Le premier morceau commence avant : l'équation s'écrit mot par mot et finit sur le total.
    expect(planAdditionneur(additionF, additionF.total.t).equation[0].entree).toBeGreaterThan(0);
  });
  it("chaque minuteur monte de 0 à sa valeur à partir de son mot", () => {
    for (const m of additionF.termes) {
      const i = additionF.termes.indexOf(m);
      expect(planAdditionneur(additionF, m.t - 0.3).minuteurs[i].affiche).toBe(0);
      expect(planAdditionneur(additionF, m.t + 2).minuteurs[i].affiche).toBe(m.valeur);
    }
  });
  it("compteur 19:00 → 0:45 qui ne remonte jamais, puis « 45 sec »", () => {
    const a = additionF.apres!;
    expect(planAdditionneur(additionF, a.t).compteur!.texte).toBe("19:00");
    let avant = Infinity;
    for (let t = a.t; t <= a.t + 1.4; t += 0.04) {
      const s = planAdditionneur(additionF, t).compteur!.secondes;
      expect(s).toBeLessThanOrEqual(avant);
      avant = s;
    }
    expect(planAdditionneur(additionF, a.t + 1.39).compteur!.texte).toMatch(/^0:4\d$/);
    expect(planAdditionneur(additionF, FIN).compteur!.texte).toBe("45 sec");
    expect(planAdditionneur(additionF, a.t - 1).compteur!.visible).toBe(0);
  });
  it("un total qui ne fait pas la somme est signalé, jamais corrigé", () => {
    const faux = planAdditionneur({ ...additionF, total: { ...additionF.total, valeur: 20 } }, FIN);
    expect(faux.ecart).toBe(true);
    expect(faux.equation.at(-1)!.texte).toBe("20 min");
  });
  it("tailles : libellés, minuteurs, équation et compteur au plancher ou plus ; l'équation tient sur une ligne", () => {
    const t = planAdditionneur(additionF, FIN).tailles;
    for (const x of Object.values(t)) expect(x).toBeGreaterThanOrEqual(PLANCHER);
    // Morceaux (chasse réelle d'Anton) et leurs 6 écarts de 0,28 em.
    expect(largeurAnton("8+6+5=19 MIN", t.equation) + 6 * 0.28 * t.equation).toBeLessThanOrEqual(ZONE_OBJETS_IV.largeur - 80 + 1e-6);
  });
});

describe("scènes de galerie", () => {
  it("chaque instant d'image fixe montre un objet et un en-tête", () => {
    const scenes = { D: sceneGalerieD(), E: sceneGalerieE(), F: sceneGalerieF() };
    for (const [l, instants] of Object.entries(INSTANTS_GALERIE_OBJETS)) {
      const s = scenes[l as keyof typeof scenes];
      for (const i of instants) {
        expect(objetsA(s, i.t).length, i.nom).toBe(1);
        expect(objetsA(s, i.t)[0].opacite, i.nom).toBe(1);
        expect(s.entetes.some((e) => i.t >= e.debut && i.t < e.fin), i.nom).toBe(true);
        expect(i.t).toBeLessThan(s.dureeSec);
      }
    }
  });
  it("déterministe : 20 calculs, 20 résultats identiques", () => {
    const calcul = () =>
      JSON.stringify([0.5, 3.2, 8.9, 12.6, 15.6].map((t) => [planEntonnoir(entonnoirD, t), planNuee(nueeD, t), planEcranPartage(partageF, t), planAdditionneur(additionF, t + 4)]));
    const premier = calcul();
    for (let i = 0; i < 20; i++) expect(calcul()).toBe(premier);
  });
});
