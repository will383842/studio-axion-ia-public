import type { Metadata } from "next";
import Link from "next/link";
import { GabaritCreation } from "@/components/creation/GabaritCreation";
import { RecentsGenerateur } from "@/components/creation/RecentsGenerateur";
import { Depot } from "@/components/formats/image-video/Depot";
import { ENTREE_IMAGE_VISIBLE, PHRASE_ECRAN_VIDE } from "@/components/formats/image-video/entrees";
import { etapesImageVideo, versRecentsImageVideo } from "@/components/formats/image-video/vues-gabarit";
import { RESEAUX_IV } from "@/domaine/image-video/plafonds";
import { dernieresImageVideo, etatDepotImageVideo, prixDuDepot } from "@/services/image-video-ecran";
import { dernieresLotsImageVideo } from "@/services/image-video-lot";

export const metadata: Metadata = { title: "Image → vidéo" };
export const dynamic = "force-dynamic";

/**
 * IMAGE → VIDÉO · écran 1 « Déposer » (lot L16). Atteignable par son adresse même quand le format est masqué (aucun
 * lien du menu ne la montre). Les dernières vidéos du format en dessous, pour y revenir.
 */
export default async function PageImageVideo() {
  const [etat, dernieres, lots] = await Promise.all([etatDepotImageVideo(), dernieresImageVideo(), dernieresLotsImageVideo()]);
  const montants: Record<number, number> = {};
  for (let n = 1; n <= RESEAUX_IV.length; n++) montants[n] = prixDuDepot(RESEAUX_IV.slice(0, n), etat.tauxUsdEur);
  return (
    <GabaritCreation
      entete={{ titre: "Image → vidéo", sousTitre: ENTREE_IMAGE_VISIBLE ? "Votre image prend vie." : "Votre idée prend vie." }}
      etapes={etapesImageVideo("depot")}
      recents={<RecentsGenerateur groupes={versRecentsImageVideo(lots, dernieres)} deuxColonnes vide={{ titre: "Aucune vidéo pour le moment", phrase: PHRASE_ECRAN_VIDE }} />}
    >
      <Depot montants={montants} blocage={etat.blocage} />
      <p className="mt-6 text-center text-[15px]">
        <Link href="/image-video/reserve" className="underline">
          Ma réserve
        </Link>
      </p>
    </GabaritCreation>
  );
}
