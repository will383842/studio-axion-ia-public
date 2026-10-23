import type { Metadata } from "next";
import { ListeARanger } from "@/components/generateur/ListeARanger";
import { EnTetePage } from "@/components/ui/EnTetePage";
import { exigerSession } from "@/services/auth";
import { listerVersionsSansVideo, listerVideosARanger } from "@/services/generateur";
import { versCarte } from "@/services/presentation";

export const metadata: Metadata = { title: "À ranger" };
export const dynamic = "force-dynamic";

/**
 * « À RANGER » (plan v5 B.6.19, lot G1b) : les vidéos faites avant le générateur (sans réseau ni version). Un toucher
 * les range sous le code d'une version (`rangerVideo`) : elles prennent son réseau et apparaissent dans sa case.
 */
export default async function PageARanger() {
  await exigerSession();
  const [videos, versions] = await Promise.all([listerVideosARanger(), listerVersionsSansVideo()]);
  const cartes = await Promise.all(videos.map(versCarte));
  return (
    <div className="mx-auto max-w-2xl">
      <EnTetePage retour={{ href: "/videos", libelle: "Mes vidéos" }} titre="À ranger" sousTitre={`${cartes.length} vidéo${cartes.length > 1 ? "s" : ""} sans réseau`} className="mb-4" />
      <ListeARanger videos={cartes.map((c) => ({ id: c.id, titre: c.titre, vignette: c.vignette, format: c.format.nom }))} versions={versions} />
    </div>
  );
}
