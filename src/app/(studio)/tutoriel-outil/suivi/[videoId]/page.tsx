import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { GabaritCreation } from "@/components/creation/GabaritCreation";
import { SuiviRoles } from "@/components/tutoriel-outil/SuiviRoles";
import { EtatVide } from "@/components/ui/EtatVide";
import { SuiviTravail } from "@/components/videos/SuiviTravail";
import { vueRoles } from "@/moteurs/montage-tutoriel-outil/vue-roles";
import { lireSuivi, signalerSuivi } from "@/services/tutoriel-suivi";

export const metadata: Metadata = { title: "Suivi de votre tutoriel" };

/** L'écran de validation (T-EXT-24) n'est pas encore sur master : tant qu'il n'y est pas, aucun bouton « Voir et valider ». */
const ECRAN_VALIDATION_PRET = false;

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
  const lienValidation = maquette && (maquette.etat === "attend-williams" || maquette.etat === "a-revoir") ? `/tutoriel-outil/maquette/${videoId}` : ECRAN_VALIDATION_PRET ? `/tutoriel-outil/${videoId}` : undefined;
  return (
    <GabaritCreation entete={{ titre: "Suivi de votre tutoriel", sousTitre: titreVideo, retour: { href: "/tutoriel-outil", libelle: "Tutoriel d'outil" } }} largeur="large">
      <div className="space-y-6">
        <SuiviTravail initial={travail} sansPrix />
        <SuiviRoles initial={travail} lienValidation={lienValidation} />
      </div>
    </GabaritCreation>
  );
}
