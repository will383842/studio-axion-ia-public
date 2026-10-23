/**
 * 15/10 (prod v-dd3049053f88, trav-f2b26bba35ac) : la voix était faite, l'ASSEMBLAGE s'arrêtait en Q17 « Le son brut du
 * corps (youtube-shorts) n'est pas un WAV lisible » : le son brut gardé est la copie HeyGen, un MP3, et les doubles rendaient déjà
 * du WAV. Ici, AUCUN double ne triche sur le format :
 *  - les sons bruts sont de VRAIS MP3 (FFmpeg du poste) ;
 *  - la conversion est celle du studio (`convertirSonEnWavParFfmpeg`, `argumentsSonWav`) ;
 *  - la piste voix seule est faite par la VRAIE recette de `studio-rendu` (`nettoyerFichier`, mode `recette`, sur le MP3).
 * (a) MP3 → silences mesurés alignés sur le son, assemblage et vidéo au bout ; le WAV converti est rangé et relu, le MP3
 *     payé n'est jamais modifié ; (b) reprise depuis l'état EXACT de la prod (refus Q17, non réessayable gardé) :
 *     « Refaire cette partie » est proposé, et la reprise va au bout sans AUCUNE lecture ni réservation de voix.
 */
import { spawnSync } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { decoderPcm } from "../../studio-rendu/src/audio/pcm";
import { nettoyerFichier } from "../../studio-rendu/src/operations/nettoyage-audio";
import { refusReessayableIV, vueFabrication } from "@/components/formats/image-video/vue";
import { brutEnWav, cleWavDuBrut, estWav, SUITE_REFUS_WAV_IV, type OutilsAssemblageIV } from "@/moteurs/montage-image-video/assemblage";
import { lireWav, silencesMesures } from "@/moteurs/montage-image-video/emprunts";
import { attendWillIV, avancerJusquAArretIV, etatInitialIV, reprendreIV, validerCarteIV, validerScriptIV, type EtatFabricationIV, type OutilsFabricationIV } from "@/moteurs/montage-image-video/fabrication";
import { convertirSonEnWavParFfmpeg } from "@/services/image-video";
import { carteFixe, demandeEssai, enMp3, monde, outilsSimules, type Monde, type OptionsMonde } from "./doubles-fabrication";

vi.setConfig({ testTimeout: 300_000 });

const FFMPEG_PRESENT = spawnSync("ffmpeg", ["-version"]).status === 0;

/** Piste voix seule par la VRAIE recette de `studio-rendu`, sur les sons bruts tels que rangés (MP3). */
function traiterVoixReelle(m: Monde): OutilsAssemblageIV["traiterVoix"] {
  return async (d) => {
    const dossier = await mkdtemp(join(tmpdir(), "iv-recette-"));
    try {
      const source = join(dossier, "audio");
      await writeFile(source, m.sons.get(d.recette.corps)!);
      const source2 = d.recette.fin ? join(dossier, "audio2") : undefined;
      if (source2) await writeFile(source2, m.sons.get(d.recette.fin!)!);
      const r = await nettoyerFichier(source, { ...d.recette.parametres, tempo: d.tempo }, undefined, source2);
      const cle = `voix-seule/${d.id}.wav`;
      m.sons.set(cle, new Uint8Array(r.wav!));
      return { cle, dureeSec: r.mesures.dureeSec };
    } finally {
      await rm(dossier, { recursive: true, force: true });
    }
  };
}

/** Outils réels de l'assemblage (conversion du studio, recette de studio-rendu) ; conversions comptées. */
function assemblageReel(m: Monde, compte: { conversions: number }): Partial<OutilsAssemblageIV> {
  return {
    convertirEnWav: async (o) => {
      compte.conversions++;
      return convertirSonEnWavParFfmpeg(o);
    },
    traiterVoix: traiterVoixReelle(m),
  };
}

const decisionScript = (e: EtatFabricationIV) => ({ proposition: e.propositionScript!.empreinte, choixFormules: Object.fromEntries(e.propositionScript!.formules.map((f) => [f.cle, "garder" as const])) });

async function jusquAuBout(e0: EtatFabricationIV, o: OutilsFabricationIV): Promise<EtatFabricationIV> {
  let e = await avancerJusquAArretIV(e0, o);
  for (let i = 0; i < 20 && e.etape !== "prete" && e.etape !== "refusee"; i++) {
    if (e.attente) e = await avancerJusquAArretIV(e, o);
    else if (attendWillIV(e) === "carte") e = await avancerJusquAArretIV(validerCarteIV(e, { proposition: e.propositionCarte!.empreinte, le: "2026-10-15T08:00:00.000Z" }), o);
    else if (attendWillIV(e) === "script") e = await avancerJusquAArretIV(validerScriptIV(e, decisionScript(e)), o);
    else break;
  }
  return e;
}

/** Image A, réseaux de la prod (TikTok, Shorts, Instagram, Facebook, LinkedIn muet), bruts en vrais MP3. */
function demarrer(o: Omit<OptionsMonde, "brutsMp3"> = {}) {
  const carte = carteFixe("A");
  const m = monde();
  return { m, o: outilsSimules(carte, m, { ...o, brutsMp3: true }), e: etatInitialIV(demandeEssai(carte)) };
}

