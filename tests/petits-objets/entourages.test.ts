/** C9-07 — entourages : cercle, ovale, double boucle (pièces pures, non inscrites). */
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { DEF_CERCLE, DEF_DOUBLE_BOUCLE, DEF_OVALE, EXEMPLES_ENTOURAGES, cheminDoubleBoucle } from "../../src/briques/motion/petits-objets/entourages";
import { cheminCercleObjet } from "../../src/briques/motion/petits-objets/TraceSvg";
import { verifierDefinition, type DefinitionObjet, type TonObjet } from "../../src/briques/motion/petits-objets/contrat";
import { PALETTE } from "../../src/briques/charte/axion-2026";
import { SURFACE_MAX } from "../../src/briques/motion/petits-objets/contrat";
import { couleurDuTon } from "../../src/briques/motion/petits-objets/tons";
import { IMAGES_SORTIE } from "../../src/briques/motion/petits-objets/progres";

const CHEMIN = new URL("../../src/briques/motion/petits-objets/entourages.tsx", import.meta.url);
const DEFS = [DEF_CERCLE, DEF_OVALE, DEF_DOUBLE_BOUCLE] as unknown as DefinitionObjet<unknown>[];
const TONS: TonObjet[] = ["neutre", "accent", "valide", "erreur"];
const D = 60;
const rendre = (def: DefinitionObjet<unknown>, p: unknown, image: number, ton: TonObjet = "neutre", fond: "ivoire" | "noir" = "noir", graine = 7) =>
  renderToStaticMarkup(def.Rendu({ image, fps: 25, dureeImages: D, fond, ton, graine, parametres: p }));
const BOITE = { x: 20, y: 60, largeur: 30, hauteur: 12 };

