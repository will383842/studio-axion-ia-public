// Aiguillage d'un mot commenté : PUR.
//  · Personne opposée, ou commentaire « stop » / « arrêtez » : SILENCE (aucune réponse, aucun guide).
//  · Mot connu : sa réponse. Mot inconnu : il reçoit GUIDE (décision du 03/11/2026) si GUIDE est configuré.
//  · Liste illisible ou sans GUIDE : « À traiter », JAMAIS d'envoi.
import { estMotOpposition } from "./opposition";
import { RESEAUX_REPONSE_PUBLIQUE_SEULE, type Canal } from "./origine-v3";

export const MOT_PAR_DEFAUT = "GUIDE";
export type Decision =
  | { action: "reponse_publique"; motRetenu: string }
  | { action: "message_prive"; motRetenu: string }
  | { action: "silence"; motif: "personne_opposee" | "opposition" }
  | { action: "a_traiter"; motif: "mot_inconnu" };

/**
 * `mots` : liste des mots connus (majuscules), ou `null` si elle n'a pas pu être lue.
 * `opposee` : la personne s'est déjà opposée (l'appelant le sait par l'empreinte de son identifiant de contact).
 * LinkedIn et TikTok : réponse publique seule, même si le canal demandé est le message privé.
 */
export function decisionPourMot(e: { mot: string | null; reseau: string; canal: Canal; mots: readonly string[] | null; opposee?: boolean }): Decision {
  if (e.opposee) return { action: "silence", motif: "personne_opposee" };
  if (estMotOpposition(e.mot)) return { action: "silence", motif: "opposition" };
  const connus = e.mots?.map((m) => m.toUpperCase()) ?? [];
  const mot = e.mot?.trim().toUpperCase() ?? "";
  const retenu = mot && connus.includes(mot) ? mot : connus.includes(MOT_PAR_DEFAUT) ? MOT_PAR_DEFAUT : null;
  if (!retenu) return { action: "a_traiter", motif: "mot_inconnu" };
  if (e.canal === "message_prive" && !RESEAUX_REPONSE_PUBLIQUE_SEULE.includes(e.reseau)) return { action: "message_prive", motRetenu: retenu };
  return { action: "reponse_publique", motRetenu: retenu };
}
