/**
 * STYLE ET PLACEMENT D'UNE CARTE MOTION (facecam lot C2, décision du 09/10 « après la planche »). PUR, sans React ni
 * Remotion, et SANS alias « @/ » (lu tel quel par les compositions de `studio-rendu`).
 *
 * Deux styles, mêmes modèles, mêmes données, même charte :
 *   - « sobre » = le style validé par Will (par défaut) ;
 *   - « spectaculaire » = plus d'impact (profondeur 3D, balayages de lumière, typographie géante, éclats).
 * Choix : automatique selon l'intensité (Sobre et Équilibré → sobre ; Très dynamique → spectaculaire), une habitude
 * enregistrée (« Mes habitudes ») prime sur l'intensité, une demande explicite (« en spectaculaire », « plus sobre »)
 * prime sur tout.
 *
 * Placement (correctif de la planche) : « plein » = carte plein écran, contenu recentré et agrandi ; « haut » = le
 * placement d'origine, gardé pour la moitié haute de l'écran partagé.
 */
import type { NiveauTexte, RatioMotion } from "./jetons";

export const STYLES_MOTION = ["sobre", "spectaculaire"] as const;
export type StyleMotion = (typeof STYLES_MOTION)[number];
export const STYLE_MOTION_DEFAUT: StyleMotion = "sobre";

/** Ce que Will voit et ce que Claude lit pour chaque style (catalogue du monteur, consigne des cartes sur mesure). */
export const FICHES_STYLE_MOTION: Record<StyleMotion, { libelle: string; description: string; consigne: string }> = {
  sobre: {
    libelle: "Sobre",
    description: "Le style validé : élégant, posé, chaque élément arrive au mot près.",
    consigne: "Style sobre : mouvements doux (entrée 300-500 ms), une lumière discrète, aucun éclat ni flash.",
  },
  spectaculaire: {
    libelle: "Spectaculaire",
    description: "Même charte, plus d'impact : profondeur 3D, balayages de lumière, mots géants, chiffres qui explosent en éclats.",
    consigne:
      "Style spectaculaire : profondeur 3D (perspective, légère rotation de caméra, parallaxe en couches), balayage de lumière et halo sur le mot clé, poussières lumineuses, typographie géante qui s'écrase, s'étire ou rebondit, entrée en zoom à travers et sortie en déchirure ou éclat, flou de mouvement marqué ; toujours lisible, un seul effet fort à la fois, rien de figé plus de 1,5 s.",
  },
};

/** Intensité du montage (mêmes valeurs que `IntensiteSousTitres` du domaine). */
export type IntensiteMotion = "sobre" | "equilibre" | "tres-dynamique";

const normaliser = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[’']/g, " ")
    .replace(/\s+/g, " ")
    .trim();

/**
 * Style demandé dans une phrase de Will (« fais cette animation en spectaculaire », « plus sobre », « moins
 * spectaculaire »), ou null si la phrase n'en parle pas. « moins spectaculaire » = sobre, « moins sobre » =
 * spectaculaire.
 */
export function lireDemandeStyle(phrase: string | null | undefined): StyleMotion | null {
  if (!phrase) return null;
  const p = normaliser(phrase);
  if (/\bmoins (de )?spectacul/.test(p) || /\bpas (trop |si )?spectacul/.test(p)) return "sobre";
  if (/\bmoins sobre\b/.test(p) || /\bpas (trop |si )?sobre\b/.test(p)) return "spectaculaire";
  const spectaculaire = /\bspectacul/.test(p) || /\bplus (d )?(impact|wow|punchy)\b/.test(p);
  const sobre = /\bsobre\b/.test(p) || /\bplus (simple|calme|discret|discrete|pose|posee)\b/.test(p);
  if (spectaculaire && !sobre) return "spectaculaire";
  if (sobre && !spectaculaire) return "sobre";
  if (spectaculaire && sobre) {
    // Les deux mots : le dernier dit l'emporte (« pas sobre, en spectaculaire »).
    return p.lastIndexOf("spectacul") > p.lastIndexOf("sobre") ? "spectaculaire" : "sobre";
  }
  return null;
}

/** Une habitude : un style déjà décidé, ou des phrases de « Mes habitudes » (la dernière qui parle de style gagne). */
function lireHabitude(h: StyleMotion | string | readonly string[] | null | undefined): StyleMotion | null {
  if (!h) return null;
  if (typeof h === "string") return (STYLES_MOTION as readonly string[]).includes(h) ? (h as StyleMotion) : lireDemandeStyle(h);
  for (let i = h.length - 1; i >= 0; i--) {
    const s = lireHabitude(h[i]);
    if (s) return s;
  }
  return null;
}

/**
 * Style d'une carte. Ordre de priorité : demande explicite > habitude enregistrée > intensité > « sobre ».
 * `demande` : la phrase de Will (consigne, fil de discussion) ou un style déjà décidé ; `habitude` : un style ou les
 * phrases de « Mes habitudes ».
 */
export function choisirStyleMotion(entree: {
  intensite?: IntensiteMotion | null;
  demande?: StyleMotion | string | null;
  habitude?: StyleMotion | string | readonly string[] | null;
}): StyleMotion {
  const demande = entree.demande ? ((STYLES_MOTION as readonly string[]).includes(entree.demande) ? (entree.demande as StyleMotion) : lireDemandeStyle(entree.demande)) : null;
  if (demande) return demande;
  const habitude = lireHabitude(entree.habitude);
  if (habitude) return habitude;
  if (entree.intensite === "tres-dynamique") return "spectaculaire";
  return STYLE_MOTION_DEFAUT;
}

/* ------------------------------------------------------------------ */
/* Placement                                                             */
/* ------------------------------------------------------------------ */

export type PlacementCarte = "haut" | "plein";

/** Placement par défaut : « plein » pour une carte plein écran, « haut » pour la moitié haute d'un écran partagé. */
export function placementDe(mp: { disposition: "plein-ecran" | "moitie-haute"; placement?: PlacementCarte }): PlacementCarte {
  if (mp.disposition === "moitie-haute") return "haut";
  return mp.placement ?? "plein";
}

/**
 * Marges du placement « plein » (fraction de la hauteur et de la largeur de la vidéo) : le contenu occupe le centre
 * de l'image (de 11 % à 84 % en 9:16), sans le grand vide du bas. Les boutons des réseaux à droite restent évités.
 */
export const ZONES_PLEIN: Record<RatioMotion, { haut: number; bas: number; gauche: number; droite: number }> = {
  "9:16": { haut: 0.11, bas: 0.16, gauche: 0.075, droite: 0.09 },
  "4:5": { haut: 0.06, bas: 0.08, gauche: 0.06, droite: 0.06 },
  "1:1": { haut: 0.06, bas: 0.08, gauche: 0.06, droite: 0.06 },
};

/** Agrandissement des 4 tailles en placement « plein » : le corps (listes) passe à 4,03 % de la hauteur. */
export const FACTEURS_TAILLE_PLEIN: Record<NiveauTexte, number> = { affiche: 1.12, titre: 1.12, corps: 1.12, legende: 1.06 };

/** Facteur de taille d'un niveau selon le placement (1 en « haut » : rendu d'origine). */
export function facteurTaille(placement: PlacementCarte, niveau: NiveauTexte): number {
  return placement === "plein" ? FACTEURS_TAILLE_PLEIN[niveau] : 1;
}
