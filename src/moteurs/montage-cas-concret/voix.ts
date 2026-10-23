/**
 * VOIX DU CAS CONCRET (tâche M4, plan cas concret § 4-f). La brique `voix-maitre` est appelée plusieurs fois, jamais
 * modifiée : une prise pour le CORPS (jusqu'à la question), puis une prise par FIN (une par suite de réseaux).
 *
 * Ce que le format ajoute :
 *  - ses règles de blancs (`REGLES_BLANCS_CAS_CONCRET`), injectées dans la voix maître ;
 *  - le CONTRÔLE d'une prise (pur), sur les mots et le son BRUTS (avant nettoyage : le nettoyage raccourcit les blancs
 *    et effacerait la traîne) : mots rendus ≠ mots du texte, écart trop long entre deux mots sans ponctuation, blanc
 *    sans ponctuation trop bruyant ;
 *  - la REFORMULATION d'une phrase du corps rejetée (un appel borné, injecté), puis la relecture du corps entier,
 *    `lecturesVoixMax` lectures au plus (3 si le réglage monte à 2 relances) ; une fin rejetée est gardée (relire le même texte rendrait le même son) et le rapport le dit ;
 *  - le PLAN D'ASSEMBLAGE corps + fin (opération `assemblage`, option `tempo`) et l'heure des mots après assemblage.
 *
 * Machine à états SÉRIALISABLE : l'appelant garde l'état rendu après chaque tour ; une voix payée n'est jamais relue
 * (chaque état contient toutes les prises déjà payées). Tout ce qui touche l'extérieur est injecté.
 */
import { createHash } from "node:crypto";
import { jsonCanonique } from "@/briques/fiche-scenes";
import { avancerVoixMaitre, type EtatVoixMaitre, type OutilsVoixMaitre } from "@/briques/voix-maitre/machine";
import type { ReglesNettoyage } from "@/briques/voix-maitre/nettoyage";
import type { MotHorodate, ReglagesVoix } from "@/domaine/types";
import type { FaitCas } from "@/formats/cas-concret/cas";
import { cleMot, motsDe } from "./fiche";
import type { MorceauAssemblage, OutilsVoixCasConcret, PauseAMesurer } from "./outils";

/** Règles de blancs du format (plan § 4-f, fabrication à la main de la vidéo 1). */
export const REGLES_BLANCS_CAS_CONCRET: ReglesNettoyage = { seuilMs: 220, cibleMs: [120, 120], fonduMs: [10, 20], respirationMs: [150, 250], teteMaxMs: 100 };

/** Écart le plus long permis entre la fin d'un mot et le début du suivant, hors ponctuation. */
export const ECART_MAX_MS = 450;
/** Un blanc sans ponctuation plus long que ceci est mesuré (niveau du son). */
export const PAUSE_MESUREE_MS = 300;
/** Niveau le plus fort permis dans un blanc sans ponctuation (au-dessus : souffle, bruit ou mot avalé). */
export const NIVEAU_PAUSE_MAX_DB = -38;
/**
 * 17/10 (v-99d2f6353f41) : un blanc est mesuré à son CŒUR, pas d'une heure de mot à l'autre. HeyGen horodate la fin d'un
 * mot jusqu'à 0,25 s trop tôt (« recrute » donné fini à 0,72 s, entendu jusqu'à 0,92 s) et le début du suivant jusqu'à
 * 0,1 s trop tard : la fenêtre collée aux mots mesurait la fin de « recrute » (−17 dB), prise pour un « euh », et la
 * phrase était refusée à chaque lecture neuve (même horodatage). Les deux marges se partagent la place au-delà d'un cœur
 * de 80 ms au moins (70 % avant, 30 % après) : un vrai « euh » (un son DANS le blanc, détaché des mots) reste mesuré.
 */
export const MARGE_AVANT_MESURE_MS = 250;
export const MARGE_APRES_MESURE_MS = 100;
export const COEUR_MESURE_MIN_MS = 80;
/** Lectures du corps au plus (la première, puis deux relectures ou reformulations). */
export const LECTURES_CORPS_MAX = 3;
/** Lectures d'une fin au plus (la première, puis une lecture neuve si elle hésite). */
export const LECTURES_FIN_MAX = 2;
/** Le corps est coupé à cette distance après son dernier mot (dans le silence de fin), jamais au ras du mot. */
export const COUPE_APRES_DERNIER_MOT_MS = 300;

