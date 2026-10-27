/**
 * CONTRÔLE EN DIRECT DU SCRIPT (écran « Relire le script », réglage `imageVideo.relireScript`). PUR et GRATUIT : les
 * MÊMES contrôles que `validerScriptIV` (`verifierScript`), sans rien garder ni dépenser, rendus en pastilles de l'écran
 * commun. Ce que `validerScriptIV` refuserait bloque ; ce que seul Will tranche (formule absolue sans choix) alerte.
 */
import { schemaFicheImage } from "@/domaine/image-video/fiche";
import { avecVersionsPrudentes } from "@/domaine/image-video/versions-prudentes";
import type { PastilleControle } from "@/domaine/relecture-script";
import type { EtatFabricationIV } from "./fabrication";
import { refusQuestion } from "./fins";
import { bloqueUnScriptColle } from "./script-colle";
import { verifierScript, type ChoixFormule } from "./regles";

export interface ScriptAControlerIV {
  fiche?: unknown;
  choixFormules?: Record<string, ChoixFormule>;
  ajoutsWill?: string[];
}

export function controlerScriptIV(etat: Pick<EtatFabricationIV, "etape" | "propositionScript" | "carte" | "demande" | "variete">, d: ScriptAControlerIV): PastilleControle[] {
  const p = etat.propositionScript;
  const carte = etat.carte?.carte;
  if (etat.etape !== "script-a-valider" || !p || !carte) return [];
  const lu = schemaFicheImage.safeParse(d.fiche ?? p.fiche);
  if (!lu.success) return [{ niveau: "bloquant", code: "script-incomplet", texte: "Le script modifié est incomplet : une phrase ou un écrit est vide." }];
  // Comme à la validation (le serveur pose la version prudente choisie) : on contrôle le texte qui sera vraiment gardé.
  const fiche = avecVersionsPrudentes(lu.data, d.choixFormules ?? {}) ?? lu.data;
  const verdict = verifierScript(fiche, { carte, choixFormules: d.choixFormules ?? {}, ajoutsWill: d.ajoutsWill ?? [], interdits: etat.demande.interdits ?? [], ...(etat.variete ? { recit: etat.variete.recette.recit } : {}) });
  const pastilles: PastilleControle[] = verdict.manquements.map((m) => ({ niveau: m.pourWill || (etat.demande.scriptColle && !bloqueUnScriptColle(m)) ? "alerte" : "bloquant", code: m.regle, ...(m.ecranId ? { ligneId: m.ecranId } : {}), texte: m.message }));
  if (etat.demande.appelCommentaire === "question-puis-fin") {
    const refus = refusQuestion(fiche.questionCommentaire.texteDit);
    if (refus) pastilles.push({ niveau: "bloquant", code: "question", ligneId: "question", texte: refus });
  }
  return pastilles;
}
