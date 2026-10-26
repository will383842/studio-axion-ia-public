/**
 * IMAGE → VIDÉO · Voix (lot L12, plan 50 § 1 [7], Q16-Q17). Pilote la voix du cas concret SANS la modifier (emprunts).
 *
 * - Voix UNIQUE : le clone HeyGen de Will (`VOIX_IV.idVoix`), moteur starfish, vitesse 1,1 — les valeurs de la recette
 *   v4 (`RECETTE_VOIX_CAS_CONCRET.synthese`, lue seulement). Aucun appelant ne peut choisir une autre voix.
 * - Le CORPS (accroche → phrase-choc) est lu UNE fois ; chaque segment de fin DISTINCT (question de commentaire + fin
 *   de la banque) est lu une fois, quel que soit le nombre de réseaux qui le partagent. LinkedIn est muet : rien à lire.
 * - Le script est validé par Will : jamais réécrit (`texteFige`). Une prise qui hésite (« euh », souffle, mot en trop
 *   ou manquant, long blanc) est relue en lecture NEUVE (cache du fournisseur ignoré) : 3 lectures au plus pour le
 *   corps, 2 par fin. Au-delà, ou si la voix s'écarte encore de la référence v4 : REFUS (Q16), jamais une prise
 *   douteuse gardée en silence (le cas concret, lui, garde une fin rejetée).
 * - Une voix payée n'est jamais relue : l'état est sérialisable, et la reprise garde toute prise déjà payée (y compris
 *   une lecture neuve, dont l'empreinte porte son numéro d'essai).
 * - ARGENT : la réservation `avantLecture` est OBLIGATOIRE (type et exécution). Elle est appelée avec le coût maximal
 *   juste avant CHAQUE lecture HeyGen (corps, fins, lectures neuves, relances de ressemblance) ; un refus empêche
 *   l'appel et rend un refus propre (`budget`), jamais une lecture sans réservation.
 * - Le contrôle de ressemblance est celui de référence (`RESSEMBLANCE_VOIX_PAR_DEFAUT`) : ni coupé, ni assoupli.
 * - 15/10 (v-dd3049053f88, mesure version 2) : une prise payée mesurée par une version antérieure de la mesure est
 *   RE-MESURÉE (studio-rendu, gratuit) avant son verdict, jamais relue chez HeyGen (`remesurerVoixIV`).
 */
import type { MotHorodate, ReglagesVoix } from "@/domaine/types";
import type { FicheImage } from "@/domaine/image-video/fiche";
import { motsDits, texteDuCorps } from "@/domaine/image-video/fiche";
import type { ReseauIV } from "@/domaine/image-video/plafonds";
import { versRemesure } from "@/briques/voix-maitre/machine";
import { VOIX_MAITRE_HEYGEN_ID } from "@/briques/voix-maitre/voix-epinglee";
import { REFERENCE_V4_IV } from "@/domaine/image-video/reference-voix";
import { RESSEMBLANCE_VOIX_PAR_DEFAUT, verdictSurMesureAncienne, type ReglageRessemblanceVoix } from "@/briques/voix-maitre/reference";
import {
  LECTURES_CORPS_MAX,
  LECTURES_FIN_MAX,
  RECETTE_VOIX_CAS_CONCRET,
  REGLES_BLANCS_CAS_CONCRET,
  avancerVoixCasConcret,
  empreintePriseVoix,
  etatInitialVoixCasConcret,
  type EtatVoixCasConcret,
  type OutilsAvancerVoix,
  type PriseVoix,
} from "./emprunts";
import { texteDeFinIV, type PlanDesFinsIV } from "./fins";
import { ecartFinHorsReference, ecartHorsReference, FINS_DE_SECOURS_IV, refusFinDeSecoursIV } from "./secours";

/** La seule voix du format : clone HeyGen de Will, réglages de la recette v4 (starfish, 1,1, fr-FR). */
export const VOIX_IV = Object.freeze({ ...RECETTE_VOIX_CAS_CONCRET.synthese, idVoix: VOIX_MAITRE_HEYGEN_ID });

/** Stabilité et émotion de la voix du cas concret (`cas-concret-branchements`) ; la vitesse est toujours celle de `VOIX_IV`. */
const REGLAGES_PAR_DEFAUT: ReglagesVoix = { vitesse: VOIX_IV.vitesse, stabilite: 45, emotion: 30 };

export { LECTURES_CORPS_MAX, LECTURES_FIN_MAX };

/**
 * 20/10 : LECTURE UNIQUE. HeyGen lit d'un trait le corps, la partie COMMUNE des fins, puis la phrase propre à chaque
 * réseau ; chaque version est ensuite taillée dans ce fichier par heures de mots (comme une version courte). Aucune fin
 * n'est plus lue à part : une lecture séparée de 7 s était jugée avec des tolérances faites pour un long texte, et son
 * « Et » de tête provoquait des pauses. Retour en arrière : mettre `false` (une PR).
 */
export const LECTURE_UNIQUE_IV = true;

