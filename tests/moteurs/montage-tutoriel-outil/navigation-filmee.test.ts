import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  ZOOM_NAVIGATION_MAX,
  cameraA,
  curseurA,
  lireNavigationFilmee,
  placementFilm,
  planCacheLeFilm,
  plagesFixesSortie,
  projecteurA,
  surbrillanceA,
  versEcran,
  voletA,
  type NavigationFilmee,
} from "../../../src/briques/plan-scenes/tutoriel/navigation-filmee";

const F45 = { largeur: 1080, hauteur: 1350 };
const F916 = { largeur: 1080, hauteur: 1920 };
const F11 = { largeur: 1080, hauteur: 1080 };

function base(plus: Partial<NavigationFilmee> = {}): NavigationFilmee {
  return {
    version: "navigation-filmee.v1",
    videoCle: "studio/test/film.mp4",
    maquette: "tableau",
    largeur: 1080,
    hauteur: 1350,
    debutFilmMs: 400,
    dureeVoixMs: 20000,
    cibles: [
      { etapeId: "e1", zonePct: { x: 10, y: 10, largeur: 30, hauteur: 12 }, instantMs: 4000, finMs: 6000 },
      { etapeId: "e2", zonePct: { x: 60, y: 50, largeur: 30, hauteur: 12 }, instantMs: 9000, finMs: 11000 },
      { etapeId: "e3", zonePct: { x: 40, y: 80, largeur: 50, hauteur: 15 }, instantMs: 14000, finMs: 16000 },
    ],
    ...plus,
  };
}

describe("lireNavigationFilmee", () => {
  it("accepte un film .mp4 (03b) et un .webm (anciens films)", () => {
    expect(lireNavigationFilmee(base()).ok).toBe(true);
    expect(lireNavigationFilmee(base({ videoCle: "a/film.webm" })).ok).toBe(true);
  });
  it("refuse .mov, sans extension, mauvaise version, zone hors 0-100, instants non croissants", () => {
    const refus = (n: unknown) => expect(lireNavigationFilmee(n).ok).toBe(false);
    refus(base({ videoCle: "a/film.mov" }));
    refus(base({ videoCle: "a/film" }));
    refus({ ...base(), version: "navigation-filmee.v2" });
    const c = base().cibles;
    refus(base({ cibles: [{ ...c[0], zonePct: { x: 90, y: 10, largeur: 30, hauteur: 12 } }] }));
    refus(base({ cibles: [{ ...c[0], zonePct: { x: -1, y: 10, largeur: 30, hauteur: 12 } }] }));
    refus(base({ cibles: [c[1], c[0]] }));
    refus(base({ cibles: [{ ...c[0], finMs: 3000 }] }));
    refus(base({ cibles: [{ ...c[0], finMs: 25000 }] }));
    refus(base({ debutFilmMs: -1 }));
    refus(base({ cibles: [] }));
    refus(base({ cibles: Array.from({ length: 10 }, (_, i) => ({ etapeId: `e${i}`, instantMs: i * 1000, finMs: i * 1000 + 500 })) }));
    refus(base({ largeur: Number.NaN }));
  });
  it("accepte 9 cibles et ne lève jamais sur null, tableau ou chaîne", () => {
    expect(lireNavigationFilmee(base({ cibles: Array.from({ length: 9 }, (_, i) => ({ etapeId: `e${i}`, instantMs: i * 1000, finMs: i * 1000 + 500 })) })).ok).toBe(true);
    for (const v of [null, [], "x", 3, undefined, {}]) expect(lireNavigationFilmee(v).ok).toBe(false);
  });
});

describe("placementFilm", () => {
  it("plein cadre en 4:5", () => {
    expect(placementFilm(base(), F45)).toMatchObject({ x: 0, y: 0, largeur: 1080, hauteur: 1350 });
  });
  it("bandes ivoire haut et bas en 9:16, rien de rogné", () => {
    const p = placementFilm(base(), F916);
    expect(p.largeur).toBe(1080);
    expect(p.hauteur).toBe(1350);
    expect(p.y).toBe(285);
  });
  it("1:1 : la page tient en hauteur, bandes à gauche et à droite", () => {
    const p = placementFilm(base(), F11);
    expect(p.hauteur).toBeCloseTo(1080);
    expect(p.largeur).toBeCloseTo(864);
    expect(p.x).toBeCloseTo(108);
  });
});

