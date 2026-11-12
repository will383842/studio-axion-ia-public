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
  | { ok: true; videoId?: string; visuelId?: string; refuse?: string; nonEnvoye?: string };

export const PHRASE_FORMAT_REFUSE = "Le fichier n'a pas été envoyé : format refusé pour ce réseau. L'entrée est créée sans lui, à compléter.";
export const PHRASE_ENVOI_ECHEC = "Le fichier n'a pas été envoyé (connexion) : l'entrée est créée sans lui, à joindre ensuite.";

/**
 * Envoie réellement le fichier choisi (dépôt existant, vers l'entrée du formulaire) et renvoie l'identifiant à rattacher.
 * Un format refusé par le réseau n'est JAMAIS envoyé, et un envoi en échec non plus : dans les deux cas l'ajout continue
 * SANS fichier (un ajout manuel n'est jamais bloqué) et `nonEnvoye` donne la phrase à montrer.
 */
export async function envoyerFichierChoisi(
  fichier: File | null | undefined,
  reseau: IdReseau,
  entiteId: string,
  envoyer: typeof envoyerFichier = envoyerFichier,
): Promise<ResultatEnvoiChoisi> {
  if (!fichier) return { ok: true };
  const v = verifierFormat(reseau, { mime: fichier.type, taille: fichier.size });
  if (!v.ok) return { ok: true, refuse: v.raison, nonEnvoye: `${PHRASE_FORMAT_REFUSE} ${v.raison}` };
  try {
    const { fichierId } = await envoyer(fichier, { typeEntite: "entree", entiteId });
    return typeDuMime(fichier.type) === "video" ? { ok: true, videoId: fichierId } : { ok: true, visuelId: fichierId };
  } catch {
    return { ok: true, nonEnvoye: PHRASE_ENVOI_ECHEC };
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
      <p>Le fichier reste privé : il ne partira pas tant que vous n&apos;avez pas validé la publication.</p>
      {choisi?.formatRefuse && <p role="alert">{choisi.formatRefuse} L&apos;ajout reste possible : la publication sera un brouillon à compléter.</p>}
      {choisi && !choisi.formatRefuse && <p role="status">{choisi.nom} : format accepté pour ce réseau.</p>}
    </div>
  );
}
