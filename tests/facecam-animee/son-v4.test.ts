/**
 * FACE CAMÉRA ANIMÉE v4 — SON (décision de Will du 17/10/2026) :
 *  - bruitages baissés de 4 dB (un seul multiplicateur partagé par toutes les briques) ;
 *  - son final de CE format normalisé à -14 LUFS intégré, pic vrai ≤ -1,5 dBTP (loudnorm en deux passes), mesuré par ebur128
 *    sur un petit rendu synthétique passé par les VRAIS filtres de l'opération.
 */
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { BAISSE_BRUITAGES_DB, GAIN_BRUITAGES } from "../../studio-rendu/compositions/interface-claire/motion-v4/communs/medias-v4";
import { CIBLE_LUFS_V4, filtreLoudnormFinal, filtreLoudnormMesure, lireMesureLoudnorm, MARGES_PIC_AAC_DB, normaliserSonV4, PIC_VRAI_MAX_V4, sonConforme } from "../../studio-rendu/src/operations/facecam-v4";
import { lireEbur128 } from "../../studio-rendu/src/son/mesure";

const RACINE = join(__dirname, "..", "..");
const ffmpegPresent = spawnSync("ffmpeg", ["-version"]).status === 0;

describe("Son v4 · bruitages", () => {
  it("baisse de 4 dB, appliquée par chaque brique qui joue un bruitage", () => {
    expect(BAISSE_BRUITAGES_DB).toBe(4);
    expect(20 * Math.log10(GAIN_BRUITAGES)).toBeCloseTo(-4, 6);
    for (const f of ["communs/briques-v4.tsx", "lot1/commun-lot1.tsx", "lot2/commun-lot2.tsx", "lot3/commun-lot3.tsx", "lot4/commun-lot4.tsx"]) {
      const src = readFileSync(join(RACINE, "studio-rendu/compositions/interface-claire/motion-v4", f), "utf8");
      expect(src, f).toMatch(/<Audio [^>]*GAIN_BRUITAGES/);
    }
  });
});

describe("Son v4 · normalisation du rendu final", () => {
  it("filtres purs : cible -14 LUFS, pic ≤ -1,5 dBTP, mesure relue, sortie 48 kHz", () => {
    expect(CIBLE_LUFS_V4).toBe(-14);
    expect(PIC_VRAI_MAX_V4).toBe(-1.5);
    expect(filtreLoudnormMesure()).toMatch(/^loudnorm=I=-14:TP=-2.5:LRA=11:print_format=json$/);
    const m = lireMesureLoudnorm('bruit\n{ "input_i": "-27.40", "input_tp": "-12.90", "input_lra": "6.10", "input_thresh": "-38.00", "output_i": "-14", "target_offset": "0.30" }');
    const f = filtreLoudnormFinal(m);
    expect(f).toContain("measured_I=-27.40");
    expect(f).toContain("offset=0.30");
    expect(f).toContain("linear=true");
    expect(f).toMatch(/aresample=48000$/);
    expect(() => lireMesureLoudnorm("rien")).toThrow();
    expect(() => lireMesureLoudnorm('{ "input_i": "-inf", "input_tp": "-inf", "input_lra": "0", "input_thresh": "-70", "target_offset": "inf" }')).toThrow();
  });

  it.skipIf(!ffmpegPresent)("une voix à ≈ -27 LUFS ressort à -14 LUFS, pic vrai ≤ -1,5 dBTP (ebur128, après l'AAC) ; idem avec des claquements très brefs", async () => {
    const d = mkdtempSync(join(tmpdir(), "son-v4-"));
    try {
      const mesure = (f: string) => lireEbur128(spawnSync("ffmpeg", ["-hide_banner", "-nostats", "-i", f, "-af", "ebur128=peak=true", "-f", "null", "-"], { encoding: "utf8" }).stderr);
      const cas: Record<string, string> = {
        // « Voix » : sinus modulé en amplitude + un peu de bruit, très basse.
        voix: "[0]volume='0.5+0.5*sin(2*PI*1.3*t)':eval=frame[a];[a][1]amix=inputs=2:normalize=0,volume=-24dB",
        // Même chose + un claquement bref toutes les 1,7 s (pics francs, comme un bruitage).
        claquements: "[0]volume='0.5+0.5*sin(2*PI*1.3*t)':eval=frame[a];[a][1]amix=inputs=2:normalize=0,volume=-24dB,volume='1+8*lt(mod(t,1.7),0.004)':eval=frame",
      };
      for (const [nom, graphe] of Object.entries(cas)) {
        const entree = join(d, `${nom}.wav`);
        const sortie = join(d, `${nom}.m4a`);
        execFileSync("ffmpeg", ["-hide_banner", "-v", "error", "-y", "-f", "lavfi", "-i", "sine=f=220:d=8:r=48000", "-f", "lavfi", "-i", "anoisesrc=d=8:r=48000:a=0.05:c=pink", "-filter_complex", graphe, "-ar", "48000", entree]);
        expect(mesure(entree).lufs, nom).toBeLessThan(-24);
        const r = await normaliserSonV4(entree, sortie);
        const apres = mesure(sortie);
        expect(apres.lufs, nom).toBeGreaterThan(CIBLE_LUFS_V4 - 1);
        expect(apres.lufs, nom).toBeLessThan(CIBLE_LUFS_V4 + 1);
        expect(apres.creteVraieDbtp, nom).toBeLessThanOrEqual(PIC_VRAI_MAX_V4);
        expect(r.creteVraieDbtp).toBeCloseTo(apres.creteVraieDbtp, 1);
      }
    } finally {
      rmSync(d, { recursive: true, force: true });
    }
  }, 120_000);
});
