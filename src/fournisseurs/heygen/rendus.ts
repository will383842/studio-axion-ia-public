/**
 * RENDUS DU DOUBLE HEYGEN (lot R7b ; plan double B.1 « Rendu », B.2 bis). ÉCRITS ET ÉTEINTS.
 *
 * Documentation relue le 03/10/2026 (`reference/create-video`, `reference/get-video`, `transparent-background-videos`) :
 *  - `POST /v3/videos` { type: "avatar", avatar_id (look), audio_url (le son déjà fabriqué : les lèvres suivent CE
 *    son), engine: { type: "avatar_v" }, aspect_ratio: "9:16", fit: "contain", resolution: "1080p", output_format:
 *    "webm" (fond transparent ; tout `background` est alors refusé), motion_prompt?, title?, callback_url?,
 *    callback_id? } + en-tête `Idempotency-Key`. Réponse : { video_id, status, output_format }.
 *    JAMAIS `4k` (« Avatar IV and Avatar V render the avatar at up to 1080p »), JAMAIS `script` + `voice_id` ici
 *    (variante non construite, plan avocat B.1), JAMAIS `background`.
 *  - `GET /v3/videos/{id}` → status pending · processing · completed · failed, video_url (adresse signée), duration,
 *    failure_code, failure_message.
 * Une adresse d'audio expirée ou illisible → erreur `fichier-inaccessible` : le moteur soumet à nouveau avec une
 * adresse neuve et la MÊME clé d'idempotence (rien n'est repayé).
 */
import type { EtatRenduVisage, ErreurFournisseur } from "../types";
import { SANS_FOND_IMPOSSIBLE, type ClientHeygen } from "./client";
import { MOTEUR_AVATAR_V } from "./looks";

/** Avatar V : ≈ 0,0667 $ par seconde rendue (relevé le 03/10/2026) — 7 centimes de dollar, arrondi au-dessus. */
export const CENTIMES_USD_PAR_SECONDE_AVATAR_V = 7;

/**
 * LOT R7e (décision de Will du 03/10, « oui pour le A ») : Will crée son avatar DANS L'APPLICATION HEYGEN ; le studio,
 * à partir d'un texte validé, le fait parler avec sa voix clonée HeyGen (porte-monnaie API, à la seconde). Ce n'est
 * plus une constante : c'est un RÉGLAGE, ÉTEINT par défaut, que Will allume lui-même (Réglages › Connexions › Double,
 * `services/rendu-double.ts`). Il est figé dans chaque commande au lancement (`CommandeFabrication.renduDouble`) et
 * relu par le fournisseur juste avant chaque envoi payant (double garde : l'éteindre arrête tout envoi suivant).
 */
export interface ReglageRenduDouble {
  /** Le studio fait parler l'avatar (payant). Faux par défaut. */
  allume: boolean;
  /** « sans-fond » : webm transparent posé sur nos décors ; « uni » : repli, l'avatar sur un fond uni (pas de décor). */
  fond: "sans-fond" | "uni";
}
export const RENDU_DOUBLE_PAR_DEFAUT: ReglageRenduDouble = { allume: false, fond: "sans-fond" };

/**
 * DÉCORS « LOOK HEYGEN » (payants, `POST /v3/avatars` type prompt). Correcteur réel 2 (F1, décision de Will du 04/10,
 * qui remplace celle du 03/10) : ce n'est plus une interdiction fixe mais la valeur PAR DÉFAUT d'un réglage que Will
 * allume lui-même (Réglages › Connexions › Double, « Créer vos décors avec HeyGen », `services/rendu-double.ts`),
 * séparé du réglage du rendu. Éteint : aucune création, aucun appel. Relu par le fournisseur avant chaque création.
 */
export const LOOKS_HEYGEN_PAR_LE_STUDIO = false;

/** Fond uni du repli (gris anthracite neutre, proche des décors du studio). */
export const FOND_UNI_AVATAR = "#202326";

/** Phrase montrée quand un décor réaliste (look HeyGen, payant) est demandé alors que le rendu est éteint. */
export const DECORS_DANS_HEYGEN = "Les décors réalistes se font dans l'application HeyGen. Le studio ne fabrique rien chez HeyGen.";

export interface DemandeRenduHeygen {
  lookId: string;
  /** Adresse de lecture du son (signée, valable 24 h). */
  audioUrl: string;
  titre: string;
  motionPrompt?: string;
  callbackUrl?: string;
  callbackId?: string;
  cleIdempotence: string;
  /** Repli « fond uni » : mp4 sur une couleur unie (l'avatar n'a pas été créé sans fond). Absent : webm transparent. */
  fondUni?: string;
  /**
   * Correcteur réel 2 (04/10) : le look porte SON décor (fait par Will dans l'application HeyGen) : mp4 AVEC ce fond,
   * sans `background` (il remplacerait le décor) ni webm transparent (il l'effacerait).
   */
  avecSonFond?: boolean;
  /** Correcteur réel 2 (F4) : look filmé dont les gestes servent sur un look généré (`reference_look_id`). */
  referenceLookId?: string;
}

