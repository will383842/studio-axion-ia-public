/**
 * MOTION DE SCHÉMA · K11 « MicroObjet » : banque FERMÉE des 12 micro-objets (lot L9b). PUR, sans React et SANS alias
 * « @/ » : lu tel quel par `studio-rendu` (`compositions/image-video/MicroObjet.tsx`) et par le moteur.
 *
 * Un micro-objet est une petite scène dessinée qui JOUE un bénéfice (recette `benefices`, § 4 du plan) : horloge qui
 * tourne à l'envers, jauge qui monte, post-it qui se rangent, marches d'escalier… Tous sont dessinés maison, au trait,
 * dans le style des dessins de `src/briques/dessins/registre` (contour arrondi, pas de remplissage décoratif). Aucun ne
 * porte de texte : le titre du bénéfice est dit et écrit par la carte, le micro-objet le montre.
 *
 * Claude choisit le nom dans la fiche ; un nom hors banque est refusé (`estMicroObjet`). `proposerMicroObjet` donne
 * une proposition déterministe par mots-clés (simulation, repli), jamais au hasard.
 */

/** Les 12 noms, dans l'ordre de la banque (fermée : ne s'étend que par un lot relu). */
export const NOMS_MICRO_OBJETS = [
  "horloge-envers",
  "taches-cochees",
  "post-it",
  "jauge",
  "tirelire",
  "cible",
  "graphe-monte",
  "bouton-decider",
  "course",
  "escalier",
  "calendrier",
  "engrenages",
] as const;

export type NomMicroObjet = (typeof NOMS_MICRO_OBJETS)[number];

export type MicroObjetBanque = {
  nom: NomMicroObjet;
  /** Nom lisible, pour Will (galerie, interface). */
  titre: string;
  /** Ce que la micro-animation joue, en une phrase. */
  joue: string;
  /** Débuts de mots du bénéfice qui appellent ce micro-objet (minuscules, sans accents). */
  motsCles: readonly string[];
  /** Durée de la micro-animation (s), entrée comprise ; au-delà, l'objet reste posé (léger mouvement continu). */
  dureeS: number;
};

/** Plafond de durée d'une micro-animation : elle tient dans la phrase titre du bénéfice (≈ 1,6 s, un changement visible). */
export const DUREE_MAX_MICRO_OBJET_S = 1.8;

export const MICRO_OBJETS: readonly MicroObjetBanque[] = Object.freeze([
  { nom: "horloge-envers", titre: "Horloge à l'envers", joue: "les aiguilles tournent à l'envers : du temps rendu", motsCles: ["temps", "heure", "minute", "rapide", "chronophage", "journee"], dureeS: 1.6 },
  { nom: "taches-cochees", titre: "Tâches qui se cochent", joue: "trois tâches identiques se cochent seules, en cascade", motsCles: ["tache", "automatis", "repetiti", "seul"], dureeS: 1.5 },
  { nom: "post-it", titre: "Post-it qui se rangent", joue: "trois post-it en vrac se rangent en trois colonnes", motsCles: ["clarte", "range", "structur", "organis", "idee"], dureeS: 1.6 },
  { nom: "jauge", titre: "Jauge qui monte", joue: "l'aiguille de la jauge passe du rouge au plein", motsCles: ["productivite", "efficac", "fluide", "processus", "optimis"], dureeS: 1.5 },
  { nom: "tirelire", titre: "Tirelire", joue: "deux croix s'effacent, la pièce tombe dans la tirelire", motsCles: ["cout", "economi", "argent", "perte", "rentabilite", "budget"], dureeS: 1.7 },
  { nom: "cible", titre: "Cible", joue: "la flèche se plante au centre de la cible", motsCles: ["resultat", "concret", "objectif", "precis", "juste", "impact"], dureeS: 1.4 },
  { nom: "graphe-monte", titre: "Courbe qui monte", joue: "la courbe se trace vers le haut et reste haut", motsCles: ["performance", "croissance", "grimpe", "boost", "mesur", "durable"], dureeS: 1.5 },
  { nom: "bouton-decider", titre: "Bouton «\u00a0décider\u00a0»", joue: "l'IA et les données se rejoignent, le curseur valide", motsCles: ["decision", "decide", "choix", "donnee"], dureeS: 1.7 },
  { nom: "course", titre: "Course de flèches", joue: "deux flèches en course, l'orange passe devant", motsCles: ["concurren", "avance", "devant", "depasse", "innov"], dureeS: 1.6 },
  { nom: "escalier", titre: "Escalier", joue: "les marches se construisent, une étoile au sommet", motsCles: ["competence", "confiance", "progress", "expertise", "monte"], dureeS: 1.7 },
  { nom: "calendrier", titre: "Calendrier", joue: "la page tourne, le premier jour s'entoure et se coche", motsCles: ["jour", "aujourd", "demain", "semaine", "lundi", "date"], dureeS: 1.5 },
  { nom: "engrenages", titre: "Engrenages", joue: "deux engrenages s'emboîtent et tournent ensemble", motsCles: ["methode", "outil", "accompagnement", "pratique", "approche", "systeme"], dureeS: 1.4 },
] satisfies MicroObjetBanque[]);

export function estMicroObjet(nom: string): nom is NomMicroObjet {
  return (NOMS_MICRO_OBJETS as readonly string[]).includes(nom);
}

/** Entrée de la banque ; lève une erreur sur un nom hors banque (jamais de dessin par défaut). */
export function microObjet(nom: string): MicroObjetBanque {
  const m = MICRO_OBJETS.find((o) => o.nom === nom);
  if (!m) throw new Error(`Micro-objet inconnu : « ${nom} ». La banque est fermée (${NOMS_MICRO_OBJETS.length} noms).`);
  return m;
}

/** Minuscules, sans accents ni apostrophes typographiques. */
function normaliser(texte: string): string {
  return texte
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[’']/g, " ")
    .toLowerCase();
}

/**
 * Proposition déterministe pour un bénéfice : le micro-objet dont un mot-clé commence le mot placé le plus tôt dans le
 * texte (titre d'abord, puis détail ; « jour » ne prend pas « bonjour ») ; égalité départagée par l'ordre de la banque.
 * `exclus` : déjà pris dans la même liste (deux bénéfices ne jouent jamais le même micro-objet). Rien de trouvé → `null`
 * (Claude ou Will choisit).
 */
export function proposerMicroObjet(texte: string, exclus: readonly NomMicroObjet[] = []): NomMicroObjet | null {
  const mots = normaliser(texte).split(/[^a-z0-9]+/).filter(Boolean);
  let meilleur: { nom: NomMicroObjet; position: number } | null = null;
  for (const m of MICRO_OBJETS) {
    if (exclus.includes(m.nom)) continue;
    for (const mot of m.motsCles) {
      const position = mots.findIndex((x) => x.startsWith(mot));
      if (position >= 0 && (meilleur === null || position < meilleur.position)) meilleur = { nom: m.nom, position };
    }
  }
  return meilleur?.nom ?? null;
}

/** Avancement de la micro-animation (0 → 1) à l'instant `t` (s) depuis l'apparition de l'objet. */
export function avanceMicroObjet(nom: NomMicroObjet, t: number): number {
  const d = microObjet(nom).dureeS;
  return Math.max(0, Math.min(1, t / d));
}
