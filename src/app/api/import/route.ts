import { NextResponse, type NextRequest } from "next/server";
import { MESSAGE_TROP_LOURD, TAILLE_MAX_IMPORT } from "@/assistant/express/texte-colle";
import { ErreurStudio } from "@/services/_commun";
import { sessionApi } from "@/services/auth";
import { extraireTexteFichier } from "@/services/import-texte";

export const dynamic = "force-dynamic";

/**
 * « Importer un fichier » (.docx, .pdf, .txt, .md) — relecture paquet 4, sécurité P1 : la session est exigée AVANT de
 * lire le corps (une action serveur lit le corps d'abord). Corps = les octets du fichier, son nom dans l'en-tête
 * `x-nom-fichier` ; lu en flux et coupé au-delà de 5 Mo. Les actions serveur gardent la limite par défaut (1 Mo).
 */
export async function POST(requete: NextRequest) {
  if (!(await sessionApi())) return NextResponse.json({ erreur: "Connexion requise." }, { status: 401 });
  if (requete.headers.get("sec-fetch-site") === "cross-site") return NextResponse.json({ erreur: "Demande refusée." }, { status: 403 });
  const annonce = Number(requete.headers.get("content-length") ?? 0);
  if (annonce > TAILLE_MAX_IMPORT) return NextResponse.json({ erreur: MESSAGE_TROP_LOURD }, { status: 413 });
  let nom = "";
  try {
    nom = decodeURIComponent(requete.headers.get("x-nom-fichier") ?? "").slice(0, 300);
  } catch {
    nom = "";
  }
  const octets = await lireBorne(requete.body, TAILLE_MAX_IMPORT);
  if (!octets) return NextResponse.json({ erreur: MESSAGE_TROP_LOURD }, { status: 413 });
  try {
    return NextResponse.json({ texte: await extraireTexteFichier(nom, octets) });
  } catch (e) {
    if (e instanceof ErreurStudio) return NextResponse.json({ erreur: e.message, code: e.code }, { status: 400 });
    console.error("[import] lecture du fichier en échec", e instanceof Error ? e.message : "erreur");
    return NextResponse.json({ erreur: "Un souci est survenu. Réessayez dans un instant." }, { status: 500 });
  }
}

/** Lit le corps en flux ; null dès que `max` octets sont dépassés (la lecture s'arrête là). */
async function lireBorne(corps: ReadableStream<Uint8Array> | null, max: number): Promise<Uint8Array | null> {
  if (!corps) return new Uint8Array(0);
  const lecteur = corps.getReader();
  const morceaux: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await lecteur.read();
    if (done) break;
    total += value.byteLength;
    if (total > max) {
      await lecteur.cancel().catch(() => undefined);
      return null;
    }
    morceaux.push(value);
  }
  const tout = new Uint8Array(total);
  let i = 0;
  for (const m of morceaux) {
    tout.set(m, i);
    i += m.byteLength;
  }
  return tout;
}
