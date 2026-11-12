import type { Metadata } from "next";
import { MesAnimations } from "@/components/facecam/MesAnimations";
import { GrilleOutilsMotion } from "@/components/outils-motion/GrilleOutilsMotion";
import { EnTetePage } from "@/components/ui/EnTetePage";
import { Onglets } from "@/components/ui/Onglets";
import type { CodeCarte } from "@/moteurs/montage-facecam/monteur";
import { CATALOGUE_OUTILS_MOTION } from "@/outils-motion/catalogue";
import { exigerSession } from "@/services/auth";
import { lireJsonGz, listerAnimations } from "@/services/monteur-facecam";

export const metadata: Metadata = { title: "Animations" };
export const dynamic = "force-dynamic";

/**
 * BIBLIOTHÈQUE › ANIMATIONS (refonte R8a, maquette M5 ; décision de Williams du 12/11 : les animations sont regroupées ici).
 * Deux onglets : « Mes animations » (les cartes sur mesure gardées par « Garder ce modèle » : voir, renommer, retirer) et
 * « Animations du studio » (les pièces animées que le studio pose dans les vidéos ; la page /outils-motion y renvoie).
 * L'index est léger (quelques Ko) ; le code HTML / CSS / GSAP est lu sur R2.
 */
export default async function PageMesAnimations({ searchParams }: { searchParams: Promise<{ onglet?: string }> }) {
  await exigerSession();
  const { onglet } = await searchParams;
  const animations = await listerAnimations();
  const codes = await Promise.all(animations.map((a) => lireJsonGz<CodeCarte>(a.contenuCle)));
  return (
    <div className="mx-auto max-w-3xl lg:max-w-5xl">
      <EnTetePage
        retour={{ href: "/bibliotheque", libelle: "Bibliothèque" }}
        titre="Animations"
        sousTitre="Les animations que vous avez gardées, et les pièces animées que le studio pose dans vos vidéos."
        className="mb-4"
      />
      <Onglets
        libelle="Sortes d'animations"
        parametreUrl="onglet"
        valeurParDefaut={onglet === "studio" ? "studio" : "miennes"}
        onglets={[
          {
            valeur: "miennes",
            libelle: "Mes animations",
            compteur: animations.length,
            contenu: <MesAnimations animations={animations.map((a, i) => ({ ...a, code: codes[i] }))} />,
          },
          {
            valeur: "studio",
            libelle: "Animations du studio",
            compteur: CATALOGUE_OUTILS_MOTION.length,
            contenu: (
              <>
                <p className="mb-3 text-sm text-texte-doux">Les pièces animées que le studio pose dans vos vidéos. Cette liste se consulte : il n&apos;y a rien à régler ici.</p>
                <GrilleOutilsMotion outils={CATALOGUE_OUTILS_MOTION} />
              </>
            ),
          },
        ]}
      />
    </div>
  );
}
