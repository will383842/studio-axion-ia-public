/** C9-10 — cadres : rectangle, quatre coins (viseur), cadre de passage (pièces pures, non inscrites). */
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { DEF_CADRE_RECTANGLE, DEF_CADRE_COINS, DEF_CADRE_PASSAGE, EXEMPLES_CADRES } from "../../src/briques/motion/petits-objets/cadres";
import { verifierDefinition, type DefinitionObjet, type TonObjet } from "../../src/briques/motion/petits-objets/contrat";
import { PALETTE } from "../../src/briques/charte/axion-2026";
import { couleurDuTon } from "../../src/briques/motion/petits-objets/tons";
import { IMAGES_SORTIE } from "../../src/briques/motion/petits-objets/progres";

const CHEMIN = new URL("../../src/briques/motion/petits-objets/cadres.tsx", import.meta.url);
const DEFS = [DEF_CADRE_RECTANGLE, DEF_CADRE_COINS, DEF_CADRE_PASSAGE] as unknown as DefinitionObjet<unknown>[];
const TONS: TonObjet[] = ["neutre", "accent", "valide", "erreur"];
const D = 60;
const rendre = (def: DefinitionObjet<unknown>, p: unknown, image: number, ton: TonObjet = "neutre", fond: "ivoire" | "noir" = "noir", graine = 7) =>
  renderToStaticMarkup(def.Rendu({ image, fps: 25, dureeImages: D, fond, ton, graine, parametres: p }));
const BOITE = { x: 20, y: 60, largeur: 30, hauteur: 12 };
const VERS = { x: 55, y: 20, largeur: 25, hauteur: 15 };
const entree = (d: DefinitionObjet<unknown>) => (d === (DEF_CADRE_PASSAGE as unknown) ? { ...BOITE, vers: VERS } : BOITE);

