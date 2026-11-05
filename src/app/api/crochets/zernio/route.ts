import { NextResponse, type NextRequest } from "next/server";
import { ENTETE_ID_EVENEMENT_HERITE, ENTETE_ID_EVENEMENT_ZERNIO, ENTETE_SIGNATURE_HERITEE, ENTETE_SIGNATURE_ZERNIO, TAILLE_MAX_CROCHET } from "@/domaine/guide-reseau/crochet-zernio";

/**
 * Crochet Zernio (PV-2) : exempté de session (proxy.ts), vérifié par SIGNATURE (`ZERNIO_WEBHOOK_SECRET`, lu seulement dans
 * l'environnement). Éteint (`PARCOURS_MOT_ENABLED` et `MOTS_ENABLED`) ou sans secret : réponse NEUTRE 200, rien n'est lu ni écrit.
 * Cette route DÉPOSE dans l'outbox ; le travail de fond relit le run chez Zernio. Aucun appel réseau ici. Aucune adresse e-mail ni texte brut n'est gardé.
 */
export const dynamic = "force-dynamic";

/**
 * Lecture du corps en OCTETS bruts, plafonnée même sans `content-length` (envoi par morceaux) : on s'arrête dès que le
 * plafond est dépassé. Le HMAC est ensuite calculé sur ce Buffer (pas sur un texte décodé : BOM, UTF-8 invalide).
 * Même démarche que `lireCorpsPlafonne` du site. `null` = trop volumineux.
 */
async function lireCorpsPlafonne(req: NextRequest, max: number): Promise<Buffer | null> {
  const annonce = Number(req.headers.get("content-length"));
  if (Number.isFinite(annonce) && annonce > max) return null;
  if (!req.body) return Buffer.alloc(0);
  const lecteur = req.body.getReader();
  const morceaux: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await lecteur.read();
    if (done) break;
    total += value.byteLength;
    if (total > max) {
      await lecteur.cancel();
      return null;
    }
    morceaux.push(value);
  }
  return Buffer.concat(morceaux);
}

export async function POST(requete: NextRequest) {
  const { parcoursMotActif, evenementsMotsActifs, recevoirCrochetZernio, VARIABLE_SECRET_CROCHET_ZERNIO } = await import("@/services/parcours-mot");
  if ((!parcoursMotActif() && !evenementsMotsActifs()) || !process.env[VARIABLE_SECRET_CROCHET_ZERNIO]?.trim()) return NextResponse.json({ recu: true }, { status: 200 });
  const corps = await lireCorpsPlafonne(requete, TAILLE_MAX_CROCHET);
  if (corps === null) return NextResponse.json({ erreur: "trop_volumineux" }, { status: 413 });
  const r = await recevoirCrochetZernio({ corps, signature: requete.headers.get(ENTETE_SIGNATURE_ZERNIO) ?? requete.headers.get(ENTETE_SIGNATURE_HERITEE), idEvenement: requete.headers.get(ENTETE_ID_EVENEMENT_ZERNIO) ?? requete.headers.get(ENTETE_ID_EVENEMENT_HERITE) });
  return NextResponse.json(r.corps, { status: r.statut });
}

export async function GET() {
  // Neutre : on ne révèle pas si le parcours est allumé.
  return NextResponse.json({ erreur: "Non disponible" }, { status: 405 });
}
