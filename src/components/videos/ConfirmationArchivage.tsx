"use client";

import { useState, type ReactNode } from "react";
import { publicationsProgrammeesAction } from "@/app/(studio)/videos/actions";
import { Bouton } from "@/components/ui/Bouton";
import { FeuilleBas } from "@/components/ui/FeuilleBas";
import { LIBELLES_RETRAIT } from "@/domaine/libelles";

/**
 * Avant d'archiver : si des publications sont encore programmées, on prévient
 * (« 2 publications programmées seront retirées du calendrier ») et on demande confirmation.
 * Sans publication programmée, l'archivage part tout de suite.
 */
export function useConfirmationArchivage(): {
  demander: (ids: string[], archiver: () => void) => Promise<void>;
  feuille: ReactNode;
} {
  const [attente, setAttente] = useState<{ nombre: number; videos: number; archiver: () => void } | null>(null);

  async function demander(ids: string[], archiver: () => void) {
    const r = await publicationsProgrammeesAction(ids);
    const nombre = r.ok ? r.donnees : 0;
    if (nombre > 0) setAttente({ nombre, videos: ids.length, archiver });
    else archiver();
  }

  const feuille = (
    <FeuilleBas
      ouverte={!!attente}
      onOuverteChange={(o) => !o && setAttente(null)}
      titre={attente && attente.videos > 1 ? `${LIBELLES_RETRAIT.action} ces vidéos ?` : `${LIBELLES_RETRAIT.action} cette vidéo ?`}
      description={
        attente
          ? `${attente.nombre > 1 ? `${attente.nombre} publications programmées seront retirées` : "1 publication programmée sera retirée"} du calendrier. Rien n'est effacé : tout revient si vous choisissez « ${LIBELLES_RETRAIT.retour} ».`
          : undefined
      }
      pied={
        <Bouton
          taille="lg"
          pleineLargeur
          icone="archive"
          onClick={() => {
            const a = attente?.archiver;
            setAttente(null);
            a?.();
          }}
        >
          {LIBELLES_RETRAIT.action}
        </Bouton>
      }
    >
      <span />
    </FeuilleBas>
  );

  return { demander, feuille };
}
