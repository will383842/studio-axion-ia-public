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
import { texteDuCorps } from "@/domaine/image-video/fiche";
import type { ReseauIV } from "@/domaine/image-video/plafonds";
import { versRemesure } from "@/briques/voix-maitre/machine";
import { VOIX_MAITRE_HEYGEN_ID } from "@/briques/voix-maitre/voix-epinglee";
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
import { ecartFinHorsReference, ecartHorsReference, refusFinDeSecoursIV } from "./secours";

/** La seule voix du format : clone HeyGen de Will, réglages de la recette v4 (starfish, 1,1, fr-FR). */
export const VOIX_IV = Object.freeze({ ...RECETTE_VOIX_CAS_CONCRET.synthese, idVoix: VOIX_MAITRE_HEYGEN_ID });

/** Stabilité et émotion de la voix du cas concret (`cas-concret-branchements`) ; la vitesse est toujours celle de `VOIX_IV`. */
const REGLAGES_PAR_DEFAUT: ReglagesVoix = { vitesse: VOIX_IV.vitesse, stabilite: 45, emotion: 30 };

export { LECTURES_CORPS_MAX, LECTURES_FIN_MAX };

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

export interface SegmentsVoixIV {
  corps: string;
  fins: SegmentFinIV[];
  versions: VersionVoixIV[];
}

/**
 * Ce que la voix lit : le corps (écrans de la fiche bout à bout) une fois, et chaque texte de fin DISTINCT une fois.
 * Deux fins du plan au même texte dit (écrans différents) partagent la même lecture.
 */