describe("cameraA", () => {
  // T-EXT-44 : la caméra arrive 250 ms AVANT le mot (au lieu de partir 150 ms après le clic) et ne zoome jamais dans les 400 premières ms.
  it("vaut 1 pendant les 400 premières ms et revient à 1 après la fin", () => {
    expect(cameraA(base(), 0, F45).echelle).toBe(1);
    expect(cameraA(base(), 400, F45).echelle).toBe(1);
    expect(cameraA(base(), 16000 + 3000, F45).echelle).toBe(1);
  });
  it("ne dépasse jamais 1,6 et zoome sur une petite zone", () => {
    for (let t = 0; t <= 18000; t += 40) expect(cameraA(base(), t, F45).echelle).toBeLessThanOrEqual(ZOOM_NAVIGATION_MAX + 1e-9);
    expect(cameraA(base(), 4000, F45).echelle).toBeCloseTo(ZOOM_NAVIGATION_MAX);
  });
  it("monte sans saut d'une image à l'autre (écart < 0,05 à 25 i/s) pour une zone moyenne", () => {
    const nav = base({ cibles: [{ etapeId: "e1", zonePct: { x: 20, y: 20, largeur: 60, hauteur: 20 }, instantMs: 4000, finMs: 8000 }] });
    const pleine = cameraA(nav, 6000, F45).echelle;
    expect(pleine).toBeGreaterThan(1.3);
    let max = 0;
    for (let t = 0; t < 10000; t += 40) max = Math.max(max, Math.abs(cameraA(nav, t + 40, F45).echelle - cameraA(nav, t, F45).echelle));
    expect(max).toBeLessThan(0.05);
  });
  it("même au zoom maximal l'écart par image reste celui d'une montée douce sur 500 ms (≤ 1,5 × 0,6 / 12,5)", () => {
    let max = 0;
    for (let t = 0; t < 20000; t += 40) max = Math.max(max, Math.abs(cameraA(base(), t + 40, F45).echelle - cameraA(base(), t, F45).echelle));
    expect(max).toBeLessThanOrEqual((1.5 * 0.6) / 12.5 + 1e-6);
  });
  // T-EXT-44 : respiration (retour à 1) entre deux zones éloignées de plus de 0,6 écran quand leurs mots sont à plus de 1,2 s ;
  // deux zones proches se suivent sans dézoomer.
  it("respire (retour à 1) entre deux zones éloignées, sans dézoomer entre deux zones proches", () => {
    expect(cameraA(base(), 6500, F45).echelle).toBeLessThan(1.01);
    for (let t = 9000; t <= 14000; t += 40) expect(cameraA(base(), t, F45).echelle).toBeGreaterThan(1.3);
  });
  it("la vue zoomée reste dans la page aux 4 coins (4:5, 1:1, 9:16 sur la largeur)", () => {
    const coins = [
      { x: 0, y: 0 },
      { x: 90, y: 0 },
      { x: 0, y: 92 },
      { x: 90, y: 92 },
    ];
    for (const format of [F45, F11, F916]) {
      for (const c of coins) {
        const nav = base({ cibles: [{ etapeId: "e", zonePct: { x: c.x, y: c.y, largeur: 10, hauteur: 8 }, instantMs: 4000, finMs: 8000 }] });
        const p = placementFilm(nav, format);
        const cam = cameraA(nav, 7000, format);
        const hg = versEcran(cam, format, { x: p.x, y: p.y });
        const bd = versEcran(cam, format, { x: p.x + p.largeur, y: p.y + p.hauteur });
        // le bord de la page ne doit jamais entrer dans le cadre (sinon un bord vide serait visible)
        if (p.x === 0) {
          expect(hg.x).toBeLessThanOrEqual(1e-6);
          expect(bd.x).toBeGreaterThanOrEqual(format.largeur - 1e-6);
        }
        if (p.y === 0) {
          expect(hg.y).toBeLessThanOrEqual(1e-6);
          expect(bd.y).toBeGreaterThanOrEqual(format.hauteur - 1e-6);
        }
      }
    }
  });
  it("garde la zone dans le cadre zoomé", () => {
    const nav = base();
    const cam = cameraA(nav, 7000, F45);
    const z = nav.cibles[0].zonePct!;
    const p = placementFilm(nav, F45);
    const centre = versEcran(cam, F45, { x: p.x + ((z.x + z.largeur / 2) / 100) * p.largeur, y: p.y + ((z.y + z.hauteur / 2) / 100) * p.hauteur });
    expect(centre.x).toBeGreaterThan(0);
    expect(centre.x).toBeLessThan(F45.largeur);
    expect(centre.y).toBeGreaterThan(0);
    expect(centre.y).toBeLessThan(F45.hauteur);
  });
});

