"use client";

import { useState, type ReactNode } from "react";
import { Bouton } from "@/components/ui/Bouton";
import { FeuilleBas } from "@/components/ui/FeuilleBas";

/** Textes de la confirmation (décision de Will du 17/10 : « vraie suppression, dépenses gardées »). */
export function textesSuppression(cible: { titre?: string; nombre: number }) {
  const plusieurs = cible.nombre > 1;
  return {
    titre: plusieurs ? `Supprimer ${cible.nombre} vidéos ?` : "Supprimer cette vidéo ?",
    cible: plusieurs ? `${cible.nombre} vidéos` : cible.titre ? `« ${cible.titre} »` : "Cette vidéo",
    avertissement: "Ça ne se rattrape pas.",
    // Scripts créés pour la vidéo (`creePourVideoId`) : partent avec elle, sauf favori, référence ou utilisé ailleurs.
    texte: plusieurs ? "Les textes écrits pour elles partent aussi, sauf favoris." : "Le texte écrit pour elle part aussi, sauf favori.",
    garde: "Les dépenses restent dans vos comptes. Le journal et les publications déjà publiées, avec leurs mesures, restent aussi.",
    bouton: "Supprimer définitivement",
  };
}

/** Corps de la feuille : ce qui part, ce qui reste. */
export function CorpsSuppression({ titre, nombre }: { titre?: string; nombre: number }) {
  const t = textesSuppression({ titre, nombre });
  return (
    <div className="space-y-1 text-[15px]">
      <p className="font-semibold text-texte">{t.cible}</p>
      <p className="text-brique">{t.avertissement}</p>
      <p className="text-texte-doux">{t.texte}</p>
      <p className="text-texte-doux">{t.garde}</p>
    </div>
  );
}

/**
 * « Supprimer définitivement » : toujours une confirmation (titre ou nombre, « Ça ne se rattrape pas », dépenses
 * gardées). `supprimer` n'est appelé qu'après le toucher sur le bouton rouge.
 */
export function useConfirmationSuppression(): {
  demander: (cible: { titre?: string; nombre: number }, supprimer: () => void) => void;
  feuille: ReactNode;
} {
  const [attente, setAttente] = useState<{ titre?: string; nombre: number; supprimer: () => void } | null>(null);
  const t = textesSuppression(attente ?? { nombre: 1 });

  const feuille = (
    <FeuilleBas
      ouverte={!!attente}
      onOuverteChange={(o) => !o && setAttente(null)}
      titre={t.titre}
      pied={
        <Bouton
          taille="lg"
          pleineLargeur
          variante="danger"
          icone="corbeille"
          onClick={() => {
            const s = attente?.supprimer;
            setAttente(null);
            s?.();
          }}
        >
          {t.bouton}
        </Bouton>
      }
    >
      {attente ? <CorpsSuppression titre={attente.titre} nombre={attente.nombre} /> : <span />}
    </FeuilleBas>
  );

  return { demander: (cible, supprimer) => setAttente({ ...cible, supprimer }), feuille };
}