/** Version des prises (entre dans chaque empreinte : une règle changée refait les prises). */
const VERSION_VOIX = "voix-cas-concret/1";

/* ------------------------------------------------------------------ */
/* Contrôle d'une prise (pur)                                            */
/* ------------------------------------------------------------------ */

export type RejetPrise = "mots" | "traine" | "son";
export type ControlePrise = { ok: true } | { rejet: RejetPrise; phrase: string; detail: string };

/**
 * Un blanc à mesurer, après le mot de rang `apresMot` (rang parmi les mots qui portent une lettre ou un chiffre) ;
 * `mesure` : la fenêtre réellement mesurée (le cœur du blanc, hors de l'erreur de l'horodatage).
 */
export type PauseDeLaPrise = PauseAMesurer & { apresMot: number; mesure: PauseAMesurer };

/** Cœur d'un blanc [deSec, aSec] : sans les marges d'erreur de l'horodatage (voir `MARGE_AVANT_MESURE_MS`). PUR. */
export function coeurDuBlanc(deSec: number, aSec: number): PauseAMesurer {
  const place = Math.max(0, Math.round((aSec - deSec) * 1000) - COEUR_MESURE_MIN_MS);
  const apres = Math.min(MARGE_APRES_MESURE_MS, Math.round(place * 0.3));
  const avant = Math.min(MARGE_AVANT_MESURE_MS, place - apres);
  return { deSec: +(deSec + avant / 1000).toFixed(3), aSec: +(aSec - apres / 1000).toFixed(3) };
}

