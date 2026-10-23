import { NextResponse, type NextRequest } from "next/server";

/**
 * Crochets des fournisseurs (AV2.2-10) : exemptés de session (proxy.ts), vérifiés par SIGNATURE,
 * dédoublonnés et journalisés en EvenementFournisseur.
 * HeyGen (lot M1b) : simple RÉVEIL sans confiance — l'état est relu chez HeyGen par la boucle de fond
 * (services/crochets.ts). Répond 501 tant que `HEYGEN_WEBHOOK_SECRET` n'existe pas. Autres fournisseurs : 501.
 */
export const dynamic = "force-dynamic";

export async function POST(requete: NextRequest, ctx: RouteContext<"/api/crochets/[fournisseur]">) {
  const { fournisseur } = await ctx.params;
  const secret = process.env.HEYGEN_WEBHOOK_SECRET?.trim();
  if (fournisseur !== "heygen" || !secret) return NextResponse.json({ erreur: "Non disponible", fournisseur }, { status: 501 });
  const corps = await requete.text();
  if (corps.length > 64 * 1024) return NextResponse.json({ erreur: "Trop volumineux" }, { status: 413 });
  const { recevoirCrochetHeygen } = await import("@/services/crochets");
  const r = await recevoirCrochetHeygen(
    {
      corps,
      signature: requete.headers.get("x-heygen-signature") ?? requete.headers.get("signature"),
      idAdresse: requete.nextUrl.searchParams.get("id"),
      sigAdresse: requete.nextUrl.searchParams.get("sig"),
    },
    secret,
  );
  if (r.reveilles.length) {
    // Le réveil fait un tour de boucle tout de suite, sans faire attendre HeyGen (hors verrou, sauté si un tour est en cours).
    const { tourDeBoucle } = await import("@/services/boucle");
    void tourDeBoucle();
  }
  return NextResponse.json(r.corps, { status: r.statut });
}

export async function GET(_requete: NextRequest, ctx: RouteContext<"/api/crochets/[fournisseur]">) {
  const { fournisseur } = await ctx.params;
  return NextResponse.json({ erreur: "Non disponible", fournisseur }, { status: fournisseur === "heygen" && process.env.HEYGEN_WEBHOOK_SECRET ? 405 : 501 });
}
