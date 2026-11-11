import type { Metadata } from "next";
import { GrilleOutilsMotion } from "@/components/outils-motion/GrilleOutilsMotion";
import { ConteneurPage } from "@/components/ui/ConteneurPage";
import { EnTetePage } from "@/components/ui/EnTetePage";
import { CATALOGUE_OUTILS_MOTION } from "@/outils-motion/catalogue";

export const metadata: Metadata = { title: "Animations du studio" };

/** Les pièces d'interface animées disponibles. La liste vient du catalogue de données ; le plan de scènes le branchera sur les vrais composants. */
export default function PageOutilsMotion() {
  return (
    <ConteneurPage>
      <EnTetePage titre="Animations du studio" sousTitre="Les pièces animées que le studio pose dans vos vidéos." />
      <GrilleOutilsMotion outils={CATALOGUE_OUTILS_MOTION} />
    </ConteneurPage>
  );
}
