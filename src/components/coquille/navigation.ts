/**
 * NAVIGATION (AV2.1, refonte R2) — générée depuis cette config.
 * Ajouter une entrée dans `RUBRIQUES_NAV` (ou `NAV_PIED`) suffit à l'ajouter au menu, ordinateur ET mobile.
 */
import type { NomIcone } from "@/components/ui/Icone";

export interface EntreeNavigation {
  href: string;
  libelle: string;
  icone: NomIcone;
  /** Préfixes d'URL qui rendent l'entrée active (en plus de href). */
  actifSur?: string[];
}

/** Pages qui allument « Vidéos » : la fiche des formats et l'écran de création de chacun (couverture testée contre le registre). */
export const ACTIF_SUR_VIDEOS: string[] = ["/videos", "/formats", "/cas-concret", "/image-video", "/tableau/nouvelle", "/face-camera-animee", "/demo-facecam", "/tutoriel-outil"];

/** Une section de la feuille « Plus » (mobile) : un titre (absent pour la tête) et ses entrées. */
export interface SectionNavigation {
  /** Titre affiché au-dessus des entrées ; `null` = pas de titre. */
  titre: string | null;
  entrees: EntreeNavigation[];
}

/** « Vidéos validées » : les vidéos validées jusqu'à Buffer (visible seulement quand le réglage est allumé). Libellé gardé tant que la fiche AP-01 de l'usine ne l'a pas renommé. */
export const ENTREE_A_PUBLIER: EntreeNavigation = { href: "/a-publier", libelle: "Vidéos validées", icone: "envoyer" };

/** « Sur le site » : la liste de ce qui est en ligne (visible seulement si un générateur est autorisé). */
export const ENTREE_SUR_LE_SITE: EntreeNavigation = { href: "/sur-le-site", libelle: "Sur le site", icone: "lien" };

/**
 * Une rubrique de la barre (décision de Williams du 12/11 : 7 rubriques, dont 3 pliables).
 * Avec `href` : lien simple. Avec `enfants` : rubrique pliable ; s'il ne reste qu'un enfant visible, c'est un lien direct sans pli.
 */
export interface RubriqueNavigation {
  id: string;
  libelle: string;
  /** Petit mot sous l'icône quand la barre est repliée (défaut : le libellé). */
  court?: string;
  icone: NomIcone;
  href?: string;
  actifSur?: string[];
  enfants?: EntreeNavigation[];
}

/**
 * MENU (12/11, refonte R2) : source UNIQUE de la barre latérale, des onglets du bas, de la feuille « Plus » et de la recherche.
 * Ordre : Accueil · Écrire · Mes contenus ▸ · Calendrier · Publier ▸ · Résultats · Ressources ▸. « Nouvelle vidéo » est au-dessus,
 * Réglages et Me déconnecter en dessous. « Tous mes contenus » (/contenus) et « Mes modèles » (/modeles) ne sont plus dans la barre :
 * leurs pages existent toujours et la recherche les trouve. « Infographies » viendra quand l'écran existera.
 * Les entrées de « Publier » allumées par un réglage sont ajoutées par `rubriquesLaterales`.
 */
export const RUBRIQUES_NAV: readonly RubriqueNavigation[] = [
  { id: "accueil", libelle: "Accueil", icone: "accueil", href: "/" },
  { id: "ecrire", libelle: "Écrire", icone: "ecrire", href: "/ecrire", actifSur: ["/ecrire", "/scripts", "/idees"] },
  {
    id: "contenus",
    libelle: "Mes contenus",
    court: "Contenus",
    icone: "grille",
    enfants: [
      { href: "/videos", libelle: "Vidéos", icone: "film", actifSur: ACTIF_SUR_VIDEOS },
      // 18/10 : carrousels, infographies et vidéos sont trois familles distinctes (jamais sous « Vidéos »).
      { href: "/carrousels", libelle: "Carrousels", icone: "images" },
    ],
  },
  { id: "calendrier", libelle: "Calendrier", icone: "calendrier", href: "/calendrier" },
  {
    id: "publier",
    libelle: "Publier",
    icone: "envoyer",
    // « Vidéos validées » et « Sur le site » s'ajoutent ici quand leur réglage est allumé (voir `rubriquesLaterales`).
    // Écran /mots : réponses automatiques aux commentaires qui contiennent un mot-clé (mot GUIDE), validation des textes, pause.
    enfants: [{ href: "/mots", libelle: "Réponses automatiques", icone: "citation" }],
  },
  { id: "resultats", libelle: "Résultats", icone: "resultats", href: "/mesures" },
  {
    id: "ressources",
    libelle: "Ressources",
    icone: "bibliotheque",
    enfants: [
      { href: "/personnages", libelle: "Personnages", icone: "personnages" },
      { href: "/bibliotheque", libelle: "Bibliothèque", icone: "bibliotheque" },
    ],
  },
];

