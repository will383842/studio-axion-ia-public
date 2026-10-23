import { NextResponse, type NextRequest } from "next/server";
import { sessionApi } from "@/services/auth";
import { PHRASES_IV, reessayerImageVideo, releverPlafondImageVideo, vueImageVideo } from "@/services/image-video-ecran";

export const dynamic = "force-dynamic";

/**
 * Onglet « Image → vidéo » (lot L16), adresse fixe appelée par `fetch` (même raison que la relance du cas concret : elle
 * ne dépend pas de l'identifiant d'une action serveur qui change à chaque mise en ligne).
 *  - GET : la vue des écrans 2 à 5 (l'écran « Fabrication » se relit toutes les quelques secondes) ;
 *  - POST `{ accord? }` : « Refaire cette partie » → `{ issue }` (reprise, prix à confirmer, ou phrase de refus) ;
 *  - POST `{ plafond, accord?, reprendre? }` : « Relever le plafond » (montant confirmé) → `{ issue }`.
 * Même origine seulement.
 */
export async function GET(_requete: NextRequest, ctx: RouteContext<"/api/image-video/[videoId]">) {
  if (!(await sessionApi())) return NextResponse.json({ erreur: "Connexion requise." }, { status: 401 });
  const { videoId } = await ctx.params;
  try {
    const vue = await vueImageVideo(decodeURIComponent(videoId));
    if (!vue) return NextResponse.json({ erreur: PHRASES_IV.introuvable }, { status: 404 });
    return NextResponse.json({ vue }, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    console.error("[image-video] lecture de la vue", e);
    return NextResponse.json({ erreur: PHRASES_IV.panne }, { status: 502 });
  }
}

export async function POST(requete: NextRequest, ctx: RouteContext<"/api/image-video/[videoId]">) {
  if (!(await sessionApi())) return NextResponse.json({ erreur: "Connexion requise." }, { status: 401 });
  const origine = requete.headers.get("origin");
  const hote = requete.headers.get("x-forwarded-host") ?? requete.headers.get("host");
  if (origine && hote && hoteDe(origine) !== hote) return NextResponse.json({ erreur: "Origine refusée." }, { status: 403 });
  const { videoId } = await ctx.params;
  let corps: { accord?: unknown; plafond?: unknown; reprendre?: unknown } = {};
  try {
    corps = (await requete.json()) as typeof corps;
  } catch {
    corps = {};
  }
  const accord = typeof corps.accord === "number" && Number.isFinite(corps.accord) ? corps.accord : undefined;
  try {
    if (corps.plafond !== undefined) {
      const issue = await releverPlafondImageVideo(decodeURIComponent(videoId), { montantCentimes: Number(corps.plafond), accordCentimes: accord, reprendre: corps.reprendre === true });
      return NextResponse.json({ issue }, { headers: { "Cache-Control": "no-store" } });
    }
    const issue = await reessayerImageVideo(decodeURIComponent(videoId), accord);
    return NextResponse.json({ issue }, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    console.error("[image-video] reprise", e);
    return NextResponse.json({ issue: { statut: "refusee", phrase: PHRASES_IV.panne } }, { status: 502 });
  }
}

function hoteDe(adresse: string): string | null {
  try {
    return new URL(adresse).host;
  } catch {
    return null;
  }
}
