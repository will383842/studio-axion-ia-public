import type { EtatChaineYoutube } from "@/domaine/chaine-youtube";
import { PROPOSITION_YOUTUBE, type ReglagesYoutube, type VisibiliteYoutube } from "@/fournisseurs/publication/zernio-youtube";

/** Logique pure de la carte « YouTube Shorts » (testée sans écran). Aucun effet sur l'envoi. */

export type BrouillonYoutube = Partial<Omit<ReglagesYoutube, "categorieId">> & { categorieId: string };

export const TEXTES_LOGIQUE_YOUTUBE = {
  resumeEteint: "Éteint : rien ne part vers YouTube tant que vous ne l'allumez pas",
  resumeAllume: "Allumé : les Shorts partent vers YouTube avec les réglages enregistrés",
  nonEnregistre: "Vos changements ne sont pas encore enregistrés : l'envoi utilise les réglages précédents.",
  eteint: "Éteint : rien ne part vers YouTube.",
  sansReglages: "Enregistrez d'abord vos réglages pour pouvoir l'allumer.",
  allumeBloque: "Allumé, mais rien ne part : les réglages enregistrés sont absents ou ne sont pas valides. Enregistrez-les à nouveau pour que l'envoi reprenne.",
  enregistrerD: "Enregistrez d'abord vos changements pour pouvoir allumer l'envoi.",
  chaineAbsente: "Impossible d'allumer : aucune chaîne YouTube n'est reliée.",
  chaineInconnue: "Impossible d'allumer : l'état de la chaîne n'est pas connu. Utilisez « Tester » dans « Vos comptes de publication ».",
  chaineDeconnectee: "Impossible d'allumer : la chaîne YouTube est déconnectée. Reconnectez-la d'abord.",
  confirmerPublic: "Oui, je veux que les prochains Shorts soient publics tout de suite.",
  baseChangee: "Les réglages enregistrés ont changé pendant que vous modifiiez ce formulaire. Vos modifications sont gardées ; vous pouvez reprendre les réglages enregistrés.",
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

/** Détail de l'interrupteur : le texte qui correspond à l'état réel (allumé ou éteint) et à la visibilité enregistrée. */
export function detailInterrupteur(actif: boolean, enregistres: ReglagesYoutube | null): string {
  if (actif) {
    if (!enregistres) return TEXTES_LOGIQUE_YOUTUBE.allumeBloque;
    return `Allumé : les Shorts partent en ${LIBELLE_VISIBILITE[enregistres.visibilite]}.`;
  }
  if (!enregistres) return `${TEXTES_LOGIQUE_YOUTUBE.eteint} ${TEXTES_LOGIQUE_YOUTUBE.sansReglages}`;
  return `${TEXTES_LOGIQUE_YOUTUBE.eteint} Allumé : les Shorts partent en ${LIBELLE_VISIBILITE[enregistres.visibilite]}.`;
}

/** Interrupteur grisé ? Éteindre reste toujours possible ; allumer demande réglages enregistrés, formulaire à jour et chaîne reliée. */
export function etatInterrupteur(e: { enCours: boolean; actif: boolean; reglages: ReglagesYoutube | null; modifie: boolean; chaine: EtatChaineYoutube }): { desactive: boolean; raison: string | null } {
  if (e.actif) return { desactive: e.enCours, raison: null };
  let raison: string | null = null;
  if (!e.reglages) raison = TEXTES_LOGIQUE_YOUTUBE.sansReglages;
  else if (e.modifie) raison = TEXTES_LOGIQUE_YOUTUBE.enregistrerD;
  else if (e.chaine.etat === "absent") raison = TEXTES_LOGIQUE_YOUTUBE.chaineAbsente;
  else if (e.chaine.etat === "inconnu") raison = TEXTES_LOGIQUE_YOUTUBE.chaineInconnue;
  else if (e.chaine.etat === "deconnecte") raison = TEXTES_LOGIQUE_YOUTUBE.chaineDeconnectee;
  return { desactive: e.enCours || raison !== null, raison };
}

/** Enregistrer passerait la visibilité à « public » alors que l'envoi est allumé : effet immédiat, donc confirmation. */
export function confirmationPublicRequise(actif: boolean, enregistres: ReglagesYoutube | null, brouillon: BrouillonYoutube): boolean {
  return actif && brouillon.visibilite === "public" && enregistres?.visibilite !== "public";
}

export const memesReglages = (a: ReglagesYoutube | null, b: ReglagesYoutube | null) => (a && b ? !reglagesModifies(a, b) : a === b);

/**
 * La base a changé (après un rafraîchissement) : formulaire sans modification en cours → recalé sur la base ;
 * sinon on garde les modifications et on avertit.
 */
export function recalerFormulaire(brouillon: BrouillonYoutube, precedent: ReglagesYoutube | null, nouveau: ReglagesYoutube | null): { brouillon: BrouillonYoutube; avertir: boolean } {
  if (memesReglages(precedent, nouveau)) return { brouillon, avertir: false };
  if (!reglagesModifies(brouillon, nouveau)) return { brouillon, avertir: false }; // ex. : l'utilisateur vient d'enregistrer ce formulaire
  if (!reglagesModifies(brouillon, precedent)) return { brouillon: nouveau ?? { categorieId: "" }, avertir: false };
  return { brouillon, avertir: true };
}
