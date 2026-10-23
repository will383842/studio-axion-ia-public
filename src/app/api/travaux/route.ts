import { NextResponse, type NextRequest } from "next/server";
import { sessionApi } from "@/services/auth";
import { derniereFabricationDeLaVideo, listerTravaux, obtenirTravail } from "@/services/travaux";

export const dynamic = "force-dynamic";

/** Progression en direct (interrogée toutes les 2 s par useTravaux). */
export async function GET(requete: NextRequest) {
  if (!(await sessionApi())) return NextResponse.json({ erreur: "Connexion requise." }, { status: 401 });
  const id = requete.nextUrl.searchParams.get("id");
  // TEST-UI-REEL U7 : `video` ajoute la dernière fabrication de cette vidéo (écran « Je fabrique votre vidéo »).
  const video = requete.nextUrl.searchParams.get("video");
  if (id || video) {
    const [t, f] = await Promise.all([id ? obtenirTravail(id) : null, video ? derniereFabricationDeLaVideo(video) : null]);
    const travaux = [t, f].filter((x, i, l): x is NonNullable<typeof x> => !!x && l.findIndex((y) => y?.id === x.id) === i);
    return NextResponse.json({ travaux }, { headers: { "Cache-Control": "no-store" } });
  }
  return NextResponse.json({ travaux: await listerTravaux() }, { headers: { "Cache-Control": "no-store" } });
}
