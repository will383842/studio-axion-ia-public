import { NextResponse, type NextRequest } from "next/server";
import { sessionApi } from "@/services/auth";
import { vueLotImageVideo } from "@/services/image-video-lot";

export const dynamic = "force-dynamic";

/**
 * Page du lot d'images : adresse fixe lue par `fetch` toutes les quelques secondes tant que le lot avance (même raison
 * que `/api/image-video/[videoId]`). GET seulement : la vue du lot.
 */
export async function GET(_requete: NextRequest, ctx: RouteContext<"/api/image-video-lot/[lotId]">) {
  if (!(await sessionApi())) return NextResponse.json({ erreur: "Connexion requise." }, { status: 401 });
  const { lotId } = await ctx.params;
  const vue = await vueLotImageVideo(decodeURIComponent(lotId));
  if (!vue) return NextResponse.json({ erreur: "Ce lot n'existe plus." }, { status: 404 });
  return NextResponse.json({ vue }, { headers: { "Cache-Control": "no-store" } });
}
