import type { Metadata } from "next";
import { EcranMigration, type VueMigration } from "@/components/migration/EcranMigration";
import { exigerSession } from "@/services/auth";
import { lireMigrationAction } from "../actions-migration";

export const metadata: Metadata = { title: "Migration" };
export const dynamic = "force-dynamic";

/** Réglages › Migration (temporaire jusqu'à Z5) : lecture seule, boutons d'écriture inactifs tant que rien n'est branché. */
export default async function PageMigration() {
  await exigerSession();
  const r = await lireMigrationAction();
  const vue: VueMigration = !r.ok ? { etat: "erreur", message: "Lecture impossible. Réessayez plus tard." } : r.donnees.donnees ? { etat: "normal", donnees: r.donnees.donnees } : { etat: "vide" };
  return <EcranMigration vue={vue} maintenant={new Date()} simulation={r.ok ? r.donnees.simulation : false} />;
}
