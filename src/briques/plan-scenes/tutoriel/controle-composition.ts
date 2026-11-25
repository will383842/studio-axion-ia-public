/**
 * CONTRÔLE OBJECTIF DE COMPOSITION DU TUTORIEL (lot qualité 25-11, QUAL-4) — PUR : aucun navigateur, aucun réseau,
 * imports relatifs de types seulement (lu aussi par Remotion). Il juge ce qui est POSÉ À L'ÉCRAN (éléments et rectangles
 * de sous-titres, en pixels), jamais ce que le plan annonce : une image illisible (sous-titres sur le texte, image
 * vide, micro-texte, carte coupée) fait ÉCHOUER la note (`grille-qualite.ts`, `index.ts`).
 * Échantillon toutes les 100 ms ; UN défaut par série continue (les trous de moins d'une demi-seconde sont recollés :
 * des sous-titres qui changent de groupe ne font pas dix défauts d'un seul recouvrement).
 */
import type { CodeDefautComposition, DefautComposition, ElementVisible, FormatImage, ImageSansVoix, RectPx, ResultatControleComposition } from "./sans-voix/types";

export const PAS_MS_DEFAUT = 100;
/** Texte de scène : au moins 32 px sur une image dont le côté court fait 1080. */
export const TAILLE_MIN_REFERENCE_PX = 32;
/** Marge minimale au bord de l'image (px). */
export const MARGE_BORD_PX = 24;
/** Une image sans texte ni carte plus longtemps que cela est un défaut ; au-delà de la seconde valeur il est bloquant. */
export const VIDE_TOLERE_MS = 1000;
export const VIDE_BLOQUANT_MS = 2000;
/** Fondu de fin de vidéo : non compté dans les images vides. */
export const FONDU_FIN_MS = 300;
/** Deux séries du même défaut séparées de moins que cela n'en font qu'une. */
export const JOINTURE_MS = 500;
/** Visible à partir de cette opacité. */
export const OPACITE_VISIBLE = 0.05;

const COULEURS_CHARTE: ReadonlySet<string> = new Set(["ivoire", "gris", "noir", "terracotta", "blanc", "grisTexte"]);
/** Charte en hex (`CHARTE_AXION` de `jetons-motion.ts`, recopiée : ce fichier ne dépend de rien) + blanc. L'orange n'y est que sur fond noir. */
const HEX_CHARTE: ReadonlySet<string> = new Set(["#FAF9F5", "#E8E6DC", "#141413", "#B23F16", "#D97757", "#FFFFFF"]);
const HEX_ORANGE = "#D97757";
/** Taille minimale d'un sous-titre : 52 px sur une image dont le côté court fait 1080. */
export const TAILLE_MIN_SOUS_TITRE_REFERENCE_PX = 52;

/** « #fff » / « #faf9f5 » → « #FFFFFF » / « #FAF9F5 » ; autre chose : tel quel en majuscules. */
function hexNormalise(c: string): string {
  const t = c.trim().toUpperCase();
  return /^#[0-9A-F]{3}$/.test(t) ? `#${t[1]}${t[1]}${t[2]}${t[2]}${t[3]}${t[3]}` : t;
}

/** Un rectangle de sous-titre, avec (facultatif) la taille de police effective à l'écran (px). */
export type RectSousTitre = RectPx & { taillePx?: number };

export interface EntreeControleComposition {
  format: FormatImage;
  dureeMs: number;
  imagesA: (tMs: number) => ImageSansVoix;
  /** Rectangles réels des lignes de sous-titres à l'instant (vide : aucun sous-titre). */
  sousTitresA: (tMs: number) => RectSousTitre[];
  /** Couleurs des sous-titres en hex (charte + blanc ; l'orange #D97757 seulement sur fond noir). Absent : non contrôlées. */
  couleursSousTitres?: { texte?: string; accent?: string; contour?: string };
  /** Fond de la vidéo (sinon celui de l'image) : sert à la règle « orange seulement sur fond noir ». */
  fond?: "ivoire" | "noir";
  /** Bande réservée aux sous-titres (aucun élément de scène n'y entre). */
  bande?: RectPx;
  pasMs?: number;
  tailleMinPx?: number;
}

/** « 12,3 s » (virgule française, une décimale). */
export function secondes(ms: number): string {
  return `${(Math.round(ms / 100) / 10).toFixed(1).replace(".", ",")} s`;
}

const visible = (e: ElementVisible): boolean => e.opacite >= OPACITE_VISIBLE;

function intersecte(a: RectPx, b: RectPx): boolean {
  return a.x < b.x + b.largeur - 1e-6 && b.x < a.x + a.largeur - 1e-6 && a.y < b.y + b.hauteur - 1e-6 && b.y < a.y + a.hauteur - 1e-6;
}

