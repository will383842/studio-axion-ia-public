/**
 * LES TROIS STYLES DU TABLEAU ANIMÉ « on écrit sur un vrai tableau » (maquettes validées, PR #280, dossier
 * `maquettes/tableau-v2/`, le 16/10/2026) : A tableau blanc premium (feutre, aimants, post-it orange), B ardoise Axion
 * (craie ivoire et terracotta), C paperboard d'atelier (marqueurs, surligneur, ruban). PUR, sans alias « @/ » :
 * importable par Remotion.
 *
 * Choix du style (décision par défaut du 16/10/2026, Will n'a pas tranché ; modifiable ici et par vidéo) : UN STYLE PAR
 * SÉRIE (`STYLE_PAR_SERIE`) ; le champ facultatif `styleTableau` de la fiche prend le dessus ; une série inconnue
 * retombe sur le paperboard.
 *
 * Charte : #110A05 (encre), #B44F29 (terracotta), #E9DCC8 (ivoire), #BFA88B (sable), et leurs teintes dérivées ;
 * aucun vert, aucun bleu.
 */

export const STYLES_TABLEAU = ["tableau-blanc", "ardoise", "paperboard"] as const;
export type StyleTableau = (typeof STYLES_TABLEAU)[number];

/** Le style de chaque série (une seule table, modifiable). */
export const STYLE_PAR_SERIE: Readonly<Record<string, StyleTableau>> = Object.freeze({
  formation: "ardoise",
  automatisations: "tableau-blanc",
  audit: "paperboard",
  coaching: "paperboard",
});

/** Style d'une série absente de la table. */
export const STYLE_TABLEAU_PAR_DEFAUT: StyleTableau = "paperboard";

export const estStyleTableau = (x: unknown): x is StyleTableau => typeof x === "string" && (STYLES_TABLEAU as readonly string[]).includes(x);

/** Style d'une fiche : son `styleTableau` s'il est connu, sinon celui de sa série, sinon le paperboard. */
export function styleTableauDe(fiche: { styleTableau?: string; serie?: { code?: string } }): StyleTableau {
  if (estStyleTableau(fiche.styleTableau)) return fiche.styleTableau;
  return STYLE_PAR_SERIE[fiche.serie?.code ?? ""] ?? STYLE_TABLEAU_PAR_DEFAUT;
}

/** Nom affiché de chaque style. */
export const NOMS_STYLES_TABLEAU: Readonly<Record<StyleTableau, string>> = { "tableau-blanc": "Tableau blanc", ardoise: "Ardoise", paperboard: "Paperboard" };

/** Polices manuscrites (fichiers libres, licences dans `studio-rendu/compositions/commune/polices/`). */
export type PoliceTableau = "marker" | "kalam" | "caveat";
export const FAMILLES_TABLEAU: Readonly<Record<PoliceTableau, string>> = { marker: "Permanent Marker", kalam: "Kalam Bold", caveat: "Caveat Brush" };

/** La matière de l'encre : feutre (bord chargé, stries), craie (grain, poussière), marqueur (buvardage, grain du papier). */
export type MatiereTableau = "feutre" | "craie" | "marqueur";

export interface CharteTableau {
  style: StyleTableau;
  matiere: MatiereTableau;
  /** Surface d'écriture (couleur sous le texte, pour les contrastes). */
  fond: string;
  /** Encre principale, accent (traits orange), accent écrit (texte orange : contraste ≥ 4,5:1 sur le fond). */
  encre: string;
  accent: string;
  accentTexte: string;
  /** Texte secondaire (étiquettes « Avant », « Étape 1 sur 3 », chapitres à venir). */
  doux: string;
  /** Remplissages des dessins (clair et moyen) et ombres hachurées. */
  clair: string;
  moyen: string;
  ombre: string;
  /** Surligneur (paperboard). */
  surligneur?: string;
  /** Polices : titres, corps, chiffres. */
  titre: PoliceTableau;
  corps: PoliceTableau;
  chiffres: PoliceTableau;
  /** Titres en capitales (feutre « Permanent Marker »). */
  capitales: boolean;
  /** Mise en page : alignée à gauche (A, C) ou centrée, symétrique (B). */
  centre: boolean;
  /** Carte, post-it, bouton : leur fond (le texte y garde 4,5:1). Le bouton d'appel est plein, terracotta #B44F29, dans
   * les trois styles (critique #291, I5), son texte ivoire clair #FBF7EF (4,8:1). */
  fondPostit: string;
  fondCarte: string;
  fondBouton: string;
  encreBouton: string;
  /** Rubans des chapitres (paperboard) : actif, passé, à venir. */
  rubans?: { actif: string; passe: string; avenir: string };
}

