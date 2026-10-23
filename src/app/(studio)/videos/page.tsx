import type { Metadata } from "next";
import Link from "next/link";
import { Bouton } from "@/components/ui/Bouton";
import { EnTetePage } from "@/components/ui/EnTetePage";
import { EtatVide } from "@/components/ui/EtatVide";
import { NettoyerNonTerminees } from "@/components/videos/NettoyerNonTerminees";
import { GalerieVideos } from "@/components/videos/GalerieVideos";
import { OngletsMesVideos } from "@/components/videos/OngletsMesVideos";
import { ETAPES_EDITORIALES } from "@/domaine/libelles";
import type { EtapeEditoriale } from "@/domaine/types";
import { compteursMesVideos, videosAutres, videosDeToutes } from "@/domaine/mes-videos";
import { listerFormats } from "@/formats";
import { listerCorbeille } from "@/services/corbeille";
import { listerSeries, listerVideos } from "@/services/videos";
import { exigerSession } from "@/services/auth";

export const metadata: Metadata = { title: "Mes vidéos" };
export const dynamic = "force-dynamic";

type Vue = "toutes" | "brouillons" | "autres" | "archivees" | "corbeille";

/**
 * MES VIDÉOS (B.8 #7, AV2.1) — niveau 1.
 * Onglets : Toutes · Brouillons · un par format (registre) · Archivées · Corbeille.
 * Recherche, filtres (état, publication, format d'image, série), tri, sélection multiple.
 */
export default async function PageVideos({ searchParams }: { searchParams: Promise<{ vue?: string; etape?: string; format?: string }> }) {
  await exigerSession();
  const sp = await searchParams;
  const vue: Vue = sp.vue === "brouillons" || sp.vue === "autres" || sp.vue === "archivees" || sp.vue === "corbeille" ? sp.vue : "toutes";
  const [toutes, series, enCorbeille] = await Promise.all([listerVideos({ inclureArchivees: true }), listerSeries(), listerCorbeille()]);

  const brouillons = toutes.filter((v) => v.statut === "brouillon");
  // Archivées : toutes, ou celles d'un seul format (lien « Archivées de ce format » de la page du format).
  const archivees = toutes.filter((v) => v.statut === "archivee" && (!sp.format || v.format.id === sp.format));
  // TEST-UI-REEL U9 : « Toutes » montre (et compte) aussi les brouillons ; chaque onglet montre ce qu'il compte.
  const idsRegistre = listerFormats({ inclureMasques: true, inclureReservesAWill: true }).map((f) => f.id);
  const compteurs = compteursMesVideos([...toutes, ...enCorbeille], idsRegistre);
  const liste = vue === "corbeille" ? enCorbeille : vue === "brouillons" ? brouillons : vue === "archivees" ? archivees : vue === "autres" ? videosAutres(toutes, idsRegistre) : videosDeToutes(toutes);
  // Lien « À relire » de l'accueil : /videos?etape=a_relire préremplit le filtre d'étape.
  const etape = sp.etape && Object.hasOwn(ETAPES_EDITORIALES, sp.etape) ? (sp.etape as EtapeEditoriale) : undefined;

  const nouvelle = (
    <Bouton asChild icone="plus">
      <Link href="/nouvelle">Nouvelle vidéo</Link>
    </Bouton>
  );

  return (
    <div>
      <EnTetePage titre="Mes vidéos" actions={<div className="hidden lg:block">{nouvelle}</div>} />
      {vue !== "corbeille" && vue !== "archivees" && (
        <div className="mb-4 flex justify-end">
          <NettoyerNonTerminees />
        </div>
      )}
      <OngletsMesVideos actif={vue} compteParFormat={compteurs.parFormat} nbToutes={compteurs.toutes} nbBrouillons={compteurs.brouillons} nbArchivees={vue === "archivees" ? archivees.length : compteurs.archivees} nbCorbeille={compteurs.corbeille} nbAutres={compteurs.autres} className="mb-5" />
      <GalerieVideos
        key={`${vue}-${sp.format ?? ""}-${etape ?? ""}`}
        videos={liste}
        filtresInitiaux={etape ? { etape } : undefined}
        series={series.map((s) => ({ id: s.id, nom: s.nom }))}
        archivees={vue === "archivees"}
        corbeille={vue === "corbeille"}
        vide={
          vue === "brouillons" ? (
            <EtatVide icone="ecrire" titre="Aucun brouillon" phrase="Tout est fabriqué." action={nouvelle} />
          ) : vue === "corbeille" ? (
            <EtatVide icone="corbeille" titre="La corbeille est vide" phrase="Une vidéo mise à la corbeille reste ici 30 jours, restaurable, puis elle est supprimée." />
          ) : vue === "archivees" ? (
            <EtatVide icone="archive" titre="Rien d'archivé" phrase="Une vidéo archivée reste ici tant que vous ne la mettez pas à la corbeille." />
          ) : (
            <EtatVide titre="Aucune vidéo pour l'instant" phrase="Votre première vidéo vous attend." action={nouvelle} />
          )
        }
      />
    </div>
  );
}