function horsCadre(r: RectPx, f: FormatImage, sansMarge = false): boolean {
  const tol = 0.5;
  // Pièce pleine toile ou forme de repli : seule une vraie sortie de l'image compte (jamais de fausse alerte de marge).
  if (sansMarge) return r.x < -tol || r.y < -tol || r.x + r.largeur > f.largeur + tol || r.y + r.hauteur > f.hauteur + tol;
  return r.x < MARGE_BORD_PX - tol || r.y < MARGE_BORD_PX - tol || r.x + r.largeur > f.largeur - MARGE_BORD_PX + tol || r.y + r.hauteur > f.hauteur - MARGE_BORD_PX + tol;
}

/** Contenu : texte ou forme visible ; une forme « porteuse » (elle a des enfants) ne compte que si un enfant est visible. */
function contenuVisible(elements: ElementVisible[]): boolean {
  const porteuses = new Set(elements.filter((e) => e.parentId !== undefined).map((e) => e.parentId!));
  const avecEnfantVisible = new Set(elements.filter((e) => visible(e) && e.parentId !== undefined && (e.genre === "texte" || e.genre === "forme")).map((e) => e.parentId!));
  return elements.some((e) => visible(e) && (e.genre === "texte" || e.genre === "forme") && (!porteuses.has(e.id) || avecEnfantVisible.has(e.id)));
}

function resume(texte: string | undefined): string {
  const t = (texte ?? "").replace(/\s+/g, " ").trim();
  return t.length > 40 ? `${t.slice(0, 37)}…` : t;
}

interface Vu {
  code: CodeDefautComposition;
  message: string;
  elementId?: string;
}
interface Serie extends Vu {
  debutMs: number;
  finMs: number;
}

