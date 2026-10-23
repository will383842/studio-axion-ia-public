/**
 * SOUFFLE DANS LA VOIX DU TABLEAU (14/10/2026). Mesure de Will : dans nos vidéos tableau, les blancs (entre les mots et
 * dans les 2,7 s de fin) sont à −43/−45 dB en continu, bruit plutôt grave ; dans la vidéo de référence v4, −56/−69 dB.
 * Deux causes, trouvées et corrigées :
 *  1. la composition posait sous la voix un ton de pièce de synthèse (bruit brun grave) à −42,5 dB, de la première à
 *     la dernière image (aucun profil de son pour le tableau) → profil du tableau, ton de pièce à −66 dB ;
 *  2. la recette (compresseur 3:1, rattrapage ×3, puis `loudnorm`) remonte le bruit de fond de la voix d'environ 8 dB
 *     → porte de bruit APRÈS le compresseur et AVANT la `loudnorm` (écoute de l'aigu, 10 ms d'anticipation).
 * Signal SYNTHÉTIQUE (salves de parole simulées, consonnes douces au début et à la fin de chaque salve, bruit grave à
 * −44 dB partout) et la voix d'essai du dépôt (`tests/fixtures/voix-essai.wav`, synthèse locale). FFmpeg du poste ;
 * aucun appel payant.
 */
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import type { MotHorodate } from "../../../src/domaine/types";
import { parametresRecette, planRecetteVoix, RECETTE_VOIX_TABLEAU, reglagesRecette } from "../../../src/moteurs/montage-tableau/recette-voix";
import { commandeTableau, PROFIL_SON_TABLEAU } from "../../../src/moteurs/montage-tableau/fabriquer";
import { decoderPcm, FREQUENCE, niveauDb, versWav } from "../../../studio-rendu/src/audio/pcm";
import { argumentsRecette, graphePorte, lirePorte, nettoyerFichier } from "../../../studio-rendu/src/operations/nettoyage-audio";
import { preparerSon } from "../../../studio-rendu/src/son/chaine";
import { copie, ficheDemonstration } from "../regles/exemples";

const ffmpeg = spawnSync("ffmpeg", ["-version"]).status === 0;
const dossier = mkdtempSync(join(tmpdir(), "souffle-"));
const K = RECETTE_VOIX_TABLEAU.filtres.atempo;

/* ------------------------------------------------------------------ */
/* Signal synthétique                                                    */
/* ------------------------------------------------------------------ */

/** Générateur stable. */
function hasard(graine: number): () => number {
  let x = graine >>> 0 || 1;
  return () => ((x = (x * 1664525 + 1013904223) >>> 0) / 4294967296) * 2 - 1;
}

const rms = (x: Float32Array) => Math.sqrt(x.reduce((s, v) => s + v * v, 0) / Math.max(1, x.length));

/**
 * Salves de « parole » (harmoniques d'une voix de 140 Hz, syllabes à 3,5 par seconde, −18 dB), une consonne douce
 * (souffle aigu à −38 dB, 60 ms) avant chaque salve et une autre (70 ms) après, séparées par des blancs ; bruit grave
 * (bruit brun) à `bruitDb` partout, et 3 s de blanc à la fin.
 */
