"use client";

import { useMemo, useState } from "react";
import { Bouton } from "@/components/ui/Bouton";
import { Champ } from "@/components/ui/Champ";
import { analyserFicheDemoFacecam } from "@/domaine/outils-motion/fiches";
import { PauseVitrine, RemarquesFiche } from "./RemarquesFiche";

function ChoixVideo({ libelle, onNom }: { libelle: string; onNom: (nom: string) => void }) {
  return (
    <label className="block text-sm font-semibold text-texte-doux">
      {libelle}
      <input type="file" accept="video/*" className="mt-1.5 block w-full text-sm" onChange={(e) => onNom(e.target.files?.[0]?.name ?? "")} />
    </label>
  );
}

/** Écran d'entrée « Démo facecam » : une vidéo facecam et un enregistrement d'écran, ou une seule vidéo. Rien n'est envoyé : le rendu n'est pas branché. */
export function FormulaireDemoFacecam() {
  const [titre, setTitre] = useState("");
  const [facecam, setFacecam] = useState("");
  const [ecran, setEcran] = useState("");
  const [valide, setValide] = useState(false);
  const analyse = useMemo(() => analyserFicheDemoFacecam({ titre, videoFacecamId: facecam, videoEcranId: ecran }), [titre, facecam, ecran]);
  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        setValide(true);
      }}
    >
      <Champ libelle="Titre" value={titre} onChange={(e) => setTitre(e.target.value)} />
      <ChoixVideo libelle="Votre vidéo facecam" onNom={setFacecam} />
      <ChoixVideo libelle="Votre enregistrement d'écran (facultatif)" onNom={setEcran} />
      <RemarquesFiche remarques={analyse.remarques} />
      <Bouton type="submit" icone="ecran-partage">
        Préparer la démo
      </Bouton>
      {valide && <PauseVitrine phrase="La démo facecam n'est pas encore branchée : vos vidéos sont gardées, rien n'a échoué." />}
    </form>
  );
}
