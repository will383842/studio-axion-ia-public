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
  etatDansCadre,
  MARGE_CADRE,
  mesurerBoite,
  posePour,
  posesDesMots,
  ECRAN_IV,
  type ProprietesSceneIV,
  type SchemaEntree,
} from "@/briques/schema-motion";
import { INSTANTS_GALERIE_C, sceneGalerieC } from "../../studio-rendu/compositions/image-video/donnees-galerie";
import { cadrageDeToile, calculerScene, etatNoeud } from "../../studio-rendu/compositions/image-video/plan";
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
