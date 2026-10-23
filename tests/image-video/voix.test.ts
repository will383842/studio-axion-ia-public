/**
 * L12 · Voix et assemblage du format « image → vidéo ». HeyGen, rendu et stockage SIMULÉS (aucun appel payant) ; les sons
 * sont des WAV synthétiques fabriqués ici (mots = notes avec fondu de sortie, blancs = silence numérique) : tout est
 * déterministe.
 */
import { describe, expect, it, vi } from "vitest";
import type { BruitagePlace } from "@/briques/intensite/types";
import { VERSION_MESURE_VOIX } from "@/briques/voix-maitre/reference";
import { REFERENCE_V4_IV } from "@/domaine/image-video/reference-voix";
import type { MotHorodate } from "@/domaine/types";
import { motsDits, type FicheImage } from "@/domaine/image-video/fiche";
import type { DemandeRendu, EtatRendu, FournisseurAlignement, FournisseurVoix, ServiceRendu, StockageFichiers } from "@/fournisseurs/types";
import {
  assemblerVersionCourteIV,
  assemblerVersionsIV,
  coupesEnPleinSon,
  exigerWav,
  planMixageIV,
  TEMPO_IV,
  LOUDNESS_IV_LUFS,
  type DemandeVoixSeuleIV,
  type OutilsAssemblageIV,
} from "@/moteurs/montage-image-video/assemblage";
import { FICHES_SIMULEES } from "@/moteurs/montage-image-video/ecriture.simulation";
import { RECETTE_VOIX_CAS_CONCRET } from "@/moteurs/montage-image-video/emprunts";
import { planDesFinsIV } from "@/moteurs/montage-image-video/fins";
import {
  avancerVoixIV,
  ErreurVoixIV,
  etatInitialVoixIV,
  outilsVoixCasConcretIV,
  rapportVoixIV,
  repriseVoixIV,
  segmentsVoixIV,
  VOIX_IV,
  voixARemesurerIV,
  type EtatVoixIV,
  type OutilsVoixIV,
  type ReservationLectureIV,
  type SegmentsVoixIV,
} from "@/moteurs/montage-image-video/voix";

/* ------------------------------------------------------------------ */
/* Sons synthétiques                                                     */
/* ------------------------------------------------------------------ */

const FREQ = 8000;
vi.setConfig({ testTimeout: 60_000 });

/** WAV PCM 16 bits mono. */
function wav(e: Float32Array): Uint8Array {
  const b = new Uint8Array(44 + e.length * 2);
  const v = new DataView(b.buffer);
  const ecrire = (i: number, s: string) => [...s].forEach((c, k) => (b[i + k] = c.charCodeAt(0)));
  ecrire(0, "RIFF");
  v.setUint32(4, 36 + e.length * 2, true);
  ecrire(8, "WAVE");
  ecrire(12, "fmt ");
  v.setUint32(16, 16, true);
  v.setUint16(20, 1, true);
  v.setUint16(22, 1, true);
  v.setUint32(24, FREQ, true);
  v.setUint32(28, FREQ * 2, true);
  v.setUint16(32, 2, true);
  v.setUint16(34, 16, true);
  ecrire(36, "data");
  v.setUint32(40, e.length * 2, true);
  e.forEach((x, i) => v.setInt16(44 + i * 2, Math.round(Math.max(-1, Math.min(1, x)) * 32767), true));
  return b;
}

function lireEchantillons(b: Uint8Array): Float32Array {
  const v = new DataView(b.buffer, b.byteOffset, b.byteLength);
  const n = v.getUint32(40, true) / 2;
  return Float32Array.from({ length: n }, (_, i) => v.getInt16(44 + i * 2, true) / 32768);
}

/** Son d'une prise : une note par mot (fondu d'entrée 20 ms, de sortie 150 ms), silence ailleurs ; `bruits` : souffle. */
function sonDesMots(mots: readonly MotHorodate[], dureeSec: number, bruits: readonly [number, number][] = []): Uint8Array {
  const e = new Float32Array(Math.round(dureeSec * FREQ));
  for (const m of mots) {
    for (let i = Math.round(m.debutSec * FREQ); i < Math.round(m.finSec * FREQ) && i < e.length; i++) {
      const t = i / FREQ;
      const env = 0.3 * Math.min(1, (t - m.debutSec) / 0.02) * Math.min(1, (m.finSec - t) / 0.15);
      e[i] = env * Math.sin(2 * Math.PI * 220 * t);
    }
  }
  for (const [de, a] of bruits) for (let i = Math.round(de * FREQ); i < Math.round(a * FREQ); i++) e[i] = 0.05 * Math.sin(2 * Math.PI * 97 * (i / FREQ));
  return wav(e);
}

interface OptionsMots {
  /** Mots ajoutés après le rang donné (hésitation « euh »). */
  insertions?: Record<number, string>;
  /** Blanc après une fin de phrase (s). */
  pausePhrase?: number;
}

