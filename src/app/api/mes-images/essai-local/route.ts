import { NextResponse, type NextRequest } from "next/server";
import { ErreurStudio } from "@/services/_commun";
import { sessionApi } from "@/services/auth";
import { garderCopieLocale } from "@/services/mes-images";

export const dynamic = "force-dynamic";

/**
 * « Mes images » en ESSAI LOCAL (lot A2) : sans stockage réel, l'envoi par morceaux n'envoie aucun octet ; pour que
 * Will voie SES images en local, le fichier (image de 15 Mo au plus) est gardé sous `public/essais/` et relié au
 * fichier déjà enregistré. Jamais en production (R2 y reçoit les octets directement). Session exigée.
 */
export async function POST(requete: NextRequest) {
  if (process.env.NODE_ENV === "production") return NextResponse.json({ erreur: "Indisponible." }, { status: 404 });
  if (!(await sessionApi())) return NextResponse.json({ erreur: "Connexion requise." }, { status: 401 });
  const fichierId = requete.nextUrl.searchParams.get("fichierId") ?? "";
  if (!/^f[A-Za-z0-9_-]{1,80}$/.test(fichierId)) return NextResponse.json({ erreur: "Fichier inconnu." }, { status: 400 });
  const contenu = new Uint8Array(await requete.arrayBuffer());
  if (!contenu.length || contenu.length > 15 * 1024 * 1024) return NextResponse.json({ erreur: "Image vide ou trop lourde." }, { status: 400 });
  try {
    return NextResponse.json(await garderCopieLocale(fichierId, contenu));
  } catch (e) {
    return NextResponse.json({ erreur: e instanceof ErreurStudio ? e.message : "L'image n'a pas pu être gardée. Réessayez." }, { status: 400 });
  }
}
