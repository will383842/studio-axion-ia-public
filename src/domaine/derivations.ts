/**
 * Dérivations PURES du modèle (utilisées par les services et par les données de démonstration).
 * Importable côté client.
 */
import type {
  BlocScript,
  ElementBibliotheque,
  EtatLicence,
  Licence,
  MentionIA,
  MotHorodate,
  Plan,
  SegmentSousTitres,
} from "./types";
import { intentionsAutomatiques } from "./illustrations";

export function texteScript(blocs: BlocScript[]): string {
  return blocs.flatMap((b) => b.segments.map((s) => s.texte)).join(" ");
}

export function compterMots(texte: string): number {
  return texte.trim().split(/\s+/).filter(Boolean).length;
}

/** Plans dérivés des segments du script annoté (AV2.3-7), répartis sur la durée cible. */
export function plansDepuisScript(params: {
  videoId: string;
  versionId: string;
  blocs: BlocScript[];
  dureeSec: number;
  modeIllustrations: "auto" | "manuel" | "aucune";
  personnageId?: string;
  maintenant: string;
  estDemo?: boolean;
  /** Format à encadré d'ouverture (avocat) : le titre n'est plus un grand titre en haut (B.0 §14). */
  encadreOuverture?: { centrePct: number };
  /** Le style de montage impose les coupes franches (avocat : `sm-avocat-v1.transitions = coupe`). */
  coupesSeulement?: boolean;
}): Plan[] {
  const segments = params.blocs.flatMap((b) => b.segments);
  const poids = segments.map((s) => Math.max(1, compterMots(s.texte)));
  const total = poids.reduce((a, b) => a + b, 0) || 1;
  // Correcteur réel 2 (04/10) : un texte COLLÉ n'a aucune intention écrite ; en mode « auto », ~1 segment sur 3 qui
  // nomme un objet concret reçoit une intention tirée de ses propres mots (la cascade cherche ensuite son image).
  const auto = params.modeIllustrations === "auto" ? intentionsAutomatiques(params.blocs) : new Map<string, string>();
  let t = 0;
  return segments.map((s, i) => {
    const duree = (poids[i] / total) * params.dureeSec;
    const debutSec = +t.toFixed(2);
    t += duree;
    const intention = s.intentionIllustration || auto.get(s.id);
    const avecIllustration = params.modeIllustrations !== "aucune" && !!intention;
    return {
      id: `${params.versionId}-plan-${i + 1}`,
      videoId: params.videoId,
      versionId: params.versionId,
      ordre: i + 1,
      debutSec,
      finSec: +t.toFixed(2),
      texte: s.texte,
      segmentId: s.id,
      personnageId: params.personnageId,
      angle: s.angle,
      sourceImage: avecIllustration ? "illustration" : "double",
      illustration: avecIllustration
        ? { source: "bibliotheque", requete: intention, verrouille: false, candidats: [] }
        : undefined,
      texteEcran: s.titreEcran
        ? params.encadreOuverture
          ? { texte: s.titreEcran, position: "centre", style: "encadre", positionPct: params.encadreOuverture.centrePct }
          : { texte: s.titreEcran, position: "haut", style: "grand-titre" }
        : undefined,
      motsEnValeur: s.emphase ?? [],
      incrustation: s.incrustation,
      cadrage: { pointInteret: { x: 0.5, y: 0.38 }, zoom: s.zoom === "fort" ? 1.25 : s.zoom === "leger" ? 1.1 : 1 },
      transition: i === 0 || params.coupesSeulement ? "coupe" : s.zoom ? "glissement" : "coupe",
      creeLe: params.maintenant,
      modifieLe: params.maintenant,
      estDemo: params.estDemo,
    };
  });
}

/**
 * Découpe un texte en mots pour les sous-titres : la ponctuation isolée (« ? », « ! », « : », « » »…) reste
 * collée au mot précédent (espace insécable), le « « » au mot suivant. Une réplique ne commence jamais par « ? ».
 */
export function motsSousTitres(texte: string): string[] {
  const mots: string[] = [];
  let ouvrant = "";
  for (const j of texte.split(/\s+/).filter(Boolean)) {
    if (/^[?!:;»…,.]+$/.test(j) && mots.length) mots[mots.length - 1] += `\u00a0${j}`;
    else if (j === "«") ouvrant += "«\u00a0";
    else {
      mots.push(ouvrant + j);
      ouvrant = "";
    }
  }
  if (ouvrant && mots.length) mots[mots.length - 1] += ouvrant.trimEnd();
  return mots;
}

