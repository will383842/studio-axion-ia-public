import type { Metadata } from "next";
import { EnTetePage } from "@/components/ui/EnTetePage";
import { FiltresContenus, compterContenus, lireFiltresContenus } from "@/components/contenus/FiltresContenus";
import { GrilleContenus, calculerVueContenus } from "@/components/contenus/GrilleContenus";
import { exigerSession } from "@/services/auth";
import { lireBibliotheque } from "@/services/bibliotheque-contenus";
import { listerVideos } from "@/services/videos";
import { dependancesCarrousels } from "@/visuels/services/production";

export const metadata: Metadata = { title: "Tous mes contenus" };
export const dynamic = "force-dynamic";

/**
 * TOUS MES CONTENUS (D3-05) — lecture seule : vidéos, images et carrousels au même endroit, classés par réseau et par type.
 * ?type=, ?reseau=, ?statut= et ?page= viennent de l'adresse ; une valeur inconnue est ignorée.
 */
export default async function PageContenus({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await exigerSession();
  const sp = await searchParams;
  const filtres = lireFiltresContenus(sp);
  const tous = await lireBibliotheque({ parPage: 1_000_000 }, { ...dependancesCarrousels(), listerVideos: () => listerVideos({ inclureArchivees: true }) });
  const vue = calculerVueContenus(tous.elements, filtres);
  return (
    <>
      <EnTetePage titre="Tous mes contenus" sousTitre="Vos vidéos, images et carrousels, classés par réseau et par type." />
      <div className="space-y-6">
        <FiltresContenus params={sp} filtres={filtres} comptes={compterContenus(tous.elements)} />
        <GrilleContenus vue={vue} params={sp} filtres={filtres} />
      </div>
    </>
  );
}