/** Mots horodatés d'un texte (centièmes ronds) : 0,30 s par mot, 0,12 s entre deux mots, `pausePhrase` après « . ». */
function motsDuTexte(texte: string, o: OptionsMots = {}): MotHorodate[] {
  const bruts = texte.split(/\s+/).filter((m) => /[\p{L}\p{N}]/u.test(m));
  const lus: string[] = [];
  bruts.forEach((m, i) => {
    lus.push(m);
    if (o.insertions?.[i]) lus.push(o.insertions[i]);
  });
  const res: MotHorodate[] = [];
  let t = 30; // centièmes
  for (const mot of lus) {
    res.push({ mot, debutSec: t / 100, finSec: (t + 30) / 100 });
    t += 30 + (/[.!?…]["»]?$/.test(mot) ? Math.round((o.pausePhrase ?? 0.45) * 100) : /[,;:]$/.test(mot) ? 20 : 12);
  }
  return res;
}

/* ------------------------------------------------------------------ */
/* Doubles : HeyGen, rendu, stockage                                     */
/* ------------------------------------------------------------------ */

interface Monde {
  /** Textes lus par HeyGen, dans l'ordre (chaque entrée = une lecture payée). */
  lus: string[];
  nouvelles: boolean[];
  demandesVoix: { idExterne: string; vitesse: number }[];
  /** Son de chaque clé rangée. */
  sons: Map<string, Uint8Array>;
  /** Mots rendus pour la n-ième lecture (à partir de 1). */
  motsPour: (texte: string, n: number) => MotHorodate[];
  /** Mesures de ressemblance rendues pour la n-ième mesure. */
  mesurePour: (n: number) => Record<string, number>;
  /** Niveau des blancs mesurés par la voix. */
  niveauPauses: (cle: string) => number;
  bruits: (n: number) => [number, number][];
  mesures: number;
  /** Réservations de dépense demandées, dans l'ordre ; `journal` mêle réservations (« R ») et lectures (« L »). */
  reservations: ReservationLectureIV[];
  journal: ("R" | "L")[];
  /** La n-ième réservation (à partir de 1) est-elle refusée ? */
  refuserReservation: (n: number) => boolean;
}

/** Mesure rendue par studio-rendu à jour (version 2 de la mesure, 15/10). */
const MESURE_REFERENCE: Record<string, number> = { ...Object.fromEntries(Object.entries(REFERENCE_V4_IV).map(([k, v]) => [`voix.${k}`, v])), "voix.versionMesure": VERSION_MESURE_VOIX };

function monde(p: Partial<Pick<Monde, "motsPour" | "mesurePour" | "niveauPauses" | "bruits" | "refuserReservation">> = {}): Monde {
  return { lus: [], nouvelles: [], demandesVoix: [], sons: new Map(), motsPour: p.motsPour ?? ((t) => motsDuTexte(t)), mesurePour: p.mesurePour ?? (() => MESURE_REFERENCE), niveauPauses: p.niveauPauses ?? (() => -60), bruits: p.bruits ?? (() => []), mesures: 0, reservations: [], journal: [], refuserReservation: p.refuserReservation ?? (() => false) };
}

/** Tarif simulé (centimes par caractère). */
const TARIF = 0.05;

function outilsVoix(m: Monde): OutilsVoixIV {
  const soumises = new Map<string, DemandeRendu>();
  const voix = {
    id: "heygen-simule",
    mode: "simulation",
    capacites: { audioSeul: true, horodatageMots: true },
    async lire(d: { texte: string; idExterne: string; nouvelleLecture?: boolean; reglages: { vitesse: number } }) {
      m.lus.push(d.texte);
      m.journal.push("L");
      m.nouvelles.push(!!d.nouvelleLecture);
      m.demandesVoix.push({ idExterne: d.idExterne, vitesse: d.reglages.vitesse });
      const n = m.lus.length;
      const mots = m.motsPour(d.texte, n);
      const dureeSec = +((mots.at(-1)?.finSec ?? 0) + 0.6).toFixed(2);
      const fichierCle = `brut-${n}.wav`;
      m.sons.set(fichierCle, sonDesMots(mots, dureeSec, m.bruits(n)));
      return { fichierCle, dureeSec, cout: { centimes: 2, devise: "EUR" }, mots };
    },
  } as unknown as FournisseurVoix;
  const stockage = {
    urlLecture: async (cle: string) => `https://stockage.test/${cle}`,
    urlLectureDuree: async (cle: string) => `https://stockage.test/${cle}`,
    urlDepotDuree: async (cle: string) => `https://depot.test/${cle}`,
  } as unknown as StockageFichiers;
  const rendu: ServiceRendu = {
    async soumettre(d) {
      soumises.set(d.idRendu, d);
      return { idRendu: d.idRendu };
    },
    async etat(id): Promise<EtatRendu> {
      const d = soumises.get(id);
      if (!d) return { statut: "inconnu" };
      if (d.parametres.mode === "mesure-voix") return { statut: "termine", sortieCle: d.sortie.cle, mesures: m.mesurePour(++m.mesures) };
      return { statut: "termine", sortieCle: d.sortie.cle, mesures: d.parametres.mode === "appliquer" ? { dureeSec: 5 } : {} };
    },
  };
  return {
    voix: () => voix,
    stockage: () => stockage,
    aligneur: () => ({ mode: "simulation" }) as unknown as FournisseurAlignement,
    rendu: () => rendu,
    renduEstSimule: () => false,
    cle: (nom) => `voix/${nom}`,
    caler: () => false,
    mesurerPauses: async (cle, pauses) => pauses.map(() => m.niveauPauses(cle)),
    tarifCentimesParCaractere: TARIF,
    avantLecture: async (r) => {
      m.reservations.push(r);
      m.journal.push("R");
      if (m.refuserReservation(m.reservations.length)) throw new Error("plafond du jour atteint");
    },
  };
}

/**
 * Rendu simulé de la piste voix seule : les morceaux des sons bruts mis bout à bout (silences du raccord compris), le
 * tempo appliqué par rééchantillonnage, puis le silence de fin de la recette. `couperAvantFin` : piste tronquée net.
 */
function outilsAssemblage(m: Monde, o: { couperAvantFin?: number; mp3?: boolean } = {}): OutilsAssemblageIV & { demandes: DemandeVoixSeuleIV[] } {
  const demandes: DemandeVoixSeuleIV[] = [];
  return {
    demandes,
    async lireSon(cle) {
      const s = m.sons.get(cle) ?? null;
      return s && o.mp3 && cle.startsWith("brut-") ? new TextEncoder().encode("ID3\u0004 faux mp3") : s;
    },
    // Un faux MP3 n'est pas décodable : la conversion échoue (le vrai décodage est testé dans `brut-mp3.test.ts`).
    convertirEnWav: async () => {
      throw new Error("faux MP3 indécodable");
    },
    rangerSon: async (cle, octets) => void m.sons.set(cle, octets),
    async traiterVoix(d) {
      demandes.push(d);
      const morceaux = d.recette.parametres.morceaux as { debutSec: number; finSec: number; source?: 0 | 1; silence?: true }[];
      const sources = { 0: lireEchantillons(m.sons.get(d.recette.corps)!), 1: d.recette.fin ? lireEchantillons(m.sons.get(d.recette.fin)!) : new Float32Array(0) };
      const parties = morceaux.map((x) => (x.silence ? new Float32Array(Math.round((x.finSec - x.debutSec) * FREQ)) : sources[x.source ?? 0].subarray(Math.round(x.debutSec * FREQ), Math.round(x.finSec * FREQ))));
      const bout = new Float32Array(parties.reduce((n, x) => n + x.length, 0));
      parties.reduce((i, x) => (bout.set(x, i), i + x.length), 0);
      const silence = d.recette.parametres.silenceFinSec as number;
      const n = Math.floor(bout.length / d.tempo);
      let sortie = new Float32Array(n + Math.round(silence * FREQ));
      for (let k = 0; k < n; k++) sortie[k] = bout[Math.floor(k * d.tempo)];
      if (o.couperAvantFin !== undefined) sortie = sortie.subarray(0, Math.round((d.recette.dureeSec - silence - o.couperAvantFin) * FREQ));
      const cle = `${d.id}.wav`;
      m.sons.set(cle, wav(sortie));
      return { cle, dureeSec: sortie.length / FREQ };
    },
  };
}

async function jusquAuBout(etat: EtatVoixIV, o: OutilsVoixIV, tours = 200): Promise<EtatVoixIV> {
  let e = etat;
  for (let i = 0; i < tours && !e.issue; i++) e = JSON.parse(JSON.stringify(await avancerVoixIV(e, o))) as EtatVoixIV;
  return e;
}

/* ------------------------------------------------------------------ */
/* Données                                                               */
/* ------------------------------------------------------------------ */

const FICHE_C = FICHES_SIMULEES["essai-c"] as FicheImage;
const FICHE_FAUX = FICHES_SIMULEES["essai-faux16"] as FicheImage;
const TOUS = ["youtube-shorts", "linkedin", "instagram", "facebook"] as const;

function segmentsDe(fiche: FicheImage, reseaux: readonly (typeof TOUS)[number][] = TOUS): SegmentsVoixIV {
  return segmentsVoixIV(fiche, planDesFinsIV({ reseaux, offre: "integration", questionCommentaire: fiche.questionCommentaire.texteDit }));
}

/** Petit script (corps de deux phrases) pour les essais d'hésitation. */
const PETIT: SegmentsVoixIV = {
  corps: "Une demande arrive à minuit. Elle part au bon service en quatre secondes.",
  fins: [{ id: "fin-youtube-shorts", texte: "Faites votre diagnostic gratuit en quelques minutes. Le lien est dans mon profil.", reseaux: ["youtube-shorts"] }],
  versions: [{ id: "fin-youtube-shorts", reseaux: ["youtube-shorts"], segment: "fin-youtube-shorts" }],
};

/* ------------------------------------------------------------------ */
/* Voix unique                                                           */
/* ------------------------------------------------------------------ */

describe("L12 · voix unique (clone HeyGen de Will, starfish, 1,1, recette v4)", () => {
  it("la voix du format est le clone de Will avec les réglages de la recette v4", () => {
    expect(VOIX_IV).toEqual({ fournisseur: "heygen", moteur: "starfish", vitesse: 1.1, locale: "fr-FR", idVoix: "b22b1a358ca740eda753772ebaaf11f7" });
    expect(RECETTE_VOIX_CAS_CONCRET.synthese).toMatchObject({ moteur: "starfish", vitesse: 1.1 });
    expect(TEMPO_IV).toBe(1.08);
    expect(LOUDNESS_IV_LUFS).toBe(-14);
  });

  it("aucun appelant ne peut changer de voix ni de vitesse ; le script n'est jamais réécrit", async () => {
    const o = outilsVoixCasConcretIV({ ...outilsVoix(monde()), reglages: { vitesse: 1.4, stabilite: 10, emotion: 90 }, idVoix: "autre" } as OutilsVoixIV);
    expect(o.idVoix).toBe(VOIX_IV.idVoix);
    expect(o.reglages).toEqual({ vitesse: 1.1, stabilite: 10, emotion: 90 });
    expect(o.texteFige).toBe(true);
    expect(o.ressemblance).toEqual({ actif: true, relancesMax: 1 });
    expect(await o.reformuler("x", [])).toMatchObject({ ok: false });

    const m = monde();
    await jusquAuBout(etatInitialVoixIV(PETIT), outilsVoix(m));
    expect(m.demandesVoix.every((d) => d.idExterne === VOIX_IV.idVoix && d.vitesse === 1.1)).toBe(true);
  });

  it("le contrôle de ressemblance à la voix v4 ne se coupe pas", async () => {
    const m = monde();
    const fin = await avancerVoixIV(etatInitialVoixIV(PETIT), { ...outilsVoix(m), ressemblance: { actif: false, relancesMax: 0 } });
    expect(fin.issue).toMatchObject({ statut: "refus", controle: "Q16" });
    expect(m.lus).toEqual([]);
  });

  it("le contrôle de ressemblance ne s'assouplit pas : des relances autres que la référence sont refusées (Q16)", async () => {
    for (const relancesMax of [0, 2]) {
      const m = monde();
      const fin = await avancerVoixIV(etatInitialVoixIV(PETIT), { ...outilsVoix(m), ressemblance: { actif: true, relancesMax } });
      expect(fin.issue).toMatchObject({ statut: "refus", controle: "Q16" });
      if (fin.issue?.statut === "refus") expect(fin.issue.message).toMatch(/tolérances de référence/);
      expect(m.lus).toEqual([]);
      expect(m.reservations).toEqual([]);
    }
    // Le réglage de référence est accepté ; les outils complets posent toujours la référence.
    const m = monde();
    expect((await jusquAuBout(etatInitialVoixIV(PETIT), { ...outilsVoix(m), ressemblance: { actif: true, relancesMax: 1 } })).issue).toEqual({ statut: "faite" });
    expect(outilsVoixCasConcretIV({ ...outilsVoix(monde()), ressemblance: { actif: true, relancesMax: 2 } }).ressemblance).toEqual({ actif: true, relancesMax: 1 });
  });
});

/* ------------------------------------------------------------------ */
/* Réservation de dépense avant chaque lecture HeyGen                    */
/* ------------------------------------------------------------------ */

describe("L12 · argent : réservation obligatoire avant chaque lecture HeyGen", () => {
  it("réservation refusée : aucun appel HeyGen, refus propre « budget »", async () => {
    const m = monde({ refuserReservation: () => true });
    const fin = await jusquAuBout(etatInitialVoixIV(PETIT), outilsVoix(m));
    expect(m.lus).toHaveLength(0);
    expect(m.reservations).toHaveLength(1);
    expect(fin.issue).toMatchObject({ statut: "refus", controle: "budget" });
    if (fin.issue?.statut === "refus") expect(fin.issue.message).toMatch(/plafond du jour atteint.*Aucune lecture n'a été faite ni payée/);
    expect(fin.voix.payees).toEqual([]);
  });

  it("réservation refusée en cours de route (fin) : la lecture refusée n'est pas faite, les lectures payées sont gardées", async () => {
    const m = monde({ refuserReservation: (n) => n === 2 });
    const fin = await jusquAuBout(etatInitialVoixIV(PETIT), outilsVoix(m));
    expect(fin.issue).toMatchObject({ statut: "refus", controle: "budget" });
    expect(m.lus).toEqual([PETIT.corps]);
    expect(fin.voix.payees).toHaveLength(1);
  });

  it("chaque lecture (corps, fin, lecture neuve sur hésitation, relance de ressemblance) est précédée de sa réservation au coût maximal", async () => {
    // 1ʳᵉ lecture du corps : « euh » → lecture neuve ; 1ʳᵉ mesure hors référence → relance de ressemblance.
    let mesure = 0;
    const m = monde({
      motsPour: (t, n) => motsDuTexte(t, n === 1 && t === PETIT.corps ? { insertions: { 2: "euh" } } : {}),
      mesurePour: () => (++mesure === 2 ? { ...MESURE_REFERENCE, "voix.hauteurHz": REFERENCE_V4_IV.hauteurHz * 1.2 } : MESURE_REFERENCE),
    });
    const fin = await jusquAuBout(etatInitialVoixIV(PETIT), outilsVoix(m));
    expect(fin.issue).toEqual({ statut: "faite" });
    expect(m.lus.length).toBeGreaterThanOrEqual(4);
    expect(m.nouvelles).toContain(true);
    expect(m.reservations).toHaveLength(m.lus.length);
    expect(m.journal).toEqual(m.lus.flatMap(() => ["R", "L"]));
    m.reservations.forEach((r, i) => {
      expect(r.texte).toBe(m.lus[i]);
      expect(r.caracteres).toBe(m.lus[i].length);
      expect(r.coutMaxCentimes).toBe(Math.ceil(m.lus[i].length * TARIF - 1e-9));
      expect(r.coutMaxCentimes).toBeGreaterThan(0);
    });
    expect(m.reservations.map((r) => r.prise)).toEqual(m.lus.map((t) => (t === PETIT.corps ? "corps" : "fin-youtube-shorts")));
  });

  it("sans réservation ni tarif (appelant non typé) : refus « budget », aucune lecture", async () => {
    for (const manque of [{ avantLecture: undefined }, { tarifCentimesParCaractere: 0 }, { tarifCentimesParCaractere: Number.NaN }]) {
      const m = monde();
      const fin = await jusquAuBout(etatInitialVoixIV(PETIT), { ...outilsVoix(m), ...manque } as unknown as OutilsVoixIV);
      expect(fin.issue).toMatchObject({ statut: "refus", controle: "budget" });
      expect(m.lus).toEqual([]);
    }
  });
});

/* ------------------------------------------------------------------ */
/* Corps une fois, une lecture par segment de fin                        */
/* ------------------------------------------------------------------ */

describe("L12 · corps lu une fois, une lecture par segment de fin distinct", () => {
  it("4 réseaux : 1 lecture du corps + 2 fins (Shorts et Instagram disent la même chose ; LinkedIn muet)", async () => {
    const s = segmentsDe(FICHE_C);
    expect(s.corps).toBe(FICHE_C.ecrans.map((e) => e.texteDit).join(" "));
    // Instagram dit la même chose que Shorts (« Le lien est dans mon profil. ») : même lecture.
    expect(s.fins.map((f) => f.reseaux)).toEqual([["youtube-shorts", "instagram"], ["facebook"]]);
    expect(s.fins.every((f) => f.texte.startsWith(FICHE_C.questionCommentaire.texteDit))).toBe(true);
    expect(s.versions.map((v) => [v.reseaux.join("+"), v.segment])).toEqual([
      ["youtube-shorts", "fin-youtube-shorts"],
      ["linkedin", null],
      ["instagram", "fin-youtube-shorts"],
      ["facebook", "fin-facebook"],
    ]);

    const m = monde();
    const fin = await jusquAuBout(etatInitialVoixIV(s), outilsVoix(m));
    expect(fin.issue).toEqual({ statut: "faite" });
    expect(m.lus).toEqual([s.corps, ...s.fins.map((f) => f.texte)]);
    expect(m.lus.filter((t) => t === s.corps)).toHaveLength(1);
    expect(rapportVoixIV(fin)).toEqual({ lecturesCorps: 1, lecturesFins: { "fin-youtube-shorts": 1, "fin-facebook": 1 }, payees: 3, coutCentimes: 6 });
  });

  it("LinkedIn seul : seul le corps est lu", async () => {
    const s = segmentsDe(FICHE_C, ["linkedin"]);
    expect(s.fins).toEqual([]);
    const m = monde();
    expect((await jusquAuBout(etatInitialVoixIV(s), outilsVoix(m))).issue).toEqual({ statut: "faite" });
    expect(m.lus).toEqual([s.corps]);
  });
});

/* ------------------------------------------------------------------ */
/* Hésitation → lecture neuve                                            */
/* ------------------------------------------------------------------ */

describe("L12 · hésitation détectée → lecture neuve, 3 au plus pour le corps, 2 par fin", () => {
  it("un « euh » dans le corps : lecture NEUVE du même texte (jamais réécrit), puis la voix passe", async () => {
    const m = monde({ motsPour: (t, n) => motsDuTexte(t, n === 1 && t === PETIT.corps ? { insertions: { 2: "euh" } } : {}) });
    const fin = await jusquAuBout(etatInitialVoixIV(PETIT), outilsVoix(m));
    expect(fin.issue).toEqual({ statut: "faite" });
    expect(m.lus).toEqual([PETIT.corps, PETIT.corps, PETIT.fins[0].texte]);
    expect(m.nouvelles).toEqual([false, true, false]);
    expect(fin.voix.corps.texte).toBe(PETIT.corps);
  });

  it("un blanc qui souffle (−17 dB) entre deux mots est une hésitation : lecture neuve", async () => {
    let premiere = true;
    const m = monde({
      motsPour: (t, n) => {
        const mots = motsDuTexte(t);
        if (n !== 1) return mots;
        // 0,40 s de blanc après « demande », sans ponctuation : mesuré.
        return mots.map((x, i) => (i >= 2 ? { ...x, debutSec: +(x.debutSec + 0.28).toFixed(2), finSec: +(x.finSec + 0.28).toFixed(2) } : x));
      },
      niveauPauses: () => {
        const n = premiere ? -17 : -60;
        premiere = false;
        return n;
      },
    });
    const fin = await jusquAuBout(etatInitialVoixIV(PETIT), outilsVoix(m));
    expect(fin.issue).toEqual({ statut: "faite" });
    expect(fin.voix.reformulations[0]).toMatchObject({ rejet: "son" });
    expect(m.lus.filter((t) => t === PETIT.corps)).toHaveLength(2);
  });

  it("3 lectures du corps qui hésitent : refus Q16, jamais une 4ᵉ lecture", async () => {
    const m = monde({ motsPour: (t) => motsDuTexte(t, t === PETIT.corps ? { insertions: { 1: "euh" } } : {}) });
    const fin = await jusquAuBout(etatInitialVoixIV(PETIT), outilsVoix(m));
    expect(fin.issue).toMatchObject({ statut: "refus", controle: "Q16" });
    expect(m.lus).toEqual([PETIT.corps, PETIT.corps, PETIT.corps]);
  });

  it("une fin qui hésite deux fois : refus Q16 (jamais gardée en silence), 2 lectures de la fin", async () => {
    const m = monde({ motsPour: (t) => motsDuTexte(t, t === PETIT.fins[0].texte ? { insertions: { 3: "euh" } } : {}) });
    const fin = await jusquAuBout(etatInitialVoixIV(PETIT), outilsVoix(m));
    expect(fin.issue).toMatchObject({ statut: "refus", controle: "Q16" });
    if (fin.issue?.statut === "refus") expect(fin.issue.message).toMatch(/fin pour youtube-shorts hésite encore après 2 lecture/);
    expect(m.lus.filter((t) => t === PETIT.fins[0].texte)).toHaveLength(2);
  });

  it("voix toujours hors de la référence v4 après sa relance : refus Q16", async () => {
    const m = monde({ mesurePour: () => ({ ...MESURE_REFERENCE, "voix.hauteurHz": REFERENCE_V4_IV.hauteurHz * 1.2 }) });
    const fin = await jusquAuBout(etatInitialVoixIV(PETIT), outilsVoix(m));
    expect(fin.issue).toMatchObject({ statut: "refus", controle: "Q16" });
    if (fin.issue?.statut === "refus") expect(fin.issue.message).toMatch(/hauteur/);
    expect(m.lus.filter((t) => t === PETIT.corps)).toHaveLength(2);
  });
});

/* ------------------------------------------------------------------ */
/* Reprise sans repayer                                                  */
/* ------------------------------------------------------------------ */

describe("L12 · une voix payée n'est jamais relue", () => {
  it("panne au milieu : la reprise depuis l'état gardé ne relit rien", async () => {
    const m = monde();
    const o = outilsVoix(m);
    let e = etatInitialVoixIV(PETIT);
    e = JSON.parse(JSON.stringify(await avancerVoixIV(e, o)));
    expect(m.lus).toHaveLength(1);
    const fin = await jusquAuBout(e, outilsVoix(m));
    expect(fin.issue).toEqual({ statut: "faite" });
    expect(m.lus).toEqual([PETIT.corps, PETIT.fins[0].texte]);
  });

  it("fin changée : seul le nouveau texte est lu, le corps relu en lecture neuve (essai 2) est gardé", async () => {
    const m = monde({ motsPour: (t, n) => motsDuTexte(t, n === 1 ? { insertions: { 2: "euh" } } : {}) });
    const premier = await jusquAuBout(etatInitialVoixIV(PETIT), outilsVoix(m));
    expect(premier.issue).toEqual({ statut: "faite" });
    expect(premier.voix.corps.prise?.essai).toBe(2);
    const lus = m.lus.length;

    const autre: SegmentsVoixIV = { ...PETIT, fins: [...PETIT.fins, { id: "fin-instagram", texte: "Le lien est dans mon profil.", reseaux: ["instagram"] }], versions: [...PETIT.versions, { id: "fin-instagram", reseaux: ["instagram"], segment: "fin-instagram" }] };
    const repris = repriseVoixIV(premier, autre, outilsVoix(m));
    const fin = await jusquAuBout(repris, outilsVoix(m));
    expect(fin.issue).toEqual({ statut: "faite" });
    expect(m.lus.slice(lus)).toEqual(["Le lien est dans mon profil."]);
    expect(fin.voix.corps.prise?.empreinte).toBe(premier.voix.corps.prise?.empreinte);
  });

  it("une fin rejetée deux fois n'est pas reprise telle quelle : refus bloquant, aucune lecture", async () => {
    const m = monde({ motsPour: (t) => motsDuTexte(t, t === PETIT.fins[0].texte ? { insertions: { 3: "euh" } } : {}) });
    const premier = await jusquAuBout(etatInitialVoixIV(PETIT), outilsVoix(m));
    expect(premier.issue).toMatchObject({ statut: "refus", controle: "Q16" });
    const lus = m.lus.length;
    const repris = repriseVoixIV(premier, PETIT, outilsVoix(m));
    expect(repris.issue).toMatchObject({ statut: "refus", controle: "Q16" });
    if (repris.issue?.statut === "refus") expect(repris.issue.message).toMatch(/fin pour youtube-shorts a été rejetée après 2 lectures.*n'est pas reprise telle quelle/);
    const fin = await jusquAuBout(repris, outilsVoix(m));
    expect(fin.issue).toEqual(repris.issue);
    expect(m.lus).toHaveLength(lus);
  });
});

describe("15/10 · mesure version 2 : une fin refusée sur l'ancienne mesure est re-mesurée, jamais relue", () => {
  /** Prod v-dd3049053f88 : la fin courte mesurée à l'ancienne (bords silencieux comptés) : part de parole −14 %. */
  const ANCIENNE_FIN = Object.fromEntries(Object.entries({ ...REFERENCE_V4_IV, partieParole: REFERENCE_V4_IV.partieParole * 0.86 }).map(([k, v]) => [`voix.${k}`, v]));

  /**
   * État gardé en prod après l'arrêt : voix finie (lectures payées, mesures d'avant la version 2), refus retiré par la
   * fabrication pour la reprise (`pasVoix`).
   */
  async function arretEnProd(m: Monde): Promise<EtatVoixIV> {
    const o = outilsVoix(m);
    let e = etatInitialVoixIV(PETIT);
    for (let i = 0; i < 200 && !e.voix.issue; i++) e = JSON.parse(JSON.stringify(await avancerVoixIV(e, o))) as EtatVoixIV;
    expect(e.voix.issue).toEqual({ statut: "faite" });
    expect(e.issue).toBeUndefined();
    return e;
  }

  it("Q16 « part de parole −14 % » : la reprise re-mesure (studio-rendu) les deux lectures de la fin, aucune lecture ni réservation de plus", async () => {
    let serviceAJour = false;
    const m = monde({ mesurePour: (n) => (serviceAJour ? MESURE_REFERENCE : n === 1 ? MESURE_REFERENCE : ANCIENNE_FIN) });
    const arrete = await arretEnProd(m);
    const finAvant = arrete.voix.fins[0].prise!.etat;
    if (finAvant.phase !== "faite") throw new Error("inachevé");
    expect(finAvant.audio.ressemblance!.prises[finAvant.audio.ressemblance!.retenue].ecarts).toEqual(["part de parole -14 % (toléré 12 %)"]);
    expect(m.lus).toEqual([PETIT.corps, PETIT.fins[0].texte, PETIT.fins[0].texte]);
    expect(voixARemesurerIV(arrete)).toBe(true);
    const lus = m.lus.length;
    const reservations = m.reservations.length;
    const mesures = m.mesures;

    // « Refaire cette partie » : repart de l'état payé (studio-rendu à jour).
    serviceAJour = true;
    const fin = await jusquAuBout(arrete, outilsVoix(m));
    expect(fin.issue).toEqual({ statut: "faite" });
    expect(m.lus).toHaveLength(lus);
    expect(m.reservations).toHaveLength(reservations);
    expect(m.mesures - mesures).toBe(2);
    expect(rapportVoixIV(fin)).toEqual(rapportVoixIV(arrete));
    expect(voixARemesurerIV(fin)).toBe(false);
  });

  it("même chose par la reprise à entrées changées (`repriseVoixIV`) : la fin payée est gardée puis re-mesurée", async () => {
    let serviceAJour = false;
    const m = monde({ mesurePour: (n) => (serviceAJour ? MESURE_REFERENCE : n === 1 ? MESURE_REFERENCE : ANCIENNE_FIN) });
    const arrete = await arretEnProd(m);
    const lus = m.lus.length;
    serviceAJour = true;
    const repris = repriseVoixIV(arrete, PETIT, outilsVoix(m));
    expect(repris.issue).toBeUndefined();
    const fin = await jusquAuBout(repris, outilsVoix(m));
    expect(fin.issue).toEqual({ statut: "faite" });
    expect(m.lus).toHaveLength(lus);
  });

  it("encore hors référence avec la mesure juste : refus Q16 de nouveau, toujours sans relire", async () => {
    let serviceAJour = false;
    const loin = { ...MESURE_REFERENCE, "voix.hauteurHz": REFERENCE_V4_IV.hauteurHz * 1.2 };
    const m = monde({ mesurePour: (n) => (serviceAJour ? loin : n === 1 ? MESURE_REFERENCE : ANCIENNE_FIN) });
    const arrete = await arretEnProd(m);
    const lus = m.lus.length;
    serviceAJour = true;
    const fin = await jusquAuBout(arrete, outilsVoix(m));
    expect(fin.issue).toMatchObject({ statut: "refus", controle: "Q16" });
    if (fin.issue?.statut === "refus") expect(fin.issue.message).toMatch(/hauteur \+20 %/);
    expect(m.lus).toHaveLength(lus);
    expect(voixARemesurerIV(fin)).toBe(false);
  });

  it("studio-rendu pas encore à jour : panne claire (réessayable par la fabrication), aucune lecture", async () => {
    const m = monde({ mesurePour: (n) => (n === 1 ? MESURE_REFERENCE : ANCIENNE_FIN) });
    const arrete = await arretEnProd(m);
    const lus = m.lus.length;
    await expect(jusquAuBout(arrete, outilsVoix(m))).rejects.toThrow(/version 1 : mettez-le à jour/);
    expect(m.lus).toHaveLength(lus);
  });

  it("une voix mesurée à la version courante n'est jamais re-mesurée", async () => {
    const m = monde({ mesurePour: () => ({ ...MESURE_REFERENCE, "voix.hauteurHz": REFERENCE_V4_IV.hauteurHz * 1.2 }) });
    const arrete = await jusquAuBout(etatInitialVoixIV(PETIT), outilsVoix(m));
    expect(arrete.issue).toMatchObject({ statut: "refus", controle: "Q16" });
    expect(voixARemesurerIV(arrete)).toBe(false);
  });
});

/* ------------------------------------------------------------------ */
/* Assemblage : WAV, coupes, fin entière, piste voix seule               */
/* ------------------------------------------------------------------ */

async function voixFaite(s: SegmentsVoixIV, m: Monde): Promise<EtatVoixIV> {
  const fin = await jusquAuBout(etatInitialVoixIV(s), outilsVoix(m));
  expect(fin.issue).toEqual({ statut: "faite" });
  return fin;
}

describe("L12 · assemblage : WAV obligatoire, coupes dans les silences mesurés, fin dite en entier", () => {
  it("une piste voix seule par version, avec son empreinte ; tempo ×1,08 ; aucune lecture de voix", async () => {
    const m = monde();
    const s = segmentsDe(FICHE_C);
    const etat = await voixFaite(s, m);
    const lus = m.lus.length;
    const a = outilsAssemblage(m);
    const pistes = await assemblerVersionsIV(etat, a);
    expect(m.lus).toHaveLength(lus);
    expect(pistes.map((p) => p.version)).toEqual(s.versions.map((v) => v.id));
    expect(pistes.every((p) => /^voix-seule-[0-9a-f]{32}$/.test(p.empreinte) && p.tempo === 1.08)).toBe(true);
    expect(a.demandes.every((d) => d.tempo === 1.08)).toBe(true);
    // LinkedIn : corps seul, aucun raccord ; les autres : corps + fin.
    const li = pistes.find((p) => p.reseaux.includes("linkedin"))!;
    expect(li.raccordSec).toBeUndefined();
    expect(li.mots).toHaveLength(li.motsCorps);
    const tt = pistes.find((p) => p.reseaux.includes("youtube-shorts"))!;
    expect(tt.mots.length).toBeGreaterThan(tt.motsCorps);
    // Même son pour les versions qui partagent leur fin ; trois pistes distinctes (corps seul, deux fins).
    expect(new Set(pistes.map((p) => p.empreinte)).size).toBe(3);
    // Le dernier mot est suivi de la fin sonore mesurée, avant la fin du fichier.
    for (const p of pistes) expect(p.finVoixSec).toBeLessThanOrEqual(p.dureeSec);
    // Déterministe : deux assemblages identiques donnent les mêmes empreintes.
    const encore = await assemblerVersionsIV(etat, outilsAssemblage(m));
    expect(encore.map((p) => p.empreinte)).toEqual(pistes.map((p) => p.empreinte));
  });

  it("toutes les coupes du plan tombent dans un silence mesuré", async () => {
    const m = monde();
    const etat = await voixFaite(PETIT, m);
    const a = outilsAssemblage(m);
    await assemblerVersionsIV(etat, a);
    expect(a.demandes).toHaveLength(1);
    expect(a.demandes[0].morceaux.length).toBeGreaterThan(2);
  });

  it("sans WAV : refus Q17 avec une phrase claire, aucun repli MP3", async () => {
    const m = monde();
    const etat = await voixFaite(PETIT, m);
    await expect(assemblerVersionsIV(etat, outilsAssemblage(m, { mp3: true }))).rejects.toMatchObject({ controle: "Q17", message: expect.stringMatching(/n'a pas pu être converti en WAV.*Aucun repli MP3/) });
    // Une conversion qui rend autre chose qu'un WAV : refus, jamais un repli.
    await expect(assemblerVersionsIV(etat, { ...outilsAssemblage(m, { mp3: true }), convertirEnWav: async (o) => o })).rejects.toMatchObject({ controle: "Q17", message: expect.stringMatching(/n'est pas un WAV lisible.*Aucun repli MP3/) });
    const sansSon: OutilsAssemblageIV = { lireSon: async () => null, convertirEnWav: async (o) => o, rangerSon: async () => {}, traiterVoix: async () => ({ cle: "x", dureeSec: 1 }) };
    await expect(assemblerVersionsIV(etat, sansSon)).rejects.toMatchObject({ controle: "Q17", message: expect.stringMatching(/pas disponible en WAV/) });
    expect(() => exigerWav(null, "test")).toThrow(ErreurVoixIV);
  });

  it("une coupe qui tomberait dans un souffle (non silencieux) est refusée", async () => {
    // Le blanc entre « arrive » et « à » (1,44 s → 1,56 s) est rempli d'un souffle à −29 dB : aucune coupe possible, et
    // aucun silence mesuré à moins de 0,35 s pour l'y replacer. (Relecture #283, 2e passage : le plan n'y retire que
    // 20 ms, 1,49 → 1,51 s ; une pause de 80 ms au plus sans silence à portée est gardée entière, ses deux morceaux
    // fusionnés : aucune coupe dans le souffle, rien de retiré.)
    const m = monde({ bruits: () => [[1.44, 1.56]] });
    const etat = await voixFaite(PETIT, m);
    const [piste] = await assemblerVersionsIV(etat, outilsAssemblage(m));
    expect(piste.coupesDeplacees).toBeGreaterThan(0);
    // Le souffle couvre toute une pause entre deux phrases (2,20 → 2,90 s) : refus.
    const m2 = monde({ bruits: () => [[2.2, 2.9]] });
    const etat2 = await voixFaite(PETIT, m2);
    await expect(assemblerVersionsIV(etat2, outilsAssemblage(m2))).rejects.toMatchObject({ controle: "coupe", message: expect.stringMatching(/tombe en plein son/) });
  });

  it("coupesEnPleinSon : le début et la fin du fichier ne sont pas des coupes", () => {
    const plan = { morceaux: [{ source: 0 as const, debutSec: 0, finSec: 1 }, { source: 0 as const, debutSec: 1.5, finSec: 2 }] };
    expect(coupesEnPleinSon(plan, { corps: [{ debutSec: 0.9, finSec: 1.6 }] }, { corps: 2 })).toEqual([]);
    expect(coupesEnPleinSon(plan, { corps: [] }, { corps: 2 })).toEqual([
      { source: "corps", instantSec: 1 },
      { source: "corps", instantSec: 1.5 },
    ]);
  });

  it("dernière phrase coupée net dans la piste voix seule : refus Q19 bloquant", async () => {
    const m = monde();
    const etat = await voixFaite(PETIT, m);
    await expect(assemblerVersionsIV(etat, outilsAssemblage(m, { couperAvantFin: 0.6 }))).rejects.toMatchObject({ controle: "Q19", message: expect.stringMatching(/dernière phrase/) });
  });

  it("voix pas finie : rien à assembler", async () => {
    await expect(assemblerVersionsIV(etatInitialVoixIV(PETIT), outilsAssemblage(monde()))).rejects.toMatchObject({ controle: "entree" });
  });
});

/* ------------------------------------------------------------------ */
/* Version courte                                                        */
/* ------------------------------------------------------------------ */

describe("L12 · version courte taillée dans la même voix", () => {
  it("retire le dernier chapitre non essentiel : aucun appel HeyGen, mots gardés, repères renumérotés", async () => {
    const m = monde();
    const s = segmentsDe(FICHE_FAUX, ["youtube-shorts"]);
    const etat = await voixFaite(s, m);
    const lus = m.lus.length;
    const longues = await assemblerVersionsIV(etat, outilsAssemblage(m));
    const c = await assemblerVersionCourteIV({ etat, fiche: FICHE_FAUX, version: s.versions[0].id, retirer: 1 }, outilsAssemblage(m));
    expect(m.lus).toHaveLength(lus);
    expect(c.retires).toEqual(["Réclamation"]);
    expect(c.fiche.chapitres.map((x) => x.repere)).toEqual(["1/2", "2/2"]);
    const motsRetires = FICHE_FAUX.ecrans.filter((e) => FICHE_FAUX.chapitres[2].ecrans.includes(e.id)).reduce((n, e) => n + motsDits(e.texteDit).length, 0);
    expect(c.piste.motsCorps).toBe(longues[0].motsCorps - motsRetires);
    expect(c.motsGardes).toHaveLength(c.piste.motsCorps);
    expect(c.piste.version).toBe(`${s.versions[0].id}-courte`);
    expect(c.piste.courte).toBe(true);
    expect(c.piste.dureeSec).toBeLessThan(longues[0].dureeSec - 3);
    expect(c.piste.empreinte).not.toBe(longues[0].empreinte);
  });

  it("borne de chapitre dans un blanc de moins de 300 ms : coupe refusée (Q11 bis)", async () => {
    const m = monde({ motsPour: (t) => motsDuTexte(t, { pausePhrase: 0.2 }) });
    const s = segmentsDe(FICHE_FAUX, ["youtube-shorts"]);
    const etat = await voixFaite(s, m);
    await expect(assemblerVersionCourteIV({ etat, fiche: FICHE_FAUX, version: s.versions[0].id, retirer: 1 }, outilsAssemblage(m))).rejects.toMatchObject({
      controle: "Q11bis",
      message: expect.stringMatching(/silence mesuré d'au moins 300 ms/),
    });
  });

  it("aucun chapitre détachable : pas de version courte (Q11 bis)", async () => {
    const m = monde();
    const s = segmentsDe(FICHE_C, ["youtube-shorts"]);
    const etat = await voixFaite(s, m);
    await expect(assemblerVersionCourteIV({ etat, fiche: FICHE_C, version: s.versions[0].id, retirer: 1 }, outilsAssemblage(m))).rejects.toMatchObject({ controle: "Q11bis" });
  });
});

/* ------------------------------------------------------------------ */
/* Mixage                                                                */
/* ------------------------------------------------------------------ */

describe("L12 · mixage : voix seule + bruitages, −14 LUFS, jamais de musique", () => {
  const bruitage = (elementId: string, debutSec: number, declencheur = "chiffre"): BruitagePlace => ({ elementId, declencheur: declencheur as BruitagePlace["declencheur"], debutSec, dureeSec: 0.3, gainDb: -21 });

  it("l'empreinte de la piste voix seule est reportée dans le mixage", async () => {
    const m = monde();
    const etat = await voixFaite(PETIT, m);
    const [piste] = await assemblerVersionsIV(etat, outilsAssemblage(m));
    const d = planMixageIV(piste, [bruitage("b2", 2), bruitage("b1", 1)], piste.dureeSec + 2);
    expect(d.voix).toEqual({ cle: piste.cle, empreinte: piste.empreinte, dureeSec: piste.dureeSec });
    expect(d.loudnessLufs).toBe(-14);
    expect(d.musique).toBeNull();
    expect(d.bruitages.map((b) => b.elementId)).toEqual(["b1", "b2"]);
    expect(planMixageIV(piste, [bruitage("b1", 1), bruitage("b2", 2)], piste.dureeSec + 2).id).toBe(d.id);
    expect(() => planMixageIV(piste, [bruitage("fond", 0, "musique")], piste.dureeSec + 2)).toThrow(/jamais de musique/);
    expect(() => planMixageIV(piste, [], piste.finVoixSec - 1)).toThrow(/dernière phrase serait coupée/);
  });
});
