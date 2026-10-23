import { NextResponse, type NextRequest } from "next/server";
import { ErreurStudio } from "@/services/_commun";
import { sessionApi } from "@/services/auth";
import { commencerEnvoi, morceauxRecus, signerMorceaux, terminerEnvoi, type DescriptifEnvoi } from "@/services/envois";

export const dynamic = "force-dynamic";

/**
 * Envoi par morceaux (lot M1b) : le studio SIGNE, le navigateur envoie les octets directement au seau R2.
 * Actions : « commencer », « signer » (adresses des morceaux), « recus » (reprise), « terminer ».
 * Session exigée ; seules des clés `studio/{env}/…` créées par le studio sont signées.
 */
export async function POST(requete: NextRequest) {
  if (!(await sessionApi())) return NextResponse.json({ erreur: "Connexion requise." }, { status: 401 });
  let corps: Record<string, unknown>;
  try {
    corps = (await requete.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ erreur: "Demande illisible." }, { status: 400 });
  }
  const descriptif = (): DescriptifEnvoi => ({ nom: String(corps.nom ?? ""), mime: String(corps.mime ?? ""), taille: Number(corps.taille), typeEntite: String(corps.typeEntite ?? ""), entiteId: String(corps.entiteId ?? "") });
  try {
    switch (corps.action) {
      case "commencer":
        return repondre(await commencerEnvoi(descriptif()));
      case "signer": {
        const adresses = await signerMorceaux(corps.cle, corps.idEnvoi, corps.numeros);
        return repondre({ adresses });
      }
      case "recus":
        return repondre({ morceaux: await morceauxRecus(corps.cle, corps.idEnvoi) });
      case "terminer": {
        const f = await terminerEnvoi({ ...descriptif(), fichierId: String(corps.fichierId ?? ""), cle: corps.cle, idEnvoi: corps.idEnvoi, morceaux: corps.morceaux });
        return repondre({ fichierId: f.id, statut: f.statut });
      }
      default:
        return NextResponse.json({ erreur: "Action inconnue." }, { status: 400 });
    }
  } catch (e) {
    if (e instanceof ErreurStudio) return NextResponse.json({ erreur: e.message, code: e.code }, { status: 400 });
    console.error("[studio] envoi par morceaux", e);
    return NextResponse.json({ erreur: "Le stockage ne répond pas. Réessayez dans un instant." }, { status: 502 });
  }
}

function repondre(donnees: object) {
  return NextResponse.json(donnees, { headers: { "Cache-Control": "no-store" } });
}
