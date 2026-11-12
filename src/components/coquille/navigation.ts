/**
 * NAVIGATION (AV2.1) — générée depuis cette config + le registre des formats.
 * Ajouter une entrée dans `SECTIONS_NAV` (ou `NAV_PIED`) suffit à l'ajouter au menu, ordinateur ET mobile.
 */
import type { NomIcone } from "@/components/ui/Icone";

export interface EntreeNavigation {
  href: string;
  libelle: string;
  icone: NomIcone;
  /** Préfixes d'URL qui rendent l'entrée active (en plus de href). */
  actifSur?: string[];
}

/** Pages qui allument « Mes vidéos » : la fiche des formats et l'écran de création de chacun (couverture testée contre le registre). */
export const ACTIF_SUR_VIDEOS: string[] = ["/videos", "/formats", "/cas-concret", "/image-video", "/tableau/nouvelle", "/face-camera-animee", "/demo-facecam", "/tutoriel-outil"];

/** Une section du menu : un titre (absent pour la tête du menu) et ses entrées. */
export interface SectionNavigation {
  /** Titre affiché au-dessus des entrées ; `null` = pas de titre (tête du menu). */
  titre: string | null;
  entrees: EntreeNavigation[];
}

/** « Vidéos validées » : les vidéos validées jusqu'à Buffer (visible seulement quand le réglage est allumé). */
export const ENTREE_A_PUBLIER: EntreeNavigation = { href: "/a-publier", libelle: "Vidéos validées", icone: "envoyer" };

/** « Sur le site » : la liste de ce qui est en ligne (visible seulement si un générateur est autorisé). */
export const ENTREE_SUR_LE_SITE: EntreeNavigation = { href: "/sur-le-site", libelle: "Sur le site", icone: "lien" };

/**
 * MENU EN SECTIONS (08/11, Williams : « parfaitement compréhensible, sans friction »). Source UNIQUE : la barre latérale,
 * la feuille « Plus » (mobile) et les listes à plat ci-dessous en sont tirées. Ordre du travail : créer → contenus →
 * publier et mesurer → ressources ; les écrans rares (veille, réglages) sont dans le pied, toujours visibles.
 * « Vidéos validées » et « Sur le site » s'insèrent après « Calendrier » quand ils sont allumés.
 */
export const SECTIONS_NAV: readonly SectionNavigation[] = [
  {
    titre: null,
    entrees: [{ href: "/", libelle: "Accueil", icone: "accueil" }],
  },
  {
    titre: "Mes contenus",
    entrees: [
      { href: "/videos", libelle: "Mes vidéos", icone: "film", actifSur: ACTIF_SUR_VIDEOS },
      // 18/10 : carrousels, infographies et vidéos sont trois familles distinctes (jamais sous « Mes vidéos »).
      { href: "/carrousels", libelle: "Carrousels", icone: "images" },
      { href: "/contenus", libelle: "Tous mes contenus", icone: "grille" },
      { href: "/ecrire", libelle: "Écrire", icone: "ecrire", actifSur: ["/ecrire", "/scripts", "/idees"] },
    ],
  },
  {
    titre: "Publier",
    entrees: [
      { href: "/calendrier", libelle: "Calendrier", icone: "calendrier" },
      // Écran /mots : réponses automatiques aux commentaires qui contiennent un mot-clé (mot GUIDE), validation des textes, pause.
      { href: "/mots", libelle: "Réponses automatiques", icone: "citation" },
      { href: "/mesures", libelle: "Résultats", icone: "resultats", actifSur: ["/mesures"] },
    ],
  },
  {
    titre: "Mes ressources",
    entrees: [
      { href: "/personnages", libelle: "Personnages", icone: "personnages" },
      { href: "/bibliotheque", libelle: "Bibliothèque", icone: "bibliotheque" },
      { href: "/modeles", libelle: "Mes modèles", icone: "modele" },
    ],
  },
];

/** Action de création : bouton plein sous le logo (hors liste du menu). */
export const ACTION_CREER: EntreeNavigation = { href: "/nouvelle", libelle: "Nouvelle vidéo", icone: "plus" };

