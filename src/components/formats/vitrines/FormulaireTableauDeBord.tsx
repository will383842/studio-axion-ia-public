"use client";

import { useState } from "react";
import { creerTableauDeBord, ouvrirRelectureTableauDeBord, validerRelectureTableauDeBord } from "@/app/(studio)/tableau-de-bord/actions";
import { Bouton } from "@/components/ui/Bouton";
import { Champ } from "@/components/ui/Champ";
import { EcranRelectureTableau, type DecisionLue, type ImageDeposee } from "@/components/formats/tableau-de-bord/EcranRelectureTableau";

/** Écran d'entrée « Tableau de bord » : un titre et la personne qui parle ; « Préparer » crée le brouillon, rien d'autre (aucun lancement, aucun prix). */
export function FormulaireTableauDeBord({ personnages }: { personnages: { id: string; nom: string }[] }) {
  const [titre, setTitre] = useState("");
  const [personnageId, setPersonnageId] = useState(personnages[0]?.id ?? "");
  const [phrase, setPhrase] = useState("");
  const [envoi, setEnvoi] = useState(false);
  const [videoId, setVideoId] = useState<string | null>(null);
  if (videoId)
    return (
      <div className="space-y-4">
        <p className="text-sm text-texte-doux">Votre brouillon est prêt : déposez la capture, puis relisez les chiffres.</p>
        <EcranRelectureTableau
          ouvrir={async (image: ImageDeposee) => {
            const r = await ouvrirRelectureTableauDeBord(videoId, image);
            if (!r.ok) throw new Error(r.message);
            return r.donnees;
          }}
          valider={async (brouillon: unknown, decisions: Record<string, DecisionLue>) => {
            const r = await validerRelectureTableauDeBord(videoId, brouillon as Parameters<typeof validerRelectureTableauDeBord>[1], decisions);
            if (!r.ok) throw new Error(r.message);
            return r.donnees;
          }}
        />
      </div>
    );
  return (
    <form
      className="space-y-4"
      onSubmit={async (e) => {
        e.preventDefault();
        if (envoi) return;
        setEnvoi(true);
        const r = await creerTableauDeBord({ titre: titre.trim() || "Tableau de bord", distribution: personnageId ? [{ role: "voix", personnageId, source: "double" }] : [] });
        if (r.ok) setVideoId(r.donnees.videoId);
        else setPhrase(r.message);
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
