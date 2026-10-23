"use server";

import { redirect } from "next/navigation";
import { exigerSession, seDeconnecter } from "@/services/auth";
import { marquerLues } from "@/services/notifications";

export async function deconnexionAction(): Promise<void> {
  await seDeconnecter();
  redirect("/connexion");
}

export async function marquerNotificationsLuesAction(): Promise<void> {
  await exigerSession();
  await marquerLues();
}
