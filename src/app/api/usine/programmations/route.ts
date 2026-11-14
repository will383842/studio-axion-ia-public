import type { NextRequest } from "next/server";
import { RESEAUX_TAXONOMIE } from "@/domaine/taxonomie-contenu";
import type { IdReseau } from "@/domaine/types";
import { depots } from "@/donnees/memoire";
import { recevoirProgrammation } from "@/services/porte-programmations";
import { garderPorte, reponseErreur, reponseJson } from "@/usine/garde-porte";

/**
 * Porte v2, appel 4 : l'Usine envoie une programmation (une date par défaut). L'entrée naît d'origine « usine » et reste
 * « a_valider » ; rien ne part chez le diffuseur (aucun envoi). La date choisie par le fondateur l'emporte. L'usine
 * n'écrit jamais de statut : tout champ de statut (ou de validation) est refusé par `garderPorte` (400 `champ_invalide`).
 * Le jeton est vérifié par `garderPorte`. Rejeu : la même clé ne crée jamais une seconde entrée.
 */
export const dynamic = "force-dynamic";

const ROUTE = "POST /api/usine/programmations";
const RESEAUX: ReadonlySet<string> = new Set(RESEAUX_TAXONOMIE);
const CLE_VALIDE = /^[A-Za-z0-9._:-]{8,100}$/;
const INSTANT_UTC = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?Z$/;
const NOM_COURT = /^[A-Za-z0-9._:-]{1,100}$/;

export async function POST(requete: NextRequest) {
  const porte = await garderPorte(requete, { route: ROUTE, champs: ["cle", "reseau", "jour", "instant", "compteCible", "videoId", "visuelId", "repere", "entreeId"] });
  if (!porte.ok) return porte.reponse;
  let statut = 200;
  try {
    const { cle, reseau, jour, instant, compteCible, videoId, visuelId, repere, entreeId } = porte.corps;
    const refus = (message: string) => {
      statut = 400;
      return reponseErreur(400, `Champ invalide : ${message}`, "champ_invalide");
    };
    if (typeof cle !== "string" || !CLE_VALIDE.test(cle)) return refus("cle (8 à 100 caractères simples).");
    if (typeof reseau !== "string" || !RESEAUX.has(reseau)) return refus("réseau inconnu.");
    if (typeof jour !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(jour) || new Date(`${jour}T00:00:00Z`).toISOString().slice(0, 10) !== jour) return refus("jour doit être AAAA-MM-JJ.");
    if (typeof instant !== "string" || !INSTANT_UTC.test(instant) || Number.isNaN(Date.parse(instant))) return refus("instant doit être un instant ISO en UTC.");
    if (typeof compteCible !== "string" || !NOM_COURT.test(compteCible)) return refus("compteCible.");
    for (const [nom, v] of [["videoId", videoId], ["visuelId", visuelId], ["repere", repere], ["entreeId", entreeId]] as const) if (v !== undefined && (typeof v !== "string" || !NOM_COURT.test(v))) return refus(`${nom}.`);
    if (videoId !== undefined && visuelId !== undefined) return refus("une vidéo ou un visuel, pas les deux.");

    const d = depots();
    const r = await recevoirProgrammation(
      { creneaux: d.creneauxEditoriaux, journal: d.journalDecalages },
      { cle, reseau: reseau as IdReseau, jour, instant, compteCible, videoId: videoId as string | undefined, visuelId: visuelId as string | undefined, repere: repere as string | undefined, entreeId: entreeId as string | undefined },
      new Date().toISOString(),
    );
    statut = r.etat === "recue" && !r.deja ? 201 : 200;
    return reponseJson(statut, r);
  } catch {
    statut = 500;
    return reponseErreur(500, "Erreur du studio.", "erreur_interne");
  } finally {
    await porte.terminer(statut);
  }
}