/**
 * Corps de `POST /v3/videos` (PUR, testé) : webm 1080p 9:16 contain, Avatar V, sur le son fourni ; en repli « fond uni »,
 * mp4 sur une couleur (`background` n'est permis que hors webm, d'après la documentation).
 */
export function corpsRendu(d: DemandeRenduHeygen): Record<string, unknown> {
  if (!d.lookId.trim()) throw new Error("LOOK_MANQUANT");
  if (!/^https:\/\//.test(d.audioUrl)) throw new Error("ADRESSE_AUDIO_INVALIDE");
  const corps: Record<string, unknown> = {
    type: "avatar",
    avatar_id: d.lookId,
    audio_url: d.audioUrl,
    engine: { type: MOTEUR_AVATAR_V },
    aspect_ratio: "9:16",
    fit: "contain",
    resolution: "1080p",
    output_format: d.fondUni || d.avecSonFond ? "mp4" : "webm",
    title: d.titre.slice(0, 120),
  };
  if (d.fondUni && !d.avecSonFond) corps.background = { type: "color", value: d.fondUni };
  const consigne = d.motionPrompt?.trim();
  if (consigne) corps.motion_prompt = consigne.slice(0, 1000);
  if (d.callbackUrl && /^https:\/\//.test(d.callbackUrl)) corps.callback_url = d.callbackUrl;
  if (d.callbackId) corps.callback_id = d.callbackId;
  const reference = d.referenceLookId?.trim();
  // ESSAI RÉEL n° 2 (05/10) : HeyGen refuse `reference_look_id` au premier niveau (« Extra inputs are not permitted »,
  // vérifié en réel) ; il se place DANS `engine` (accepté).
  if (reference && reference !== d.lookId) corps.engine = { type: MOTEUR_AVATAR_V, reference_look_id: reference };
  return corps;
}

export interface VideoHeygenBrute {
  id?: string;
  status?: string;
  video_url?: string | null;
  duration?: number | null;
  failure_code?: string | null;
  failure_message?: string | null;
  /** Secondes (ou millisecondes) depuis 1970, ou date ISO selon les réponses. */
  created_at?: number | string | null;
}

/** Pages lues au plus par `retrouver` (100 vidéos chacune) : la recherche reste gratuite et bornée. */
const PAGES_RECHERCHE = 10;
/** Marge sur la date de la décision (horloges du serveur et de HeyGen). */
const MARGE_RECHERCHE_MS = 10 * 60_000;

const instantMs = (x: number | string | null | undefined): number | undefined => {
  if (x === null || x === undefined || x === "") return undefined;
  const n = typeof x === "number" ? x : Number(x);
  const ms = Number.isFinite(n) ? (n < 1e12 ? n * 1000 : n) : Date.parse(String(x));
  return Number.isFinite(ms) ? ms : undefined;
};

/**
 * Documentation (transparent-background-videos) : « Transparent output requires an avatar trained with matting […] the
 * default for recently-created avatars, so most Digital Twins […] qualify » ; sinon la demande webm est REFUSÉE :
 * « This video avatar does not support webm output. The avatar must be trained with matting enabled. »
 */
export { SANS_FOND_IMPOSSIBLE };
export const MESSAGE_SANS_FOND_IMPOSSIBLE = "Votre avatar n'a pas été créé sans fond dans HeyGen. Choisissez « fond uni » dans Réglages, Connexions, Double, ou refaites l'avatar dans HeyGen.";

/** Échec d'un rendu traduit en erreur typée (messages pour Will). */
export function erreurRendu(v: Pick<VideoHeygenBrute, "failure_code" | "failure_message">): ErreurFournisseur {
  const code = `${v.failure_code ?? ""} ${v.failure_message ?? ""}`;
  // Vérif A2 (10/10) : les causes précises d'abord. Avant, « Access denied: consent… » ou « look not found » passaient
  // pour un son illisible (réessayable : rendu renvoyé jusqu'à 3 fois avec une clé neuve, pour rien).
  if (/insufficient|credit|balance|quota|payment/i.test(code)) return { code: "quota", reessayable: false, message: "Les crédits HeyGen sont épuisés : rechargez le porte-monnaie HeyGen, la vidéo reprendra." };
  if (/moderat|policy|consent/i.test(code)) return { code: "refuse", reessayable: false, message: "HeyGen a refusé ce rendu (accord ou contrôle de contenu). Vérifiez votre accord HeyGen." };
  if (SANS_FOND_IMPOSSIBLE.test(code)) return { code: "refuse", reessayable: false, message: MESSAGE_SANS_FOND_IMPOSSIBLE };
  if (/(avatar|look|talking[_\s]*photo)\w*[\s_:-]*(?:\w+[\s_:-]+)?not[\s_]*found|(avatar|look)[\s_]*(introuvable|deleted|missing)/i.test(code)) return { code: "refuse", reessayable: false, message: MESSAGE_DOUBLE_INTROUVABLE };
  if (/download|fetch|url|access|expired|not\s*found|unreachable/i.test(code)) return { code: "fichier-inaccessible", reessayable: true, message: "HeyGen n'a pas pu lire le son : une nouvelle adresse lui est donnée." };
  // Vérification E2E n° 1 (agent g, parcours E) : le texte brut de HeyGen (anglais, technique) ne va jamais dans la
  // phrase pour Will : seulement en console serveur (`etatRendu`) et en détail technique.
  const detail = [v.failure_code, v.failure_message].filter(Boolean).join(" : ").slice(0, 300);
  return { code: "inconnu", reessayable: false, message: MESSAGE_RENDU_ECHOUE, ...(detail ? { detailTechnique: detail } : {}) };
}

/** Phrase pour Will quand le double (ou sa tenue) n'existe plus chez HeyGen. */
export const MESSAGE_DOUBLE_INTROUVABLE = "HeyGen ne trouve plus votre double ou cette tenue. Vérifiez-les dans Réglages, Connexions, Double.";

/** Phrase pour Will quand HeyGen refuse un rendu pour une raison inconnue (le texte de HeyGen reste en console). */
export const MESSAGE_RENDU_ECHOUE = "HeyGen n'a pas réussi ce rendu. Réessayez ; si cela recommence, vérifiez votre double dans HeyGen.";

/** État studio d'un rendu HeyGen. */
export function etatRendu(v: VideoHeygenBrute): EtatRenduVisage {
  switch (v.status) {
    case "completed":
      return v.video_url ? { statut: "termine" } : { statut: "en_cours", progression: 99 };
    case "failed":
      // Le code et le texte bruts de HeyGen : console serveur seulement (jamais à l'écran, ni cloche, ni Journal).
      console.warn(`[heygen] rendu refusé : ${String(v.failure_code ?? "").slice(0, 60)} ${String(v.failure_message ?? "").slice(0, 200)}`);
      return { statut: "echec", erreur: erreurRendu(v) };
    case "processing":
      return { statut: "en_cours", progression: 50 };
    default:
      return { statut: "en_cours", progression: 5 };
  }
}

export function creerRendusHeygen(client: ClientHeygen) {
  return {
    /** `POST /v3/videos` — PAYANT (à la seconde rendue). */
    async creer(d: DemandeRenduHeygen): Promise<{ videoId: string }> {
      const r = await client.requete<{ video_id?: string }>("POST", "/v3/videos", corpsRendu(d), { "Idempotency-Key": d.cleIdempotence });
      if (!r?.video_id) throw new Error("REPONSE_RENDU_INATTENDUE");
      return { videoId: r.video_id };
    },
    /**
     * `GET /v3/videos?title=…` — gratuit (lot R7e, reprise après panne). Le titre de chaque rendu porte sa clé
     * d'idempotence : le titre EXACT est comparé (le filtre de HeyGen peut être plus large). Null : aucun.
     * Relecture R7e n° 6 : le filtre `title` n'est pas confirmé par la documentation. S'il est ignoré, la liste est celle
     * des vidéos du compte, les plus récentes d'abord : on suit les pages (`has_more`, `next_token`) jusqu'aux vidéos
     * plus anciennes que la décision d'envoi (`depuis`, moins une marge), au plus `PAGES_RECHERCHE` pages.
     */
    async retrouver(titre: string, options: { depuis?: string } = {}): Promise<{ videoId: string } | null> {
      const borne = options.depuis ? Date.parse(options.depuis) - MARGE_RECHERCHE_MS : undefined;
      let jeton: string | undefined;
      for (let page = 0; page < PAGES_RECHERCHE; page++) {
        const q = new URLSearchParams({ limit: "100", title: titre });
        if (jeton) q.set("token", jeton);
        type Brute = VideoHeygenBrute & { title?: string | null; video_id?: string };
        const r = await client.requeteEntiere<{ data?: Brute[] | { videos?: Brute[] }; has_more?: boolean; next_token?: string | null }>("GET", `/v3/videos?${q}`);
        const liste = Array.isArray(r?.data) ? r.data : (r?.data?.videos ?? []);
        const v = liste.find((x) => (x?.title ?? "").trim() === titre.trim() && x.status !== "failed" && (x.id || x.video_id));
        if (v) return { videoId: (v.id ?? v.video_id)! };
        // Page entièrement plus ancienne que la décision : le rendu cherché ne peut pas être plus loin.
        const dates = liste.map((x) => instantMs(x?.created_at)).filter((x): x is number => x !== undefined);
        if (borne !== undefined && dates.length && Math.min(...dates) < borne) return null;
        if (!r?.has_more || !r.next_token) return null;
        jeton = r.next_token;
      }
      return null;
    },
    /** `GET /v3/videos/{id}` — gratuit. */
    async lire(videoId: string): Promise<VideoHeygenBrute> {
      return client.requete<VideoHeygenBrute>("GET", `/v3/videos/${encodeURIComponent(videoId)}`);
    },
  };
}
export type RendusHeygen = ReturnType<typeof creerRendusHeygen>;