/** Marge gardée avant le premier mot retiré en bout de fichier (s) : la coupe tombe dans le blanc qui le précède. */
export const MARGE_COUPE_LECTURE_SEC = 0.05;

/** Contrôle à l'origine d'un refus (plan § 7). `entree` : données incohérentes reçues par l'étape. */
/** `budget` : la réservation de dépense a été refusée avant une lecture payante (aucun appel fait). */
export type ControleVoixIV = "Q11bis" | "Q16" | "Q17" | "Q19" | "coupe" | "musique" | "entree" | "budget";

/** Refus bloquant de la voix ou de l'assemblage, avec une phrase simple pour Will. */
export class ErreurVoixIV extends Error {
  constructor(
    public readonly controle: ControleVoixIV,
    message: string,
  ) {
    super(message);
    this.name = "ErreurVoixIV";
  }
}

/* ------------------------------------------------------------------ */
/* Segments à lire                                                       */
/* ------------------------------------------------------------------ */

/** Un segment de fin à lire : une lecture pour tous les réseaux qui le partagent. */
export interface SegmentFinIV {
  /** Identifiant de la première fin du plan qui le porte. */
  id: string;
  texte: string;
  reseaux: ReseauIV[];
  /** 15/10 : fin de secours (lue une fois : hors référence ou hésitante, refus Q16 sans nouvelle lecture). */
  secours?: true;
}

/** Une version de la vidéo (un fichier) : corps + un segment de fin, ou le corps seul (LinkedIn, muet). */
export interface VersionVoixIV {
  /** Identifiant de la fin du plan (`fin-tiktok-youtube-shorts`, `fin-linkedin`…). */
  id: string;
  reseaux: ReseauIV[];
  /** Segment de fin lu ; `null` : rien n'est dit après la phrase-choc. */
  segment: string | null;
}

/**
 * Lecture unique (20/10) : le `corps` des segments est alors le texte lu en entier. `motsCorps` : mots du script (les
 * premiers du texte lu). `fins` : pour l'identifiant de chaque version qui dit quelque chose après la phrase-choc, les
 * plages [début, fin[ de mots du texte lu qu'elle garde (partie commune, puis sa phrase propre) ; LinkedIn n'y figure pas.
 */
export interface LectureUniqueIV {
  motsCorps: number;
  fins: Record<string, [number, number][]>;
}

export interface SegmentsVoixIV {
  corps: string;
  fins: SegmentFinIV[];
  versions: VersionVoixIV[];
  /** Présent seulement en lecture unique : `fins` est alors vide (rien n'est lu à part). */
  lecture?: LectureUniqueIV;
}

/**
 * Ce que la voix lit : le corps (écrans de la fiche bout à bout) une fois, et chaque texte de fin DISTINCT une fois.
 * Deux fins du plan au même texte dit (écrans différents) partagent la même lecture.
 *
 * `lectureUnique` (20/10) : un seul texte lu (corps, partie commune des fins, phrase propre à chaque fin) ; voir
 * `LECTURE_UNIQUE_IV`. Sans fin à dire (LinkedIn seul), rien ne change.
 */
export function segmentsVoixIV(fiche: Pick<FicheImage, "ecrans">, plan: Pick<PlanDesFinsIV, "fins">, o: { lectureUnique?: boolean } = {}): SegmentsVoixIV {
  const corps = texteDuCorps(fiche).trim();
  if (!corps) throw new ErreurVoixIV("entree", "Le script n'a aucun texte à dire.");
  const fins: SegmentFinIV[] = [];
  const versions: VersionVoixIV[] = [];
  for (const f of plan.fins) {
    if (f.muet) {
      versions.push({ id: f.id, reseaux: [...f.reseaux], segment: null });
      continue;
    }
    const texte = texteDeFinIV(f);
    // Réparation : une fin qui n'a rien à dire est lue comme une fin muette (corps seul) ; la vidéo ne s'arrête pas.
    if (!texte) {
      versions.push({ id: f.id, reseaux: [...f.reseaux], segment: null });
      continue;
    }
    let s = fins.find((x) => x.texte === texte);
    if (s) s.reseaux.push(...f.reseaux);
    else fins.push((s = { id: f.id, texte, reseaux: [...f.reseaux] }));
    if (f.secours) s.secours = true;
    versions.push({ id: f.id, reseaux: [...f.reseaux], segment: s.id });
  }
  if (o.lectureUnique && fins.length) return lectureUniqueDe(fiche, corps, fins, versions);
  return { corps, fins, versions };
}

