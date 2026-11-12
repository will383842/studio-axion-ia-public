import type { Metadata } from "next";
import Link from "next/link";
import { GrilleOutilsMotion } from "@/components/outils-motion/GrilleOutilsMotion";
import { Bouton } from "@/components/ui/Bouton";
import { ConteneurPage } from "@/components/ui/ConteneurPage";
import { EnTetePage } from "@/components/ui/EnTetePage";
import { CATALOGUE_OUTILS_MOTION } from "@/outils-motion/catalogue";

export const metadata: Metadata = { title: "Animations du studio" };

/**
 * Les pièces d'interface animées disponibles. La liste vient du catalogue de données ; le plan de scènes le branchera sur les vrais composants.
 * Refonte R8a (décision de Williams, 12/11) : les animations sont regroupées dans Bibliothèque › Animations ; cette page est gardée
 * (liens, recherche) et y renvoie.
 */
export default function PageOutilsMotion() {
  return (
    <ConteneurPage>
      <EnTetePage
        retour={{ href: "/bibliotheque", libelle: "Bibliothèque" }}
        titre="Animations du studio"
        sousTitre="Les pièces animées que le studio pose dans vos vidéos. Toutes vos animations sont maintenant réunies dans la Bibliothèque."
        actions={
          <Bouton asChild variante="secondaire">
            <Link href="/bibliotheque/animations?onglet=studio">Ouvrir dans Bibliothèque</Link>
          </Bouton>
        }
      />
      <GrilleOutilsMotion outils={CATALOGUE_OUTILS_MOTION} />
    </ConteneurPage>
  );
}
