import type { Metadata } from "next";
import { GrilleOutilsMotion } from "@/components/outils-motion/GrilleOutilsMotion";
import { EnTetePage } from "@/components/ui/EnTetePage";
import { CATALOGUE_OUTILS_MOTION } from "@/outils-motion/catalogue";

export const metadata: Metadata = { title: "Outils motion design" };

/** Les pièces d'interface animées disponibles. La liste vient du catalogue de données ; le plan de scènes le branchera sur les vrais composants. */
export default function PageOutilsMotion() {
  return (
    <div className="space-y-6">
      <EnTetePage titre="Outils motion design" sousTitre="Les pièces animées que le studio pose dans vos vidéos." />
      <GrilleOutilsMotion outils={CATALOGUE_OUTILS_MOTION} />
    </div>
  );
}