export function segmentsVoixIV(fiche: Pick<FicheImage, "ecrans">, plan: Pick<PlanDesFinsIV, "fins">): SegmentsVoixIV {
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
    if (!texte) throw new ErreurVoixIV("entree", `La fin pour ${f.reseaux.join(", ")} n'a rien à dire alors qu'elle n'est pas muette.`);
    let s = fins.find((x) => x.texte === texte);
    if (s) s.reseaux.push(...f.reseaux);
    else fins.push((s = { id: f.id, texte, reseaux: [...f.reseaux] }));
    if (f.secours) s.secours = true;
    versions.push({ id: f.id, reseaux: [...f.reseaux], segment: s.id });
  }
  return { corps, fins, versions };
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
export type OutilsVoixIV = Omit<OutilsAvancerVoix, "idVoix" | "fournisseurVoix" | "regles" | "faits" | "texteFige" | "reformuler" | "assembler" | "lireSon" | "avantLecture" | "ressemblance" | "mesureVoix"> & {
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

/** Outils incomplets ou réglage de ressemblance différent de la référence : message de refus, sinon `null`. */
function outilsRefuses(o: OutilsVoixIV): { controle: ControleVoixIV; message: string } | null {
  if (typeof o.avantLecture !== "function") return { controle: "budget", message: "Aucune réservation de dépense n'est branchée : la voix n'est pas lue (aucun appel payant)." };
  if (!Number.isFinite(o.tarifCentimesParCaractere) || o.tarifCentimesParCaractere <= 0) return { controle: "budget", message: "Le tarif de la voix est absent ou nul : la dépense ne peut pas être réservée, la voix n'est pas lue." };
  const r = o.ressemblance;
  if (r && (r.actif !== RESSEMBLANCE_VOIX_PAR_DEFAUT.actif || r.relancesMax !== RESSEMBLANCE_VOIX_PAR_DEFAUT.relancesMax)) {
    return { controle: "Q16", message: r.actif ? "Le contrôle de ressemblance à la voix de référence v4 ne se règle pas pour ce format : il garde ses tolérances de référence." : "Le contrôle de ressemblance à la voix de référence v4 ne se coupe pas pour ce format." };
  }
  return null;
}

export interface EtatVoixIV {
  version: "voix-iv/1";
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
}

/** Outils complets de la voix du cas concret : voix unique, script figé, ressemblance v4 de référence, réservation. */
export function outilsVoixCasConcretIV(o: OutilsVoixIV): OutilsAvancerVoix {
  const refus = outilsRefuses(o);
  const { avantLecture: reserver, tarifCentimesParCaractere: tarif, ...reste } = o;
  return {
    ...reste,
    idVoix: VOIX_IV.idVoix,
    fournisseurVoix: VOIX_IV.fournisseur,
    reglages: { ...(o.reglages ?? REGLAGES_PAR_DEFAUT), vitesse: VOIX_IV.vitesse },
    regles: REGLES_BLANCS_CAS_CONCRET,
    ressemblance: { ...RESSEMBLANCE_VOIX_PAR_DEFAUT },
    // 19/10 : la voix de référence v4 est un extrait de vidéo finie ; le corps est mesuré comme tel. Jamais dans l'empreinte.
    mesureVoix: "video-finie",
    faits: [],
    // Appelée par la voix maître juste avant CHAQUE `voix.lire` (première lecture, lecture neuve, relance).
    avantLecture: async (l) => {
      if (refus) throw new ErreurReservationIV(refus.message);
      try {
        await reserver({ prise: l.prise, texte: l.texte, caracteres: l.caracteres, coutMaxCentimes: coutMaxLectureIV(l.texte, tarif) });
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
  return { version: "voix-iv/1", segments, voix: etatInitialVoixCasConcret({ corps: segments.corps, fins: segments.fins.map((f) => ({ id: f.id, texte: f.texte })) }) };
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

/** Verdict IV d'une voix finie : toute prise encore rejetée, ou hors référence, est un refus (Q16). */
export function verdictVoixFaite(etat: EtatVoixIV): EtatVoixIV["issue"] {
  const v = etat.voix;
  const ecartCorps = horsReference(v.corps.prise);
  if (ecartCorps) return { statut: "refus", controle: "Q16", message: `La voix du corps ne ressemble pas assez à la voix de référence (${ecartCorps}), même après ses relectures. Rien n'est gardé en silence : demandez l'accord de Will avant une nouvelle lecture payante.` };
  for (const f of v.fins) {
    const s = etat.segments.fins.find((x) => x.id === f.id);
    const nom = s ? nomsReseaux(s.reseaux) : f.id;
    const c = f.prise?.controle;
    if (!c) return { statut: "refus", controle: "Q16", message: `La fin pour ${nom} n'a pas été contrôlée.` };
    if ("rejet" in c) return { statut: "refus", controle: "Q16", message: `La fin pour ${nom} hésite encore après ${f.lectures ?? 1} lecture(s) (${c.detail}) : « ${c.phrase} ». Relancez la voix de cette fin avec l'accord de Will.` };
    const ecart = ecartFinHorsReference(f.prise, v.corps.prise);
    if (ecart) return { statut: "refus", controle: "Q16", message: `La voix de la fin pour ${nom} ne ressemble pas assez à la voix de référence (${ecart}).` };
  }
  return { statut: "faite" };
}

/**
 * Un tour de la voix du format. Rend un nouvel état (l'entrée n'est jamais modifiée) ; `issue` posée : plus rien ne
 * bouge. Une panne (voix, rendu, mesure) est levée : l'appelant reprend depuis le dernier état gardé, sans relire.
 */
export async function avancerVoixIV(entree: EtatVoixIV, o: OutilsVoixIV): Promise<EtatVoixIV> {
  if (entree.issue) return entree;
  const refus = outilsRefuses(o);
  if (refus) return { ...entree, issue: { statut: "refus", ...refus } };
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
  if (v.issue.statut === "arret") return { ...entree, issue: { statut: "refus", controle: "Q16", message: v.issue.message } };
  return { ...entree, issue: verdictVoixFaite(entree) };
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

/** Sons bruts d'une voix finie et acceptée : le corps, et un son par segment de fin. */
export function sonsBrutsIV(etat: EtatVoixIV): { corps: SonBrutIV; fins: Record<string, SonBrutIV> } {
  if (etat.issue?.statut !== "faite") throw new ErreurVoixIV("entree", "La voix n'est pas finie ou a été refusée : rien à assembler.");
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
