import type { NextRequest } from "next/server";
import { depots } from "@/donnees/memoire";
import { lireAValider } from "@/services/porte-validation";
import { garderPorte, reponseErreur, reponseJson } from "@/usine/garde-porte";

/**
 * Porte v2, appel 2 bis : ce que l'écran « À valider » de l'Usine montre pour une commande (créneau `cmd-<clé>` ou `prog-<clé>`).
 * LECTURE SEULE (POST parce que la porte exige un corps JSON `{ contrat: 2 }`) : aucune écriture, aucun envoi.
 * « Tout arrêter » ne bloque pas la lecture. Écrit en avance (empilé sur L5-02a).
 */
export const dynamic = "force-dynamic";

const ROUTE = "POST /api/usine/commandes/[id]/a-valider";

export async function POST(requete: NextRequest, contexte: { params: Promise<{ id: string }> }) {
  const porte = await garderPorte(requete, { route: ROUTE, champs: ["repere"] });
  if (!porte.ok) return porte.reponse;
  let statut = 200;
  try {
    const { id } = await contexte.params;
    const d = depots();
    const r = await lireAValider({ creneaux: d.creneauxEditoriaux, journal: d.journalDecalages }, id);
    if (!r.ok) {
      statut = r.http;
      return reponseErreur(r.http, r.message, r.code);
    }
    return reponseJson(200, r.corps);
  } catch {
    statut = 500;
    return reponseErreur(500, "Erreur du studio.", "erreur_interne");
  } finally {
    await porte.terminer(statut);
  }
}
