/**
 * IMAGE → VIDÉO · L5 · Préparation de l'image avant les deux lectures Claude (plan § 1 et I2).
 *
 * 1. Le format est reconnu par ses premiers octets (jamais par le nom du fichier) et ses dimensions sont lues dans
 *    l'en-tête : PNG, JPEG, WebP, GIF. Autre chose → refus en une phrase.
 * 2. Refus si l'image a moins de 800 px de côté (`COTE_MIN_PX`) : les petits textes deviennent illisibles.
 * 3. Découpe : l'image entière (ramenée à 1 568 px de côté long au plus) et
 *    4 tuiles (quadrants qui se recouvrent de 10 % de la largeur et de la hauteur), agrandies ×2 dans la même limite.
 * 4. TOUT part en PNG (`ImageClaude` n'accepte que JPEG ou PNG) : la conversion est faite par l'outil injecté
 *    `convertir` (le studio n'embarque aucune bibliothèque d'image ; le branchement réel arrive avec le service, L15).
 *    Le code VÉRIFIE ce que l'outil rend (signature PNG, dimensions exactes) : rien d'autre ne part vers Claude.
 *
 * Aucun nom de fichier, aucune clé de stockage n'entre dans ce qui part vers Claude.
 */
import type { ImageClaude } from "@/fournisseurs/claude/client";

/** Côté minimal accepté, en pixels (I2). */
export const COTE_MIN_PX = 800;
/** Part de chaque côté partagée par deux tuiles voisines. */
export const RECOUVREMENT = 0.1;
/** Agrandissement des tuiles. */
export const AGRANDISSEMENT = 2;
/**
 * Côté long maximal envoyé. Claude peut encore réduire une image selon son nombre total de pixels (une tuile de
 * 1 188 × 1 486 px ≈ 1,77 Mpx) : le gain réel de l'agrandissement ×2 et le compte de jetons par image sont à mesurer
 * sur la première lecture réelle (étape 1).
 */
export const COTE_MAX_CLAUDE = 1568;

export const FORMATS_IMAGE = ["png", "jpeg", "webp", "gif"] as const;
export type FormatImage = (typeof FORMATS_IMAGE)[number];

export type Orientation = "portrait" | "paysage" | "carre";

/** Un morceau à produire : rectangle pris dans l'image source, rendu en PNG à la taille de sortie. */
export interface Morceau {
  /** Nom stable (« entiere », « haut-gauche »…). */
  nom: "entiere" | "haut-gauche" | "haut-droite" | "bas-gauche" | "bas-droite";
  /** Légende lue par Claude juste avant l'image. */
  legende: string;
  x: number;
  y: number;
  largeur: number;
  hauteur: number;
  sortieLargeur: number;
  sortieHauteur: number;
}

/** Demande faite à l'outil de conversion : un PNG par morceau, dans l'ordre. */
export interface DemandeConversion {
  format: FormatImage;
  octets: Uint8Array;
  morceaux: readonly Morceau[];
}

/** Outil injecté : rend un PNG par morceau, dans l'ordre demandé. */
export type ConvertirEnPng = (demande: DemandeConversion) => Promise<Uint8Array[]>;

export type RefusPreparation = { ok: false; motif: "format" | "trop-petite" | "conversion"; message: string };

export interface PlanPreparation {
  ok: true;
  format: FormatImage;
  largeur: number;
  hauteur: number;
  orientation: Orientation;
  /** L'image entière puis les 4 tuiles (haut-gauche, haut-droite, bas-gauche, bas-droite). */
  morceaux: Morceau[];
}

export interface ImagePreparee extends Omit<PlanPreparation, "morceaux"> {
  entiere: ImageClaude;
  tuiles: ImageClaude[];
}

// ─── Format et dimensions, lus dans l'en-tête ────────────────────────────────────────────────────────────────────────

