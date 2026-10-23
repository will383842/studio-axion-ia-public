/**
 * CHARTE DU STYLE « blocs/2 » DU TABLEAU ANIMÉ (11/10/2026) : celle de la vidéo modèle « Formation », validée par Will
 * (branche `tableau/maquettes-design-v2`, `maquettes/tableau-design-v2/video/formation/`). PUR, sans React ni alias
 * « @/ » : lu tel quel par `studio-rendu`. Le style d'avant (`charte-video/1`) n'est pas touché.
 *
 *  - Trois fonds qui alternent : encre, ivoire, orange (le sable ne sert qu'aux formes et aux libellés sur l'encre).
 *  - Titres en Montserrat ExtraBold, très gros, ajustés à la largeur ; texte en Inter Bold.
 *  - Mots forts dans des blocs (orange sur l'encre et l'ivoire, encre sur l'orange), texte ivoire.
 *  - Sur l'orange (fond d'écran ou bloc), le texte est IVOIRE FRANC (`ivoireFranc`, plus clair que l'ivoire du fond :
 *    5,3:1) ou ENCRE, jamais un ton clair proche de l'orange (relecture du 12/10/2026 : l'ivoire du fond, 4,2:1, se
 *    lisait mal sur l'orange en grand titre).
 *  - L'orange n'est JAMAIS une couleur de texte (la vidéo modèle l'écrivait sur l'ivoire à l'étape 3 : corrigé, le mot
 *    est écrit à l'encre et souligné d'orange).
 *  - Contraste : tout texte gras d'au moins `TAILLE_GRANDE_REF` px (référence 1080 de large ≈ 18,7 px CSS sur un
 *    téléphone, le « grand texte » des règles d'accessibilité) atteint 3:1 ; tout autre texte 4,5:1.
 *
 * Tailles en px pour une image de référence de 1080 de large (`k` = petit côté ÷ 1080).
 */

export const STYLE_BLOCS_2 = "blocs/2";

export const COULEURS_V2 = Object.freeze({
  encre: "#110A05",
  ivoire: "#E9DCC8",
  orange: "#B44F29",
  sable: "#BFA88B",
  /** Texte clair posé sur l'orange (fond ou bloc) : 5,3:1 sur l'orange. */
  ivoireFranc: "#FFF6E9",
} as const);

export type FondV2 = "encre" | "ivoire" | "orange";
export const FONDS_V2: readonly FondV2[] = Object.freeze(["encre", "ivoire", "orange"]);

/** Couleur du texte courant posé directement sur un fond. */
export const TEXTE_SUR: Readonly<Record<FondV2, string>> = Object.freeze({ encre: COULEURS_V2.ivoire, ivoire: COULEURS_V2.encre, orange: COULEURS_V2.ivoireFranc });
/** Texte secondaire (niveau « texte ») sur un fond : sur l'orange, l'encre (le titre reste ivoire). */
export const TEXTE_SECOND_SUR: Readonly<Record<FondV2, string>> = Object.freeze({ encre: COULEURS_V2.ivoire, ivoire: COULEURS_V2.encre, orange: COULEURS_V2.encre });
/** Fond d'un bloc de mot fort, et la couleur de son texte. */
export const BLOC_SUR: Readonly<Record<FondV2, { fond: string; texte: string }>> = Object.freeze({
  encre: { fond: COULEURS_V2.orange, texte: COULEURS_V2.ivoireFranc },
  ivoire: { fond: COULEURS_V2.orange, texte: COULEURS_V2.ivoireFranc },
  orange: { fond: COULEURS_V2.encre, texte: COULEURS_V2.ivoire },
});
/** Seules couleurs de texte permises sur l'orange (fond d'écran ou bloc). */
export const TEXTES_SUR_ORANGE: readonly string[] = Object.freeze([COULEURS_V2.ivoireFranc, COULEURS_V2.encre]);
/** Couleur des traits du crayon (soulignements, croix, coches) sur un fond. */
export const TRAIT_SUR: Readonly<Record<FondV2, string>> = Object.freeze({ encre: COULEURS_V2.orange, ivoire: COULEURS_V2.orange, orange: COULEURS_V2.encre });
/** Contours des formes (cases, cartes en pointillés) sur un fond. */
export const CONTOUR_SUR: Readonly<Record<FondV2, string>> = Object.freeze({ encre: COULEURS_V2.sable, ivoire: COULEURS_V2.encre, orange: COULEURS_V2.encre });

