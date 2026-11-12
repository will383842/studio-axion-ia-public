"use client";

/**
 * CAL-25 : choix d'un fichier (vidéo, PDF, image) pour une entrée. Le fichier part par le dépôt existant (/api/depots) ;
 * ce composant ne fait que le choisir et dire clairement ce qui se passe. Un format refusé n'empêche jamais l'ajout.
 */
import { useState } from "react";
import { typeDuMime, verifierFormat } from "@/domaine/calendrier/formats-media";
import { envoyerFichier } from "@/lib/envoi-multipart";
import type { IdReseau } from "@/domaine/types";

export interface FichierChoisi {
  nom: string;
  mime: string;
  taille: number;
  /** Raison en français si le réseau refuse ce format ; l'ajout reste possible en brouillon. */
  formatRefuse?: string;
  /** Le fichier lui-même, pour l'envoi réel au moment de l'ajout. */
  fichier?: File;
}

export type ResultatEnvoiChoisi =
  | { ok: true; videoId?: string; visuelId?: string; refuse?: string }
  | { ok: false; message: string };

/**
 * Envoie réellement le fichier choisi (dépôt existant, vers l'entrée du formulaire) et renvoie l'identifiant à rattacher.
 * Un format refusé par le réseau n'est JAMAIS envoyé : l'ajout continue sans fichier, avec la raison.
 */
export async function envoyerFichierChoisi(
  fichier: File | null | undefined,
  reseau: IdReseau,
  entiteId: string,
  envoyer: typeof envoyerFichier = envoyerFichier,
): Promise<ResultatEnvoiChoisi> {
  if (!fichier) return { ok: true };
  const v = verifierFormat(reseau, { mime: fichier.type, taille: fichier.size });
  if (!v.ok) return { ok: true, refuse: v.raison };
  try {
    const { fichierId } = await envoyer(fichier, { typeEntite: "entree", entiteId });
    return typeDuMime(fichier.type) === "video" ? { ok: true, videoId: fichierId } : { ok: true, visuelId: fichierId };
  } catch {
    return { ok: false, message: "Le fichier n'a pas pu être envoyé : rien n'a été ajouté. Vérifiez la connexion et réessayez." };
  }
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
    const f: FichierChoisi = { nom: fichier.name, mime: fichier.type, taille: fichier.size, fichier, ...(v.ok ? {} : { formatRefuse: v.raison }) };
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