/** Sous-titres mot à mot à partir des plans (alignement simulé). */
export function sousTitresDepuisPlans(plans: Plan[], motsParLigne = 4): SegmentSousTitres[] {
  const segments: SegmentSousTitres[] = [];
  for (const p of plans) {
    const mots = motsSousTitres(p.texte);
    const pas = (p.finSec - p.debutSec) / Math.max(mots.length, 1);
    for (let i = 0; i < mots.length; i += motsParLigne) {
      const groupe = mots.slice(i, i + motsParLigne).map((mot, j) => {
        const k = i + j;
        return {
          mot,
          debutSec: +(p.debutSec + k * pas).toFixed(2),
          finSec: +(p.debutSec + (k + 1) * pas).toFixed(2),
          enValeur: p.motsEnValeur.some((m) => mot.toLowerCase().includes(m.toLowerCase())),
        };
      });
      segments.push({ id: `${p.id}-st-${i}`, debutSec: groupe[0].debutSec, finSec: groupe[groupe.length - 1].finSec, mots: groupe });
    }
  }
  return segments;
}

/** Export .srt des sous-titres. */
export function versSrt(segments: SegmentSousTitres[]): string {
  const ts = (s: number) => {
    const ms = Math.round(s * 1000);
    const h = Math.floor(ms / 3600000);
    const m = Math.floor((ms % 3600000) / 60000);
    const sec = Math.floor((ms % 60000) / 1000);
    const r = ms % 1000;
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")},${String(r).padStart(3, "0")}`;
  };
  return segments.map((s, i) => `${i + 1}\n${ts(s.debutSec)} --> ${ts(s.finSec)}\n${s.mots.map((m) => m.mot).join(" ")}\n`).join("\n");
}

/** Export .vtt des sous-titres. */
export function versVtt(segments: SegmentSousTitres[]): string {
  return "WEBVTT\n\n" + versSrt(segments).replace(/(\d{2}:\d{2}:\d{2}),(\d{3})/g, "$1.$2").replace(/^\d+\n/gm, "");
}

/** État d'une licence (AV2.3-12) : pastille sur les cartes, blocage ambre dans le kit. */
export function etatLicence(licence: Licence, maintenant: Date = new Date()): EtatLicence {
  if (licence.type === "a-verifier") return "a-verifier";
  if (licence.expireLe && new Date(licence.expireLe) < maintenant) return "expiree";
  return "ok";
}

/** Crédits à ajouter à la légende pour les éléments utilisés. */
export function creditsDepuisElements(elements: ElementBibliotheque[]): string[] {
  return Array.from(new Set(elements.map((e) => e.licence.creditObligatoire).filter((c): c is string => !!c)));
}

/**
 * Mention IA par défaut : FACULTATIVE, COUPÉE par défaut, jamais bloquante, pour tous les formats
 * (décision de Will du 01/10) : elle s'allume d'un geste (Réglages > Mention IA).
 */
export const MENTION_IA_PAR_DEFAUT: MentionIA = {
  incrustee: false,
  position: "haut-gauche",
  dureeSec: 0,
  texte: "Vidéo générée par IA",
  dansLegende: false,
};

/** Ancienne valeur par défaut (imposée) : la migration ne remplace le réglage que s'il n'a jamais été modifié. */
export const MENTION_IA_ANCIEN_DEFAUT: MentionIA = {
  incrustee: true,
  position: "haut-droite",
  dureeSec: 3,
  texte: "Réalisé avec l'IA",
  dansLegende: true,
};

/**
 * Horodatage SIMULÉ des mots d'un texte prononcé, au débit donné (mots/s) : une courte pause après
 * chaque ponctuation forte. Sert à la voix simulée, avec le même contrat que la voix réelle (B.0 §9).
 */
export function horodaterTexte(texte: string, motsParSeconde: number, vitesse = 1): MotHorodate[] {
  const pas = 1 / Math.max(0.1, motsParSeconde * vitesse);
  const mots: MotHorodate[] = [];
  let t = 0;
  for (const mot of texte.split(/\s+/).filter(Boolean)) {
    const debutSec = +t.toFixed(3);
    t += pas;
    mots.push({ mot, debutSec, finSec: +(t - pas * 0.12).toFixed(3) });
    if (/[.?!…]$/.test(mot)) t += 0.18;
    else if (/[,;:]$/.test(mot)) t += 0.08;
  }
  return mots;
}
