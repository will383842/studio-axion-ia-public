/**
 * L5-01 : traduit un visuel (images ou PDF, avec textes alternatifs) en demande de publication (PUR).
 * Aucun envoi : la demande est un brouillon, `envoiAutorise` reste faux (rien ne part sans le geste du fondateur).
 */
import { PROFILS_RESEAUX, type Reseau } from "@/briques/visuels/reseaux";
import { verifierTexteAlternatif, type ErreurTexteAlternatif } from "./texte-alternatif-visuel";

export interface FichierVisuel {
  type: "image" | "pdf";
  cle: string;
  alt: string;
}

export type ErreurDemandeVisuel = "aucun-fichier" | "format-refuse" | "trop-de-pages" | "legende-trop-longue" | ErreurTexteAlternatif;

export interface DemandeVisuel {
  reseau: Reseau;
  medias: { cle: string; alt: string }[];
  legende?: string;
  envoiAutorise: false;
}

export type ResultatDemandeVisuel = { ok: true; demande: DemandeVisuel } | { ok: false; erreurs: ErreurDemandeVisuel[] };

export function construireDemandeVisuel(entree: { reseau: Reseau; fichiers: FichierVisuel[]; legende?: string }): ResultatDemandeVisuel {
  const { reseau, fichiers, legende } = entree;
  const profil = PROFILS_RESEAUX[reseau];
  const erreurs = new Set<ErreurDemandeVisuel>();
  if (fichiers.length === 0) erreurs.add("aucun-fichier");
  const attendu = profil.livrable === "pdf" ? "pdf" : "image";
  if (fichiers.some((f) => f.type !== attendu)) erreurs.add("format-refuse");
  else if (attendu === "pdf" && fichiers.length > 1) erreurs.add("trop-de-pages");
  if (attendu === "image" && fichiers.length > profil.pagesMax) erreurs.add("trop-de-pages");
  if (legende !== undefined && [...legende].length > profil.legendeMax) erreurs.add("legende-trop-longue");
  for (const f of fichiers) {
    const v = verifierTexteAlternatif(f.alt, reseau);
    if (!v.ok) v.erreurs.forEach((e) => erreurs.add(e));
  }
  if (erreurs.size) return { ok: false, erreurs: [...erreurs] };
  return {
    ok: true,
    demande: {
      reseau,
      medias: fichiers.map((f) => ({ cle: f.cle, alt: f.alt.trim() })),
      ...(legende !== undefined ? { legende } : {}),
      envoiAutorise: false,
    },
  };
}