/** Les trois chartes, reprises des maquettes (`gabarit.html`, objet `STYLES`). */
export const CHARTES_TABLEAU: Readonly<Record<StyleTableau, CharteTableau>> = Object.freeze({
  "tableau-blanc": {
    style: "tableau-blanc",
    matiere: "feutre",
    fond: "#F4F2EE",
    encre: "#110A05",
    accent: "#B44F29",
    accentTexte: "#A8461F",
    doux: "#6E5A48",
    clair: "#E3D3BA",
    moyen: "#C7AC86",
    ombre: "#110A05",
    titre: "marker",
    corps: "kalam",
    chiffres: "caveat",
    capitales: true,
    centre: false,
    fondPostit: "#C8602F",
    fondCarte: "#FBF7EF",
    fondBouton: "#B44F29",
    encreBouton: "#FBF7EF",
  },
  ardoise: {
    style: "ardoise",
    matiere: "craie",
    fond: "#140E09",
    encre: "#E9DCC8",
    accent: "#D97A52",
    accentTexte: "#D97A52",
    doux: "#BFA88B",
    clair: "#E9DCC8",
    moyen: "#BFA88B",
    ombre: "#BFA88B",
    titre: "kalam",
    corps: "kalam",
    chiffres: "caveat",
    capitales: false,
    centre: true,
    fondPostit: "#140E09",
    fondCarte: "#140E09",
    fondBouton: "#B44F29",
    encreBouton: "#FBF7EF",
  },
  paperboard: {
    style: "paperboard",
    matiere: "marqueur",
    fond: "#F3EBDD",
    encre: "#110A05",
    accent: "#B44F29",
    accentTexte: "#9E3F1C",
    doux: "#6E5A48",
    clair: "#E6D6BC",
    moyen: "#CDB28C",
    ombre: "#110A05",
    surligneur: "#BFA88B",
    titre: "caveat",
    corps: "caveat",
    chiffres: "caveat",
    capitales: false,
    centre: false,
    fondPostit: "#C8602F",
    fondCarte: "#E9DDC8",
    fondBouton: "#B44F29",
    encreBouton: "#FBF7EF",
    rubans: { actif: "#E3A07C", passe: "#D8C3A2", avenir: "#E2D2B6" },
  },
});

/** Noms des chapitres de la barre, dans l'ordre. */
export const CHAPITRES_TABLEAU = ["Douleur", "Solution", "Exemple", "À vous"] as const;

/** Rang du chapitre d'une partie de page (accroche et douleur → Douleur ; solution → Solution ; exemple, à retenir → Exemple ; appel → À vous). */
export function chapitreDePartie(role: string): number {
  switch (role) {
    case "accroche":
    case "douleur":
      return 0;
    case "solution":
      return 1;
    case "exemple":
    case "retenir":
      return 2;
    case "appel":
      return 3;
    default:
      return 0;
  }
}

/* ------------------------------------------------------------------ */
/* Contrastes (WCAG)                                                     */
/* ------------------------------------------------------------------ */

const rgb = (hex: string): [number, number, number] => {
  const n = parseInt(hex.replace("#", "").slice(0, 6), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};

/** Luminance relative d'une couleur « #RRGGBB ». */
export function luminanceTableau(hex: string): number {
  return rgb(hex)
    .map((v) => {
      const c = v / 255;
      return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
    })
    .reduce((s, v, i) => s + v * [0.2126, 0.7152, 0.0722][i], 0);
}

/** Rapport de contraste de deux couleurs (1 à 21). */
export function contrasteTableau(a: string, b: string): number {
  const [x, y] = [luminanceTableau(a), luminanceTableau(b)].sort((m, n) => n - m);
  return (x + 0.05) / (y + 0.05);
}

/** Couleur `a` posée avec l'opacité `alpha` sur `fond` (« #RRGGBB »). */
export function melangeTableau(a: string, fond: string, alpha: number): string {
  const [r1, g1, b1] = rgb(a);
  const [r2, g2, b2] = rgb(fond);
  const m = (x: number, y: number) => Math.round(y + (x - y) * alpha);
  return `#${[m(r1, r2), m(g1, g2), m(b1, b2)].map((v) => v.toString(16).padStart(2, "0")).join("")}`.toUpperCase();
}

/** Teinte (degrés), saturation et valeur (0 à 1) d'une couleur : contrôle « aucun vert, aucun bleu ». */
export function tsvTableau(hex: string): { h: number; s: number; v: number } {
  const [r, g, b] = rgb(hex).map((x) => x / 255);
  const mx = Math.max(r, g, b);
  const mn = Math.min(r, g, b);
  const d = mx - mn;
  let h = 0;
  if (d > 1e-9) h = mx === r ? (60 * ((g - b) / d) + 360) % 360 : mx === g ? 60 * ((b - r) / d) + 120 : 60 * ((r - g) / d) + 240;
  return { h, s: mx > 0 ? d / mx : 0, v: mx };
}

/** Vrai pour une couleur verte, bleue ou violette (teinte 70° à 290°, saturée et visible) : hors charte. */
export const horsCharteTableau = (hex: string) => {
  const c = tsvTableau(hex);
  return c.h > 70 && c.h < 290 && c.s > 0.12 && c.v > 0.12;
};
