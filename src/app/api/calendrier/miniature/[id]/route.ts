import { NextResponse, type NextRequest } from "next/server";
import { sessionApi } from "@/services/auth";
import { lireMiniatureDiffuseur } from "@/services/miniature-diffuseur";

export const dynamic = "force-dynamic";

/** RAP-3 · miniature d'une publication rapatriée, lue côté serveur : le navigateur ne contacte jamais le diffuseur. Session exigée. */
export async function GET(_requete: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await sessionApi())) return new NextResponse(null, { status: 401 });
  const { id } = await params;
  const m = await lireMiniatureDiffuseur(id);
  if (!m) return new NextResponse(null, { status: 404 });
  return new NextResponse(m.octets as BodyInit, { headers: { "Content-Type": m.type, "Cache-Control": "private, max-age=3600", "X-Content-Type-Options": "nosniff", "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'" } });
}
