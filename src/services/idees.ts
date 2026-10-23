/** CARNET D'IDÉES (B.8 #16, AV2.1 « Écrire »). */
import "server-only";
import type { Id, Idee } from "@/domaine/types";
import { listerFormatsActifs, trouverFormat } from "@/formats";
import { nouvelId } from "@/lib/ids";
import { depots, ErreurStudio, filtreExemples, horodatage } from "./_commun";
import { exigerSession } from "./auth";
import { creerBrouillon } from "./videos";

export async function listerIdees(options: { inclureArchivees?: boolean } = {}): Promise<Idee[]> {
  const exemples = await filtreExemples<Idee>();
  const liste = await depots().idees.lister((i) => exemples(i) && (options.inclureArchivees || i.etat !== "archivee"));
  return liste.sort((a, b) => b.creeLe.localeCompare(a.creeLe));
}

/** Format suggéré à partir du texte (simple, sans réseau). */
function suggererFormat(texte: string): string {
  const t = texte.toLowerCase();
  if (/interview|entretien|podcast|invité/.test(t)) return "podcast";
  if (/outil|démo|tuto|écran|logiciel/.test(t)) return "ecran-partage";
  if (/chiffre|combien|statistique|%/.test(t)) return "motion";
  return "avocat";
}

export async function ajouterIdee(texte: string, formatSuggere?: string): Promise<Idee> {
  await exigerSession();
  if (!texte.trim()) throw new ErreurStudio("VIDE", "Écrivez votre idée.");
  const idee: Idee = { id: nouvelId("idee"), texte: texte.trim(), formatSuggere: formatSuggere ?? suggererFormat(texte), etat: "nouvelle", ...horodatage() };
  return depots().idees.enregistrer(idee);
}

export async function modifierIdee(id: Id, patch: Partial<Pick<Idee, "texte" | "formatSuggere" | "etat">>): Promise<void> {
  await exigerSession();
  await depots().idees.modifier(id, patch);
}

export async function archiverIdee(id: Id): Promise<void> {
  await exigerSession();
  await depots().idees.modifier(id, { etat: "archivee" });
}

/** « Transformer en vidéo » : brouillon prérempli, sur un format ACTIF. */
export async function transformerIdeeEnVideo(id: Id): Promise<Id> {
  await exigerSession();
  const idee = await depots().idees.obtenir(id);
  if (!idee) throw new ErreurStudio("INTROUVABLE", "Cette idée n'existe plus.");
  const format = trouverFormat(idee.formatSuggere ?? "")?.statut === "actif" ? idee.formatSuggere! : listerFormatsActifs()[0].id;
  return creerBrouillon(format, { ideeId: id });
}
