/**
 * LOOKS HEYGEN (lot B1, décors réalistes ; plan B.0 §4 et §9, `decors/CATALOGUE-DECORS.md`). ÉCRITS ET ÉTEINTS :
 * rien ici n'est appelé tant que `FOURNISSEUR_VISAGE=heygen` n'est pas posé (et qu'un double de Will n'existe pas).
 *
 * Documentation relue le 02/10 (lecture seule) :
 *  - `POST /v3/avatars` type `prompt` : `name`, `prompt` (≤ 1 000 caractères), `avatar_id` (look de RÉFÉRENCE : toujours
 *    le même look de base de Will), `avatar_group_id` (groupe du double), `aspect_ratio` (`9:16`), en-tête
 *    `Idempotency-Key` (rejoué sous 24 h, jamais repayé). Réponse : `{ data: { avatar_item, avatar_group } }`,
 *    `avatar_item.status` ∈ processing · pending_consent · failed · completed ;
 *  - `POST /v3/avatars/looks` (`look_pack` ou `template` + `reference_look_id`) : « 1 API credit per look generated » ;
 *  - suivi par INTERROGATION seulement : `GET /v3/avatars/looks/{id}` (vérifié en réel le 02/10 sur un look public :
 *    `status`, `preview_image_url`, `supported_api_engines`, `preferred_orientation`) ;
 *  - liste : `GET /v3/avatars/looks?ownership=private` (le compte n'a aucun look privé au 02/10 : pas encore de double).
 * Un look terminé N'EST PAS validé : il passe `a_verifier` (`origine: genere`) jusqu'à la validation de Will sur
 * capture ; Avatar V doit figurer dans `supported_api_engines` (sinon `echec` : pas de rendu possible au format avocat).
 */
import type { AngleVisage, StatutPreparation } from "@/domaine/types";
import type { LookExistant } from "../types";
import type { ClientHeygen } from "./client";

/** Un look tel que HeyGen le renvoie (`avatar_item`, ou `data` de `GET /v3/avatars/looks/{id}`). */
export interface LookHeygenBrut {
  id: string;
  name?: string;
  avatar_type?: string;
  group_id?: string;
  status?: string;
  preview_image_url?: string | null;
  preview_video_url?: string | null;
  supported_api_engines?: string[] | null;
  preferred_orientation?: string | null;
  error?: { code?: string; message?: string } | null;
}

export interface DemandeLookHeygen {
  /** Look de RÉFÉRENCE (le look de base de Will, toujours le même). */
  lookBaseId: string;
  /** Groupe du double (les looks y sont rangés). */
  groupeId?: string;
  nom: string;
  consigne: string;
  /** Jusqu'à 3 images de référence (adresses lisibles par HeyGen, ex. photo du décor). */
  imagesReference?: string[];
  cleIdempotence: string;
}

/** Corps de `POST /v3/avatars` (PUR, testé). */
export function corpsCreationLook(d: DemandeLookHeygen): Record<string, unknown> {
  if (!d.lookBaseId.trim()) throw new Error("LOOK_DE_BASE_MANQUANT");
  const corps: Record<string, unknown> = { type: "prompt", name: d.nom.slice(0, 120), prompt: d.consigne.slice(0, 1000), avatar_id: d.lookBaseId, aspect_ratio: "9:16" };
  if (d.groupeId) corps.avatar_group_id = d.groupeId;
  const images = (d.imagesReference ?? []).filter(Boolean).slice(0, 3);
  if (images.length) corps.reference_images = images.map((url) => ({ type: "url", url }));
  return corps;
}

/** Clé d'idempotence HeyGen : 1 à 255 caractères parmi `[A-Za-z0-9_:.-]`. */
export function cleIdempotenceLook(decorId: string, angle: AngleVisage, version = 1): string {
  return `look:${decorId}:${angle}:v${version}`.replace(/[^A-Za-z0-9_:.-]/g, "-").slice(0, 255);
}

/** Moteur exigé par le format avocat (B.0 §9). */
export const MOTEUR_AVATAR_V = "avatar_v";

/**
 * État studio d'un look HeyGen. `completed` → `a_verifier` (JAMAIS `pret` : Will valide sur capture), sauf si Avatar V
 * manque (`echec`) ; `processing` / `pending_consent` → `en_preparation` ; `failed` → `echec`.
 */
