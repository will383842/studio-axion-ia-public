import type { Metadata } from "next";
import { GabaritCreation } from "@/components/creation/GabaritCreation";
import { Reserve } from "@/components/formats/image-video/Reserve";
import { RESEAUX_IV } from "@/domaine/image-video/plafonds";
import { etatDepotImageVideo, prixDuDepot } from "@/services/image-video-ecran";
import { vueReserveIV } from "@/services/image-video-reserve";

export const metadata: Metadata = { title: "Ma réserve · Image → vidéo" };
export const dynamic = "force-dynamic";

/** IMAGE → VIDÉO · la réserve de scripts et d'idées : on y range, un clic fabrique le suivant. */
export default async function PageReserveImageVideo() {
  const [reserve, etat] = await Promise.all([vueReserveIV(), etatDepotImageVideo()]);
  const montants: Record<number, number> = {};
  for (let n = 1; n <= RESEAUX_IV.length; n++) montants[n] = prixDuDepot(RESEAUX_IV.slice(0, n), etat.tauxUsdEur);
  return (
    <GabaritCreation entete={{ titre: "Ma réserve", sousTitre: "Vos scripts et vos idées, une vidéo à chaque clic." }} largeur="large">
      <Reserve reserve={reserve} montants={montants} />
    </GabaritCreation>
  );
}
