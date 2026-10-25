import { NextResponse, type NextRequest } from "next/server";
import { ouvrirAdresseDe } from "@/lib/ouvrir-adresse";
import { fluxZip, type EntreeFluxZip } from "@/lib/zip";
import { sessionApi } from "@/services/auth";
import { ErreurVisuel } from "@/visuels/services/carrousels";
import { dependancesContinus } from "@/visuels/continu/services/production-continus";
import { contenuZipToile } from "@/visuels/continu/services/vues-continus";

export const dynamic = "force-dynamic";

/**
 * Archive d'un carrousel continu : une page par fichier (`page-01.jpg`…), le texte du post, les textes alternatifs et un LISEZMOI. Session exigée.
 * Même flux au fil de l'eau que le téléchargement groupé (`fluxZip`) : une page illisible est sautée et nommée dans `FICHIERS-ILLISIBLES.txt`.
 */
export async function GET(requete: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  if (!(await sessionApi())) return NextResponse.json({ erreur: "Connexion requise." }, { status: 401 });
  const { id } = await ctx.params;
  let contenu;
  try {
    contenu = await contenuZipToile(decodeURIComponent(id), dependancesContinus());
  } catch (e) {
    return NextResponse.json({ erreur: e instanceof ErreurVisuel ? e.message : "Téléchargement impossible." }, { status: 404 });
  }
  const cookie = requete.headers.get("cookie") ?? "";
  const enc = new TextEncoder();
  const ouvrirAdresse = ouvrirAdresseDe(requete.nextUrl?.origin ?? "http://localhost", cookie);
  const entrees: EntreeFluxZip[] = contenu.entrees.map((e) => ({ nom: e.nom, ouvrir: async () => ("contenu" in e ? enc.encode(e.contenu) : ouvrirAdresse(e.url)) }));
  return new NextResponse(fluxZip(entrees), {
    headers: { "Content-Type": "application/zip", "Content-Disposition": `attachment; filename="${encodeURIComponent(contenu.nom)}"`, "Cache-Control": "no-store" },
  });
}
