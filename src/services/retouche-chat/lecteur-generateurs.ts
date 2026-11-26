/**
 * S-05-a-v20k — le lecteur commun par générateur (SENSIBLE ARGENT ; ALLUMER-LECTEUR-CHAT-v20k : chaque réglage absent = allumé, seul `false` éteint).
 * Pur : le réglage et le compteur de lectures sont INJECTÉS ; aucune lecture de base ici. Règles d'abord, au plus UN appel (`lireDemande`).
 */
import { appelPourGenerateur, estGenerateurRetouche, type LireReglage } from "./generateurs";
import { creerLecteur, type PortsLecteur } from "./lecteur-demande";
import type { PortsRetoucheChat } from "./service";

/** Réglage de la lecture par Claude, par générateur : ALLUMÉ par défaut (ALLUMER-LECTEUR-CHAT-v20k, Williams 20/11 23:55), seul `false` éteint. Absents volontairement : avocat, image-video (« plus tard »), tutoriel-outil (clé de will-97), video-longue (session vl/), tableau (S-06). */
export const CLES_REGLAGE_LECTEUR: Readonly<Record<string, string>> = {
  "facecam-animee": "retoucheChat.facecamAnimeeLecteur",
  "demo-facecam": "retoucheChat.demoFacecamLecteur",
};

/** Vrai si le générateur a une clé ET que le réglage vaut `true` (absent = `true`) ; `false`, toute autre valeur écrite ou une lecture en échec : faux. */
export async function lecteurClaudeActif(generateur: string, lire: LireReglage): Promise<boolean> {
  const cle = Object.hasOwn(CLES_REGLAGE_LECTEUR, generateur) ? CLES_REGLAGE_LECTEUR[generateur] : undefined;
  if (!cle) return false;
  try {
    return (await lire(cle, true)) === true;
  } catch {
    return false;
  }
}

/** Ports du lecteur : `lecturesRestantes` est OBLIGATOIRE (pas de lecteur sans compteur). */
export function portsLecteurGenerateur(generateur: string, e: { appeler: PortsLecteur["appeler"]; lire: LireReglage; lecturesRestantes: () => Promise<number> }): PortsLecteur {
  return {
    appeler: estGenerateurRetouche(generateur) ? appelPourGenerateur(generateur, e.appeler) : e.appeler,
    claudeAllume: () => lecteurClaudeActif(generateur, e.lire),
    lecturesRestantes: e.lecturesRestantes,
  };
}

/** Générateur sans clé : le MÊME objet de ports ; sinon les ports reçoivent le lecteur commun (sans supplément). */
export function avecLecteurCommun(generateur: string, ports: PortsRetoucheChat, portsLecteur: PortsLecteur): PortsRetoucheChat {
  if (!Object.hasOwn(CLES_REGLAGE_LECTEUR, generateur)) return ports;
  return { ...ports, lecteur: creerLecteur(undefined, portsLecteur) };
}
