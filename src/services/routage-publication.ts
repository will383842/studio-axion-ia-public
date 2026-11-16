/**
 * ROUTAGE DE LA PUBLICATION (lot Z2-S, D2) : quel outil (Buffer ou Zernio) porte un réseau, ou un compte d'un réseau.
 * Réglage `publication.routage` : { "<reseau>": outil, "<reseau>:<compteCode>": outil } ; la clé la plus précise gagne.
 * Défaut {} = Zernio partout (un « buffer » déjà enregistré reste lu). Sans clé du fournisseur choisi : refus clair, jamais un repli silencieux vers l'autre outil.
 * L0-13a : Buffer est résilié. Choisir « buffer » est refusé (`OUTIL_RETIRE`) ; un « buffer » déjà en base reste LU (jamais effacé,
 * jamais réécrit) mais est traité comme absent à l'envoi : le réseau part par le défaut Zernio, clé exigée.
 */
import "server-only";
import { OUTILS, OUTILS_ENVOI, outilPour, type OutilPublication, type RoutagePublication } from "@/domaine/outil-publication";
import type { IdReseau } from "@/domaine/types";
import { listerReseaux } from "@/reseaux";
import { ecrireParametre, ErreurStudio, journaliser, lireParametre } from "./_commun";
import { exigerSession } from "./auth";
import { cleZernioPresente } from "./zernio";

export const PARAM_ROUTAGE = "publication.routage";
const NOMS_OUTILS: Record<OutilPublication, string> = { buffer: "Buffer", zernio: "Zernio" };

/** Le routage en base ; une valeur illisible ou inconnue est ignorée (défaut : Zernio). */
export async function lireRoutage(): Promise<RoutagePublication> {
  const brut = await lireParametre<unknown>(PARAM_ROUTAGE, {});
  const propre: RoutagePublication = {};
  if (brut && typeof brut === "object" && !Array.isArray(brut)) {
    for (const [cle, valeur] of Object.entries(brut)) if ((OUTILS as readonly string[]).includes(valeur as string)) propre[cle] = valeur as string;
  }
  return propre;
}

/** `cle` : « reseau » ou « reseau:compteCode ». `outil` null : on retire la clé (retour au défaut). */
export async function definirRoutage(cle: string, outil: OutilPublication | null): Promise<RoutagePublication> {
  await exigerSession();
  const [reseau, compte, ...reste] = cle.split(":");
  if (reste.length || !listerReseaux().some((r) => r.id === reseau) || (compte !== undefined && !/^[A-Za-z0-9_-]{1,64}$/.test(compte))) {
    throw new ErreurStudio("RESEAU_INCONNU", "Réseau ou compte inconnu.");
  }
  if (outil !== null && !(OUTILS as readonly string[]).includes(outil)) throw new ErreurStudio("OUTIL_INCONNU", "Outil inconnu.");
  // L0-13a : refus avant toute lecture ou écriture du réglage.
  if (outil !== null && !(OUTILS_ENVOI as readonly string[]).includes(outil)) throw new ErreurStudio("OUTIL_RETIRE", "Buffer n'est plus utilisable pour envoyer : choisissez Zernio. Rien n'a été changé.");
  const actuel = await lireRoutage();
  const suivant = { ...actuel };
  if (outil === null) delete suivant[cle];
  else {
    if (outil === "zernio" && !cleZernioPresente()) throw refusOutil("zernio");
    suivant[cle] = outil;
  }
  await ecrireParametre(PARAM_ROUTAGE, suivant);
  await journaliser("reglages", outil ? `Publication : ${cle} part par ${NOMS_OUTILS[outil]}` : `Publication : ${cle} revient au réglage par défaut (Zernio)`);
  return suivant;
}

function refusOutil(outil: OutilPublication): ErreurStudio {
  return new ErreurStudio("ZERNIO_NON_RELIE", `${NOMS_OUTILS[outil]} n'est pas relié (clé absente) : l'envoi est refusé, aucun autre outil n'est utilisé à sa place.`);
}

/**
 * L'outil qui portera cet envoi : toujours Zernio (L0-13a). Une valeur « buffer » lue en base est traitée comme absente
 * (la clé moins précise ou le défaut s'appliquent) et n'est jamais réécrite. Sans clé Zernio : refus clair.
 */
export async function outilDeEnvoi(reseau: IdReseau, compte?: string | null): Promise<OutilPublication> {
  const t = await lireRoutage(); // une seule lecture du routage pour tout le calcul
  const sansBuffer: RoutagePublication = {};
  for (const [cle, valeur] of Object.entries(t)) if ((OUTILS_ENVOI as readonly string[]).includes(valeur)) sansBuffer[cle] = valeur;
  const outil = outilPour(sansBuffer, reseau, compte);
  if (!cleZernioPresente()) throw refusOutil("zernio");
  return outil;
}
