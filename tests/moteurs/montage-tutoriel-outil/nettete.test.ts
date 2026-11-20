/**
 * T-EXT-54d · géométrie du film du tutoriel pour la mesure de netteté : calcul pur, 0 €, aucun FFmpeg, aucun rendu.
 * Les données sont fictives (« Espace démo · Stocks », « exemple »).
 */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { noterZones, SEUIL_FIGE_MS, type MesureZone } from "../../../src/briques/controle-image/mesures-video";
import { SEUIL_IMAGE_FIXE_MS, type NavigationFilmee } from "../../../src/briques/plan-scenes/tutoriel/navigation-filmee";
import { planMotionFilm, type PlanMotionFilm } from "../../../src/briques/plan-scenes/tutoriel/motion-film";
import { tailleTexteMinPx } from "../../../src/moteurs/montage-tutoriel-outil/diffusion-tutoriel";
import { controlerNettete, formatDuRatio, instantsDeMesure, quartSansCurseur, rapportNetteteTutoriel, zonesTutoriel } from "../../../src/moteurs/montage-tutoriel-outil/nettete";

const F45 = { largeur: 1080, hauteur: 1350 };
const CAPTURE = { largeurPx: 2160, hauteurPx: 2700 };

function nav(plus: Partial<NavigationFilmee> = {}): NavigationFilmee {
  const zone = { x: 35, y: 40, largeur: 30, hauteur: 20 };
  return {
    version: "navigation-filmee.v1",
    videoCle: "navigation.mp4",
    maquette: "05-stocks",
    largeur: 1080,
    hauteur: 1350,
    debutFilmMs: 500,
    dureeVoixMs: 20000,
    cibles: [
      { etapeId: "e1", zonePct: zone, instantMs: 3000, finMs: 4800 },
      { etapeId: "e2", zonePct: zone, instantMs: 4800, finMs: 6600 },
      { etapeId: "e3", zonePct: zone, instantMs: 6600, finMs: 8400 },
      { etapeId: "e4", zonePct: zone, instantMs: 8400, finMs: 10200 },
      { etapeId: "e5", zonePct: zone, instantMs: 10200, finMs: 12000 },
    ],
    ...plus,
  };
}

/** Plan à la main : une pose fixe (zoom choisi) et un curseur immobile, pour maîtriser la géométrie. */
function plan(zoom: number, curseur: { x: number; y: number } | null, n: NavigationFilmee = nav()): PlanMotionFilm {
  return {
    camera: [{ tMs: 0, cx: 540, cy: 675, zoom, profil: "travelling" }],
    curseur: curseur ? [{ tMs: 0, ...curseur }, { tMs: 20000, ...curseur }] : [],
    clics: n.cibles.map((c) => ({ tMs: c.instantMs, x: 50, y: 50 })),
    projecteurs: [],
    volets: [],
    alertes: [],
    geometrie: { format: F45, page: { x: 0, y: 0, largeur: 1080, hauteur: 1350 }, hautSousTitresPct: 72 },
  };
}