/** Action de création : bouton plein sous le logo (hors liste du menu). */
export const ACTION_CREER: EntreeNavigation = { href: "/nouvelle", libelle: "Nouvelle vidéo", icone: "plus" };

/** Pied du menu (toujours visible, sous la liste qui défile). La veille des outils passe par la recherche et Réglages. */
export const NAV_PIED: readonly EntreeNavigation[] = [{ href: "/reglages", libelle: "Réglages", icone: "reglages", actifSur: ["/veille"] }];

/** Pages hors barre, gardées pour la recherche (leurs écrans existent toujours). */
export const ENTREES_HORS_BARRE: readonly EntreeNavigation[] = [
  { href: "/contenus", libelle: "Tous mes contenus", icone: "grille" },
  { href: "/modeles", libelle: "Mes modèles", icone: "modele" },
];

/** Rubriques réellement affichées : « Vidéos validées » puis « Sur le site » passent AVANT « Réponses automatiques » dans Publier quand ils sont allumés. */
export function rubriquesLaterales(avecSurLeSite = false, avecAPublier = false): RubriqueNavigation[] {
  return RUBRIQUES_NAV.map((r) => (r.id === "publier" ? { ...r, enfants: [...(avecAPublier ? [ENTREE_A_PUBLIER] : []), ...(avecSurLeSite ? [ENTREE_SUR_LE_SITE] : []), ...(r.enfants ?? [])] } : r));
}

/** Vrai si la rubrique se déplie (au moins deux sous-rubriques visibles). */
export function estPliable(r: RubriqueNavigation): boolean {
  return (r.enfants?.length ?? 0) > 1;
}

/** Où mène la rubrique : son adresse, ou sa première sous-rubrique visible. */
export function cibleRubrique(r: RubriqueNavigation): EntreeNavigation {
  if (r.enfants?.length) return r.enfants[0];
  return { href: r.href ?? "/", libelle: r.libelle, icone: r.icone, actifSur: r.actifSur };
}

/** Les entrées-pages d'une rubrique (elle-même si c'est un lien simple). */
export function entreesDeRubrique(r: RubriqueNavigation): EntreeNavigation[] {
  return r.enfants?.length ? r.enfants : [cibleRubrique(r)];
}

export function estActif(chemin: string, e: EntreeNavigation): boolean {
  if (e.href === "/") return chemin === "/";
  return [e.href, ...(e.actifSur ?? [])].some((p) => chemin === p || chemin.startsWith(p + "/"));
}

/** Adresse de l'UNIQUE entrée marquée « page en cours » (la première qui correspond), ou null. */
export function hrefCourant(chemin: string, avecSurLeSite = false, avecAPublier = false): string | null {
  const ordre = [ACTION_CREER, ...rubriquesLaterales(avecSurLeSite, avecAPublier).flatMap(entreesDeRubrique), ...NAV_PIED];
  return ordre.find((e) => estActif(chemin, e))?.href ?? null;
}

/** Identifiant de la rubrique pliable qui contient la page en cours (elle s'ouvre toute seule), ou null. */
export function rubriqueDeLaPage(chemin: string, avecSurLeSite = false, avecAPublier = false): string | null {
  const courant = hrefCourant(chemin, avecSurLeSite, avecAPublier);
  return rubriquesLaterales(avecSurLeSite, avecAPublier).find((r) => estPliable(r) && r.enfants!.some((e) => e.href === courant))?.id ?? null;
}

/** Barre latérale à plat (sans les entrées conditionnelles) : sert aux listes et aux tests. */
export const NAV_LATERALE: EntreeNavigation[] = [cibleRubrique(RUBRIQUES_NAV[0]), ACTION_CREER, ...RUBRIQUES_NAV.slice(1).flatMap(entreesDeRubrique), ...NAV_PIED];

