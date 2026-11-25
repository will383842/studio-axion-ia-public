"use client";

import { useState } from "react";
import { creerTableauDeBord } from "@/app/(studio)/tableau-de-bord/actions";
import { Bouton } from "@/components/ui/Bouton";
import { Champ } from "@/components/ui/Champ";

/** Écran d'entrée « Tableau de bord » : un titre et la personne qui parle ; « Préparer » crée le brouillon, rien d'autre (aucun lancement, aucun prix). */
export function FormulaireTableauDeBord({ personnages }: { personnages: { id: string; nom: string }[] }) {
  const [titre, setTitre] = useState("");
  const [personnageId, setPersonnageId] = useState(personnages[0]?.id ?? "");
  const [phrase, setPhrase] = useState("");
  const [envoi, setEnvoi] = useState(false);
  return (
    <form
      className="space-y-4"
      onSubmit={async (e) => {
        e.preventDefault();
        if (envoi) return;
        setEnvoi(true);
        const r = await creerTableauDeBord({ titre: titre.trim() || "Tableau de bord", distribution: personnageId ? [{ role: "voix", personnageId, source: "double" }] : [] });
        setPhrase(r.ok ? "Votre brouillon est prêt : les chiffres se relisent à l'étape suivante." : r.message);
        setEnvoi(false);
      }}
    >
      <Champ libelle="Titre" value={titre} onChange={(e) => setTitre(e.target.value)} />
      {personnages.length > 0 && (
        <label className="block text-sm font-semibold text-texte-doux">
          Qui parle
          <select className="mt-1.5 block w-full text-sm" value={personnageId} onChange={(e) => setPersonnageId(e.target.value)}>
            {personnages.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nom}
              </option>
            ))}
          </select>
        </label>
      )}
      <Bouton type="submit" icone="resultats" disabled={envoi}>
        Préparer
      </Bouton>
      {phrase && <p className="text-sm text-texte-doux">{phrase}</p>}
    </form>
  );
}