const MOTIFS: RegExp[] = [/@\//, /\bzod\b/, /Math\.random/, /remotion/, /from\s+["'][^"']*moteurs\//, /from\s+["'][^"']*-v4/, /VideoAnimeeV4/, /briques-v4/, /faits-script/, /from\s+["'][^"']*\/droits/, /bibliotheque-video/, /src\/domaine|from\s+["'][^"']*\/domaine\//, /from\s+["'][^"']*\/services\//];

describe("C9-10 contrat", () => {
  it("3 objets, ids propres, verifierDefinition ok", () => {
    expect(DEFS.map((d) => d.id)).toEqual(["objet-cadre-rectangle", "objet-cadre-coins", "objet-cadre-passage"]);
    for (const d of DEFS) {
      expect(verifierDefinition(d)).toBe("ok");
      expect(d.famille).toBe("trait");
      expect(d.capacite).toBe("objet.trait");
      expect(d.donnees).toBe("aucune");
    }
  });
  it("valider ne lève jamais et renvoie null sur entrée mauvaise", () => {
    for (const d of DEFS) for (const m of [undefined, null, {}, 5, "un deux trois quatre cinq", { x: 1, y: 1, largeur: -3, hauteur: 4 }, { x: NaN, y: 0, largeur: 5, hauteur: 5 }])
      expect(d.valider(m)).toBeNull();
  });
  it("boîte de 70 % de surface → null", () => {
    const grosse = { x: 5, y: 0, largeur: 70, hauteur: 100 };
    expect((grosse.largeur * grosse.hauteur) / 10000).toBeGreaterThanOrEqual(0.7);
    for (const d of DEFS) expect(d.valider(entree(d) === BOITE ? grosse : { ...grosse, vers: VERS })).toBeNull();
    expect(DEF_CADRE_PASSAGE.valider({ ...BOITE, vers: { x: 5, y: 5, largeur: 80, hauteur: 80 } })).toBeNull();
  });
  it("passage : refuse une 2e boîte absente", () => {
    expect(DEF_CADRE_PASSAGE.valider(BOITE)).toBeNull();
  });
  it("valide les exemples", () => {
    for (const [d, ex] of [[DEF_CADRE_RECTANGLE, EXEMPLES_CADRES.rectangle], [DEF_CADRE_COINS, EXEMPLES_CADRES.coins], [DEF_CADRE_PASSAGE, EXEMPLES_CADRES.passage]] as const) {
      expect(ex.length).toBeGreaterThan(0);
      for (const e of ex) expect((d as DefinitionObjet<unknown>).valider(e)).not.toBeNull();
    }
  });
});

describe("C9-10 rendu", () => {
  it("même entrée = même balisage", () => {
    for (const d of DEFS) expect(rendre(d, entree(d), 20)).toBe(rendre(d, entree(d), 20));
  });
  it("image 0 : tracé à 0 ; dernière image : opacité 0 ; sortie en 6 images", () => {
    for (const d of DEFS) {
      expect(rendre(d, entree(d), 0)).toContain('stroke-dashoffset="1"');
      expect(rendre(d, entree(d), D - 1)).toMatch(/opacity="0"/);
      const sous = Array.from({ length: D }, (_, i) => i).filter((i) => !/opacity="1"/.test(rendre(d, entree(d), i)) && i > 10);
      expect(sous).toHaveLength(IMAGES_SORTIE);
    }
  });
  it("couleurs de la charte, orange jamais sur ivoire, aucun filtre ni texte", () => {
    for (const d of DEFS) for (const fond of ["ivoire", "noir"] as const) for (const ton of TONS) {
      const m = rendre(d, entree(d), 30, ton, fond);
      expect(m).toContain(`stroke="${couleurDuTon(ton, fond)}"`);
      expect(m).not.toMatch(/filter|mask|drop-shadow/i);
      expect(m).not.toMatch(/<text/);
    }
    for (const d of DEFS) for (const ton of TONS) expect(rendre(d, entree(d), 30, ton, "ivoire").toLowerCase()).not.toContain(PALETTE.orange.toLowerCase());
  });
  it("boîte invalide : rendu vide sans exception", () => {
    for (const d of DEFS) expect(() => rendre(d, null, 10)).not.toThrow();
  });
});

describe("C9-10 propres à la fiche", () => {
  const W = 1080, H = 1920;
  const sousChemins = (m: string) => [...m.matchAll(/ d="([^"]+)"/g)].reduce((n, r) => n + (r[1].match(/M/g) ?? []).length, 0);
  it("rectangle : un chemin fermé aux coins arrondis (Q ou A)", () => {
    const m = rendre(DEF_CADRE_RECTANGLE as DefinitionObjet<unknown>, BOITE, 30);
    expect((m.match(/<path/g) ?? []).length).toBe(1);
    expect(sousChemins(m)).toBe(1);
    expect(m).toMatch(/d="[^"]*[QA]/);
  });
  it("coins : 4 sous-chemins, tous à t = 1 en tenue", () => {
    const m = rendre(DEF_CADRE_COINS as DefinitionObjet<unknown>, BOITE, 30);
    expect(sousChemins(m)).toBe(4);
    expect(m).toContain('stroke-dashoffset="0"');
    expect(m).not.toContain('stroke-dashoffset="1"');
    expect(rendre(DEF_CADRE_COINS as DefinitionObjet<unknown>, BOITE, 0)).toContain('stroke-dashoffset="1"');
  });
  const boite = (m: string) => {
    const pts = [...(/d="([^"]+)"/.exec(m)![1].matchAll(/(-?\d+(?:\.\d+)?)[ ,](-?\d+(?:\.\d+)?)/g))].map((r) => [Number(r[1]), Number(r[2])]);
    const xs = pts.map((q) => q[0]), ys = pts.map((q) => q[1]);
    return { x: Math.min(...xs), y: Math.min(...ys), x2: Math.max(...xs), y2: Math.max(...ys) };
  };
  it("passage : position finale = 2e boîte à la dernière image de tenue", () => {
    const d = DEF_CADRE_PASSAGE as DefinitionObjet<unknown>;
    const tenue = D - 1 - IMAGES_SORTIE;
    const b = boite(rendre(d, entree(d), tenue));
    expect(b.x).toBeCloseTo((VERS.x * W) / 100, 0);
    expect(b.y).toBeCloseTo((VERS.y * H) / 100, 0);
    expect(b.x2).toBeCloseTo(((VERS.x + VERS.largeur) * W) / 100, 0);
    expect(b.y2).toBeCloseTo(((VERS.y + VERS.hauteur) * H) / 100, 0);
  });
  it("passage : au départ, sur la 1re boîte ; puis il glisse", () => {
    const d = DEF_CADRE_PASSAGE as DefinitionObjet<unknown>;
    const b0 = boite(rendre(d, entree(d), 2));
    expect(b0.x).toBeCloseTo((BOITE.x * W) / 100, 0);
    const bm = boite(rendre(d, entree(d), 16));
    expect(bm.x).toBeGreaterThan(b0.x);
    expect(bm.x).toBeLessThan((VERS.x * W) / 100);
  });
});

describe("C9-10 garde statique du fichier", () => {
  const texte = readFileSync(CHEMIN, "utf8");
  it("aucun motif interdit", () => { for (const re of MOTIFS) expect(re.test(texte)).toBe(false); });
  it("aucun littéral de courbe ni couleur", () => {
    expect(texte).not.toMatch(/cubic-bezier|Easing\.bezier|damping|stiffness|\bmass\b/);
    expect(texte).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
  });
  it("non inscrit : rien ne l'importe", () => {
    expect(readFileSync(new URL("../../src/briques/motion/petits-objets/index.ts", import.meta.url), "utf8")).not.toMatch(/cadres/);
  });
});