const empreintes = (m: Monde) => new Map([...m.sons].filter(([k]) => k.endsWith(".mp3")).map(([k, v]) => [k, Buffer.from(v).toString("base64")]));

describe.skipIf(!FFMPEG_PRESENT)("son brut MP3 (copie HeyGen) → WAV avant de mesurer les silences", () => {
  it("(a) conversion réelle : WAV mono à la fréquence du MP3, silences alignés sur ceux du son d'origine (aucun décalage)", async () => {
    // 0,4 s de silence, 1 s de son, 0,6 s de silence, 0,8 s de son, 0,5 s de silence : 24 kHz, comme HeyGen.
    const genere = spawnSync("ffmpeg", ["-v", "error", "-nostdin", "-f", "lavfi", "-i", "anullsrc=r=24000:cl=mono:d=0.4", "-f", "lavfi", "-i", "sine=f=220:r=24000:d=1", "-f", "lavfi", "-i", "anullsrc=r=24000:cl=mono:d=0.6", "-f", "lavfi", "-i", "sine=f=330:r=24000:d=0.8", "-f", "lavfi", "-i", "anullsrc=r=24000:cl=mono:d=0.5", "-filter_complex", "[0][1][2][3][4]concat=n=5:v=0:a=1", "-c:a", "pcm_s16le", "-f", "wav", "pipe:1"], { maxBuffer: 16 * 1024 * 1024 });
    const original = new Uint8Array(genere.stdout);
    const mp3 = enMp3(original);
    expect(estWav(mp3)).toBe(false);
    const sons = new Map<string, Uint8Array>([["voix/corps.mp3", mp3]]);
    let conversions = 0;
    const o: OutilsAssemblageIV = {
      lireSon: async (cle) => sons.get(cle) ?? null,
      convertirEnWav: async (x) => (conversions++, convertirSonEnWavParFfmpeg(x)),
      rangerSon: async (cle, x) => void sons.set(cle, x),
      traiterVoix: async () => {
        throw new Error("pas ici");
      },
    };
    const wav = (await brutEnWav("voix/corps.mp3", "brut du corps", o))!;
    const son = lireWav(wav);
    expect(son.frequence).toBe(24000);
    expect(son.echantillons.length / son.frequence).toBeCloseTo(3.3, 1);
    const attendus = silencesMesures(lireWav(original));
    const mesures = silencesMesures(son);
    expect(mesures.length).toBe(attendus.length);
    mesures.forEach((s, i) => {
      expect(Math.abs(s.debutSec - attendus[i].debutSec)).toBeLessThanOrEqual(0.03);
      expect(Math.abs(s.finSec - attendus[i].finSec)).toBeLessThanOrEqual(0.03);
    });
    // Le premier son commence à 0,40 s, au même échantillon près (± 2 ms) : pas de retard d'encodeur non compensé.
    const premier = son.echantillons.findIndex((x) => Math.abs(x) > 0.01) / son.frequence;
    expect(Math.abs(premier - 0.4)).toBeLessThanOrEqual(0.002);
    // Rangé à côté, relu à la reprise : jamais reconverti ; le MP3 payé est intact.
    expect(sons.get(cleWavDuBrut("voix/corps.mp3"))).toEqual(wav);
    await brutEnWav("voix/corps.mp3", "brut du corps", o);
    expect(conversions).toBe(1);
    expect(sons.get("voix/corps.mp3")).toBe(mp3);
  });

  it("MP3 sans en-tête LAME : le retard d'encodeur est le MÊME pour la mesure et pour studio-rendu (même horloge que les coupes)", async () => {
    const genere = spawnSync("ffmpeg", ["-v", "error", "-nostdin", "-f", "lavfi", "-i", "anullsrc=r=24000:cl=mono:d=0.4", "-f", "lavfi", "-i", "sine=f=220:r=24000:d=1", "-filter_complex", "[0][1]concat=n=2:v=0:a=1", "-c:a", "pcm_s16le", "-f", "wav", "pipe:1"], { maxBuffer: 16 * 1024 * 1024 });
    const mp3 = enMp3(new Uint8Array(genere.stdout), { enteteLame: false });
    const son = lireWav(await convertirSonEnWavParFfmpeg(mp3));
    const debutMesure = son.echantillons.findIndex((x) => Math.abs(x) > 0.01) / son.frequence;
    const dossier = await mkdtemp(join(tmpdir(), "iv-sans-lame-"));
    try {
      await writeFile(join(dossier, "brut"), mp3);
      const rendu = await decoderPcm(join(dossier, "brut"), undefined, son.frequence);
      const debutRendu = rendu.findIndex((x) => Math.abs(x) > 0.01) / son.frequence;
      expect(Math.abs(debutMesure - debutRendu)).toBeLessThanOrEqual(0.001);
      // Le retard d'un MP3 sans en-tête reste sous 60 ms : bien en deçà d'un blanc mesuré (50 ms au moins, recalé).
      expect(debutMesure - 0.4).toBeLessThan(0.06);
    } finally {
      await rm(dossier, { recursive: true, force: true });
    }
  });

  it("(a) fabrication complète, bruts en vrais MP3, recette réelle de studio-rendu : vidéo prête pour tous les réseaux", async () => {
    const compte = { conversions: 0 };
    const m = monde();
    const carte = carteFixe("A");
    const o = outilsSimules(carte, m, { brutsMp3: true, assemblage: assemblageReel(m, compte) });
    // Le monde des doubles est celui de `m` : les outils réels écrivent dans les mêmes sons.
    const etat = await jusquAuBout(etatInitialIV(demandeEssai(carte)), o);
    expect(etat.refus?.message).toBeUndefined();
    expect(etat.etape).toBe("prete");
    expect(etat.livraison?.map((l) => l.reseau)).toEqual(["youtube-shorts", "linkedin", "instagram", "facebook"]);
    const bruts = [...m.sons.keys()].filter((k) => /^brut-\d+\.mp3$/.test(k));
    // 20/10 : la voix est lue d'un trait (un seul brut) ; avant, un brut par fin distincte.
    expect(bruts.length).toBe(1);
    // Chaque brut converti une seule fois, et rangé en WAV à côté du MP3.
    expect(compte.conversions).toBe(bruts.length);
    for (const b of bruts) expect(estWav(m.sons.get(cleWavDuBrut(b))!)).toBe(true);
    // Les pistes voix seule sont de vrais WAV de la recette (48 kHz), avec des coupes recalées dans les silences mesurés.
    for (const p of etat.pistes ?? []) expect(lireWav(m.sons.get(p.cle)!).frequence).toBe(48000);
  });

  it("(b) reprise depuis l'état EXACT de la prod (voix faite, refus Q17 à l'assemblage) : proposée, 0 lecture, vidéo au bout", async () => {
    // L'état de la prod : le MP3 lu tel quel comme un WAV (aucune conversion), refus Q17, gardé « non réessayable ».
    const { m, o, e } = demarrer({ assemblage: { convertirEnWav: async (x) => x } });
    let etat = await jusquAuBout(e, o);
    expect(etat.etape).toBe("refusee");
    expect(etat.refus).toMatchObject({ etape: "voix", code: "IV_VOIX" });
    expect(etat.refus!.message).toBe(`Le son brut du corps (youtube-shorts) n'est pas un WAV lisible. ${SUITE_REFUS_WAV_IV}`);
    expect(etat.voix?.issue?.statut).toBe("faite");
    etat = structuredClone(etat);
    etat.refus!.reessayable = false; // ce que la prod a gardé avant ce correctif
    expect(refusReessayableIV(etat)).toBe(true);
    expect(vueFabrication(etat).refus?.reessayable).toBe(true);

    const lus = m.lus.length;
    const mesures = m.mesures;
    const depenses = m.depenses.length;
    const mp3 = empreintes(m);
    const compte = { conversions: 0 };
    const o2 = outilsSimules(carteFixe("A"), m, { brutsMp3: true, assemblage: assemblageReel(m, compte) });
    const ordreAvant = m.ordre.length;
    const fin = await jusquAuBout(reprendreIV(etat), o2);
    expect(fin.refus?.message).toBeUndefined();
    expect(fin.etape).toBe("prete");
    // Aucune lecture HeyGen, aucune re-mesure de voix, aucune réservation de voix.
    expect(m.lus.length).toBe(lus);
    expect(m.mesures).toBe(mesures);
    expect(m.ordre.slice(ordreAvant).filter((x) => x === "heygen" || x.startsWith("réserve iv-voix"))).toEqual([]);
    expect(m.depenses.slice(depenses).filter((d) => d.etape === "voix" || d.fournisseur === "heygen")).toEqual([]);
    // Les MP3 payés n'ont pas bougé.
    expect(empreintes(m)).toEqual(mp3);
    expect(compte.conversions).toBeGreaterThan(0);
  });

  it("la conversion impossible (FFmpeg absent) est un refus Q17 réessayable, sans relecture", async () => {
    const { o, e } = demarrer({
      assemblage: {
        convertirEnWav: async () => {
          throw new Error("FFmpeg est absent du studio : le son ne peut pas être converti en WAV.");
        },
      },
    });
    const etat = await jusquAuBout(e, o);
    expect(etat.refus).toMatchObject({ etape: "voix", code: "IV_VOIX", reessayable: true });
    expect(etat.refus!.message).toMatch(/n'a pas pu être converti en WAV.*Relancez la conversion du son/);
    expect(refusReessayableIV(etat)).toBe(true);
  });

  it("un refus de voix qui n'est PAS un Q17 d'assemblage n'est pas rendu réessayable par cette règle", () => {
    const etat = { refus: { etape: "voix" as const, code: "IV_VOIX" as const, message: `Autre refus. ${SUITE_REFUS_WAV_IV}`, reessayable: false }, voix: { issue: { statut: "refus" as const, controle: "Q16" as const, message: "x" }, voix: { corps: {}, fins: [] } } };
    expect(refusReessayableIV(etat as unknown as Parameters<typeof refusReessayableIV>[0])).toBe(false);
  });
});
