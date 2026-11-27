import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { GabaritCreation } from "@/components/creation/GabaritCreation";
import { CarteArret } from "@/components/tutoriel-outil/CarteArret";
import { PieceCreee } from "@/components/tutoriel-outil/PieceCreee";
import { EtatVide } from "@/components/ui/EtatVide";
import { arretLisible } from "@/moteurs/montage-tutoriel-outil/vue-roles";
import { lienSuivi, lireSuivi } from "@/services/tutoriel-suivi";
import { vuePieceCreee } from "@/services/tutoriel-piece-creee";

export const metadata: Metadata = { title: "Votre maquette" };

export default async function PageVotreMaquette({ params }: { params: Promise<{ videoId: string }> }) {
  const { videoId } = await params;
  const suivi = await lireSuivi(videoId);
  if (!suivi) notFound();
  const vue = await vuePieceCreee(videoId);
  // Sans pièce à voir : la cause de l'arrêt et les bons boutons, jamais une page vide.
  const arret = !vue && suivi.travail ? arretLisible(suivi.travail, videoId) : null;
  return (
    <GabaritCreation entete={{ titre: "Votre maquette", sousTitre: suivi.titreVideo, retour: { href: lienSuivi(videoId), libelle: "Suivi de votre tutoriel" } }} largeur="large">
      {vue ? <PieceCreee videoId={videoId} vue={vue} /> : arret ? <CarteArret arret={{ ...arret, boutons: arret.boutons.filter((b) => b.genre !== "voir-maquette") }} /> : <EtatVide titre="Rien à voir pour l'instant" phrase="Votre maquette apparaîtra ici dès qu'elle sera prête à relire." />}
    </GabaritCreation>
  );
}
