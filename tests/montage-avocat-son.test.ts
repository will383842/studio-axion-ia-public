/**
 * LOT M1 — nettoyage des blancs et report des horodatages sur un VRAI fichier son (plan B.4, B.5 ; critères de fin M1).
 * Le son : `tests/fixtures/voix-essai.wav`, fabriqué en local par la voix de synthèse de Windows (aucun service payant,
 * `outils/voix-essai/`), avec le début de chaque mot donné par Windows et sa fin mesurée sur le son — même contrat que
 * la synthèse HeyGen (`word_timestamps`). Le texte ENVOYÉ porte les prononciations substituées (« PV » → « pé vé »).
 * L'opération `nettoyage-audio` de `studio-rendu` tourne ici avec le FFmpeg du poste (pas de Docker).
 */
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import type { MotHorodate } from "@/domaine/types";
import { blancsLongs, calculerCoupures, coupuresAppliquees, decalerMots } from "@/moteurs/montage-avocat/nettoyage";
import { preparerTexteVoix, reporterHorodatages } from "@/moteurs/montage-avocat/report";
import { appliquerCoupures, decoderPcm, detecterRespirations, FREQUENCE, niveauDb, passageParZero, passeBande } from "../studio-rendu/src/audio/pcm";
import { nettoyerFichier } from "../studio-rendu/src/operations/nettoyage-audio";

const FIXTURE = "tests/fixtures/voix-essai";
const donnees = JSON.parse(readFileSync(`${FIXTURE}.json`, "utf8")) as { texteValide: string; texteEnvoye: string; prononciations: { mot: string; prononciation: string }[]; dureeSec: number; mots: MotHorodate[] };
const ffmpegPresent = spawnSync("ffmpeg", ["-version"]).status === 0;
const dossier = mkdtempSync(join(tmpdir(), "studio-m1-"));

/** Segments du texte validé : une phrase par segment (comme le script de Will). */
const segments = donnees.texteValide.split(/(?<=[.?!])\s+/).map((texte, i) => ({ id: `s${i + 1}`, texte }));

function sinus(dureeSec: number, hz: number, amplitude = 0.5): Float32Array {
  const x = new Float32Array(Math.round(dureeSec * FREQUENCE));
  for (let i = 0; i < x.length; i++) x[i] = amplitude * Math.sin((2 * Math.PI * hz * i) / FREQUENCE);
  return x;
}