/** Tailles (px de référence). */
export const TAILLES_V2 = Object.freeze({
  /** Titres : ajustés à la largeur entre ces bornes. */
  titreMax: 170,
  titreMin: 58,
  /** Lignes de niveau « texte » (sous-titre d'écran). */
  texteMax: 88,
  texteMin: 52,
  /** Libellés (cases, listes, cartes) : jamais sous `libelleMin`. */
  libelle: 46,
  libelleMin: 36,
  /** En-tête : étiquette de section, signature, barre des étapes. */
  etiquette: 28,
  signature: 30,
  etapeBarre: 24,
  /** Sous-titres dans leur pastille. */
  sousTitres: 58,
  /** Signature en grand sur l'écran de fin. */
  signatureFin: 104,
});

/** Au-delà de cette taille (px de référence, texte gras), le texte est « grand » : 3:1 suffit. */
export const TAILLE_GRANDE_REF = 52;
export const CONTRASTE_GRAND_MIN = 3;
export const CONTRASTE_TEXTE_MIN = 4.5;

/** Interlignes (en tailles de police). */
export const INTERLIGNE_V2 = Object.freeze({ titre: 1.0, texte: 1.12, libelle: 1.15 });

/** Épaisseurs (px de référence). */
export const EPAISSEURS_V2 = Object.freeze({ souligne: 13, croix: 17, coche: 16, barre: 14, contour: 6, pointille: 5, gribouillis: 11 });

/** Luminance relative (WCAG) d'une couleur `#RRGGBB`. */
export function luminance(hex: string): number {
  const n = parseInt(hex.replace("#", ""), 16);
  const c = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => {
    const x = v / 255;
    return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
}

/** Rapport de contraste (1 à 21) de deux couleurs `#RRGGBB`. */
export function contraste(a: string, b: string): number {
  const la = luminance(a);
  const lb = luminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

/** Contraste exigé pour un texte gras de `taillePx` sur une image d'échelle `k`. */
export const contrasteExige = (taillePx: number, k: number) => (taillePx >= TAILLE_GRANDE_REF * k - 1e-6 ? CONTRASTE_GRAND_MIN : CONTRASTE_TEXTE_MIN);

/** Polices dessinées (mêmes familles que `charte-video/1`, chargées par `commune/polices.ts`). */
export const POLICES_V2 = Object.freeze({
  titre: Object.freeze({ famille: "Axion Montserrat ExtraBold", graisse: 800 }),
  texte: Object.freeze({ famille: "Axion Inter Bold", graisse: 700 }),
});

/** Signature : petite et fixe en haut à droite, en grand sur l'écran de fin. Jamais dite. */
export const SIGNATURE_V2 = "axion-ia.com";

/** Étiquettes de section par moment (repli quand l'écran n'en donne pas). */
export const ETIQUETTES_PAR_MOMENT: Readonly<Record<string, string | null>> = Object.freeze({
  accroche: null,
  douleur: "Le constat",
  retournement: "Le vrai problème",
  promesse: "La méthode",
  etape: "La méthode",
  exemple: "Exemple",
  recapitulatif: "En résumé",
  appel: "À vous",
});

/** Fond préféré par moment (la vidéo modèle) ; deux écrans qui se suivent n'ont jamais le même fond. */
export const FOND_PAR_MOMENT: Readonly<Record<string, FondV2>> = Object.freeze({
  accroche: "encre",
  douleur: "ivoire",
  retournement: "orange",
  promesse: "encre",
  exemple: "ivoire",
  recapitulatif: "encre",
  appel: "encre",
});
/** Étapes : fonds en cycle (ivoire, orange, ivoire, encre…). */
export const FONDS_ETAPES: readonly FondV2[] = Object.freeze(["ivoire", "orange", "ivoire", "encre"]);

/** Fin de vidéo : l'écran de fin reste au moins `tenueApresVoixMs` après la voix, puis l'image fond au noir. */
export const FIN_V2 = Object.freeze({ tenueApresVoixMs: 2500, fonduImageMs: 400 });
/** Durée ajoutée après la fin de la voix (tenue + fondu). */
export const TENUE_FIN_TOTALE_MS = FIN_V2.tenueApresVoixMs + FIN_V2.fonduImageMs;
