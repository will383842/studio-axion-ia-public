import { NextResponse, type NextRequest } from "next/server";
import { ErreurStudio } from "@/services/_commun";
import { sessionApi } from "@/services/auth";
import { abonnementActif, clePubliquePush, compterAbonnementsPush, enregistrerAbonnementPush } from "@/services/notifications";

export const dynamic = "force-dynamic";

/**
 * Notifications sur le téléphone (lot M1b, relié au lot R3) : GET = clé publique VAPID (null si non installé OU carte
 * « Notifications » en simulation) et nombre d'appareils ; POST = abonnement du navigateur ;
 * POST `{ verifier: adresse }` = « l'abonnement de CET appareil est-il actif ? » (oui/non, aucune autre adresse).
 */
export async function GET() {
  if (!(await sessionApi())) return NextResponse.json({ erreur: "Connexion requise." }, { status: 401 });
  return NextResponse.json({ cle: await clePubliquePush(), appareils: await compterAbonnementsPush() }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(requete: NextRequest) {
  if (!(await sessionApi())) return NextResponse.json({ erreur: "Connexion requise." }, { status: 401 });
  try {
    const corps = (await requete.json()) as { abonnement?: unknown; verifier?: unknown };
    if ("verifier" in corps) return NextResponse.json({ actif: await abonnementActif(corps.verifier) }, { headers: { "Cache-Control": "no-store" } });
    await enregistrerAbonnementPush(corps.abonnement, appareilDe(requete.headers.get("user-agent") ?? ""));
    return NextResponse.json({ ok: true });
  } catch (e) {
    const message = e instanceof ErreurStudio ? e.message : "Ce téléphone n'a pas pu être relié. Réessayez.";
    return NextResponse.json({ erreur: message }, { status: 400 });
  }
}

function appareilDe(ua: string): string {
  if (/iPhone/i.test(ua)) return "iPhone";
  if (/iPad/i.test(ua)) return "iPad";
  if (/Android/i.test(ua)) return "Android";
  if (/Macintosh/i.test(ua)) return "Mac";
  if (/Windows/i.test(ua)) return "Ordinateur Windows";
  return "Navigateur";
}