describe("curseurA", () => {
  it("null avant le départ et après la dernière fin", () => {
    expect(curseurA(base(), 2000, F45)).toBeNull();
    expect(curseurA(base(), 16001, F45)).toBeNull();
    expect(curseurA(base(), 3400, F45)).not.toBeNull();
  });
  // T-EXT-44 : la pointe se pose à côté du centre (2 % vers le bas à droite : elle ne cache jamais le mot dit), après la caméra.
  it("sur la pointe de la zone au clic (centre + 2 %), à 1 px près, caméra comprise (première cible)", () => {
    const nav = base();
    const k = curseurA(nav, 4000, F45)!;
    const attendu = versEcran(cameraA(nav, 4000, F45), F45, { x: 0.27 * 1080, y: 0.18 * 1350 });
    expect(Math.abs(k.xPx - attendu.x)).toBeLessThan(1);
    expect(Math.abs(k.yPx - attendu.y)).toBeLessThan(1);
  });
  it("reste sur sa cible après transformation par la caméra", () => {
    const nav = base();
    const t = 9000;
    const cam = cameraA(nav, t, F45);
    const centre = versEcran(cam, F45, { x: 0.77 * 1080, y: 0.58 * 1350 });
    const k = curseurA(nav, t, F45)!;
    expect(Math.abs(k.xPx - centre.x)).toBeLessThan(1);
    expect(Math.abs(k.yPx - centre.y)).toBeLessThan(1);
  });
  it.each([["4:5", F45], ["9:16", F916]])("au clic et pendant l'impulsion de chaque cible avec zone, curseur et surbrillance sont dans l'image (%s)", (_n, F) => {
    const lots = [
      base(),
      base({ cibles: [
        { etapeId: "e1", zonePct: { x: 2, y: 2, largeur: 20, hauteur: 10 }, instantMs: 4000, finMs: 4900 },
        // T-EXT-44 : instants espacés (7,5 s et 12 s au lieu de 5 s et 8 s) : d'un coin à l'autre, la caméra ne va jamais plus vite que 1,2 écran/s.
        { etapeId: "e2", zonePct: { x: 78, y: 85, largeur: 20, hauteur: 10 }, instantMs: 7500, finMs: 9500 },
        { etapeId: "e3", zonePct: { x: 2, y: 40, largeur: 20, hauteur: 10 }, instantMs: 12000, finMs: 13000 },
      ] }),
    ];
    for (const nav of lots) {
      for (const c of nav.cibles) {
        for (let t = c.instantMs - 100; t <= c.instantMs + 300; t += 20) {
          const k = curseurA(nav, t, F)!;
          expect(k.xPx, `${c.etapeId} x à ${t}`).toBeGreaterThanOrEqual(0);
          expect(k.xPx, `${c.etapeId} x à ${t}`).toBeLessThanOrEqual(F.largeur);
          expect(k.yPx, `${c.etapeId} y à ${t}`).toBeGreaterThanOrEqual(0);
          expect(k.yPx, `${c.etapeId} y à ${t}`).toBeLessThanOrEqual(F.hauteur);
          if (t >= c.instantMs) {
            const sb = surbrillanceA(nav, t, F)!;
            expect(sb.x, `${c.etapeId} cadre à ${t}`).toBeGreaterThanOrEqual(-1);
            expect(sb.y).toBeGreaterThanOrEqual(-1);
            expect(sb.x + sb.largeur).toBeLessThanOrEqual(F.largeur + 1);
            expect(sb.y + sb.hauteur).toBeLessThanOrEqual(F.hauteur + 1);
          }
        }
      }
    }
  });
  it("le clic de la 2e cible a lieu sur elle : caméra et curseur arrivent ensemble", () => {
    const nav = base();
    const t = 9000;
    const centre = versEcran(cameraA(nav, t, F45), F45, { x: 0.77 * 1080, y: 0.58 * 1350 });
    const k = curseurA(nav, t, F45)!;
    expect(Math.abs(k.xPx - centre.x)).toBeLessThan(1);
    expect(k.xPx).toBeLessThanOrEqual(1080);
  });
  // T-EXT-44 : pression de 160 ms (échelle 1 → 0,9 → 1) et anneau qui s'efface en 400 ms (avant : impulsion de 300 ms).
  it("la pression vaut 0 avant, > 0 pendant 160 ms, 0 après ; l'anneau dure 400 ms", () => {
    const nav = base();
    expect(curseurA(nav, 3900, F45)!.clic).toBe(0);
    expect(curseurA(nav, 4080, F45)!.clic).toBeGreaterThan(0.99);
    expect(curseurA(nav, 4040, F45)!.clic).toBeGreaterThan(0);
    expect(curseurA(nav, 4160, F45)!.clic).toBeLessThan(1e-9);
    expect(curseurA(nav, 4200, F45)!.clic).toBe(0);
    expect(curseurA(nav, 3900, F45)!.anneau).toBe(0);
    expect(curseurA(nav, 4200, F45)!.anneau).toBeCloseTo(0.5);
    expect(curseurA(nav, 4400, F45)!.anneau).toBe(0);
  });
  it("arrive 150 ms avant le clic et reste au repos jusqu'au clic, sans tremblement", () => {
    const nav = base();
    const a = curseurA(nav, 3850, F45)!;
    for (let t = 3860; t <= 4000; t += 20) {
      const k = curseurA(nav, t, F45)!;
      expect(Math.abs(k.xPx - a.xPx)).toBeLessThan(1e-6);
      expect(Math.abs(k.yPx - a.yPx)).toBeLessThan(1e-6);
    }
  });
  it("une cible sans zone : le curseur reste où il est", () => {
    const nav = base({ cibles: [{ etapeId: "e1", zonePct: { x: 10, y: 10, largeur: 30, hauteur: 12 }, instantMs: 4000, finMs: 6000 }, { etapeId: "e2", instantMs: 9000, finMs: 11000 }] });
    const a = curseurA(nav, 8000, F45)!;
    const b = curseurA(nav, 8600, F45)!;
    expect(b.xPx).toBeCloseTo(a.xPx);
    expect(b.yPx).toBeCloseTo(a.yPx);
  });
});

