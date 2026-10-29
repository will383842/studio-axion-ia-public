/**
 * Cadrage propre (exigence de la direction) : tout nœud (ou pastille de part) dont le texte est visible est ENTIER dans
 * le cadre avec une marge ≥ 4 % de la largeur, ou entièrement hors cadre — jamais coupé par un bord. La caméra se décale
 * puis élargit (zoom ≥ 0,8) ; si c'est impossible, la disposition répartit autrement. Et l'étape précédente d'une
 * branche reste visible, atténuée, quand la caméra avance.
 *
 * Contrôlé à chaque instant clé (images clés de la caméra, mots, apparitions) sur les cartes A-F et le schéma de
 * 16 nœuds, dans les conditions de la prod (en-tête, pastilles de part, décors des nœuds), puis sur la galerie.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import type { CarteImage } from "@/domaine/image-video/carte";
import {
  BORNES_CAMERA,
  cameraA,
  controlerCadrage,
  disposerEtCadrer,
  disposerToile,
  emprise,
  etatDansCadre,
  MARGE_CADRE,
  mesurerBoite,
  trajectoireCamera,
  posePour,
  posesDesMots,
  ECRAN_IV,
  type DispositionToile,
  type ProprietesSceneIV,
  type SchemaEntree,
} from "@/briques/schema-motion";
import { INSTANTS_GALERIE_C, sceneGalerieC } from "../../studio-rendu/compositions/image-video/donnees-galerie";
import { cadrageDeToile, calculerScene, etatNoeud, noeudCourant, opaciteCadre } from "../../studio-rendu/compositions/image-video/plan";
import { motsSimules } from "./mots-simules";

const DOSSIER = join(process.cwd(), "tests/image-video/fixtures/cartes");
const lire = (nom: string): CarteImage => JSON.parse(readFileSync(join(DOSSIER, `${nom}.json`), "utf8"));
const CARTES = ["A", "B", "C", "D", "E", "F", "faux-16-noeuds"] as const;
const L = ECRAN_IV.largeur;

/** Scène comme en prod : un en-tête tout du long, séparation 1,5 s après le mot de la décision, pastilles de part. */
function sceneDe(carte: CarteImage): ProprietesSceneIV {
  const mots = motsSimules(carte);
  const dureeSec = mots[mots.length - 1].t + 3;
  const decision = carte.noeuds.find((n) => n.role === "decision");
  const motDecision = decision ? mots.find((m) => m.noeud === decision.id) : undefined;
  return {
    largeur: 1080,
    hauteur: 1920,
    fps: 25,
    dureeSec,
    fond: "ivoire",
    marque: "axion-ia.com",
    schema: carte as unknown as SchemaEntree,
    mots,
    separations: motDecision ? [{ noeud: motDecision.noeud, t: motDecision.t + 1.5 }] : [],
    coches: [],
    entetes: [{ debut: 0, fin: dureeSec, etiquette: "Situation type", titre: "Un *titre.*" }],
  };
}

describe("état d'un rectangle dans le cadre", () => {
  const pose = { cx: L / 2, cy: ECRAN_IV.hauteur / 2, zoom: 1 };
  const m = MARGE_CADRE * L;
  it("entier avec la marge, hors cadre, ou coupé (bord gauche, bord droit, marge rognée, bord bas)", () => {
    expect(etatDansCadre({ x: m, y: 500, largeur: 400, hauteur: 200 }, pose)).toBe("entier");
    expect(etatDansCadre({ x: -400, y: 500, largeur: 400, hauteur: 200 }, pose)).toBe("hors");
    expect(etatDansCadre({ x: -100, y: 500, largeur: 400, hauteur: 200 }, pose)).toBe("coupe");
    expect(etatDansCadre({ x: L - 300, y: 500, largeur: 400, hauteur: 200 }, pose)).toBe("coupe");
    expect(etatDansCadre({ x: m - 1, y: 500, largeur: 400, hauteur: 200 }, pose)).toBe("coupe");
    expect(etatDansCadre({ x: 300, y: 1800, largeur: 400, hauteur: 200 }, pose)).toBe("coupe");
    expect(etatDansCadre({ x: 300, y: 1920, largeur: 400, hauteur: 200 }, pose)).toBe("hors");
  });
  it("sous un en-tête : caché au-dessus du fondu, coupé s'il chevauche la ligne du cadre", () => {
    const c = { cadre: { haut: 0.275, bas: 1 } };
    expect(etatDansCadre({ x: 300, y: 200, largeur: 400, hauteur: 250 }, pose, c)).toBe("hors");
    expect(etatDansCadre({ x: 300, y: 450, largeur: 400, hauteur: 200 }, pose, c)).toBe("coupe");
    expect(etatDansCadre({ x: 300, y: 0.275 * 1920 + m, largeur: 400, hauteur: 200 }, pose, c)).toBe("entier");
  });
});

