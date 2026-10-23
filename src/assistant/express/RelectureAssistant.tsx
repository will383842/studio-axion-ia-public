"use client";

/**
 * RELIRE LE SCRIPT AVANT LA VIDÉO, brique 6 : l'écran commun `RelireScript` branché sur l'assistant « Votre vidéo ».
 * S'ouvre à chaque « Fabriquer », même sous le seuil de confirmation. Les raisons à vérifier (prix plus haut que
 * d'habitude, avatar qui parle, décor à vérifier…) sont rappelées au-dessus des phrases ; le bouton collé en bas
 * confirme le prix puis lance (`lancer` de l'écran « Votre vidéo »).
 */
import { useCallback, useMemo, useRef, useState } from "react";
import { RelireScript } from "@/components/script/RelireScript";
import { BoutonIcone } from "@/components/ui/Bouton";
import { Icone } from "@/components/ui/Icone";
import { lignesApres, lignesDesBlocs } from "@/domaine/relecture-assistant";
import type { AdaptateurFormat, DifferenceLigne, ScriptRelu } from "@/domaine/relecture-script";
import type { Adresse, BlocScript } from "@/domaine/types";
import { obtenirFormat } from "@/formats";

export interface ProprietesRelectureAssistant {
  formatId: string;
  /** Le texte de la vidéo au moment de « Fabriquer ». */
  blocs: BlocScript[];
  /** Phrases déjà retouchées puis gardées par la flèche retour : reprises telles quelles. */
  modifications?: DifferenceLigne[];
  adresse: Adresse;
  /** Prix au plus (centimes) ; absent : format sans prix, aucun montant montré. */
  prixCentimes?: number;
  raisons: string[];
  /** Débit de la voix qui lira (mots/s). */
  debit?: number;
  controler: AdaptateurFormat<unknown>["controler"];
  lancer: AdaptateurFormat<unknown>["lancer"];
  /** Flèche retour : reçoit les phrases retouchées, pour les reprendre au prochain « Fabriquer ». */
  fermer: (modifications: DifferenceLigne[]) => void;
}

export function RelectureAssistant({ formatId, blocs, modifications, prixCentimes, raisons, debit, controler, lancer, fermer }: ProprietesRelectureAssistant) {
  const lignes = useMemo(() => {
    const recette = obtenirFormat(formatId).recetteScript;
    return lignesDesBlocs(blocs, (id) => recette.blocs.find((b) => b.id === id)?.nom);
  }, [formatId, blocs]);
  // Saisie de départ (reprise) et saisie du moment, rendue à la flèche retour : rien de retouché ne se perd.
  const [saisie] = useState(() => (modifications?.length ? lignesApres(lignes, modifications) : undefined));
  const enCours = useRef<DifferenceLigne[]>(modifications ?? []);
  const suivre = useCallback((s: ScriptRelu) => {
    enCours.current = s.modifications;
  }, []);
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <BoutonIcone icone="fleche-gauche" libelle="Revenir à votre vidéo" onClick={() => fermer(enCours.current)} className="-ml-2" />
        <div className="min-w-0 flex-1">
          <h1 className="text-[26px] leading-tight text-texte sm:text-[30px]">Relire le script</h1>
          <p className="text-sm text-texte-faible">Touchez une phrase pour la modifier.</p>
        </div>
      </div>
      {raisons.length > 0 && (
        <ul className="space-y-2">
          {raisons.map((r) => (
            <li key={r} className="flex items-center gap-2 rounded-xl bg-ambre-doux px-3 py-2.5 text-sm text-texte">
              <Icone nom="attention" size={16} className="shrink-0 text-ambre" />
              {r}
            </li>
          ))}
        </ul>
      )}
      <RelireScript lignes={lignes} saisie={saisie} surChangement={suivre} controler={controler} lancer={lancer} prixCentimes={prixCentimes} debit={debit} texteLibre />
    </div>
  );
}
