import type { Metadata } from "next";
import { GabaritCreation } from "@/components/creation/GabaritCreation";
import { AdapteAutomatiquementServeur } from "@/components/formats/image-video/AdapteAutomatiquementServeur";
import { CarteComprise } from "@/components/formats/image-video/CarteComprise";
import { Fabrication } from "@/components/formats/image-video/Fabrication";
import { ScriptEcrans } from "@/components/formats/image-video/ScriptEcrans";
import { ScriptRelireIV } from "@/components/formats/image-video/ScriptRelireIV";
import { VosVideos } from "@/components/formats/image-video/VosVideos";
import { etapesImageVideo } from "@/components/formats/image-video/vues-gabarit";
import { BandeauGenerateur } from "@/components/videos/BandeauGenerateur";
import { EtatVide } from "@/components/ui/EtatVide";
import { ID_FORMAT_IMAGE_VIDEO } from "@/formats/image-video";
import { vueImageVideo } from "@/services/image-video-ecran";
import { listerPartages } from "@/services/partages";

export const metadata: Metadata = { title: "Image → vidéo" };
export const dynamic = "force-dynamic";

/**
 * IMAGE → VIDÉO · écrans 2 à 5 d'une vidéo (lot L16) : « Ce que j'ai compris », « Le script », « Fabrication »,
 * « Vos vidéos ». L'écran suit l'état de la machine ; les arrêts de Will (carte, script) l'attendent ici.
 */
export default async function PageVideoImageVideo({
  params,
}: {
  params: Promise<{ videoId: string }>;
}) {
  const { videoId } = await params;
  const vue = await vueImageVideo(decodeURIComponent(videoId));
  if (!vue)
    return (
      <EtatVide
        icone="images"
        titre="Vidéo introuvable"
        phrase="Cette vidéo n'existe plus."
      />
    );
  // Lien privé (un par vidéo, sur la sortie choisie) : seulement sur « Vos vidéos ».
  const partages =
    vue.ecran === "videos" ? await listerPartages(vue.videoId) : [];
  return (
    <GabaritCreation
      entete={{
        titre: vue.titre,
        retour: vue.lot
          ? {
              href: `/image-video/lot/${vue.lot.id}`,
              libelle: `Lot de ${vue.lot.n} images`,
            }
          : { href: "/image-video", libelle: "Image → vidéo" },
      }}
      etapes={etapesImageVideo(vue.barre)}
      largeur={vue.ecran === "carte" ? "large" : "etroite"}
    >
      <div className="space-y-6">
        <BandeauGenerateur formatId={ID_FORMAT_IMAGE_VIDEO} />
        {vue.miseDeCote && (
          <p
            role="status"
            className="rounded-2xl bg-brique-doux px-4 py-3 text-[15px] font-semibold text-brique"
          >
            {vue.miseDeCote}
          </p>
        )}
        {vue.ecran === "carte" && vue.carte && (
          <CarteComprise
            videoId={vue.videoId}
            vue={vue.carte.vue}
            carte={vue.carte.carte}
            imageUrl={vue.imageUrl}
          />
        )}
        {vue.ecran === "script" &&
          vue.script &&
          // Réglage `imageVideo.relireScript` (éteint par défaut) : allumé, l'écran commun « Relire le script » ; sinon l'ancien écran.
          (vue.script.relireScript ? (
            <ScriptRelireIV
              videoId={vue.videoId}
              fiche={vue.script.fiche}
              formules={vue.script.formules}
              aTrancher={vue.script.aTrancher}
              prix={vue.script.prix}
              avecQuestion={vue.script.avecQuestion}
              variete={vue.script.variete}
            />
          ) : (
            <ScriptEcrans
              videoId={vue.videoId}
              fiche={vue.script.fiche}
              formules={vue.script.formules}
              aTrancher={vue.script.aTrancher}
              prix={vue.script.prix}
              avecQuestion={vue.script.avecQuestion}
              variete={vue.script.variete}
            />
          ))}
        {vue.ecran === "fabrication" && (
          <Fabrication
            videoId={vue.videoId}
            vue={vue.fabrication}
            enCours={vue.enCours}
            ecran={vue.ecran}
            plafond={vue.plafond}
            arret={vue.arret}
            arretee={vue.arretee}
          />
        )}
        {vue.ecran === "videos" && <AdapteAutomatiquementServeur videoId={vue.videoId} />}
        {vue.ecran === "videos" && vue.videos && (
          <VosVideos
            videos={vue.videos}
            verdict={vue.verdict}
            lienPrive={{ videoId: vue.videoId, titre: vue.titre, partages }}
          />
        )}
      </div>
    </GabaritCreation>
  );
}
