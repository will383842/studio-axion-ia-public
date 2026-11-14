"use client";

import { useMemo, useState } from "react";
import { Bouton } from "@/components/ui/Bouton";
import {
  LIMITE_TIKTOK,
  construireReponse,
  lienCommentaireSur,
  type EntreeKit,
  type RaisonAEcrireSoiMeme,
} from "@/services/a-traiter-kit";

const LIBELLE_RAISON: Record<RaisonAEcrireSoiMeme, string> = {
  prix: "Demande de prix",
  reclamation: "Réclamation",
  colere: "Commentaire en colère",
};

/**
 * Kit de réponse manuelle (LinkedIn page, TikTok) : propose une réponse type, le lien du guide, « Copier » et « Ouvrir le commentaire ».
 * Le Studio n'écrit rien sur ces réseaux : le seul geste est la copie dans le presse-papiers, l'opérateur colle et publie lui-même.
 */
export function KitReponse({ entree }: { entree: EntreeKit }) {
  const [saisie, setSaisie] = useState("");
  const [phrase, setPhrase] = useState<string | null>(null);
  const kit = useMemo(() => construireReponse(entree, saisie), [entree, saisie]);
  const lien = lienCommentaireSur(entree.reseau, entree.lienCommentaire);

  const copier = async (texte: string) => {
    try {
      await navigator.clipboard.writeText(texte);
      setPhrase("Réponse copiée : collez-la vous-même sous le commentaire.");
    } catch {
      setPhrase("Copie impossible. Sélectionnez le texte à la main.");
    }
  };

  return (
    <div className="mt-3 flex flex-col gap-2" data-kit-reponse data-reseau={entree.reseau}>
      {kit.genre === "a_ecrire_soi_meme" ? (
        <p className="text-sm font-semibold text-texte" data-a-ecrire-soi-meme>
          À écrire soi-même : {LIBELLE_RAISON[kit.raison].toLowerCase()}. Aucune réponse toute faite n’est proposée.
        </p>
      ) : kit.genre === "indisponible" ? (
        <p className="text-sm text-texte-doux" data-kit-indisponible>
          Pas de réponse prête (réseau non géré, lien ou titre du guide manquant) : écrivez-la vous-même.
        </p>
      ) : (
        <>
          <label className="flex flex-col gap-1 text-sm text-texte">
            Première ligne (prénom ou détail du commentaire)
            <input
              type="text"
              className="rounded-md border border-trait-fort bg-surface-1 px-3 py-2 text-sm text-texte"
              data-premiere-ligne
              maxLength={120}
              placeholder={kit.premiereLigne}
              value={saisie}
              onChange={(e) => setSaisie(e.target.value)}
            />
          </label>
          {kit.premiereLigneRefusee ? (
            <p className="text-xs text-texte-doux" data-ligne-refusee>Cette première ligne n’est pas retenue : la phrase validée est gardée.</p>
          ) : null}
          <pre className="whitespace-pre-wrap text-sm text-texte-doux" data-reponse-type>{kit.texte}</pre>
          {entree.reseau === "tiktok" ? (
            <p className="text-xs text-texte-doux" data-compte-tiktok>
              {[...kit.texte].length} / {LIMITE_TIKTOK} caractères, sans @
            </p>
          ) : null}
          {!kit.copiable ? (
            <p className="text-sm font-semibold text-texte" data-non-copiable>
              {kit.raisonNonCopiable === "arobase"
                ? `TikTok : pas de @ dans la réponse. Retirez-le ou écrivez la réponse vous-même.`
                : `TikTok : la réponse dépasse ${LIMITE_TIKTOK} caractères. Raccourcissez la première ligne ou écrivez-la vous-même.`}
            </p>
          ) : null}
        </>
      )}
      <div className="flex flex-wrap gap-2">
        {kit.genre === "reponse" && kit.copiable ? (
          <Bouton variante="secondaire" data-copier onClick={() => copier(kit.texte)}>Copier</Bouton>
        ) : null}
        {lien ? (
          <Bouton variante="secondaire" asChild>
            <a href={lien} target="_blank" rel="noopener noreferrer">Ouvrir le commentaire</a>
          </Bouton>
        ) : null}
      </div>
      {phrase ? <p className="text-sm text-texte" data-phrase-kit>{phrase}</p> : null}
      <p className="text-xs text-texte-doux">Le Studio ne publie rien sur LinkedIn ni TikTok : vous collez et publiez vous-même.</p>
    </div>
  );
}
