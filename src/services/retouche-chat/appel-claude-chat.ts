/**
 * S2-07 : l'appel Claude du chat de retouche pour UNE vidéo, par le SEUL chemin facturé (`executerRolePourVideo` :
 * réservation, coût réel écrit, plafond propre par vidéo). ÉTEINT par construction : aucun importeur.
 * Aucun appel direct à Claude, aucun second essai, aucun montant dans une phrase.
 */
import "server-only";
import type { AppelClaude } from "@/briques/plan-scenes/generateur";
import type { CommandeFabrication, Id } from "@/domaine/types";
import { ErreurClaude, type RequeteClaude, type ReponseClaude } from "@/fournisseurs/claude/client";
import { pireCasRequete, type DefinitionRole, type EntreeRole } from "@/generateur/roles/types";
import type { executerRolePourVideo } from "../depense-claude-video";

export const ETAPE_LECTURE_CHAT = "Retouche chat · lecture";
export const PARAM_PLAFOND_LECTURE_CHAT = "retoucheChat.plafondLectureUsd";
/** 3 lectures par vidéo (décision n° 1, STRATEGIE-CLAUDE.md:230) × 9 centimes : borne haute acceptée par Williams le 20/11 ; valeur définitive : CHIFFRAGE-CHAT-RETOUCHE-20-11.md. */
export const PLAFOND_LECTURE_CHAT_USD = 0.27;
export const PREFIXE_APPEL_CHAT = "txtpub-rtcht-";
const PREFIXE_ETAPE_CHAT = "Retouche chat ·";

type PlafondPropre = Parameters<typeof executerRolePourVideo>[3]["plafondPropre"];

export function plafondPropreChat(): PlafondPropre {
  return { id: "rtcht", parametre: PARAM_PLAFOND_LECTURE_CHAT, defautUsd: PLAFOND_LECTURE_CHAT_USD, prefixeEtape: PREFIXE_ETAPE_CHAT } as unknown as PlafondPropre;
}

export function roleLectureChat(requete: RequeteClaude): DefinitionRole {
  return { id: "retouche-chat-lecture", version: 1, consigne: requete.systeme.map((b) => b.texte).join("\n\n"), modele: requete.modele, effort: requete.effort, maxTokens: requete.maxTokens, sansPhrasesFixes: true, simuler: () => "" } as unknown as DefinitionRole;
}

export function entreeLectureChat(requete: RequeteClaude): EntreeRole {
  return { contexte: {}, variable: requete.messages[0]?.contenu ?? "" };
}

/** Pire cas d'une lecture, en dollars, par la fonction commune (aucun prix recopié). */
export function pireCasLectureUsd(requete: RequeteClaude): number {
  return pireCasRequete(roleLectureChat(requete), entreeLectureChat(requete));
}

const PHRASE_ARRET: Record<string, string> = {
  "plafond-video": "La limite de cette vidéo pour la lecture des demandes est atteinte : rien n'a été payé.",
  "en-attente-credit": "Claude est en attente de crédit : rien n'a été payé.",
  "budget-usine": "La limite du mois est atteinte : rien n'a été payé.",
  "bloquee-modele": "Ce modèle n'est pas autorisé pour l'instant : rien n'a été payé.",
  indisponible: "Claude n'est pas disponible pour l'instant : rien n'a été payé.",
};
const JETONS_VIDES: ReponseClaude["jetons"] = { entree: 0, cacheLu: 0, cacheEcrit: 0, sortie: 0 };

function appelQuiLeve(message: string): AppelClaude {
  return async () => {
    throw new ErreurClaude("requete", message);
  };
}

/** L'appel du lecteur pour une vidéo. Vidéo ou version introuvable : un appel qui lève, jamais d'appel Claude. */
export async function appelClaudeChat(
  videoId: Id,
  deps: { origine?: (videoId: Id) => Promise<CommandeFabrication["origine"] | null | undefined>; executer?: typeof executerRolePourVideo } = {},
): Promise<AppelClaude> {
  let origine: CommandeFabrication["origine"] | null | undefined = null;
  let trouvee = false;
  try {
    if (deps.origine) {
      origine = await deps.origine(videoId);
      trouvee = origine !== null;
    } else {
      const { depots } = await import("../_commun");
      const video = await depots().videos.obtenir(videoId);
      const version = video?.versionChoisieId ? await depots().versions.obtenir(video.versionChoisieId) : null;
      trouvee = !!version;
      origine = version?.commande?.origine;
    }
  } catch {
    trouvee = false;
  }
  if (!trouvee) return appelQuiLeve("La lecture de cette demande n'est pas disponible pour cette vidéo.");
  return async (requete) => {
    const executer = deps.executer ?? (await import("../depense-claude-video")).executerRolePourVideo;
    const r = await executer(videoId, roleLectureChat(requete), entreeLectureChat(requete), { etape: ETAPE_LECTURE_CHAT, plafondPropre: plafondPropreChat(), origine: origine ?? undefined });
    if (!r.ok) throw new ErreurClaude("requete", PHRASE_ARRET[r.arret] ?? "Claude n'a pas été appelé : rien n'a été payé.");
    if (r.simule || !r.texte?.trim()) throw new ErreurClaude("requete", "Claude n'est pas choisi pour les textes : aucune lecture.");
    return { texte: r.texte, modeleDemande: requete.modele, modele: r.modele, replis: [], stopReason: r.stopReason ?? null, jetons: r.jetons ?? JETONS_VIDES };
  };
}
