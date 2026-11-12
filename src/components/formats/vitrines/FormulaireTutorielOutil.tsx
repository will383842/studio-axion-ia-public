"use client";

import { useMemo, useState } from "react";
import { Bouton } from "@/components/ui/Bouton";
import { Champ } from "@/components/ui/Champ";
import { ZoneTexte } from "@/components/ui/ZoneTexte";
import { analyserFicheTutorielOutil } from "@/domaine/outils-motion/fiches";
import { PauseVitrine, RemarquesFiche } from "./RemarquesFiche";

/** Écran d'entrée « Tutoriel d'outil » : un script collé, ou un titre / une idée. Rien n'est envoyé : le rendu n'est pas branché. */
export function FormulaireTutorielOutil() {
  const [titre, setTitre] = useState("");
  const [outil, setOutil] = useState("");
  const [scriptColle, setScriptColle] = useState("");
  const [valide, setValide] = useState(false);
  const analyse = useMemo(() => analyserFicheTutorielOutil({ titre, outil, idee: titre, scriptColle }), [titre, outil, scriptColle]);
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
      <RemarquesFiche remarques={analyse.remarques} />
      <Bouton type="submit" icone="baguette">
        Préparer le tutoriel
      </Bouton>
      {valide && <PauseVitrine phrase="Le tutoriel d'outil n'est pas encore branché : votre demande est gardée, rien n'a échoué." />}
    </form>
  );
}