describe("surbrillanceA", () => {
  // T-EXT-44 : le projecteur entre 250 ms avant le mot (en même temps que la caméra) et sort en 200 ms (avant : dès le clic, 200 ms).
  it("n'existe que pendant la cible : entrée en 250 ms avant le mot, sortie en 200 ms", () => {
    const nav = base();
    expect(surbrillanceA(nav, 3700, F45)).toBeNull();
    expect(surbrillanceA(nav, 3800, F45)!.opacite).toBeGreaterThan(0);
    expect(surbrillanceA(nav, 3800, F45)!.opacite).toBeLessThan(1);
    expect(surbrillanceA(nav, 4000, F45)!.opacite).toBe(1);
    expect(surbrillanceA(nav, 5900, F45)!.opacite).toBeLessThan(1);
    expect(surbrillanceA(nav, 6001, F45)).toBeNull();
  });
  it("le projecteur et la surbrillance sont la même fonction ; nul hors de ses instants", () => {
    expect(surbrillanceA).toBe(projecteurA);
    const nav = base();
    for (const t of [0, 1000, 3000, 6500, 8000, 12000, 17000]) expect(projecteurA(nav, t, F45), String(t)).toBeNull();
  });
  it("cran aucun ou sobre : ni projecteur ni volet ; cran équilibré, dynamique ou absent : projecteur", () => {
    for (const cran of ["aucun", "sobre"] as const) expect(projecteurA(base({ cran }), 4000, F45)).toBeNull();
    for (const cran of ["equilibre", "dynamique", undefined] as const) expect(projecteurA(base({ cran }), 4000, F45)).not.toBeNull();
  });
});

describe("plagesFixesSortie", () => {
  // T-EXT-44 : la caméra part dès 1,9 s (elle arrive 250 ms avant le mot, sans aller plus vite que la vitesse permise).
  it("source figée sans zoom ni curseur : une plage, jusqu'au départ de la caméra", () => {
    const nav = base({ figees: [{ debutMs: 100, finMs: 2500 }] });
    const r = plagesFixesSortie(nav)!;
    expect(r).toHaveLength(1);
    expect(r[0]!.debutMs).toBe(100);
    // La plage s'arrête exactement quand la caméra commence à bouger (vers 2 s : un mouvement de 1,7 s qui arrive à 3,75 s).
    expect(r[0]!.finMs).toBeGreaterThan(1900);
    expect(r[0]!.finMs).toBeLessThan(2500);
    expect(cameraA(nav, r[0]!.finMs - 20, F45).echelle).toBe(1);
    expect(cameraA(nav, r[0]!.finMs + 200, F45).echelle).toBeGreaterThan(1);
  });
  it("source figée 2 s pendant un déplacement et un zoom : aucune plage", () => {
    expect(plagesFixesSortie(base({ figees: [{ debutMs: 3000, finMs: 5000 }] }))).toEqual([]);
    expect(plagesFixesSortie(base({ figees: [{ debutMs: 3500, finMs: 5500 }] }))).toEqual([]);
  });
  it("un zoom TENU (caméra et curseur immobiles) sur une source figée 2 s compte comme image fixe", () => {
    const nav = base({ cibles: [{ etapeId: "e1", zonePct: { x: 10, y: 10, largeur: 30, hauteur: 12 }, instantMs: 4000, finMs: 6500 }] });
    expect(plagesFixesSortie({ ...nav, figees: [{ debutMs: 4400, finMs: 6500 }] })).toEqual([{ debutMs: 4400, finMs: 6500 }]);
  });
  it("`figees` absent : null (non mesuré)", () => {
    expect(plagesFixesSortie(base())).toBeNull();
  });
});

