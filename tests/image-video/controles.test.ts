/**
 * L13 · Contrôles finaux et porte unique. Cartes figées, fiches simulées de L6, plan des fins de L14, voix SIMULÉE
 * (heures des mots au débit de référence (3,4 mots/s), WAV synthétique), mise en scène de L11. Transcription, extraction d'images, relecture
 * Claude, mise en page des instants clés : DOUBLES. Aucun appel payant, aucune date, aucun hasard.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import type { CarteImage } from "@/domaine/image-video/carte";
import type { FicheImage } from "@/domaine/image-video/fiche";
import { RESEAUX_IV, type ReseauIV } from "@/domaine/image-video/plafonds";
import type { MotHorodate } from "@/domaine/types";
import { idElementBruitage, SONS_BANQUE } from "@/donnees/bruitages";
import type { DefinitionRole, EntreeRole } from "@/generateur/roles/types";
import { empreinteSon, type PisteVoixSeuleIV } from "@/moteurs/montage-image-video/assemblage";
import type { BruitageValideIV } from "@/moteurs/montage-image-video/bruitages";
import { pisteSimulee } from "@/moteurs/montage-image-video/calage";
import { ficheSansChapitres } from "@/moteurs/montage-image-video/recettes";
import { chiffresDuTexte } from "@/moteurs/montage-image-video/regles";
import { bloque, CODES_CONTROLE_IV, CONTROLES_INDICATIFS, scriptDeLaVersion, type VersionAControlerIV } from "@/moteurs/montage-image-video/controles";
import { comparerAuScript, ecouterVersionIV, PHRASES_PARASITES_WHISPER, SEUILS_ECOUTE_IV, transcriptionUtile, type DemandeReservationControleIV, type DemandeTranscriptionIV } from "@/moteurs/montage-image-video/ecoute";
import { FICHES_SIMULEES } from "@/moteurs/montage-image-video/ecriture.simulation";
import { liensSuivisIV, planDesFinsIV, type FinIV, type PlanDesFinsIV } from "@/moteurs/montage-image-video/fins";
import { mettreEnSceneIV } from "@/moteurs/montage-image-video/mise-en-scene";
import { porteUniqueIV, type EntreePorteIV, type OutilsPorteIV } from "@/moteurs/montage-image-video/porte";
import { textesDePublicationIV } from "@/moteurs/montage-image-video/publication";
import { cleRelectureIV, demandeImagesControleIV, instantsClesIV, IMAGES_CLES_MAX, roleRelectureFinale, type DemandeImagesControleIV, type RelectureFinale } from "@/moteurs/montage-image-video/relecture-finale";

// Portes complètes de toutes les versions : plus de 5 s sur une machine chargée (délais déjà relevés sur le socle).
vi.setConfig({ testTimeout: 60_000 });

const DOSSIER = join(process.cwd(), "tests/image-video/fixtures/cartes");
const VALIDES: BruitageValideIV[] = SONS_BANQUE.map((s) => ({ elementId: idElementBruitage(s), declencheur: s.declencheur, variante: s.variante, dureeSec: s.dureeSec }));
const IMAGES = { A: "essai-a", C: "essai-c", "faux-16-noeuds": "essai-faux16" } as const;
type Image = keyof typeof IMAGES;

function carteDe(nom: Image): CarteImage {
  const c: CarteImage = JSON.parse(readFileSync(join(DOSSIER, `${nom}.json`), "utf8"));
  // Carte validée par Will, formules absolues tranchées (« garder ») : l'état attendu à l'entrée de la porte.
  return { ...c, formulesAbsolues: c.formulesAbsolues.map((f) => ({ ...f, choixWill: f.choixWill ?? "garder" })), validation: { par: "will", le: "essai", empreinteCarte: c.image.empreinte } };
}

/* ------------------------------------------------------------------ */
/* Son synthétique                                                       */
/* ------------------------------------------------------------------ */

const FREQ = 8000;
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
/** Une note par mot (fondu d'entrée 20 ms, de sortie 150 ms), silence ailleurs ; `bruit` : un son en plus (clôture). */
function sonDesMots(mots: readonly MotHorodate[], dureeSec: number, bruit?: [number, number]): Uint8Array {
  const e = new Float32Array(Math.round(dureeSec * FREQ));
  for (const m of mots) {
    for (let i = Math.round(m.debutSec * FREQ); i < Math.round(m.finSec * FREQ) && i < e.length; i++) {
      const t = i / FREQ;
      const env = 0.3 * Math.min(1, (t - m.debutSec) / 0.02) * Math.min(1, (m.finSec - t) / 0.15);
      e[i] = env * Math.sin(2 * Math.PI * 220 * t);
    }
  }
  if (bruit) for (let i = Math.round(bruit[0] * FREQ); i < Math.round(bruit[1] * FREQ) && i < e.length; i++) e[i] = 0.2 * Math.sin(2 * Math.PI * 97 * (i / FREQ));
  return wav(e);
}

/* ------------------------------------------------------------------ */
/* Une vidéo simulée complète                                            */
/* ------------------------------------------------------------------ */

interface Montage {
  entree: EntreePorteIV;
  sons: Map<string, Uint8Array>;
  plan: PlanDesFinsIV;
}

function versionDe(carte: CarteImage, fiche: FicheImage, fin: FinIV, sons: Map<string, Uint8Array>, o: { courte?: boolean; retires?: string[]; noeudsRetires?: string[] } = {}): VersionAControlerIV {
  const segment = fin.muet ? null : fin;
  // Départ décalé d'un centième par version déjà posée : depuis le 26/10/2026 plusieurs fins ont le même nombre de mots, donc
  // le même son simulé, et l'écoute (mise en cache par empreinte) confondrait leurs transcriptions ; les vraies voix diffèrent.
  const voix = pisteSimulee(fiche, segment, { departSec: 0.1 + 0.01 * sons.size });
  const id = `${fin.id}${o.courte ? "-courte" : ""}`;
  const cle = `voix/${id}.wav`;
  const octets = sonDesMots(voix.mots, voix.dureeSec);
  sons.set(cle, octets);
  const piste: PisteVoixSeuleIV = {
    version: id,
    reseaux: [...fin.reseaux],
    courte: !!o.courte,
    cle,
    dureeSec: voix.dureeSec,
    empreinte: empreinteSon(octets),
    mots: voix.mots,
    motsCorps: voix.motsCorps,
    ...(segment ? { raccordSec: voix.mots[voix.motsCorps]?.debutSec } : {}),
    finVoixSec: voix.finVoixSec,
    coupesDeplacees: 0,
    tempo: 1.05,
  };
  const scene = { carte, fiche, voix, fin: segment ? fin : null, reseaux: fin.reseaux, bruitagesValides: VALIDES };
  const ligne = mettreEnSceneIV(scene).ligne;
  return {
    version: id,
    reseaux: [...fin.reseaux],
    courte: !!o.courte,
    fiche,
    ...(o.retires ? { retires: o.retires, noeudsRetires: o.noeudsRetires ?? [] } : {}),
    fin: segment ? fin : null,
    piste,
    scene,
    ligne,
    mixage: { voix: { empreinte: piste.empreinte } },
    fichier: { cle: `final/${id}.mp4`, empreinte: `final-${piste.empreinte}`, mesures: { lufs: -14, creteVraieDbtp: -1.5, noirMaxSec: 0, figeMaxSec: 0, largeur: 1080, hauteur: 1920, fps: 25 } },
  };
}

function monter(nom: Image, reseaux: readonly ReseauIV[] = RESEAUX_IV): Montage {
  const carte = carteDe(nom);
  const fiche = FICHES_SIMULEES[IMAGES[nom]];
  const plan = planDesFinsIV({ reseaux, offre: carte.offre, questionCommentaire: fiche.questionCommentaire.texteDit });
  const sons = new Map<string, Uint8Array>();
  const versions = plan.fins.map((f) => versionDe(carte, fiche, f, sons));
  const liens = liensSuivisIV(reseaux, 42);
  const publication = textesDePublicationIV({ accroche: fiche.accroches[0].texteDit, resultat: carte.phraseChoc, questionCommentaire: fiche.questionCommentaire.texteDit }, plan, liens);
  return { entree: { videoId: "v-essai", carte, fiche, reseaux, plan, voix: { issue: { statut: "faite" } }, versions, publication, liens }, sons, plan };
}