export function statutLook(l: Pick<LookHeygenBrut, "status" | "supported_api_engines">): { statut: StatutPreparation; progression: number; raison?: string } {
  switch (l.status) {
    case "completed": {
      const moteurs = l.supported_api_engines ?? [];
      if (moteurs.length && !moteurs.includes(MOTEUR_AVATAR_V)) return { statut: "echec", progression: 100, raison: "Ce look ne sait pas parler avec Avatar V." };
      return { statut: "a_verifier", progression: 100 };
    }
    case "failed":
      return { statut: "echec", progression: 100, raison: "HeyGen n'a pas réussi ce look." };
    case "pending_consent":
      return { statut: "en_preparation", progression: 10, raison: "HeyGen attend votre accord dans son application." };
    default:
      return { statut: "en_preparation", progression: 50 };
  }
}

/**
 * Correcteur réel 2 (04/10) : un look du compte (Will dans un décor, fait DANS l'application HeyGen), en mots simples
 * pour le relier à un décor (PUR, testé). Choisissable seulement s'il est terminé et sait parler avec Avatar V.
 */
export function lookExistantDepuis(l: LookHeygenBrut): LookExistant {
  const base: LookExistant = { idExterne: l.id, nom: (l.name ?? "").trim() || "Look sans nom", utilisable: false, ...(l.group_id ? { groupe: l.group_id } : {}), ...(l.preview_image_url ? { apercuUrl: l.preview_image_url } : {}) };
  if (l.status === "pending_consent") return { ...base, raison: "HeyGen attend encore votre accord (dans l'application HeyGen)." };
  if (l.status === "failed") return { ...base, raison: "HeyGen n'a pas réussi ce look : refaites-le dans l'application HeyGen." };
  if (l.status && l.status !== "completed") return { ...base, raison: "HeyGen termine encore ce look : revenez dans un moment." };
  const moteurs = l.supported_api_engines ?? [];
  if (moteurs.length && !moteurs.includes(MOTEUR_AVATAR_V)) return { ...base, raison: "Ce look ne sait pas parler avec le moteur le plus réaliste de HeyGen : il ne peut pas servir à vos vidéos." };
  return { ...base, utilisable: true };
}

/** Lit la réponse de création (`{ avatar_item }` ou le look lui-même). */
export function lookDepuisReponse(r: unknown): LookHeygenBrut {
  const o = (r ?? {}) as { avatar_item?: LookHeygenBrut; looks?: { id: string }[] } & Partial<LookHeygenBrut>;
  const item = o.avatar_item ?? (o.looks?.[0] ? { id: o.looks[0].id, status: "processing" } : o.id ? (o as LookHeygenBrut) : null);
  if (!item?.id) throw new Error("REPONSE_LOOK_INATTENDUE");
  return item;
}

/** Les appels Looks (aucun n'est fait sans `FOURNISSEUR_VISAGE=heygen`). */
export function creerLooksHeygen(client: ClientHeygen) {
  return {
    /** `POST /v3/avatars` type `prompt` — PAYANT (1 crédit API). */
    async creer(d: DemandeLookHeygen): Promise<LookHeygenBrut> {
      const r = await client.requete<unknown>("POST", "/v3/avatars", corpsCreationLook(d), { "Idempotency-Key": d.cleIdempotence });
      return lookDepuisReponse(r);
    },
    /** `GET /v3/avatars/looks/{id}` — gratuit. */
    async lire(id: string): Promise<LookHeygenBrut> {
      return client.requete<LookHeygenBrut>("GET", `/v3/avatars/looks/${encodeURIComponent(id)}`);
    },
    /** `GET /v3/avatars/looks?ownership=private` — gratuit (looks du compte). */
    async listerPrives(groupeId?: string): Promise<LookHeygenBrut[]> {
      const sortie: LookHeygenBrut[] = [];
      let jeton: string | undefined;
      for (let page = 0; page < 20; page++) {
        const q = new URLSearchParams({ ownership: "private", limit: "50" });
        if (groupeId) q.set("group_id", groupeId);
        if (jeton) q.set("token", jeton);
        const r = await client.requeteEntiere<{ data?: LookHeygenBrut[]; has_more?: boolean; next_token?: string | null }>("GET", `/v3/avatars/looks?${q}`);
        sortie.push(...(r.data ?? []));
        if (!r.has_more || !r.next_token) break;
        jeton = r.next_token;
      }
      return sortie;
    },
  };
}
export type LooksHeygen = ReturnType<typeof creerLooksHeygen>;