/** Phrases d'un texte dit (fin de phrase : . ! ? …, avec ou sans guillemet) ; un morceau sans lettre se rattache à la précédente. */
function phrasesDeFin(texte: string): string[] {
  const phrases: string[][] = [];
  let courante: string[] = [];
  for (const jeton of texte.split(/\s+/).filter(Boolean)) {
    courante.push(jeton);
    if (/[.!?…]["»”)]*$/u.test(jeton)) {
      phrases.push(courante);
      courante = [];
    }
  }
  if (courante.length) phrases.push(courante);
  const res: string[][] = [];
  for (const p of phrases) {
    if (!motsDits(p.join(" ")).length && res.length) res[res.length - 1].push(...p);
    else res.push(p);
  }
  return res.map((p) => p.join(" "));
}

/** Ligatures et lettres que la voix ne décompose pas en a-z : réécrites comme elles se disent (même nombre de mots). */
const LETTRES_DITES: Record<string, string> = { œ: "oe", Œ: "Oe", æ: "ae", Æ: "Ae", ß: "ss", ø: "o", Ø: "O", ł: "l", Ł: "L", đ: "d", Đ: "D", þ: "th", Þ: "Th" };
export const lettresLisibles = (t: string) => t.replace(/[œŒæÆßøØłŁđĐþÞ]/gu, (c) => LETTRES_DITES[c] ?? c);

/**
 * Le texte lu d'un trait et la plage de mots que garde chaque version : le corps, la partie COMMUNE des fins (plus long
 * préfixe de phrases que partagent toutes les fins distinctes), puis la phrase propre à chaque fin, dans l'ordre du plan.
 */
function lectureUniqueDe(fiche: Pick<FicheImage, "ecrans">, corps: string, fins: SegmentFinIV[], versions: VersionVoixIV[]): SegmentsVoixIV {
  const phrases = fins.map((f) => phrasesDeFin(f.texte));
  let commun = 0;
  while (phrases.every((p) => p.length > commun && p[commun] === phrases[0][commun])) commun++;
  const nombre = (t: string[]) => motsDits(t.join(" ")).length;
  const motsCorps = fiche.ecrans.reduce((n, e) => n + motsDits(e.texteDit).length, 0);
  const finCommun = motsCorps + nombre(phrases[0].slice(0, commun));
  const parSegment = new Map<string, [number, number][]>();
  let pos = finCommun;
  phrases.forEach((p, i) => {
    const n = nombre(p.slice(commun));
    const plages: [number, number][] = [];
    if (finCommun > motsCorps) plages.push([motsCorps, finCommun]);
    if (n > 0) {
      // Collée à la partie commune (première suite) : une seule plage.
      if (plages.length && plages[plages.length - 1][1] === pos) plages[plages.length - 1][1] = pos + n;
      else plages.push([pos, pos + n]);
    }
    pos += n;
    parSegment.set(fins[i].id, plages);
  });
  const fait: Record<string, [number, number][]> = {};
  for (const v of versions) if (v.segment) fait[v.id] = (parSegment.get(v.segment) ?? []).map(([a, b]) => [a, b]);
  const lu = lettresLisibles([corps, ...phrases[0].slice(0, commun), ...phrases.flatMap((p) => p.slice(commun))].join(" "));
  // Contrôle GRATUIT avant toute lecture payante : la voix (`controlerPrise`) ne compte comme mot que ce qui garde une lettre
  // ou un chiffre de a à z après retrait des accents (`cleMot`) ; nous, toute lettre ou chiffre Unicode (`motsDits`). Si les deux
  // comptes diffèrent (jeton « Ω », « œ » seul…), la vidéo ne pourrait pas être taillée après coup : refus avant de payer.
  const parLaVoix = lu.split(/\s+/).filter((t) => t.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, "").length > 0).length;
  if (parLaVoix !== motsDits(lu).length) throw new ErreurVoixIV("entree", `Le texte à lire d'un trait ne se découpe pas en mots comme la voix les compte (${motsDits(lu).length} mots pour nous, ${parLaVoix} pour la voix) : corrigez le script (un signe ou une lettre isolée) ; rien n'a été lu ni payé.`);
  return { corps: lu, fins: [], versions, lecture: { motsCorps, fins: fait } };
}

/* ------------------------------------------------------------------ */
/* Machine à états                                                       */
/* ------------------------------------------------------------------ */

/** Une lecture HeyGen sur le point d'être payée : l'appelant réserve `coutMaxCentimes` ou lève une erreur (refus). */
export interface ReservationLectureIV {
  /** « corps » ou l'identifiant de la fin. */
  prise: string;
  texte: string;
  caracteres: number;
  /** Coût maximal de CETTE lecture (caractères × tarif, arrondi au centime supérieur). */
  coutMaxCentimes: number;
}

/**
 * Outils fournis par l'appelant (services, ou doubles de simulation) : tout ce qu'attend la voix du cas concret, SAUF
 * la voix, ses réglages et ses règles, posés ici (voix unique), et la reformulation (un script validé n'est jamais
 * réécrit). La réservation de dépense et le tarif sont OBLIGATOIRES : aucune valeur par défaut ne laisse lire.
 */
export type OutilsVoixIV = Omit<OutilsAvancerVoix, "idVoix" | "fournisseurVoix" | "regles" | "faits" | "texteFige" | "reformuler" | "assembler" | "lireSon" | "avantLecture" | "ressemblance" | "mesureVoix" | "reference"> & {
  /** Tarif de la voix (centimes par caractère), strictement positif : sert au coût maximal réservé. */
  tarifCentimesParCaractere: number;
  /** Réservation AVANT chaque lecture payante ; lever une erreur l'interdit (aucun appel HeyGen). */
  avantLecture: (lecture: ReservationLectureIV) => void | Promise<void>;
  /** Accepté seulement s'il est égal au réglage de référence (ni coupé, ni assoupli) ; sinon refus Q16. */
  ressemblance?: ReglageRessemblanceVoix;
};

