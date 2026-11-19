"use server";

/**
 * Actions serveur du tutoriel d'outil (T-EXT-33) : enveloppes du dépôt ET des gestes de validation (T-EXT-24 les importe
 * et n'en crée aucune). Même modèle que « Image → vidéo » : un Resultat sérialisable, la session vérifiée par le service.
 * CHAQUE action commence par la garde `exigerTutorielAllume` : éteint, refus et rien n'est écrit. Aucun appel payant.
 */
import { revalidatePath } from "next/cache";
import type { DifferenceLigne } from "@/domaine/relecture-script";
import { essayer, type Resultat } from "@/services/_commun";
import { deposerTutoriel, exigerTutorielAllume, type DemandeDepotTutoriel, type IssueDepotTutoriel } from "@/services/tutoriel-depot";
import { choisirPropositionRegistre, choisirVersion, corrigerScript, refaireEcrire, validerTutoriel, type IssueValidation } from "@/services/tutoriel-validation";

/** « Préparer la vidéo » : dossier ou phrase, fin, parcours, formats. */
export async function deposerTutorielAction(demande: DemandeDepotTutoriel): Promise<Resultat<IssueDepotTutoriel>> {
  const r = await essayer(async () => {
    await exigerTutorielAllume();
    return deposerTutoriel(demande);
  });
  if (r.ok && r.donnees.statut === "lancee") revalidatePath("/videos");
  return r;
}

async function geste(videoId: string, f: () => Promise<IssueValidation>): Promise<Resultat<IssueValidation>> {
  const r = await essayer(async () => {
    await exigerTutorielAllume();
    return f();
  });
  if (r.ok && r.donnees.statut === "ok") revalidatePath(`/tutoriel-outil/suivi/${videoId}`);
  return r;
}

export async function choisirVersionAction(videoId: string, version: "A" | "B"): Promise<Resultat<IssueValidation>> {
  return geste(videoId, () => choisirVersion(videoId, version));
}

export async function corrigerScriptAction(videoId: string, differences: DifferenceLigne[]): Promise<Resultat<IssueValidation>> {
  return geste(videoId, () => corrigerScript(videoId, differences));
}

export async function choisirPropositionAction(videoId: string, id: string, choisi: boolean): Promise<Resultat<IssueValidation>> {
  return geste(videoId, () => choisirPropositionRegistre(videoId, id, choisi));
}

export async function refaireEcrireAction(videoId: string): Promise<Resultat<IssueValidation>> {
  return geste(videoId, () => refaireEcrire(videoId));
}

export async function validerTutorielAction(videoId: string, options: { empreinteDevis?: string } = {}): Promise<Resultat<IssueValidation>> {
  return geste(videoId, () => validerTutoriel(videoId, options));
}