describe("instantsDeMesure", () => {
  it("5 cibles → 5 instants, après la pose et le clic de 300 ms, avant la fin moins 200 ms", () => {
    const n = nav();
    const r = instantsDeMesure(n, plan(1, null, n));
    expect(r.map((x) => x.etapeId)).toEqual(["e1", "e2", "e3", "e4", "e5"]);
    r.forEach((x, i) => {
      const c = n.cibles[i]!;
      expect(x.tMs).toBe(c.instantMs + 300);
      expect(x.tMs).toBeLessThan(c.finMs - 200);
    });
  });
  it("une cible trop courte n'est pas mesurée (jamais devinée), comme une cible sans zone", () => {
    const n = nav();
    n.cibles[1] = { etapeId: "e2", zonePct: n.cibles[1]!.zonePct!, instantMs: 4800, finMs: 5200 };
    n.cibles[2] = { etapeId: "e3", instantMs: 6600, finMs: 8400 };
    expect(instantsDeMesure(n, plan(1, null, n)).map((x) => x.etapeId)).toEqual(["e1", "e4", "e5"]);
  });
  it("caméra qui arrive après clic + 300 ms : l'instant est celle de son arrivée", () => {
    const n = nav();
    const p = plan(1, null, n);
    p.camera = [
      { tMs: 0, cx: 540, cy: 675, zoom: 1, profil: "travelling" },
      { tMs: 3100, cx: 540, cy: 675, zoom: 1, profil: "travelling" },
      { tMs: 4300, cx: 600, cy: 700, zoom: 1.5, profil: "accostage" },
    ];
    const e1 = instantsDeMesure(n, p).find((x) => x.etapeId === "e1")!;
    expect(e1.tMs).toBe(4300);
    // Les autres cibles (caméra posée) gardent clic + 300.
    expect(instantsDeMesure(n, p).find((x) => x.etapeId === "e3")!.tMs).toBe(6600 + 300);
  });
  it("caméra qui arrive après la fin moins 200 ms : l'étape n'est pas mesurée", () => {
    const n = nav();
    const p = plan(1, null, n);
    p.camera = [
      { tMs: 0, cx: 540, cy: 675, zoom: 1, profil: "travelling" },
      { tMs: 3100, cx: 540, cy: 675, zoom: 1, profil: "travelling" },
      { tMs: 4700, cx: 600, cy: 700, zoom: 1.5, profil: "accostage" },
    ];
    expect(instantsDeMesure(n, p).map((x) => x.etapeId)).not.toContain("e1");
  });
  it("ne lève jamais sur une entrée illisible", () => {
    expect(instantsDeMesure({ cibles: undefined } as never, { camera: [] })).toEqual([]);
  });
});

describe("quartSansCurseur", () => {
  const r = { x: 100, y: 100, largeur: 200, hauteur: 100 };
  it("curseur au centre → 3 quarts ; hors zone ou absent → 4", () => {
    expect(quartSansCurseur(r, { x: 200, y: 150 })).toHaveLength(3);
    expect(quartSansCurseur(r, { x: 900, y: 900 })).toHaveLength(4);
    expect(quartSansCurseur(r, null)).toHaveLength(4);
  });
  it("écarte le quart du curseur, et lui seul", () => {
    const q = quartSansCurseur(r, { x: 120, y: 110 });
    expect(q.map((x) => x.indice)).toEqual([2, 3, 4]);
  });
});

