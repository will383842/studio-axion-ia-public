/**
 * G8-OBS-v21r — le branchement RÉEL de Claude sur le chat de retouche côté serveur (SENSIBLE ARGENT, ÉTEINT trois fois :
 * aucun appelant, chaque clé de lecteur n'allume que par `true` exact, et le chat de chaque générateur est lui-même éteint).
 * UN seul assembleur : réglage (lu ici, une seule fois), appel facturé (`appelClaudeChat`), barrière dure AVANT tout appel
 * (`appelSousBarriere` + `sousPlafond`, même en budget « indicatif »), compteur de lectures par vidéo (`lecturesRestantes`).
 * Aucune écriture de réglage, aucun montant dans une phrase. Appelants prévus : la route (S-05-b), le tableau (S-06-b).
 */
import "server-only";
import type { Id } from "@/domaine/types";
import { depots, lireParametre } from "../_commun";
import { engagePlafondPropreCentimes, valeurPlafondPropre } from "../depense-claude-video";
import { appelClaudeChat, ETAPE_LECTURE_CHAT, pireCasLectureUsd, plafondPropreChat, PREFIXE_APPEL_CHAT } from "./appel-claude-chat";
import { avecLecteurCommun, CLES_REGLAGE_LECTEUR, portsLecteurGenerateur } from "./lecteur-generateurs";
import type { PortsLecteur } from "./lecteur-demande";
import { appelSousBarriere, lecturesRestantes, sousPlafond } from "./plafond-lectures";
import type { PortsRetoucheChat } from "./service";

/** Réglage (éteint par défaut) de la lecture par Claude du chat du tableau (S-06-b). */
export const CLE_REGLAGE_LECTEUR_TABLEAU = "retoucheChat.tableauLecteur";

/** La SEULE lecture de réglage du fichier : vrai seulement pour `true` exact ; une lecture en échec vaut « non ». */
async function reglageAllume(cle: string): Promise<boolean> {
  try {
    return (await lireParametre<unknown>(cle, false)) === true;
  } catch {
    return false;
  }
}

/** Ports du lecteur pour une vidéo : un compteur et un plafond COMMUNS à tous les chats de la vidéo (préfixe « rtcht »). */
export function portsLecteurStudio(cle: string | undefined, generateur: string | undefined, videoId: Id): PortsLecteur {
  const restantes = () =>
    lecturesRestantes(videoId, {
      etape: ETAPE_LECTURE_CHAT,
      prefixeAppel: PREFIXE_APPEL_CHAT,
      lireDepenses: (v) => depots().depenses.lister((x) => x.videoId === v),
      lireReservationsActives: (v) => depots().reservations.lister((r) => r.videoId === v && r.statut === "active"),
    });
  const plafond = plafondPropreChat() as Parameters<typeof valeurPlafondPropre>[0];
  const verifier = async (requete: Parameters<PortsLecteur["appeler"]>[0]) =>
    sousPlafond({
      engageCentimes: await engagePlafondPropreCentimes(videoId, plafond),
      plafondUsd: await valeurPlafondPropre(plafond),
      pireUsd: pireCasLectureUsd(requete),
    });
  const appeler: PortsLecteur["appeler"] = async (requete) => appelSousBarriere(await appelClaudeChat(videoId), verifier)(requete);
  if (generateur !== undefined && Object.hasOwn(CLES_REGLAGE_LECTEUR, generateur)) {
    return portsLecteurGenerateur(generateur, { appeler, lire: async (c) => reglageAllume(c), lecturesRestantes: restantes });
  }
  return { appeler, claudeAllume: async () => cle !== undefined && (await reglageAllume(cle)), lecturesRestantes: restantes };
}

/**
 * Générateur sans clé de lecteur : le MÊME objet `ports` (aucun réglage lu, aucun dépôt lu). Clé éteinte (tout sauf `true`) :
 * le MÊME objet aussi (éteint = identique, phrases comprises) ; allumée : les ports reçoivent le lecteur commun.
 */
export async function avecLecteurStudio(generateur: string, videoId: Id, ports: PortsRetoucheChat): Promise<PortsRetoucheChat> {
  if (!Object.hasOwn(CLES_REGLAGE_LECTEUR, generateur)) return ports;
  const cle = CLES_REGLAGE_LECTEUR[generateur];
  if (!(await reglageAllume(cle))) return ports;
  return avecLecteurCommun(generateur, ports, portsLecteurStudio(cle, generateur, videoId));
}

/** Lecteur du chat du tableau (pour S-06-b) : même compteur et même plafond que le chat de la vidéo. */
export function portsLecteurTableauStudio(videoId: Id): PortsLecteur {
  return portsLecteurStudio(CLE_REGLAGE_LECTEUR_TABLEAU, undefined, videoId);
}
