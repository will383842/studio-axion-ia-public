import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { GabaritCreation } from "@/components/creation/GabaritCreation";
import { PieceCreee } from "@/components/tutoriel-outil/PieceCreee";
import { EtatVide } from "@/components/ui/EtatVide";
import { lienSuivi, lireSuivi } from "@/services/tutoriel-suivi";
import { vuePieceCreee } from "@/services/tutoriel-piece-creee";

export const metadata: Metadata = { title: "Votre maquette" };

export default async function PageVotreMaquette({ params }: { params: Promise<{ videoId: string }> }) {
  const { videoId } = await params;
  const suivi = await lireSuivi(videoId);
  if (!suivi) notFound();
  const vue = await vuePieceCreee(videoId);
  return (
    <GabaritCreation entete={{ titre: "Votre maquette", sousTitre: suivi.titreVideo, retour: { href: lienSuivi(videoId), libelle: "Suivi de votre tutoriel" } }} largeur="large">
      {vue ? <PieceCreee videoId={videoId} vue={vue} /> : <EtatVide titre="Rien à voir pour l'instant" phrase="Votre maquette apparaîtra ici dès qu'elle sera prête à relire." />}
    </GabaritCreation>
  );
}