describe("zonesTutoriel", () => {
  const echelleDe = (zoom: number) => zonesTutoriel(nav(), plan(zoom, null), F45, CAPTURE)[0]!.echelleSource;
  it("page 1080 × 1350 capturée à 2× : zoom 1 → 0,5 ; zoom 1,6 → 0,8 ; zoom 2,5 → 1,25", () => {
    expect(echelleDe(1)).toBeCloseTo(0.5, 6);
    expect(echelleDe(1.6)).toBeCloseTo(0.8, 6);
    expect(echelleDe(2.5)).toBeCloseTo(1.25, 6);
  });
  it("un quart par zone, id <étape>#q<n>, instants et rectangles cohérents", () => {
    const z = zonesTutoriel(nav(), plan(1, null), F45, CAPTURE);
    expect(z).toHaveLength(20);
    expect(z[0]!.id).toBe("e1#q1");
    expect(z[0]!.tVideoSec).toBeCloseTo(3.3, 6);
    expect(z[0]!.tSourceSec).toBeCloseTo(3.8, 6);
    // Zone 35-65 % × 40-60 % rognée de 3 % : quart haut-gauche (zoom 1 : la page remplit l'image).
    expect(z[0]!.rectVideo.x).toBe(Math.round(1080 * (0.35 + 0.3 * 0.03)));
    expect(z[0]!.rectSource.x).toBe(Math.round(2160 * (0.35 + 0.3 * 0.03)));
    expect(z[0]!.rectSource.largeur).toBeCloseTo(z[0]!.rectVideo.largeur * 2, -1);
  });
  it("le quart du curseur est écarté", () => {
    const z = zonesTutoriel(nav(), plan(1, { x: 50, y: 50 }), F45, CAPTURE);
    expect(z.filter((x) => x.id.startsWith("e1#"))).toHaveLength(3);
  });
  it("police : policeMinPx (px CSS) ramenée aux pixels du film ; minimum passé en paramètre", () => {
    const z = zonesTutoriel(nav(), plan(1.6, null), F45, CAPTURE, [{ etapeId: "e1", policeMinPx: 16 }], { minimumPx: 20 });
    const e1 = z.find((x) => x.id === "e1#q1")!;
    expect(e1.policeSourcePx).toBe(32);
    expect(e1.minimumPx).toBe(20);
    expect(z.find((x) => x.id === "e2#q1")!.policeSourcePx).toBeUndefined();
    // Sans option : le minimum vient de T-EXT-43 pour le ratio du format (4:5).
    expect(zonesTutoriel(nav(), plan(1, null), F45, CAPTURE, [{ etapeId: "e1", policeMinPx: 16 }])[0]!.minimumPx).toBe(tailleTexteMinPx("4:5"));
  });
  it("la zone qui sort de l'image est coupée aux bords ; hors de l'image : pas de zone", () => {
    const n = nav();
    n.cibles = [{ etapeId: "x", zonePct: { x: 0, y: 0, largeur: 100, hauteur: 100 }, instantMs: 3000, finMs: 4800 }];
    const z = zonesTutoriel(n, plan(2, null, n), F45, CAPTURE);
    for (const q of z) {
      expect(q.rectVideo.x + q.rectVideo.largeur).toBeLessThanOrEqual(1080);
      expect(q.rectVideo.y + q.rectVideo.hauteur).toBeLessThanOrEqual(1350);
    }
    const hors = nav();
    expect(zonesTutoriel(hors, { ...plan(2.5, null), camera: [{ tMs: 0, cx: 1e6, cy: 1e6, zoom: 2.5, profil: "travelling" }] }, F45, CAPTURE)).toEqual([]);
  });
  it("fonctionne avec le vrai plan de motion", () => {
    const n = nav();
    const z = zonesTutoriel(n, planMotionFilm(n, F45), F45, CAPTURE);
    expect(z.length).toBeGreaterThan(0);
    z.forEach((q) => expect(Number.isFinite(q.echelleSource)).toBe(true));
  });
  it("capture illisible → aucune zone, sans lever", () => {
    expect(zonesTutoriel(nav(), plan(1, null), F45, { largeurPx: 0, hauteurPx: 0 })).toEqual([]);
  });
});

describe("formatDuRatio", () => {
  it("connus et inconnus", () => {
    expect(formatDuRatio("4:5")).toEqual(F45);
    expect(formatDuRatio("9:16")).toEqual({ largeur: 1080, hauteur: 1920 });
    expect(formatDuRatio("3:2")).toBeNull();
    expect(formatDuRatio("constructor")).toBeNull();
  });
});

function mesures(ssims: Record<string, number | null>, extra: { echelle?: number; police?: number; minimum?: number } = {}): { m: MesureZone[]; zones: ReturnType<typeof zonesTutoriel> } {
  const ids = Object.keys(ssims);
  const zones = ids.map((id) => ({
    id,
    tSourceSec: 1,
    tVideoSec: 1,
    rectSource: { x: 0, y: 0, largeur: 10, hauteur: 10 },
    rectVideo: { x: 0, y: 0, largeur: 10, hauteur: 10 },
    echelleSource: extra.echelle ?? 0.5,
    ...(extra.police !== undefined ? { policeSourcePx: extra.police } : {}),
    ...(extra.minimum !== undefined ? { minimumPx: extra.minimum } : {}),
  }));
  return { m: noterZones(zones, ssims), zones };
}

