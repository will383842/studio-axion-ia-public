import type { Metadata } from "next";
import { EnTetePage } from "@/components/ui/EnTetePage";
import { FiltresContenus, compterContenus, lireFiltresContenus } from "@/components/contenus/FiltresContenus";
import { GrilleContenus, calculerVueContenus } from "@/components/contenus/GrilleContenus";
import { exigerSession } from "@/services/auth";
import { lireBibliotheque } from "@/services/bibliotheque-contenus";
import { listerVideos } from "@/services/videos";
import { dependancesCarrousels } from "@/visuels/services/production";

export const metadata: Metadata = { title: "Mes contenus" };
export const dynamic = "force-dynamic";

/**
 * MES CONTENUS (D3-05, refonte R5) — une seule liste, lecture seule : vidéos, infographies et carrousels, filtrés par famille, format, réseau et étape.
 * ?type= (la famille), ?format=, ?reseau=, ?statut= et ?page= viennent de l'adresse ; une valeur inconnue est ignorée.
 */
export default async function PageContenus({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await exigerSession();
  const sp = await searchParams;
  const filtres = lireFiltresContenus(sp);
  const tous = await lireBibliotheque({ parPage: 1_000_000 }, { ...dependancesCarrousels(), listerVideos: () => listerVideos({ inclureArchivees: true }) });
  const vue = calculerVueContenus(tous.elements, filtres);
  return (
    <>
      <EnTetePage titre="Mes contenus" sousTitre="Vos vidéos, infographies et carrousels, au même endroit." />
      <div className="space-y-6">
        <FiltresContenus params={sp} filtres={filtres} comptes={compterContenus(tous.elements)} />
        <GrilleContenus vue={vue} params={sp} filtres={filtres} />
      </div>
    </>
  );
}
