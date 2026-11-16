/**
 * Contrôle des formats à chaque lancement (PUR, UO-09) : compare chaque ratio que le format va fabriquer aux formats
 * permis par `profilSortie(réseau, type)` et rend une alerte en français par réseau sans format compatible.
 * Jamais bloquant : une alerte informe, rien n'est refusé. La durée n'est pas contrôlée ici.
 */
import type { IdReseau, Ratio } from "@/domaine/types";
import type { TypeContenu } from "@/domaine/taxonomie-contenu";
import { obtenirReseau } from "@/reseaux";
import { profilSortie, type NiveauPreuveSortie } from "@/reseaux/profils-sortie";

export interface AlerteFormat {
  reseau: IdReseau;
  message: string;
  niveauPreuve: NiveauPreuveSortie;
}

export interface DemandeControleFormats {
  /** Ratios que le format va fabriquer. */
  ratios: readonly Ratio[];
  reseaux: readonly IdReseau[];
  /** Absent : vidéo. */
  type?: TypeContenu;
}

export function controlerFormatsAuLancement(demande: DemandeControleFormats): AlerteFormat[] {
  const type = demande.type ?? "video";
  const alertes: AlerteFormat[] = [];
  for (const reseau of new Set(demande.reseaux)) {
    const profil = profilSortie(reseau, type);
    if (profil.pris && demande.ratios.some((r) => profil.ratios.includes(r))) continue;
    const nom = obtenirReseau(reseau).nom;
    const aVerifier = profil.niveauPreuve !== "table-registre";
    const permis = profil.ratios.length > 0 ? ` (formats permis : ${profil.ratios.join(", ")})` : "";
    const base = profil.pris
      ? `Aucun format de cette vidéo (${demande.ratios.join(", ")}) ne convient à ${nom}${permis}.`
      : `${nom} ne prend pas ce type de contenu par ce canal.`;
    alertes.push({
      reseau,
      niveauPreuve: profil.niveauPreuve,
      message: aVerifier ? `${base} À vérifier : la règle de ce réseau n'est pas encore confirmée.` : base,
    });
  }
  return alertes;
}
