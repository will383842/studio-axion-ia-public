import type { Metadata } from "next";
import { GabaritCreation } from "@/components/creation/GabaritCreation";
import { Reserve } from "@/components/formats/image-video/Reserve";
import { etatDepotImageVideo } from "@/services/image-video-ecran";
import { apercuSuivantReserveIV, vueReserveIV } from "@/services/image-video-reserve";

export const metadata: Metadata = { title: "Ma réserve · Image → vidéo" };
export const dynamic = "force-dynamic";

/** IMAGE → VIDÉO · la réserve de scripts et d'idées : on y range, un clic fabrique le suivant. */
export default async function PageReserveImageVideo() {
  const [reserve, etat] = await Promise.all([vueReserveIV(), etatDepotImageVideo()]);
  const suivant = apercuSuivantReserveIV(reserve, etat.tauxUsdEur);
  return (
    <GabaritCreation entete={{ titre: "Ma réserve", sousTitre: "Vos scripts et vos idées, une vidéo à chaque clic." }} largeur="large">
      <Reserve reserve={reserve} suivantReseaux={suivant?.reseaux ?? 0} prix={suivant?.centimes ?? 0} />
    </GabaritCreation>
  );
}
