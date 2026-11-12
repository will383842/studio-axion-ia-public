/**
 * Lot E (2) : plus de double accélération (HeyGen 1,1 PUIS atempo 1,08) et un compresseur qui ne remonte pas la fin des
 * phrases. Mesuré sur un son de test (sinus de 3,2 s dont les 300 derniers ms retombent de 30 dB) passé dans la vraie
 * chaîne de filtres ffmpeg de la recette.
 */
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { TEMPO_VOIX } from "@/formats/cas-concret";
import { RECETTE_VOIX_CAS_CONCRET, parametresRecette, planRecetteVoix } from "@/moteurs/montage-cas-concret/recette-voix";

const dossier = mkdtempSync(join(tmpdir(), "lot-e-"));
afterAll(() => rmSync(dossier, { recursive: true, force: true }));

const ffmpeg = (args: string[]) => execFileSync("ffmpeg", ["-v", "error", "-nostdin", "-y", ...args], { stdio: ["ignore", "pipe", "pipe"] });
function mesure(fichier: string, debutSec: number, dureeSec: number): number {
  const r = spawnSync("ffmpeg", ["-nostdin", "-ss", String(debutSec), "-t", String(dureeSec), "-i", fichier, "-af", "volumedetect", "-f", "null", "-"], { encoding: "utf8" });
  const m = /mean_volume: (-?[\d.]+) dB/.exec(String(r.stderr));
  if (!m) throw new Error(`mesure impossible : ${r.stderr}`);
  return Number(m[1]);
}

describe("une seule accélération", () => {
  it("HeyGen lit à 1,1 ; la recette n'ajoute plus de atempo (1) et le tempo du plan suit", () => {
    expect(RECETTE_VOIX_CAS_CONCRET.synthese.vitesse).toBe(1.1);
    expect(RECETTE_VOIX_CAS_CONCRET.filtres.atempo).toBe(1);
    expect(TEMPO_VOIX).toBe(1);
    const p = planRecetteVoix([{ mot: "Bonjour.", debutSec: 0.5, finSec: 1 }], 2);
    expect(p.dureeResserreeSec / (p.dureeSec - RECETTE_VOIX_CAS_CONCRET.fin.silenceSec)).toBeCloseTo(1, 3);
    expect(String(parametresRecette(p).filtres)).toMatch(/^atempo=1,/);
  });
});

describe("le compresseur ne remonte pas la fin des phrases", () => {
  it("l'écart « 300 derniers ms − corps » après la chaîne ne dépasse pas celui du son d'origine de plus de 1,5 dB", () => {
    const entree = join(dossier, "phrase.wav");
    // 3,2 s de sinus à 0,4 ; à partir de 2,9 s le niveau retombe de 30 dB en 300 ms.
    ffmpeg(["-f", "lavfi", "-i", "aevalsrc='0.4*sin(2*PI*180*t)*lt(t,3.2)*pow(10,-1.5*clip((t-2.9)/0.3,0,1))':s=16000:d=4", "-ac", "1", entree]);
    const sortie = join(dossier, "traite.wav");
    ffmpeg(["-i", entree, "-af", String(parametresRecette(planRecetteVoix([{ mot: "x.", debutSec: 0, finSec: 3 }], 4)).filtres).replace(/^atempo=[\d.]+,/, ""), sortie]);
    const ecartAvant = mesure(entree, 3.0, 0.2) - mesure(entree, 1.0, 1.5);
    const ecartApres = mesure(sortie, 3.0, 0.2) - mesure(sortie, 1.0, 1.5);
    expect(ecartAvant).toBeLessThan(-12);
    expect(ecartApres - ecartAvant).toBeLessThanOrEqual(1.5);
  });
});