function signalSynthetique(bruitDb: number): { x: Float32Array; salves: [number, number][] } {
  const blancs = [0.6, 1.0, 0.8];
  const salves: [number, number][] = [];
  let t = 0.5;
  for (const b of [...blancs, 0]) {
    salves.push([t, t + 1.4]);
    t += 1.4 + b;
  }
  const n = Math.round((t + 3) * FREQUENCE);
  const r = hasard(7);
  const bruit = new Float32Array(n);
  let brun = 0;
  for (let i = 0; i < n; i++) bruit[i] = brun = 0.985 * brun + 0.15 * r();
  const gb = 10 ** (bruitDb / 20) / rms(bruit);
  const voix = new Float32Array(n);
  for (const [a, z] of salves)
    for (let i = Math.round(a * FREQUENCE); i < Math.round(z * FREQUENCE); i++) {
      const u = i / FREQUENCE - a;
      const env = Math.abs(Math.sin(Math.PI * 3.5 * u)) ** 0.6 * Math.min(1, u / 0.02, (z - a - u) / 0.02);
      const f0 = 140 + 20 * Math.sin(2 * Math.PI * 0.7 * u);
      let s = 0;
      for (let h = 1; h <= 12; h++) s += Math.sin(2 * Math.PI * f0 * h * (i / FREQUENCE)) / h;
      voix[i] = env * (s + 0.15 * r());
    }
  const parle = voix.filter((v) => v !== 0);
  const gv = 10 ** (-18 / 20) / rms(parle);
  const x = new Float32Array(n);
  for (let i = 0; i < n; i++) x[i] = bruit[i] * gb + voix[i] * gv;
  // Consonnes douces (souffle aigu) : attaque de 60 ms avant la salve, fin de 70 ms après.
  const gf = 10 ** (-38 / 20) * Math.sqrt(3);
  let hp = 0;
  let prec = 0;
  const souffle = () => {
    const v = r();
    hp = 0.7 * (hp + v - prec);
    prec = v;
    return hp;
  };
  for (const [a, z] of salves) {
    for (let i = Math.round((a - 0.06) * FREQUENCE); i < Math.round(a * FREQUENCE); i++) x[i] += gf * souffle() * ((i / FREQUENCE - (a - 0.06)) / 0.06);
    for (let i = Math.round(z * FREQUENCE); i < Math.round((z + 0.07) * FREQUENCE); i++) x[i] += gf * souffle() * (1 - (i / FREQUENCE - z) / 0.07);
  }
  return { x, salves };
}

/** Niveau intégré (LUFS) mesuré par FFmpeg. */
function lufs(chemin: string): number {
  const r = spawnSync("ffmpeg", ["-hide_banner", "-nostats", "-i", chemin, "-af", "ebur128", "-f", "null", "-"], { encoding: "utf8" });
  const m = [...r.stderr.matchAll(/^\s+I:\s+(-?[\d.]+) LUFS/gm)].at(-1);
  return m ? Number(m[1]) : NaN;
}

/** La recette du tableau, filtres seuls (un seul morceau : tout le son), avec ou sans la porte. */
function recetteEntiere(dureeSec: number, porte: boolean): Record<string, unknown> {
  const plan = planRecetteVoix([{ mot: "a", debutSec: 0, finSec: dureeSec }], dureeSec);
  const p = { ...parametresRecette(plan), morceaux: [{ debutSec: 0, finSec: dureeSec }], debutFonduSortieSec: dureeSec / K - 0.05, fonduSortieSec: 0.05 };
  if (!porte) delete (p as { porte?: unknown }).porte;
  return p;
}

/* ------------------------------------------------------------------ */
/* Calcul pur                                                            */
/* ------------------------------------------------------------------ */

