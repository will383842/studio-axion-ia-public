// Lien signé de la page « Recevoir le guide » (fiche Z3a-Studio-1). Module PUR : aucun réseau, aucune base,
// aucune lecture d'environnement autre que l'objet passé en argument. Jamais de valeur par défaut pour un secret.
// `creerJetonLien` est la copie exacte de `creerJeton` du site : le contrat croisé est la fixture
// `tests/zernio/aides/lien-page-guide.v2.json` (SHA-256 identique des deux côtés).
import { createHmac } from "node:crypto";

export const VARIABLE_SECRET_LIEN = "GUIDES_RESEAU_LIEN_SECRET";
export const LONGUEUR_MIN_SECRET_LIEN = 32;
export const VERSION_JETON_LIEN = 1;
/** Le lien est valable 48 h (décision du 11/11/2026). */
export const DUREE_JETON_SECONDES = 48 * 3600;
export const TAILLE_MAX_JETON = 1024;
export const TAILLE_MAX_LIEN = 512;
export const BASE_LIEN_GUIDE = "https://axion-ia.com/guide-reseau?j=";
export const RESEAUX_LIEN = ["facebook", "instagram", "linkedin", "autre"] as const;
export type ReseauLien = (typeof RESEAUX_LIEN)[number];

export interface DonneesLien {
  readonly conv: string;
  readonly mot: string;
  readonly reseau: ReseauLien;
  readonly guide: string;
  readonly compte: string;
  readonly post_ref?: string;
  readonly version_m1: string;
}

/** Secret du lien : `null` si absent, trop court, ou identique à un autre secret du studio. Jamais de repli. */
export function lireSecretLien(env: Record<string, string | undefined>): string | null {
  const secret = (env[VARIABLE_SECRET_LIEN] ?? "").trim();
  if (secret.length < LONGUEUR_MIN_SECRET_LIEN) return null;
  for (const autre of ["SITE_GUIDES_RESEAU_SECRET", "STUDIO_EMPREINTE_SECRET"]) {
    if (secret === (env[autre] ?? "").trim()) return null;
  }
  return secret;
}

/** Référence opaque de conversation : « c1_ » + 22 caractères d'un HMAC-SHA256 à séparation de domaine. */
export function refConversationLien(secretEmpreinte: string, cleIdempotenceGuide: string): string {
  return "c1_" + createHmac("sha256", secretEmpreinte).update(`studio/lien-conv/v1\0${cleIdempotenceGuide}`, "utf8").digest("base64url").slice(0, 22);
}

const OPAQUE = /^[A-Za-z0-9_-]{1,64}$/;
const CHAMPS: Readonly<Record<string, (x: unknown) => boolean>> = {
  v: (x) => x === VERSION_JETON_LIEN,
  conv: (x) => typeof x === "string" && /^[A-Za-z0-9_-]{8,64}$/.test(x),
  mot: (x) => typeof x === "string" && /^[A-Z0-9_-]{1,30}$/.test(x),
  reseau: (x) => typeof x === "string" && (RESEAUX_LIEN as readonly string[]).includes(x),
  guide: (x) => typeof x === "string" && x.length <= 64 && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(x),
  compte: (x) => typeof x === "string" && OPAQUE.test(x),
  post_ref: (x) => typeof x === "string" && OPAQUE.test(x),
  version_m1: (x) => typeof x === "string" && /^[A-Za-z0-9._-]{1,32}$/.test(x),
  exp: (x) => typeof x === "number" && Number.isSafeInteger(x) && x > 0,
};
const OBLIGATOIRES = ["v", "conv", "mot", "reseau", "guide", "compte", "version_m1", "exp"];

function chargeValide(c: Record<string, unknown>): boolean {
  const cles = Object.keys(c);
  return cles.every((k) => Object.hasOwn(CHAMPS, k)) && OBLIGATOIRES.every((k) => cles.includes(k)) && cles.every((k) => CHAMPS[k]!(c[k]));
}

/** Jeton signé valable 48 h : `base64url(JSON compact)` + "." + `base64url(HMAC-SHA256(partie 1))`. Lève si invalide. */
export function creerJetonLien(donnees: DonneesLien, secret: string, nowMs: number): string {
  if (typeof secret !== "string" || secret.length < LONGUEUR_MIN_SECRET_LIEN) throw new Error(`${VARIABLE_SECRET_LIEN} absent ou trop court.`);
  if (!Number.isFinite(nowMs)) throw new Error("Horloge invalide (nowMs non fini).");
  const charge = {
    v: VERSION_JETON_LIEN,
    conv: donnees.conv,
    mot: donnees.mot,
    reseau: donnees.reseau,
    guide: donnees.guide,
    compte: donnees.compte,
    ...(donnees.post_ref === undefined ? {} : { post_ref: donnees.post_ref }),
    version_m1: donnees.version_m1,
    exp: Math.floor(nowMs / 1000) + DUREE_JETON_SECONDES,
  };
  if (!chargeValide(charge)) throw new Error("Données du jeton invalides.");
  const partie = Buffer.from(JSON.stringify(charge), "utf8").toString("base64url");
  const jeton = `${partie}.${createHmac("sha256", secret).update(partie, "utf8").digest().toString("base64url")}`;
  if (jeton.length > TAILLE_MAX_JETON) throw new Error("Jeton trop long.");
  return jeton;
}

/** Lien complet, ou `null` s'il dépasse 512 caractères (limite du service d'envoi). */
export function construireLienGuide(jeton: string): string | null {
  const lien = BASE_LIEN_GUIDE + jeton;
  return lien.length > TAILLE_MAX_LIEN ? null : lien;
}
