/**
 * CONSTAT PROD 10/10 « zoom demandé = image cassée » — FFmpeg RÉEL (celui du poste, ou `FFMPEG=…`). Une retouche face
 * caméra (zoom demandé au monteur) sortait TOUTE l'image filmée en jaune et magenta (fond jaune, visage et sweat
 * magenta), les cartes plein écran restant normales. Cause : dans le master 10 bits (`argumentsImageFfmpeg`), la carte
 * plein écran passait par `premultiply` ; depuis FFmpeg 8, le mode d'alpha (droit / prémultiplié) est NÉGOCIÉ sur tout
 * le graphe relié par `concat` : les `overlay` en YUV 4:4:4 10 bits des plans filmés mélangeaient alors en mode
 * « prémultiplié » et la chrominance partait. Le défaut n'apparaît qu'avec FFmpeg ≥ 8 (8.1.1 de production) ; le
 * FFmpeg 6.1 d'un poste ne négocie pas l'alpha et passe ce test avant comme après le correctif.
 *
 * Mire 10 bits (mur, peau, sweat), plans filmés dont un zoomé à 130 %, une carte plein écran entre les deux : le master
 * et l'export (`argumentsExport`) gardent les couleurs de la mire ; le garde-fou (`controlerCouleurs`) laisse passer cet
 * export et arrête un export aux couleurs aberrantes.
 */
import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { ProprietesImageComposition } from "@/briques/composition/scene";
import { argumentsExport, listeConcatTexte } from "../studio-rendu/src/composition/ffmpeg";
import { argumentsImageFfmpeg } from "../studio-rendu/src/composition/image-ffmpeg";
import { controlerCouleurs, ecartCouleurs, mesurerCouleurs, type Zone } from "../studio-rendu/src/composition/couleurs";
import { argumentsMireFacecam, plansZoomEtCarte, ZONES_MIRE } from "../studio-rendu/src/controle-ffmpeg";

const FFMPEG = process.env.FFMPEG ?? "ffmpeg";
const sonde = spawnSync(FFMPEG, ["-hide_banner", "-version"], { encoding: "utf8" });
const version = sonde.status === 0 ? sonde.stdout.split("\n")[0] : null;
if (!version) console.warn(`[couleurs-carte-pleine] FFmpeg introuvable (${FFMPEG}) : test sauté.`);

function proprietes(): ProprietesImageComposition {
  return {
    ratio: "9:16",
    largeur: 1080,
    hauteur: 1920,
    fps: 25,
    images: 25,
    decor: { teinte: "#16120F", directionLumiere: "face", flouPx: 0, clair: false },
    sourcePreCadree: true,
    source10bits: true,
    doubles: { principal: { type: "video", url: "entree:double-principal", transparent: false } },
    // Plan large, carte plein écran, plan serré à 130 % (zoom demandé : fenêtre agrandie, coupe franche).
    plans: plansZoomEtCarte(1),
  } as ProprietesImageComposition;
}

describe.skipIf(!version)(`Face caméra 10 bits : carte plein écran et zoom, couleurs de l'image filmée (${version ?? "FFmpeg absent"})`, () => {
  let dossier = "";
  const ff = (args: string[]) => {
    const r = spawnSync(FFMPEG, ["-hide_banner", "-nostdin", "-y", ...args], { cwd: dossier, encoding: "utf8" });
    if (r.status !== 0) throw new Error(`FFmpeg a échoué : ${r.stderr.split("\n").filter(Boolean).slice(-3).join(" | ")}`);
  };
  const mesure = (fichier: string, t: number, zone: Zone) => mesurerCouleurs(FFMPEG, join(dossier, fichier), t, zone);

  beforeAll(() => {
    dossier = mkdtempSync(join(tmpdir(), "couleurs-carte-"));
    // La piste montée 10 bits, comme la rend le cadrage (yuv420p10le, BT.709 tv étiqueté).
    ff(argumentsMireFacecam("montage.mov"));
    // Carte plein écran rendue par Remotion : MP4 H.264 8 bits.
    ff(["-f", "lavfi", "-i", "testsrc=s=1080x1920:r=25:d=1.2", "-c:v", "libx264", "-preset", "ultrafast", "-pix_fmt", "yuv420p", "carte.mp4"]);
    ff(["-f", "lavfi", "-i", "sine=f=220:r=48000:d=1.2", "-c:a", "pcm_s24le", "voix.wav"]);
    ff(["-f", "lavfi", "-i", "color=c=black@0:s=1080x1920,format=rgba", "-frames:v", "1", "t-000000.png"]);
    writeFileSync(join(dossier, "liste.txt"), listeConcatTexte(["t-000000.png"], [25], 25));
    const args = argumentsImageFfmpeg(proprietes(), { grainPct: 4, grainTaillePx: 2, vignettePct: 12 }, { doubles: { principal: { fichier: "montage.mov", video: true } }, illustrations: { 1: { fichier: "carte.mp4", video: true } }, luts: [], son: "voix.wav" }, 1, "master.mov", { fils: 2 });
    ff(args.slice(2));
    const ex = argumentsExport("master.mov", "liste.txt", { fps: 25, debitKbps: 8000, debitMaxKbps: 12000, audioKbps: 256, audioHz: 48000, source10bits: true, mode: "crf", crf: 17 }, "passe", "export.mp4", 2);
    ff(ex.passe2.slice(2));
  }, 120_000);
  afterAll(() => dossier && rmSync(dossier, { recursive: true, force: true }));

  for (const [fichier, nom] of [["master.mov", "master"], ["export.mp4", "export"]] as const)
    it(`${nom} : mur et peau gardent leur chrominance (plan large ET plan zoomé), écart < 3 sur 255`, async () => {
      for (const t of [0.2, 0.8])
        for (const [zone, z] of Object.entries(ZONES_MIRE)) {
          const e = ecartCouleurs(await mesure(fichier, t, z), await mesure("montage.mov", 0.2, z));
          expect({ t, zone, ecartUV: +e.ecartUV.toFixed(1) }).toEqual({ t, zone, ecartUV: expect.toSatisfy((x: number) => x < 3) });
        }
    }, 60_000);

  it("garde-fou : l'export juste passe ; un export aux couleurs aberrantes (U et V permutés) est arrêté", async () => {
    const paires = [{ exportSec: 0.2, referenceSec: 0.2 }, { exportSec: 0.3, referenceSec: 0.3 }];
    const bon = await controlerCouleurs(FFMPEG, join(dossier, "export.mp4"), join(dossier, "montage.mov"), paires);
    expect(bon).toMatchObject({ couleursPaires: 2, couleursAberrantes: 0 });
    ff(["-i", "export.mp4", "-vf", "format=yuv444p,shuffleplanes=0:2:1,format=yuv420p", "-c:v", "libx264", "-preset", "ultrafast", "-crf", "10", "casse.mp4"]);
    const casse = await controlerCouleurs(FFMPEG, join(dossier, "casse.mp4"), join(dossier, "montage.mov"), paires);
    expect(casse.couleursAberrantes).toBe(1);
    expect(casse.couleursEcartUV).toBeGreaterThan(10);
  }, 60_000);
});