const commencePar = (o: Uint8Array, octets: number[], a = 0) => octets.every((b, i) => o[a + i] === b);
const ascii = (o: Uint8Array, a: number, n: number) => String.fromCharCode(...o.subarray(a, a + n));
const u16be = (o: Uint8Array, a: number) => (o[a] << 8) | o[a + 1];
const u16le = (o: Uint8Array, a: number) => o[a] | (o[a + 1] << 8);
const u24le = (o: Uint8Array, a: number) => o[a] | (o[a + 1] << 8) | (o[a + 2] << 16);
const u32be = (o: Uint8Array, a: number) => ((o[a] << 24) >>> 0) + (o[a + 1] << 16) + (o[a + 2] << 8) + o[a + 3];

export const SIGNATURE_PNG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

/** Format reconnu par les premiers octets ; `null` si inconnu. */
export function formatDe(o: Uint8Array): FormatImage | null {
  if (o.length >= 24 && commencePar(o, SIGNATURE_PNG)) return "png";
  if (o.length >= 4 && commencePar(o, [0xff, 0xd8, 0xff])) return "jpeg";
  if (o.length >= 30 && ascii(o, 0, 4) === "RIFF" && ascii(o, 8, 4) === "WEBP") return "webp";
  if (o.length >= 10 && (ascii(o, 0, 6) === "GIF87a" || ascii(o, 0, 6) === "GIF89a")) return "gif";
  return null;
}

/** Marqueurs JPEG « début d'image » qui portent les dimensions (SOF0-SOF15, hors DHT, JPG et DAC). */
const SOF = new Set([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf]);

/** Dimensions lues dans l'en-tête ; `null` si l'en-tête est illisible. */
export function dimensionsDe(o: Uint8Array): { largeur: number; hauteur: number } | null {
  const format = formatDe(o);
  const res = (largeur: number, hauteur: number) => (largeur > 0 && hauteur > 0 ? { largeur, hauteur } : null);
  switch (format) {
    case "png":
      return ascii(o, 12, 4) === "IHDR" ? res(u32be(o, 16), u32be(o, 20)) : null;
    case "gif":
      return res(u16le(o, 6), u16le(o, 8));
    case "webp": {
      const morceau = ascii(o, 12, 4);
      if (morceau === "VP8X") return res(u24le(o, 24) + 1, u24le(o, 27) + 1);
      if (morceau === "VP8L" && o[20] === 0x2f) {
        const b = o.subarray(21, 25);
        return res(1 + (b[0] | ((b[1] & 0x3f) << 8)), 1 + ((b[1] >> 6) | (b[2] << 2) | ((b[3] & 0x0f) << 10)));
      }
      if (morceau === "VP8 " && commencePar(o, [0x9d, 0x01, 0x2a], 23)) return res(u16le(o, 26) & 0x3fff, u16le(o, 28) & 0x3fff);
      return null;
    }
    case "jpeg": {
      let a = 2;
      while (a + 9 < o.length) {
        if (o[a] !== 0xff) return null;
        const marqueur = o[a + 1];
        if (marqueur === 0xff) {
          a++;
          continue;
        }
        if (SOF.has(marqueur)) return res(u16be(o, a + 7), u16be(o, a + 5));
        if (marqueur === 0xd9 || marqueur === 0xda) return null;
        a += 2 + u16be(o, a + 2);
      }
      return null;
    }
    default:
      return null;
  }
}

// ─── Découpe ─────────────────────────────────────────────────────────────────────────────────────────────────────────

export function orientationDe(largeur: number, hauteur: number): Orientation {
  if (Math.abs(largeur - hauteur) <= 0.02 * Math.max(largeur, hauteur)) return "carre";
  return largeur > hauteur ? "paysage" : "portrait";
}

/** Taille de sortie : × `facteur`, ramenée pour que le côté long ne dépasse pas `COTE_MAX_CLAUDE`. */
function sortie(largeur: number, hauteur: number, facteur: number): { sortieLargeur: number; sortieHauteur: number } {
  const f = Math.min(facteur, COTE_MAX_CLAUDE / Math.max(largeur, hauteur));
  return { sortieLargeur: Math.max(1, Math.round(largeur * f)), sortieHauteur: Math.max(1, Math.round(hauteur * f)) };
}

