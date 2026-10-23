/**
 * L6 · GÉOMÉTRIE DES MISES EN PAGE (pur : ni `remotion` ni React). Le cadre de l'écran (9:16 ou 4:5), la pose d'un
 * texte AJUSTÉ (taille réduite par pas de 4 px, retour à la ligne entre les mots, jamais sous un plancher), et le
 * contrôle « rien ne déborde » d'une disposition : textes dans la zone utile, formes dans la zone de dessin (au-dessus
 * des sous-titres), décors dans l'image.
 */
import { ajuster, enCapitales, largeurTexte, motsBalises, PAS_AJUSTEMENT_PX, type BoitePx, type Fond, type PoliceEcrans, type ProprietesEcran } from "../../../../src/briques/ecrans-motion";
import { COULEURS_DUO } from "../../../../src/briques/habillage/charte-duo";

export const C = COULEURS_DUO;

/** Le cadre d'un écran : largeur, hauteur, zone utile (textes), zone de dessin (formes), marges du texte. */
export function cadre(p: Pick<ProprietesEcran, "largeur" | "hauteur" | "zone" | "dessin">) {
  const z = p.zone;
  const d = p.dessin ?? p.zone;
  const x = Math.max(z.x, Math.round(p.largeur * 0.0667));
  const largeurTexte = Math.min(z.x + z.largeur, p.largeur - x) - x;
  return {
    L: p.largeur,
    H: p.hauteur,
    /** 4:5 (ou plus bas) : moins de hauteur, tailles et pas réduits. */
    r45: p.hauteur / p.largeur < 1.5,
    zone: z,
    dessin: d,
    /** Bord gauche et largeur du texte (72 px en 1080 de large, dans la zone utile). */
    x,
    largeur: largeurTexte,
    /** Haut du contenu (sous la marque) et bas de la zone utile. */
    haut: z.y + Math.round(p.hauteur * 0.055),
    bas: z.y + z.hauteur,
    basDessin: Math.min(d.y + d.hauteur, z.y + z.hauteur),
  };
}
export type Cadre = ReturnType<typeof cadre>;

/** Un texte posé : ses lignes (balisage `*mot*` gardé), sa police, sa taille rendue et sa boîte. */
export type TexteL6 = {
  nom: string;
  lignes: string[];
  police: PoliceEcrans;
  taille: number;
  interligne: number;
  boite: BoitePx;
  align: "left" | "center" | "right";
  /** Le texte tient à la taille rendue (faux : il déborde même au plancher). */
  tient: boolean;
  /** Approche (em) et capitales (étiquettes en Inter). */
  approche?: number;
  capitales?: boolean;
};

const mesure = (t: string, police: PoliceEcrans, taille: number, approche = 0, capitales = false) => largeurTexte(police === "anton" || capitales ? enCapitales(t) : t, police, taille, approche);

/** Coupe un texte en lignes de `largeur` px au plus (entre les mots ; balisage d'accent gardé mot par mot). */
export function couper(texte: string, police: PoliceEcrans, taille: number, largeur: number, approche = 0, capitales = false): string[] {
  // Une ponctuation haute (« ? », « ! », « : ») reste collée au mot qui la précède : jamais seule en début de ligne.
  const mots = motsBalises(texte)
    .map((m) => (m.accent ? `*${m.mot}*` : m.mot))
    .reduce<string[]>((l, m) => (l.length && /^[?!:;»]+\*?$/.test(m) ? [...l.slice(0, -1), `${l.at(-1)} ${m}`] : [...l, m]), []);
  const lignes: string[] = [];
  let cur = "";
  for (const m of mots) {
    const essai = cur ? `${cur} ${m}` : m;
    if (cur && mesure(essai, police, taille, approche, capitales) > largeur) {
      lignes.push(cur);
      cur = m;
    } else cur = essai;
  }
  if (cur) lignes.push(cur);
  // Accents contigus fusionnés (« *tout* *seul* » → « *tout seul* »), pour un rendu identique au texte d'origine.
  return lignes.map((l) => l.replace(/\* \*/g, " "));
}