/** Onglets du bas (mobile) : Accueil · Vidéos · ➕ · Écrire · Plus. */
export const ONGLETS_BAS: (EntreeNavigation & { central?: boolean })[] = [
  { href: "/", libelle: "Accueil", icone: "accueil" },
  { href: "/videos", libelle: "Vidéos", icone: "film", actifSur: ACTIF_SUR_VIDEOS },
  { href: "/nouvelle", libelle: "Nouvelle vidéo", icone: "plus", central: true },
  { href: "/ecrire", libelle: "Écrire", icone: "ecrire", actifSur: ["/ecrire", "/scripts", "/idees"] },
];

const DANS_LES_ONGLETS = new Set(ONGLETS_BAS.map((o) => o.href));

/**
 * Feuille « Plus » (mobile) : les mêmes rubriques que la barre, moins ce qui est déjà dans les onglets.
 * Les liens simples (Calendrier, Résultats) viennent en tête sans titre ; chaque rubrique pliable garde son titre ; Réglages en dernier.
 */
export function sectionsPlusMobile(avecSurLeSite = false, avecAPublier = false): SectionNavigation[] {
  const rubriques = rubriquesLaterales(avecSurLeSite, avecAPublier);
  const brutes: SectionNavigation[] = [
    { titre: null, entrees: rubriques.filter((r) => !r.enfants).flatMap(entreesDeRubrique) },
    ...rubriques.filter((r) => r.enfants).map((r) => ({ titre: r.libelle, entrees: r.enfants! })),
  ];
  const sections = brutes.map((s) => ({ titre: s.titre, entrees: s.entrees.filter((e) => !DANS_LES_ONGLETS.has(e.href)) })).filter((s) => s.entrees.length > 0);
  return [...sections, { titre: "Compte", entrees: [...NAV_PIED] }];
}

/** Feuille « Plus » (mobile) à plat, sans les entrées conditionnelles. */
export const TUILES_PLUS: EntreeNavigation[] = sectionsPlusMobile().flatMap((s) => s.entrees);

/**
 * Barre latérale à plat. 18/10 : plus de raccourci de création ; tout passe par « Nouvelle vidéo ». Le nom et la signature
 * restent (les appelants ne bougent pas) ; la liste des formats n'est pas dans cette fonction.
 */
export function navigationLaterale(formats: readonly Pick<FormatNavigation, "id" | "statut">[], avecSurLeSite = false, avecAPublier = false): EntreeNavigation[] {
  void formats; // 18/10 : plus de raccourci de création ; tout passe par Nouvelle vidéo
  if (!avecSurLeSite && !avecAPublier) return NAV_LATERALE;
  const [tete, ...reste] = rubriquesLaterales(avecSurLeSite, avecAPublier);
  return [...entreesDeRubrique(tete), ACTION_CREER, ...reste.flatMap(entreesDeRubrique), ...NAV_PIED];
}

/** Tuiles de la feuille « Plus » (mobile) à plat, avec les entrées conditionnelles quand elles sont allumées. */
export function tuilesPlusMobile(avecSurLeSite = false, avecAPublier = false): EntreeNavigation[] {
  return sectionsPlusMobile(avecSurLeSite, avecAPublier).flatMap((s) => s.entrees);
}

/** Format (registre) transmis à la coquille : sert à la feuille « Créer » du téléphone. */
export interface FormatNavigation {
  id: string;
  nom: string;
  icone: NomIcone;
  statut: "actif" | "bientot" | "masque";
  nbVideos: number;
  /** Format en essai chez Will : lien normal (jamais grisé) avec une pastille « Essai ». */
  essai?: boolean;
  /** Adresse de l'écran de création du format (registre). */
  adresseCreation?: string;
}

/** La ligne d'un format est allumée sur sa fiche, sur son écran de création et sur toutes les pages en dessous. */
export function formatActif(chemin: string, f: Pick<FormatNavigation, "id" | "adresseCreation">): boolean {
  if (chemin === `/formats/${f.id}`) return true;
  const adresse = f.adresseCreation;
  return !!adresse && (chemin === adresse || chemin.startsWith(adresse + "/"));
}

/** Formats proposés par la feuille « Créer » du téléphone : les formats actifs, hors essais réservés ; adresse de repli `/nouvelle/<id>`. */
export function formatsCreer(formats: readonly FormatNavigation[]): { id: string; nom: string; icone: NomIcone; href: string }[] {
  return formats.filter((f) => f.statut === "actif" && !f.essai).map((f) => ({ id: f.id, nom: f.nom, icone: f.icone, href: f.adresseCreation ?? `/nouvelle/${f.id}` }));
}
