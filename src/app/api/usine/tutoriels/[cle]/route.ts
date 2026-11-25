import type { NextRequest } from "next/server";
import { CLE_TIRAGE_VALIDE } from "@/domaine/tutoriel-reserve";
import { lireElementReserve, lireTirageReserve } from "@/services/tutoriel-reserve";
import { garderPorte, reponseErreur, reponseJson } from "@/usine/garde-porte";

/**
 * Porte v2 · état d'un tirage de la réserve de tutoriels (plan PLAN-RESERVE-TUTORIELS-21-11, § 6). L'identifiant de l'adresse
 * est la `cle` envoyée à `POST /api/usine/tutoriels`. LECTURE SEULE (POST parce que la porte exige un corps JSON `{ contrat: 2 }`).
 * Réponse : `{ etat, elementId, videoId?, aValider }` ; `aValider: true` = la vidéo est prête et attend Williams. Ni titre, ni nom
 * de fichier, ni montant. Clé inconnue : 404. « Tout arrêter » ne bloque pas la lecture. Rien n'est publié d'ici.
 */
export const dynamic = "force-dynamic";

const ROUTE = "POST /api/usine/tutoriels/[cle]";
const introuvable = () => reponseErreur(404, "Tirage introuvable.", "introuvable");

export async function POST(requete: NextRequest, contexte: { params: Promise<{ cle: string }> }) {
  const porte = await garderPorte(requete, { route: ROUTE, champs: ["repere"] });
  if (!porte.ok) return porte.reponse;
  let statut = 200;
  try {
    // Next 16 : `params` est une promesse.
    const { cle } = await contexte.params;
    const cleTirage = `usine-${cle}`;
    if (!CLE_TIRAGE_VALIDE.test(cle) || !CLE_TIRAGE_VALIDE.test(cleTirage)) {
      statut = 404;
      return introuvable();
    }
    const tirage = await lireTirageReserve(cleTirage);
    if (!tirage) {
      statut = 404;
      return introuvable();
    }
    const element = await lireElementReserve(tirage.elementId);
    const courant = !!element && element.prise?.cle === cleTirage;
    const videoId = tirage.videoId ?? (courant ? element.prise?.videoId : undefined);
    let etat: "pris" | "fait" | "a_revoir" | "en_reserve";
    if (courant && element.etat === "pris") etat = "pris";
    else if (courant && element.etat === "fait") etat = "fait";
    else if (element && (element.etat === "a_revoir" || element.etat === "retire")) etat = "a_revoir";
    else if (!element && videoId) etat = "pris";
    else etat = "en_reserve"; // tirage échoué, élément revenu en réserve à sa place
    return reponseJson(200, { etat, elementId: tirage.elementId, ...(videoId ? { videoId } : {}), aValider: etat === "fait" });
  } catch {
    statut = 500;
    return reponseErreur(500, "Erreur du studio.", "erreur_interne");
  } finally {
    await porte.terminer(statut);
  }
}