export function controlerComposition(e: EntreeControleComposition): ResultatControleComposition {
  const pas = e.pasMs !== undefined && e.pasMs > 0 ? e.pasMs : PAS_MS_DEFAUT;
  const minPx = e.tailleMinPx ?? (TAILLE_MIN_REFERENCE_PX * Math.min(e.format.largeur, e.format.hauteur)) / 1080;
  const duree = Math.max(0, e.dureeMs);
  const parCle = new Map<string, Serie[]>();
  const vides: { debutMs: number; finMs: number }[] = [];
  let videEnCours: { debutMs: number; finMs: number } | null = null;
  let plusPetit: number | null = null;
  let echantillons = 0;

  const ajouter = (cle: string, t: number, v: Vu) => {
    const liste = parCle.get(cle) ?? [];
    const derniere = liste[liste.length - 1];
    if (derniere && t - derniere.finMs <= JOINTURE_MS + 1e-6) derniere.finMs = t + pas;
    else liste.push({ ...v, debutMs: t, finMs: t + pas });
    parCle.set(cle, liste);
  };

  for (let t = 0; t < duree; t += pas) {
    echantillons++;
    const image = e.imagesA(t);
    const sousTitres = e.sousTitresA(t);
    const vus = new Map<string, Vu>();
    const noter = (cle: string, code: CodeDefautComposition, message: string, elementId?: string) => {
      if (!vus.has(cle)) vus.set(cle, { code, message, elementId });
    };
    const els = image.elements.filter(visible).sort((a, b) => Number(b.genre === "texte") - Number(a.genre === "texte"));

    if (!COULEURS_CHARTE.has(image.fond)) noter("CHARTE", "CHARTE", `la couleur de fond « ${String(image.fond)} » n'est pas dans la charte`);
    const fondVideo = e.fond ?? image.fond;
    if (e.couleursSousTitres && sousTitres.length) {
      for (const [role, c] of Object.entries(e.couleursSousTitres)) {
        if (typeof c !== "string") continue;
        const h = hexNormalise(c);
        if (!HEX_CHARTE.has(h)) noter(`CHARTE-ST-${role}`, "CHARTE", `la couleur « ${c} » des sous-titres (${role}) n'est pas dans la charte`);
        else if (h === HEX_ORANGE && fondVideo !== "noir") noter(`CHARTE-ST-${role}`, "CHARTE", `l'orange ${HEX_ORANGE} des sous-titres (${role}) est posé sur fond ${String(fondVideo)} : il n'est permis que sur fond noir`);
      }
    }
    const minSousTitrePx = (TAILLE_MIN_SOUS_TITRE_REFERENCE_PX * Math.min(e.format.largeur, e.format.hauteur)) / 1080;
    for (const r of sousTitres) {
      if (typeof r.taillePx === "number" && r.taillePx < minSousTitrePx - 1e-6) noter("TEXTE-ST", "TEXTE_TROP_PETIT", `les sous-titres sont écrits en ${Math.round(r.taillePx)} px, trop petit (minimum ${Math.round(minSousTitrePx)} px)`);
    }
    for (const el of els) {
      for (const c of [el.remplissage, el.contour, el.couleur]) {
        if (c !== undefined && !COULEURS_CHARTE.has(c)) noter("CHARTE", "CHARTE", `la couleur « ${String(c)} » n'est pas dans la charte (${el.id})`, el.id);
      }
      if (el.genre === "texte" && typeof el.taillePx === "number") {
        plusPetit = plusPetit === null ? el.taillePx : Math.min(plusPetit, el.taillePx);
        if (el.taillePx < minPx - 1e-6) noter("TEXTE_TROP_PETIT", "TEXTE_TROP_PETIT", `le texte « ${resume(el.texte)} » est écrit en ${Math.round(el.taillePx)} px, trop petit (minimum ${Math.round(minPx)} px)`, el.id);
      }
      if (el.coupe) noter("HORS_CADRE", "HORS_CADRE", "une pièce zoomée sort de l'image ou de sa boîte : une partie est coupée", el.id);
      else if (horsCadre(el.rect, e.format, el.bordTolere === true)) noter("HORS_CADRE", "HORS_CADRE", `un élément de la scène sort du cadre ou frôle le bord (marge de ${MARGE_BORD_PX} px non respectée)`, el.id);
      if (el.genre === "texte" || el.genre === "forme") {
        if (sousTitres.some((r) => intersecte(el.rect, r))) noter("SOUS_TITRES_RECOUVERTS", "SOUS_TITRES_RECOUVERTS", `le sous-titre recouvre ${el.genre === "texte" ? "le texte" : "le dessin"} de la scène`, el.id);
        else if (e.bande && intersecte(el.rect, e.bande)) noter("SOUS_TITRES_RECOUVERTS", "SOUS_TITRES_RECOUVERTS", "la scène entre dans la bande réservée aux sous-titres", el.id);
      }
    }
    // Curseurs : une cible qui existe dans l'image, et jamais seul.
    const curseurs = els.filter((x) => x.genre === "curseur");
    if (curseurs.length) {
      for (const c of curseurs) {
        if (!c.cibleId || !image.elements.some((x) => x.id === c.cibleId)) noter("CURSEUR_SANS_CIBLE", "CURSEUR_SANS_CIBLE", "le curseur n'a rien à cliquer : aucune cible dans l'image", c.id);
      }
      if (els.every((x) => x.genre === "curseur")) noter("CURSEUR_SANS_CIBLE", "CURSEUR_SANS_CIBLE", "le curseur est seul à l'image, sans rien à cliquer", curseurs[0]!.id);
    }
    for (const [cle, v] of vus) ajouter(cle, t, v);

    // Image vide (hors fondu de fin de vidéo).
    if (t < duree - FONDU_FIN_MS && !contenuVisible(image.elements)) {
      if (videEnCours && t - videEnCours.finMs <= 1e-6) videEnCours.finMs = t + pas;
      else {
        videEnCours = { debutMs: t, finMs: t + pas };
        vides.push(videEnCours);
      }
    } else videEnCours = null;
  }

  const borner = (ms: number) => Math.min(duree, ms);
  const defauts: DefautComposition[] = [];
  for (const series of parCle.values()) {
    for (const s of series) {
      const fin = borner(s.finMs);
      defauts.push({
        code: s.code,
        gravite: s.code === "CURSEUR_SANS_CIBLE" ? "a-corriger" : "bloquant",
        debutMs: s.debutMs,
        finMs: fin,
        message: `${secondes(s.debutMs)} → ${secondes(fin)} : ${s.message}`,
        ...(s.elementId ? { elementId: s.elementId } : {}),
      });
    }
  }
  let videMaxMs = 0;
  for (const v of vides) {
    const fin = borner(v.finMs);
    const longueur = fin - v.debutMs;
    videMaxMs = Math.max(videMaxMs, longueur);
    if (longueur > VIDE_TOLERE_MS) {
      defauts.push({
        code: "IMAGE_VIDE",
        gravite: longueur > VIDE_BLOQUANT_MS ? "bloquant" : "a-corriger",
        debutMs: v.debutMs,
        finMs: fin,
        message: `${secondes(v.debutMs)} → ${secondes(fin)} : l'image est vide, aucun texte ni dessin de scène (${secondes(longueur)})`,
      });
    }
  }
  defauts.sort((a, b) => a.debutMs - b.debutMs || a.code.localeCompare(b.code));
  return { ok: defauts.length === 0, defauts, mesures: { textePlusPetitPx: plusPetit, videMaxMs, echantillons } };
}