describe("le contrôle repère le défaut d'origine", () => {
  it("caméra centrée sur la décision au retour (ancienne trajectoire) : des blocs de la branche A sont coupés", () => {
    const p = sceneGalerieC();
    const toile = disposerToile(p.schema);
    const n02 = toile.boites.find((b) => b.id === "n02")!;
    const pose = { ...posePour(n02), zoom: 1 };
    const traj = { images: [{ t: 0, ...pose }, { t: p.dureeSec, ...pose }] };
    const defauts = controlerCadrage(toile, traj, p.mots, cadrageDeToile(toile, p), [12.3]);
    expect(defauts.map((d) => d.id)).toContain("n03");
  });
});

for (const nom of CARTES) {
  describe(`carte ${nom} : aucun nœud lisible coupé`, () => {
    const p = sceneDe(lire(nom));
    const s = calculerScene(p);

    it("conditions de prod (en-tête, pastilles, décors) : aucun défaut à aucun instant clé, aucun mot sans cadrage propre", () => {
      expect(controlerCadrage(s.toile, s.trajectoire, s.mots, s.cadrage)).toEqual([]);
      expect(s.trajectoire.alertes.filter((a) => a.includes("aucun cadrage"))).toEqual([]);
    });

    it("toute pose tenue entre deux mouvements est propre (contrôle échantillonné à 10 images/s pendant les maintiens)", () => {
      const im = s.trajectoire.images;
      const instants: number[] = [];
      for (let i = 1; i < im.length; i++) {
        const tenue = im[i].cx === im[i - 1].cx && im[i].cy === im[i - 1].cy && im[i].zoom === im[i - 1].zoom;
        if (tenue) for (let t = im[i - 1].t; t <= im[i].t; t += 0.1) instants.push(t);
      }
      expect(controlerCadrage(s.toile, s.trajectoire, s.mots, s.cadrage, instants)).toEqual([]);
    });

    it("même résultat à chaque appel (20 fois)", () => {
      for (let i = 0; i < 20; i++) expect(calculerScene(p).trajectoire).toEqual(s.trajectoire);
    });
  });
}

// Sans en-tête (cadrage par défaut de la brique, tout l'écran). A est exclue : ses blocs de bénéfices, sans flèche, sont
// trop hauts pour cacher le bloc d'au-dessus hors de l'écran ; en prod un en-tête est toujours posé (test ci-dessus).
for (const nom of ["B", "C", "D", "E", "F", "faux-16-noeuds"] as const) {
  it(`carte ${nom}, brique seule sans en-tête : aucun nœud lisible coupé`, () => {
    const carte = lire(nom);
    const mots = motsSimules(carte);
    const r = disposerEtCadrer(carte as unknown as SchemaEntree, mots, mots[mots.length - 1].t + 3);
    expect(r.defauts).toEqual([]);
  });
}

describe("disposition de repli", () => {
  it("C sous en-tête : la disposition normale coupe un bloc ; la variante retenue n'en coupe aucun", () => {
    const p = sceneGalerieC();
    const toile = disposerToile(p.schema);
    const cadrage = cadrageDeToile(toile, p);
    const r = disposerEtCadrer(p.schema, p.mots, p.dureeSec, (t) => cadrageDeToile(t, p));
    expect(r.variante).not.toBe("normale");
    expect(r.defauts).toEqual([]);
    expect(posesDesMots(toile, p.mots, p.dureeSec, cadrage).some((x) => !x.propre)).toBe(true);
  });
  it("une boîte n'est jamais plus étroite que son mot le plus long (aucun texte qui déborde de sa carte)", () => {
    const b = mesurerBoite({ libelle: "Anticonstitutionnellement" }, 300);
    expect(b.largeur).toBeGreaterThan(300);
  });
});