export type OptionsPose = {
  police: PoliceEcrans;
  taille: number;
  x: number;
  y: number;
  largeur: number;
  /** Lignes au plus pour UN texte (retour à la ligne entre les mots) ; une liste de textes : une ligne chacun. */
  lignesMax?: number;
  plancher?: number;
  interligne?: number;
  align?: TexteL6["align"];
  approche?: number;
  capitales?: boolean;
};

/**
 * Pose un texte (ou plusieurs lignes imposées) : la plus grande taille ≤ `taille` où chaque ligne tient dans `largeur`
 * (et, pour un texte coupé, en `lignesMax` lignes au plus). La boîte a la largeur demandée et la hauteur des lignes.
 */
export function poser(nom: string, texte: string | readonly string[], o: OptionsPose): TexteL6 {
  const plancher = Math.min(o.taille, o.plancher ?? Math.max(24, Math.round(o.taille * 0.35)));
  const interligne = o.interligne ?? (o.police === "anton" ? 1.0 : 1.18);
  const essai = (taille: number) => {
    const ap = o.approche ?? 0;
    const lignes = typeof texte === "string" ? couper(texte, o.police, taille, o.largeur, ap, o.capitales) : [...texte];
    const tient = lignes.length <= (typeof texte === "string" ? (o.lignesMax ?? 1) : lignes.length) && lignes.every((l) => mesure(l, o.police, taille, ap, o.capitales) <= o.largeur);
    return { lignes, tient };
  };
  let taille = Math.max(plancher, o.taille);
  let r = essai(taille);
  // Un texte coupable tient d'abord sur UNE ligne en réduisant jusqu'à 70 % (pas de mot isolé sur une 2ᵉ ligne).
  if (typeof texte === "string" && r.lignes.length > 1) {
    let t1 = taille;
    while (t1 > Math.max(plancher, o.taille * 0.7) && r.lignes.length > 1) {
      t1 = Math.max(plancher, t1 - PAS_AJUSTEMENT_PX);
      const e = essai(t1);
      if (e.lignes.length === 1 && e.tient) {
        taille = t1;
        r = e;
      }
    }
  }
  while (!r.tient && taille > plancher) {
    taille = Math.max(plancher, taille - PAS_AJUSTEMENT_PX);
    r = essai(taille);
  }
  return { nom, lignes: r.lignes, police: o.police, taille, interligne, boite: { x: o.x, y: o.y, largeur: o.largeur, hauteur: Math.ceil(r.lignes.length * taille * interligne) }, align: o.align ?? "left", tient: r.tient, ...(o.approche ? { approche: o.approche } : {}), ...(o.capitales ? { capitales: true } : {}) };
}

/** Largeur réelle (px) de la plus longue ligne d'un texte posé. */
export const largeurPosee = (t: TexteL6) => Math.max(0, ...t.lignes.map((l) => mesure(l, t.police, t.taille, t.approche ?? 0, t.capitales)));

/** Taille d'un texte d'UNE ligne (sans coupe) : `ajuster` de la brique. */
export const tailleUneLigne = (texte: string, police: PoliceEcrans, voulue: number, largeur: number, plancher: number) => ajuster(police === "anton" ? enCapitales(texte) : texte, police, voulue, largeur, plancher).taille;

/** Une forme posée (carte, objet, jauge…) ; `deco` : décor qui peut sortir de l'image sur les côtés. */
export type FormeL6 = { nom: string; boite: BoitePx; deco?: boolean };

/** Une disposition : textes et formes, et `ok` (tout tient sans déborder). */
export type DispositionL6<X = Record<string, unknown>> = { textes: TexteL6[]; formes: FormeL6[]; ok: boolean; echelle: number } & X;

