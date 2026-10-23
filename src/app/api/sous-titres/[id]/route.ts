import { NextResponse, type NextRequest } from "next/server";
import { exporterSrt, exporterVtt } from "@/briques/sous-titres";
import { sessionApi } from "@/services/auth";
import { sousTitresDuReseau } from "@/services/sous-titres-par-reseau";
import { sousTitresDeLaVideo } from "@/services/telechargements";
import { obtenirVideo } from "@/services/videos";

/**
 * Export des sous-titres d'une vidéo en .srt ou .vtt (kit de publication, AV2.3-3 ; lot M2) : la version la PLUS
 * HAUTE des sous-titres (chaque correction en crée une), texte validé, UTF-8, sans chevauchement de minutage.
 */
export async function GET(requete: NextRequest, ctx: RouteContext<"/api/sous-titres/[id]">) {
  if (!(await sessionApi())) return NextResponse.json({ erreur: "Connexion requise." }, { status: 401 });
  const { id } = await ctx.params;
  const detail = await obtenirVideo(id);
  if (!detail) return NextResponse.json({ erreur: "Pas de sous-titres." }, { status: 404 });
  // L0d : `reseau` (cas concret) : les sous-titres de la fin de CE réseau, jamais ceux d'une autre fin.
  const reseau = requete.nextUrl.searchParams.get("reseau");
  // E2E-1 n° 6 : sans sous-titres alignés (fabrication simulée), le fichier est tiré du texte affiché, jamais vide.
  const segments = reseau ? (sousTitresDuReseau(detail.versionCourante?.projetMontage, reseau) ?? []) : await sousTitresDeLaVideo(detail.video, detail.sousTitres?.segments, detail.sorties);
  if (!segments.length) return NextResponse.json({ erreur: reseau ? "Pas de sous-titres pour ce réseau." : "Pas de sous-titres." }, { status: 404 });
  const format = requete.nextUrl.searchParams.get("format") === "vtt" ? "vtt" : "srt";
  const contenu = format === "vtt" ? exporterVtt(segments) : exporterSrt(segments);
  const nom = `${detail.video.titre.replace(/[^\p{L}\p{N}]+/gu, "-").toLowerCase()}${reseau ? `-${reseau.replace(/[^a-z0-9-]/g, "")}` : ""}`;
  return new NextResponse(contenu, {
    headers: {
      "Content-Type": format === "vtt" ? "text/vtt; charset=utf-8" : "application/x-subrip; charset=utf-8",
      "Content-Disposition": `attachment; filename="${encodeURIComponent(nom)}.${format}"`,
    },
  });
}
