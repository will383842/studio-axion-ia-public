/**
 * Sujets des extraits (X4-02) : les 12 sujets officiels + « Appels d'offres ». Fonction pure, sans IA, sans réseau.
 * `TYPES_AUTOMATISATION` n'est pas modifié : « appels-offres » vit ici, propre aux extraits.
 * Ordre de décision (étude E4 § b.4) : vidéo, script, cas concret, appels d'offres, déduction par mots.
 */
import { TYPES_AUTOMATISATION, type TypeAutomatisation } from "@/domaine/ciblage/types";
import { deduireTypeAutomatisation, normaliser } from "@/domaine/ciblage/controles";
import { typeAutomatisationDuCas } from "@/formats/cas-concret/types-catalogue";
import type { SujetExtrait } from "./types";

/** À appliquer sur un texte déjà normalisé (même `normaliser` que `controles.ts`, importé). */
export const MOTIF_APPELS_OFFRES = /\b(appels? d ?offres?|marches? publics?|dce|boamp|soumission\w*)\b/;

type CasPourSujet = Parameters<typeof typeAutomatisationDuCas>[0];

export interface EntreeSujet {
  video?: { typeAutomatisation?: TypeAutomatisation };
  script?: { typeAutomatisation?: TypeAutomatisation };
  cas?: CasPourSujet;
  texte: string;
}

export function sujetDuMoment(entree: EntreeSujet): SujetExtrait | null {
  const deVideo = entree.video?.typeAutomatisation;
  if (deVideo) return deVideo;
  const deScript = entree.script?.typeAutomatisation;
  if (deScript) return deScript;
  if (entree.cas) {
    const deCas = typeAutomatisationDuCas(entree.cas);
    if (deCas) return deCas;
  }
  if (MOTIF_APPELS_OFFRES.test(normaliser(entree.texte))) return "appels-offres";
  return deduireTypeAutomatisation(entree.texte);
}

export const LIBELLE_SUJET_EXTRAIT: Readonly<Record<SujetExtrait, string>> = {
  ...(Object.fromEntries(TYPES_AUTOMATISATION.map((t) => [t.id, t.libelle])) as Record<TypeAutomatisation, string>),
  "appels-offres": "Appels d'offres",
};
