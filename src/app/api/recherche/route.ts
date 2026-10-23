import { NextResponse, type NextRequest } from "next/server";
import { sessionApi } from "@/services/auth";
import { rechercher } from "@/services/recherche";

export const dynamic = "force-dynamic";

/** Recherche globale (loupe de l'en-tête). */
export async function GET(requete: NextRequest) {
  if (!(await sessionApi())) return NextResponse.json({ erreur: "Connexion requise." }, { status: 401 });
  const q = requete.nextUrl.searchParams.get("q") ?? "";
  return NextResponse.json(await rechercher(q), { headers: { "Cache-Control": "no-store" } });
}
