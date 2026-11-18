import type { Metadata } from "next";
import { GabaritCreation } from "@/components/creation/GabaritCreation";
import { ScenesGardees } from "@/components/tutoriel-outil/ScenesGardees";
import { lireListeScenes } from "@/services/scenes-gardees";
import { garderSceneAction, retirerSceneAction } from "./actions";

export const metadata: Metadata = { title: "Scènes gardées" };
export const dynamic = "force-dynamic";

export default async function PageScenesGardees() {
  const { ouverte, scenes } = await lireListeScenes();
  return (
    <GabaritCreation
      entete={{ titre: "Scènes gardées", sousTitre: "Les passages de vos vidéos qui peuvent servir à nouveau", retour: { href: "/tutoriel-outil", libelle: "Tutoriel d'outil" } }}
      largeur="large"
    >
      <ScenesGardees scenes={scenes} ouverte={ouverte} onRetirer={retirerSceneAction} onGarder={garderSceneAction} />
    </GabaritCreation>
  );
}