const MOTIFS: RegExp[] = [/@\//, /\bzod\b/, /Math\.random/, /remotion/, /from\s+["'][^"']*moteurs\//, /from\s+["'][^"']*-v4/, /VideoAnimeeV4/, /briques-v4/, /faits-script/, /from\s+["'][^"']*\/droits/, /bibliotheque-video/, /src\/domaine|from\s+["'][^"']*\/domaine\//, /from\s+["'][^"']*\/services\//];

describe("C9-07 contrat", () => {
  it("3 objets, ids propres, verifierDefinition ok", () => {
    expect(DEFS.map((d) => d.id)).toEqual(["objet-cercle", "objet-ovale", "objet-double-boucle"]);
    for (const d of DEFS) {
      expect(verifierDefinition(d)).toBe("ok");
      expect(d.famille).toBe("trait");
      expect(d.capacite).toBe("objet.trait");
      expect(d.donnees).toBe("aucune");
    }
  });
  it("valider ne lève jamais et renvoie null sur entrée mauvaise", () => {
    for (const d of DEFS) for (const m of [undefined, null, {}, 5, "un deux trois quatre cinq", { x: 1, y: 1, largeur: -3, hauteur: 4 }, { x: 0, y: 0, largeur: 100, hauteur: 100 }, { x: NaN, y: 0, largeur: 5, hauteur: 5 }])
      expect(d.valider(m)).toBeNull();
  });
  it("valide les exemples", () => {
    for (const [d, ex] of [[DEF_CERCLE, EXEMPLES_ENTOURAGES.cercle], [DEF_OVALE, EXEMPLES_ENTOURAGES.ovale], [DEF_DOUBLE_BOUCLE, EXEMPLES_ENTOURAGES.doubleBoucle]] as const) {
      expect(ex.length).toBeGreaterThan(0);
      for (const e of ex) expect((d as DefinitionObjet<unknown>).valider(e)).not.toBeNull();
    }
  });
});

describe("C9-07 rendu", () => {
  it("même entrée = même balisage", () => {
    for (const d of DEFS) expect(rendre(d, BOITE, 20)).toBe(rendre(d, BOITE, 20));
  });
  it("image 0 : tracé à 0 ; dernière image : opacité 0 ; sortie en 6 images", () => {
    for (const d of DEFS) {
      expect(rendre(d, BOITE, 0)).toContain('stroke-dashoffset="1"');
      expect(rendre(d, BOITE, D - 1)).toMatch(/opacity="0"/);
      const sous = Array.from({ length: D }, (_, i) => i).filter((i) => !/opacity="1"/.test(rendre(d, BOITE, i)) && i > 10);
      expect(sous).toHaveLength(IMAGES_SORTIE);
    }
  });
  it("couleurs de la charte, orange jamais sur ivoire, aucun filtre", () => {
    for (const d of DEFS) for (const fond of ["ivoire", "noir"] as const) for (const ton of TONS) {
      const m = rendre(d, BOITE, 30, ton, fond);
      expect(m).toContain(`stroke="${couleurDuTon(ton, fond)}"`);
      expect(m).not.toMatch(/filter|mask|drop-shadow/i);
      expect(m).not.toMatch(/<text/);
    }
    for (const d of DEFS) for (const ton of TONS) expect(rendre(d, BOITE, 30, ton, "ivoire").toLowerCase()).not.toContain(PALETTE.orange.toLowerCase());
  });
  it("boîte invalide : rendu vide sans exception", () => {
    for (const d of DEFS) expect(() => rendre(d, null, 10)).not.toThrow();
  });
});

describe("C9-07 propres à la fiche", () => {
  const W = 1080, H = 1920;
  it("cercle : d identique à cheminCercleObjet pour 3 boîtes", () => {
    for (const b of [BOITE, { x: 10, y: 50, largeur: 20, hauteur: 20 }, { x: 55, y: 70, largeur: 25, hauteur: 8 }]) {
      const attendu = cheminCercleObjet((b.x * W) / 100, (b.y * H) / 100, (b.largeur * W) / 100, (b.hauteur * H) / 100, 7);
      expect(rendre(DEF_CERCLE as DefinitionObjet<unknown>, b, 30)).toContain(`d="${attendu}"`);
    }
  });
  it("ovale : refuse une boîte quasi carrée, accepte un rapport libre", () => {
    expect(DEF_OVALE.valider({ x: 10, y: 60, largeur: 18, hauteur: 10 })).toBeNull();
    expect(DEF_OVALE.valider(BOITE)).not.toBeNull();
  });
  it("double boucle : plus d'un tour, même graine = même chemin", () => {
    const d = cheminDoubleBoucle(100, 200, 300, 120, 7);
    expect(d).toBe(cheminDoubleBoucle(100, 200, 300, 120, 7));
    expect(d).not.toBe(cheminDoubleBoucle(100, 200, 300, 120, 8));
    const pts = d.replace(/^M /, "").split(" L ").map((s) => s.split(",").map(Number));
    const cx = 100 + 150, cy = 200 + 60;
    let cumul = 0, prec = Math.atan2(pts[0][1] - cy, pts[0][0] - cx);
    for (const [x, y] of pts.slice(1)) {
      const a = Math.atan2(y - cy, x - cx);
      let da = a - prec;
      while (da > Math.PI) da -= 2 * Math.PI;
      while (da < -Math.PI) da += 2 * Math.PI;
      cumul += da;
      prec = a;
    }
    expect(Math.abs(cumul)).toBeGreaterThan(2 * Math.PI);
    expect((rendre(DEF_DOUBLE_BOUCLE as DefinitionObjet<unknown>, BOITE, 30).match(/<path/g) ?? []).length).toBe(1);
  });
});

describe("C9-07 encombrement", () => {
  /** Boîtes à la limite acceptée (surface boîte = plafond), une par objet. */
  const LIMITES: [DefinitionObjet<unknown>, { x: number; y: number; largeur: number; hauteur: number }][] = [
    [DEF_CERCLE as DefinitionObjet<unknown>, { x: 20, y: 20, largeur: 60, hauteur: 60 }],
    [DEF_OVALE as DefinitionObjet<unknown>, { x: 2, y: 30, largeur: 96, hauteur: 37.5 }],
    [DEF_DOUBLE_BOUCLE as DefinitionObjet<unknown>, { x: 20, y: 20, largeur: 60, hauteur: 60 }],
  ];
  it("boîte à la limite : le tracé reste sous SURFACE_MAX du cadre", () => {
    for (const [d, b] of LIMITES) {
      expect(d.valider(b)).not.toBeNull();
      const dd = /d="([^"]+)"/.exec(rendre(d, b, 30))![1];
      const pts = dd.replace(/^M /, "").split(" L ").map((s) => s.split(",").map(Number));
      const xs = pts.map((q) => q[0]), ys = pts.map((q) => q[1]);
      const surface = ((Math.max(...xs) - Math.min(...xs)) * (Math.max(...ys) - Math.min(...ys))) / (1080 * 1920);
      expect(surface).toBeLessThanOrEqual(SURFACE_MAX);
    }
  });
});

describe("C9-07 garde statique du fichier", () => {
  const texte = readFileSync(CHEMIN, "utf8");
  it("aucun motif interdit", () => { for (const re of MOTIFS) expect(re.test(texte)).toBe(false); });
  it("aucun littéral de courbe ni couleur", () => {
    expect(texte).not.toMatch(/cubic-bezier|Easing\.bezier|damping|stiffness|\bmass\b/);
    expect(texte).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
  });
  it("non inscrit : rien ne l'importe", () => {
    for (const f of ["index.ts"]) expect(readFileSync(new URL(`../../src/briques/motion/petits-objets/${f}`, import.meta.url), "utf8")).not.toMatch(/entourages/);
  });
  void createElement;
});
