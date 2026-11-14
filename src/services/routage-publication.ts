/**
 * ROUTAGE DE LA PUBLICATION (lot Z2-S, D2) : quel outil (Buffer ou Zernio) porte un réseau, ou un compte d'un réseau.
 * Réglage `publication.routage` : { "<reseau>": outil, "<reseau>:<compteCode>": outil } ; la clé la plus précise gagne.
 * Défaut {} = Zernio partout (un « buffer » déjà enregistré reste lu). Sans clé du fournisseur choisi : refus clair, jamais un repli silencieux vers l'autre outil.
 * La bascule se fait réseau par réseau ; le retour à Buffer tient en un geste (on retire la clé ou on la met à « buffer »).
 */
import "server-only";
import { OUTILS, outilPour, type OutilPublication, type RoutagePublication } from "@/domaine/outil-publication";
import type { IdReseau } from "@/domaine/types";
import { fournisseurParId } from "@/fournisseurs";
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
  const actuel = await lireRoutage();
  const suivant = { ...actuel };
  if (outil === null) delete suivant[cle];
  else {
    if (outil === "zernio" && !cleZernioPresente()) throw refusOutil("zernio");
    // Choix explicite de Buffer sans sa clé : même refus clair que pour Zernio (finitions Z2-S). Le retour au défaut (null) reste libre.
    if (outil === "buffer" && !bufferRelie()) throw refusOutil("buffer");
    suivant[cle] = outil;
  }
  await ecrireParametre(PARAM_ROUTAGE, suivant);
  await journaliser("reglages", outil ? `Publication : ${cle} part par ${NOMS_OUTILS[outil]}` : `Publication : ${cle} revient au réglage par défaut (Zernio)`);
  return suivant;
}

function bufferRelie(): boolean {
  try {
    fournisseurParId("publication", "buffer");
    return true;
  } catch {
    return false;
  }
}

function refusOutil(outil: OutilPublication): ErreurStudio {
  return new ErreurStudio(outil === "zernio" ? "ZERNIO_NON_RELIE" : "BUFFER_NON_RELIE", `${NOMS_OUTILS[outil]} n'est pas relié (clé absente) : l'envoi est refusé, aucun autre outil n'est utilisé à sa place.`);
}

/**
 * L'outil qui portera cet envoi. Buffer : le fournisseur « buffer » doit être inscrit (clé posée) ; Zernio : sa clé
 * doit exister. Sinon refus clair : jamais l'autre outil à sa place.
 */
export async function outilDeEnvoi(reseau: IdReseau, compte?: string | null): Promise<OutilPublication> {
  const t = await lireRoutage(); // une seule lecture du routage pour tout le calcul
  const outil = outilPour(t, reseau, compte);
  if (outil === "zernio") {
    if (!cleZernioPresente()) throw refusOutil("zernio");
    return outil;
  }
  // Seul un « buffer » déjà enregistré mène ici : clé exigée, jamais de repli silencieux.
  const explicite = [compte ? `${reseau}:${compte}` : null, reseau].some((c) => !!c && Object.hasOwn(t, c) && t[c] === "buffer");
  if (explicite && !bufferRelie()) throw refusOutil("buffer");
  return outil;
}