describe("porte de bruit : réglages et graphe (calcul pur)", () => {
  it("la recette porte la porte : après le compresseur, avant la `loudnorm` ; elle entre dans les réglages tracés", () => {
    const plan = planRecetteVoix([{ mot: "Bonjour.", debutSec: 0.2, finSec: 0.8 }], 1.5);
    const p = parametresRecette(plan);
    expect(p.porte).toEqual({ detectionHz: 400, seuilDb: -36, plageDb: -30, ratio: 10, attaqueMs: 5, relachementMs: 50, anticipationMs: 20 });
    expect(reglagesRecette()).toMatchObject({ porte: p.porte });
    const args = argumentsRecette("/tmp/s", "/tmp/o.wav", p);
    const g = args[args.indexOf("-filter_complex") + 1];
    const i = (x: string) => g.indexOf(x);
    expect(i("acompressor")).toBeGreaterThan(0);
    expect(i("sidechaingate")).toBeGreaterThan(i("acompressor"));
    expect(i("loudnorm")).toBeGreaterThan(i("sidechaingate"));
    expect(g).toContain("[cp]asplit=2[pv][pe]");
    expect(g).toContain("adelay=delays=20:all=1");
    expect(g).toContain("highpass=f=400,highpass=f=400,apad=pad_dur=0.0200");
    expect(g).toContain("sidechaingate=threshold=-36dB:range=-30dB:ratio=10:attack=5:release=50,atrim=start=0.0200,asetpts=PTS-STARTPTS[cg]");
    expect(g).toContain("[cg]loudnorm=I=-14:TP=-1.5:LRA=7,aresample=48000");
  });

  it("sans porte, le graphe est celui d'avant, à l'identique (cas concret et anciennes demandes)", () => {
    const plan = planRecetteVoix([{ mot: "Bonjour.", debutSec: 0.2, finSec: 0.8 }], 1.5);
    const { porte: _porte, ...sans } = parametresRecette(plan);
    void _porte;
    const g = argumentsRecette("/tmp/s", "/tmp/o.wav", sans).join(" ");
    expect(g).not.toContain("sidechaingate");
    expect(g).toContain("concat=n=1:v=0:a=1[c];[c]atempo=1,highpass=f=70,acompressor=threshold=-20dB:ratio=3:attack=5:release=80:makeup=3,loudnorm=I=-14:TP=-1.5:LRA=7,aresample=48000");
  });

  it("une porte hors limites est refusée (rien d'autre n'entre dans le graphe FFmpeg)", () => {
    expect(lirePorte(undefined)).toBeUndefined();
    expect(() => lirePorte({ ...RECETTE_VOIX_TABLEAU.porte, seuilDb: 0 })).toThrow(/seuilDb/);
    expect(() => lirePorte({ ...RECETTE_VOIX_TABLEAU.porte, detectionHz: "1500;amovie=x" })).toThrow(/detectionHz/);
    expect(graphePorte(lirePorte(RECETTE_VOIX_TABLEAU.porte)!, "a", "b")).toMatch(/^\[a\]asplit=2.*\[b\]$/);
  });

  it("composition du tableau : ton de pièce à −66 dB (au lieu de −42,5 dB par défaut), niveau −14 LUFS", () => {
    const c = commandeTableau({ videoId: "v", fiche: copie(ficheDemonstration), texteScript: "x", dureeSec: 30, centreSousTitresPct: 80, scenes: [] });
    expect(c.styles.profilSon?.valeur).toEqual(PROFIL_SON_TABLEAU);
    expect(PROFIL_SON_TABLEAU.tonPieceDb).toEqual([-66, -66]);
    expect(PROFIL_SON_TABLEAU.niveauCibleLufs).toBe(-14);
  });
});

/* ------------------------------------------------------------------ */
/* Sur du vrai son (FFmpeg du poste)                                     */
/* ------------------------------------------------------------------ */

