import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { GabaritCreation } from "@/components/creation/GabaritCreation";
import { SuiviRoles } from "@/components/tutoriel-outil/SuiviRoles";
import { EtatVide } from "@/components/ui/EtatVide";
import { SuiviTravail } from "@/components/videos/SuiviTravail";
import { pauseALienValidation, vueRoles } from "@/moteurs/montage-tutoriel-outil/vue-roles";
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
  // V2-09 : quand le maquettiste attend Williams, le lien mène à « Votre maquette » ; sinon la valeur d'avant.
  const maquette = vueRoles(travail).find((l) => l.role === "maquettiste");
  // « Voir et valider » seulement quand l'écran sait servir l'état (maquette, ou une pause qu'il lit) : sinon pas de lien.
  const lienValidation =
    maquette && (maquette.etat === "attend-williams" || maquette.etat === "a-revoir")
      ? `/tutoriel-outil/maquette/${videoId}`
      : pauseALienValidation(travail)
        ? `/tutoriel-outil/${videoId}`
        : undefined;
  return (
    <GabaritCreation entete={{ titre: "Suivi de votre tutoriel", sousTitre: titreVideo, retour: { href: "/tutoriel-outil", libelle: "Tutoriel d'outil" } }} largeur="large">
      <div className="space-y-6">
        <SuiviTravail initial={travail} sansPrix />
        <SuiviRoles initial={travail} lienValidation={lienValidation} />
      </div>
    </GabaritCreation>
  );
}
