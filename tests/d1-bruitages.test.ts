/**
 * D1 — bruitages modernes (`INTENSITE-ET-BRUITAGES.md` §2, contrat §4) : banque (licence par fichier, 3-5 variantes,
 * « à vérifier »), service (aucun son non validé posé), paramètres de composition (rien en « Aucun »), mixage
 * (18-24 dB sous la voix, passe-haut 120 Hz, voix inchangée) mesuré avec le FFmpeg du poste.
 */
import { existsSync, mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { describe, expect, it } from "vitest";
import { REGLES_BRUITAGES, choisirVariante, declencheurIllustration, GAIN_SOUS_VOIX_DB } from "@/briques/intensite";
import { parametresComposition } from "@/moteurs/montage-avocat/composition";
import { elementsBruitages, fichiersBruitages, SONS_BANQUE } from "@/donnees/bruitages";
import type { BruitageDisponible, CommandeFabrication } from "@/domaine/types";
import { reinitialiserDepots } from "@/donnees/memoire";
import { etape16Bruitages } from "@/services/migrations/etape-16-bruitages";
import { mesurerEcarts, niveauActifDb, passeHaut, poserBruitages } from "../studio-rendu/src/son/bruitages";
import { preparerSon } from "../studio-rendu/src/son/chaine";
import { decoderPcm, FREQUENCE } from "../studio-rendu/src/audio/pcm";
import { mesurerFichier } from "../studio-rendu/src/son/mesure";

const RACINE = resolve(__dirname, "..");
const ffmpegPresent = spawnSync("ffmpeg", ["-version"]).status === 0;

describe("D1 — banque de bruitages", () => {
  it("20 sons, 4 variantes par déclencheur, durées dans les règles, fichiers présents, licence commerciale sur CHAQUE élément", () => {
    expect(SONS_BANQUE).toHaveLength(20);
    const manifeste = JSON.parse(readFileSync(join(RACINE, "public", "bruitages", "manifeste.json"), "utf8")) as { sons: { fichier: string; dureeSec: number; niveauActifDb: number; creteDb: number }[] };
    for (const d of Object.keys(REGLES_BRUITAGES.dureeMaxMs) as (keyof typeof REGLES_BRUITAGES.dureeMaxMs)[]) {
      const n = SONS_BANQUE.filter((s) => s.declencheur === d).length;
      expect(n).toBeGreaterThanOrEqual(REGLES_BRUITAGES.variantes[0]);
      expect(n).toBeLessThanOrEqual(REGLES_BRUITAGES.variantes[1]);
    }
    for (const s of SONS_BANQUE) {
      expect(s.dureeSec * 1000).toBeLessThan(REGLES_BRUITAGES.dureeMaxMs[s.declencheur]);
      const m = manifeste.sons.find((x) => x.fichier === `${s.declencheur}-${s.variante}.wav`)!;
      expect(m.dureeSec).toBeCloseTo(s.dureeSec, 2);
      expect(m.creteDb).toBeLessThanOrEqual(-3 + 1e-6);
      expect(Math.abs(m.niveauActifDb + 20)).toBeLessThan(0.6);
      expect(existsSync(join(RACINE, "public", "bruitages", m.fichier))).toBe(true);
    }
    const elements = elementsBruitages("2026-10-02T00:00:00.000Z");
    for (const e of elements) {
      expect(e.licence.usageCommercial).toBe(true);
      expect(e.licence.source).toMatch(/CC0/);
      expect(e.valeur.type === "bruitage" && e.valeur.ecoute).toBe("a_verifier");
    }
    expect(fichiersBruitages("x").every((f) => f.cleStockage.startsWith("/bruitages/") && f.mime === "audio/wav")).toBe(true);
  });

  it("migration étape 16 : ajoute la banque « à vérifier », ne réécrit jamais un son validé, idempotente, rien n'est supprimé", async () => {
    const d = reinitialiserDepots();
    const avant = (await d.elements.lister()).length;
    const r1 = await etape16Bruitages(d, "2026-10-02T00:00:00.000Z");
    expect(r1?.sonsAjoutes).toHaveLength(20);
    const un = (await d.elements.obtenir("bruit-chiffre-1"))!;
    await d.elements.modifier(un.id, { valeur: { ...un.valeur, ecoute: "validee" } as typeof un.valeur });
    expect(await etape16Bruitages(d, "2026-10-03T00:00:00.000Z")).toBeNull();
    const apres = await d.elements.obtenir("bruit-chiffre-1");
    expect(apres?.valeur.type === "bruitage" && apres.valeur.ecoute).toBe("validee");
    expect((await d.elements.lister()).length).toBe(avant + 20);
  });

  it("variantes tirées sans répétition consécutive ; déclencheur d'une illustration lu dans son intention", () => {
    const sons: BruitageDisponible[] = [1, 2, 3].map((v) => ({ elementId: `s${v}`, declencheur: "chiffre", variante: v, dureeSec: 0.09 }));
    let derniere: string | undefined;
    for (let rang = 0; rang < 12; rang++) {
      const s = choisirVariante(sons, rang, 5, derniere)!;
      expect(s.elementId).not.toBe(derniere);
      derniere = s.elementId;
    }
    expect(declencheurIllustration("un avis de contravention posé sur une table")).toBe("document");
    expect(declencheurIllustration("un téléphone avec une notification")).toBe("telephone");
    expect(declencheurIllustration("un radar au bord de la route")).toBe("illustration-forte");
  });
});

/** Commande minimale du format avocat pour `parametresComposition` (son seul). */
function commande(extra: Partial<CommandeFabrication> = {}): CommandeFabrication {
  return {
    versionContrat: 2,
    moteurId: "montage-avocat",
    videoId: "v-essai",
    formatId: "avocat",
    ratios: ["9:16"],
    dureeCibleSec: 10,
    script: { blocs: [], texteComplet: "" },
    distribution: [],
    styles: { lut: null, sousTitres: null, musique: null },
    briques: { "sous-titres": false, etalonnage: false, illustrations: false, son: true, habillage: false, "texte-ecran": false, "mention-ia": false },
    entrees: {},
    reglages: {},
    plans: [],
    prononciations: [],
    mentionIA: { active: false },
    construiteLe: "2026-10-02T00:00:00.000Z",
    ...extra,
  } as unknown as CommandeFabrication;
}

describe("D1 — paramètres du son (brique composition)", () => {
  const plans = [{ ordre: 1, debutSec: 0, finSec: 10, texte: "x", segmentId: "s", sourceImage: "double", cadrage: { pointInteret: { x: 0.5, y: 0.4 }, zoom: 1 }, transition: "coupe" }] as never;
  it("« Aucun » (ou aucun son posé) : le champ `bruitages` est ABSENT, paramètres identiques à ceux d'avant le lot", () => {
    const sans = parametresComposition(commande(), { ratio: "9:16", plans, segments: [], dureeSec: 10 });
    const vide = parametresComposition(commande(), { ratio: "9:16", plans, segments: [], dureeSec: 10, bruitages: [] });
    expect(sans.son.bruitages).toBeUndefined();
    expect(vide).toEqual(sans);
  });
  it("sons posés : une entrée par son (fichier de la commande), gain sous la voix, passe-haut 120 Hz ; rien si la brique son est coupée", () => {
    const c = commande({ medias: { "bruit-chiffre-1": { cle: "/bruitages/chiffre-1.wav", mime: "audio/wav" } } });
    const b = [{ elementId: "bruit-chiffre-1", declencheur: "chiffre" as const, debutSec: 3.2, dureeSec: 0.09, gainDb: GAIN_SOUS_VOIX_DB }];
    const p = parametresComposition(c, { ratio: "9:16", plans, segments: [], dureeSec: 10, bruitages: b });
    expect(p.son.bruitages).toEqual([{ entree: "bruitage-1", debutSec: 3.2, gainDb: -21, passeHautHz: 120 }]);
    expect(p.entrees["bruitage-1"]).toBe("/bruitages/chiffre-1.wav");
    const coupe = parametresComposition({ ...c, briques: { ...c.briques, son: false } }, { ratio: "9:16", plans, segments: [], dureeSec: 10, bruitages: b });
    expect(coupe.son.bruitages).toBeUndefined();
  });
});

describe("D1 — mixage (purs)", () => {
  it("passe-haut 120 Hz : un 50 Hz perd plus de 12 dB, un 1 kHz passe", () => {
    const sin = (f: number) => Float32Array.from({ length: FREQUENCE }, (_, i) => Math.sin((2 * Math.PI * f * i) / FREQUENCE) * 0.5);
    expect(niveauActifDb(passeHaut(sin(50), 120)) - niveauActifDb(sin(50))).toBeLessThan(-12);
    expect(Math.abs(niveauActifDb(passeHaut(sin(1000), 120)) - niveauActifDb(sin(1000)))).toBeLessThan(0.3);
  });
  it("un son posé à −21 dB tombe à 21 dB sous la voix (même mesure), la voix n'est pas touchée, aucun son : mélange identique", () => {
    const voix = Float32Array.from({ length: FREQUENCE * 4 }, (_, i) => Math.sin((2 * Math.PI * 300 * i) / FREQUENCE) * 0.3 * (Math.floor(i / 9600) % 3 === 2 ? 0 : 1));
    const son = Float32Array.from({ length: Math.round(FREQUENCE * 0.15) }, (_, i) => Math.sin((2 * Math.PI * 1500 * i) / FREQUENCE) * Math.exp(-i / 800));
    const mix = Float32Array.from(voix);
    const r = poserBruitages(mix, voix, [{ pcm: son, debutSec: 1, gainDb: -21, passeHautHz: 120 }]);
    const m = mesurerEcarts(voix, r.piste, [1]);
    expect(m.ecartsDb[0]).toBeGreaterThanOrEqual(18);
    expect(m.ecartsDb[0]).toBeLessThanOrEqual(24);
    expect(Math.abs(m.ecartsDb[0] - 21)).toBeLessThan(0.6);
    const vide = Float32Array.from(voix);
    const r0 = poserBruitages(vide, voix, []);
    expect(vide).toEqual(voix);
    expect(r0.piste.every((x) => x === 0)).toBe(true);
  });
});

describe.skipIf(!ffmpegPresent)("D1 — mixage avec le FFmpeg du poste (voix d'essai réelle)", () => {
  const voix = join(RACINE, "tests", "fixtures", "voix-essai.wav");
  it("« Aucun » : son final identique octet pour octet à la chaîne d'avant ; avec des sons : sonie de la voix inchangée (±0,2 LU), sons 18-24 dB sous la voix", async () => {
    const dossierA = mkdtempSync(join(tmpdir(), "d1-a-"));
    const dossierB = mkdtempSync(join(tmpdir(), "d1-b-"));
    const dossierC = mkdtempSync(join(tmpdir(), "d1-c-"));
    const pcmVoix = await decoderPcm(voix);
    const dureeSec = +(pcmVoix.length / FREQUENCE).toFixed(3);
    const base = { voix, dureeSec, passeHautHz: 80, seuilLraCompression: 3, ratioCompression: 3, lufs: -14, creteVraieMaxDbtp: -1.5, tonPieceDb: -42.5, graine: 3 };
    const a = await preparerSon({ ...base, dossier: dossierA });
    const b = await preparerSon({ ...base, dossier: dossierB, bruitages: [] });
    expect(readFileSync(b.chemin).equals(readFileSync(a.chemin))).toBe(true);
    expect(b.bruitages).toBeUndefined();
    const sons = [
      { chemin: join(RACINE, "public", "bruitages", "chiffre-1.wav"), debutSec: 0.8, gainDb: -21, passeHautHz: 120 },
      { chemin: join(RACINE, "public", "bruitages", "impact-2.wav"), debutSec: Math.max(1.2, dureeSec - 1.6), gainDb: -21, passeHautHz: 120 },
    ];
    const c = await preparerSon({ ...base, dossier: dossierC, bruitages: sons });
    const ma = await mesurerFichier(a.chemin, []);
    const mc = await mesurerFichier(c.chemin, []);
    expect(Math.abs(mc.lufs - ma.lufs)).toBeLessThanOrEqual(0.2);
    expect(c.gainDb).toBeCloseTo(a.gainDb, 1);
    const voixTraitee = await decoderPcm(join(dossierC, "voix-traitee.wav"));
    const piste = await decoderPcm(c.bruitages!.chemin);
    const m = mesurerEcarts(voixTraitee, piste, sons.map((s) => s.debutSec));
    for (const e of m.ecartsDb) {
      expect(e).toBeGreaterThanOrEqual(18);
      expect(e).toBeLessThanOrEqual(24);
    }
  }, 120_000);
});