/** Refus de la réservation : levé avant l'appel HeyGen, rendu en refus propre par `avancerVoixIV`. */
export class ErreurReservationIV extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ErreurReservationIV";
  }
}

/** Coût maximal d'une lecture de `texte` au tarif donné. */
export function coutMaxLectureIV(texte: string, tarifCentimesParCaractere: number): number {
  return Math.ceil(texte.length * tarifCentimesParCaractere - 1e-9);
}

/** Tarif de repli (centimes par caractère) quand celui des outils manque : le prix ne bloque jamais la voix, il ne sert qu'à réserver. */
export const TARIF_VOIX_REPLI_IV = 0.1;

/** Nombre de réparations automatiques de la voix (nouvelle lecture) avant de la garder avec une remarque. */
export const REPARATIONS_VOIX_MAX_IV = 3;

export interface EtatVoixIV {
  /** « voix-iv/2 » : lecture unique (20/10). Un état « voix-iv/1 » garde ses segments séparés, jamais relus. */
  version: "voix-iv/1" | "voix-iv/2";
  segments: SegmentsVoixIV;
  voix: EtatVoixCasConcret;
  issue?: { statut: "faite" } | { statut: "refus"; controle: ControleVoixIV; message: string };
  /**
   * 19/10 (v-6a3b74364711) : textes de fin de secours dont « Refaire cette partie » demande UNE relecture neuve, la seule
   * fin (posé par `reprendreIV`, jamais par la voix). Consommé au tour suivant, avant toute lecture.
   */
  relire?: string[];
  /** 19/10 : textes de fin de secours déjà relus une fois ; jamais une 2ᵉ relecture. */
  relues?: string[];
  /** Réparations automatiques faites (nouvelle lecture d'une prise refusée), au plus `REPARATIONS_VOIX_MAX_IV`. */
  reparations?: number;
  /** Ce qui a été réparé ou gardé tel quel, dit sans arrêter la vidéo (ajouté au journal). */
  remarques?: string[];
}

/** Outils complets de la voix du cas concret : voix unique, script figé, ressemblance v4 de référence, réservation. */
export function outilsVoixCasConcretIV(o: OutilsVoixIV): OutilsAvancerVoix {
  const { avantLecture: reserver, tarifCentimesParCaractere: tarifBrut, ...reste } = o;
  const tarif = Number.isFinite(tarifBrut) && tarifBrut > 0 ? tarifBrut : TARIF_VOIX_REPLI_IV;
  return {
    ...reste,
    idVoix: VOIX_IV.idVoix,
    fournisseurVoix: VOIX_IV.fournisseur,
    reglages: { ...(o.reglages ?? REGLAGES_PAR_DEFAUT), vitesse: VOIX_IV.vitesse },
    regles: REGLES_BLANCS_CAS_CONCRET,
    // Un réglage de ressemblance différent n'arrête pas la voix : celui de référence est toujours appliqué.
    ressemblance: { ...RESSEMBLANCE_VOIX_PAR_DEFAUT },
    // 19/10 : la voix de référence v4 est un extrait de vidéo finie ; le corps est mesuré comme tel. Jamais dans l'empreinte.
    mesureVoix: "video-finie",
    // 20/10 : hauteur de référence = la v4 entière (158,4 Hz), pour Image → vidéo seulement. Jamais dans l'empreinte.
    reference: REFERENCE_V4_IV,
    faits: [],
    // Appelée par la voix maître juste avant CHAQUE `voix.lire` (première lecture, lecture neuve, relance).
    avantLecture: async (l) => {
      try {
        if (typeof reserver === "function") await reserver({ prise: l.prise, texte: l.texte, caracteres: l.caracteres, coutMaxCentimes: coutMaxLectureIV(l.texte, tarif) });
      } catch (err) {
        const raison = err instanceof Error ? err.message : String(err);
        throw new ErreurReservationIV(`La dépense de la voix (${l.prise === "corps" ? "corps" : `fin ${l.prise}`}) n'a pas pu être réservée : ${raison}. Aucune lecture n'a été faite ni payée.`);
      }
    },
    texteFige: true,
    reformuler: async () => ({ ok: false, raison: "un script validé par Will n'est jamais réécrit" }),
    assembler: async () => {
      throw new Error("L'assemblage de la voix du format passe par `assemblage.ts`.");
    },
  };
}

/** Empreinte attendue d'une prise (même calcul que la voix du cas concret, numéro d'essai compris). */
function empreinteAttendue(o: OutilsVoixIV, texte: string, essai?: number): string {
  const c = outilsVoixCasConcretIV(o);
  return empreintePriseVoix({ texte, fournisseurVoix: c.fournisseurVoix, idVoix: c.idVoix, reglages: c.reglages, regles: c.regles, ...(essai && essai > 1 ? { essai } : {}) });
}

