/**
 * G12-09b-b : écrit la valeur SYNCHRONE lue par le moteur « face caméra animée » v4 (`CLE_RETOUCHE_GRATUITE_FA`) à partir du réglage
 * `retoucheChat.facecamAnimee`. Éteint par défaut : seul `true` exact allume, une lecture qui lève éteint. Relu avant chaque chemin de
 * retouche (crochet `preparerReglagesMoteur`), seulement pour une commande de ce moteur.
 */
import "server-only";
import type { CommandeFabrication } from "@/domaine/types";
import { CLE_RETOUCHE_GRATUITE_FA, ID_MOTEUR_FACECAM_ANIMEE } from "@/moteurs/montage-facecam-animee";
import { retoucheChatActif, type LireReglage } from "./retouche-chat/generateurs";
import { lireParametre } from "./_commun";

export async function actualiserRetoucheGratuiteFA(lire: LireReglage = lireParametre): Promise<void> {
  (globalThis as Record<symbol, unknown>)[CLE_RETOUCHE_GRATUITE_FA] = await retoucheChatActif("facecam-animee", lire);
}

export async function preparerRetoucheGratuiteFA(commande: Pick<CommandeFabrication, "moteurId">): Promise<void> {
  if (commande.moteurId === ID_MOTEUR_FACECAM_ANIMEE) await actualiserRetoucheGratuiteFA();
}
