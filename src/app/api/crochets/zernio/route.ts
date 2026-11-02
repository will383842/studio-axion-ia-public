import { NextResponse, type NextRequest } from "next/server";
import { ENTETE_HORODATAGE_ZERNIO, ENTETE_SIGNATURE_ZERNIO, TAILLE_MAX_CROCHET } from "@/domaine/guide-reseau/crochet-zernio";

/**
 * Crochet Zernio (PV-2) : exempté de session (proxy.ts), vérifié par SIGNATURE (`ZERNIO_WEBHOOK_SECRET`, lu seulement dans
 * l'environnement). Éteint (`PARCOURS_MOT_ENABLED`) ou sans secret : réponse NEUTRE 200, rien n'est lu ni écrit.
 * Cette route DÉPOSE dans l'outbox ; le travail de fond relit le run chez Zernio. Aucune adresse e-mail n'est gardée.
 */
export const dynamic = "force-dynamic";

export async function POST(requete: NextRequest) {
  const { parcoursMotActif, recevoirCrochetZernio, VARIABLE_SECRET_CROCHET_ZERNIO } = await import("@/services/parcours-mot");
  if (!parcoursMotActif() || !process.env[VARIABLE_SECRET_CROCHET_ZERNIO]?.trim()) return NextResponse.json({ recu: true }, { status: 200 });
  const declare = Number(requete.headers.get("content-length") ?? 0);
  if (declare > TAILLE_MAX_CROCHET) return NextResponse.json({ erreur: "trop_volumineux" }, { status: 413 });
  const corps = await requete.text();
  const r = await recevoirCrochetZernio({ corps, signature: requete.headers.get(ENTETE_SIGNATURE_ZERNIO), horodatage: requete.headers.get(ENTETE_HORODATAGE_ZERNIO) });
  return NextResponse.json(r.corps, { status: r.statut });
}

export async function GET() {
  // Neutre : on ne révèle pas si le parcours est allumé.
  return NextResponse.json({ erreur: "Non disponible" }, { status: 405 });
}
