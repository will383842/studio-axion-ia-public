import { NextResponse, type NextRequest } from "next/server";
import { sessionApi } from "@/services/auth";
import { vignetteDrive } from "@/services/google-drive";

export const dynamic = "force-dynamic";

/** Vignette d'une vidéo du Drive (lot E2) : lue côté serveur avec le jeton, jamais d'adresse Google au navigateur. */
export async function GET(requete: NextRequest) {
  if (!(await sessionApi())) return new NextResponse(null, { status: 401 });
  const v = await vignetteDrive(requete.nextUrl.searchParams.get("id") ?? "");
  if (!v) return new NextResponse(null, { status: 404 });
  return new NextResponse(v.octets as BodyInit, { headers: { "Content-Type": v.type, "Cache-Control": "private, max-age=3600", "X-Content-Type-Options": "nosniff", "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'" } });
}
