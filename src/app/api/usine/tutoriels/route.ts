import type { NextRequest } from "next/server";
import { CLE_TIRAGE_VALIDE, ID_ELEMENT_VALIDE } from "@/domaine/tutoriel-reserve";
import { tirerSuivantReserve } from "@/services/tutoriel-reserve-tirage";
import { garderPorte, reponseErreur, reponseJson } from "@/usine/garde-porte";

/**
 * Porte v2 · « prends dans la réserve de tutoriels » (plan PLAN-RESERVE-TUTORIELS-21-11, § 6). Le jeton est vérifié par
 * `garderPorte` (porte fermée par défaut). Corps : `{ cle, source: "reserve" }` (le suivant) OU `{ cle, reserveTutorielId }`
 * (celui-ci), plus `jour` et `repere` (informatifs). Le tirage est d'origine « usine » : interrupteur de la réserve, plafonds,
 * autonomie de l'usine, devis : tout reste dans `tirerSuivantReserve` (RES-3). Rien n'est publié d'ici.
 * La réponse ne contient que des identifiants et des états : jamais de titre, de nom de fichier, de phrase ni de montant.
 * « Tout arrêter » : 423, rien n'est lu ni écrit. `reserve_vide`, `attente` et `eteint` n'écrivent rien : la même clé se rejoue.
 */
export const dynamic = "force-dynamic";

const ROUTE = "POST /api/usine/tutoriels";
const PREFIXE_CLE = "usine-";
const JOUR = /^\d{4}-\d{2}-\d{2}$/;
const REPERE = /^[A-Za-z0-9._:-]{1,100}$/;

function toutArreterActif(): boolean {
  const v = (process.env.USINE_TOUT_ARRETER ?? "").trim().toLowerCase();
  return !["", "0", "false", "non"].includes(v);
}

export async function POST(requete: NextRequest) {
  const porte = await garderPorte(requete, { route: ROUTE, champs: ["cle", "source", "reserveTutorielId", "jour", "repere"] });
  if (!porte.ok) return porte.reponse;
  let statut = 200;
  try {
    if (toutArreterActif()) {
      statut = 423;
      return reponseErreur(423, "Tout est arrêté : le tirage est refusé.", "tout_arrete");
    }
    const { cle, source, reserveTutorielId, jour, repere } = porte.corps;
    const refus = (message: string) => {
      statut = 400;
      return reponseErreur(400, `Champ invalide : ${message}`, "champ_invalide");
    };
    // La clé du tirage est « usine-<cle> » : elle doit elle aussi rester dans la forme permise (100 caractères au plus).
    if (typeof cle !== "string" || !CLE_TIRAGE_VALIDE.test(cle) || !CLE_TIRAGE_VALIDE.test(PREFIXE_CLE + cle)) return refus("cle (8 à 94 caractères simples).");
    if (source !== undefined && source !== "reserve") return refus("source doit valoir « reserve ».");
    if (reserveTutorielId !== undefined && (typeof reserveTutorielId !== "string" || !ID_ELEMENT_VALIDE.test(reserveTutorielId))) return refus("reserveTutorielId.");
    if ((source === "reserve") === (reserveTutorielId !== undefined)) return refus("source « reserve » ou reserveTutorielId, l'un des deux, pas les deux.");
    if (jour !== undefined && (typeof jour !== "string" || !JOUR.test(jour) || Number.isNaN(Date.parse(`${jour}T00:00:00Z`)) || new Date(`${jour}T00:00:00Z`).toISOString().slice(0, 10) !== jour)) return refus("jour doit être AAAA-MM-JJ.");
    if (repere !== undefined && (typeof repere !== "string" || !REPERE.test(repere))) return refus("repere.");

    const issue = await tirerSuivantReserve({ declencheur: "usine", cle: PREFIXE_CLE + cle, ...(typeof reserveTutorielId === "string" ? { elementId: reserveTutorielId } : {}) });
    switch (issue.etat) {
      case "pris":
        return reponseJson(200, { etat: "pris", deja: issue.deja, elementId: issue.elementId, ...(issue.videoId ? { videoId: issue.videoId } : {}) });
      case "attente":
        return reponseJson(200, { etat: "attente", raison: issue.raison });
      case "echec":
        // Rejeu d'un tirage déjà tenté puis échoué : rien n'est repris sous cette clé (une autre clé fera un autre essai).
        return reponseJson(200, { etat: "echec", elementId: issue.elementId, retourEnReserve: issue.retourEnReserve });
      default:
        return reponseJson(200, { etat: issue.etat });
    }
  } catch {
    statut = 500;
    return reponseErreur(500, "Erreur du studio.", "erreur_interne");
  } finally {
    await porte.terminer(statut);
  }
}
