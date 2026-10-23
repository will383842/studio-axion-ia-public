/**
 * VOIX HEYGEN RÉELLE (lot M0b, plan B.4 et B.0 §9 / §17) — contrat `FournisseurVoix`.
 *
 *  - `listerVoixExistantes` : `GET /v3/voices?type=private`, paginé (`limit` ≤ 100, `token`). HeyGen ne renvoie pas le
 *    type de copie : il est déduit de `available_engines` (une voix qui accepte le moteur `starfish` est une copie
 *    instantanée, acceptée par la synthèse audio seule ; sinon elle est « non utilisable » et ne peut pas être reliée).
 *  - `lire` : `POST /v3/voices/speech` — TOUT le texte en UN appel (≤ 5 000 caractères, l'intonation reste continue),
 *    `locale: fr-FR`, moteur `starfish`, `speed` réglé dans les limites B.4 v3.2 (pas de 0,05, plafond 1,15), AUCUNE
 *    balise `<break>` (les blancs se coupent après coup). `word_timestamps` → `mots`. Le son renvoyé (adresse
 *    temporaire chez HeyGen) est copié AUSSITÔT dans le stockage (R2) quand il est relié ; sinon l'adresse HeyGen est
 *    gardée et la console l'écoute par le relais `/api/voix/ecoute` (aucun domaine HeyGen dans la page).
 *  - Contrat M1 : le moteur envoie un texte DÉJÀ substitué et `prononciations: []`. Une liste non vide (écoute
 *    d'essai) est appliquée ici, une seule fois.
 *  - `copierVoix` : la copie d'une NOUVELLE voix se fait chez HeyGen (enregistrement de Will) ; ici on la relie.
 */
import { substituerPrononciations } from "@/domaine/prononciations";
import type { MotHorodate, TypeClone } from "@/domaine/types";
import { centimes, TAUX_USD_EUR_PAR_DEFAUT, usdVersEur } from "@/lib/montants";
import type { FournisseurVoix, StockageFichiers, VoixExistante } from "../types";
import { ErreurHeygen, extensionDepuisMime, mimeDepuisAdresse, type ClientHeygen } from "./client";

/**
 * Prix relevé sur le portefeuille HeyGen au lot M0b (02/10) : 0,02 $ pour une phrase de 55 caractères, puis 0,08 $ pour
 * 5 phrases (288 caractères), soit ≈ 0,028 centime de dollar par caractère. Arrondi au-dessus.
 */
export const CENTIMES_USD_PAR_CARACTERE_HEYGEN = 0.03;
/** Limites de la synthèse audio seule. */
export const CARACTERES_MAX_HEYGEN = 5000;
export const VITESSE_HEYGEN = { min: 0.8, max: 1.15, pas: 0.05 } as const;

/** Une voix telle que `GET /v3/voices` la renvoie. */
export interface VoixHeygenBrute {
  voice_id: string;
  name?: string;
  language?: string;
  gender?: string;
  type?: string;
  available_engines?: string[];
  default_engine?: string;
  preview_audio_url?: string | null;
  support_pause?: boolean;
  support_locale?: boolean;
}

/** Réponse de `POST /v3/voices/speech`. */
export interface ReponseSpeechHeygen {
  audio_url: string;
  duration: number;
  request_id?: string | null;
  engine?: string;
  word_timestamps?: { word: string; start: number; end: number }[] | null;
}

const LANGUES: Record<string, string> = { french: "fr-FR", français: "fr-FR", english: "en-US", anglais: "en-US", spanish: "es-ES", espagnol: "es-ES" };

/** « French » → « fr-FR » ; un code déjà au bon format est gardé. */
export function langueHeygen(langue: string | undefined): string {
  if (!langue) return "fr-FR";
  if (/^[a-z]{2}-[A-Z]{2}$/.test(langue)) return langue;
  if (/^[a-z]{2}$/i.test(langue)) return { fr: "fr-FR", en: "en-US", es: "es-ES" }[langue.toLowerCase()] ?? langue;
  return LANGUES[langue.toLowerCase()] ?? langue;
}

/** Type de copie déduit des moteurs : `starfish` = copie instantanée (acceptée par la synthèse audio seule). */
export function typeCloneHeygen(moteurs: string[] | undefined): { typeClone: TypeClone; utilisable: boolean } {
  if (moteurs?.includes("starfish")) return { typeClone: "instant", utilisable: true };
  return { typeClone: moteurs?.length ? "pro" : "inconnu", utilisable: false };
}

