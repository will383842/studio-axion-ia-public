import { NextResponse } from "next/server";
import { etatSante } from "@/services/sante";

export const dynamic = "force-dynamic";

/**
 * Sonde de santé (publique) pour Docker et Coolify. N'expose rien. Vérifie la base (E2E-2 données n° 8) :
 * 503 si elle ne répond pas, pour que le conteneur passe « unhealthy » au lieu de se dire en bonne santé.
 * Audit D, B9 : 503 aussi si la boucle de fond n'a terminé aucun tour depuis 3 min (hors démarrage).
 * 14/10/2026 : dit aussi la version en ligne (`version` : le commit de l'image, « inconnu » sans lui).
 */
export async function GET() {
  const etat = await etatSante();
  return NextResponse.json({ ...etat, service: "studio", heure: new Date().toISOString() }, { status: etat.ok ? 200 : 503, headers: { "Cache-Control": "no-store" } });
}