export function etatInitialVoixIV(segments: SegmentsVoixIV): EtatVoixIV {
  return { version: segments.lecture ? "voix-iv/2" : "voix-iv/1", segments, voix: etatInitialVoixCasConcret({ corps: segments.corps, fins: segments.fins.map((f) => ({ id: f.id, texte: f.texte })) }) };
}

/** Prise payée et finie (son maître fait, ou en re-mesure gratuite : 15/10). */
const priseFinie = (p: PriseVoix) => p.etat.phase === "faite" || p.etat.phase === "a-remesurer" || p.etat.phase === "remesure";

const priseGardable = (o: OutilsVoixIV, p: PriseVoix | undefined, texte: string): p is PriseVoix =>
  !!p && p.texte === texte && priseFinie(p) && !!p.controle && p.empreinte === empreinteAttendue(o, texte, p.essai);

/**
 * Voix finie dont une prise payée est jugée hors référence sur une mesure d'une version antérieure : la re-mesure
 * (gratuite) peut changer le verdict. PUR.
 */
export function voixARemesurerIV(etat: Pick<EtatVoixIV, "voix"> | undefined): boolean {
  if (!etat) return false;
  return [etat.voix.corps.prise, ...etat.voix.fins.map((f) => f.prise)].some((p) => p?.etat.phase === "faite" && verdictSurMesureAncienne(p.etat.audio));
}

/**
 * 15/10 : voix FINIE (`issue` « faite ») refusée sur une mesure ancienne : chaque prise faite à mesure ancienne repart en
 * re-mesure (`versRemesure`, studio-rendu, gratuit) ; le verdict est recalculé ensuite. Aucune lecture : ni la prise, ni
 * son contrôle, ni `payees` ne changent. `null` : rien à re-mesurer (voix pas finie, arrêtée, ou verdict à jour). PUR.
 */
export function remesurerVoixIV(v: EtatVoixCasConcret): EtatVoixCasConcret | null {
  // Un arrêt (hésitation du corps) n'est pas une affaire de mesure : il reste tel quel.
  if (v.issue?.statut !== "faite" || !voixARemesurerIV({ voix: v })) return null;
  const r = structuredClone(v);
  delete r.issue;
  for (const p of [r.corps.prise, ...r.fins.map((f) => f.prise)]) if (p) p.etat = versRemesure(p.etat);
  return r;
}

/**
 * Départ de la voix quand ses entrées ont pu changer (fin modifiée, réseau ajouté) : un corps retenu de même texte, et
 * chaque fin de même texte déjà faite, sont REPRIS tels quels — y compris une lecture neuve (essai 2 ou 3), que la
 * reprise du cas concret relirait. Seuls les textes nouveaux seront lus.
 */
export function repriseVoixIV(precedent: EtatVoixIV | undefined, segments: SegmentsVoixIV, o: OutilsVoixIV): EtatVoixIV {
  const neuf = etatInitialVoixIV(segments);
  const c = precedent?.voix.corps;
  if (!precedent || !c?.retenu || c.texte !== segments.corps || !priseGardable(o, c.prise, c.texte)) return neuf;
  // Une fin déjà rejetée à sa dernière lecture permise n'est ni reprise telle quelle, ni relue en silence : refus.
  for (const s of segments.fins) {
    const usee = precedent.voix.fins.find((x) => x.texte === s.texte && x.prise?.controle && "rejet" in x.prise.controle && (x.lectures ?? 1) >= LECTURES_FIN_MAX);
    if (!usee) continue;
    const ctl = usee.prise!.controle as Extract<NonNullable<PriseVoix["controle"]>, { rejet: unknown }>;
    return { ...neuf, issue: { statut: "refus", controle: "Q16", message: `La fin pour ${nomsReseaux(s.reseaux)} a été rejetée après ${usee.lectures ?? 1} lectures (${ctl.detail}) : « ${ctl.phrase} ». Elle n'est pas reprise telle quelle ; une nouvelle lecture payante demande l'accord de Will.` } };
  }
  const fins = neuf.voix.fins.map((f) => {
    const avant = precedent.voix.fins.find((x) => x.texte === f.texte && priseGardable(o, x.prise, x.texte));
    return avant ? { ...structuredClone(avant), id: f.id } : f;
  });
  return {
    ...neuf,
    voix: { ...neuf.voix, corps: structuredClone(c), fins, payees: structuredClone(precedent.voix.payees), reformulations: structuredClone(precedent.voix.reformulations) },
    // 19/10 : la relecture demandée et celles déjà faites survivent à un changement de plan.
    ...(precedent.relire?.length ? { relire: [...precedent.relire] } : {}),
    ...(precedent.relues?.length ? { relues: [...precedent.relues] } : {}),
  };
}

const nomsReseaux = (r: readonly ReseauIV[]) => r.join(", ");

/** Prise qui s'écarte encore de la référence v4 après ses relances (rapport de la voix maître). */
const horsReference = ecartHorsReference;