/** Image entière puis 4 quadrants qui se recouvrent de `RECOUVREMENT` du côté (chaque tuile couvre 55 % du côté). */
export function morceauxDe(largeur: number, hauteur: number): Morceau[] {
  const tl = Math.round(largeur * (0.5 + RECOUVREMENT / 2));
  const th = Math.round(hauteur * (0.5 + RECOUVREMENT / 2));
  const tuile = (nom: Morceau["nom"], ou: string, x: number, y: number): Morceau => ({
    nom,
    legende: `Tuile ${ou} de la même image, agrandie ×${AGRANDISSEMENT} (elle recouvre ses voisines de ${Math.round(RECOUVREMENT * 100)} %).`,
    x,
    y,
    largeur: tl,
    hauteur: th,
    ...sortie(tl, th, AGRANDISSEMENT),
  });
  return [
    { nom: "entiere", legende: "Image entière.", x: 0, y: 0, largeur, hauteur, ...sortie(largeur, hauteur, 1) },
    tuile("haut-gauche", "en haut à gauche", 0, 0),
    tuile("haut-droite", "en haut à droite", largeur - tl, 0),
    tuile("bas-gauche", "en bas à gauche", 0, hauteur - th),
    tuile("bas-droite", "en bas à droite", largeur - tl, hauteur - th),
  ];
}

/** Plan de préparation (PUR) : format, dimensions, refus, morceaux à produire. */
export function planPreparation(octets: Uint8Array): PlanPreparation | RefusPreparation {
  const format = formatDe(octets);
  const dims = format ? dimensionsDe(octets) : null;
  if (!format || !dims) return { ok: false, motif: "format", message: "Je ne sais pas lire ce fichier : déposez une image PNG, JPEG ou WebP." };
  const { largeur, hauteur } = dims;
  if (Math.min(largeur, hauteur) < COTE_MIN_PX) {
    return {
      ok: false,
      motif: "trop-petite",
      message: `Cette image est trop petite (${largeur} × ${hauteur} px) : il faut au moins ${COTE_MIN_PX} px de côté. Déposez une version plus grande.`,
    };
  }
  return { ok: true, format, largeur, hauteur, orientation: orientationDe(largeur, hauteur), morceaux: morceauxDe(largeur, hauteur) };
}

function enBase64(o: Uint8Array): string {
  return Buffer.from(o.buffer, o.byteOffset, o.byteLength).toString("base64");
}

/**
 * Prépare l'image : plan, conversion de chaque morceau en PNG par l'outil injecté, vérification de chaque PNG rendu
 * (signature et dimensions exactes). Une conversion ratée ou douteuse = refus : rien ne part vers Claude.
 */
export async function preparerImage(octets: Uint8Array, convertir: ConvertirEnPng): Promise<ImagePreparee | RefusPreparation> {
  const plan = planPreparation(octets);
  if (!plan.ok) return plan;
  const refus: RefusPreparation = { ok: false, motif: "conversion", message: "L'image n'a pas pu être préparée pour la lecture : réessayez, ou déposez-la en PNG." };
  let pngs: Uint8Array[];
  try {
    pngs = await convertir({ format: plan.format, octets, morceaux: plan.morceaux });
  } catch {
    return refus;
  }
  if (!Array.isArray(pngs) || pngs.length !== plan.morceaux.length) return refus;
  const images: ImageClaude[] = [];
  for (const [i, m] of plan.morceaux.entries()) {
    const png = pngs[i];
    const dims = png && formatDe(png) === "png" ? dimensionsDe(png) : null;
    if (!dims || dims.largeur !== m.sortieLargeur || dims.hauteur !== m.sortieHauteur) return refus;
    images.push({ type: "image/png", base64: enBase64(png), legende: m.legende });
  }
  const { morceaux: _m, ...reste } = plan;
  void _m;
  return { ...reste, entiere: images[0], tuiles: images.slice(1) };
}
