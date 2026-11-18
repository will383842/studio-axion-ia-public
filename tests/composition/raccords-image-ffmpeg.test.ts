/**
 * BR-TABLEAU-RACCORDS-a · le calque image (FFmpeg) peut relier deux illustrations voisines par un fondu ou un glissé,
 * piloté par le champ facultatif `raccords`. Absent : arguments FFmpeg identiques au caractère près (coupe franche).
 * Test pur (aucun FFmpeg lancé) ; la durée de la piste image reste EXACTEMENT celle d'avant (la voix ne bouge pas).
 */
import { describe, expect, it } from "vitest";
import type { ProprietesImageComposition } from "../../src/briques/composition/scene";
import { raccordsStyleMontage } from "../../src/briques/composition/raccords";
import { argumentsImageFfmpeg } from "../../studio-rendu/src/composition/image-ffmpeg";

const CADRAGE = { valeur: "large", zoom: 1, zoomFin: 1, pointX: 0.5, pointY: 0.38 };
const COULEURS = { grainPct: 4, grainTaillePx: 2, vignettePct: 8 };
const FPS = 25;
const illu = (debutSec: number, finSec: number, n: number) => ({ debutSec, finSec, type: "illustration", angle: "principal", cadrage: CADRAGE, illustration: { url: `entree:illu-${n}`, video: false } });
const double = (debutSec: number, finSec: number) => ({ debutSec, finSec, type: "double", angle: "principal", cadrage: CADRAGE });

const proprietes = (plans: unknown[], fin: number, raccords?: unknown) =>
  ({
    ratio: "9:16", largeur: 1080, hauteur: 1920, fps: FPS, images: Math.round(fin * FPS),
    decor: { teinte: "#110A05", directionLumiere: "face", flouPx: 0, clair: false },
    doubles: { principal: { type: "video", url: "entree:double", transparent: true } },
    plans,
    ...(raccords === undefined ? {} : { raccords }),
  }) as unknown as ProprietesImageComposition;

const FICHIERS = {
  decor: "decor-pret.png",
  doubles: { principal: { fichier: "double.webm", video: true } },
  illustrations: { 0: { fichier: "i0.jpg", video: false }, 1: { fichier: "i1.jpg", video: false }, 2: { fichier: "i2.jpg", video: false } },
  luts: [],
  son: "son.wav",
};
const graphe = (p: ProprietesImageComposition, f: typeof FICHIERS = FICHIERS) => {
  const a = argumentsImageFfmpeg(p, COULEURS, f, p.images / FPS, "master.mov");
  return a[a.indexOf("-filter_complex") + 1]!;
};

const TROIS = [illu(0, 2, 0), illu(2, 4, 1), illu(4, 6, 2)];

describe("raccords entre illustrations (calque image FFmpeg)", () => {
  it("(a) sans `raccords`, ou liste vide : arguments identiques, ligne concat d'avant", () => {
    const sans = argumentsImageFfmpeg(proprietes(TROIS, 6), COULEURS, FICHIERS, 6, "master.mov");
    const vide = argumentsImageFfmpeg(proprietes(TROIS, 6, []), COULEURS, FICHIERS, 6, "master.mov");
    expect(vide).toEqual(sans);
    expect(sans.join("\n")).toContain("[m0][m1][m2]concat=n=3:v=1:a=0,format=gbrp[img]");
    expect(sans.join("\n")).not.toContain("xfade");
  });

  it("(b) 3 illustrations de 2 s + fondu après la première : xfade entre m0 et m1, concat pour le reste, 6 s exactes", () => {
    const g = graphe(proprietes(TROIS, 6, [{ indexAvant: 0, type: "fondu" }]));
    expect(g).toContain("xfade=transition=fade:duration=0.300:offset=2.000");
    expect(g).toContain("[t0][m1]xfade=");
    expect(g).toContain("[x0][m2]concat=n=2:v=1:a=0");
    // Nombre d'images exact (xfade travaille au temps : une image de trop est coupée).
    expect(g).toContain("[raccords]trim=end_frame=150,setpts=PTS-STARTPTS[img]");
    expect(g).not.toContain("[m0][m1][m2]concat");
    // Durée : la fin de m0 est prolongée de la durée du fondu (image clonée), donc rien ne bouge : m1 commence à 2 s,
    // m2 à 4 s, total 2 + 2 + 2 = 6 s (150 images). Sans compensation, ce serait 5,7 s.
    expect(g).toContain("[m0]tpad=stop_mode=clone:stop_duration=0.300[t0]");
    const offset = Number(/offset=([\d.]+)/.exec(g)![1]);
    expect(offset + 2 + 2).toBeCloseTo(6, 6);
  });

  it("glissé : transition slideleft", () => {
    const g = graphe(proprietes(TROIS, 6, [{ indexAvant: 1, type: "glissement" }]));
    expect(g).toContain("xfade=transition=slideleft:duration=0.300:offset=4.000");
  });

  it("raccord demandé sur un plan « double » : jamais posé (le double garde la coupe franche)", () => {
    const plans = [illu(0, 2, 0), double(2, 4), illu(4, 6, 2)];
    const p = proprietes(plans, 6, [{ indexAvant: 0, type: "fondu" }, { indexAvant: 1, type: "fondu" }]);
    const g = graphe(p, { ...FICHIERS, illustrations: { 0: FICHIERS.illustrations[0], 2: FICHIERS.illustrations[2] } } as typeof FICHIERS);
    expect(g).not.toContain("xfade");
    expect(g).toContain("concat=n=3:v=1:a=0");
  });

  it("(c) `raccordsStyleMontage` refuse un raccord autour d'un plan « double » et d'un plan trop court", () => {
    const plans = [illu(0, 2, 0), double(2, 4), illu(4, 6, 2), illu(6, 6.4, 3), illu(6.4, 8, 4)] as never[];
    expect(raccordsStyleMontage(plans, "fondu")).toEqual([]);
    expect(raccordsStyleMontage([illu(0, 2, 0), illu(2, 4, 1)] as never[], "fondu")).toEqual([{ indexAvant: 0, type: "fondu" }]);
  });
});
