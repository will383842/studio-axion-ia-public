"use client";

import { useState } from "react";
import { Bouton } from "@/components/ui/Bouton";
import { Dialogue } from "@/components/ui/Dialogue";
import { IdeeRapide } from "./IdeeRapide";

/** « Noter une idée » (maquette M1) : l'ancien champ de l'Accueil s'ouvre dans une fenêtre. */
export function NoterIdee() {
  const [ouvert, setOuvert] = useState(false);
  return (
    <>
      <Bouton variante="secondaire" icone="idee" onClick={() => setOuvert(true)}>
        Noter une idée
      </Bouton>
      <Dialogue ouvert={ouvert} onOuvertChange={setOuvert} titre="Une idée ?" description="Elle sera rangée dans Écrire, pour plus tard.">
        <IdeeRapide />
      </Dialogue>
    </>
  );
}
