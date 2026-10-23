import { NextResponse, type NextRequest } from "next/server";
import { ErreurStudio } from "@/services/_commun";
import { sessionApi } from "@/services/auth";
import { terminerConnexionDrive } from "@/services/google-drive";

export const dynamic = "force-dynamic";

/**
 * Retour de la page Google « Autoriser l'accès » (lot E2). Adresse à inscrire dans la console Google :
 * `${STUDIO_ADRESSE}/api/google-drive/retour` (ou `GOOGLE_REDIRECTION`). Session exigée ; renvoie toujours vers
 * Réglages › Mon Google Drive avec un mot d'état (jamais le code ni le jeton dans l'adresse).
 */
export async function GET(requete: NextRequest) {
  const vers = (etat: string) => NextResponse.redirect(new URL(`/reglages/google-drive?drive=${etat}`, requete.nextUrl.origin), { headers: { "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" } });
  if (!(await sessionApi())) return NextResponse.redirect(new URL("/connexion", requete.nextUrl.origin));
  const p = requete.nextUrl.searchParams;
  if (p.get("error")) return vers(p.get("error") === "access_denied" ? "annule" : "refuse");
  try {
    await terminerConnexionDrive(p.get("code") ?? "", p.get("state") ?? "");
    return vers("relie");
  } catch (e) {
    if (!(e instanceof ErreurStudio)) console.error("[studio] connexion Drive", e);
    return vers(e instanceof ErreurStudio && e.code === "DRIVE_LIEN" ? "lien-expire" : "refuse");
  }
}
