import { NextResponse, type NextRequest } from "next/server";
import { sessionApi } from "@/services/auth";
import { PHRASES_RELANCE, relancerEtapeCasConcret } from "@/services/cas-concret-relance";

export const dynamic = "force-dynamic";

/**
 * « Réessayer cette étape » du cas concret (tâche X12) : POST `{ travailId, accord? }` → `{ issue }` (toujours une issue
 * que l'écran dit : relancée, prix à confirmer, ou phrase de refus). Adresse fixe appelée par `fetch` : elle ne dépend ni
 * de la file des actions du routeur, ni de l'identifiant d'une action serveur qui change à chaque mise en ligne (une page
 * ouverte avant la mise en ligne garde l'ancien). Même origine seulement.
 */
export async function POST(requete: NextRequest) {
  if (!(await sessionApi())) return NextResponse.json({ erreur: "Connexion requise." }, { status: 401 });
  // Le cookie de session (SameSite=Lax) ne part pas d'un autre site ; l'origine est revérifiée par l'hôte (derrière le
  // proxy, l'adresse interne du serveur diffère de l'adresse publique).
  const origine = requete.headers.get("origin");
  const hote = requete.headers.get("x-forwarded-host") ?? requete.headers.get("host");
  if (origine && hote && hoteDe(origine) !== hote) return NextResponse.json({ erreur: "Origine refusée." }, { status: 403 });
  let corps: { travailId?: unknown; accord?: unknown };
  try {
    corps = (await requete.json()) as typeof corps;
  } catch {
    return NextResponse.json({ issue: { statut: "refusee", phrase: PHRASES_RELANCE.panne } }, { status: 400 });
  }
  const travailId = typeof corps.travailId === "string" ? corps.travailId : "";
  const accord = typeof corps.accord === "number" && Number.isFinite(corps.accord) ? corps.accord : corps.accord === true ? true : undefined;
  if (!travailId) return NextResponse.json({ issue: { statut: "refusee", phrase: PHRASES_RELANCE.introuvable } }, { status: 400 });
  const issue = await relancerEtapeCasConcret(travailId, accord);
  return NextResponse.json({ issue }, { headers: { "Cache-Control": "no-store" } });
}

function hoteDe(adresse: string): string | null {
  try {
    return new URL(adresse).host;
  } catch {
    return null;
  }
}
