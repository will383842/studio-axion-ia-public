import type { Metadata } from "next";
import { EnTetePage } from "@/components/ui";
import { exigerSession } from "@/services/auth";
import { ApercuRelireScript } from "./_ApercuRelireScript";

export const metadata: Metadata = { title: "Relire le script (aperçu)" };

/**
 * APERÇU de l'écran commun « Relire le script » (brique 1 sur 8), pour valider la maquette. Non lié au menu ; protégé
 * comme le reste du studio (proxy + session). Script de la v4, faux adaptateur : rien n'est envoyé ni payé.
 */
export default async function PageEssaiRelireScript() {
  await exigerSession();
  return (
    <div className="mx-auto max-w-2xl">
      <EnTetePage titre="Relire le script" sousTitre="Touchez une phrase pour la modifier." />
      <ApercuRelireScript />
    </div>
  );
}
