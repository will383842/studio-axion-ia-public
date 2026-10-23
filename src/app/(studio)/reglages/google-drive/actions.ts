"use server";

/** Actions serveur « Mon Google Drive » (lot E2). Chacune commence par exigerSession(). */
import { revalidatePath } from "next/cache";
import { essayer, type Resultat } from "@/services/_commun";
import { exigerSession } from "@/services/auth";
import { deconnecterDrive, importerDepuisDrive, lancerConnexionDrive, listerVideosDrive, reprendreImportDrive, suivreImportDrive, type VueImportDrive } from "@/services/google-drive";
import type { VideoDrive } from "@/fournisseurs/google-drive";

export async function lancerConnexionDriveAction(): Promise<Resultat<{ adresse: string }>> {
  await exigerSession();
  return essayer(() => lancerConnexionDrive());
}

export async function deconnecterDriveAction(): Promise<Resultat> {
  await exigerSession();
  return essayer(async () => {
    await deconnecterDrive();
    revalidatePath("/reglages/google-drive");
    return undefined;
  });
}

export async function listerVideosDriveAction(recherche?: string, suite?: string): Promise<Resultat<{ videos: VideoDrive[]; suite?: string }>> {
  await exigerSession();
  return essayer(() => listerVideosDrive({ recherche: typeof recherche === "string" ? recherche : undefined, suite: typeof suite === "string" ? suite : undefined }));
}

/** Copie côté serveur d'une vidéo du Drive vers la même destination qu'un envoi depuis l'iPhone. */
export async function importerDepuisDriveAction(driveId: string, cible: { typeEntite: string; entiteId: string }): Promise<Resultat<VueImportDrive>> {
  await exigerSession();
  return essayer(() => importerDepuisDrive({ driveId: String(driveId ?? ""), typeEntite: String(cible?.typeEntite ?? ""), entiteId: String(cible?.entiteId ?? "") }));
}

export async function suivreImportDriveAction(id: string): Promise<Resultat<VueImportDrive>> {
  await exigerSession();
  return essayer(() => suivreImportDrive(String(id ?? "")));
}

export async function reprendreImportDriveAction(id: string): Promise<Resultat<VueImportDrive>> {
  await exigerSession();
  return essayer(() => reprendreImportDrive(String(id ?? "")));
}