/** Pied du menu (toujours visible, sous la liste qui défile). La veille des outils passe par la recherche et Réglages. */
export const NAV_PIED: readonly EntreeNavigation[] = [{ href: "/reglages", libelle: "Réglages", icone: "reglages", actifSur: ["/veille"] }];

/** Sections réellement affichées : « Vidéos validées » puis « Sur le site » juste après Calendrier, quand ils sont allumés. */
export function sectionsLaterales(avecSurLeSite = false, avecAPublier = false): SectionNavigation[] {
  return SECTIONS_NAV.map((s) => ({
    titre: s.titre,
    entrees: s.entrees.flatMap((e) => (e.href === "/calendrier" ? [e, ...(avecAPublier ? [ENTREE_A_PUBLIER] : []), ...(avecSurLeSite ? [ENTREE_SUR_LE_SITE] : [])] : [e])),
  }));
}

/** Barre latérale à plat (sections + pied), sans les entrées conditionnelles. */
export const NAV_LATERALE: EntreeNavigation[] = [SECTIONS_NAV[0].entrees[0], ACTION_CREER, ...SECTIONS_NAV.slice(1).flatMap((s) => s.entrees), ...NAV_PIED];

/** Onglets du bas (mobile) : Accueil · Vidéos · ➕ · Écrire · Plus. */
export const ONGLETS_BAS: (EntreeNavigation & { central?: boolean })[] = [
  { href: "/", libelle: "Accueil", icone: "accueil" },
  { href: "/videos", libelle: "Vidéos", icone: "film", actifSur: ACTIF_SUR_VIDEOS },
  { href: "/nouvelle", libelle: "Nouvelle vidéo", icone: "plus", central: true },
  { href: "/ecrire", libelle: "Écrire", icone: "ecrire", actifSur: ["/ecrire", "/scripts", "/idees"] },
];

const DANS_LES_ONGLETS = new Set(ONGLETS_BAS.map((o) => o.href));

/** Feuille « Plus » (mobile) : les mêmes sections que la barre, moins ce qui est déjà dans les onglets ; le pied en dernier. */
export function sectionsPlusMobile(avecSurLeSite = false, avecAPublier = false): SectionNavigation[] {
  const sections = sectionsLaterales(avecSurLeSite, avecAPublier)
    .map((s) => ({ titre: s.titre, entrees: s.entrees.filter((e) => !DANS_LES_ONGLETS.has(e.href)) }))
    .filter((s) => s.entrees.length > 0);
  return [...sections, { titre: "Compte", entrees: [...NAV_PIED] }];
}

/** Feuille « Plus » (mobile) à plat, sans les entrées conditionnelles. */
export const TUILES_PLUS: EntreeNavigation[] = sectionsPlusMobile().flatMap((s) => s.entrees);

/**
 * Barre latérale à plat. 18/10 : plus de raccourci de création ; tout passe par « Nouvelle vidéo ». Le nom et la signature
 * restent (les appelants ne bougent pas) ; la liste des formats sous « Mes vidéos » vient de `formats`, pas de cette fonction.
 */
export function navigationLaterale(formats: readonly Pick<FormatNavigation, "id" | "statut">[], avecSurLeSite = false, avecAPublier = false): EntreeNavigation[] {
  void formats; // 18/10 : plus de raccourci de création ; tout passe par Nouvelle vidéo
  if (!avecSurLeSite && !avecAPublier) return NAV_LATERALE;
  const [tete, ...reste] = sectionsLaterales(avecSurLeSite, avecAPublier);
  return [...tete.entrees, ACTION_CREER, ...reste.flatMap((s) => s.entrees), ...NAV_PIED];
}

/** Tuiles de la feuille « Plus » (mobile) à plat, avec les entrées conditionnelles quand elles sont allumées. */
export function tuilesPlusMobile(avecSurLeSite = false, avecAPublier = false): EntreeNavigation[] {
  return sectionsPlusMobile(avecSurLeSite, avecAPublier).flatMap((s) => s.entrees);
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
