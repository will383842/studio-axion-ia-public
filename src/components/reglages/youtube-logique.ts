import { PROPOSITION_YOUTUBE, type ReglagesYoutube, type VisibiliteYoutube } from "@/fournisseurs/publication/zernio-youtube";

/** Logique pure de la carte « YouTube Shorts » (testée sans écran). Aucun effet sur l'envoi. */

export type BrouillonYoutube = Partial<Omit<ReglagesYoutube, "categorieId">> & { categorieId: string };

export const TEXTES_LOGIQUE_YOUTUBE = {
  resumeEteint: "Éteint : rien ne part vers YouTube tant que vous ne l'allumez pas",
  resumeAllume: "Allumé : les Shorts partent vers YouTube avec les réglages enregistrés",
  nonEnregistre: "Vos changements ne sont pas encore enregistrés : l'envoi utilise les réglages précédents.",
  eteint: "Éteint : rien ne part vers YouTube.",
  sansReglages: "Enregistrez d'abord vos réglages pour pouvoir l'allumer.",
  suggestionVisibilite: "Pour un premier essai, choisissez « Privé ».",
} as const;

const LIBELLE_VISIBILITE: Record<VisibiliteYoutube, string> = { private: "Privé", unlisted: "Non répertorié", public: "Public" };

/** Résumé de la carte repliée : dépend de l'état d'allumage enregistré. */
export function resumeCarteYoutube(actif: boolean): string {
  return actif ? TEXTES_LOGIQUE_YOUTUBE.resumeAllume : TEXTES_LOGIQUE_YOUTUBE.resumeEteint;
}

/** « Remplir avec les suggestions » : tout sauf la visibilité, qui garde la valeur courante. */
export function appliquerSuggestions(courant: BrouillonYoutube): BrouillonYoutube {
  return { ...PROPOSITION_YOUTUBE, visibilite: courant.visibilite };
}

/** Le formulaire en cours diffère-t-il des réglages enregistrés ? */
export function reglagesModifies(brouillon: BrouillonYoutube, enregistres: ReglagesYoutube | null): boolean {
  const ref: BrouillonYoutube = enregistres ?? { categorieId: "" };
  return (
    brouillon.visibilite !== ref.visibilite ||
    brouillon.categorieId !== ref.categorieId ||
    brouillon.synthetique !== ref.synthetique ||
    brouillon.pourEnfants !== ref.pourEnfants ||
    brouillon.titre !== ref.titre
  );
}

/** Détail de l'interrupteur : la visibilité réellement enregistrée. */
export function detailInterrupteur(enregistres: ReglagesYoutube | null): string {
  if (!enregistres) return `${TEXTES_LOGIQUE_YOUTUBE.eteint} ${TEXTES_LOGIQUE_YOUTUBE.sansReglages}`;
  return `${TEXTES_LOGIQUE_YOUTUBE.eteint} Allumé : les Shorts partent en ${LIBELLE_VISIBILITE[enregistres.visibilite]}.`;
}
