import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { GabaritCreation } from "@/components/creation/GabaritCreation";
import { SuiviRoles } from "@/components/tutoriel-outil/SuiviRoles";
import { Bouton } from "@/components/ui/Bouton";
import { EtatVide } from "@/components/ui/EtatVide";
import { SuiviTravail } from "@/components/videos/SuiviTravail";
import { lireSuivi, signalerSuivi } from "@/services/tutoriel-suivi";

export const metadata: Metadata = { title: "Suivi de votre tutoriel" };

export default async function PageSuiviTutoriel({ params }: { params: Promise<{ videoId: string }> }) {
  const { videoId } = await params;
  const suivi = await lireSuivi(videoId);
  if (!suivi) notFound();
  const { travail, titreVideo } = suivi;
  if (!travail) {
    return (
      <GabaritCreation entete={{ titre: "Suivi de votre tutoriel", sousTitre: titreVideo, retour: { href: "/tutoriel-outil", libelle: "Tutoriel d'outil" } }}>
        <EtatVide titre="Rien n'est en cours" phrase="Aucune fabrication n'a encore démarré pour cette vidéo." />
      </GabaritCreation>
    );
  }
  // Pose les notifications de la cloche (une seule fois par événement ; éteint tant que le réglage n'est pas allumé).
  await signalerSuivi(travail);
  // Fin de fabrication : un clic mène à la vidéo (la page serveur est rafraîchie par SuiviTravail à la fin).
  const terminee = travail.statut === "termine";
  return (
    <GabaritCreation entete={{ titre: "Suivi de votre tutoriel", sousTitre: titreVideo, retour: { href: "/tutoriel-outil", libelle: "Tutoriel d'outil" } }} largeur="large">
      <div className="space-y-6">
        {terminee && (
          <Bouton asChild variante="principal" taille="lg" pleineLargeur>
            <Link href={`/videos/${videoId}`}>Voir la vidéo</Link>
          </Bouton>
        )}
        <SuiviTravail initial={travail} sansPrix />
        <SuiviRoles initial={travail} videoId={videoId} />
      </div>
    </GabaritCreation>
  );
}
