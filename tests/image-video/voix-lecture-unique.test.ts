/**
 * Lecture unique de la voix du format « image → vidéo » (20/10). HeyGen, rendu et stockage SIMULÉS (aucun appel payant) ; les sons
 * sont des WAV synthétiques fabriqués ici (mots = notes avec fondu de sortie, blancs = silence numérique) : tout est
 * déterministe.
 */
import { describe, expect, it, vi } from "vitest";
import { VERSION_MESURE_VOIX } from "@/briques/voix-maitre/reference";
import { REFERENCE_V4_IV } from "@/domaine/image-video/reference-voix";
import type { MotHorodate } from "@/domaine/types";
import { motsDits, type FicheImage } from "@/domaine/image-video/fiche";
import type { DemandeRendu, EtatRendu, FournisseurAlignement, FournisseurVoix, ServiceRendu, StockageFichiers } from "@/fournisseurs/types";
import {
  assemblerVersionCourteIV,
  assemblerVersionsIV,
  type DemandeVoixSeuleIV,
  type OutilsAssemblageIV,
} from "@/moteurs/montage-image-video/assemblage";
import { FICHES_SIMULEES } from "@/moteurs/montage-image-video/ecriture.simulation";
import { planDesFinsIV } from "@/moteurs/montage-image-video/fins";
import {
  avancerVoixIV,
  ErreurVoixIV,
  etatInitialVoixIV,
  rapportVoixIV,
  repriseVoixIV,
  segmentsVoixIV,
  sonsBrutsIV,
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

const FICHE_C = FICHES_SIMULEES["essai-c"] as FicheImage;
const FICHE_FAUX = FICHES_SIMULEES["essai-faux16"] as FicheImage;
const TOUS = ["youtube-shorts", "linkedin", "instagram", "facebook"] as const;

/* ------------------------------------------------------------------ */
/* Données : plan des fins écrit à la main (textes exacts)               */
/* ------------------------------------------------------------------ */

const FICHE_TEST = {
  ecrans: [{ texteDit: "Une demande arrive à minuit." }, { texteDit: "Elle part au bon service en quatre secondes." }],
} as unknown as Pick<FicheImage, "ecrans">;
const CORPS = "Une demande arrive à minuit. Elle part au bon service en quatre secondes.";
const QUESTION = "Et chez vous, qui répond ?";
const DIAGNOSTIC = "Faites votre diagnostic gratuit en quelques minutes.";
const PROFIL = "Le lien est dans mon profil.";
const COMMENTAIRE = "Le lien est en commentaire.";
/** 13 mots de corps ; commune = 5 + 7 = 12 mots ; profil 6 mots ; commentaire 5 mots. */
const MOTS_CORPS = 13;

const fin = (id: string, reseaux: string[], lien: string) => ({ id, reseaux, muet: false, question: { dit: QUESTION, ecran: QUESTION }, appels: [{ dit: DIAGNOSTIC }, { dit: lien }] });
const LI = { id: "fin-linkedin", reseaux: ["linkedin"], muet: true, appels: [] };
const IG = fin("fin-instagram", ["instagram"], PROFIL);
const YS = fin("fin-youtube-shorts", ["youtube-shorts"], PROFIL);
const FB = fin("fin-facebook", ["facebook"], COMMENTAIRE);
const plan = (...fins: object[]) => ({ fins }) as unknown as Parameters<typeof segmentsVoixIV>[1];
const PLAN_3 = plan(LI, IG, YS, FB);

const TEXTE_LU = `${CORPS} ${QUESTION} ${DIAGNOSTIC} ${PROFIL} ${COMMENTAIRE}`;

/* ------------------------------------------------------------------ */
/* Ce que lit la voix                                                    */
/* ------------------------------------------------------------------ */

describe("lecture unique · ce que la voix lit", () => {
  it("corps + partie commune + phrase Instagram + phrase Facebook, rien à lire à part, versions et plages justes", () => {
    const classique = segmentsVoixIV(FICHE_TEST, PLAN_3);
    const s = segmentsVoixIV(FICHE_TEST, PLAN_3, { lectureUnique: true });
    expect(s.corps).toBe(TEXTE_LU);
    expect(s.fins).toEqual([]);
    // Identifiants de versions inchangés.
    expect(s.versions).toEqual(classique.versions);
    expect(s.lecture).toEqual({
      motsCorps: MOTS_CORPS,
      fins: {
        "fin-instagram": [[13, 31]],
        "fin-youtube-shorts": [[13, 31]],
        // Facebook saute la phrase Instagram (mots 25 à 30).
        "fin-facebook": [
          [13, 25],
          [31, 36],
        ],
      },
    });
    // La lecture complète tient largement dans la limite de HeyGen (5 000 caractères).
    expect(s.corps.length).toBeLessThan(5000);
  });

  it("l'ordre du plan commande l'ordre des phrases propres", () => {
    const s = segmentsVoixIV(FICHE_TEST, plan(LI, FB, IG), { lectureUnique: true });
    expect(s.corps).toBe(`${CORPS} ${QUESTION} ${DIAGNOSTIC} ${COMMENTAIRE} ${PROFIL}`);
    expect(s.lecture!.fins).toEqual({
      "fin-facebook": [[13, 30]],
      "fin-instagram": [
        [13, 25],
        [30, 36],
      ],
    });
  });

  it("une seule fin distincte (Instagram et Shorts disent la même chose) : corps + fin entière", () => {
    const s = segmentsVoixIV(FICHE_TEST, plan(LI, IG, YS), { lectureUnique: true });
    expect(s.corps).toBe(`${CORPS} ${QUESTION} ${DIAGNOSTIC} ${PROFIL}`);
    expect(s.fins).toEqual([]);
    expect(s.lecture!.fins).toEqual({ "fin-instagram": [[13, 31]], "fin-youtube-shorts": [[13, 31]] });
  });

  it("LinkedIn seul, ou lecture unique non demandée : exactement le résultat d'avant", () => {
    const seul = segmentsVoixIV(FICHE_TEST, plan(LI), { lectureUnique: true });
    expect(seul).toEqual(segmentsVoixIV(FICHE_TEST, plan(LI)));
    expect(seul.lecture).toBeUndefined();
    expect(etatInitialVoixIV(seul).version).toBe("voix-iv/1");
    expect(segmentsVoixIV(FICHE_TEST, PLAN_3)).toEqual(segmentsVoixIV(FICHE_TEST, PLAN_3, { lectureUnique: false }));
    expect(segmentsVoixIV(FICHE_TEST, PLAN_3).lecture).toBeUndefined();
  });

  it("fins sans partie commune : chaque version garde sa seule phrase propre", () => {
    const autre = { ...fin("fin-autre", ["facebook"], COMMENTAIRE), question: { dit: "Autre question ?", ecran: "x" }, appels: [{ dit: "Autre fin." }] };
    const s = segmentsVoixIV(FICHE_TEST, plan(IG, autre), { lectureUnique: true });
    expect(s.corps).toBe(`${CORPS} ${QUESTION} ${DIAGNOSTIC} ${PROFIL} Autre question ? Autre fin.`);
    expect(s.lecture!.fins).toEqual({ "fin-instagram": [[13, 31]], "fin-autre": [[31, 35]] });
  });

  it("texte que la voix ne compte pas comme nous (un jeton « Ω » que la voix ignore) : signe retiré avec une remarque, jamais d'arrêt", () => {
    const fiche = { ecrans: [{ texteDit: "La version 2.0 répond 24/7 sans pause Ω." }] } as unknown as Pick<FicheImage, "ecrans">;
    const s = segmentsVoixIV(fiche, PLAN_3, { lectureUnique: true });
    expect(s.corps).not.toContain("Ω");
    expect(s.remarques?.[0]).toMatch(/Ω/);
    // Les plages de mots suivent le texte tel que la voix le lira (sans le signe).
    expect(s.lecture!.motsCorps).toBe(motsDits("La version 2.0 répond 24/7 sans pause").length);
    expect(etatInitialVoixIV(s).remarques).toEqual(s.remarques);
    // Sans lecture unique, le corps est nettoyé de la même façon ; sans signe, aucune remarque.
    const seul = segmentsVoixIV(fiche, PLAN_3);
    expect(seul.corps).not.toContain("Ω");
    expect(seul.remarques).toHaveLength(1);
    expect(() => segmentsVoixIV(fiche, plan(LI), { lectureUnique: true })).not.toThrow();
    expect(segmentsVoixIV(FICHE_TEST, PLAN_3).remarques).toBeUndefined();
  });

  it("vrai plan à 4 réseaux : chaque version garde exactement les mots de SA fin d'avant", () => {
    const vrai = planDesFinsIV({ reseaux: TOUS, offre: "integration", questionCommentaire: FICHE_C.questionCommentaire.texteDit });
    const avant = segmentsVoixIV(FICHE_C, vrai);
    const s = segmentsVoixIV(FICHE_C, vrai, { lectureUnique: true });
    expect(s.fins).toEqual([]);
    expect(s.versions).toEqual(avant.versions);
    expect(s.corps.startsWith(avant.corps)).toBe(true);
    const lus = motsDits(s.corps);
    for (const v of avant.versions) {
      const garde = (s.lecture!.fins[v.id] ?? []).flatMap(([a, b]) => lus.slice(a, b));
      const attendu = v.segment ? motsDits(avant.fins.find((f) => f.id === v.segment)!.texte) : [];
      expect(garde, v.id).toEqual(attendu);
    }
    expect(Object.keys(s.lecture!.fins)).not.toContain(avant.versions.find((v) => v.reseaux.includes("linkedin"))!.id);
  });
});

/* ------------------------------------------------------------------ */
/* La machine : UNE lecture, UNE réservation                              */
/* ------------------------------------------------------------------ */

const SEGMENTS_3 = segmentsVoixIV(FICHE_TEST, PLAN_3, { lectureUnique: true });

describe("lecture unique · une seule lecture payée", () => {
  it("l'état est « voix-iv/2 » ; la voix est lue UNE fois, d'un trait, avec UNE réservation au coût maximal du texte lu", async () => {
    const etat = etatInitialVoixIV(SEGMENTS_3);
    expect(etat.version).toBe("voix-iv/2");
    expect(etat.voix.fins).toEqual([]);
    const m = monde();
    const fini = await jusquAuBout(etat, outilsVoix(m));
    expect(fini.issue).toEqual({ statut: "faite" });
    expect(m.lus).toEqual([TEXTE_LU]);
    expect(m.reservations).toHaveLength(1);
    expect(m.reservations[0]).toMatchObject({ prise: "corps", texte: TEXTE_LU, caracteres: TEXTE_LU.length, coutMaxCentimes: Math.ceil(TEXTE_LU.length * TARIF - 1e-9) });
    expect(m.journal).toEqual(["R", "L"]);
    expect(rapportVoixIV(fini)).toEqual({ lecturesCorps: 1, lecturesFins: {}, payees: 1, coutCentimes: 2 });
  });

  it("une hésitation relit TOUT le texte (lecture neuve), 3 au plus, sans lecture de fin", async () => {
    const m = monde({ motsPour: (t, n) => motsDuTexte(t, n === 1 ? { insertions: { 20: "euh" } } : {}) });
    const fini = await jusquAuBout(etatInitialVoixIV(SEGMENTS_3), outilsVoix(m));
    expect(fini.issue).toEqual({ statut: "faite" });
    expect(m.lus).toEqual([TEXTE_LU, TEXTE_LU]);
    expect(m.nouvelles).toEqual([false, true]);
  });

  it("une voix « voix-iv/1 » reprise garde ses segments séparés : la reprise ne lit rien et ne change pas `payees`", async () => {
    const classique = segmentsVoixIV(FICHE_TEST, PLAN_3);
    const m = monde();
    const fini = await jusquAuBout(etatInitialVoixIV(classique), outilsVoix(m));
    expect(fini.version).toBe("voix-iv/1");
    expect(m.lus).toEqual([classique.corps, ...classique.fins.map((f) => f.texte)]);
    const lus = m.lus.length;
    const payees = JSON.stringify(fini.voix.payees);
    // Mêmes segments qu'avant : la reprise rend l'état tel quel ; il reste « voix-iv/1 », rien n'est relu.
    const repris = repriseVoixIV(fini, classique, outilsVoix(m));
    expect(repris.version).toBe("voix-iv/1");
    const encore = await jusquAuBout(repris, outilsVoix(m));
    expect(encore.issue).toEqual({ statut: "faite" });
    expect(m.lus).toHaveLength(lus);
    expect(m.reservations).toHaveLength(lus);
    expect(JSON.stringify(encore.voix.payees)).toBe(payees);
  });
});

/* ------------------------------------------------------------------ */
/* Découpe par heures de mots                                            */
/* ------------------------------------------------------------------ */

async function voixLue(m: Monde, s: SegmentsVoixIV = SEGMENTS_3): Promise<EtatVoixIV> {
  const fini = await jusquAuBout(etatInitialVoixIV(s), outilsVoix(m));
  expect(fini.issue).toEqual({ statut: "faite" });
  return fini;
}

describe("lecture unique · sons des versions taillés dans la lecture d'un trait", () => {
  const MOTS = motsDuTexte(TEXTE_LU);

  it("corps = les n premiers mots, coupe 0,05 s avant le premier mot de fin ; chaque version garde ses plages", async () => {
    const etat = await voixLue(monde());
    const sons = sonsBrutsIV(etat);
    expect(sons.fins).toEqual({});
    expect(sons.corps.mots).toEqual(MOTS.slice(0, 13));
    expect(sons.corps.dureeSec).toBeCloseTo(MOTS[13].debutSec - 0.05, 4);

    const li = sons.lecture!["fin-linkedin"];
    expect(li.son.mots).toEqual(MOTS.slice(0, 13));
    expect(li.coupeSec).toBeCloseTo(MOTS[13].debutSec - 0.05, 4);
    expect(li.son.dureeSec).toBe(li.coupeSec);
    expect(li.retraitsVoulus).toEqual([]);

    // Instagram : commune + sa phrase, coupée avant la phrase Facebook.
    const ig = sons.lecture!["fin-instagram"];
    expect(ig.motsCorps).toBe(13);
    expect(ig.son.mots).toEqual(MOTS.slice(0, 31));
    expect(ig.coupeSec).toBeCloseTo(MOTS[31].debutSec - 0.05, 4);
    expect(ig.retraitsVoulus).toEqual([]);
    expect(sons.lecture!["fin-youtube-shorts"]).toEqual(ig);

    // Facebook : commune + sa phrase, SANS la phrase Instagram (retrait voulu), jusqu'à la fin du fichier.
    const fb = sons.lecture!["fin-facebook"];
    expect(fb.son.mots).toEqual([...MOTS.slice(0, 25), ...MOTS.slice(31, 36)]);
    expect(fb.retraitsVoulus).toEqual([[MOTS[25].debutSec, MOTS[30].finSec]]);
    expect(fb.coupeSec).toBeUndefined();
    expect(fb.son.dureeSec).toBeGreaterThan(MOTS[35].finSec);
    expect(new Set([li, ig, fb].map((x) => x.son.fichierCle)).size).toBe(1);
  });

  it("un jeton sans lettre n'est pas un mot : il ne décale rien", async () => {
    const etat = await voixLue(monde());
    const prise = etat.voix.corps.prise!;
    if (prise.etat.phase !== "faite") throw new Error("inachevé");
    const lu = prise.brut ?? prise.etat.audio;
    const brut = { ...lu, mots: [lu.mots[0], { mot: "—", debutSec: 1.0, finSec: 1.01 }, ...lu.mots.slice(1)] };
    const avec = structuredClone(etat);
    avec.voix.corps.prise!.brut = brut;
    expect(sonsBrutsIV(avec)).toEqual(sonsBrutsIV(etat));
  });

  it("nombre de mots incohérent : refus « entree » clair, jamais une coupe au hasard", async () => {
    const etat = await voixLue(monde());
    const casse = structuredClone(etat);
    const prise = casse.voix.corps.prise!;
    if (prise.etat.phase !== "faite") throw new Error("inachevé");
    prise.etat.audio.mots.splice(7, 1);
    delete prise.brut;
    expect(() => sonsBrutsIV(casse)).toThrowError(ErreurVoixIV);
    expect(() => sonsBrutsIV(casse)).toThrowError(/ne correspondent pas au texte lu/);
    try {
      sonsBrutsIV(casse);
    } catch (err) {
      expect((err as ErreurVoixIV).controle).toBe("entree");
    }
  });

  it("voix pas finie : rien à tailler", () => {
    expect(() => sonsBrutsIV(etatInitialVoixIV(SEGMENTS_3))).toThrowError(/pas finie/);
  });
});

/* ------------------------------------------------------------------ */
/* Assemblage                                                            */
/* ------------------------------------------------------------------ */

describe("lecture unique · assemblage des pistes voix seule", () => {
  const MOTS = motsDuTexte(TEXTE_LU);
  const dit = (p: { mots: readonly MotHorodate[] }) => p.mots.map((x) => x.mot).join(" ");
  const mots = (t: string) => motsDits(t).join(" ");

  it("une piste par version, taillée dans le MÊME fichier ; la piste LinkedIn s'arrête avant le premier mot de fin ; aucune lecture", async () => {
    const m = monde();
    const etat = await voixLue(m);
    const lus = m.lus.length;
    const a = outilsAssemblage(m);
    const pistes = await assemblerVersionsIV(etat, a);
    expect(m.lus).toHaveLength(lus);
    expect(pistes.map((p) => p.version)).toEqual(["fin-linkedin", "fin-instagram", "fin-youtube-shorts", "fin-facebook"]);
    const [li, ig, ys, fb] = pistes;

    // Ce qui est dit.
    expect(dit(li)).toBe(mots(CORPS));
    expect(dit(ig)).toBe(mots(`${CORPS} ${QUESTION} ${DIAGNOSTIC} ${PROFIL}`));
    expect(dit(ys)).toBe(dit(ig));
    expect(dit(fb)).toBe(mots(`${CORPS} ${QUESTION} ${DIAGNOSTIC} ${COMMENTAIRE}`));
    expect(dit(fb)).not.toMatch(/profil/);

    // Corps / fin : comme avant le changement (les mots du corps d'abord, puis ceux de la fin).
    for (const p of pistes) expect(p.motsCorps).toBe(13);
    expect(li.mots).toHaveLength(13);
    expect(li.raccordSec).toBeUndefined();
    for (const p of [ig, ys, fb]) {
      expect(p.mots.length).toBeGreaterThan(13);
      expect(p.raccordSec).toBeCloseTo(p.mots[13].debutSec, 3);
    }

    // Les morceaux gardés dans le fichier lu : LinkedIn s'arrête avant le premier mot de fin.
    const morceaux = (i: number) => (a.demandes[i].recette.parametres.morceaux as { debutSec: number; finSec: number; silence?: true }[]).filter((x) => !x.silence);
    expect(Math.max(...morceaux(0).map((x) => x.finSec))).toBeLessThanOrEqual(MOTS[13].debutSec);
    // Instagram s'arrête avant la phrase Facebook.
    expect(Math.max(...morceaux(1).map((x) => x.finSec))).toBeLessThanOrEqual(MOTS[31].debutSec);
    // Facebook : aucun morceau dans la phrase Instagram.
    const [de, a2] = [MOTS[25].debutSec, MOTS[30].finSec];
    for (const x of morceaux(3)) expect(x.debutSec >= a2 - 0.001 || x.finSec <= de + 0.001, `morceau ${x.debutSec}-${x.finSec} dans la phrase Instagram`).toBe(true);
    expect(morceaux(3).some((x) => x.debutSec >= a2 - 0.001)).toBe(true);
    // Tous taillés dans le même son brut.
    expect(new Set(a.demandes.map((d) => d.recette.corps)).size).toBe(1);
    expect(a.demandes.every((d) => d.recette.fin === undefined)).toBe(true);
    // Les pistes qui disent la même chose sont identiques.
    expect(ig.empreinte).toBe(ys.empreinte);
    expect(new Set(pistes.map((p) => p.empreinte)).size).toBe(3);
  });

  it("coupe hors silence (parole collée à la coupe) : refus « coupe », jamais un son abîmé", async () => {
    // Un souffle remplit tout le blanc entre la phrase-choc et la question : la coupe de LinkedIn y tomberait.
    const m = monde({ bruits: () => [[MOTS[12].finSec, MOTS[13].debutSec]] });
    const etat = await voixLue(m);
    const a = outilsAssemblage(m);
    await expect(assemblerVersionsIV(etat, a)).rejects.toMatchObject({ controle: "coupe", message: expect.stringMatching(/tombe en plein son/) });
    expect(a.demandes).toHaveLength(0);
  });

  it("phrase Instagram collée à la phrase Facebook (aucun blanc) : refus « coupe », rien de fabriqué", async () => {
    // Le blanc après la phrase Instagram (mot 30 → 31) est rempli : Instagram ne peut être coupé là.
    const m = monde({ bruits: () => [[MOTS[30].finSec, MOTS[31].debutSec]] });
    const etat = await voixLue(m);
    const a = outilsAssemblage(m);
    await expect(assemblerVersionsIV(etat, a)).rejects.toMatchObject({ controle: "coupe" });
  });

  it("phrase Instagram sautée sans blanc avant elle (Facebook) : refus « coupe », rien de fabriqué", async () => {
    const m = monde({ bruits: () => [[MOTS[24].finSec, MOTS[25].debutSec]] });
    const etat = await voixLue(m);
    await expect(assemblerVersionsIV(etat, outilsAssemblage(m))).rejects.toMatchObject({ controle: "coupe" });
  });

  it("version courte (chapitre retiré) : taillée dans la même lecture, la fin gardée, aucune lecture de plus", async () => {
    const vrai = planDesFinsIV({ reseaux: ["youtube-shorts"], offre: "integration", questionCommentaire: FICHE_FAUX.questionCommentaire.texteDit });
    const s = segmentsVoixIV(FICHE_FAUX, vrai, { lectureUnique: true });
    expect(s.lecture).toBeDefined();
    const m = monde();
    const etat = await voixLue(m, s);
    const lus = m.lus.length;
    expect(lus).toBe(1);
    const longues = await assemblerVersionsIV(etat, outilsAssemblage(m));
    const c = await assemblerVersionCourteIV({ etat, fiche: FICHE_FAUX, version: s.versions[0].id, retirer: 1 }, outilsAssemblage(m));
    expect(m.lus).toHaveLength(lus);
    const motsRetires = FICHE_FAUX.ecrans.filter((e) => FICHE_FAUX.chapitres[2].ecrans.includes(e.id)).reduce((n, e) => n + motsDits(e.texteDit).length, 0);
    expect(c.piste.motsCorps).toBe(longues[0].motsCorps - motsRetires);
    // La fin est intacte.
    expect(c.piste.mots.length - c.piste.motsCorps).toBe(longues[0].mots.length - longues[0].motsCorps);
    expect(c.piste.mots.slice(c.piste.motsCorps).map((x) => x.mot)).toEqual(longues[0].mots.slice(longues[0].motsCorps).map((x) => x.mot));
    expect(c.piste.dureeSec).toBeLessThan(longues[0].dureeSec - 3);
  });
});
