/**
 * MISES EN PAGE DU CAS CONCRET (lot L6) : le catalogue des mises en page de chaque type d'écran du corps (maquettes v2
 * validées par Will, PR #308) et ce que chacune DEMANDE au contenu de l'écran. La variante n° 0 de chaque type est la v4
 * exacte (`MISE_EN_PAGE_V4`). Une mise en page n'est tirable que si le contenu a les données qu'elle demande ; rien
 * n'est inventé : chaque chiffre, chaque texte vient des champs de l'écran (donc de la fiche et du script validé).
 *
 * Lu par le moteur (tirage, `variete.ts`) et par les compositions (garde au rendu : une mise en page non éligible est
 * rendue en v4). PUR, sans alias « @/ ».
 */
import { sansBalises } from "./mesure";
import type { ContenuEcran, TypeEcran } from "./types";

/** Variante n° 0 de chaque type : la mise en page v4 (nom gardé de L2). */
export const MISE_EN_PAGE_V4 = "v4-centree";

/** Les mises en page L6 de chaque type (ordre du catalogue de #308). */
export const MISES_EN_PAGE_L6 = Object.freeze({
  accroche: ["acc-detail-recul", "acc-page-ecrite", "acc-duel-tailles"],
  titre: ["tit-lignes-magazine", "tit-mot-objet"],
  "liste-avant": ["ava-cartes-tombent", "ava-cadran", "ava-barre-feutre"],
  etape: ["eta-schema-feutre", "eta-entrer-dedans", "eta-fantome"],
  objet: ["obj-etiquette-pend", "obj-plein-cadre"],
  preuve: ["pre-jauge-seuil", "pre-compter-objets", "pre-cases-cochees"],
  chiffre: ["chi-aplat-orange", "chi-jauge-anneau", "chi-compter-objets"],
  question: ["que-geante", "que-champ-reponse"],
  resultat: ["res-coupe-deux", "res-mois-rempli"],
} as const);

export type TypeMisEnPageL6 = keyof typeof MISES_EN_PAGE_L6;
export type CodeMiseEnPageL6 = (typeof MISES_EN_PAGE_L6)[TypeMisEnPageL6][number];
export const TYPES_MIS_EN_PAGE_L6 = Object.freeze(Object.keys(MISES_EN_PAGE_L6) as TypeMisEnPageL6[]);
/** Tous les codes L6 (sans la v4). */
export const CODES_L6: readonly CodeMiseEnPageL6[] = Object.freeze(Object.values(MISES_EN_PAGE_L6).flat() as CodeMiseEnPageL6[]);

/** Mises en page posées sur un aplat orange plein (comptées avec le fond fort : 2 écrans par vidéo au plus). */
export const APLATS_ORANGE: readonly CodeMiseEnPageL6[] = Object.freeze(["chi-aplat-orange"]);

/** Nom en français simple de chaque mise en page (code de la maquette de #308 entre parenthèses). */
export const NOMS_MISES_EN_PAGE: Readonly<Record<CodeMiseEnPageL6 | typeof MISE_EN_PAGE_V4, string>> = Object.freeze({
  "v4-centree": "La v4",
  "acc-detail-recul": "Détail puis recul (CC-ACC-A)",
  "acc-page-ecrite": "Page qui s'écrit seule (CC-ACC-B)",
  "acc-duel-tailles": "Duel de tailles (CC-ACC-C)",
  "tit-lignes-magazine": "Lignes magazine (CC-TIT-A)",
  "tit-mot-objet": "Le mot devient objet (CC-TIT-B)",
  "ava-cartes-tombent": "Cartes qui tombent (CC-AVA-A)",
  "ava-cadran": "Cadran qui se remplit (CC-AVA-B)",
  "ava-barre-feutre": "Barré au feutre (CC-AVA-C)",
  "eta-schema-feutre": "Schéma au feutre (CC-ETA-A)",
  "eta-entrer-dedans": "On entre dedans (CC-ETA-B)",
  "eta-fantome": "Fantôme qui s'allume (CC-ETA-C)",
  "obj-etiquette-pend": "L'étiquette qui pend (CC-OBJ-A)",
  "obj-plein-cadre": "Objet plein cadre (CC-OBJ-B)",
  "pre-jauge-seuil": "Jauge (CC-PRE-A)",
  "pre-compter-objets": "Compter en objets (CC-PRE-B)",
  "pre-cases-cochees": "Cases cochées (CC-PRE-C)",
  "chi-aplat-orange": "Chiffre géant sur aplat orange (CC-CHI-A)",
  "chi-jauge-anneau": "Jauge en anneau (CC-CHI-B)",
  "chi-compter-objets": "Compter en objets (CC-CHI-C)",
  "que-geante": "Question géante (CC-QUE-A)",
  "que-champ-reponse": "Lignes et champ de réponse (CC-QUE-B)",
  "res-coupe-deux": "Écran coupé en deux (CC-RES-A)",
  "res-mois-rempli": "Le mois qui se remplit (CC-RES-B)",
});

