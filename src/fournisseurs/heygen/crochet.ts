/**
 * ADRESSE DE RAPPEL HEYGEN (lot R7b) — `callback_url` d'un rendu : un simple RÉVEIL (`services/crochets.ts`).
 * Même signature que `adresseCrochetHeygen` (HMAC-SHA256 hexadécimal de l'identifiant), recalculée ici pour que le
 * fournisseur ne dépende pas des services ; un test vérifie que les deux adresses sont identiques.
 * Sans `HEYGEN_WEBHOOK_SECRET` : aucune adresse (le rendu se suit par interrogation seule).
 */
import { createHmac } from "node:crypto";

export function adresseRappelHeygen(env: Record<string, string | undefined>, callbackId: string): string | undefined {
  const secret = env.HEYGEN_WEBHOOK_SECRET?.trim();
  if (!secret || !callbackId) return undefined;
  const base = (env.STUDIO_ADRESSE?.trim() || "https://studio.axion-ia.com").replace(/\/+$/, "");
  if (!/^https:\/\//.test(base)) return undefined;
  const sig = createHmac("sha256", secret).update(callbackId, "utf8").digest("hex");
  return `${base}/api/crochets/heygen?id=${encodeURIComponent(callbackId)}&sig=${sig}`;
}
