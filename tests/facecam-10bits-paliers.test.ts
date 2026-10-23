/**
 * RAPPORT V6 — P0 n° 1 et 2 « qualité d'image n° 1 : pas de bandes sur le mur ». FFmpeg RÉEL (celui du poste) :
 * un dégradé de mur doux en 10 bits (≈ 120 niveaux sur toute la largeur, soit ≈ 30 en 8 bits) traverse le master de
 * la composition face caméra (`argumentsImageFfmpeg`, source pré-cadrée 10 bits, LUT, écran partagé). Avant : toute
 * la composition passait en RVB 8 bits (`gbrp`) puis en `yuv420p` avant le grain → ≈ 4 fois moins de niveaux, des
 * bandes visibles. Le contrôle compte les niveaux d'une ligne du mur dans le master.
 */
import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { DIMENSIONS_SCENE, type ProprietesImageComposition } from "@/briques/composition/scene";
import { lutIdentite } from "@/lib/lut3d";
import { ecrireCube } from "@/lib/qc-lut";
import { argumentsImageFfmpeg } from "../studio-rendu/src/composition/image-ffmpeg";
import { argumentsDegradeMur, NIVEAUX_DEGRADE_MUR, niveauxLigne } from "../studio-rendu/src/controle-ffmpeg";

const FFMPEG = process.env.FFMPEG ?? "ffmpeg";
const present = spawnSync(FFMPEG, ["-hide_banner", "-version"]).status === 0;
const { largeur: W, hauteur: H } = DIMENSIONS_SCENE["9:16"];

function proprietes(dix: boolean): ProprietesImageComposition {
  const cadrage = { valeur: "large" as const, zoom: 1, zoomFin: 1, pointX: 0.5, pointY: 0.38 };
  return {
    ratio: "9:16",
    largeur: W,
    hauteur: H,
    fps: 25,
    images: 25,
    decor: { teinte: "#2A2420", directionLumiere: "gauche", flouPx: 0, clair: false },
    sourcePreCadree: true,
    ...(dix ? { source10bits: true } : {}),
    doubles: { principal: { type: "video", url: "mur.mov", transparent: false } },
    plans: [
      { debutSec: 0, finSec: 0.6, type: "double", angle: "principal", cadrage },
      { debutSec: 0.6, finSec: 1, type: "double", angle: "principal", cadrage, ecranPartage: { carte: "entree:carte", hauteurHaut: 860, sourceY: 300, entreeImages: 0, carteDebutSec: 0 } },
    ],
  } as ProprietesImageComposition;
}

describe.skipIf(!present)("V6 P0 n° 1-2 · composition 10 bits : le dégradé du mur garde ses niveaux (FFmpeg réel)", () => {
  it("master face caméra : ≥ 85 % des niveaux 10 bits du mur gardés (avant : ≈ 25 %, bandes)", () => {
    const dossier = mkdtempSync(join(tmpdir(), "paliers-"));
    try {
      const lancer = (args: string[]) => {
        const r = spawnSync(FFMPEG, ["-hide_banner", "-nostdin", "-y", ...args], { cwd: dossier, encoding: "utf8" });
        if (r.status !== 0) throw new Error(r.stderr.split("\n").slice(-6).join("\n"));
      };
      lancer(argumentsDegradeMur("mur.mov", W, H));
      lancer(["-f", "lavfi", "-i", `color=c=0x203040:s=${W}x${H}:r=25`, "-t", "1.2", "-c:v", "libx264", "-preset", "ultrafast", "-pix_fmt", "yuv420p", "carte.mp4"]);
      lancer(["-f", "lavfi", "-i", "anullsrc=r=48000:cl=mono", "-t", "1.2", "-c:a", "pcm_s16le", "voix.wav"]);
      writeFileSync(join(dossier, "lut.cube"), ecrireCube(lutIdentite(17), "Contrôle"));
      const fichiers = { doubles: { principal: { fichier: "mur.mov", video: true } }, illustrations: {}, luts: [{ fichier: "lut.cube", plages: [[0, 1]] as [number, number][] }], son: "voix.wav", cartes: { carte: "carte.mp4" } };
      // Sans grain ni vignette : on compte les niveaux du mur, pas le bruit ajouté exprès.
      const couleurs = { grainPct: 0, grainTaillePx: 2, vignettePct: 0 };
      const source = niveauxLigne(dossier, "mur.mov", 0.2, Math.round(H * 0.8));
      expect(source).toBeGreaterThanOrEqual(NIVEAUX_DEGRADE_MUR * 0.75); // 80 % de la largeur lue
      lancer(argumentsImageFfmpeg(proprietes(true), couleurs, fichiers, 1, "master10.mov").slice(2));
      // Plan plein (0,2 s) et moitié basse d'un écran partagé (0,8 s, ligne dans la moitié basse) : mêmes niveaux.
      for (const t of [0.2, 0.8]) expect(niveauxLigne(dossier, "master10.mov", t, Math.round(H * 0.8)), `t = ${t}`).toBeGreaterThanOrEqual(source * 0.85);
      // Témoin : la même composition sans `source10bits` (8 bits) perd l'essentiel des niveaux.
      lancer(argumentsImageFfmpeg(proprietes(false), couleurs, fichiers, 1, "master8.mov").slice(2));
      expect(niveauxLigne(dossier, "master8.mov", 0.2, Math.round(H * 0.8))).toBeLessThan(source * 0.4);
    } finally {
      rmSync(dossier, { recursive: true, force: true });
    }
  }, 120_000);
});
