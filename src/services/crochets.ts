/**
 * CROCHETS DES FOURNISSEURS (AV2.2-10 ; HeyGen « réveil sans confiance », lot M1b B.9 ter).
 *
 * La documentation HeyGen ne décrit la signature `x-heygen-signature` que pour les points d'accès enregistrés,
 * pas pour `callback_url`. Tranché : le crochet est un simple RÉVEIL —
 *  - il n'est accepté que signé : en-tête `x-heygen-signature` (HMAC-SHA256 du corps) OU adresse signée par le
 *    studio lui-même (`?id={callback_id}&sig=HMAC(id)`, construite par `adresseCrochetHeygen`) ;
 *  - son contenu est IGNORÉ, sauf `callback_id` (imprévisible) qui retrouve le travail ;
 *  - l'état est RELU chez HeyGen par la boucle de fond (GET avec la clé), jamais pris dans le crochet ;
 *  - chaque appel est journalisé en `EvenementFournisseur` (dédoublonné, jamais effacé).
 * Sans `HEYGEN_WEBHOOK_SECRET`, la route répond 501 (rien n'est branché).
 */
import "server-only";
import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import type { Travail } from "@/domaine/types";
import { nouvelId } from "@/lib/ids";
import { depots, horodatage, maintenant, sousVerrou } from "./_commun";

export function signatureCrochet(secret: string, donnee: string): string {
  return createHmac("sha256", secret).update(donnee, "utf8").digest("hex");
}

function egal(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

/** Adresse de rappel à donner à HeyGen pour un `callback_id` (signée : personne d'autre ne peut la fabriquer). */
export function adresseCrochetHeygen(base: string, callbackId: string, secret: string): string {
  return `${base.replace(/\/+$/, "")}/api/crochets/heygen?id=${encodeURIComponent(callbackId)}&sig=${signatureCrochet(secret, callbackId)}`;
}

export interface EntreeCrochet {
  corps: string;
  signature?: string | null;
  idAdresse?: string | null;
  sigAdresse?: string | null;
}

export type ReponseCrochet = { statut: number; corps: Record<string, unknown>; reveilles: string[] };

/** Le travail attend-il ce `callback_id` ? (identifiant chez le fournisseur ou paramètre posé par le moteur). */
function attend(t: Travail, callbackId: string): boolean {
  if (t.idExterne === callbackId) return true;
  const p = t.parametres ?? {};
  return p.callbackId === callbackId || (Array.isArray(p.callbackIds) && p.callbackIds.includes(callbackId));
}

/**
 * Traite un crochet HeyGen. Renvoie les travaux réveillés (l'appelant lance un tour de boucle, hors verrou).
 * Aucun appel réseau ici.
 */
export async function recevoirCrochetHeygen(entree: EntreeCrochet, secret: string): Promise<ReponseCrochet> {
  let donnees: Record<string, unknown> = {};
  try {
    donnees = JSON.parse(entree.corps || "{}") as Record<string, unknown>;
  } catch {
    // Corps illisible : seule l'adresse signée peut encore identifier le travail.
  }
  const data = (donnees.event_data ?? donnees.data ?? {}) as Record<string, unknown>;
  const callbackCorps = typeof donnees.callback_id === "string" ? donnees.callback_id : typeof data.callback_id === "string" ? data.callback_id : undefined;

  const parEntete = !!entree.signature && egal(signatureCrochet(secret, entree.corps), entree.signature.trim().toLowerCase());
  const parAdresse = !!entree.idAdresse && !!entree.sigAdresse && egal(signatureCrochet(secret, entree.idAdresse), entree.sigAdresse.toLowerCase()) && (!callbackCorps || callbackCorps === entree.idAdresse);
  if (!parEntete && !parAdresse) return { statut: 401, corps: { erreur: "Signature invalide" }, reveilles: [] };

  const callbackId = parAdresse ? entree.idAdresse! : callbackCorps;
  const idEvenement = typeof donnees.event_id === "string" ? donnees.event_id : createHash("sha256").update(`${callbackId ?? ""}:${entree.corps}`).digest("hex").slice(0, 32);
  const type = typeof donnees.event_type === "string" ? donnees.event_type.slice(0, 80) : "reveil";

  return sousVerrou(async () => {
    const d = depots();
    if (await d.evenementsFournisseurs.trouver((e) => e.fournisseur === "heygen" && e.idEvenement === idEvenement)) {
      return { statut: 200, corps: { recu: true, deja: true }, reveilles: [] };
    }
    const id = nouvelId("evf");
    // Seuls l'identifiant de rappel et le type sont gardés : le reste du contenu n'est pas fiable.
    await d.evenementsFournisseurs.enregistrer({ id, fournisseur: "heygen", idEvenement, type, recuLe: maintenant(), traite: false, charge: { callback_id: callbackId ?? null, event_type: type }, ...horodatage() });
    const reveilles: string[] = [];
    if (callbackId) {
      const actifs = await d.travaux.lister((t) => (t.statut === "en_cours" || t.statut === "en_file") && attend(t, callbackId));
      for (const t of actifs) {
        // Un travail « en attente du fournisseur » est interrogé dès le prochain tour.
        if (t.reprise) await d.travaux.enregistrer({ ...t, reprise: { ...t.reprise, prochainEssai: maintenant() } });
        reveilles.push(t.id);
      }
    }
    await d.evenementsFournisseurs.modifier(id, { traite: true, charge: { callback_id: callbackId ?? null, event_type: type, travaux: reveilles } });
    return { statut: 200, corps: { recu: true }, reveilles };
  });
}
