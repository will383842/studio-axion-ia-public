import type { Metadata } from "next";
import { ConnexionDrive } from "@/components/google-drive/ConnexionDrive";
import { EnTetePage } from "@/components/ui/EnTetePage";
import { exigerSession } from "@/services/auth";
import { etatDrive } from "@/services/google-drive";

export const metadata: Metadata = { title: "Mon Google Drive" };
export const dynamic = "force-dynamic";

/** Réglages › Mon Google Drive (lot E2) : connexion une seule fois, en lecture seule, pour importer une vidéo. */
export default async function PageGoogleDrive({ searchParams }: { searchParams: Promise<{ drive?: string }> }) {
  await exigerSession();
  const [etat, { drive }] = await Promise.all([etatDrive(), searchParams]);
  return (
    <div className="mx-auto w-full max-w-xl">
      <EnTetePage retour={{ href: "/reglages", libelle: "Réglages" }} titre="Mon Google Drive" sousTitre="Choisissez une vidéo de votre Drive au lieu de l'envoyer depuis l'iPhone." />
      <ConnexionDrive etat={etat} retour={typeof drive === "string" ? drive : undefined} />
    </div>
  );
}