describe("galerie de l'image C", () => {
  const p = sceneGalerieC();
  const s = calculerScene(p);

  it("chaque image fixe tombe sur une caméra au repos, sans aucun bloc coupé", () => {
    for (const i of INSTANTS_GALERIE_C) {
      const a = cameraA(s.trajectoire, i.t - 0.05);
      const b = cameraA(s.trajectoire, i.t + 0.05);
      expect([a.cx, a.cy, a.zoom], i.nom).toEqual([b.cx, b.cy, b.zoom]);
      expect(controlerCadrage(s.toile, s.trajectoire, s.mots, s.cadrage, [i.t]), i.nom).toEqual([]);
    }
  });

  it("branche 80 % : l'étape précédente reste entière dans le cadre quand elle y tient avec le bloc parlé (4 sec → ticket → résolu), jamais coupée", () => {
    const parId = new Map(s.toile.boites.map((b) => [b.id, b]));
    // Place du cadre sous l'en-tête jusqu'au bas de la bande (au-dessus des sous-titres), au zoom le plus faible permis.
    const marge = MARGE_CADRE * ECRAN_IV.largeur;
    const place = ((s.cadrage.bande!.bas - s.cadrage.cadre!.haut) * ECRAN_IV.hauteur - marge) / BORNES_CAMERA.zoomMin;
    let tenus = 0;
    for (const [precedent, courant] of [
      ["n03", "n04"],
      ["n04", "n05"],
      ["n05", "n06"],
    ] as const) {
      const t = s.mots.find((m) => m.noeud === courant)!.t;
      const pose = cameraA(s.trajectoire, t);
      const a = parId.get(precedent)!;
      const b = parId.get(courant)!;
      const tient = Math.max(a.y + a.hauteur, b.y + b.hauteur) - Math.min(a.y, b.y) <= place;
      const etat = etatDansCadre(a, pose, s.cadrage);
      // Sous-titres remontés (0,60-0,67) : deux blocs hauts empilés ne tiennent plus ensemble au zoom 0,8 ; l'étape
      // précédente sort alors ENTIÈRE du cadre, jamais coupée.
      if (tient) tenus++;
      expect(etat, `${precedent} au mot de ${courant}`).toBe(tient ? "entier" : "hors");
      expect(etatNoeud(s, precedent, t).etat).toBe("vu");
    }
    expect(tenus).toBeGreaterThanOrEqual(2);
    const t3 = INSTANTS_GALERIE_C.find((i) => i.nom === "3-branche-a")!.t;
    expect(etatDansCadre(parId.get("n05")!, cameraA(s.trajectoire, t3), s.cadrage)).not.toBe("coupe");
  });
});

describe("filet : jamais un bloc coupé à l'écran (opaciteCadre)", () => {
  const p = sceneGalerieC();
  const s = calculerScene(p);
  const premier = s.mots[0].noeud;
  const dernierBloc = s.mots[s.mots.length - 1].noeud;
  const boite = (id: string) => s.parId.get(id)!;
  /** Panoramique : le bloc est hors cadre à gauche à t = 1, entier à t = 3 (pose propre du bloc), la caméra glisse entre les deux. */
  const poseEntier = posePour(boite(dernierBloc), s.cadrage);
  const poseHors = { ...poseEntier, cx: poseEntier.cx + 2 * L };
  const panoramique = [
    { t: 0, ...poseHors },
    { t: 1, ...poseHors },
    { t: 3, ...poseEntier },
    { t: 6, ...poseEntier },
  ];
  const instants = Array.from({ length: 121 }, (_, i) => i * 0.05);

  it("préconditions : le bloc est hors cadre à la première pose, entier à la seconde, et n'est pas le bloc parlé pendant le mouvement", () => {
    expect(etatDansCadre(emprise(boite(dernierBloc), s.cadrage), poseHors, s.cadrage)).toBe("hors");
    expect(etatDansCadre(emprise(boite(dernierBloc), s.cadrage), poseEntier, s.cadrage)).toBe("entier");
    for (const t of instants) expect(noeudCourant(s, t), `t=${t}`).not.toBe(dernierBloc);
  });

  it("un bloc qui traverse un bord pendant un panoramique : opacité 0 au milieu du mouvement, 1 aux poses", () => {
    const op = instants.map((t) => opaciteCadre(s, panoramique, dernierBloc, t));
    // Aux poses (avant le départ, après l'arrivée et 0,15 s de lissage) : plein.
    instants.forEach((t, i) => {
      if (t <= 1 || t >= 3.15) expect(op[i], `t=${t}`).toBe(1);
    });
    // Au milieu du mouvement, le bloc est coupé par le bord : caché.
    expect(op.some((o) => o === 0)).toBe(true);
    for (const o of op) {
      expect(o).toBeGreaterThanOrEqual(0);
      expect(o).toBeLessThanOrEqual(1);
    }
    // Chaque instant où le bloc est vu coupé à l'écran est déjà en fondu (au plus 3/4 : le lissage compte 4 instants).
    instants.forEach((t, i) => {
      if (etatDansCadre(emprise(boite(dernierBloc), s.cadrage), cameraA({ images: panoramique }, t), s.cadrage) === "coupe") expect(op[i], `t=${t}`).toBeLessThan(1);
    });
  });

  it("le bloc parlé n'est jamais caché, même coupé", () => {
    const m = s.mots[0].t;
    const b = boite(premier);
    const coupe = { t: 0, cx: b.x + L / 2 + 100, cy: b.y + b.hauteur / 2, zoom: 1 };
    const images = [coupe, { ...coupe, t: 30 }];
    expect(etatDansCadre(emprise(b, s.cadrage), cameraA({ images }, m), s.cadrage)).toBe("coupe");
    expect(noeudCourant(s, m)).toBe(premier);
    expect(opaciteCadre(s, images, premier, m)).toBe(1);
    // Avant son mot, le même bloc coupé (non parlé) est caché.
    expect(opaciteCadre(s, images, premier, 0.1)).toBe(0);
  });

  it("une pastille de part est filtrée comme un bloc ; un identifiant inconnu reste plein", () => {
    const e = s.cadrage.etiquettes!.find((x) => x.id.startsWith("part-"));
    expect(e).toBeDefined();
    const centre = { t: 0, cx: e!.x + L / 2 + 50, cy: e!.y + e!.hauteur / 2, zoom: 1 };
    const images = [centre, { ...centre, t: 30 }];
    expect(etatDansCadre(e!, cameraA({ images }, 20), s.cadrage)).toBe("coupe");
    expect(opaciteCadre(s, images, e!.id, 20)).toBe(0);
    expect(opaciteCadre(s, images, "inconnu", 20)).toBe(1);
  });

  it("sur la trajectoire propre de la scène, aucun bloc n'est jamais caché aux poses tenues (9:16 inchangé)", () => {
    const im = s.trajectoire.images;
    for (let i = 1; i < im.length; i++) {
      const tenue = im[i].cx === im[i - 1].cx && im[i].cy === im[i - 1].cy && im[i].zoom === im[i - 1].zoom;
      if (!tenue) continue;
      for (const b of s.toile.boites) {
        const t = im[i].t;
        if (etatDansCadre(emprise(b, s.cadrage), cameraA(s.trajectoire, t), s.cadrage) !== "coupe") expect(opaciteCadre(s, im, b.id, t), `${b.id} t=${t}`).toBeGreaterThan(0);
      }
    }
  });
});

