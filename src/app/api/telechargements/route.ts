import { NextResponse, type NextRequest } from "next/server";
import type { ReseauDeclinaison } from "@/domaine/types";
import { fluxZip, type EntreeFluxZip, type SourceZip } from "@/lib/zip";
import { estReseauDeclinaison } from "@/reseaux/codes";
import { sessionApi } from "@/services/auth";
import { ErreurStudio } from "@/services/_commun";
import { cetteSemaine, contenuArchiveReseau, contenuArchiveSujet, type ContenuArchive } from "@/services/telechargements";

/**
 * Téléchargement groupé (plan v5 B.6.10, lot G1b) : `?sujet=<id>` (tout le sujet) ou `?reseau=tiktok&du=AAAA-MM-JJ&au=…`
 * (par réseau, « cette semaine » par défaut). Archive zip, un fichier par ratio, noms donnés par `nomFichier()`.
 *
 * Vérification E2E-1 n° 2 (03/10) : l'archive part AU FIL DE L'EAU (`fluxZip`). Chaque vidéo est ouverte au moment de
 * l'écrire et recopiée morceau par morceau, au rythme du navigateur : la mémoire du studio (1 Go) reste bornée quel
 * que soit le poids du sujet (300 à 600 Mo). Une vidéo illisible ne casse plus la réponse : elle est sautée et nommée
 * dans `FICHIERS-ILLISIBLES.txt`, à la fin de l'archive. Le CONTENU des entrées (vidéos, sous-titres) vient tel quel
 * du service `telechargements`.
 */
export async function GET(requete: NextRequest) {
  if (!(await sessionApi())) return NextResponse.json({ erreur: "Connexion requise." }, { status: 401 });
  const p = requete.nextUrl.searchParams;
  const sujet = p.get("sujet");
  const reseau = p.get("reseau");
  let contenu: ContenuArchive;
  try {
    if (sujet) contenu = await contenuArchiveSujet(sujet);
    else if (reseau && estReseauDeclinaison(reseau as ReseauDeclinaison)) {
      const semaine = cetteSemaine();
      contenu = await contenuArchiveReseau(reseau as ReseauDeclinaison, p.get("du") ?? semaine.debut, p.get("au") ?? semaine.fin);
    } else return NextResponse.json({ erreur: "Précisez un sujet ou un réseau." }, { status: 400 });
  } catch (e) {
    return NextResponse.json({ erreur: e instanceof ErreurStudio ? e.message : "Téléchargement impossible." }, { status: 404 });
  }

  // Les adresses relatives (médias du studio) sont lues sur ce même serveur, avec le cookie de la session.
  const cookie = requete.headers.get("cookie") ?? "";
  const enc = new TextEncoder();
  async function ouvrirAdresse(url: string): Promise<SourceZip> {
    const r = await fetch(new URL(url, requete.nextUrl.origin), { headers: url.startsWith("/") ? { cookie } : {}, cache: "no-store" });
    if (!r.ok || !r.body) {
      await r.body?.cancel().catch(() => undefined);
      throw new Error(`fichier illisible (${r.status})`);
    }
    return r.body;
  }
  const entrees: EntreeFluxZip[] = contenu.entrees.map((e) => ({
    nom: e.nom,
    ouvrir: async () => ("contenu" in e ? enc.encode(e.contenu) : ouvrirAdresse(e.url)),
  }));
  return new NextResponse(fluxZip(entrees), {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="${encodeURIComponent(contenu.nom)}"`,
      "Cache-Control": "no-store",
    },
  });
}
