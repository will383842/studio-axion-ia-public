"use client";

import { useMemo, useState } from "react";
import { Bouton } from "@/components/ui/Bouton";
import { Champ } from "@/components/ui/Champ";
import { SelecteurPastilles } from "@/components/ui/SelecteurPastilles";
import { ZoneTexte } from "@/components/ui/ZoneTexte";
import { AIDE_MODE_SANS_VOIX, LIBELLE_MODE_AVEC_VOIX, LIBELLE_MODE_SANS_VOIX, MODE_AVEC_VOIX, MODE_SANS_VOIX, type ModeVoixTutoriel } from "@/formats/tutoriel-outil/mode-sans-voix";
import { controlerLongueurScript } from "@/moteurs/montage-tutoriel-outil/diffusion-tutoriel";
import { DUREE_CARTE_FIN_MS } from "@/moteurs/montage-tutoriel-outil/proprietes";
import { analyserFicheTutorielOutil } from "@/domaine/outils-motion/fiches";
import { PauseVitrine, RemarquesFiche } from "./RemarquesFiche";

/** Écran d'entrée « Tutoriel d'outil » : un script collé, ou un titre / une idée. Rien n'est envoyé : le rendu n'est pas branché. */
export function FormulaireTutorielOutil() {
  const [titre, setTitre] = useState("");
  const [outil, setOutil] = useState("");
  const [scriptColle, setScriptColle] = useState("");
  const [valide, setValide] = useState(false);
  // T-EXT-SV : le mode avec voix reste le défaut ; « sans voix » seulement si l'utilisateur le choisit.
  const [mode, setMode] = useState<ModeVoixTutoriel>(MODE_AVEC_VOIX);
  const analyse = useMemo(() => analyserFicheTutorielOutil({ titre, outil, idee: titre, scriptColle }), [titre, outil, scriptColle]);
  // Sans voix, le rythme vient de la vitesse de lecture du texte ; hors cible = une remarque, jamais un refus ni une coupe.
  const remarquesDuree = useMemo(() => (mode === MODE_SANS_VOIX && scriptColle.trim() ? controlerLongueurScript(scriptColle, DUREE_CARTE_FIN_MS).map((r) => r.message) : []), [mode, scriptColle]);
  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        setValide(true);
      }}
    >
      <Champ libelle="Titre ou idée" value={titre} onChange={(e) => setTitre(e.target.value)} placeholder="Ex. Prendre un rendez-vous avec Calendly" />
      <Champ libelle="Outil montré" value={outil} onChange={(e) => setOutil(e.target.value)} />
      <ZoneTexte libelle="Votre script (facultatif)" aide="Collez-le : il fait foi. Sans script, le studio en écrit un que vous relirez avant de valider." value={scriptColle} onChange={(e) => setScriptColle(e.target.value)} />
      <SelecteurPastilles
        libelle="Son de la vidéo"
        valeur={mode}
        onChange={setMode}
        options={[
          { valeur: MODE_AVEC_VOIX, libelle: LIBELLE_MODE_AVEC_VOIX },
          { valeur: MODE_SANS_VOIX, libelle: LIBELLE_MODE_SANS_VOIX, detail: AIDE_MODE_SANS_VOIX },
        ]}
      />
      <RemarquesFiche remarques={[...analyse.remarques, ...remarquesDuree]} />
      <Bouton type="submit" icone="baguette">
        Préparer le tutoriel
      </Bouton>
      {valide && <PauseVitrine phrase="Le tutoriel d'outil n'est pas encore branché : votre demande est gardée, rien n'a échoué." />}
    </form>
  );
}