interface Journal {
  reservations: DemandeReservationControleIV[];
  transcriptions: DemandeTranscriptionIV[];
  extractions: DemandeImagesControleIV[];
  appels: EntreeRole[];
}

function outils(m: Montage, o: {
  transcrire?: (d: DemandeTranscriptionIV, mots: MotHorodate[]) => MotHorodate[];
  /** Réponse du k-ième appel Claude (0, 1…) : peut être illisible pour forcer une relance. */
  relecture?: (r: RelectureFinale, k: number) => unknown;
  /** Le k-ième appel Claude tombe en panne. */
  panne?: (k: number) => boolean;
  /** Générateur d'identifiants d'appel (partagé entre exécutions pour vérifier l'unicité d'une exécution à l'autre). */
  idAppel?: (prefixe: string) => string;
  extraction?: (d: DemandeImagesControleIV) => { nom: string; cle: string }[];
  reserver?: (d: DemandeReservationControleIV) => { ok: true } | { ok: false; message: string };
} = {}): { o: OutilsPorteIV; j: Journal } {
  const j: Journal = { reservations: [], transcriptions: [], extractions: [], appels: [] };
  const motsDe = (cle: string) => m.entree.versions.find((v) => v.piste.cle === cle)!.piste.mots;
  let n = 0;
  let k = 0;
  return {
    j,
    o: {
      lireSon: async (cle) => m.sons.get(cle) ?? null,
      budget: {
        reserver: async (d) => {
          j.reservations.push(d);
          return o.reserver?.(d) ?? { ok: true };
        },
      },
      transcrire: async (d) => {
        if (!j.reservations.some((r) => r.appelId === d.appelId)) throw new Error("transcription sans réservation");
        j.transcriptions.push(d);
        const mots = motsDe(d.cle).map((x) => ({ ...x }));
        return { mots: o.transcrire ? o.transcrire(d, mots) : mots };
      },
      extraireImages: async (d) => {
        j.extractions.push(d);
        return { images: o.extraction ? o.extraction(d) : d.parametres.instants.map((i) => ({ nom: i.nom, cle: d.parametres.cles[i.nom] })) };
      },
      lireImage: async (cle) => ({ octets: new TextEncoder().encode(cle), type: cle.endsWith(".png") ? "image/png" : "image/jpeg" }),
      idAppel: o.idAppel ?? ((prefixe) => `${prefixe}-${++n}`),
      appeler: async (role: DefinitionRole, entree: EntreeRole) => {
        // Chaque appel consomme SA réservation Claude : plus d'appels que de réservations = appel sans réservation.
        if (j.reservations.filter((r) => r.fournisseur === "claude").length <= j.appels.length) throw new Error("appel Claude sans réservation");
        j.appels.push(entree);
        const rang = k++;
        if (o.panne?.(rang)) throw new Error("connexion coupée");
        const r = role.simuler(entree) as RelectureFinale;
        return { ok: true, simule: true, donnees: o.relecture ? o.relecture(r, rang) : r };
      },
    },
  };
}

const blocages = (v: Awaited<ReturnType<typeof porteUniqueIV>>) => v.versions.flatMap((x) => x.lignes.filter(bloque).map((l) => `${x.version} ${l.code} ${l.phrase}`));

/* ------------------------------------------------------------------ */
/* Tests                                                                 */
/* ------------------------------------------------------------------ */

