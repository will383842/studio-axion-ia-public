import type { NextRequest } from "next/server";
import { RESEAUX_TAXONOMIE } from "@/domaine/taxonomie-contenu";
import type { IdReseau } from "@/domaine/types";
import { depots } from "@/donnees/memoire";
import { creerCreneau } from "@/services/plan-editorial";
import { ecrireParametre } from "@/services/_commun";
import { estOccupe } from "@/services/cadence";
import { heureAffichageParis } from "@/domaine/plan-editorial/statuts";
import { garderPorte, reponseErreur, reponseJson } from "@/usine/garde-porte";

/**
 * Porte v2, appel 1 : l'Usine envoie une commande (un créneau à proposer). La commande naît « propose » : le Studio ne
 * programme ni ne publie jamais d'ici, et rien ne part vers un réseau (aucun envoi). Le jeton est vérifié par `garderPorte`
 * (porte fermée tant que le secret du studio n'est pas posé).
 *
 *  - Rejeu : la clé d'idempotence `cle` donne l'identifiant du créneau ; la même clé ne crée jamais un second créneau.
 *  - Quota : au-delà de QUOTA_PAR_RESEAU_ET_JOUR créneaux occupés pour ce réseau et ce jour, la commande est MISE DE CÔTÉ
 *    (paramètre « usine-commande-cote:<cle> », aucun créneau) pour être débloquée d'un clic par le fondateur.
 *  - « Tout arrêter » (U-ARRET, dépôt usine, pas encore fusionné) : tant que son contrat n'est pas là, l'état est lu dans
 *    `USINE_TOUT_ARRETER`. Vide, 0, false ou non : éteint ; toute autre valeur : actif (dans le doute, on arrête). Actif : 423, rien n'est écrit.
 */
export const dynamic = "force-dynamic";

const ROUTE = "POST /api/usine/commandes";
const RESEAUX: ReadonlySet<string> = new Set(RESEAUX_TAXONOMIE);
/** Valeur de départ, à confirmer par le fondateur. */
export const QUOTA_PAR_RESEAU_ET_JOUR = 1;
const PREFIXE_COTE = "usine-commande-cote:";
const CLE_VALIDE = /^[A-Za-z0-9._:-]{8,100}$/;
const INSTANT_UTC = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?Z$/;
const NOM_COURT = /^[A-Za-z0-9._:-]{1,100}$/;

function toutArreterActif(): boolean {
  const v = (process.env.USINE_TOUT_ARRETER ?? "").trim().toLowerCase();
  return !["", "0", "false", "non"].includes(v);
}

export async function POST(requete: NextRequest) {
  const porte = await garderPorte(requete, { route: ROUTE, champs: ["cle", "reseau", "jour", "instant", "compteCible", "videoId", "visuelId", "repere"] });
  if (!porte.ok) return porte.reponse;
  let statut = 200;
  try {
    // « Tout arrêter » passe avant tout : rien n'est lu ni écrit.
    if (toutArreterActif()) {
      statut = 423;
      return reponseErreur(423, "Tout est arrêté : la commande est refusée.", "tout_arrete");
    }
    const { cle, reseau, jour, instant, compteCible, videoId, visuelId, repere } = porte.corps;
    const refus = (message: string) => {
      statut = 400;
      return reponseErreur(400, `Champ invalide : ${message}`, "champ_invalide");
    };
    if (typeof cle !== "string" || !CLE_VALIDE.test(cle)) return refus("cle (8 à 100 caractères simples).");
    if (typeof reseau !== "string" || !RESEAUX.has(reseau)) return refus("réseau inconnu.");
    if (typeof jour !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(jour) || new Date(`${jour}T00:00:00Z`).toISOString().slice(0, 10) !== jour) return refus("jour doit être AAAA-MM-JJ.");
    if (typeof instant !== "string" || !INSTANT_UTC.test(instant) || Number.isNaN(Date.parse(instant))) return refus("instant doit être un instant ISO en UTC.");
    if (typeof compteCible !== "string" || !NOM_COURT.test(compteCible)) return refus("compteCible.");
    for (const [nom, v] of [["videoId", videoId], ["visuelId", visuelId], ["repere", repere]] as const) if (v !== undefined && (typeof v !== "string" || !NOM_COURT.test(v))) return refus(`${nom}.`);
    if (videoId !== undefined && visuelId !== undefined) return refus("une vidéo ou un visuel, pas les deux.");
    const video = videoId as string | undefined;
    const visuel = visuelId as string | undefined;
    const repereUsine = repere as string | undefined;

    const d = depots();
    const id = `cmd-${cle}`;
    const existant = await d.creneauxEditoriaux.obtenir(id);
    if (existant) return reponseJson(200, { etat: "recue", deja: true });
    const cote = await d.parametres.obtenir(`${PREFIXE_COTE}${cle}`);
    if (cote) return reponseJson(200, { etat: "mise_de_cote", deja: true });

    const pris = await d.creneauxEditoriaux.lister((c) => c.jourVise === jour && estOccupe(c) && Boolean(c.heuresParReseau[reseau as IdReseau]));
    if (pris.length >= QUOTA_PAR_RESEAU_ET_JOUR) {
      await ecrireParametre(`${PREFIXE_COTE}${cle}`, { cle, reseau, jour, instant, compteCible, videoId: video, visuelId: visuel, repere: repereUsine, heure: heureAffichageParis(instant) });
      statut = 202;
      return reponseJson(202, { etat: "mise_de_cote", deja: false });
    }
    await creerCreneau(
      { creneaux: d.creneauxEditoriaux, journal: d.journalDecalages },
      { id, jourVise: jour, heuresParReseau: { [reseau]: instant }, compteCible, origine: "usine", ...(repereUsine ? { repereUsine } : {}), ...(video ? { videoId: video } : {}), ...(visuel ? { visuelId: visuel } : {}) },
      new Date().toISOString(),
    );
    statut = 201;
    return reponseJson(201, { etat: "recue", deja: false });
  } catch {
    statut = 500;
    return reponseErreur(500, "Erreur du studio.", "erreur_interne");
  } finally {
    await porte.terminer(statut);
  }
}
