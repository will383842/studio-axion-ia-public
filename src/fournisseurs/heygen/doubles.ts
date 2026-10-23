/**
 * DOUBLES DU COMPTE HEYGEN (lot R7). Décision de Will (03/10) : il crée et teste son double DANS L'APPLICATION
 * HEYGEN ; le studio ne fait que le LIRE et l'UTILISER par l'API (même compte). Rien n'est créé ici.
 *
 * Documentation relue le 03/10/2026 (lecture seule, aucun appel) :
 *  - `GET /v3/avatars/looks?ownership=private&avatar_type=digital_twin` (paginé par `token`) : les doubles du compte,
 *    `id` à passer en `avatar_id` à `POST /v3/videos` (developers.heygen.com/generate-avatar-video) ;
 *  - un look : `status` processing · pending_consent · failed · completed, `supported_api_engines`,
 *    `preferred_orientation` (reference/get-avatar-look).
 * Le format avocat exige Avatar V : un double sans `avatar_v` ou pas terminé est montré, mais pas choisissable.
 */
import type { DoubleExistant } from "../types";
import type { ClientHeygen } from "./client";
import { MOTEUR_AVATAR_V, type LookHeygenBrut } from "./looks";

/** Un double du compte, en mots simples pour Will (PUR, testé). */
export function doubleDepuisLook(l: LookHeygenBrut): DoubleExistant {
  const o = l.preferred_orientation;
  const orientation: DoubleExistant["orientation"] = o === "portrait" || o === "landscape" || o === "square" ? o : undefined;
  const base = { idExterne: l.id, nom: (l.name ?? "").trim() || "Double sans nom", ...(orientation ? { orientation } : {}) };
  if (l.status === "pending_consent") return { ...base, utilisable: false, raison: "HeyGen attend encore votre accord filmé (dans l'application HeyGen)." };
  if (l.status === "failed") return { ...base, utilisable: false, raison: "HeyGen n'a pas réussi ce double : refaites-le dans l'application HeyGen." };
  if (l.status && l.status !== "completed") return { ...base, utilisable: false, raison: "HeyGen termine encore ce double : revenez dans un moment." };
  const moteurs = l.supported_api_engines ?? [];
  if (moteurs.length && !moteurs.includes(MOTEUR_AVATAR_V)) return { ...base, utilisable: false, raison: "Ce double ne sait pas parler avec le moteur le plus réaliste de HeyGen : il ne peut pas servir à vos vidéos." };
  return { ...base, utilisable: true };
}

/** `GET /v3/avatars/looks?ownership=private&avatar_type=digital_twin` — gratuit. */
export async function listerDoublesDuCompte(client: ClientHeygen): Promise<DoubleExistant[]> {
  const sortie: DoubleExistant[] = [];
  let jeton: string | undefined;
  for (let page = 0; page < 20; page++) {
    const q = new URLSearchParams({ ownership: "private", avatar_type: "digital_twin", limit: "50" });
    if (jeton) q.set("token", jeton);
    const r = await client.requeteEntiere<{ data?: LookHeygenBrut[]; has_more?: boolean; next_token?: string | null }>("GET", `/v3/avatars/looks?${q}`);
    sortie.push(...(r.data ?? []).filter((l) => l?.id).map(doubleDepuisLook));
    if (!r.has_more || !r.next_token) break;
    jeton = r.next_token;
  }
  return sortie;
}
