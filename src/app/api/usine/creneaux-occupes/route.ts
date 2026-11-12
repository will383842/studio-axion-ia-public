import type { NextRequest } from "next/server";
import { depots } from "@/donnees/memoire";
import { creneauxOccupes } from "@/services/cadence";
import { garderPorte, reponseErreur, reponseJson } from "@/usine/garde-porte";

/**
 * Porte v2 : l'Usine lit les créneaux déjà pris (programmés, à valider, validés, ajoutés à la main ; pas les archivés) pour ne pas
 * proposer une date occupée. LECTURE SEULE (POST parce que la porte exige un corps JSON) : aucune écriture. La réponse ne garde que
 * réseau, jour et heure : ni identifiant, ni texte, ni titre, ni donnée de personne. Le jeton est vérifié par `garderPorte`.
 */
export const dynamic = "force-dynamic";

const ROUTE = "POST /api/usine/creneaux-occupes";
const RESEAUX = new Set(["linkedin", "instagram", "facebook", "tiktok", "youtube", "youtube-shorts"]);
const JOURS_MAX = 400;

function jourValide(v: unknown): v is string {
  if (typeof v !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return false;
  const d = new Date(`${v}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === v;
}

export async function POST(requete: NextRequest) {
  const porte = await garderPorte(requete, { route: ROUTE, champs: ["du", "au", "reseau", "repere"] });
  if (!porte.ok) return porte.reponse;
  let statut = 200;
  try {
    const { du, au, reseau } = porte.corps;
    const refus = (message: string) => {
      statut = 400;
      return reponseErreur(400, `Champ invalide : ${message}`, "champ_invalide");
    };
    if (!jourValide(du)) return refus("du doit être un jour AAAA-MM-JJ.");
    if (!jourValide(au)) return refus("au doit être un jour AAAA-MM-JJ.");
    if (du > au) return refus("du doit précéder au.");
    if ((Date.parse(`${au}T00:00:00Z`) - Date.parse(`${du}T00:00:00Z`)) / 86_400_000 > JOURS_MAX) return refus(`la période ne dépasse pas ${JOURS_MAX} jours.`);
    if (reseau !== undefined && (typeof reseau !== "string" || !RESEAUX.has(reseau))) return refus("réseau inconnu.");
    const occupes = await creneauxOccupes(depots().creneauxEditoriaux, du, au, { reseau: reseau as string | undefined });
    return reponseJson(200, { creneaux: occupes.map((o) => ({ reseau: o.reseau, jour: o.jour, heure: o.heure })) });
  } catch {
    statut = 500;
    return reponseErreur(500, "Erreur du studio.", "erreur_interne");
  } finally {
    await porte.terminer(statut);
  }
}