/** Vrai si `code` est une mise en page L6 du type donné. */
export function estCodeDuType(type: TypeEcran, code: unknown): code is CodeMiseEnPageL6 {
  return typeof code === "string" && type in MISES_EN_PAGE_L6 && (MISES_EN_PAGE_L6[type as TypeMisEnPageL6] as readonly string[]).includes(code);
}

/* ------------------------------------------------------------------ */
/* Données lues dans le contenu (jamais inventées)                       */
/* ------------------------------------------------------------------ */

/** Premier nombre écrit dans un texte (« 13 critères » → 13 ; « 1 300 mots » → 1300), ou `null`. */
export function nombreEcrit(texte: string): { texte: string; valeur: number } | null {
  const m = sansBalises(texte).match(/\d{1,3}(?:[  ]\d{3})+(?:,\d+)?|\d+(?:,\d+)?/);
  if (!m) return null;
  const valeur = Number(m[0].replace(/[  ]/g, "").replace(",", "."));
  return Number.isFinite(valeur) ? { texte: m[0], valeur } : null;
}

/** Part écrite dans un texte : « 100 % » → 100 / 100 ; « 75 sur 100 » ou « 3/5 » → 75 / 100, 3 / 5 ; sinon `null`. */
export function partEcrite(texte: string): { valeur: number; total: number; texte: string } | null {
  const t = sansBalises(texte);
  const pc = t.match(/(\d+(?:,\d+)?)\s?%/);
  if (pc) {
    const v = Number(pc[1].replace(",", "."));
    if (v >= 0 && v <= 100) return { valeur: v, total: 100, texte: pc[0] };
  }
  const sur = t.match(/(\d+(?:,\d+)?)\s?(?:sur|\/)\s?(\d+)/);
  if (sur) {
    const v = Number(sur[1].replace(",", "."));
    const n = Number(sur[2]);
    if (n > 0 && v >= 0 && v <= n) return { valeur: v, total: n, texte: sur[0] };
  }
  return null;
}

/** Tour complet d'une jauge selon l'unité du chiffre (« % » : 100 ; heures : 24 ; minutes, secondes : 60), ou `null`. */
export function tourDeLUnite(unite: string, nombre: number): number | null {
  const u = sansBalises(unite).trim().toLowerCase();
  const tour = /^%|pour ?cent/.test(u) ? 100 : /^(h|heures?)\b/.test(u) ? 24 : /^(min|minutes?|s|sec|secondes?)\b/.test(u) ? 60 : null;
  return tour !== null && nombre > 0 && nombre <= tour ? tour : null;
}

/** Le texte parle d'une répétition chaque jour (« chaque jour », « par jour », « quotidien »). */
export const parleDeJours = (texte: string) => /\b(chaque|par|tous les) jours?\b|quotidien/i.test(sansBalises(texte));

/** Contenu d'écran lu par les règles (forme des propriétés de la brique ; le visuel peut être calé ou résolu). */
export type ContenuMisEnPage = ContenuEcran<unknown>;

const estObjet = (v: unknown) => typeof v === "object" && v !== null && "objet" in v;

/**
 * Ce que demande chaque mise en page : vrai si le contenu a les données nécessaires. Sans elles, la mise en page n'est
 * pas tirable (et, au rendu, l'écran est dessiné en v4).
 */
