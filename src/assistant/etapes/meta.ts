/**
 * Métadonnées PURES de la bibliothèque d'étapes de l'assistant (PLAN B.6.2).
 * Les composants sont branchés dans ./registre.tsx (côté client).
 */
import type { EtapeBarre } from "@/components/ui/BarreEtapes";
import type { NomIcone } from "@/components/ui/Icone";

/**
 * `express` : écran « Votre vidéo » du moteur avocat (5 blocs en feuilles compactes, B.9). Clé posée au lot M0 ;
 * l'écran et la bascule de `formatAvocat.etapes` sur ["express", "fabrication"] sont arrivés ensemble au lot M3.
 */
export const CLES_ETAPES = ["sujet", "script", "distribution", "medias", "reglages", "apercu", "express", "fabrication"] as const;
export type CleEtape = (typeof CLES_ETAPES)[number];

export interface MetaEtape {
  cle: CleEtape;
  titre: string;
  /** Libellé de la barre d'étapes (court). */
  court: string;
  icone: NomIcone;
  /** Libellé du bouton principal collé en bas. */
  action: string;
  /** L'étape peut s'afficher repliée en une ligne quand tout a une valeur par défaut (AV2.4-5). */
  repliable: boolean;
  /** L'étape affiche elle-même son action principale (Aperçu : coût + confirmation ; Fabrication). */
  actionPropre?: boolean;
  /** L'étape occupe tout l'écran (Fabrication). */
  pleinEcran?: boolean;
}

export const META_ETAPES: Record<CleEtape, MetaEtape> = {
  sujet: { cle: "sujet", titre: "De quoi parle-t-on ?", court: "Sujet", icone: "idee", action: "Continuer", repliable: false },
  script: { cle: "script", titre: "Le texte", court: "Texte", icone: "ecrire", action: "Continuer", repliable: false },
  distribution: { cle: "distribution", titre: "Qui parle ?", court: "Qui", icone: "personnages", action: "Continuer", repliable: true },
  medias: { cle: "medias", titre: "Mes images", court: "Images", icone: "images", action: "Continuer", repliable: true },
  reglages: { cle: "reglages", titre: "Le style", court: "Style", icone: "curseurs", action: "Voir l'aperçu", repliable: true },
  apercu: { cle: "apercu", titre: "Aperçu", court: "Aperçu", icone: "oeil", action: "Fabriquer", repliable: false, actionPropre: true },
  express: { cle: "express", titre: "Votre vidéo", court: "Vidéo", icone: "clap", action: "Fabriquer", repliable: false, actionPropre: true },
  fabrication: { cle: "fabrication", titre: "Fabrication", court: "Fabrication", icone: "clap", action: "Voir ma vidéo", repliable: false, actionPropre: true, pleinEcran: true },
};

export function estCleEtape(x: string): x is CleEtape {
  return (CLES_ETAPES as readonly string[]).includes(x);
}

/** Barre d'étapes de l'écran « Votre vidéo » (express) : l'écran, puis la fabrication. */
export const ETAPES_EXPRESS: EtapeBarre[] = [
  { cle: "express", libelle: "Votre vidéo" },
  { cle: "fabrication", libelle: "Fabrication" },
];