describe("porte unique : une vidéo conforme passe, sur toutes ses versions", () => {
  for (const nom of Object.keys(IMAGES) as Image[]) {
    it(`${nom} : prête, chaque version a ses ${CODES_CONTROLE_IV.length} lignes, réservation avant chaque appel payant`, async () => {
      const m = monter(nom);
      const { o, j } = outils(m);
      const v = await porteUniqueIV(m.entree, o);
      expect(blocages(v)).toEqual([]);
      expect(v.ok).toBe(true);
      expect(v.statut).toBe("prete");
      expect(v.versions.length).toBe(m.plan.fins.length);
      for (const x of v.versions) expect(x.lignes.map((l) => l.code)).toEqual([...CODES_CONTROLE_IV]);
      // Une transcription et une relecture par version, chacune réservée avant.
      // (deux pistes aux mêmes octets ne sont transcrites qu'une fois : la voix simulée ne dépend que des heures).
      const pistes = new Set(m.entree.versions.map((x) => x.piste.empreinte)).size;
      expect(j.transcriptions.length).toBe(pistes);
      expect(j.appels.length).toBe(m.plan.fins.length);
      expect(j.reservations.filter((r) => r.fournisseur === "transcription").length).toBe(pistes);
      expect(j.reservations.filter((r) => r.fournisseur === "claude").length).toBe(m.plan.fins.length);
      expect(v.appelsPayes).toBe(pistes + m.plan.fins.length);
      // La transcription porte sur la piste VOIX SEULE, bornée à la fin de voix.
      for (const t of j.transcriptions) {
        const ver = m.entree.versions.find((x) => x.piste.cle === t.cle)!;
        expect(t.cle).toMatch(/^voix\//);
        expect(t.jusquaSec).toBeCloseTo(ver.piste.finVoixSec + 0.3, 3);
      }
    });
  }

  // Deux portes complètes (toutes les versions) : plus de 5 s sur une machine lente (déjà le cas sur la tête du socle).
  it("déterministe : même vidéo, même verdict (au caractère près)", { timeout: 60_000 }, async () => {
    const a = await porteUniqueIV(monter("C").entree, outils(monter("C")).o);
    const m = monter("C");
    const b = await porteUniqueIV(m.entree, outils(m).o);
    expect(JSON.stringify(b)).toBe(JSON.stringify(a));
  });

  it("reprise : transcriptions et relectures déjà obtenues ne sont pas repayées", async () => {
    const m = monter("A");
    const premier = await porteUniqueIV(m.entree, outils(m).o);
    const { o, j } = outils(m);
    const v = await porteUniqueIV({ ...m.entree, deja: { transcriptions: premier.transcriptions, relectures: premier.relectures } }, o);
    expect(v.ok).toBe(true);
    expect(j.reservations).toEqual([]);
    expect(v.appelsPayes).toBe(0);
  });

  it("fichier final refait → relecture refaite (jamais reprise sur des images qu'elle n'a pas vues)", async () => {
    const m = monter("A");
    const premier = await porteUniqueIV(m.entree, outils(m).o);
    const refaite = m.entree.versions[0];
    refaite.fichier = { ...refaite.fichier, empreinte: "final-nouveau-rendu" };
    const { o, j } = outils(m, { relecture: (r) => ({ ...r, images: r.images.map((x, i) => (i === 0 ? { ...x, faux: "le chiffre 1er jour est devenu 2e jour" } : x)) }) });
    const v = await porteUniqueIV({ ...m.entree, deja: { transcriptions: premier.transcriptions, relectures: premier.relectures } }, o);
    // Seule la version refaite est relue (réservation et appel neufs) ; elle est refusée sur ce que voit la relecture.
    expect(j.appels.length).toBe(1);
    expect(j.reservations.filter((r) => r.fournisseur === "claude").length).toBe(1);
    expect(j.extractions.map((d) => d.source)).toEqual([refaite.fichier.cle]);
    expect(v.ok).toBe(false);
    expect(v.versions[0].lignes.find((l) => l.code === "Q26")!.phrase).toMatch(/2e jour/);

    // Sans empreinte du fichier final, une relecture n'est jamais reprise.
    const m2 = monter("A");
    for (const x of m2.entree.versions) delete x.fichier.empreinte;
    const p2 = await porteUniqueIV(m2.entree, outils(m2).o);
    expect(p2.relectures).toEqual({});
    const { o: o2, j: j2 } = outils(m2);
    await porteUniqueIV({ ...m2.entree, deja: { relectures: premier.relectures } }, o2);
    expect(j2.appels.length).toBe(m2.entree.versions.length);
  });

  it("A relue conforme, B refusée, B corrigée, rendu des deux refait → A et B relues à nouveau", async () => {
    const m = monter("A");
    expect(m.entree.versions.length).toBeGreaterThan(1);
    const [a, b] = m.entree.versions;
    // 1er passage : A relue conforme, B refusée (le 2ᵉ appel est celui de B).
    const p1 = outils(m, { relecture: (r, k) => (k === 1 ? { ...r, images: r.images.map((x, i) => (i === 0 ? { ...x, faux: "20 % au lieu de 30 %" } : x)) } : r) });
    const premier = await porteUniqueIV(m.entree, p1.o);
    expect(premier.ok).toBe(false);
    expect(premier.versions.find((x) => x.version === a.version)!.lignes.find((l) => l.code === "Q26")!.etat).toBe("reussi");
    expect(premier.versions.find((x) => x.version === b.version)!.lignes.find((l) => l.code === "Q26")!.etat).toBe("echoue");
    // B corrigée, rendu des DEUX refait (même clé de stockage, autres octets) ; reprise avec les relectures obtenues.
    const refaites = m.entree.versions.map((v) => ({ ...v, fichier: { ...v.fichier, empreinte: `rendu-2-${v.version}` } }));
    const m2: Montage = { ...m, entree: { ...m.entree, versions: refaites } };
    const p2 = outils(m2);
    const second = await porteUniqueIV({ ...m2.entree, deja: { transcriptions: premier.transcriptions, relectures: premier.relectures } }, p2.o);
    expect(second.ok).toBe(true);
    // A et B relues à nouveau, chaque appel réservé ; les transcriptions (même piste voix seule) sont reprises.
    expect(p2.j.appels.length).toBe(refaites.length);
    expect(p2.j.extractions.map((d) => d.source)).toEqual(refaites.map((v) => v.fichier.cle));
    expect(p2.j.reservations.filter((r) => r.fournisseur === "claude").length).toBe(refaites.length);
    expect(p2.j.transcriptions).toEqual([]);
    // Les relectures neuves sont rangées sous le NOUVEAU fichier ; d'autres instants donnent une autre clé.
    for (const v of refaites) expect(second.relectures[cleRelectureIV(v.fichier.cle, v.fichier.empreinte, instantsClesIV(v.ligne, m.entree.carte))!]).toBeDefined();
    const ia = instantsClesIV(a.ligne, m.entree.carte);
    expect(cleRelectureIV(a.fichier.cle, "rendu-2", ia.map((i, n) => (n === 0 ? { ...i, instantSec: i.instantSec + 0.5 } : i)))).not.toBe(cleRelectureIV(a.fichier.cle, "rendu-2", ia));
  });

  it("identifiant d'appel unique par tentative : relance et reprise après interruption ont chacune leur réservation", async () => {
    const m = monter("C");
    let n = 0;
    const idAppel = (prefixe: string) => `${prefixe}-${++n}`;
    // 1er passage : le 1er appel répond illisible (relance), le 3ᵉ tombe en panne (relecture interrompue).
    const p1 = outils(m, { idAppel, relecture: (r, k) => (k === 0 ? { illisible: true } : r), panne: (k) => k === 2 });
    const premier = await porteUniqueIV(m.entree, p1.o);
    // Relecture interrompue : remarque « images finales non relues », la vidéo continue.
    expect(premier.ok).toBe(true);
    expect(premier.mentions.join()).toMatch(/images finales non relues/);
    const ids1 = p1.j.reservations.filter((r) => r.fournisseur === "claude").map((r) => r.appelId);
    expect(ids1.length).toBe(p1.j.appels.length);
    expect(ids1.length).toBe(m.entree.versions.length + 1);
    expect(new Set(ids1).size).toBe(ids1.length);
    expect(ids1[0]).toMatch(new RegExp(`^iv-relecture-v-essai-${m.entree.versions[0].version}-.+-1-1$`));
    expect(ids1[1]).toMatch(new RegExp(`^iv-relecture-v-essai-${m.entree.versions[0].version}-.+-2-2$`));
    // Reprise sur le MÊME fichier : la version interrompue est relue sous un NOUVEL identifiant, avec sa réservation.
    const p2 = outils(m, { idAppel });
    const second = await porteUniqueIV({ ...m.entree, deja: { transcriptions: premier.transcriptions, relectures: premier.relectures } }, p2.o);
    expect(second.ok).toBe(true);
    const ids2 = p2.j.reservations.filter((r) => r.fournisseur === "claude").map((r) => r.appelId);
    expect(ids2.length).toBe(1);
    expect(p2.j.appels.length).toBe(1);
    expect(ids1).not.toContain(ids2[0]);
  });

  it("aucun réseau demandé : refus clair", async () => {
    const m = monter("A");
    const v = await porteUniqueIV({ ...m.entree, reseaux: [] }, outils(m).o);
    expect(v.ok).toBe(false);
    expect(v.phrases.join()).toMatch(/aucun réseau demandé/i);
  });
});

describe("écoute (Q18) et fin (Q19) sur la piste voix seule", () => {
  it("une transcription à laquelle manque la dernière phrase : remarques (Q19, Q06), la vidéo sort, relecture lancée", async () => {
    const m = monter("A");
    const { o } = outils(m, {
      transcrire: (_d, mots) => {
        // Retire la dernière phrase (depuis le dernier mot qui finit une phrase avant la fin).
        let k = mots.length - 2;
        while (k > 0 && !/[.?!…]$/.test(mots[k].mot)) k--;
        return mots.slice(0, k + 1);
      },
    });
    const v = await porteUniqueIV(m.entree, o);
    // 25/10/2026 : Q19 et la phrase-choc non entendue (Q06 : erreur de transcription, la voix existe) ne sont que des remarques.
    expect(v.ok).toBe(true);
    const q19 = v.versions.flatMap((x) => x.lignes).filter((l) => l.code === "Q19" && l.etat === "echoue");
    expect(q19.length).toBeGreaterThan(0);
    expect(q19.every((l) => !l.bloquant)).toBe(true);
    expect(q19[0].phrase).toMatch(/dernière phrase/);
    const q06 = v.versions.flatMap((x) => x.lignes).filter((l) => l.code === "Q06" && l.etat === "echoue");
    expect(q06.length).toBeGreaterThan(0);
    expect(q06.every((l) => !bloque(l))).toBe(true);
    expect(v.mentions.join()).toMatch(/phrase-choc/);
    // La vidéo n'est pas refusée : la relecture payante a lieu.
    expect(v.versions.flatMap((x) => x.lignes).filter((l) => l.code === "Q26").every((l) => l.etat !== "non-fait")).toBe(true);
  });

  it("« Sous-titres réalisés par… » après la voix n'est PAS refusé (filtré et hors bornes)", async () => {
    const m = monter("A");
    const { o } = outils(m, {
      transcrire: (_d, mots) => {
        const fin = mots[mots.length - 1].finSec;
        const parasite = "Sous-titres réalisés par la communauté d'Amara.org".split(" ").map((mot, i) => ({ mot, debutSec: fin + 0.05 + i * 0.03, finSec: fin + 0.07 + i * 0.03 }));
        return [...mots, ...parasite];
      },
    });
    const v = await porteUniqueIV(m.entree, o);
    expect(blocages(v)).toEqual([]);
    expect(v.ok).toBe(true);
  });

  it("filtre : une phrase parasite DANS les bornes est retirée ; une phrase dite par le script ne l'est pas", () => {
    const mots = "Bonjour à tous. Merci d'avoir regardé".split(" ").map((mot, i) => ({ mot, debutSec: i * 0.3, finSec: i * 0.3 + 0.25 }));
    expect(transcriptionUtile(mots, { finVoixSec: 10, script: "Bonjour à tous." }).mots.map((m) => m.mot)).toEqual(["Bonjour", "à", "tous."]);
    expect(transcriptionUtile(mots, { finVoixSec: 10, script: "Bonjour à tous. Merci d'avoir regardé." }).mots.length).toBe(mots.length);
    // Mot entendu après la fin de la voix (+ 0,3 s) : ignoré.
    const u = transcriptionUtile([...mots, { mot: "Abonnez", debutSec: 12, finSec: 12.2 }], { finVoixSec: 10, script: "x" });
    expect(u.horsBornes).toEqual(["Abonnez"]);
    expect(PHRASES_PARASITES_WHISPER.length).toBeGreaterThan(5);
  });

  it("un son de clôture sur le MIXAGE ne fait pas échouer Q19 : la mesure se fait sur la voix seule", async () => {
    const m = monter("A");
    // Le fichier mixé porte un son de clôture jusqu'à la dernière image ; il n'est jamais lu par l'écoute.
    for (const v of m.entree.versions) m.sons.set(v.fichier.cle, sonDesMots(v.piste.mots, v.ligne.dureeSec, [v.piste.finVoixSec + 0.1, v.ligne.dureeSec]));
    const lus: string[] = [];
    const { o } = outils(m);
    const v = await porteUniqueIV(m.entree, { ...o, lireSon: async (cle) => (lus.push(cle), m.sons.get(cle) ?? null) });
    expect(v.ok).toBe(true);
    expect(lus.every((c) => c.startsWith("voix/"))).toBe(true);
    // À l'inverse, une voix seule sans silence final est refusée.
    const ver = m.entree.versions[0];
    m.sons.set(ver.piste.cle, sonDesMots(ver.piste.mots, ver.piste.dureeSec, [ver.piste.finVoixSec, ver.piste.dureeSec]));
    const octets = m.sons.get(ver.piste.cle)!;
    const r = await ecouterVersionIV(
      { videoId: "v", script: scriptDeLaVersion(ver), piste: { ...ver.piste, empreinte: empreinteSon(octets) }, final: { dureeSec: ver.ligne.dureeSec, finVoixSec: ver.ligne.finVoixSec, empreinteVoixMixee: empreinteSon(octets) }, depenseAutorisee: true },
      o,
    );
    expect(r.q19.ok).toBe(false);
    expect(r.q19.details.join()).toMatch(/silence mesuré sur la voix seule/);
  });

  it("la voix mixée doit être la piste contrôlée (empreinte) ; une piste absente n'est jamais « réussie »", async () => {
    const m = monter("A");
    m.entree.versions[1].mixage.voix.empreinte = "voix-seule-autre";
    m.sons.delete(m.entree.versions[2].piste.cle);
    const { o } = outils(m);
    const v = await porteUniqueIV(m.entree, o);
    expect(v.ok).toBe(false);
    expect(v.versions[1].lignes.find((l) => l.code === "Q19")!.phrase).toMatch(/empreinte/);
    const q17 = v.versions[2].lignes.find((l) => l.code === "Q17")!;
    expect(q17.etat).toBe("echoue");
    expect(v.versions[2].lignes.find((l) => l.code === "Q18")!.etat).toBe("non-fait");
  });

  it("un chiffre non entendu (valeur ET unité) est une remarque : erreur de transcription, la vidéo continue", async () => {
    const m = monter("C");
    const ver = m.entree.versions[0];
    const script = scriptDeLaVersion(ver);
    // Retire de la transcription le premier mot qui porte un chiffre dit.
    const { o } = outils(m, {
      transcrire: (d, mots) => {
        if (d.cle !== ver.piste.cle) return mots;
        const k = mots.findIndex((x) => /^(deux|trois|quatre|cinq|six|sept|huit|neuf|dix|vingt|trente|quarante|cinquante|soixante|cent|quatre-vingts?)\b/i.test(x.mot));
        return mots.map((x, i) => (i === k ? { ...x, mot: "beaucoup" } : x));
      },
    });
    expect(script.length).toBeGreaterThan(0);
    const v = await porteUniqueIV(m.entree, o);
    const lignes = v.versions[0].lignes.filter(bloque).map((l) => l.code);
    expect(lignes).not.toContain("CHIFFRES");
    expect(lignes).not.toContain("Q18");
    const ch = v.versions[0].lignes.find((l) => l.code === "CHIFFRES")!;
    expect(ch.etat).toBe("echoue");
    expect(ch.bloquant).toBe(false);
    expect(ch.phrase).toMatch(/n'est pas entendu/);
    expect(v.versions[0].lignes.find((l) => l.code === "Q18")!.phrase).toMatch(/chiffre/);
  });

  it("comparaison : un ajout de plus de 2 mots est refusé, un mot mal entendu ne l'est pas", () => {
    const script = "Votre équipe répond à vingt e-mails par jour. Chaque réponse prend trois minutes.";
    const mots = (t: string) => t.split(" ").map((mot, i) => ({ mot, debutSec: i * 0.4, finSec: i * 0.4 + 0.3 }));
    const juste = comparerAuScript(script, mots("Votre équipe répond à 20 e-mails par jour. Chaque réponse prend 3 minutes."));
    expect(juste.part).toBe(1);
    expect(juste.chiffresNonEntendus).toEqual([]);
    expect(juste.derniereEntiere).toBe(true);
    const ajout = comparerAuScript(script, mots("Votre équipe répond à 20 e-mails par jour. Et ça coûte cher. Chaque réponse prend 3 minutes."));
    expect(ajout.ajouts.some((a) => a.mots > 2)).toBe(true);
    const faute = comparerAuScript(script, mots("Votre équipe répond à 20 e-mail par jour. Chaque réponse prend 3 minutes."));
    expect(faute.part).toBe(1);
    const autre = comparerAuScript(script, mots("Votre équipe répond à 20 e-mails par jour. Chaque réponse prend 3 heures."));
    expect(autre.chiffresNonEntendus.length).toBe(1);
    expect(autre.chiffresInventes.length).toBe(1);
  });

  it("refus de réservation : aucune transcription, contrôle « non vérifié » et bloquant", async () => {
    const m = monter("A");
    const { o, j } = outils(m, { reserver: (d) => (d.fournisseur === "transcription" ? { ok: false, message: "plafond atteint" } : { ok: true }) });
    const v = await porteUniqueIV(m.entree, o);
    expect(j.transcriptions).toEqual([]);
    expect(v.ok).toBe(false);
    const q18 = v.versions[0].lignes.find((l) => l.code === "Q18")!;
    expect(q18.etat).toBe("non-fait");
    expect(q18.phrase).toMatch(/réservée/);
  });
});

describe("écoute (Q18) : indicative entre le plancher et le seuil, bloquante en dessous du plancher", () => {
  /** Retire `part` des mots de la transcription (hors chiffres), répartis, sans toucher au dernier mot. */
  const retirer = (part: number) => (_d: unknown, mots: { mot: string; debutSec: number; finSec: number }[]) => {
    const candidats = mots.map((x, i) => i).filter((i) => i < mots.length - 1 && /^[a-zàâçéèêëîïôûù]{1,5}$/i.test(mots[i].mot) && chiffresDuTexte(mots[i].mot).length === 0 && !/^(un|une|deux|trois|quatre|cinq|six|sept|huit|neuf|dix|vingt|trente|cent|mille|zéro)$/i.test(mots[i].mot));
    const nb = Math.round(mots.length * part);
    const pas = candidats.length / nb;
    const retires = new Set(Array.from({ length: nb }, (_x, k) => candidats[Math.floor(k * pas)]));
    return mots.filter((_x, i) => !retires.has(i));
  };
  const q18De = async (part: number) => {
    const m = monter("A");
    const v = await porteUniqueIV(m.entree, outils(m, { transcrire: retirer(part) }).o);
    return v.versions[0].lignes.find((l) => l.code === "Q18")!;
  };
  it("garde-fou : plancher 90 %, seuil de remarque 97 %", () => {
    expect(SEUILS_ECOUTE_IV.retrouvesPlancher).toBe(0.9);
    expect(SEUILS_ECOUTE_IV.retrouvesMin).toBe(0.97);
  });
  it("environ 95,8 % des mots entendus : remarque orange sur la ligne Q18 (non bloquante), pas un refus", async () => {
    const q18 = await q18De(0.042);
    const pct = Number(/(\d+[.,]\d) %/.exec(q18.phrase)![1].replace(",", "."));
    expect(pct).toBeGreaterThan(90);
    expect(pct).toBeLessThan(97);
    expect(q18.etat).toBe("echoue");
    expect(q18.bloquant).toBe(false);
    expect(bloque(q18)).toBe(false);
    expect(q18.phrase).toMatch(/des mots du script entendus dans l'ordre/);
  });
  it("environ 80 % des mots entendus (sous le plancher) : remarque orange, plus un refus (règle du 25/10/2026)", async () => {
    const q18 = await q18De(0.2);
    expect(Number(/(\d+[.,]\d) %/.exec(q18.phrase)![1].replace(",", "."))).toBeLessThan(90);
    expect(q18.etat).toBe("echoue");
    expect(q18.bloquant).toBe(false);
    expect(bloque(q18)).toBe(false);
    expect(q18.phrase).toMatch(/90 % au moins/);
  });

  // Voix absente ou quasi absente (moins de 50 % des mots entendus) : blocage voulu, la vidéo est refusée.
  /** Ne garde que `part` des mots (les chiffres et le dernier mot restent), pour une voix quasi absente. */
  const garder = (part: number) => (_d: unknown, mots: { mot: string; debutSec: number; finSec: number }[]) => {
    const libres = mots.map((_x, i) => i).filter((i) => i < mots.length - 1 && chiffresDuTexte(mots[i].mot).length === 0);
    const retires = new Set(libres.filter((_i, k) => k >= Math.round(libres.length * part)));
    return mots.filter((_x, i) => !retires.has(i));
  };
  const porteAvec = async (transcrire: (d: unknown, mots: { mot: string; debutSec: number; finSec: number }[]) => { mot: string; debutSec: number; finSec: number }[]) => {
    const m = monter("A");
    return porteUniqueIV(m.entree, outils(m, { transcrire: transcrire as never }).o);
  };
  it("transcription vide : Q18 bloque, la vidéo est refusée", async () => {
    const v = await porteAvec(() => []);
    const q18 = v.versions[0].lignes.find((l) => l.code === "Q18")!;
    expect(q18.etat).toBe("echoue");
    expect(bloque(q18)).toBe(true);
    expect(v.ok).toBe(false);
  });
  it("30 % des mots entendus : Q18 bloque, la vidéo est refusée", async () => {
    const v = await porteAvec(garder(0.3));
    const q18 = v.versions[0].lignes.find((l) => l.code === "Q18")!;
    expect(bloque(q18)).toBe(true);
    expect(v.ok).toBe(false);
  });
  it("80 % des mots entendus : la vidéo sort prête avec une remarque sur Q18", async () => {
    const v = await porteAvec(retirer(0.2));
    const q18 = v.versions[0].lignes.find((l) => l.code === "Q18")!;
    expect(q18.etat).toBe("echoue");
    expect(bloque(q18)).toBe(false);
    expect(v.ok).toBe(true);
  });
});

describe("relecture des images finales (Q26) par l'extraction existante", () => {
  // 25/10/2026 (règle de Will : jamais d'arrêt pour un défaut de détail) : un « manque » isolé n'est plus un refus mais une remarque orange.
  it("une relecture « manque : 20 % » (une image sur plusieurs) est une remarque orange, pas un refus", async () => {
    const m = monter("C");
    const { o } = outils(m, { relecture: (r) => ({ ...r, images: r.images.map((x, i) => (i === 1 ? { ...x, toutMontre: false, manque: "20 %" } : x)) }) });
    const v = await porteUniqueIV(m.entree, o);
    expect(v.ok).toBe(true);
    const q26 = v.versions[0].lignes.find((l) => l.code === "Q26")!;
    expect(q26.bloquant).toBe(false);
    expect(q26.etat).toBe("echoue");
    expect(q26.phrase).toMatch(/il manque : 20 %/);
    expect(v.mentions.join()).toMatch(/il manque : 20 %/);
  });

  it("une relecture « faux : 30 % au lieu de 20 % » est refusée", async () => {
    const m = monter("C");
    const { o } = outils(m, { relecture: (r) => ({ ...r, images: r.images.map((x, i) => (i === 1 ? { ...x, faux: "30 % au lieu de 20 %" } : x)) }) });
    const v = await porteUniqueIV(m.entree, o);
    expect(v.ok).toBe(false);
    const q26 = v.versions[0].lignes.find((l) => l.code === "Q26")!;
    expect(q26.bloquant).toBe(true);
    expect(q26.etat).toBe("echoue");
    expect(q26.phrase).toMatch(/faux : 30 % au lieu de 20 %/);
  });

  it("une relecture « illisible : texte coupé par le bord » est une remarque : la vidéo continue", async () => {
    const m = monter("C");
    const { o } = outils(m, { relecture: (r) => ({ ...r, images: r.images.map((x, i) => (i === 1 ? { ...x, illisible: "texte coupé par le bord" } : x)) }) });
    const v = await porteUniqueIV(m.entree, o);
    expect(v.ok).toBe(true);
    const q26 = v.versions[0].lignes.find((l) => l.code === "Q26")!;
    expect(q26.bloquant).toBe(false);
    expect(q26.phrase).toMatch(/illisible : texte coupé par le bord/);
  });

  it("une seule image « entièrement noire » (transition) : remarque, la vidéo continue", async () => {
    const m = monter("C");
    const { o } = outils(m, { relecture: (r) => ({ ...r, images: r.images.map((x, i) => (i === 1 ? { ...x, illisible: "image entièrement noire" } : x)) }) });
    const v = await porteUniqueIV(m.entree, o);
    const q26 = v.versions[0].lignes.find((l) => l.code === "Q26")!;
    expect(q26.bloquant).toBe(false);
  });

  it("une relecture « illisible : image entièrement noire » sur toutes les images est refusée", async () => {
    const m = monter("C");
    const { o } = outils(m, { relecture: (r) => ({ ...r, images: r.images.map((x) => ({ ...x, illisible: "image entièrement noire" })) }) });
    const v = await porteUniqueIV(m.entree, o);
    expect(v.ok).toBe(false);
    const q26 = v.versions[0].lignes.find((l) => l.code === "Q26")!;
    expect(q26.bloquant).toBe(true);
    expect(q26.phrase).toMatch(/illisible : image entièrement noire/);
  });

  it("« hors charte » et suggestions restent indicatifs", async () => {
    const m = monter("A");
    const { o } = outils(m, { relecture: (r) => ({ ...r, images: r.images.map((x, i) => (i === 0 ? { ...x, horsCharte: "orange un peu clair", suggestion: "rapprocher le logo" } : x)) }) });
    const v = await porteUniqueIV(m.entree, o);
    expect(v.ok).toBe(true);
    expect(v.mentions.join()).toMatch(/hors charte/);
  });

  it("extraction ratée ou incomplète = remarque « images finales non relues » (refus seulement si le rendu est suspect)", async () => {
    const m = monter("A");
    const { o } = outils(m, { extraction: () => [] });
    const v = await porteUniqueIV(m.entree, o);
    expect(v.ok).toBe(true);
    expect(v.versions[0].lignes.find((l) => l.code === "Q26")!.bloquant).toBe(false);
    expect(v.mentions.join()).toMatch(/images finales non relues/);
    // Aucune image lue ET rendu suspect (mesure hors seuil sur le fichier final) : la vidéo n'est pas livrée.
    const ms = monter("A");
    ms.entree.versions[0].fichier.mesures = { ...ms.entree.versions[0].fichier.mesures, noirMaxSec: 0.8 };
    const vs = await porteUniqueIV(ms.entree, outils(ms, { extraction: () => [] }).o);
    expect(vs.ok).toBe(false);
    expect(vs.versions[0].lignes.find((l) => l.code === "Q26")!.phrase).toMatch(/rendu est suspect/);
    // Un volume, une crête ou une image figée sous son plancher (5 s) n'est PAS un rendu suspect : la vidéo continue avec la remarque.
    for (const mesure of [{ lufs: -17 }, { creteVraieDbtp: 0.5 }, { figeMaxSec: 3 }]) {
      const mv = monter("A");
      mv.entree.versions[0].fichier.mesures = { ...mv.entree.versions[0].fichier.mesures, ...mesure };
      const vv = await porteUniqueIV(mv.entree, outils(mv, { extraction: () => [] }).o);
      expect(vv.ok, JSON.stringify(mesure)).toBe(true);
      expect(vv.mentions.join()).toMatch(/images finales non relues/);
    }
    // 25/10/2026 : UNE image de contrôle manquante n'est plus un refus mais une remarque (la vidéo continue).
    const m1 = monter("A");
    const { o: o1 } = outils(m1, { extraction: (d) => d.parametres.instants.slice(1).map((i) => ({ nom: i.nom, cle: d.parametres.cles[i.nom] })) });
    const v1 = await porteUniqueIV(m1.entree, o1);
    expect(v1.versions[0].lignes.find((l) => l.code === "Q26")!.bloquant).toBe(false);
    expect(v1.mentions.join()).toMatch(/n'a pas été extraite \(détail, la vidéo continue\)/);
    const m2 = monter("A");
    const { o: o2 } = outils(m2);
    const v2 = await porteUniqueIV(m2.entree, { ...o2, extraireImages: async () => { throw new Error("serveur de rendu indisponible"); } });
    expect(v2.ok).toBe(true);
    expect(v2.versions[0].lignes.find((l) => l.code === "Q26")!.phrase).toMatch(/images finales non relues.*extraites/);
  });

  it("demande identique à l'opération existante `controle` / `etape: \"images\"` (largeur 540) ; 24 images au plus", () => {
    const m = monter("C");
    const ver = m.entree.versions[0];
    const instants = instantsClesIV(ver.ligne, m.entree.carte);
    expect(instants.length).toBeGreaterThan(3);
    expect(instants.length).toBeLessThanOrEqual(IMAGES_CLES_MAX);
    expect(instants.some((i) => i.sorte === "fin")).toBe(true);
    for (const n of m.entree.carte.noeuds.filter((x) => !x.photoPersonnes)) if (instants.length < IMAGES_CLES_MAX) expect(instants.some((i) => i.ref === n.id), n.id).toBe(true);
    const d = demandeImagesControleIV("v", ver.version, ver.fichier.cle, instants);
    expect(d.operation).toBe("controle");
    expect(d.parametres.etape).toBe("images");
    expect(d.parametres.largeur).toBe(540);
    expect(Object.keys(d.parametres.cles)).toEqual(instants.map((i) => i.nom));
    // Rien de la clé de stockage ne part vers Claude.
    expect(roleRelectureFinale.consigne).not.toMatch(/final\//);
  });

  it("refus de réservation Claude : aucun appel, remarque « images finales non relues », la vidéo continue", async () => {
    const m = monter("A");
    const { o, j } = outils(m, { reserver: (d) => (d.fournisseur === "claude" ? { ok: false, message: "plafond atteint" } : { ok: true }) });
    const v = await porteUniqueIV(m.entree, o);
    expect(j.appels).toEqual([]);
    expect(v.ok).toBe(true);
    const q26 = v.versions[0].lignes.find((l) => l.code === "Q26")!;
    expect(q26.bloquant).toBe(false);
    expect(q26.phrase).toMatch(/images finales non relues.*dépense/);
  });
});

/** Ajoute la version courte de TikTok (dernier chapitre détachable retiré, même voix simulée). */
function avecVersionCourte(m: Montage): VersionAControlerIV {
  const fiche = m.entree.fiche;
  const courte = ficheSansChapitres(fiche, 1);
  const gardes = new Set(courte.ecrans.map((e) => e.id));
  const refsGardees = new Set(courte.ecrans.flatMap((e) => e.refs));
  const noeudsRetires = [...new Set(fiche.ecrans.filter((e) => !gardes.has(e.id)).flatMap((e) => e.refs))].filter((r) => !refsGardees.has(r) && m.entree.carte.noeuds.some((n) => n.id === r)).sort();
  const retires = fiche.chapitres.filter((c) => !courte.chapitres.some((k) => k.titre === c.titre)).map((c) => c.titre);
  const fin = m.plan.fins.find((f) => f.reseaux.includes("youtube-shorts"))!;
  const v = versionDe(m.entree.carte, courte, fin, m.sons, { courte: true, retires, noeudsRetires });
  m.entree.versions = [...m.entree.versions, v];
  return v;
}

describe("porte : toutes les versions, aucune donnée manquante sautée", () => {
  it("versions courtes comprises : la version courte passe, puis un défaut sur elle SEULE refuse la vidéo", async () => {
    const m = monter("faux-16-noeuds");
    const courte = avecVersionCourte(m);
    expect(courte.retires!.length).toBe(1);
    const { o, j } = outils(m);
    const v = await porteUniqueIV(m.entree, o);
    expect(blocages(v)).toEqual([]);
    expect(v.versions.some((x) => x.courte)).toBe(true);
    expect(j.extractions.some((d) => d.source === courte.fichier.cle)).toBe(true);

    // Cadence fausse : une remarque (la vidéo continue) ; mesure absente (rendu impossible à juger) : refus.
    courte.fichier.mesures = { ...courte.fichier.mesures, fps: 30 };
    const v1 = await porteUniqueIV(m.entree, outils(m).o);
    expect(v1.ok).toBe(true);
    expect(v1.mentions.join()).toMatch(/YouTube Shorts.*30 images par seconde/);
    const { fps: _fps, ...sansFps } = courte.fichier.mesures!;
    courte.fichier.mesures = sansFps;
    const v2 = await porteUniqueIV(m.entree, outils(m).o);
    expect(v2.ok).toBe(false);
    expect(v2.phrases.join()).toMatch(/YouTube Shorts \(version courte\).*la cadence/);
  });

  it("une version courte qui retire un chapitre essentiel : remarque Q11 bis, la vidéo sort", async () => {
    const m = monter("faux-16-noeuds");
    const courte = avecVersionCourte(m);
    courte.retires = [m.entree.fiche.chapitres.find((c) => c.essentiel)!.titre];
    const v = await porteUniqueIV(m.entree, outils(m).o);
    const q11bis = v.versions.find((x) => x.courte)!.lignes.find((l) => l.code === "Q11bis")!;
    expect(q11bis.phrase).toMatch(/essentiel/);
    expect(q11bis.etat).toBe("echoue");
    expect(bloque(q11bis)).toBe(false);
    expect(v.mentions.join()).toMatch(/essentiel/);
  });

  it("le verdict lit toutes les versions : un défaut sur la seule version Facebook refuse la vidéo", async () => {
    const m = monter("A");
    const fb = m.entree.versions.find((x) => x.reseaux.includes("facebook"))!;
    // Hauteur non mesurée (rendu impossible à juger) : refus. Une hauteur fausse, elle, n'est qu'une remarque (25/10/2026).
    const mesures = fb.fichier.mesures!;
    fb.fichier.mesures = { ...mesures, hauteur: 1000 };
    const faux = await porteUniqueIV(m.entree, outils(m).o);
    expect(faux.ok).toBe(true);
    expect(faux.mentions.join()).toMatch(/Facebook.*hauteur de 1000 px/);
    const { hauteur: _h, ...sansHauteur } = mesures;
    fb.fichier.mesures = sansHauteur;
    const { o } = outils(m);
    const v = await porteUniqueIV(m.entree, o);
    expect(v.ok).toBe(false);
    expect(v.versions.find((x) => x.version === fb.version)!.ok).toBe(false);
    expect(v.versions.filter((x) => x.version !== fb.version).every((x) => x.ok || x.lignes.filter(bloque).every((l) => l.etat === "non-fait"))).toBe(true);
    expect(v.phrases.join()).toMatch(/Facebook.*hauteur/);
  });

  it("un volume hors de −14 LUFS ± 1 n'est qu'une remarque orange : la vidéo reste prête", async () => {
    const m = monter("A");
    const fb = m.entree.versions.find((x) => x.reseaux.includes("facebook"))!;
    fb.fichier.mesures = { ...fb.fichier.mesures, lufs: -20 };
    const v = await porteUniqueIV(m.entree, outils(m).o);
    const q24 = v.versions.find((x) => x.version === fb.version)!.lignes.find((l) => l.code === "Q24")!;
    expect(q24.etat).toBe("echoue");
    expect(bloque(q24)).toBe(false);
    expect(v.mentions.join()).toMatch(/volume/);
  });

  it("Q24 · planchers bloquants : noir de 10 s ou volume à −40 LUFS refusés, noir de 1 s seulement une remarque", async () => {
    const q24De = async (mesures: Record<string, number>) => {
      const m = monter("A");
      m.entree.versions[0].fichier.mesures = { ...m.entree.versions[0].fichier.mesures, ...mesures };
      return (await porteUniqueIV(m.entree, outils(m).o)).versions[0].lignes.find((l) => l.code === "Q24")!;
    };
    const noir = await q24De({ noirMaxSec: 10 });
    expect(noir.etat).not.toBe("reussi");
    expect(bloque(noir)).toBe(true);
    const muet = await q24De({ lufs: -40 });
    expect(muet.etat).not.toBe("reussi");
    expect(bloque(muet)).toBe(true);
    const court = await q24De({ noirMaxSec: 1 });
    expect(court.etat).toBe("echoue");
    expect(bloque(court)).toBe(false);
  }, 60_000);

  it("Q11 · corps trop long : remarque ; plafond du réseau dépassé : remarque aussi", async () => {
    const m = monter("A");
    const p = m.entree.versions[0].piste;
    p.mots = p.mots.map((x, i) => (i === p.motsCorps - 1 ? { ...x, finSec: 500 } : x));
    const q11 = (await porteUniqueIV(m.entree, outils(m).o)).versions[0].lignes.find((l) => l.code === "Q11")!;
    expect(q11.etat).toBe("echoue");
    expect(q11.phrase).toMatch(/la voix dépasse/);
    expect(bloque(q11)).toBe(false);
    const m2 = monter("A");
    const fb = m2.entree.versions.find((x) => x.reseaux.includes("facebook"))!;
    fb.ligne = { ...fb.ligne, dureeSec: 400 };
    const q11b = (await porteUniqueIV(m2.entree, outils(m2).o)).versions.find((x) => x.version === fb.version)!.lignes.find((l) => l.code === "Q11")!;
    expect(q11b.etat).toBe("echoue");
    expect(bloque(q11b)).toBe(false);
  }, 60_000);

  it("réseau sans fin (plan.sansFin) et version sans fin : remarques, la vidéo sort", async () => {
    const m = monter("A");
    const fb = m.entree.versions.find((x) => x.reseaux.includes("facebook"))!;
    const v = await porteUniqueIV({ ...m.entree, plan: { ...m.entree.plan, sansFin: [{ reseaux: ["facebook"], raison: "aucune fin pour Facebook : le gabarit manque." }] } }, outils(m).o);
    expect(v.ok).toBe(true);
    expect(v.generaux).toEqual([]);
    expect(v.mentions.join()).toMatch(/Facebook : aucune fin pour Facebook/);
    const m2 = monter("A");
    const fb2 = m2.entree.versions.find((x) => x.reseaux.includes("facebook"))!;
    (fb2 as { fin: unknown }).fin = null;
    const v2 = await porteUniqueIV(m2.entree, outils(m2).o);
    const q08bis = v2.versions.find((x) => x.version === fb2.version)!.lignes.find((l) => l.code === "Q08bis")!;
    expect(q08bis.etat).toBe("echoue");
    expect(q08bis.phrase).toMatch(/aucune fin pour/);
    expect(bloque(q08bis)).toBe(false);
    expect(fb.version).toBe(fb2.version);
  }, 60_000);

  it("une mesure absente du fichier final échoue (non vérifiée), jamais réussie", async () => {
    const m = monter("A");
    m.entree.versions[0].fichier.mesures = { lufs: -14 };
    const { o, j } = outils(m);
    const v = await porteUniqueIV(m.entree, o);
    const q24 = v.versions[0].lignes.find((l) => l.code === "Q24")!;
    expect(q24.etat).toBe("non-fait");
    expect(bloque(q24)).toBe(true);
    expect(v.ok).toBe(false);
    // Déjà refusée sans dépense : rien n'est payé.
    expect(j.reservations).toEqual([]);
  });

  it("Q24 : la hauteur attendue est celle de la ligne (4:5 → 1350 px), plus 1920 en dur", async () => {
    const q24De = async (hauteur: number) => {
      const m = monter("C", ["linkedin"]);
      const v0 = m.entree.versions[0];
      v0.scene = { ...v0.scene, format: "4:5" };
      v0.ligne = mettreEnSceneIV(v0.scene).ligne;
      v0.fichier.mesures = { ...v0.fichier.mesures, hauteur };
      const v = await porteUniqueIV(m.entree, outils(m).o);
      return v.versions[0].lignes.find((l) => l.code === "Q24")!;
    };
    expect((await q24De(1350)).etat).toBe("reussi");
    const ko = await q24De(1920);
    expect(ko.etat).not.toBe("reussi");
    expect(ko.phrase).toMatch(/hauteur de 1920 px \(1350\)/);
  }, 60_000);

  it("Q24 · image figée (décision de Will du 17/10) : 2,5 s acceptées sous la voix, 0,5 s hors voix ; sans mesure « hors voix », 0,5 s partout", async () => {
    const q24De = async (mesures: Record<string, number>) => {
      const m = monter("A");
      m.entree.versions[0].fichier.mesures = { ...m.entree.versions[0].fichier.mesures, ...mesures };
      return (await porteUniqueIV(m.entree, outils(m).o)).versions[0].lignes.find((l) => l.code === "Q24")!;
    };
    // Écran tenu 1,6 s pendant une phrase (la voix ne se tait jamais plus de 0,3 s) : accepté.
    expect((await q24De({ figeMaxSec: 1.6, figeHorsVoixMaxSec: 0.3 })).etat).toBe("reussi");
    expect((await q24De({ figeMaxSec: 2.5, figeHorsVoixMaxSec: 0.5 })).etat).toBe("reussi");
    // Plus de 2,5 s, même sous la voix : remarque (sous le plancher de 5 s), la vidéo reste utilisable.
    const long = await q24De({ figeMaxSec: 2.6, figeHorsVoixMaxSec: 0.2 });
    expect(long.etat).not.toBe("reussi");
    expect(bloque(long)).toBe(false);
    expect(long.phrase).toMatch(/image figée de 2,6 s \(2,5 s au plus/);
    // Figé 0,8 s dans un silence (ou à la fin) : remarque.
    const silence = await q24De({ figeMaxSec: 0.8, figeHorsVoixMaxSec: 0.8 });
    expect(silence.etat).not.toBe("reussi");
    expect(bloque(silence)).toBe(false);
    // Figé plus de 5 s : planchers franchis, refusé.
    expect(bloque(await q24De({ figeMaxSec: 6, figeHorsVoixMaxSec: 0.2 }))).toBe(true);
    expect(silence.phrase).toMatch(/sans voix \(0,5 s au plus hors voix\)/);
    // Mesure « hors voix » absente : la limite d'avant (0,5 s) tient partout.
    expect((await q24De({ figeMaxSec: 1.6 })).etat).not.toBe("reussi");
    expect((await q24De({ figeMaxSec: 0.4 })).etat).toBe("reussi");
  }, 60_000);

  it("mise en page MESURÉE par le moteur à chaque instant clé (module partagé avec le rendu) : C conforme, écran vide en remarque (la vidéo continue)", async () => {
    const c = monter("C");
    const vc = await porteUniqueIV(c.entree, outils(c).o);
    expect(vc.versions.map((x) => x.reseaux).flat().sort()).toEqual([...RESEAUX_IV].sort());
    for (const x of vc.versions) {
      expect(x.instants.length).toBeGreaterThan(0);
      // Image C (essai prévu) : TOUTES les lignes L13 réussies sur les 5 réseaux, Q21 comprise (mesurée, plus « non vérifiée »).
      expect(x.lignes.filter((l) => l.etat !== "reussi").map((l) => `${l.code} ${l.phrase}`)).toEqual([]);
    }
    // Un bloc « bénéfices » sans carte (écran vide) à un instant clé — le défaut réel relevé sur l'image B — est une remarque (25/10/2026).
    const sabote = monter("C");
    const ver = sabote.entree.versions[0];
    const instants = instantsClesIV(ver.ligne, sabote.entree.carte).map((i) => i.instantSec);
    const cible = ver.ligne.blocs.find((x) => x.sorte === "moments" && instants.some((t) => t >= x.debut && t < x.fin))!;
    if (cible.sorte === "moments") cible.moments = cible.moments.map((m) => ({ debut: m.debut, fin: m.fin, fond: m.fond, sorte: "benefices", benefices: [], heures: [], microObjets: [], heuresLignes: [] }));
    const { o, j } = outils(sabote);
    const va = await porteUniqueIV(sabote.entree, o);
    expect(va.ok).toBe(true);
    const q21 = va.versions[0].lignes.find((l) => l.code === "Q21")!;
    expect(q21.etat).toBe("echoue");
    expect(q21.bloquant).toBe(false);
    expect(q21.phrase).toMatch(/Remplissage vertical de 0 %/);
    expect(va.mentions.join()).toMatch(/Remplissage vertical de 0 %/);
    expect(j.reservations.length).toBeGreaterThan(0);
  });

  it("une ligne de temps rendue qui n'est pas celle contrôlée est une remarque (SCENE), la vidéo continue", async () => {
    const m = monter("A");
    const ver = m.entree.versions[0];
    ver.ligne = { ...ver.ligne, plans: ver.ligne.plans.slice(1) };
    const { o } = outils(m);
    const v = await porteUniqueIV(m.entree, o);
    expect(v.ok).toBe(true);
    const scene = v.versions[0].lignes.find((l) => l.code === "SCENE")!;
    expect(scene.bloquant).toBe(false);
    expect(scene.phrase).toMatch(/n'est pas celle/);
  });

  it("un réseau demandé sans version est refusé ; LinkedIn dit la fin comme les autres (26/10/2026)", async () => {
    const m = monter("A");
    const li = m.entree.versions.find((x) => x.reseaux.includes("linkedin"))!;
    expect(li.fin).not.toBeNull();
    expect(li.fin!.muet).toBe(false);
    expect(li.piste.mots.length).toBeGreaterThan(li.piste.motsCorps);
    const { o } = outils(m);
    const v = await porteUniqueIV({ ...m.entree, versions: m.entree.versions.filter((x) => x !== li) }, o);
    expect(v.ok).toBe(false);
    expect(v.generaux.join()).toMatch(/LinkedIn : aucune version/);
  });

  it("une version LinkedIn sans fin ni voix après la phrase-choc (vidéo faite avant le 26/10) reste acceptée par Q08 bis ; si elle sert aussi un autre réseau, elle est refusée", async () => {
    const m = monter("A", ["linkedin"]);
    const ancienne = (reseaux: ReseauIV[]) => versionDe(m.entree.carte, m.entree.fiche, { id: "fin-linkedin", reseaux, muet: true, appels: [] }, m.sons);
    const q08 = async (version: ReturnType<typeof versionDe>) => {
      const { o } = outils({ ...m, entree: { ...m.entree, versions: [version] } });
      const r = await porteUniqueIV({ ...m.entree, versions: [version] }, o);
      return r.versions[0].lignes.filter((l) => l.code === "Q08bis");
    };
    expect((await q08(ancienne(["linkedin"]))).filter(bloque)).toEqual([]);
    const partagee = ancienne(["linkedin", "facebook"]);
    const refus = (await q08(partagee)).filter(bloque);
    expect(refus.map((l) => l.code)).toContain("Q08bis");
  });

  it("une version Facebook ou LinkedIn sans fin est refusée (la fin du réseau manque)", async () => {
    const m = monter("A", ["facebook"]);
    const sansFin = versionDe(m.entree.carte, m.entree.fiche, { id: "fin-facebook", reseaux: ["facebook"], muet: true, appels: [] }, m.sons);
    const { o } = outils({ ...m, entree: { ...m.entree, versions: [sansFin] } });
    const r = await porteUniqueIV({ ...m.entree, versions: [sansFin] }, o);
    expect(r.versions[0].lignes.filter(bloque).map((l) => l.code)).toContain("Q08bis");
  });

  it("aucune version : refus clair", async () => {
    const m = monter("A");
    const v = await porteUniqueIV({ ...m.entree, versions: [] }, outils(m).o);
    expect(v.ok).toBe(false);
    expect(v.phrase).toMatch(/refusée/);
  });

  it("un mot interdit entendu dans la voix est refusé (Q08)", async () => {
    const m = monter("A");
    const { o } = outils(m, { transcrire: (_d, mots) => mots.map((x, i) => (i === 3 ? { ...x, mot: "machine" } : x)) });
    const v = await porteUniqueIV(m.entree, o);
    expect(v.ok).toBe(false);
    expect(v.versions[0].lignes.find((l) => l.code === "Q08")!.phrase).toMatch(/machine/);
  });
});

describe("défauts de détail (Q12 à Q15, Q19 à Q23, Q25, Q27, SCENE) : remarque orange, jamais un refus après le rendu payé", () => {
  const ligne = (code: string, etat: "reussi" | "echoue" | "non-fait") => ({ code, etat, bloquant: !CONTROLES_INDICATIFS.has(code as never) });
  const INDICATIVES = ["Q12", "Q13", "Q14", "Q15", "Q19", "Q20", "Q21", "Q22", "Q23", "Q25", "Q27", "SCENE", "FOND", "ORANGE", "FIN"];
  it.each(INDICATIVES)("%s échoué ou non fait ne bloque pas", (c) => {
    expect(bloque(ligne(c, "echoue"))).toBe(false);
    expect(bloque(ligne(c, "non-fait"))).toBe(false);
  });
  it.each(["CHIFFRES", "Q16", "Q17", "Q24", "Q26"])("%s reste bloquant", (c) => {
    expect(bloque(ligne(c, "echoue"))).toBe(true);
  });
  it("une version avec des défauts de détail est ok ; avec un chiffre faux (CHIFFRES) elle est refusée", () => {
    const verdict = (lignes: ReturnType<typeof ligne>[]) => !lignes.some(bloque);
    expect(verdict([ligne("Q12", "echoue"), ligne("Q13", "echoue"), ligne("Q21", "echoue")])).toBe(true);
    expect(verdict([ligne("Q12", "reussi"), ligne("CHIFFRES", "echoue")])).toBe(false);
  });
  // Limite : ces tests vérifient la règle (`CONTROLES_INDICATIFS` + `bloque`) ; les cas de bout en bout sont dans les tests de la porte ci-dessus.
});
