/**
 * SCRIPT DU TUTORIEL D'OUTIL (lot I) : d'où vient le texte lu.
 *  1. script validé par Williams (après écriture) → tel quel ;
 *  2. script collé, ou texte de la commande sans idée → tel quel (le script de Williams fait foi) ;
 *  3. titre ou idée seuls → le studio ÉCRIT une proposition (Claude, fournisseur injecté : un double dans les tests) et
 *     s'arrête pour la relecture de Williams.
 * Aucun refus : un script hors des durées conseillées passe, avec une remarque.
 */
import type { RequeteClaude } from "@/fournisseurs/claude/client";
import type { AppelClaude } from "@/briques/plan-scenes/generateur";
import type { EntreesTutoriel } from "./entrees";

export const MODELE_SCRIPT_TUTORIEL = "claude-opus-5-5";
export const CODE_SCRIPT_A_VALIDER = "TO_SCRIPT_A_VALIDER";
export const PHRASE_SCRIPT_A_VALIDER = "Relisez le script, modifiez-le si besoin, puis validez : la vidéo se fabrique ensuite.";
export const CODE_SCRIPT_NON_ECRIT = "TO_SCRIPT_NON_ECRIT";
export const PHRASE_SCRIPT_NON_ECRIT = "Le script n'a pas pu être écrit pour l'instant : collez votre script, ou relancez plus tard. Rien n'a échoué.";

/** Mots par seconde de la voix (recette du format). */
export const MOTS_PAR_SECONDE = 2.6;

export type SourceScript = "valide" | "colle";

export type ScriptRetenu = { texte: string; source: SourceScript } | { aEcrire: string } | { vide: true };

/** Le script qui fait foi, ou l'idée à écrire. */
export function scriptRetenu(texteCommande: string | undefined, e: EntreesTutoriel): ScriptRetenu {
  if (e.scriptValide) return { texte: e.scriptValide, source: "valide" };
  const t = (texteCommande ?? "").trim();
  if (t && (e.scriptColle || !e.idee)) return { texte: t, source: "colle" };
  if (e.idee) return { aEcrire: e.idee };
  return { vide: true };
}

/** Remarques sur le script (jamais un refus) : durée estimée hors de la zone du format (30 à 75 s). */
export function remarquesScript(texte: string): string[] {
  const mots = texte.split(/\s+/).filter(Boolean).length;
  const sec = Math.round(mots / MOTS_PAR_SECONDE);
  if (sec < 30) return [`Script court (environ ${sec} s) : la vidéo sera brève.`];
  if (sec > 75) return [`Script long (environ ${sec} s) : au-delà de 75 s, l'attention baisse.`];
  return [];
}

export function requeteScript(idee: string): RequeteClaude {
  return {
    modele: MODELE_SCRIPT_TUTORIEL,
    maxTokens: 2000,
    effort: "medium",
    systeme: [
      {
        texte: [
          "Vous écrivez le script en voix off d'un TUTORIEL D'OUTIL Axion IA, en français, au vouvoiement.",
          "Une accroche (ce que l'outil permet, une phrase), puis un geste par phrase (où cliquer, quoi taper, ce qui s'affiche), puis le résultat en une phrase.",
          "45 à 60 secondes à l'oral (115 à 160 mots). Aucun prix, aucun chiffre inventé. Répondez par le script seul, sans titre ni commentaire.",
        ].join("\n"),
        cache: "1h",
      },
    ],
    messages: [{ role: "user", contenu: `Titre ou idée de Williams : ${idee}` }],
  };
}

/** Écrit une proposition de script ; `null` : rien d'utilisable (panne, réponse vide) — jamais d'exception. */
export async function ecrireScript(idee: string, appeler: AppelClaude): Promise<string | null> {
  try {
    const r = await appeler(requeteScript(idee));
    const t = r.texte.trim();
    return t.length >= 20 ? t : null;
  } catch {
    // Panne du fournisseur ou autre : la proposition n'est pas écrite, Williams peut coller son script.
    return null;
  }
}