/** Refus Q16 d'une voix finie et la prise fautive (« corps » ou l'identifiant de la fin), sinon `null`. */
function refusVoixFaite(etat: EtatVoixIV): { message: string; cible: string } | null {
  const v = etat.voix;
  const ecartCorps = horsReference(v.corps.prise);
  if (ecartCorps) return { cible: "corps", message: `La voix du corps ne ressemble pas assez à la voix de référence (${ecartCorps}), même après ses relectures.` };
  for (const f of v.fins) {
    const s = etat.segments.fins.find((x) => x.id === f.id);
    const nom = s ? nomsReseaux(s.reseaux) : f.id;
    const c = f.prise?.controle;
    if (!c) return { cible: f.id, message: `La fin pour ${nom} n'a pas été contrôlée.` };
    if ("rejet" in c) return { cible: f.id, message: `La fin pour ${nom} hésite encore après ${f.lectures ?? 1} lecture(s) (${c.detail}) : « ${c.phrase} ».` };
    const ecart = ecartFinHorsReference(f.prise, v.corps.prise);
    if (ecart) return { cible: f.id, message: `La voix de la fin pour ${nom} ne ressemble pas assez à la voix de référence (${ecart}).` };
  }
  return null;
}

/** Verdict IV d'une voix finie : toute prise encore rejetée, ou hors référence, est un refus (Q16). */
export function verdictVoixFaite(etat: EtatVoixIV): EtatVoixIV["issue"] {
  const r = refusVoixFaite(etat);
  return r ? { statut: "refus", controle: "Q16", message: `${r.message} Rien n'est gardé en silence : demandez l'accord de Will avant une nouvelle lecture payante.` } : { statut: "faite" };
}

/** Prise neuve (lecture neuve du même texte) d'une fin : empreinte, clés de mesure et rendu neufs. */
function priseNeuveDeFin(f: EtatVoixCasConcret["fins"][number], o: OutilsVoixIV): void {
  f.lectures = (f.lectures ?? 1) + 1;
  f.prise = { texte: f.texte, empreinte: empreinteAttendue(o, f.texte, f.lectures), etat: { phase: "a-lire" }, essai: f.lectures };
}

/** Le corps est relu au tour suivant, en lecture neuve (numéro d'essai = nombre de lectures). */
function relireLeCorps(v: EtatVoixCasConcret): void {
  delete v.corps.retenu;
  delete v.corps.prise;
  v.corps.relireTel = true;
}

const avecRemarque = (e: EtatVoixIV, texte: string): string[] => [...(e.remarques ?? []), texte];

/**
 * Réparation automatique d'un refus Q16 (hésitation, ressemblance) : la prise fautive est relue en lecture neuve, sans
 * attendre personne, jusqu'à `REPARATIONS_VOIX_MAX_IV` fois pour toute la voix ; ensuite elle est GARDÉE avec une remarque
 * (la voix existe : ce n'est pas une voix absente). Le prix ne l'arrête pas (la réservation reste posée avant chaque lecture).
 */
function reparerRefusQ16(entree: EtatVoixIV, o: OutilsVoixIV, message: string, cible: string): EtatVoixIV {
  const n = entree.reparations ?? 0;
  const voix = structuredClone(entree.voix);
  delete voix.issue;
  if (n >= REPARATIONS_VOIX_MAX_IV) {
    const remarques = avecRemarque(entree, `Voix gardée malgré une remarque après ${n} réparation(s) automatique(s) : ${message}`);
    // Corps arrêté sur sa dernière prise : retenu, les fins suivent. Sinon la voix est finie : gardée telle quelle.
    if (!voix.corps.retenu && voix.corps.prise?.etat.phase === "faite") {
      voix.corps.retenu = true;
      return { ...entree, voix, remarques };
    }
    return { ...entree, issue: { statut: "faite" }, remarques };
  }
  if (cible === "corps") relireLeCorps(voix);
  else {
    const f = voix.fins.find((x) => x.id === cible);
    if (!f) relireLeCorps(voix);
    else priseNeuveDeFin(f, o);
  }
  const { issue: _issue, ...reste } = entree;
  void _issue;
  return { ...reste, voix, reparations: n + 1, remarques: avecRemarque(entree, `Voix relue automatiquement (${n + 1}/${REPARATIONS_VOIX_MAX_IV}) : ${message}`) };
}

/**
 * Réparation d'un refus de l'ASSEMBLAGE (coupe en plein son, parole retirée, mots qui ne collent pas au texte, son
 * manquant) : toute la voix est relue en lecture neuve, au plus `REPARATIONS_VOIX_MAX_IV` fois. Rend `null` quand les
 * réparations sont épuisées (le refus reste alors, la voix existe mais le rendu est impossible). PUR.
 */
export function relireLaVoixIV(etat: EtatVoixIV, o: OutilsVoixIV, raison: string): EtatVoixIV | null {
  const n = etat.reparations ?? 0;
  if (n >= REPARATIONS_VOIX_MAX_IV) return null;
  const voix = structuredClone(etat.voix);
  delete voix.issue;
  relireLeCorps(voix);
  for (const f of voix.fins) priseNeuveDeFin(f, o);
  const { issue: _issue, ...reste } = etat;
  void _issue;
  return { ...reste, voix, reparations: n + 1, remarques: avecRemarque(etat, `Voix relue automatiquement (${n + 1}/${REPARATIONS_VOIX_MAX_IV}) : ${raison}`) };
}

