"use client";

import { useVideo } from "@/components/publication/ContexteVideo";
import { PartagerVideo } from "./PartagerVideo";

/** Feuille « Partager » de la fiche vidéo (B.8 #9) : le contenu est dans `PartagerVideo`. */
export function FeuillePartager() {
  const { feuille, ouvrir, videoId, titre, partages } = useVideo();
  return <PartagerVideo videoId={videoId} titre={titre} partages={partages} ouverte={feuille === "partager"} onOuverteChange={(o) => ouvrir(o ? "partager" : null)} />;
}
