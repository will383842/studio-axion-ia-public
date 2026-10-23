/**
 * NAVIGATION (AV2.1) — générée depuis cette config + le registre des formats.
 * Ajouter une entrée ici suffit à l'ajouter au menu.
 */
import type { NomIcone } from "@/components/ui/Icone";

export interface EntreeNavigation {
  href: string;
  libelle: string;
  icone: NomIcone;
  /** Préfixes d'URL qui rendent l'entrée active (en plus de href). */
  actifSur?: string[];
}

/** Barre latérale (ordinateur). « Mes vidéos » reçoit la liste des formats en dessous. */
export const NAV_LATERALE: EntreeNavigation[] = [
  { href: "/", libelle: "Accueil", icone: "accueil" },
  { href: "/nouvelle", libelle: "Nouvelle vidéo", icone: "plus" },
  { href: "/videos", libelle: "Mes vidéos", icone: "film", actifSur: ["/videos", "/formats"] },
  // 18/10 : carrousels, infographies et vidéos sont trois familles distinctes (jamais sous « Mes vidéos »).
  { href: "/carrousels", libelle: "Carrousels", icone: "images" },
  { href: "/calendrier", libelle: "Calendrier", icone: "calendrier" },
  // Navigation (03/10) : « Mesures » et « Ce qui marche » n'étaient joignables que par une tuile de l'Accueil.
  { href: "/mesures", libelle: "Mesures", icone: "resultats" },
  { href: "/ecrire", libelle: "Écrire", icone: "ecrire", actifSur: ["/ecrire", "/scripts", "/idees"] },
  { href: "/personnages", libelle: "Personnages", icone: "personnages" },
  { href: "/bibliotheque", libelle: "Bibliothèque", icone: "bibliotheque" },
  { href: "/modeles", libelle: "Mes modèles", icone: "modele" },
  { href: "/veille", libelle: "Veille", icone: "tendance" },
  { href: "/reglages", libelle: "Réglages", icone: "reglages" },
];

/** Onglets du bas (mobile) : Accueil · Vidéos · ➕ · Écrire · Plus. */
export const ONGLETS_BAS: (EntreeNavigation & { central?: boolean })[] = [
  { href: "/", libelle: "Accueil", icone: "accueil" },
  { href: "/videos", libelle: "Vidéos", icone: "film", actifSur: ["/videos", "/formats"] },
  { href: "/nouvelle", libelle: "Nouvelle vidéo", icone: "plus", central: true },
  { href: "/ecrire", libelle: "Écrire", icone: "ecrire", actifSur: ["/ecrire", "/scripts", "/idees"] },
];

/** Feuille « Plus » (mobile) : grille de tuiles. */
export const TUILES_PLUS: EntreeNavigation[] = [
  { href: "/carrousels", libelle: "Carrousels", icone: "images" },
  { href: "/personnages", libelle: "Personnages", icone: "personnages" },
  { href: "/bibliotheque", libelle: "Bibliothèque", icone: "bibliotheque" },
  { href: "/modeles", libelle: "Mes modèles", icone: "modele" },
  { href: "/calendrier", libelle: "Calendrier", icone: "calendrier" },
  { href: "/mesures", libelle: "Mesures", icone: "resultats" },
  // Veille des outils (lot B2) : nouvelles versions de HeyGen, Remotion… (aussi dans Réglages > Outils).
  { href: "/veille", libelle: "Veille", icone: "tendance" },
  { href: "/reglages", libelle: "Réglages", icone: "reglages" },
];

/**
 * Barre latérale. 18/10 : plus de raccourci de création ; tout passe par « Nouvelle vidéo ». Le nom et la signature restent
 * (les appelants ne bougent pas) ; la liste des formats sous « Mes vidéos » vient de `formats`, pas de cette fonction.
 */
export function navigationLaterale(formats: readonly Pick<FormatNavigation, "id" | "statut">[], avecSurLeSite = false): EntreeNavigation[] {
  void formats; // 18/10 : plus de raccourci de création ; tout passe par Nouvelle vidéo
  // Vidéos sur le site (lot S3) : l'entrée n'existe que si au moins un type de vidéo est autorisé sur le site.
  return avecSurLeSite ? NAV_LATERALE.flatMap((e) => (e.href === "/mesures" ? [e, ENTREE_SUR_LE_SITE] : [e])) : NAV_LATERALE;
}

/** « Sur le site » : la liste de ce qui est en ligne (visible seulement si un générateur est autorisé). */
export const ENTREE_SUR_LE_SITE: EntreeNavigation = { href: "/sur-le-site", libelle: "Sur le site", icone: "lien" };

/** Tuiles de la feuille « Plus » (mobile), avec « Sur le site » seulement quand il est visible. */
export function tuilesPlusMobile(avecSurLeSite = false): EntreeNavigation[] {
  return avecSurLeSite ? TUILES_PLUS.flatMap((t) => (t.href === "/mesures" ? [t, ENTREE_SUR_LE_SITE] : [t])) : TUILES_PLUS;
}

export function estActif(chemin: string, e: EntreeNavigation): boolean {
  if (e.href === "/") return chemin === "/";
  return [e.href, ...(e.actifSur ?? [])].some((p) => chemin === p || chemin.startsWith(p + "/"));
}

/** Format affiché sous « Mes vidéos » dans la barre latérale. */
export interface FormatNavigation {
  id: string;
  nom: string;
  icone: NomIcone;
  statut: "actif" | "bientot" | "masque";
  nbVideos: number;
  /** Format en essai chez Will : lien normal (jamais grisé) avec une pastille « Essai ». */
  essai?: boolean;
  /** Adresse de l'écran de création du format (registre) : sert à garder la ligne allumée sur ses pages. */
  adresseCreation?: string;
}

/** La ligne d'un format est allumée sur sa fiche, sur son écran de création et sur toutes les pages en dessous. */
export function formatActif(chemin: string, f: Pick<FormatNavigation, "id" | "adresseCreation">): boolean {
  if (chemin === `/formats/${f.id}`) return true;
  const adresse = f.adresseCreation;
  return !!adresse && (chemin === adresse || chemin.startsWith(adresse + "/"));
}
