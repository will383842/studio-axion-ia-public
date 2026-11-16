import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { exigerSession } from "@/services/auth";

export const metadata: Metadata = { title: "Réglages" };
export const dynamic = "force-dynamic";

/**
 * BF-02 : l'écran de migration n'est plus affiché. L'adresse renvoie vers les Réglages (session exigée d'abord).
 * Rien n'est supprimé : l'écran et son journal de l'import restent dans le code, simplement non montés.
 */
export default async function PageMigration() {
  await exigerSession();
  redirect("/reglages");
}