export function eligible(code: CodeMiseEnPageL6, c: ContenuMisEnPage): boolean {
  switch (code) {
    case "acc-detail-recul":
    case "acc-page-ecrite":
      return c.type === "accroche" && c.lignes.length >= 1;
    case "acc-duel-tailles":
      // Le géant est un nombre ÉCRIT dans une ligne de l'accroche.
      return c.type === "accroche" && c.lignes.length >= 2 && c.lignes.some((l) => nombreEcrit(l) !== null);
    case "tit-lignes-magazine":
      return c.type === "titre" && c.lignes.length >= 1;
    case "tit-mot-objet":
      // La dernière ligne devient un tampon : un ou deux mots courts.
      return c.type === "titre" && c.lignes.length >= 1 && sansBalises(c.lignes.at(-1)!).trim().length <= 14;
    case "ava-cartes-tombent":
    case "ava-barre-feutre":
      return c.type === "liste-avant" && c.taches.length >= 2 && c.taches.length <= 6;
    case "ava-cadran":
      // Le centre du cadran est le total écrit de la fiche.
      return c.type === "liste-avant" && c.taches.length >= 2 && c.taches.length <= 6 && !!c.total?.valeur;
    case "eta-schema-feutre":
      return c.type === "etape" && c.nombreEtapes >= 3 && c.nombreEtapes <= 7 && estObjet(c.visuel);
    case "eta-entrer-dedans":
      return c.type === "etape";
    case "eta-fantome":
      return c.type === "etape" && c.nombreEtapes >= 3 && c.nombreEtapes <= 6 && estObjet(c.visuel);
    case "obj-etiquette-pend":
      return c.type === "objet" && !!c.ligne && sansBalises(c.ligne).trim().length <= 26 && estObjet(c.visuel);
    case "obj-plein-cadre":
      return c.type === "objet" && estObjet(c.visuel);
    case "pre-jauge-seuil":
      // Une part écrite dans le titre, l'étiquette ou une puce (« 100 % automatique », « 75 sur 100 »).
      return c.type === "preuve" && partDeLaPreuve(c) !== null;
    case "pre-compter-objets":
    case "pre-cases-cochees":
      return c.type === "preuve" && c.puces.length >= 2 && c.puces.length <= 4;
    case "chi-aplat-orange":
      return c.type === "chiffre" && Number.isFinite(c.nombre);
    case "chi-jauge-anneau":
      return c.type === "chiffre" && tourDeLUnite(c.unite, c.nombre) !== null;
    case "chi-compter-objets":
      return c.type === "chiffre" && Number.isInteger(c.nombre) && c.nombre >= 2 && c.nombre <= 200;
    case "que-geante":
    case "que-champ-reponse":
      return c.type === "question" && c.lignes.length >= 1;
    case "res-coupe-deux":
      return c.type === "resultat" && !!c.avant.trim() && !!c.maintenant.trim();
    case "res-mois-rempli":
      return c.type === "resultat" && [c.titre, c.ligne, c.etiquette ?? ""].some(parleDeJours);
  }
}

/** La part écrite d'une preuve (titre, étiquette, puces, dans cet ordre), ou `null`. */
export function partDeLaPreuve(c: Extract<ContenuMisEnPage, { type: "preuve" }>): { valeur: number; total: number; texte: string; source: string } | null {
  for (const s of [c.titre, c.etiquette ?? "", ...c.puces]) {
    const p = partEcrite(s);
    if (p) return { ...p, source: s };
  }
  return null;
}

/** Mises en page tirables pour un contenu : la v4, puis les mises en page L6 dont les données sont là. */
export function misesEnPageEligibles(c: ContenuMisEnPage): string[] {
  if (!(c.type in MISES_EN_PAGE_L6)) return [MISE_EN_PAGE_V4];
  return [MISE_EN_PAGE_V4, ...(MISES_EN_PAGE_L6[c.type as TypeMisEnPageL6] as readonly CodeMiseEnPageL6[]).filter((m) => eligible(m, c))];
}

/* ------------------------------------------------------------------ */
/* Raccords modernes (#308) entre deux écrans                            */
/* ------------------------------------------------------------------ */

/**
 * Les deux raccords de #308 : « objet » (la coche de l'écran qui finit grossit et devient l'écran suivant, CC-PRE-C) ;
 * « dedans » (l'écran suivant naît dans une carte et la caméra y entre, CC-ETA-B). Partout ailleurs : coupe franche.
 */
export const RACCORDS = ["objet", "dedans"] as const;
export type Raccord = (typeof RACCORDS)[number];
/** Durée du raccord de chaque côté de la coupe (s). */
export const DUREE_RACCORD_S = 0.5;

/** Types qui peuvent finir sur une coche (raccord d'objet) : une preuve, une étape avec puce. */
export function finitSurUneCoche(c: Pick<ContenuMisEnPage, "type"> & Partial<{ puces: readonly string[] }>): boolean {
  return c.type === "preuve" || (c.type === "etape" && (c.puces?.length ?? 0) > 0);
}
/** Types qui peuvent naître d'une coche (raccord d'objet). */
export const NAIT_D_UNE_COCHE: readonly TypeEcran[] = Object.freeze(["titre", "resultat", "chiffre", "etape"]);
/** Types dans lesquels on entre (raccord « dedans ») : l'écran suivant est une étape ou un objet. */
export const ON_ENTRE_DANS: readonly TypeEcran[] = Object.freeze(["etape", "objet"]);
