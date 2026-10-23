import { NextResponse, type NextRequest } from "next/server";
import { classerSourceEcoute } from "@/fournisseurs/heygen/ecoute";
import { sessionApi } from "@/services/auth";
import { fournisseur } from "@/services/_commun";

/**
 * RELAIS D'ÉCOUTE (lot M0b) : la console écoute un son de voix (essai, aperçu d'une voix HeyGen, prononciation) sans
 * jamais lire un domaine tiers (la CSP reste fermée). Session exigée ; sources limitées aux fichiers du studio, aux
 * domaines HeyGen et au stockage du studio (`fournisseurs/heygen/ecoute.ts`). Le son n'est jamais gardé ici.
 */
export const dynamic = "force-dynamic";

const DELAI_MS = 30_000;
const TAILLE_MAX = 25 * 1024 * 1024;

export async function GET(requete: NextRequest) {
  if (!(await sessionApi())) return NextResponse.json({ erreur: "Connexion requise." }, { status: 401 });
  const source = classerSourceEcoute(requete.nextUrl.searchParams.get("cle"));
  if (!source) return NextResponse.json({ erreur: "Son introuvable." }, { status: 404 });
  if (source.genre === "local") return NextResponse.redirect(new URL(source.chemin, requete.nextUrl.origin));

  let adresse = source.genre === "distant" ? source.url : "";
  if (source.genre === "stockage") {
    const stockage = await fournisseur("stockage");
    adresse = stockage.urlLectureDuree ? await stockage.urlLectureDuree(source.cle, 300) : await stockage.urlLecture(source.cle);
    if (adresse.startsWith("/") && !adresse.startsWith("//")) return NextResponse.redirect(new URL(adresse, requete.nextUrl.origin));
    if (!/^https:\/\//.test(adresse)) return NextResponse.json({ erreur: "Son introuvable." }, { status: 404 });
  }

  const plage = requete.headers.get("range");
  let reponse: Response;
  try {
    reponse = await fetch(adresse, { headers: plage ? { range: plage } : {}, signal: AbortSignal.timeout(DELAI_MS), cache: "no-store" });
  } catch {
    return NextResponse.json({ erreur: "Le son ne répond pas. Réessayez dans un instant." }, { status: 502 });
  }
  if (!reponse.ok || !reponse.body) return NextResponse.json({ erreur: reponse.status === 403 || reponse.status === 404 ? "Ce son n'est plus disponible." : "Le son ne répond pas." }, { status: reponse.status === 404 || reponse.status === 403 ? 404 : 502 });
  const taille = Number(reponse.headers.get("content-length") ?? 0);
  if (taille > TAILLE_MAX) return NextResponse.json({ erreur: "Fichier trop lourd pour une écoute." }, { status: 413 });

  const type = reponse.headers.get("content-type") ?? "";
  const entetes = new Headers({
    "content-type": type.startsWith("audio/") || type.startsWith("video/") ? type : "audio/mpeg",
    "cache-control": "private, max-age=600",
    "x-content-type-options": "nosniff",
    "accept-ranges": "bytes",
  });
  for (const nom of ["content-length", "content-range"]) {
    const v = reponse.headers.get(nom);
    if (v) entetes.set(nom, v);
  }
  return new NextResponse(reponse.body, { status: reponse.status === 206 ? 206 : 200, headers: entetes });
}
