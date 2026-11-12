/**
 * Pages du studio trouvables par la recherche (Ctrl/⌘ K), 08/11 : taper « réglages », « calendrier », « paramètres »
 * propose la page. Liste tirée de la navigation (une seule source) + quelques pages utiles hors menu. Fichier pur.
 */
import type { NomIcone } from "@/components/ui/Icone";
import { ACTION_CREER, ENTREE_A_PUBLIER, ENTREE_SUR_LE_SITE, ENTREES_HORS_BARRE, entreesDeRubrique, NAV_PIED, RUBRIQUES_NAV } from "./navigation";

export interface PageTrouvee {
  href: string;
  libelle: string;
  icone: NomIcone;
}

interface PageRecherchable extends PageTrouvee {
  /** Mots qui mènent aussi à cette page (sans accent, minuscules). */
  synonymes: string[];
  /** Page allumée par un réglage : proposée seulement quand il l'est. */
  condition?: "aPublier" | "surLeSite";
}

/** Synonymes simples, par adresse de page. */
const SYNONYMES: Record<string, string[]> = {
  "/reglages": ["parametres", "parametre", "options", "configuration"],
  "/calendrier": ["planning", "agenda"],
  "/mesures": ["mesures", "statistiques", "stats", "resultats", "chiffres"],
  "/ecrire": ["scripts", "idees", "script", "idee", "texte"],
  "/mots": ["mots-cles", "mot-cle", "mots cles", "commentaires", "reponses"],
  "/nouvelle": ["creer", "nouveau", "generer"],
  "/videos": ["videos", "video"],
  "/a-publier": ["publier", "buffer"],
  "/contenus": ["contenus", "tout", "toutes mes videos"],
  "/modeles": ["modele", "gabarit", "gabarits"],
};

const HORS_MENU: PageRecherchable[] = [
  { href: "/veille", libelle: "Veille des outils", icone: "tendance", synonymes: ["veille", "nouveautes", "mises a jour"] },
  { href: "/bibliotheque/animations?onglet=studio", libelle: "Animations du studio", icone: "baguette", synonymes: ["motion", "animations", "outils motion design"] },
  { href: "/mesures/ce-qui-marche", libelle: "Ce qui marche", icone: "resultats", synonymes: ["succes", "meilleures", "performances"] },
  { href: "/videos/a-ranger", libelle: "Vidéos à ranger", icone: "film", synonymes: ["ranger", "rangement", "non classees"] },
];

/** Minuscules, sans accent ni majuscule : « Réglages » = « reglages ». */
export function simplifier(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function toutes(): PageRecherchable[] {
  const menu = [...RUBRIQUES_NAV.flatMap(entreesDeRubrique), ACTION_CREER, ...NAV_PIED, ...ENTREES_HORS_BARRE, ENTREE_A_PUBLIER, ENTREE_SUR_LE_SITE];
  const depuisMenu = menu.map((e): PageRecherchable => ({
    href: e.href,
    libelle: e.libelle,
    icone: e.icone,
    synonymes: SYNONYMES[e.href] ?? [],
    condition: e.href === ENTREE_A_PUBLIER.href ? "aPublier" : e.href === ENTREE_SUR_LE_SITE.href ? "surLeSite" : undefined,
  }));
  return [...depuisMenu, ...HORS_MENU];
}

/** Rang de correspondance : 0 = le libellé commence par la requête, 1 = un synonyme, 2 = le libellé la contient ; null = rien. */
function rang(p: PageRecherchable, q: string): number | null {
  const lib = simplifier(p.libelle);
  if (lib.startsWith(q) || lib.split(/[\s-]+/).some((m) => m.startsWith(q))) return 0;
  if (p.synonymes.some((s) => s.startsWith(q))) return 1;
  if (lib.includes(q)) return 2;
  return null;
}

/** Au plus `max` pages dont le nom ou un synonyme correspond à `requete`, les mieux placées d'abord. */
export function pagesTrouvees(requete: string, options: { aPublier?: boolean; surLeSite?: boolean } = {}, max = 5): PageTrouvee[] {
  const q = simplifier(requete);
  if (q.length < 2) return [];
  return toutes()
    .filter((p) => !p.condition || options[p.condition])
    .map((p, i) => ({ p, r: rang(p, q), i }))
    .filter((x): x is { p: PageRecherchable; r: number; i: number } => x.r !== null)
    .sort((a, b) => a.r - b.r || a.i - b.i)
    .slice(0, max)
    .map(({ p }) => ({ href: p.href, libelle: p.libelle, icone: p.icone }));
}