/**
 * Un tour de la voix du format. Rend un nouvel état (l'entrée n'est jamais modifiée) ; `issue` posée : plus rien ne
 * bouge. Une panne (voix, rendu, mesure) est levée : l'appelant reprend depuis le dernier état gardé, sans relire.
 */
export async function avancerVoixIV(entree: EtatVoixIV, o: OutilsVoixIV): Promise<EtatVoixIV> {
  if (entree.issue) return entree;
  // 19/10 : relecture de la seule fin demandée : la prise est préparée et l'état rendu SANS AUCUNE LECTURE (il est gardé
  // avant de payer ; la lecture a lieu au tour suivant, avec sa réservation).
  if (entree.relire?.length) return preparerRelectureIV(entree, o);
  // 15/10 : une fin de secours n'est lue qu'une fois ; refusée, elle n'est jamais relue en silence (ni relance, ni essai 2).
  const secours = refusFinDeSecoursIV(entree);
  if (secours) return { ...entree, issue: { statut: "refus", controle: "Q16", message: secours } };
  const v = remesurerVoixIV(entree.voix) ?? entree.voix;
  if (!v.issue) {
    try {
      const suivant = { ...entree, voix: await avancerVoixCasConcret(v, outilsVoixCasConcretIV(o)) };
      const refus = refusFinDeSecoursIV(suivant);
      return refus ? { ...suivant, issue: { statut: "refus", controle: "Q16", message: refus } } : suivant;
    } catch (err) {
      // Réservation refusée : levée AVANT l'appel HeyGen, rien n'a été payé dans ce tour ; l'état d'entrée reste juste.
      if (err instanceof ErreurReservationIV) return { ...entree, issue: { statut: "refus", controle: "budget", message: err.message } };
      throw err;
    }
  }
  // Arrêt du corps (hésitation relue en vain) : relu en lecture neuve, puis gardé avec une remarque.
  if (v.issue.statut === "arret") return reparerRefusQ16({ ...entree, voix: v }, o, v.issue.message, "corps");
  const refus = refusVoixFaite(entree);
  if (!refus) return { ...entree, issue: { statut: "faite" } };
  // Une fin qui a sa chaîne de secours (Facebook, Instagram, Shorts) se répare par cette chaîne (`pasVoix`), pas ici.
  const segment = entree.segments.fins.find((x) => x.id === refus.cible);
  if (segment?.reseaux.some((r) => FINS_DE_SECOURS_IV[r])) return { ...entree, issue: verdictVoixFaite(entree) };
  return reparerRefusQ16(entree, o, refus.message, refus.cible);
}

/**
 * 19/10 (v-6a3b74364711) : « Refaire cette partie » après le refus d'une fin de secours déjà lue une fois : le même texte
 * est relu UNE fois, en lecture NEUVE (essai ≥ 3 : empreinte, clés de mesure et identifiant de rendu neufs). Le corps, les
 * autres fins et les lectures déjà payées sont gardés. Une fin n'est relue qu'une fois (`relues`), et seule une fin de
 * secours l'est : sa lecture unique est ensuite gardée par `refusFinDeSecoursIV` (pas de relance de ressemblance). PUR.
 */
function preparerRelectureIV(entree: EtatVoixIV, o: OutilsVoixIV): EtatVoixIV {
  const voix = structuredClone(entree.voix);
  delete voix.issue;
  const relues = [...(entree.relues ?? [])];
  for (const texte of entree.relire ?? []) {
    const segment = entree.segments.fins.find((s) => s.texte === texte);
    const f = voix.fins.find((x) => x.texte === texte);
    if (!segment?.secours || !f || relues.includes(texte)) continue;
    const essai = Math.max(f.prise?.essai ?? 1, f.lectures ?? 1, LECTURES_FIN_MAX) + 1;
    f.prise = { texte, empreinte: empreinteAttendue(o, texte, essai), etat: { phase: "a-lire" }, essai };
    relues.push(texte);
  }
  const { relire: _relire, ...reste } = entree;
  void _relire;
  return { ...reste, voix, relues };
}

/** Son BRUT d'une prise retenue (avant nettoyage), celui que l'assemblage coupe : refus clair s'il manque. */
export interface SonBrutIV {
  fichierCle: string;
  dureeSec: number;
  mots: MotHorodate[];
}

function brutDe(p: PriseVoix | undefined, nom: string): SonBrutIV {
  if (!p || p.etat.phase !== "faite") throw new ErreurVoixIV("entree", `La voix ${nom} n'est pas finie.`);
  const b = p.brut ?? { fichierCle: p.etat.audio.fichierCle, dureeSec: p.etat.audio.dureeSec, mots: p.etat.audio.mots };
  if (!b.mots.length) throw new ErreurVoixIV("entree", `La voix ${nom} n'a aucun mot horodaté.`);
  return { fichierCle: b.fichierCle, dureeSec: b.dureeSec, mots: [...b.mots] };
}