describe("filet : repli à coupe franche de disposerEtCadrer", () => {
  it("C sous en-tête, mots resserrés (0,7 s) : le retard que le moteur absorbe passe avant ; le reste est réparé par la coupe franche, qui a moins de défauts", () => {
    const p = sceneGalerieC();
    let mots = p.mots.map((m, i) => ({ ...m, t: 0.4 + i * 0.7 }));
    const cadragePour = (t: DispositionToile) => cadrageDeToile(t, p);
    // Comme `mettreEnSceneIV` : un retard de caméra d'au plus 0,6 s décale le mot du bloc, puis on recalcule.
    let r = disposerEtCadrer(p.schema, mots, p.dureeSec, cadragePour);
    for (let tour = 0; tour < 6; tour++) {
      const retards = r.trajectoire.alertes.flatMap((a) => {
        const m = /arrive sur (\S+) ([\d.]+) s trop tard/.exec(a);
        return m && Number(m[2]) + 0.05 <= 0.6 ? [{ noeud: m[1], retard: Number(m[2]) + 0.05 }] : [];
      });
      if (retards.length === 0) break;
      for (const { noeud, retard } of retards) {
        const k = mots.findIndex((x) => x.noeud === noeud);
        mots = mots.map((x, i) => (i === k ? { ...x, t: Math.round((x.t + retard) * 1000) / 1000 } : x));
      }
      mots = [...mots].sort((a, b) => a.t - b.t || a.noeud.localeCompare(b.noeud));
      r = disposerEtCadrer(p.schema, mots, p.dureeSec, cadragePour);
    }
    // Référence : la même toile, la même caméra, sans coupe franche.
    const cadrage = cadragePour(r.toile);
    const defautsSans = controlerCadrage(r.toile, trajectoireCamera(r.toile, mots, p.dureeSec, cadrage), mots, cadrage);
    expect(defautsSans.length).toBeGreaterThan(0);
    expect(r.cadrage.coupeFranche).toBe(true);
    expect(r.defauts.length).toBeLessThan(defautsSans.length);
    // La coupe franche ne change pas la disposition retenue.
    expect(r.variante).toBe(disposerEtCadrer(p.schema, mots, p.dureeSec, cadragePour).variante);
  });

  it("une disposition sans défaut n'est jamais touchée (aucune coupe franche)", () => {
    const p = sceneGalerieC();
    const r = disposerEtCadrer(p.schema, p.mots, p.dureeSec, (t) => cadrageDeToile(t, p));
    expect(r.defauts).toEqual([]);
    expect(r.cadrage.coupeFranche).toBeUndefined();
  });
});
