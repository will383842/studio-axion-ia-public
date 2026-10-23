/**
 * MESURE VERSION 2 (15/10, v-dd3049053f88) : la part de parole se compte entre la première et la dernière fenêtre de
 * parole (les blancs ajoutés par la voix au début et à la fin ne comptent plus) ; une prise payée mesurée avant est
 * RE-MESURÉE (studio-rendu, gratuit) à la reprise, jamais relue. Doubles seulement : aucun appel payant.
 */
import { spawnSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { REGLES_NETTOYAGE_PAR_DEFAUT } from "@/briques/voix-maitre";
import { avancerVoixMaitre, versRemesure, type EtatVoixMaitre, type OutilsVoixMaitre } from "@/briques/voix-maitre/machine";
import { comparerAReference, mesureAncienne, REFERENCE_V4, verdictSurMesureAncienne, VERSION_MESURE_VOIX, type MesureVoix } from "@/briques/voix-maitre/reference";
import type { AudioMaitre } from "@/briques/voix-maitre/types";
import type { DemandeRendu, EtatRendu, FournisseurAlignement, FournisseurVoix, ServiceRendu, StockageFichiers } from "@/fournisseurs/types";
import { FREQUENCE_MESURE_VOIX, mesurerVoix, VERSION_MESURE_VOIX as VERSION_STUDIO_RENDU } from "../../../studio-rendu/src/audio/voix";
import { nettoyerFichier } from "../../../studio-rendu/src/operations/nettoyage-audio";

const ffmpegPresent = spawnSync("ffmpeg", ["-version"]).status === 0;
const F = FREQUENCE_MESURE_VOIX;

/** « Parole » synthétique : syllabes de 180 ms (note à 150 Hz) séparées de blancs de 60 ms, sur `dureeSec`. */
function parole(dureeSec: number): Float32Array {
  const x = new Float32Array(Math.round(dureeSec * F));
  for (let i = 0; i < x.length; i++) {
    const t = i / F;
    const dansSyllabe = t % 0.24 < 0.18;
    x[i] = dansSyllabe ? 0.3 * Math.sin(2 * Math.PI * 150 * t) : 0;
  }
  return x;
}

/** `x` entouré de `bordSec` de silence numérique de chaque côté (le blanc que HeyGen ajoute). */
function avecBords(x: Float32Array, bordSec: number): Float32Array {
  const b = Math.round(bordSec * F);
  const y = new Float32Array(x.length + 2 * b);
  y.set(x, b);
  return y;
}

describe("mesure version 2 : part de parole sans les bords silencieux", () => {
  it("la même parole avec 0,4 s de silence avant et après donne la même part de parole que sans les bords", () => {
    // Une phrase courte (~3 s, comme la fin « Et chez vous, qui répond aux clients qui écrivent la nuit ? »).
    const nu = parole(2.94);
    const sans = mesurerVoix(nu);
    const avec = mesurerVoix(avecBords(nu, 0.4));
    expect(sans.partieParole).toBeGreaterThan(0.6);
    expect(sans.partieParole).toBeLessThan(1);
    expect(Math.abs(avec.partieParole - sans.partieParole)).toBeLessThan(0.01);
    // Les autres mesures ne lisent que la parole : inchangées, à la fenêtre près du bord (le rythme reste par seconde du fichier).
    expect(avec.hauteurHz).toBeCloseTo(sans.hauteurHz, 1);
    expect(avec.variationHz).toBeCloseTo(sans.variationHz, 1);
    expect(avec.energie).toBeCloseTo(sans.energie, 2);
    expect(avec.dynamique).toBeCloseTo(sans.dynamique, 2);
  });

  it("l'ancienne mesure (fichier entier) perdait plus de 12 % sur cette phrase : c'était le biais", () => {
    const nu = parole(2.94);
    const y = avecBords(nu, 0.4);
    const n = Math.trunc(0.04 * F);
    const h = Math.trunc(0.01 * F);
    let fenetres = 0;
    let actives = 0;
    for (let i = 0; i < y.length - n; i += h) {
      let c = 0;
      for (let k = 0; k < n; k++) c += y[i + k] * y[i + k];
      fenetres++;
      if (Math.sqrt(c / n) > 0.02) actives++;
    }
    const ancienne = actives / fenetres;
    const juste = mesurerVoix(y).partieParole;
    expect((juste - ancienne) / juste).toBeGreaterThan(0.12);
  });

  it("un LONG BLANC AU MILIEU (1,5 s entre deux segments) fait toujours baisser la part de parole et reste REFUSÉ sur ce critère : seuls les bords sont retirés", () => {
    const segment = parole(1.5);
    const blanc = new Float32Array(Math.round(1.5 * F));
    const prise = new Float32Array(2 * segment.length + blanc.length);
    prise.set(segment, 0);
    prise.set(blanc, segment.length);
    prise.set(segment, segment.length + blanc.length);

    const continue_ = mesurerVoix(parole(3));
    const avecTrou = mesurerVoix(prise);
    const avecTrouEtBords = mesurerVoix(avecBords(prise, 0.4));

    // Le blanc intérieur compte : la part de parole chute d'environ moitié (≈ 0,73 -> ≈ 0,49).
    expect(avecTrou.partieParole).toBeLessThan(continue_.partieParole * 0.75);
    // Les bords, eux, sont retirés : le trou reste mesuré à l'identique avec ou sans bords.
    expect(Math.abs(avecTrouEtBords.partieParole - avecTrou.partieParole)).toBeLessThan(0.01);

    // Référence = la même parole continue (seule la part de parole varie) : elle passe, la prise au trou est refusée dessus.
    const reference = { ...avecTrou, ...REFERENCE_V4, partieParole: continue_.partieParole };
    const continue2 = comparerAReference({ ...reference }, reference);
    expect(continue2.ressemblante).toBe(true);
    const refuse = comparerAReference({ ...reference, partieParole: avecTrouEtBords.partieParole }, reference);
    expect(refuse.ressemblante).toBe(false);
    expect(refuse.ecarts.map((e) => e.mesure)).toEqual(["partieParole"]);
  });

  it("aucune fenêtre de parole : part de parole illisible (NaN), jamais ressemblante", () => {
    expect(Number.isNaN(mesurerVoix(new Float32Array(F)).partieParole)).toBe(true);
    expect(Number.isNaN(mesurerVoix(new Float32Array(10)).partieParole)).toBe(true);
  });

  it("la version de la mesure est la même des deux côtés (studio-rendu et la brique)", () => {
    expect(VERSION_STUDIO_RENDU).toBe(3);
    expect(VERSION_MESURE_VOIX).toBe(VERSION_STUDIO_RENDU);
  });

  it.skipIf(!ffmpegPresent)("nettoyage-audio, mode « mesure-voix » : rapporte la version 2 (mesures à plat et rapport JSON)", async () => {
    const dossier = mkdtempSync(join(tmpdir(), "mesure-v2-"));
    const chemin = join(dossier, "fin.wav");
    writeFileSync(chemin, wavPcm16(avecBords(parole(2.94), 0.4)));
    const r = await nettoyerFichier(chemin, { mode: "mesure-voix" });
    // Sans « traitement » : mesure brute, version 2 (Image → vidéo seulement demande la version 3).
    expect(r.mesures["voix.versionMesure"]).toBe(2);
    expect((r.rapport as { versionMesure: number }).versionMesure).toBe(2);
    expect(Math.abs(r.mesures["voix.partieParole"] - mesurerVoix(parole(2.94)).partieParole)).toBeLessThan(0.02);
  });
});

function wavPcm16(e: Float32Array): Buffer {
  const b = Buffer.alloc(44 + e.length * 2);
  b.write("RIFF", 0);
  b.writeUInt32LE(36 + e.length * 2, 4);
  b.write("WAVEfmt ", 8);
  b.writeUInt32LE(16, 16);
  b.writeUInt16LE(1, 20);
  b.writeUInt16LE(1, 22);
  b.writeUInt32LE(F, 24);
  b.writeUInt32LE(F * 2, 28);
  b.writeUInt16LE(2, 32);
  b.writeUInt16LE(16, 34);
  b.write("data", 36);
  b.writeUInt32LE(e.length * 2, 40);
  e.forEach((x, i) => b.writeInt16LE(Math.round(Math.max(-1, Math.min(1, x)) * 32767), 44 + i * 2));
  return b;
}

/* ------------------------------------------------------------------ */
/* Re-mesure d'une prise payée (jamais relue)                            */
/* ------------------------------------------------------------------ */

const aPlat = (m: MesureVoix) => Object.fromEntries(Object.entries(m).map(([k, v]) => [`voix.${k}`, v]));
/** Prod 15/10 : la fin courte mesurée à l'ancienne, part de parole −14 % (toléré 12 %). */
const ANCIENNE: MesureVoix = { ...REFERENCE_V4, partieParole: REFERENCE_V4.partieParole * 0.86 };

/** Son maître fait d'une fin lue deux fois (relance de ressemblance), mesurée avant la version 2. */
function audioAncien(): AudioMaitre {
  const prise = (n: number) => ({ empreinteDemande: `am#lecture-${n}`, fichierCle: `studio/brut-${n}.mp3`, coutCentimes: 30, caracteres: 60, mesure: ANCIENNE, ressemblante: false, ecarts: ["part de parole -14 % (toléré 12 %)"] });
  return {
    fichierCle: "studio/audio-maitre.wav",
    dureeSec: 2.9,
    mots: [{ mot: "Et", debutSec: 0.4, finSec: 0.5 }],
    empreinte: "am",
    reutilise: false,
    coutCentimes: 60,
    fournisseur: "heygen",
    caracteres: 120,
    coupures: 0,
    respirations: 0,
    motsParSeconde: 4,
    vitesseConseillee: 1,
    ressemblance: { prises: [prise(1), prise(2)], retenue: 0, ressemblante: false },
  };
}

function doubles(journal: string[], mesures: Record<string, number>): OutilsVoixMaitre {
  const soumises = new Map<string, DemandeRendu>();
  const voix = {
    id: "voix-double",
    mode: "reel",
    capacites: { audioSeul: true, horodatageMots: true },
    async lire() {
      journal.push("voix.lire");
      throw new Error("aucune lecture ne doit être faite");
    },
  } as unknown as FournisseurVoix;
  const stockage = {
    urlLecture: async (cle: string) => `https://stockage.test/${cle}`,
    urlLectureDuree: async (cle: string) => `https://stockage.test/${cle}`,
    urlDepotDuree: async (cle: string) => `https://depot.test/${cle}`,
  } as unknown as StockageFichiers;
  const rendu: ServiceRendu = {
    async soumettre(d) {
      journal.push(`rendu:${d.idRendu}:${String(d.parametres.mode)}:${d.entrees.audio}`);
      soumises.set(d.idRendu, d);
      return { idRendu: d.idRendu };
    },
    async etat(id): Promise<EtatRendu> {
      const d = soumises.get(id);
      return d ? { statut: "termine", sortieCle: d.sortie.cle, mesures: { dureeSec: 2.9, ...mesures } } : { statut: "inconnu" };
    },
  };
  return {
    voix: () => voix,
    stockage: () => stockage,
    aligneur: () => ({ mode: "simulation" }) as unknown as FournisseurAlignement,
    rendu: () => rendu,
    renduEstSimule: () => false,
    cle: (nom) => `studio/am/${nom}`,
    idBase: "base",
    texte: () => "Et chez vous, qui répond aux clients qui écrivent la nuit ?",
    empreinte: () => "am",
    idVoix: "voix-77ea2dbe",
    caler: () => false,
    regles: REGLES_NETTOYAGE_PAR_DEFAUT,
    avantLecture: () => void journal.push("avantLecture"),
    ressemblance: { actif: true, relancesMax: 1 },
  };
}

async function jusquAuBout(depart: EtatVoixMaitre, o: OutilsVoixMaitre): Promise<EtatVoixMaitre> {
  let e = depart;
  for (let tour = 0; tour < 20 && e.phase !== "faite"; tour++) e = JSON.parse(JSON.stringify(await avancerVoixMaitre(e, o))) as EtatVoixMaitre;
  return e;
}

describe("re-mesure d'une prise payée mesurée par une version antérieure", () => {
  it("la prise ancienne est re-mesurée (studio-rendu) et pas relue : aucun appel voix, aucune réservation, verdict recalculé", async () => {
    const journal: string[] = [];
    const audio = audioAncien();
    expect(mesureAncienne(audio)).toBe(true);
    expect(verdictSurMesureAncienne(audio)).toBe(true);
    const depart = versRemesure({ phase: "faite", audio });
    expect(depart.phase).toBe("a-remesurer");
    const fin = await jusquAuBout(depart, doubles(journal, { ...aPlat(REFERENCE_V4), "voix.versionMesure": VERSION_MESURE_VOIX }));
    expect(journal.filter((x) => x === "voix.lire" || x === "avantLecture")).toEqual([]);
    // Une re-mesure par prise payée, sur SON fichier déjà rangé, sous un identifiant neuf (jamais l'ancienne mesure).
    expect(journal).toEqual(["rendu:base-remesure-v3-l1:mesure-voix:https://stockage.test/studio/brut-1.mp3", "rendu:base-remesure-v3-l2:mesure-voix:https://stockage.test/studio/brut-2.mp3"]);
    if (fin.phase !== "faite") throw new Error("inachevé");
    const r = fin.audio.ressemblance!;
    expect(r.ressemblante).toBe(true);
    expect(r.retenue).toBe(0);
    expect(r.prises.map((p) => [p.versionMesure, p.ressemblante, p.ecarts])).toEqual([
      [VERSION_MESURE_VOIX, true, []],
      [VERSION_MESURE_VOIX, true, []],
    ]);
    // Rien d'autre ne change : même son maître, même coût (les deux lectures restent comptées une fois).
    expect({ ...fin.audio, ressemblance: undefined }).toEqual({ ...audio, ressemblance: undefined });
    expect(r.prises.map((p) => p.coutCentimes)).toEqual([30, 30]);
    expect(mesureAncienne(fin.audio)).toBe(false);
    expect(versRemesure(fin)).toBe(fin);
  });

  it("encore hors tolérance avec la mesure juste : le verdict reste « non ressemblante », toujours sans relecture", async () => {
    const journal: string[] = [];
    const loin = { ...aPlat({ ...REFERENCE_V4, hauteurHz: REFERENCE_V4.hauteurHz * 1.2 }), "voix.versionMesure": VERSION_MESURE_VOIX };
    const fin = await jusquAuBout(versRemesure({ phase: "faite", audio: audioAncien() }), doubles(journal, loin));
    if (fin.phase !== "faite") throw new Error("inachevé");
    expect(fin.audio.ressemblance!.ressemblante).toBe(false);
    expect(fin.audio.ressemblance!.prises[0].ecarts[0]).toMatch(/^hauteur \+20 %/);
    expect(journal.some((x) => x === "voix.lire" || x === "avantLecture")).toBe(false);
    expect(verdictSurMesureAncienne(fin.audio)).toBe(false);
  });

  it("service de rendu pas encore à jour (mesure version 1) : erreur claire, la mesure ancienne n'est pas reprise pour neuve", async () => {
    const journal: string[] = [];
    await expect(jusquAuBout(versRemesure({ phase: "faite", audio: audioAncien() }), doubles(journal, aPlat(REFERENCE_V4)))).rejects.toThrow(/version 1 : mettez-le à jour/);
    expect(journal.some((x) => x === "voix.lire")).toBe(false);
  });

  it("une prise neuve est mesurée avec sa version (rapport de ressemblance)", async () => {
    const journal: string[] = [];
    const o = doubles(journal, { ...aPlat(REFERENCE_V4), "voix.versionMesure": VERSION_MESURE_VOIX });
    const lue = {
      ...o,
      voix: () =>
        ({
          id: "voix-double",
          mode: "reel",
          capacites: { audioSeul: true, horodatageMots: true },
          lire: async () => ({ fichierCle: "studio/brut-1.mp3", dureeSec: 2.9, cout: { centimes: 30, devise: "EUR" }, mots: [{ mot: "Et", debutSec: 0.4, finSec: 0.5 }] }),
        }) as unknown as FournisseurVoix,
    };
    const fin = await jusquAuBout({ phase: "a-lire" }, lue);
    if (fin.phase !== "faite") throw new Error("inachevé");
    expect(fin.audio.ressemblance!.prises[0].versionMesure).toBe(VERSION_MESURE_VOIX);
    expect(mesureAncienne(fin.audio)).toBe(false);
  });
});
