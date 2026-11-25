/**
 * G12-09b-b : écrit la valeur SYNCHRONE lue par le moteur « face caméra animée » v4 (`CLE_RETOUCHE_GRATUITE_FA`) à partir du réglage
 * `retoucheChat.facecamAnimee`. Éteint par défaut : seul `true` exact allume, une lecture qui lève éteint. Relu avant chaque chemin de
 * retouche (crochet `preparerReglagesMoteur`), seulement pour une commande de ce moteur.
 */
import "server-only";
import type { CommandeFabrication } from "@/domaine/types";
import { CLE_PLAQUETTES_FA, CLE_RETOUCHE_EXTRAITS_FA, CLE_RETOUCHE_GRATUITE_FA, ID_MOTEUR_FACECAM_ANIMEE } from "@/moteurs/montage-facecam-animee";
import { retoucheChatActif, type LireReglage } from "./retouche-chat/generateurs";
import { lireParametre } from "./_commun";

export async function actualiserRetoucheGratuiteFA(lire: LireReglage = lireParametre): Promise<void> {
  (globalThis as Record<symbol, unknown>)[CLE_RETOUCHE_GRATUITE_FA] = await retoucheChatActif("facecam-animee", lire);
}

/** R4-03-c2 : réglage « changer un extrait » (éteint par défaut) ; seul `true` exact allume, une lecture qui lève éteint. */
export const PARAM_RETOUCHE_EXTRAITS_FA = "retoucheChat.facecamAnimeeExtraits";
export async function actualiserRetoucheExtraitsFA(lire: LireReglage = lireParametre): Promise<void> {
  (globalThis as Record<symbol, unknown>)[CLE_RETOUCHE_EXTRAITS_FA] = (await Promise.resolve().then(() => lire(PARAM_RETOUCHE_EXTRAITS_FA, false)).catch(() => false)) === true;
}

/** S-15-b3 : réglage « demandes du chat sur les plaquettes » (éteint par défaut) ; seul `true` exact allume, une lecture qui lève éteint. */
export const PARAM_PLAQUETTES_FA = "retoucheChat.facecamAnimeePlaquettes";
export async function actualiserPlaquettesFA(lire: LireReglage = lireParametre): Promise<void> {
  (globalThis as Record<symbol, unknown>)[CLE_PLAQUETTES_FA] = (await Promise.resolve().then(() => lire(PARAM_PLAQUETTES_FA, false)).catch(() => false)) === true;
}

export async function preparerRetoucheGratuiteFA(commande: Pick<CommandeFabrication, "moteurId">): Promise<void> {
  if (commande.moteurId === ID_MOTEUR_FACECAM_ANIMEE) { await actualiserRetoucheGratuiteFA(); await actualiserRetoucheExtraitsFA(); }
  if (commande.moteurId === ID_MOTEUR_FACECAM_ANIMEE) await actualiserPlaquettesFA(); // S-15-b3
}
