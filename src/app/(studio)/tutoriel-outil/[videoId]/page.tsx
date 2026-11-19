import type { Metadata } from "next";
import { GabaritCreation } from "@/components/creation/GabaritCreation";
import { EcranValidationTutoriel } from "@/components/formats/tutoriel-outil/EcranValidationTutoriel";
import { EtatVide } from "@/components/ui/EtatVide";
import { vueValidationTutoriel } from "@/services/tutoriel-validation-ecran";

export const metadata: Metadata = { title: "Valider le tutoriel" };
export const dynamic = "force-dynamic";

/**
 * T-EXT-24 · Écran de validation d'une vidéo du tutoriel d'outil : Williams voit tout AVANT la voix et le rendu.
 * Hors de tout menu : atteint par lien direct tant que l'ouverture du générateur (T-EXT-29) n'est pas faite.
 */
export default async function PageValiderTutoriel({ params }: { params: Promise<{ videoId: string }> }) {
  const { videoId } = await params;
  const id = decodeURIComponent(videoId);
  const dossier = await vueValidationTutoriel(id);
  return (
    <GabaritCreation entete={{ titre: "Valider le tutoriel", retour: { href: "/tutoriel-outil", libelle: "Tutoriel d'outil" } }}>
      {dossier ? <EcranValidationTutoriel videoId={id} dossier={dossier} /> : <EtatVide icone="film" titre="Rien à valider pour l'instant" phrase="Le tutoriel n'est pas encore prêt à être relu." />}
    </GabaritCreation>
  );
}
