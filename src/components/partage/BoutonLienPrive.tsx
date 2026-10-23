"use client";

/**
 * Bouton « Lien privé » des écrans qui n'ont pas la barre d'actions de la fiche vidéo (Image → vidéo « Vos vidéos »,
 * Cas concret « Vos fichiers »). Un lien par vidéo, sur la sortie choisie ; même feuille que la fiche.
 */
import { useState } from "react";
import type { PartageVue } from "@/components/publication/ContexteVideo";
import { Bouton } from "@/components/ui/Bouton";
import { PartagerVideo } from "./PartagerVideo";

export interface LienPriveVideo {
  videoId: string;
  titre: string;
  partages: PartageVue[];
}

export function BoutonLienPrive({ videoId, titre, partages }: LienPriveVideo) {
  const [ouverte, setOuverte] = useState(false);
  return (
    <>
      <Bouton variante="secondaire" icone="lien" onClick={() => setOuverte(true)}>
        Lien privé
      </Bouton>
      <PartagerVideo videoId={videoId} titre={titre} partages={partages} ouverte={ouverte} onOuverteChange={setOuverte} />
    </>
  );
}