/**
 * Lecture unique : le son d'UNE version, taillé dans la lecture d'un trait. `son` : les mots que la version garde (le
 * corps, puis sa fin), `dureeSec` coupée avant le premier mot retiré en bout de fichier ; `retraitsVoulus` : les phrases
 * sautées au milieu (parole retirée EXPRÈS, comme un chapitre de version courte) ; `coupeSec` : l'instant de la coupe en
 * bout de fichier, qui doit tomber dans un silence mesuré (absent : le fichier va jusqu'au bout).
 */
export interface SonLectureIV {
  son: SonBrutIV;
  motsCorps: number;
  retraitsVoulus: [number, number][];
  coupeSec?: number;
  /** Bornes sûres de la coupe : fin du dernier mot gardé, début du premier mot retiré (la coupe se place dans un silence entre les deux). */
  coupeEntreSec?: [number, number];
}

const porteUneLettre = (m: MotHorodate) => /[\p{L}\p{N}]/u.test(m.mot);

/** Sons des versions d'une lecture unique, coupés par heures de mots. REFUS « entree » si les mots ne collent pas au texte lu. */
function sonsDeLecture(etat: EtatVoixIV, lecture: LectureUniqueIV): { corps: SonBrutIV; lecture: Record<string, SonLectureIV> } {
  const brut = brutDe(etat.voix.corps.prise, "lue d'un trait");
  const lettres = brut.mots.filter(porteUneLettre);
  const attendus = motsDits(etat.voix.corps.texte).length;
  if (lettres.length !== attendus) throw new ErreurVoixIV("entree", `Les mots de la voix lue d'un trait (${lettres.length}) ne correspondent pas au texte lu (${attendus}) : la vidéo ne peut pas être taillée.`);
  if (lecture.motsCorps < 1 || lecture.motsCorps > lettres.length) throw new ErreurVoixIV("entree", "Le corps du script n'a aucun mot dans la voix lue d'un trait.");
  const taille = (gardes: number[]): SonLectureIV => {
    const dernier = gardes[gardes.length - 1];
    const suivant = lettres[dernier + 1];
    const retraits: [number, number][] = [];
    gardes.forEach((k, i) => {
      if (i > 0 && k > gardes[i - 1] + 1) retraits.push([lettres[gardes[i - 1] + 1].debutSec, lettres[k - 1].finSec]);
    });
    const coupeSec = suivant ? Math.max(lettres[dernier].finSec, +(suivant.debutSec - MARGE_COUPE_LECTURE_SEC).toFixed(4)) : undefined;
    return {
      son: { fichierCle: brut.fichierCle, dureeSec: coupeSec ?? brut.dureeSec, mots: gardes.map((k) => lettres[k]) },
      motsCorps: lecture.motsCorps,
      retraitsVoulus: retraits,
      ...(coupeSec !== undefined ? { coupeSec, coupeEntreSec: [lettres[dernier].finSec, suivant!.debutSec] as [number, number] } : {}),
    };
  };
  const rang = (de: number, a: number) => Array.from({ length: Math.max(0, a - de) }, (_, i) => de + i);
  const versions: Record<string, SonLectureIV> = {};
  for (const v of etat.segments.versions) versions[v.id] = taille([...rang(0, lecture.motsCorps), ...(lecture.fins[v.id] ?? []).flatMap(([a, b]) => rang(a, Math.min(b, lettres.length)))]);
  return { corps: taille(rang(0, lecture.motsCorps)).son, lecture: versions };
}

/**
 * Sons bruts d'une voix finie et acceptée : le corps, et un son par segment de fin. En lecture unique
 * (`segments.lecture`), `corps` est le corps seul (coupé avant le premier mot de fin), `fins` est vide et `lecture`
 * donne le son de chaque version.
 */
export function sonsBrutsIV(etat: EtatVoixIV): { corps: SonBrutIV; fins: Record<string, SonBrutIV>; lecture?: Record<string, SonLectureIV> } {
  if (etat.issue?.statut !== "faite") throw new ErreurVoixIV("entree", "La voix n'est pas finie ou a été refusée : rien à assembler.");
  if (etat.segments.lecture) return { ...sonsDeLecture(etat, etat.segments.lecture), fins: {} };
  return {
    corps: brutDe(etat.voix.corps.prise, "du corps"),
    fins: Object.fromEntries(etat.voix.fins.map((f) => [f.id, brutDe(f.prise, `de la fin ${f.id}`)])),
  };
}

/** Lectures payées et coût, pour le rapport de la vidéo. */
export function rapportVoixIV(etat: EtatVoixIV): { lecturesCorps: number; lecturesFins: Record<string, number>; payees: number; coutCentimes: number } {
  return {
    lecturesCorps: etat.voix.corps.lectures,
    lecturesFins: Object.fromEntries(etat.voix.fins.map((f) => [f.id, f.prise ? (f.lectures ?? 1) : 0])),
    payees: etat.voix.payees.length,
    coutCentimes: etat.voix.payees.reduce((s, p) => s + p.coutCentimes, 0),
  };
}