/** Raisons pour lesquelles une disposition déborde (vide : rien ne déborde). */
export function debordements(d: Pick<DispositionL6, "textes" | "formes">, c: Cadre): string[] {
  const r: string[] = [];
  const dans = (b: BoitePx, z: BoitePx, marge = 0.5) => b.x >= z.x - marge && b.y >= z.y - marge && b.x + b.largeur <= z.x + z.largeur + marge && b.y + b.hauteur <= z.y + z.hauteur + marge;
  for (const t of d.textes) {
    if (!t.tient) r.push(`${t.nom} : le texte ne tient pas, même au plancher`);
    if (!dans(t.boite, c.zone)) r.push(`${t.nom} : hors de la zone utile`);
    if (largeurPosee(t) > t.boite.largeur + 0.5) r.push(`${t.nom} : plus large que sa boîte`);
  }
  for (const f of d.formes) {
    if (f.deco) {
      if (f.boite.y < 0 || f.boite.y + f.boite.hauteur > c.basDessin + 0.5) r.push(`${f.nom} : décor hors de l'image ou dans les sous-titres`);
    } else if (!dans(f.boite, { x: 0, y: c.dessin.y, largeur: c.L, hauteur: c.dessin.hauteur })) r.push(`${f.nom} : hors de la zone de dessin`);
  }
  return r;
}

/**
 * Essaie une disposition à des échelles décroissantes (1, 0,92… 0,5) et garde la première qui ne déborde pas ; sinon la
 * dernière, avec `ok = false` (le rendu revient alors à la v4).
 */
export function ajusterDisposition<R extends { textes: TexteL6[]; formes: FormeL6[] }>(c: Cadre, faire: (k: number) => R): R & { ok: boolean; echelle: number } {
  let d: R | null = null;
  for (let k = 1; k >= 0.5 - 1e-9; k -= 0.08) {
    d = faire(k);
    if (!debordements(d, c).length) return { ...d, ok: true, echelle: +k.toFixed(2) };
  }
  return { ...d!, ok: false, echelle: 0.5 };
}

/** Couleurs d'un fond pour les mises en page (texte, accent, secondaire, carte). */
export function couleurs(fond: Fond | "orange") {
  if (fond === "orange") return { fond: C.orangeVif, texte: C.encre, accent: C.ivoire, secondaire: C.encre, trait: C.encre, carte: C.ivoire, piste: `${C.encre}22` };
  return fond === "sombre"
    ? { fond: C.nuit, texte: C.ivoire, accent: C.orangeVif, secondaire: C.grisClair, trait: C.ivoire, carte: C.blanc, piste: `${C.grisClair}29` }
    : { fond: C.ivoire, texte: C.encre, accent: C.orange, secondaire: C.gris, trait: C.encre, carte: C.blanc, piste: `${C.encre}1a` };
}

/** Teinte avec opacité (#RRGGBBAA). */
export const a = (c: string, o: number) => `${c.slice(0, 7)}${Math.round(Math.max(0, Math.min(1, o)) * 255).toString(16).padStart(2, "0")}`;

/** Nombre à la française (espace des milliers, virgule décimale) : c'est le nombre de la fiche, jamais un autre. */
export const ecrireNombre = (n: number) => {
  const [e, d] = String(Math.abs(n)).split(".");
  return `${n < 0 ? "−" : ""}${e!.replace(/\B(?=(\d{3})+(?!\d))/g, " ")}${d ? `,${d}` : ""}`;
};

/** Heure (s, depuis le début de l'écran) d'un événement, ou la valeur par défaut. */
export function heure(p: Pick<ProprietesEcran, "evenements">, cible: string, defaut: number): number {
  const e = p.evenements.find((x) => x.cible === cible);
  return e ? e.ms / 1000 : defaut;
}

/** Durée de l'écran (s). */
export const dureeS = (p: Pick<ProprietesEcran, "debutMs" | "finMs">) => (p.finMs - p.debutMs) / 1000;
