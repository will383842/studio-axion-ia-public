import type { NextRequest } from "next/server";
import type { EtatInterne } from "@/domaine/plan-editorial/statuts";
import { etatInterne } from "@/domaine/plan-editorial/statuts";
import { depots } from "@/donnees/memoire";
import { garderPorte, reponseErreur, reponseJson } from "@/usine/garde-porte";

/**
 * Porte v2, appel 2 : l'Usine lit l'état d'une commande envoyée par l'appel 1 (l'identifiant de l'adresse est la clé
 * d'idempotence de la commande). LECTURE SEULE (POST parce que la porte exige un corps JSON `{ contrat: 2 }`) : aucune
 * écriture, aucun envoi. La réponse ne garde que l'état et les dates : ni texte de publication, ni compte, ni média, ni motif de refus,
 * ni donnée de personne. Le jeton est vérifié par `garderPorte` (porte fermée par défaut). Commande inconnue : 404 « introuvable ».
 * « Tout arrêter » ne bloque pas la lecture : lire n'écrit rien.
 */
export const dynamic = "force-dynamic";

const ROUTE = "POST /api/usine/commandes/[id]";
const PREFIXE_COTE = "usine-commande-cote:";
const CLE_VALIDE = /^[A-Za-z0-9._:-]{8,100}$/;

/** États rendus à l'Usine. Les six premiers sont ceux de la fiche ; les trois derniers couvrent le reste du cycle de vie. */
type EtatCommande = "recue" | "mise_de_cote" | "a_valider" | "programmee" | "publiee" | "refusee" | "echec" | "manquee" | "archivee";

function etatCommande(interne: EtatInterne | null): EtatCommande {
  switch (interne) {
    case "propose":
      return "recue";
    // Validée par le fondateur mais pas encore programmée : encore « à valider » côté Usine (pas de septième état dans le contrat).
    case "a_valider":
    case "valide":
      return "a_valider";
    case "programme":
      return "programmee";
    case "publie":
      return "publiee";
    case "refusee":
      return "refusee";
    case "echec":
      return "echec";
    case "manquee":
      return "manquee";
    case "archive":
    default:
      return "archivee";
  }
}

const introuvable = () => reponseErreur(404, "Commande introuvable.", "introuvable");

export async function POST(requete: NextRequest, contexte: { params: Promise<{ id: string }> }) {
  const porte = await garderPorte(requete, { route: ROUTE, champs: ["repere"] });
  if (!porte.ok) return porte.reponse;
  let statut = 200;
  try {
    const { id: cle } = await contexte.params;
    if (!CLE_VALIDE.test(cle)) {
      statut = 404;
      return introuvable();
    }
    const d = depots();
    const creneau = await d.creneauxEditoriaux.obtenir(`cmd-${cle}`);
    if (creneau) {
      const instants = Object.values(creneau.heuresParReseau).filter((h): h is string => typeof h === "string");
      return reponseJson(200, {
        etat: etatCommande(etatInterne(creneau, new Date())),
        jour: creneau.jourVise,
        ...(instants[0] ? { instant: instants[0] } : {}),
        ...(creneau.valideeLe ? { valideeLe: creneau.valideeLe } : {}),
        ...(creneau.refuseLe ? { refuseLe: creneau.refuseLe } : {}),
      });
    }
    const cote = await d.parametres.obtenir(`${PREFIXE_COTE}${cle}`);
    if (cote) {
      const v = cote.valeur as { jour?: unknown; instant?: unknown } | null;
      return reponseJson(200, {
        etat: "mise_de_cote" satisfies EtatCommande,
        ...(typeof v?.jour === "string" ? { jour: v.jour } : {}),
        ...(typeof v?.instant === "string" ? { instant: v.instant } : {}),
      });
    }
    statut = 404;
    return introuvable();
  } catch {
    statut = 500;
    return reponseErreur(500, "Erreur du studio.", "erreur_interne");
  } finally {
    await porte.terminer(statut);
  }
}
