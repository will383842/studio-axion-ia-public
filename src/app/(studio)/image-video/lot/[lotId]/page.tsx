import type { Metadata } from "next";
import { GabaritCreation } from "@/components/creation/GabaritCreation";
import { SuiviLot } from "@/components/formats/image-video/SuiviLot";
import { etapesLot } from "@/components/formats/image-video/vues-gabarit";
import { BandeauGenerateur } from "@/components/videos/BandeauGenerateur";
import { EtatVide } from "@/components/ui/EtatVide";
import { ID_FORMAT_IMAGE_VIDEO } from "@/formats/image-video";
import { vueLotImageVideo } from "@/services/image-video-lot";

export const metadata: Metadata = { title: "Lot d'images" };
export const dynamic = "force-dynamic";

/**
 * IMAGE → VIDÉO · suivi d'un lot d'images : les vidéos mises de côté à relire, puis tout le lot. Atteignable par son
 * adresse (comme `/image-video`, le format reste masqué du menu).
 */
export default async function PageLotImageVideo({ params }: { params: Promise<{ lotId: string }> }) {
  const { lotId } = await params;
  const vue = await vueLotImageVideo(decodeURIComponent(lotId));
  if (!vue) return <EtatVide icone="images" titre="Lot introuvable" phrase="Ce lot n'existe plus." />;
  return (
    <GabaritCreation entete={{ titre: vue.titre, sousTitre: vue.sousTitre, retour: { href: "/image-video", libelle: "Image → vidéo" } }} etapes={etapesLot(vue.etape)}>
      <BandeauGenerateur formatId={ID_FORMAT_IMAGE_VIDEO} />
      <SuiviLot vue={vue} />
    </GabaritCreation>
  );
}