describe("planCacheLeFilm", () => {
  const scene = (id: string, position: string, debutMs: number, finMs: number) => ({ id, position, debutMs, finMs });
  it("liste les scènes plein écran qui recouvrent une cible", () => {
    const plan = { scenes: [scene("a", "plein", 0, 3000), scene("b", "plein", 4500, 5500), scene("c", "bas", 4500, 5500), scene("d", "plein", 6000, 8000)] } as never;
    expect(planCacheLeFilm(plan, base())).toEqual(["b"]);
  });
});

describe("voletA (avant → maintenant)", () => {
  const avecVolet = () => base({ basculeMs: 6000 });
  it("absent sans `basculeMs` ; présent 500 ms avec ; traverse l'écran de gauche à droite", () => {
    expect(voletA(base(), 6100, F45)).toBeNull();
    expect(voletA(avecVolet(), 5999, F45)).toBeNull();
    const debut = voletA(avecVolet(), 6000, F45)!;
    expect(debut.avantXPx).toBeCloseTo(0);
    const milieu = voletA(avecVolet(), 6250, F45)!;
    expect(milieu.avantXPx).toBeGreaterThan(debut.avantXPx);
    expect(voletA(avecVolet(), 6500, F45)!.arriereXPx).toBeCloseTo(F45.largeur);
    expect(voletA(avecVolet(), 6501, F45)).toBeNull();
  });
  it("sans texte : seulement des positions en pixels", () => {
    const v = voletA(avecVolet(), 6250, F45)!;
    expect(Object.keys(v).sort()).toEqual(["arriereXPx", "avantXPx", "filetPx"]);
    for (const valeur of Object.values(v)) expect(typeof valeur).toBe("number");
  });
  it("aucun volet aux crans aucun et sobre", () => {
    for (const cran of ["aucun", "sobre"] as const) expect(voletA(base({ cran, basculeMs: 6000 }), 6250, F45)).toBeNull();
  });
});

describe("NavigationFilmee.tsx (lecture du texte)", () => {
  const source = readFileSync("studio-rendu/compositions/plan-scenes/NavigationFilmee.tsx", "utf8");
  it("aucun `#` de couleur en dur, aucune couleur interdite : la charte seulement", () => {
    expect(source).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
    expect(source).not.toMatch(/\b(blue|yellow|green)\b/i);
    expect(source).not.toMatch(/rgba?\(/);
    expect(source).toContain("CHARTE_AXION.terracotta");
    expect(source).toContain("CHARTE_AXION.ivoire");
    expect(source).toContain("CHARTE_AXION.noir");
    expect(source).not.toMatch(/\bforme-bleue\b|CHARTE_AXION\.(bleu|jaune|vert)/);
  });
  it("aucune logique de temps ni de courbe : tout vient des fonctions de navigation-filmee.ts", () => {
    expect(source).toContain("projecteurA");
    expect(source).toContain("voletA");
    expect(source).not.toMatch(/Math\.(sin|cos|pow)/);
    expect(source).not.toMatch(/\bspring\(|interpolate\(/);
    for (const l of source.split("\n").filter((x) => /^\s*import\b/.test(x))) expect(l, l).toMatch(/from "(remotion|\.\.?\/)/);
  });
  it("aucun texte à l'écran (pas de balise de texte, pas de mot visible)", () => {
    expect(source).not.toMatch(/<(p|h1|h2|h3|span)>[^<]*[A-Za-zÀ-ÿ]/);
    expect(source).not.toMatch(/>\s*[A-Za-zÀ-ÿ]{2,}[^<{]*</);
  });
});

describe("pureté", () => {
  it("aucun `@/` ni mot « catalogue » dans le fichier pur", () => {
    const t = readFileSync("src/briques/plan-scenes/tutoriel/navigation-filmee.ts", "utf8");
    expect(t).not.toMatch(/from "@\//);
    expect(t).not.toMatch(/catalogue/);
  });
});