describe("rapportNetteteTutoriel et controlerNettete", () => {
  it("le score de l'étape est le plus petit de ses quarts ; raison « Étape 3 : … » sans le mot SSIM", () => {
    const { m, zones } = mesures({ "a#q1": 0.97, "b#q1": 0.99, "b#q2": 0.84, "b#q3": 0.95, "c#q1": 0.93, "c#q2": 0.8 }, { police: 40, minimum: 20 });
    const r = rapportNetteteTutoriel(m, zones);
    expect(r.etapes.map((e) => e.ssim)).toEqual([0.97, 0.84, 0.8]);
    const e3 = r.etapes[2]!;
    expect(e3.numero).toBe(3);
    expect(e3.raisonsNettete).toHaveLength(1);
    expect(e3.raisonsNettete[0]).toMatch(/^Étape 3 : le texte perd en netteté/);
    const verdicts = controlerNettete(r);
    expect(verdicts.map((v) => v.id)).toEqual(["TUT-NETTETE", "TUT-AGRANDISSEMENT", "TUT-TEXTE-APRES-ZOOM"]);
    expect(verdicts.every((v) => v.bloquant)).toBe(true);
    expect(verdicts[0]!.etat).toBe("echoue");
    expect(verdicts[0]!.details.join(" ")).toContain("Étape 2");
    expect(verdicts[1]!.etat).toBe("reussi");
    expect(verdicts[2]!.etat).toBe("reussi");
    expect(JSON.stringify(verdicts)).not.toMatch(/ssim|\$|€/i);
  });
  it("tout conforme → trois réussis", () => {
    const { m, zones } = mesures({ "a#q1": 0.98, "b#q1": 0.96 }, { police: 40, minimum: 20 });
    expect(controlerNettete(rapportNetteteTutoriel(m, zones)).map((v) => v.etat)).toEqual(["reussi", "reussi", "reussi"]);
  });
  it("agrandissement et texte trop petit sont des échecs distincts", () => {
    const { m, zones } = mesures({ "a#q1": 0.98 }, { echelle: 1.25, police: 20, minimum: 41 });
    const v = controlerNettete(rapportNetteteTutoriel(m, zones));
    expect(v.map((x) => x.etat)).toEqual(["reussi", "echoue", "echoue"]);
    expect(v[1]!.details[0]).toContain("Étape 1 : le zoom agrandit");
    expect(v[2]!.details[0]).toContain("il en faut 41");
  });
  it("un quart non mesuré n'est jamais un succès ; une taille inconnue non plus", () => {
    const { m, zones } = mesures({ "a#q1": null, "a#q2": null });
    const v = controlerNettete(rapportNetteteTutoriel(m, zones));
    expect(v[0]!.etat).toBe("non-fait");
    expect(v[2]!.etat).toBe("non-fait");
    expect(v.some((x) => x.etat === "reussi" && x.id === "TUT-NETTETE")).toBe(false);
  });
  it("rapport absent ou vide → trois « non fait », aucun réussi", () => {
    for (const r of [undefined, { etapes: [] }]) {
      const v = controlerNettete(r);
      expect(v).toHaveLength(3);
      expect(v.every((x) => x.etat === "non-fait" && x.bloquant)).toBe(true);
    }
  });
});

describe("la partie générique reste commune", () => {
  const texte = readFileSync("src/moteurs/montage-tutoriel-outil/nettete.ts", "utf8");
  it("aucune formule, FFmpeg ni seuil de netteté réécrits ici", () => {
    expect(texte).not.toMatch(/ssim=|freezedetect|blackdetect|lanczos/);
    expect(texte).not.toMatch(/\b0[.,]\d+\b/);
    expect(texte).not.toMatch(/node:|@\/services|child_process/);
  });
  it("importe la netteté de 54a, sans le dupliquer", () => {
    expect(texte).toContain('from "../../briques/controle-image/mesures-video"');
    expect(SEUIL_FIGE_MS).toBe(SEUIL_IMAGE_FIXE_MS);
  });
  it("aucun montant ni nom de marque à l'écran", () => {
    expect(texte).not.toMatch(/€|\$\d/);
  });
});