describe("calcul du son en mémoire (studio-rendu, sans FFmpeg)", () => {
  it("passage par zéro : le raccord est recalé sur le changement de signe le plus proche (± 2 ms)", () => {
    const x = sinus(0.1, 100);
    const k = passageParZero(x, 250, 96);
    expect(Math.sign(x[k]) !== Math.sign(x[k - 1]) || x[k] === 0).toBe(true);
    expect(Math.abs(k - 240)).toBeLessThanOrEqual(1); // demi-période de 100 Hz = 240 échantillons
  });

  it("coupures en fondu enchaîné centré : durée exacte (source − retiré), aucun saut de signal au raccord", () => {
    const x = sinus(2, 220, 0.4);
    const { echantillons, appliquees } = appliquerCoupures(x, [{ debutSec: 0.5, finSec: 0.8 }, { debutSec: 1.2, finSec: 1.25 }], 15);
    const retire = appliquees.reduce((s, c) => s + Math.round((c.finSec - c.debutSec) * FREQUENCE), 0);
    expect(echantillons.length).toBe(x.length - retire);
    for (const c of appliquees) expect(Math.abs(c.recalageMs)).toBeLessThanOrEqual(2.5);
    let saut = 0;
    for (let i = 1; i < echantillons.length; i++) saut = Math.max(saut, Math.abs(echantillons[i] - echantillons[i - 1]));
    // Le pas maximal d'une sinusoïde de 220 Hz à 0,4 est ≈ 0,0115 : un clic donnerait un saut bien plus grand.
    expect(saut).toBeLessThan(0.03);
  });

  it("respiration reconnue : bruit sans voix entre 1 et 5 kHz, de −45 à −30 dB ; le silence et la voix ne le sont pas", () => {
    const x = new Float32Array(FREQUENCE * 2);
    // 0,0-0,5 s : silence ; 0,5-0,8 s : souffle à ≈ −38 dB ; 1,0-1,5 s : « voyelle » à 180 Hz, forte.
    let graine = 7;
    const bruit = new Float32Array(FREQUENCE * 2);
    for (let i = 0; i < bruit.length; i++) bruit[i] = ((graine = (graine * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff) * 2 - 1;
    const souffle = passeBande(bruit, 1000, 5000);
    let e = 0;
    for (let i = FREQUENCE * 0.5; i < FREQUENCE * 0.8; i++) e += souffle[i] ** 2;
    const gain = Math.sqrt(10 ** (-38 / 10) / (e / (FREQUENCE * 0.3)));
    for (let i = FREQUENCE * 0.5; i < FREQUENCE * 0.8; i++) x[i] = souffle[i] * gain;
    const voyelle = sinus(0.5, 180, 0.3);
    x.set(voyelle, FREQUENCE);
    const r = detecterRespirations(x, [{ debutSec: 0, finSec: 0.95 }, { debutSec: 1.0, finSec: 1.5 }, { debutSec: 1.6, finSec: 2 }]);
    expect(r).toHaveLength(1);
    expect(r[0].debutSec).toBeGreaterThanOrEqual(0.48);
    expect(r[0].finSec).toBeLessThanOrEqual(0.82);
    expect(r[0].finSec - r[0].debutSec).toBeGreaterThan(0.2);
  });
});

describe.skipIf(!ffmpegPresent)("sur un vrai fichier son (voix de synthèse Windows, FFmpeg du poste)", () => {
  it("le texte envoyé à la voix est bien celui des prononciations substituées", () => {
    expect(preparerTexteVoix(segments, donnees.prononciations).texte).toBe(donnees.texteEnvoye.replace(" ? ", " ? "));
  });

  it("report : chaque mot du texte VALIDÉ (« PV », « 135 € ») est calé sur ce que la voix a dit pour lui", () => {
    const t = preparerTexteVoix(segments, donnees.prononciations);
    const r = reporterHorodatages(t, donnees.mots);
    expect(r.map((m) => m.mot).join(" ")).toBe(donnees.texteValide.replace(" ? ", " ? "));
    const dit = (mot: string) => donnees.mots.find((m) => m.mot.startsWith(mot))!;
    expect(r.find((m) => m.mot === "PV")).toMatchObject({ debutSec: dit("pé").debutSec, finSec: dit("vé").finSec });
    expect(r.find((m) => m.mot === "135")!.debutSec).toBe(dit("cent").debutSec);
    expect(r.find((m) => m.mot.startsWith("€"))!.finSec).toBe(dit("euros").finSec);
    expect(r.find((m) => m.mot === "Surtout,")?.segmentId).toBe("s2");
  });

  it("nettoyage réel par FFmpeg : blanc de tête < 0,1 s, blancs ramenés à ≤ 120 ms, durée et mots exactement décalés", async () => {
    const source = `${FIXTURE}.wav`;
    const plan = calculerCoupures({ mots: donnees.mots, dureeSec: donnees.dureeSec });
    expect(plan.coupures.length).toBeGreaterThanOrEqual(4); // tête, deux longs blancs entre phrases, queue

    // 1. Analyse : la voix de synthèse ne respire pas ; aucun souffle ne doit être inventé.
    const blancs = blancsLongs(donnees.mots, 180).map(({ debutSec, finSec }) => ({ debutSec, finSec }));
    const analyse = await nettoyerFichier(source, { mode: "analyse", blancs });
    expect(analyse.mesures.respirations).toBe(0);
    expect(analyse.mesures.dureeSec).toBeCloseTo(donnees.dureeSec, 2);

    // 2. Coupe réelle.
    const r = await nettoyerFichier(source, { mode: "appliquer", fonduMs: 15, coupures: plan.coupures });
    const sortie = join(dossier, "audio-maitre.wav");
    writeFileSync(sortie, r.wav!);
    const duree = Number(spawnSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", sortie]).stdout.toString());
    expect(duree).toBeCloseTo(plan.dureeSortieSec, 2);
    expect(r.mesures.coupures).toBe(plan.coupures.length);

    // 3. Les mots décalés avec les instants RÉELLEMENT coupés tombent sur de la voix dans le son nettoyé.
    const mots = decalerMots(donnees.mots, coupuresAppliquees(plan.coupures, r.mesures));
    const y = await decoderPcm(sortie);
    for (const m of mots) expect(niveauDb(y, m)).toBeGreaterThan(-45);

    // 4. FFmpeg ne trouve plus aucun silence de plus de 150 ms, sauf les 0,5 s gardées après le dernier mot.
    const silences = spawnSync("ffmpeg", ["-hide_banner", "-i", sortie, "-af", "silencedetect=n=-45dB:d=0.15", "-f", "null", "-"]).stderr.toString();
    const debuts = [...silences.matchAll(/silence_start: ([\d.]+)/g)].map((x) => Number(x[1]));
    expect(debuts.filter((t) => t < mots.at(-1)!.finSec - 0.01)).toEqual([]);
    // La voix démarre en moins de 0,1 s.
    let premier = 0;
    while (premier < y.length && Math.abs(y[premier]) < 0.01) premier++;
    expect(premier / FREQUENCE).toBeLessThan(0.1);
    expect(mots[0].debutSec).toBeLessThan(0.1);
    // Les blancs entre phrases ont été raccourcis (de ≈ 1,4 s et 1,3 s à 120 ms).
    for (let i = 0; i + 1 < mots.length; i++) expect(mots[i + 1].debutSec - mots[i].finSec).toBeLessThanOrEqual(0.12 + 0.005);
  }, 30_000);

  it("une respiration réelle insérée dans le son est reconnue et gardée à 150-250 ms", async () => {
    const x = await decoderPcm(`${FIXTURE}.wav`);
    // Souffle de 320 ms à ≈ −38 dB au milieu du long blanc qui suit « euros ? ».
    const i = donnees.mots.findIndex((m) => m.mot.startsWith("euros"));
    const centre = (donnees.mots[i].finSec + donnees.mots[i + 1].debutSec) / 2;
    let graine = 3;
    const bruit = new Float32Array(Math.round(0.32 * FREQUENCE));
    for (let k = 0; k < bruit.length; k++) bruit[k] = ((graine = (graine * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff) * 2 - 1;
    const souffle = passeBande(bruit, 1000, 5000);
    const energie = souffle.reduce((s, v) => s + v * v, 0) / souffle.length;
    const gain = Math.sqrt(10 ** (-38 / 10) / energie);
    const debut = Math.round((centre - 0.16) * FREQUENCE);
    for (let k = 0; k < souffle.length; k++) x[debut + k] += souffle[k] * gain;
    const blancs = blancsLongs(donnees.mots, 180);
    const trouves = detecterRespirations(x, blancs);
    expect(trouves).toHaveLength(1);
    expect(trouves[0].debutSec).toBeGreaterThan(centre - 0.2);
    const plan = calculerCoupures({ mots: donnees.mots, dureeSec: donnees.dureeSec, respirations: trouves });
    expect(plan.respirationsGardees).toHaveLength(1);
    const garde = plan.respirationsGardees[0].finSec - plan.respirationsGardees[0].debutSec;
    expect(garde).toBeGreaterThanOrEqual(0.15 - 1e-6);
    expect(garde).toBeLessThanOrEqual(0.25 + 1e-6);
  });
});