export function versVoixExistante(v: VoixHeygenBrute): VoixExistante {
  const { typeClone, utilisable } = typeCloneHeygen(v.available_engines);
  return { idExterne: v.voice_id, nom: v.name?.trim() || "Voix sans nom", langue: langueHeygen(v.language), typeClone, utilisable, apercuUrl: v.preview_audio_url || undefined };
}

/** Vitesse envoyée à HeyGen : au pas de 0,05, entre 0,8 et 1,15 (B.4 v3.2 : au-delà la voix s'abîme). */
export function vitesseHeygen(vitesse: number | undefined): number {
  const v = Number.isFinite(vitesse) && vitesse ? vitesse : 1;
  const arrondie = Math.round(v / VITESSE_HEYGEN.pas) * VITESSE_HEYGEN.pas;
  return +Math.min(VITESSE_HEYGEN.max, Math.max(VITESSE_HEYGEN.min, arrondie)).toFixed(2);
}

/** Texte envoyé : sans balise `<break>` ni autre balise, espaces resserrés. */
export function texteHeygen(texte: string): string {
  return texte
    .replace(/<break[^>]*\/?>/gi, " ")
    .replace(/<\/?[a-z][^>]*>/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Horodatage des mots : sans les repères `<start>` / `<end>` ni la ponctuation isolée (« : »). */
export function motsHeygen(horodatage: ReponseSpeechHeygen["word_timestamps"]): MotHorodate[] {
  return (horodatage ?? [])
    .filter((m) => m.word && !/^<.*>$/.test(m.word) && /[\p{L}\p{N}]/u.test(m.word))
    .map((m) => ({ mot: m.word, debutSec: +Number(m.start).toFixed(3), finSec: +Math.max(Number(m.start), Number(m.end)).toFixed(3) }));
}

export interface DependancesVoixHeygen {
  client: ClientHeygen;
  /** Stockage des fichiers (R2 quand il est relié) ; appelé à chaque lecture. */
  stockage: () => StockageFichiers | Promise<StockageFichiers>;
  environnement?: string;
}

export function creerFournisseurVoixHeygen(dep: DependancesVoixHeygen): FournisseurVoix {
  const env = dep.environnement ?? (process.env.NODE_ENV === "production" ? "prod" : "dev");

  /** Copie le son dans le stockage relié ; sans stockage réel, l'adresse HeyGen (temporaire) est gardée. */
  async function copier(adresse: string, idExterne: string, idDemande: string): Promise<string> {
    const s = await dep.stockage();
    if (!s.urlDepotDuree || s.mode === "simulation") return adresse;
    let telecharge: { octets: Uint8Array; mime: string };
    try {
      telecharge = await dep.client.telecharger(adresse);
    } catch (e) {
      if (e instanceof ErreurHeygen) throw e;
      throw new ErreurHeygen({ code: "indisponible", reessayable: true, message: "Le son n'a pas pu être récupéré chez HeyGen : nouvel essai dans un instant." });
    }
    const { octets, mime } = telecharge;
    const type = mime.startsWith("audio/") ? mime : mimeDepuisAdresse(adresse);
    // (le type vient du CONTENU : HeyGen sert du MP3 sous une adresse « .wav »)
    const cle = `studio/${env}/voix/${idExterne.replace(/[^a-zA-Z0-9_-]/g, "")}/${idDemande.replace(/[^a-zA-Z0-9_-]/g, "")}.${extensionDepuisMime(type)}`;
    const depot = await s.urlDepotDuree(cle, 600, type);
    let r: Response;
    try {
      r = await fetch(depot, { method: "PUT", headers: { "content-type": type }, body: octets as unknown as BodyInit, signal: AbortSignal.timeout(60_000) });
    } catch {
      throw new ErreurHeygen({ code: "indisponible", reessayable: true, message: "Le son n'a pas pu être rangé dans le stockage : nouvel essai dans un instant." });
    }
    if (!r.ok) {
      console.warn(`[heygen] dépôt du son refusé par le stockage : réponse ${r.status}`);
      throw new ErreurHeygen({ code: "indisponible", reessayable: r.status >= 500 || r.status === 429, message: "Le stockage a refusé le son : nouvel essai dans un instant." });
    }
    return cle;
  }

  return {
    id: "heygen",
    type: "voix",
    nom: "Voix HeyGen",
    reelPrevu: "HeyGen",
    mode: "reel",
    capacites: {
      asynchrone: false,
      accordExige: true,
      langues: ["fr-FR", "en-US", "es-ES"],
      dureeMaxSec: 300,
      tarif: { unite: "caractere", prixUnitaire: usdVersEur(CENTIMES_USD_PAR_CARACTERE_HEYGEN) },
      tarifUsd: { unite: "caractere", centimesUsd: CENTIMES_USD_PAR_CARACTERE_HEYGEN },
      audioSeul: true,
      horodatageMots: true,
    },

    async copierVoix() {
      throw new ErreurHeygen({ code: "refuse", reessayable: false, message: "Une nouvelle voix se copie dans HeyGen ; reliez-la ensuite ici (« Relier ma voix HeyGen »)." });
    },

    async listerVoixExistantes() {
      const sortie: VoixExistante[] = [];
      let jeton: string | undefined;
      for (let page = 0; page < 20; page++) {
        const parametres = new URLSearchParams({ type: "private", limit: "100", ...(jeton ? { token: jeton } : {}) });
        const r = await dep.client.requeteEntiere<{ data?: VoixHeygenBrute[]; has_more?: boolean; next_token?: string | null }>("GET", `/v3/voices?${parametres}`);
        sortie.push(...(r.data ?? []).filter((v) => v?.voice_id).map(versVoixExistante));
        if (!r.has_more || !r.next_token) break;
        jeton = r.next_token;
      }
      return sortie;
    },

    async lire(demande) {
      if (!demande.idExterne) throw new ErreurHeygen({ code: "refuse", reessayable: false, message: "Aucune voix HeyGen n'est reliée à ce personnage." });
      const texte = texteHeygen(demande.prononciations.length ? substituerPrononciations(demande.texte, demande.prononciations) : demande.texte);
      if (!texte) throw new ErreurHeygen({ code: "refuse", reessayable: false, message: "Il n'y a rien à lire." });
      if (texte.length > CARACTERES_MAX_HEYGEN) throw new ErreurHeygen({ code: "refuse", reessayable: false, message: `Le texte dépasse ${CARACTERES_MAX_HEYGEN.toLocaleString("fr-FR")} caractères : raccourcissez-le.` });
      const r = await dep.client.requete<ReponseSpeechHeygen>("POST", "/v3/voices/speech", {
        text: texte,
        voice_id: demande.idExterne,
        speed: vitesseHeygen(demande.reglages?.vitesse),
        locale: "fr-FR",
        engine: "starfish",
        ...(demande.nouvelleLecture ? { force_regenerate: true } : {}),
      });
      if (!r?.audio_url) throw new ErreurHeygen({ code: "inconnu", reessayable: true, message: "HeyGen n'a pas renvoyé de son." });
      const mots = motsHeygen(r.word_timestamps);
      const idDemande = r.request_id || `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
      const dureeSec = +(Number(r.duration) || mots.at(-1)?.finSec || 0).toFixed(3);
      // Vérif A2 (10/10) : même calcul que l'estimation (taux de la commande, centime SUPÉRIEUR) : une voix payée n'est
      // jamais tracée à 0 €, et le taux réglé par Will vaut aussi pour la dépense réelle.
      const taux = demande.tauxUsdEur && demande.tauxUsdEur > 0 ? demande.tauxUsdEur : TAUX_USD_EUR_PAR_DEFAUT;
      const cout = centimes(Math.ceil(texte.length * CENTIMES_USD_PAR_CARACTERE_HEYGEN * taux - 1e-9));
      // CORRECTEUR 1 — B2 : la voix est PAYÉE. Elle est rendue quoi qu'il arrive à la copie : l'adresse et l'identifiant
      // de la demande sont gardés (copie différée, ou copie ratée : refaite plus tard par `copierSon`, jamais relue).
      const s = await dep.stockage();
      const aCopier = !!s.urlDepotDuree && s.mode !== "simulation";
      if (aCopier && demande.copieDifferee) return { fichierCle: r.audio_url, dureeSec, cout, mots, copieEnAttente: { adresse: r.audio_url, idDemande } };
      try {
        return { fichierCle: await copier(r.audio_url, demande.idExterne, idDemande), dureeSec, cout, mots };
      } catch (e) {
        console.warn(`[heygen] son payé gardé, copie dans le stockage à refaire : ${e instanceof Error ? e.message : String(e)}`);
        return { fichierCle: r.audio_url, dureeSec, cout, mots, copieEnAttente: { adresse: r.audio_url, idDemande } };
      }
    },

    copierSon: (adresse: string, idExterne: string, idDemande: string) => copier(adresse, idExterne, idDemande),
  };
}