describe.runIf(ffmpeg)("porte de bruit sur du vrai son (FFmpeg)", () => {
  const { x, salves } = signalSynthetique(-44);
  const source = join(dossier, "synthetique.wav");
  writeFileSync(source, versWav(x));
  // Le même signal SANS bruit : la référence des consonnes douces (la porte retire le bruit, jamais la voix).
  const sourcePropre = join(dossier, "synthetique-propre.wav");
  writeFileSync(sourcePropre, versWav(signalSynthetique(-150).x));
  const dureeSec = x.length / FREQUENCE;
  /** Temps du son traité (après `atempo`). */
  const S = salves.map(([a, z]) => [a / K, z / K] as const);
  /** Blancs : entre deux salves, hors consonnes douces (70 ms) ; puis la fin. */
  const blancs = S.slice(0, -1).map(([, z], i) => ({ debutSec: z + 0.09, finSec: S[i + 1][0] - 0.08 }));
  const fin = { debutSec: S.at(-1)![1] + 0.2, finSec: dureeSec / K - 0.1 };

  const traiter = async (nom: string, porte: boolean, entree = source) => {
    const r = await nettoyerFichier(entree, recetteEntiere(dureeSec, porte));
    const chemin = join(dossier, `${nom}.wav`);
    writeFileSync(chemin, r.wav!);
    return { chemin, y: await decoderPcm(chemin) };
  };

  it("bruit grave à −44 dB : blancs ≤ −55 dB avec la porte ; parole, fins et débuts de mots inchangés ; −14 LUFS", async () => {
    const avant = await traiter("sans-porte", false);
    const apres = await traiter("avec-porte", true);
    const niveaux = (y: Float32Array) => ({ blancs: blancs.map((b) => niveauDb(y, b)), fin: niveauDb(y, fin), parole: S.map(([a, z]) => niveauDb(y, { debutSec: a + 0.05, finSec: z - 0.05 })) });
    const n0 = niveaux(avant.y);
    const n1 = niveaux(apres.y);
    console.log(`Blancs (dB) sans porte : ${n0.blancs.map((v) => v.toFixed(1)).join(" / ")}, fin ${n0.fin.toFixed(1)} ; avec porte : ${n1.blancs.map((v) => v.toFixed(1)).join(" / ")}, fin ${n1.fin.toFixed(1)}`);
    // Avant : la recette laisse le bruit au-dessus de −45 dB (il est même remonté).
    for (const v of n0.blancs) expect(v).toBeGreaterThan(-45);
    // Après : silences ≤ −55 dB.
    for (const v of [...n1.blancs, n1.fin]) expect(v).toBeLessThanOrEqual(-55);
    // Parole inchangée (à 0,3 dB près) ; bords des mots (50 ms) : rien de plus, et au plus 2 dB de moins (le bruit retiré
    // sous la consonne ; la consonne elle-même est vérifiée porte seule, plus bas).
    n1.parole.forEach((v, i) => expect(Math.abs(v - n0.parole[i])).toBeLessThanOrEqual(0.3));
    for (const [a, z] of S)
      for (const bord of [{ debutSec: a - 0.05, finSec: a }, { debutSec: z, finSec: z + 0.05 }]) {
        expect(niveauDb(apres.y, bord)).toBeLessThanOrEqual(niveauDb(avant.y, bord) + 0.5);
        expect(niveauDb(apres.y, bord)).toBeGreaterThanOrEqual(niveauDb(avant.y, bord) - 2);
      }
    // Même durée (l'anticipation est rendue), niveau intégré à −14 LUFS.
    expect(Math.abs(apres.y.length - avant.y.length)).toBeLessThanOrEqual(2);
    expect(Math.abs(lufs(apres.chemin) + 14)).toBeLessThanOrEqual(1);
  }, 60_000);

  it("porte seule (sans compresseur ni `loudnorm`, plus sévère) : chaque consonne douce garde le niveau de la voix SANS bruit", async () => {
    const porteSeule = (entree: string) => nettoyerFichier(entree, { ...recetteEntiere(dureeSec, true), filtres: "", fonduSortieSec: 0, silenceFinSec: 0 }).then((r) => {
      const chemin = join(dossier, `porte-seule-${entree === source ? "bruit" : "propre"}.wav`);
      writeFileSync(chemin, r.wav!);
      return decoderPcm(chemin);
    });
    const bruite = await porteSeule(source);
    const propre = await porteSeule(sourcePropre);
    for (const [a, z] of salves)
      for (const bord of [{ debutSec: a - 0.06, finSec: a }, { debutSec: z, finSec: z + 0.07 }, { debutSec: a, finSec: z }]) expect(niveauDb(bruite, bord)).toBeGreaterThanOrEqual(niveauDb(propre, bord) - 1);
  }, 60_000);

  it("son final (mixage de la composition) : avant −43/−45 dB dans les blancs et la fin ; après ≤ −55 dB", async () => {
    const avant = await traiter("recette-avant", false);
    const apres = await traiter("recette-apres", true);
    const video = dureeSec / K + 2.7;
    const mixer = async (voix: string, tonPieceDb: number, nom: string) => {
      const d = join(dossier, nom);
      execFileSync("mkdir", ["-p", d]);
      const s = await preparerSon({ voix, dureeSec: video, dossier: d, passeHautHz: 80, seuilLraCompression: 3, ratioCompression: 3, lufs: -14, creteVraieMaxDbtp: -1.5, tonPieceDb, graine: 7 });
      return { chemin: s.chemin, y: await decoderPcm(s.chemin) };
    };
    const m0 = await mixer(avant.chemin, -42.5, "mix-avant");
    const m1 = await mixer(apres.chemin, PROFIL_SON_TABLEAU.tonPieceDb![0], "mix-apres");
    const finVideo = { debutSec: video - 2.7, finSec: video - 0.05 };
    const mesure = (y: Float32Array) => ({ blancs: blancs.map((b) => niveauDb(y, b)), fin: niveauDb(y, finVideo) });
    const a = mesure(m0.y);
    const b = mesure(m1.y);
    console.log(`Son final · blancs (dB) avant : ${a.blancs.map((v) => v.toFixed(1)).join(" / ")}, 2,7 s de fin ${a.fin.toFixed(1)} ; après : ${b.blancs.map((v) => v.toFixed(1)).join(" / ")}, fin ${b.fin.toFixed(1)}`);
    for (const v of [...a.blancs, a.fin]) expect(v).toBeGreaterThan(-46);
    for (const v of [...b.blancs, b.fin]) expect(v).toBeLessThanOrEqual(-55);
    expect(Math.abs(lufs(m1.chemin) + 14)).toBeLessThanOrEqual(1);
  }, 120_000);

  it("vraie voix (voix d'essai du dépôt) + bruit grave à −44 dB : aucun mot baissé, blancs retirés", async () => {
    const donnees = JSON.parse(readFileSync("tests/fixtures/voix-essai.json", "utf8")) as { dureeSec: number; mots: MotHorodate[] };
    const voix = await decoderPcm("tests/fixtures/voix-essai.wav");
    const r = hasard(11);
    const bruit = new Float32Array(voix.length);
    let brun = 0;
    for (let i = 0; i < voix.length; i++) bruit[i] = brun = 0.985 * brun + 0.15 * r();
    const g = 10 ** (-44 / 20) / rms(bruit);
    const melange = voix.map((v, i) => v + bruit[i] * g);
    const chemin = join(dossier, "voix-bruit.wav");
    writeFileSync(chemin, versWav(melange));
    const plan = planRecetteVoix(donnees.mots, donnees.dureeSec);
    const p = parametresRecette(plan);
    const { porte: _p, ...sans } = p;
    void _p;
    const sortie = async (params: Record<string, unknown>, nom: string, entree = chemin) => {
      const w = (await nettoyerFichier(entree, params)).wav!;
      writeFileSync(join(dossier, nom), w);
      return decoderPcm(join(dossier, nom));
    };
    const a = await sortie(sans, "v0.wav");
    const b = await sortie(p, "v1.wav");
    expect(Math.abs(a.length - b.length)).toBeLessThanOrEqual(2);
    // Porte seule (sans compresseur ni `loudnorm`) : la voix bruitée passée à la porte contre la même voix SANS bruit.
    const seule = { ...p, filtres: "", fonduSortieSec: 0, silenceFinSec: 0 };
    const vb = await sortie(seule, "v-porte-bruit.wav");
    // Copie de la voix propre (l'opération écrit son résultat à côté de sa source).
    const copiePropre = join(dossier, "voix-essai-propre.wav");
    writeFileSync(copiePropre, readFileSync("tests/fixtures/voix-essai.wav"));
    const vc = await sortie({ ...sans, filtres: "", fonduSortieSec: 0, silenceFinSec: 0 }, "v-propre.wav", copiePropre);
    // Chaque mot (temps du son resserré, avant `atempo`) : au moins le niveau de la voix sans bruit, à 1 dB près.
    for (const m of plan.mots) {
      const w = { debutSec: m.debutSec * K, finSec: m.finSec * K };
      expect(niveauDb(vb, w), m.mot).toBeGreaterThanOrEqual(niveauDb(vc, w) - 1);
    }
    // Recette complète : chaque mot, et la fin du dernier avec le début de sa queue (0,15 s), garde son niveau (à 1,5 dB
    // près, le bruit retiré compris), jamais plus fort.
    const dernier = plan.mots.at(-1)!;
    for (const w of [...plan.mots.map((m) => ({ nom: m.mot, debutSec: m.debutSec, finSec: m.finSec })), { nom: "queue", debutSec: dernier.finSec - 0.05, finSec: dernier.finSec + 0.15 }]) {
      expect(niveauDb(b, w), w.nom).toBeGreaterThanOrEqual(niveauDb(a, w) - 1.5);
      expect(niveauDb(b, w), w.nom).toBeLessThanOrEqual(niveauDb(a, w) + 0.5);
    }
    // Le blanc après « euros ? » (fin de phrase, 0,20 s gardé) : le bruit y est baissé.
    const i = plan.mots.findIndex((m) => m.mot.startsWith("euros"));
    const blanc = { debutSec: plan.mots[i].finSec + 0.06, finSec: plan.mots[i + 1].debutSec - 0.04 };
    console.log(`Vraie voix · blanc après « euros ? » : ${niveauDb(a, blanc).toFixed(1)} dB sans porte, ${niveauDb(b, blanc).toFixed(1)} dB avec`);
    expect(niveauDb(b, blanc)).toBeLessThan(niveauDb(a, blanc) - 10);
  }, 60_000);
});
