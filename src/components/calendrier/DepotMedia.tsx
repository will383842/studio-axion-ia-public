"use client";

/**
 * CAL-25 : choix d'un fichier (vidéo, PDF, image) pour une entrée. Le fichier part par le dépôt existant (/api/depots) ;
 * ce composant ne fait que le choisir et dire clairement ce qui se passe. Un format refusé n'empêche jamais l'ajout.
 */
import { useState } from "react";
import { verifierFormat } from "@/domaine/calendrier/formats-media";
import type { IdReseau } from "@/domaine/types";

export interface FichierChoisi {
  nom: string;
  mime: string;
  taille: number;
  /** Raison en français si le réseau refuse ce format ; l'ajout reste possible en brouillon. */
  formatRefuse?: string;
}

export function DepotMedia({ reseau, onMedia }: { reseau: IdReseau; onMedia: (f: FichierChoisi | null) => void }) {
  const [choisi, setChoisi] = useState<FichierChoisi | null>(null);

  function choisir(fichier: File | undefined) {
    if (!fichier) {
      setChoisi(null);
      onMedia(null);
      return;
    }
    const v = verifierFormat(reseau, { mime: fichier.type, taille: fichier.size });
    const f: FichierChoisi = { nom: fichier.name, mime: fichier.type, taille: fichier.size, ...(v.ok ? {} : { formatRefuse: v.raison }) };
    setChoisi(f);
    onMedia(f);
  }

  return (
    <div>
      <label>Choisir un fichier (vidéo, PDF, image) <input type="file" accept="video/mp4,application/pdf,image/png,image/jpeg" onChange={(e) => choisir(e.target.files?.[0])} /></label>
      <p>Le fichier reste privé : il ne partira pas tant que vous n'avez pas validé la publication.</p>
      {choisi?.formatRefuse && <p role="alert">{choisi.formatRefuse} L'ajout reste possible : la publication sera un brouillon à compléter.</p>}
      {choisi && !choisi.formatRefuse && <p role="status">{choisi.nom} : format accepté pour ce réseau.</p>}
    </div>
  );
}