const PONCTUATION_FINALE = /[.,;:!?…]["»”)\s ]*$/;
const aDesLettres = (m: string) => cleMot(m).length > 0;

interface MotDuTexte {
  mot: string;
  /** Rang de la phrase dans le texte. */
  phrase: number;
  /** Suivi d'une ponctuation (collée, ou seule entre deux espaces : « R.G.P.D. : »). */
  ponctue: boolean;
}

/**
 * Sigle à points (« I.A. », « R.G.P.D. », élidé : « l'I.A. », L0b) : son point final ne ponctue que s'il finit la phrase.
 */
const estSigle = (m: string) => /^(?:\p{L}['’])?(?:\p{L}\.){2,}$/u.test(m);

/**
 * L0b (15/10, analyse A1) : un sigle rendu comme UN seul mot (« l'I.A. » de 14,86 à 15,82 s) peut cacher un blanc à
 * l'intérieur (« li… A ») que les écarts entre mots ne voient pas. Blanc intérieur ESTIMÉ = durée du mot − 150 ms par
 * lettre épelée ; au-delà de 600 ms, c'est une hésitation.
 */
export const BLANC_INTERIEUR_SIGLE_MAX_MS = 600;
const DUREE_LETTRE_SIGLE_MS = 150;

/** Lettres épelées d'un sigle tel qu'écrit ou tel que dit (« l'I.A. », « R.G.P.D. », « IA », « l'i-a ») ; 0 : pas un sigle. */
function lettresDuSigle(m: string): number {
  const sans = m.replace(/[,;:!?…"»”)]+$/u, "").replace(/^\p{L}['’]/u, "");
  if (/^(?:\p{L}\.){2,}$/u.test(sans) || /^(?:\p{L}\.)+\p{L}$/u.test(sans) || /^\p{L}(?:-\p{L})+\.?$/u.test(sans) || /^\p{Lu}{2,6}\.?$/u.test(sans)) return sans.replace(/[^\p{L}]/gu, "").length;
  return 0;
}

/** Phrases du texte : coupées après un point suivi d'une majuscule ou d'un chiffre (« I.A. en commentaire » reste entier). */
function phrasesDe(texte: string): string[] {
  return texte
    .trim()
    .split(/(?<=[.!?…]["»”)]?)\s+(?=[«"“(]?[\p{Lu}\p{N}])/u)
    .filter(Boolean);
}

function motsDuTexte(texte: string): { phrases: string[]; mots: MotDuTexte[] } {
  const phrases = phrasesDe(texte);
  const mots: MotDuTexte[] = [];
  phrases.forEach((p, i) => {
    const bruts = motsDe(p);
    bruts.forEach((brut, k) => {
      const dernier = k === bruts.length - 1;
      if (aDesLettres(brut)) mots.push({ mot: brut, phrase: i, ponctue: PONCTUATION_FINALE.test(brut) && (dernier || !estSigle(brut)) });
      else if (mots.length) mots[mots.length - 1].ponctue = true;
    });
  });
  return { phrases, mots };
}

const ecartMs = (a: MotHorodate, b: MotHorodate) => Math.round((b.debutSec - a.finSec) * 1000);

/**
 * Les blancs sans ponctuation de plus de 300 ms, dans l'ordre (ceux dont `controlerPrise` lit le niveau). La
 * ponctuation vient du texte quand il est donné et que ses mots correspondent, sinon des mots rendus.
 */
export function pausesAMesurer(mots: readonly MotHorodate[], texte?: string): PauseDeLaPrise[] {
  const rendus = mots.filter((m) => aDesLettres(m.mot));
  const duTexte = texte !== undefined ? motsDuTexte(texte).mots : [];
  const ponctue = (i: number) => (duTexte.length === rendus.length ? duTexte[i].ponctue : PONCTUATION_FINALE.test(rendus[i].mot));
  const res: PauseDeLaPrise[] = [];
  for (let i = 0; i + 1 < rendus.length; i++) {
    if (ponctue(i) || ecartMs(rendus[i], rendus[i + 1]) <= PAUSE_MESUREE_MS) continue;
    res.push({ deSec: rendus[i].finSec, aSec: rendus[i + 1].debutSec, apresMot: i, mesure: coeurDuBlanc(rendus[i].finSec, rendus[i + 1].debutSec) });
  }
  return res;
}

/**
 * Contrôle PUR d'une prise : mots rendus ≠ mots du texte (casse, accents, ponctuation ignorés) → « mots » ; écart de plus
 * de 450 ms entre deux mots sans ponctuation → « traine » ; niveau au-dessus de −38 dB dans un blanc sans ponctuation de
 * plus de 300 ms (`niveauxPauses`, dans l'ordre de `pausesAMesurer`) → « son ». Le rejet nomme la phrase fautive.
 */
export function controlerPrise(p: { texte: string; mots: readonly MotHorodate[]; niveauxPauses?: readonly number[] }): ControlePrise {
  const { phrases, mots: attendus } = motsDuTexte(p.texte);
  const rendus = p.mots.filter((m) => aDesLettres(m.mot));
  const phraseDe = (i: number) => phrases[attendus[Math.min(i, attendus.length - 1)]?.phrase ?? 0] ?? p.texte.trim();

  const n = Math.max(attendus.length, rendus.length);
  for (let i = 0; i < n; i++) {
    const a = attendus[i];
    const r = rendus[i];
    if (a && r && cleMot(a.mot) === cleMot(r.mot)) continue;
    const detail = !r ? `le mot « ${a.mot} » n'a pas été dit` : !a ? `le mot « ${r.mot} » est en trop` : `« ${r.mot} » a été dit au lieu de « ${a.mot} »`;
    return { rejet: "mots", phrase: phraseDe(i), detail };
  }

  // Un long blanc hors ponctuation n'est refusé que s'il n'a pas été mesuré : mesuré silencieux, la recette le resserre
  // (0,10 s entre deux mots), exactement comme la voix de la v4 validée par Will ; mesuré bruyant, c'est le refus « son ».
  const pauses = pausesAMesurer(rendus, p.texte);
  const mesure = (i: number) => {
    const k = pauses.findIndex((x) => x.apresMot === i);
    return k < 0 ? undefined : p.niveauxPauses?.[k];
  };
  for (let i = 0; i + 1 < rendus.length; i++) {
    const ecart = ecartMs(rendus[i], rendus[i + 1]);
    if (!attendus[i].ponctue && ecart > ECART_MAX_MS && mesure(i) === undefined) return { rejet: "traine", phrase: phraseDe(i), detail: `blanc de ${ecart} ms après « ${attendus[i].mot} »` };
  }

  // L0b : un sigle coupé en deux à l'intérieur d'un seul mot rendu (« li… A » pour « l'I.A. »).
  for (let i = 0; i < rendus.length; i++) {
    const lettres = lettresDuSigle(attendus[i].mot);
    if (!lettres) continue;
    const blanc = Math.round((rendus[i].finSec - rendus[i].debutSec) * 1000) - DUREE_LETTRE_SIGLE_MS * lettres;
    if (blanc > BLANC_INTERIEUR_SIGLE_MAX_MS) return { rejet: "traine", phrase: phraseDe(i), detail: `blanc d'environ ${blanc} ms à l'intérieur de « ${attendus[i].mot} » (sigle coupé en deux)` };
  }

  for (let k = 0; k < pauses.length; k++) {
    const niveau = p.niveauxPauses?.[k];
    if (niveau !== undefined && niveau > NIVEAU_PAUSE_MAX_DB) {
      const i = pauses[k].apresMot;
      // Essais réels du 14/10 : un « blanc » à −17 dB entre deux mots est une hésitation (« euh ») que Will entend.
      return { rejet: "son", phrase: phraseDe(i), detail: `hésitation ou souffle (${Math.round(niveau)} dB) après « ${attendus[i].mot} »` };
    }
  }
  return { ok: true };
}

/* ------------------------------------------------------------------ */
/* Empreinte d'une prise                                                 */
/* ------------------------------------------------------------------ */

/** Même texte, même voix, mêmes réglages, mêmes règles de blancs → même empreinte (quel que soit l'ordre des clés). */
export function empreintePriseVoix(p: { texte: string; fournisseurVoix?: string; idVoix: string; reglages?: ReglagesVoix; regles: ReglesNettoyage; essai?: number }): string {
  // `essai` (lecture neuve du même texte, à partir de la 2ᵉ) : une autre empreinte. Absent ou 1 : empreinte inchangée.
  const entree = { version: VERSION_VOIX, texte: p.texte, fournisseur: p.fournisseurVoix ?? "", idVoix: p.idVoix, reglages: p.reglages ?? null, regles: p.regles, ...(p.essai && p.essai > 1 ? { essai: p.essai } : {}) };
  return `voix-cc-${createHash("sha256").update(jsonCanonique(entree)).digest("hex").slice(0, 32)}`;
}

/* ------------------------------------------------------------------ */
/* Machine à états des prises                                            */
/* ------------------------------------------------------------------ */

/** Une prise en cours ou faite : l'état de la voix maître, le son brut que lit le contrôle, puis le contrôle. */
export interface PriseVoix {
  texte: string;
  empreinte: string;
  etat: EtatVoixMaitre;
  /** Son BRUT (avant nettoyage), gardé dès qu'il est rangé : c'est lui que le contrôle mesure. */
  brut?: { fichierCle: string; dureeSec: number; mots: MotHorodate[] };
  controle?: ControlePrise;
  /** Lecture neuve du même texte (2ᵉ, 3ᵉ…) : le fournisseur ignore son cache. */
  essai?: number;
}

/** Une lecture payée (journal, traçabilité, coût). */
export interface PrisePayee {
  /** « corps » ou l'identifiant de la fin. */
  prise: string;
  lecture: number;
  empreinte: string;
  caracteres: number;
  coutCentimes: number;
  fournisseur: string;
}

export interface ReformulationCorps {
  /** Lecture rejetée qui a demandé la reformulation. */
  lecture: number;
  avant: string;
  apres: string;
  rejet: RejetPrise;
  detail: string;
}

export interface EtatVoixCasConcret {
  corps: { texte: string; lectures: number; prise?: PriseVoix; retenu?: true; relireTel?: true };
  /** Une prise par fin ; une fin est faite dès que son contrôle est posé (gardée même rejetée). */
  fins: { id: string; texte: string; prise?: PriseVoix; lectures?: number }[];
  payees: PrisePayee[];
  reformulations: ReformulationCorps[];
  issue?: { statut: "faite" } | { statut: "arret"; message: string; phrase?: string; conseil?: string };
}

/** Une lecture sur le point d'être payée (budget vérifié et réservé par l'appelant ; lever l'interdit). */
export interface LectureAPayer {
  prise: string;
  texte: string;
  caracteres: number;
}

export type OutilsAvancerVoix = OutilsVoixCasConcret & {
  /** Faits du cas, donnés à la reformulation (mêmes nombres). */
  faits: readonly FaitCas[];
  /** Texte figé (script validé par Will) : jamais reformulé ; une lecture refusée arrête la voix avec une phrase claire. */
  texteFige?: boolean;
  /**
   * 17/10 (v-99d2f6353f41) : deux refus identiques (même phrase, même raison, même mot) arrêtent la voix SANS payer de
   * lecture de plus, avec une explication et une proposition. Absent : comportement d'avant (image → vidéo).
   */
  arretSiRefusIdentique?: boolean;
  avantLecture?: (lecture: LectureAPayer) => void | Promise<void>;
};

/** Un refus sans ses mesures (niveau en dB, durée en ms) : deux lectures refusées pour la même raison au même mot. */
const signatureRefus = (r: { rejet: RejetPrise; detail: string }) => `${r.rejet}|${r.detail.replace(/[−-]?\d+(?:[.,]\d+)?/g, "#")}`;

/**
 * 17/10 : script VALIDÉ (texte figé) dont la voix hésite (« son » : « euh », souffle) ou traîne, relu sans succès. Le texte ne
 * sera plus réécrit par la machine : le seul correctif est que Will retouche la phrase dans « Relire le script ». Le conseil
 * est aussi donné à part (`conseil`) pour que l'écran puisse l'afficher à son tour.
 */
const CONSEIL_PHRASE_FIGEE =
  "Reformulez la phrase dans « Relire le script » en gardant le mot exact de la promesse du cas (règle R03 : l'accroche doit contenir les mots exacts de la promesse) — par exemple en changeant ce qui entoure le mot — puis lancez la vidéo.";

export function arretPhraseFigee(c: { rejet: RejetPrise; phrase: string; detail: string }, figee: boolean | undefined): { message: string; conseil: string } | undefined {
  if (!figee || (c.rejet !== "son" && c.rejet !== "traine")) return undefined;
  const mot = /« ([^»]+) »/.exec(c.detail)?.[1] ?? c.phrase;
  // La mesure du contrôle (dB ou ms, dans `detail`) reste dans le message.
  const m = /([−-]?\d+(?:[.,]\d+)?) (dB|ms)/.exec(c.detail);
  const mesure = m ? ` (${m[1].replace("−", "-")} ${m[2]})` : "";
  const constat = c.rejet === "son" ? `La voix hésite sur « ${mot} »` : `La voix marque un long blanc ${/à l'intérieur de/.test(c.detail) ? "dans" : "après"} « ${mot} »`;
  return { message: `${constat}${mesure}. ${CONSEIL_PHRASE_FIGEE}`, conseil: CONSEIL_PHRASE_FIGEE };
}

export function etatInitialVoixCasConcret(p: { corps: string; fins: readonly { id: string; texte: string }[] }): EtatVoixCasConcret {
  return { corps: { texte: p.corps, lectures: 0 }, fins: p.fins.map((f) => ({ id: f.id, texte: f.texte })), payees: [], reformulations: [] };
}

/**
 * « Réessayer » après un arrêt de la voix : le contrôle de la dernière prise du corps (déjà payée, son gardé) est REFAIT
 * avec les règles en vigueur, sans nouvelle lecture. Essai réel du 14/10 (v-e99a49ee86cb) : la règle du blanc avait été
 * corrigée, mais la reprise relisait l'arrêt gardé et n'avançait plus. Rien d'autre ne change ; un état non arrêté est
 * rendu tel quel.
 */
export function rouvrirApresArret(etat: EtatVoixCasConcret): EtatVoixCasConcret {
  if (etat.issue?.statut !== "arret" || etat.corps.retenu || etat.corps.prise?.etat.phase !== "faite") return etat;
  const rouvert = structuredClone(etat);
  delete rouvert.issue;
  delete rouvert.corps.prise!.controle;
  return rouvert;
}

/**
 * Départ de la voix quand ses entrées ont changé (X6 : la même vidéo refaite avec l'autre fin). Un corps déjà retenu, de
 * même texte et lu par la même voix (même empreinte de prise), est repris tel quel, comme toute fin inchangée : aucune
 * lecture payée n'est refaite ; seules les fins nouvelles sont lues.
 */
export function repriseVoixCasConcret(precedent: EtatVoixCasConcret | undefined, p: { corps: string; fins: readonly { id: string; texte: string }[] }, empreinteAttendue: (texte: string) => string): EtatVoixCasConcret {
  const neuf = etatInitialVoixCasConcret(p);
  const c = precedent?.corps;
  if (!precedent || !c || c.texte !== p.corps || !c.retenu || !c.prise || c.prise.empreinte !== empreinteAttendue(c.prise.texte)) return neuf;
  const finGardee = (f: { id: string; texte: string }) => precedent.fins.find((x) => x.id === f.id && x.texte === f.texte && x.prise?.controle && x.prise.empreinte === empreinteAttendue(f.texte));
  return {
    ...neuf,
    corps: structuredClone(c),
    reformulations: structuredClone(precedent.reformulations),
    fins: neuf.fins.map((f) => structuredClone(finGardee(f) ?? f)),
  };
}

function nouvellePrise(texte: string, o: OutilsAvancerVoix, essai?: number): PriseVoix {
  const neuve = essai && essai > 1 ? { essai } : {};
  return { texte, empreinte: empreintePriseVoix({ texte, fournisseurVoix: o.fournisseurVoix, idVoix: o.idVoix, reglages: o.reglages, regles: o.regles, ...neuve }), etat: { phase: "a-lire" }, ...neuve };
}

function outilsMaitre(o: OutilsAvancerVoix, prise: PriseVoix, nom: string): OutilsVoixMaitre {
  const court = prise.empreinte.slice("voix-cc-".length, "voix-cc-".length + 12);
  return {
    voix: o.voix,
    stockage: o.stockage,
    aligneur: o.aligneur,
    rendu: o.rendu,
    renduEstSimule: o.renduEstSimule,
    idVoix: o.idVoix,
    ...(o.reglages ? { reglages: o.reglages } : {}),
    ...(o.tauxUsdEur ? { tauxUsdEur: o.tauxUsdEur } : {}),
    ...(o.fournisseurVoix ? { fournisseurVoix: o.fournisseurVoix } : {}),
    caler: o.caler,
    regles: o.regles,
    ...(o.erreurStockage ? { erreurStockage: o.erreurStockage } : {}),
    ...(o.ressemblance ? { ressemblance: o.ressemblance } : {}),
    ...(o.mesureVoix ? { mesureVoix: o.mesureVoix } : {}),
    ...(o.reference ? { reference: o.reference } : {}),
    ...(prise.essai ? { nouvelleLecture: true } : {}),
    cle: (fichier) => o.cle(`${court}-${fichier}`),
    idBase: `cc-voix-${court}`,
    texte: () => prise.texte,
    empreinte: () => prise.empreinte,
    avantLecture: () => o.avantLecture?.({ prise: nom, texte: prise.texte, caracteres: prise.texte.length }),
  };
}

/** Son brut d'un état de la voix maître, une fois rangé (copié, calé) : à partir de l'analyse. */
function brutDe(e: EtatVoixMaitre): PriseVoix["brut"] | undefined {
  if (e.phase !== "a-analyser" && e.phase !== "analyse" && e.phase !== "nettoyage") return undefined;
  return { fichierCle: e.brut.fichierCle, dureeSec: e.brut.dureeSec, mots: e.brut.mots };
}

/**
 * Un tour d'une prise : une phase de la voix maître, puis (son maître fait) la mesure des blancs et le contrôle. La
 * lecture payée est inscrite dans `payees` dans le MÊME état que celui qui la rend.
 */
async function tourDePrise(etat: EtatVoixCasConcret, prise: PriseVoix, nom: string, lecture: number, o: OutilsAvancerVoix): Promise<PriseVoix> {
  if (prise.etat.phase !== "faite") {
    const avant = prise.etat.phase;
    const suivant = await avancerVoixMaitre(prise.etat, outilsMaitre(o, prise, nom));
    // 14/10 : une relecture du contrôle de ressemblance (« a-relire ») est une lecture payée de plus, inscrite à part.
    if ((avant === "a-lire" || avant === "a-relire") && suivant.phase !== avant) {
      const paye = suivant.phase === "faite" ? (suivant.audio.reutilise ? null : suivant.audio) : "brut" in suivant ? suivant.brut : null;
      const empreinte = prise.etat.phase === "a-relire" ? `${prise.empreinte}#lecture-${prise.etat.prises.length + 1}` : prise.empreinte;
      if (paye) etat.payees.push({ prise: nom, lecture, empreinte, caracteres: paye.caracteres, coutCentimes: paye.coutCentimes, fournisseur: paye.fournisseur });
    }
    const brut = prise.brut ?? brutDe(suivant);
    return { ...prise, etat: suivant, ...(brut ? { brut } : {}) };
  }
  const son = prise.brut ?? { fichierCle: prise.etat.audio.fichierCle, dureeSec: prise.etat.audio.dureeSec, mots: prise.etat.audio.mots };
  let controle = controlerPrise({ texte: prise.texte, mots: son.mots });
  // Un long blanc (« traine ») est mesuré avant d'être jugé : silencieux, il est seulement resserré.
  if ("ok" in controle || controle.rejet === "traine") {
    const pauses = pausesAMesurer(son.mots, prise.texte);
    if (pauses.length) {
      const niveauxPauses = await o.mesurerPauses(son.fichierCle, pauses.map((x) => x.mesure));
      controle = controlerPrise({ texte: prise.texte, mots: son.mots, niveauxPauses });
    }
  }
  return { ...prise, controle };
}

/**
 * Un tour de la voix du format. Le corps d'abord : prise, contrôle, puis (rejet) reformulation de la phrase fautive et
 * relecture du corps entier, `LECTURES_CORPS_MAX` lectures au plus ; ensuite une prise par fin, gardée même rejetée.
 * Rend un nouvel état (l'entrée n'est pas modifiée) ; `issue` posée : plus rien ne bouge. Les pannes (voix, rendu,
 * mesure, reformulation) sont levées : l'appelant reprend depuis le dernier état gardé, sans relire une voix payée.
 */
export async function avancerVoixCasConcret(entree: EtatVoixCasConcret, o: OutilsAvancerVoix): Promise<EtatVoixCasConcret> {
  if (entree.issue) return entree;
  const etat: EtatVoixCasConcret = structuredClone(entree);

  // 15/10 (mesure version 2) : une prise faite repartie en re-mesure (`versRemesure`) avance d'abord, sans lecture.
  for (const [nom, p] of [["corps", etat.corps.prise], ...etat.fins.map((f) => [f.id, f.prise] as const)] as const) {
    if (p && (p.etat.phase === "a-remesurer" || p.etat.phase === "remesure")) {
      p.etat = await avancerVoixMaitre(p.etat, outilsMaitre(o, p, nom));
      return etat;
    }
  }

  const corps = etat.corps;
  if (!corps.retenu) {
    if (!corps.prise) {
      corps.lectures += 1;
      corps.prise = nouvellePrise(corps.texte, o, corps.relireTel ? corps.lectures : undefined);
      delete corps.relireTel;
    }
    if (!corps.prise.controle) {
      corps.prise = await tourDePrise(etat, corps.prise, "corps", corps.lectures, o);
      return etat;
    }
    const c = corps.prise.controle;
    if ("ok" in c) {
      corps.retenu = true;
      return etat;
    }
    // 17/10 (v-99d2f6353f41) : le même texte refusé deux fois de la même façon le sera encore ; la lecture suivante n'est
    // pas payée. Le texte (figé ou non) est relu tel quel seulement pour un refus qui n'est pas un mot mal dit.
    const relu = c.rejet !== "mots" || o.texteFige;
    const deja = relu && o.arretSiRefusIdentique ? etat.reformulations.find((r) => r.avant === c.phrase && r.apres === c.phrase && signatureRefus(r) === signatureRefus(c)) : undefined;
    if (deja) {
      const figee = arretPhraseFigee(c, o.texteFige);
      etat.issue = figee
        ? { statut: "arret", phrase: c.phrase, ...figee }
        : {
            statut: "arret",
            phrase: c.phrase,
            message: `La phrase « ${c.phrase} » a été refusée deux fois de la même façon (${c.detail}) : une nouvelle lecture échouerait sans doute pareil, la voix s'arrête sans payer de lecture de plus. Écoutez la dernière lecture : si elle est bonne, signalez-le (le contrôle se trompe) ; sinon, retouchez cette phrase dans « Relire le script » (par exemple une virgule là où la voix marque une pause), puis relancez.`,
          };
      return etat;
    }
    if (corps.lectures >= LECTURES_CORPS_MAX) {
      const figee = arretPhraseFigee(c, o.texteFige);
      etat.issue = figee
        ? { statut: "arret", phrase: c.phrase, ...figee }
        : {
            statut: "arret",
            phrase: c.phrase,
            message: `La voix a lu la phrase « ${c.phrase} » ${LECTURES_CORPS_MAX} fois sans y arriver (${c.detail}). Une nouvelle tentative ne changera rien tant que la phrase reste la même : retouchez-la dans « Relire le script » (par exemple en changeant ce qui entoure le mot), puis lancez la vidéo.`,
          };
      return etat;
    }
    // Une hésitation (« euh », souffle, long blanc) vient de la LECTURE, pas du texte : le même texte est relu, en lecture
    // NEUVE (le fournisseur ignore son cache). Un script validé n'est jamais réécrit : relu aussi, quel que soit le refus.
    if (relu) {
      etat.reformulations.push({ lecture: corps.lectures, avant: c.phrase, apres: c.phrase, rejet: c.rejet, detail: c.detail });
      corps.relireTel = true;
      delete corps.prise;
      return etat;
    }
    const r = await o.reformuler(c.phrase, o.faits);
    if (!r.ok) {
      etat.issue = { statut: "arret", phrase: c.phrase, message: `La phrase « ${c.phrase} » n'a pas pu être reformulée : ${r.raison}` };
      return etat;
    }
    const apres = r.phrase.trim();
    if (!apres || motsDe(apres).length > motsDe(c.phrase).length || !corps.texte.includes(c.phrase)) {
      etat.issue = { statut: "arret", phrase: c.phrase, message: `La phrase « ${c.phrase} » n'a pas pu être reformulée sans l'allonger.` };
      return etat;
    }
    etat.reformulations.push({ lecture: corps.lectures, avant: c.phrase, apres, rejet: c.rejet, detail: c.detail });
    corps.texte = corps.texte.replace(c.phrase, apres);
    delete corps.prise;
    return etat;
  }

  for (const fin of etat.fins) {
    const lectures = fin.lectures ?? 1;
    const c = fin.prise?.controle;
    if (c) {
      // Une fin qui hésite est relue une fois, en lecture neuve ; ensuite elle est gardée (le rapport le dit).
      if ("ok" in c || lectures >= LECTURES_FIN_MAX) continue;
      fin.lectures = lectures + 1;
      fin.prise = nouvellePrise(fin.texte, o, fin.lectures);
      return etat;
    }
    fin.prise = await tourDePrise(etat, fin.prise ?? nouvellePrise(fin.texte, o), fin.id, lectures, o);
    return etat;
  }
  etat.issue = { statut: "faite" };
  return etat;
}

/** Ce que le rapport de la vidéo dit de la voix. */
export function rapportVoix(etat: EtatVoixCasConcret): {
  lecturesCorps: number;
  reformulations: ReformulationCorps[];
  finsGardeesMalgreRejet: { id: string; rejet: RejetPrise; phrase: string; detail: string }[];
  coutCentimes: number;
} {
  return {
    lecturesCorps: etat.corps.lectures,
    reformulations: etat.reformulations,
    finsGardeesMalgreRejet: etat.fins.flatMap((f) => {
      const c = f.prise?.controle;
      return c && "rejet" in c ? [{ id: f.id, rejet: c.rejet, phrase: c.phrase, detail: c.detail }] : [];
    }),
    coutCentimes: etat.payees.reduce((s, p) => s + p.coutCentimes, 0),
  };
}

/* ------------------------------------------------------------------ */
/* Assemblage corps + fin                                                */
/* ------------------------------------------------------------------ */

/** Un son maître vu par l'assemblage. */
export interface SonAssemble {
  fichierCle: string;
  dureeSec: number;
  mots: readonly MotHorodate[];
}

const arrondi = (x: number) => +x.toFixed(4);

function coupeDuCorps(corps: SonAssemble): number {
  const dernier = corps.mots.at(-1);
  if (!dernier) throw new Error("Le corps de la voix n'a aucun mot : l'assemblage est impossible.");
  return arrondi(Math.min(corps.dureeSec, dernier.finSec + COUPE_APRES_DERNIER_MOT_MS / 1000));
}

/** Morceaux de l'assemblage : le corps coupé 300 ms après son dernier mot, puis la fin entière ; le tempo est rendu tel quel. */
export function planAssemblage(corps: SonAssemble, fin: SonAssemble, tempo: number): { morceaux: MorceauAssemblage[]; tempo: number } {
  if (!(tempo > 0)) throw new Error("Le tempo de la voix doit être positif.");
  return {
    morceaux: [
      { entree: corps.fichierCle, deSec: 0, aSec: coupeDuCorps(corps) },
      { entree: fin.fichierCle, deSec: 0, aSec: arrondi(fin.dureeSec) },
    ],
    tempo,
  };
}

/** Heure de chaque mot dans le son assemblé : ceux de la fin décalés de la coupe du corps, puis tous divisés par le tempo. */
export function motsApresAssemblage(corps: SonAssemble, fin: SonAssemble, tempo: number): MotHorodate[] {
  if (!(tempo > 0)) throw new Error("Le tempo de la voix doit être positif.");
  const decalage = coupeDuCorps(corps);
  const place = (m: MotHorodate, d: number): MotHorodate => ({ ...m, debutSec: arrondi((m.debutSec + d) / tempo), finSec: arrondi((m.finSec + d) / tempo) });
  return [...corps.mots.map((m) => place(m, 0)), ...fin.mots.map((m) => place(m, decalage))];
}
