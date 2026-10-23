/**
 * BRIQUE MONTEUR — ADAPTATEURS PAR FORMAT (mission H). PUR.
 *
 * L'agent monteur est le même pour tous les formats : consignes repérées de la même façon (`consignes.ts`), ancrées
 * sur un mot de la même façon (`ancrage.ts`), réponse relue de la même façon (`operations.ts`). Ce qui change d'un
 * format à l'autre tient dans un ADAPTATEUR : son vocabulaire (schémas), son catalogue, ses règles fixes (version
 * simple, sans appel) et la liste des opérations qu'il sait appliquer. Une demande que le format ne sait pas faire
 * reçoit une réponse CLAIRE (`refusClair`), jamais un silence ni une opération appliquée à moitié.
 *
 * Adaptateurs : face caméra (`moteurs/montage-facecam/monteur/adaptateur.ts`, vocabulaire complet du lot D) ; avocat
 * (`moteurs/montage-avocat/monteur.ts`, coupé par défaut). Registre : `moteurs/monteurs.ts`.
 */
import type { z } from "zod";
import type { EntreeCatalogueMonteur } from "./catalogue";
import type { ConsigneMonteur } from "./consignes";
import type { ConsigneLue, LectureOperations } from "./operations";

/** Une consigne prête à interpréter : sa place dans la vidéo est déjà calculée (index de mots). */
export interface ConsigneAncree extends ConsigneMonteur {
  ancre: { debutMot: number; finMot: number };
}

export interface ReponseRegles<O> {
  reponse: string;
  operations: O[];
  consignes: ConsigneLue[];
}

export interface AdaptateurMonteur<O extends { type: string } = { type: string }> {
  format: string;
  /** Ce que le format sait faire (consigne de Claude, « Que puis-je demander ? »). */
  catalogue: readonly EntreeCatalogueMonteur[];
  /** Types d'opérations que le format applique vraiment. */
  typesSupportes: readonly string[];
  /** Schéma de la réponse d'UN appel (sortie structurée). */
  schemaReponse: z.ZodTypeAny;
  /** Relecture tolérante de la réponse (opération par opération). */
  lireReponse: (brut: unknown) => LectureOperations<O> | null;
  /** Version simple : règles fixes, modèles fixes, AUCUN appel. */
  reglesFixes: (consignes: ConsigneAncree[]) => ReponseRegles<O>;
  /** Exemples de « Que puis-je demander ? ». */
  exemples: (max?: number) => string[];
}

/** Libellés lisibles des familles de demandes (réponse claire quand un format ne sait pas faire). */
export const LIBELLES_FAMILLES: Record<string, string> = {
  ajouterCarte: "une carte animée",
  zoom: "un zoom",
  ecranPartage: "un écran partagé",
  miseEnPage: "une mise en page (vous sur le côté ou en vignette)",
  couleurs: "une retouche de l'image",
  son: "un réglage du son ou de la musique",
  masquerPersonne: "vous faire disparaître puis revenir",
  texteDerriere: "un texte derrière vous",
  vitesse: "un changement de vitesse",
  arretImage: "un arrêt sur image",
  titre: "un titre",
  generique: "un générique",
  couper: "couper un passage",
  retablir: "rétablir un passage",
  retirer: "retirer un élément",
  multicamera: "le montage en 3 caméras",
};

/** Réponse claire pour une demande que le format ne sait pas (encore) faire. */
export function refusClair(nomFormat: string, type: string): string {
  const quoi = LIBELLES_FAMILLES[type] ?? "cette demande";
  return `Pour une vidéo ${nomFormat}, je ne sais pas encore faire ${quoi} : rien n'a été changé.`;
}

/**
 * Familles de demandes reconnues par mots-clés (version simple, aucun appel), dans l'ordre où elles sont essayées.
 * Mêmes mots que la version simple du face caméra (lot D), plus « 3 caméras ». Sert à tout format pour savoir ce que
 * Will demande, AVANT de décider si le format sait le faire.
 */
export const FAMILLES_CONSIGNES: readonly [string, RegExp][] = [
  ["multicamera", /\b(3|trois)\s+(cameras?|angles?|cams?)\b|\bmulticam/],
  ["masquerPersonne", /cache[- ]?moi|fais[- ]moi (dispara|partir)|disparai/],
  ["texteDerriere", /derriere moi|entre le mur et moi|texte derriere/],
  ["arretImage", /arret sur image|fige l'image|freeze/],
  ["generique", /generique/],
  ["titre", /\btitre\b/],
  ["vitesse", /accelere|plus vite|ralenti|plus lent/],
  ["ecranPartage", /divise l'ecran|ecran (partage|divise)|coupe l'ecran en deux|split/],
  ["miseEnPage", /petite version de moi|vignette|en petit|mets[- ]moi a (droite|gauche)|moi a (droite|gauche)/],
  ["zoom", /zoom/],
  ["ajouterCarte", /compare|cote a cote|deux colonnes|en commun|etapes|processus|feuille de route|ligne de temps|chronologie|\bliste\b|je liste|enumere|les \d+ (points|raisons|erreurs)|chiffre|pourcentage|\d+\s?%|avant.{0,6}apres|carte|animation|spectacul|\bsobre\b/],
  ["son", /musique|nettoie le son|son propre|bruit de fond|souffle|plus fort|monte le son|moins fort|baisse le son|whoosh|bruitage/],
  ["couleurs", /plus chaud|plus froid|couleurs?|plus (vif|sature)|moins (vif|sature)|lumiere|plus clair|plus sombre|eclaire|dents|bonne mine|teint|cernes/],
  ["couper", /\bcoupe\b|enleve (ce passage|cette phrase)|supprime/],
];

const sansAccents = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/** Famille d'une consigne (type d'opération du vocabulaire commun), ou null si rien n'est reconnu. */
export function familleDeLaConsigne(texte: string): string | null {
  const t = sansAccents(texte).replace(/[’]/g, "'");
  if (/\b(pas|sans|plus)\s+(en\s+)?(3|trois)\s+cameras?\b|une seule camera/.test(t)) return "multicamera";
  return FAMILLES_CONSIGNES.find(([, m]) => m.test(t))?.[0] ?? null;
}

/** Sépare les opérations que le format sait appliquer de celles qu'il refuse (avec la réponse claire). */
export function trierOperations<O extends { type: string }>(operations: readonly O[], typesSupportes: readonly string[], nomFormat: string): { gardees: O[]; refusees: { index: number; type: string; message: string }[] } {
  const gardees: O[] = [];
  const refusees: { index: number; type: string; message: string }[] = [];
  operations.forEach((op, index) => {
    if (typesSupportes.includes(op.type)) gardees.push(op);
    else refusees.push({ index, type: op.type, message: refusClair(nomFormat, op.type) });
  });
  return { gardees, refusees };
}
