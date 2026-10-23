/**
 * LUT 3D (`.cube`) pour l'aperçu du plateau (lot M3 ; plan B.9 « Aperçu du plateau », B.7 LUT).
 * - lecture d'un `.cube` : la taille est LUE DANS L'EN-TÊTE (65 pour les LUT Axion Buffer, 33 accepté) ;
 * - réduction à 33³ côté navigateur (une texture 65³ pèse 1 Mo et n'apporte rien à 390 px) ;
 * - application trilinéaire avec curseur d'intensité, sur le processeur (repli) ou par shader WebGL2 (texture 3D).
 * PUR (sauf les sources des shaders, qui ne sont que du texte), testé.
 */

import { ErreurLisible } from "./erreur-lisible";

export interface Lut3D {
  titre?: string;
  taille: number;
  domaineMin: [number, number, number];
  domaineMax: [number, number, number];
  /** taille³ × 3 valeurs (r, g, b), rouge le plus rapide, puis vert, puis bleu (ordre du format `.cube`). */
  donnees: Float32Array;
}

/** Taille utilisée par le navigateur. */
export const TAILLE_LUT_NAVIGATEUR = 33;

/**
 * Bornes de lecture d'un `.cube` (lot R5, relecture sécurité) : un fichier importé ne doit jamais faire tomber le
 * serveur ni le navigateur. 65 points par côté au plus (65³ = 274 625 couleurs, ≈ 7,4 Mo de texte) ; 50 Mo de texte
 * au plus ; chaque valeur est un nombre décimal ordinaire, entre −4 et 4.
 */
export const TAILLE_LUT_MAX = 65;
export const CARACTERES_MAX_CUBE = 50 * 1024 * 1024;
export const VALEUR_LUT_MAX = 4;
/**
 * Bornes de TEMPS et de MÉMOIRE de la lecture (relecture sécurité R45, défauts n° 1 et 2), vérifiées AVANT toute
 * expression régulière : une ligne de couleur réelle fait moins de 40 caractères, un nombre moins de 20.
 *  - 256 caractères par ligne, 32 par nombre ;
 *  - 1 000 lignes hors couleurs (vides, commentaires, en-tête) avant les couleurs, 64 après ;
 *  - une fois la grille annoncée, 80 caractères par couleur en moyenne (65³ → 22 Mo au plus, et non 50 Mo).
 */
export const CARACTERES_MAX_LIGNE = 256;
export const CARACTERES_MAX_NOMBRE = 32;
export const LIGNES_HORS_COULEURS_AVANT_MAX = 1000;
export const LIGNES_HORS_COULEURS_APRES_MAX = 64;
export const CARACTERES_MAX_PAR_COULEUR = 80;
/**
 * Un nombre décimal ordinaire (ni hexadécimal, ni « Infinity », ni vide). SANS AMBIGUÏTÉ : la partie entière et la
 * partie décimale sont séparées par un point OBLIGATOIRE (l'ancienne forme `\d+\.?\d*` se partageait les chiffres de
 * toutes les façons possibles avant d'échouer : temps quadratique). Exportée pour son test chronométré.
 */
export const NOMBRE_DECIMAL = /^[-+]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][-+]?\d{1,3})?$/;

/** Exactement `combien` nombres décimaux bornés à ±`VALEUR_LUT_MAX`, sinon l'erreur donnée. */
function nombresBornes(morceaux: string[], combien: number, erreur: string): number[] {
  if (morceaux.length !== combien || morceaux.some((m) => m.length > CARACTERES_MAX_NOMBRE || !NOMBRE_DECIMAL.test(m))) throw new ErreurLisible(erreur);
  const n = morceaux.map(Number);
  if (n.some((x) => !Number.isFinite(x) || Math.abs(x) > VALEUR_LUT_MAX)) throw new ErreurLisible(erreur);
  return n;
}

const LIGNE_TROP_LONGUE = "Une ligne de ce fichier de couleur est beaucoup trop longue : ce n'est pas un fichier de couleur.";
const TROP_GROS = "Ce fichier dépasse 50 Mo : ce n'est pas un fichier de couleur.";

/**
 * Lecture d'un `.cube` MORCEAU PAR MORCEAU (relecture sécurité R45) : le texte n'est jamais découpé en tableau, seule
 * la ligne en cours est gardée (256 caractères au plus) et les couleurs vont directement dans leur place réservée.
 * Sert au navigateur (`lireCube`, texte entier parcouru ligne par ligne) comme au serveur (flux du stockage ou du
 * fichier téléchargé, poussé au fil de l'eau). Lève une erreur en français, en phrase simple, dès le premier défaut.
 */
export class LecteurCube {
  private reste = "";
  private apresRetour = false;
  private recus = 0;
  private position = 0;
  private limite = CARACTERES_MAX_CUBE;
  private horsAvant = 0;
  private horsApres = 0;
  private taille = 0;
  private attendues = 0;
  private titre: string | undefined;
  private domaineMin: [number, number, number] = [0, 0, 0];
  private domaineMax: [number, number, number] = [1, 1, 1];
  private valeurs: Float32Array | null = null;
  private lues = 0;

  /** Ajoute un morceau de texte (n'importe où, même au milieu d'une ligne). */
  pousser(morceau: string): this {
    this.recus += morceau.length;
    if (this.recus > CARACTERES_MAX_CUBE) throw new ErreurLisible(TROP_GROS);
    // Fins de ligne « \n », « \r\n » et « \r » seul (anciens fichiers Mac). Un « \r » en fin de morceau : le « \n »
    // qui ouvre peut-être le morceau suivant appartient à la même fin de ligne.
    let debut = this.apresRetour && morceau.startsWith("\n") ? 1 : 0;
    if (morceau) this.apresRetour = false;
    // Prochaines positions de « \n » et de « \r », recherchées seulement une fois dépassées : temps linéaire.
    let n = -2;
    let r = -2;
    for (;;) {
      if (n !== -1 && n < debut) n = morceau.indexOf("\n", debut);
      if (r !== -1 && r < debut) r = morceau.indexOf("\r", debut);
      const fin = r < 0 ? n : n < 0 ? r : Math.min(n, r);
      if (fin < 0) break;
      if (this.reste.length + fin - debut > CARACTERES_MAX_LIGNE) throw new ErreurLisible(LIGNE_TROP_LONGUE);
      const ligne = this.reste ? this.reste + morceau.slice(debut, fin) : morceau.slice(debut, fin);
      this.reste = "";
      this.ligne(ligne);
      debut = fin + 1;
      if (fin === r) {
        if (debut === morceau.length) this.apresRetour = true;
        else if (morceau.charCodeAt(debut) === 10) debut++;
      }
    }
    if (this.reste.length + morceau.length - debut > CARACTERES_MAX_LIGNE) throw new ErreurLisible(LIGNE_TROP_LONGUE);
    this.reste += morceau.slice(debut);
    return this;
  }

  /** Fin du texte : la LUT complète, ou une erreur. */
  terminer(): Lut3D {
    if (this.reste) {
      const derniere = this.reste;
      this.reste = "";
      this.ligne(derniere);
    }
    const { valeurs, lues, attendues, domaineMin, domaineMax } = this;
    if (!valeurs) throw new ErreurLisible("Ce fichier de couleur n'annonce pas sa taille.");
    if (lues !== attendues) throw new ErreurLisible(`Ce fichier de couleur annonce ${attendues} couleurs mais en contient ${lues}.`);
    if (domaineMin.some((x, i) => x >= domaineMax[i])) throw new ErreurLisible("Les bornes de ce fichier de couleur sont inversées.");
    return { titre: this.titre, taille: this.taille, domaineMin, domaineMax, donnees: valeurs };
  }

  /** Ligne vide, commentaire ou en-tête : comptée (1 000 avant les couleurs, 64 après). */
  private horsCouleur(): void {
    const trop = this.lues > 0 ? ++this.horsApres > LIGNES_HORS_COULEURS_APRES_MAX : ++this.horsAvant > LIGNES_HORS_COULEURS_AVANT_MAX;
    if (trop) throw new ErreurLisible("Ce fichier de couleur contient trop de lignes vides ou de commentaires.");
  }

  /** Une ligne lue (256 caractères au plus, déjà vérifié). */
  private ligne(brute: string): void {
    this.position += brute.length + 1;
    if (this.position > this.limite) throw new ErreurLisible("Ce fichier de couleur est bien plus gros que ce qu'annonce sa taille.");
    const ligne = brute.trim();
    if (!ligne || ligne.startsWith("#")) return this.horsCouleur();
    if (/^TITLE\b/i.test(ligne)) {
      this.titre = ligne.replace(/^TITLE\s*/i, "").replace(/^"|"$/g, "").slice(0, 200);
      return this.horsCouleur();
    }
    if (/^LUT_3D_SIZE\b/i.test(ligne)) {
      const n = Number(ligne.split(/\s+/)[1]);
      if (this.valeurs || !Number.isInteger(n) || n < 2 || n > TAILLE_LUT_MAX) throw new ErreurLisible(`Ce fichier de couleur annonce une taille impossible (${TAILLE_LUT_MAX} points par côté au plus, annoncée une seule fois).`);
      this.taille = n;
      this.attendues = n ** 3;
      this.valeurs = new Float32Array(this.attendues * 3);
      // Borne du fichier dérivée de la grille annoncée : ce qui est déjà lu, plus 80 caractères par couleur, plus les
      // quelques lignes permises après les couleurs.
      this.limite = Math.min(CARACTERES_MAX_CUBE, this.position + this.attendues * CARACTERES_MAX_PAR_COULEUR + LIGNES_HORS_COULEURS_APRES_MAX * CARACTERES_MAX_LIGNE);
      return this.horsCouleur();
    }
    if (/^LUT_1D_SIZE\b/i.test(ligne)) throw new ErreurLisible("Ce fichier de couleur est d'un type simplifié que le studio ne lit pas : il en faut un en trois dimensions.");
    if (/^DOMAIN_(MIN|MAX)\b/i.test(ligne)) {
      const d = nombresBornes(ligne.split(/\s+/).slice(1), 3, "Les bornes de ce fichier de couleur sont illisibles.") as [number, number, number];
      if (/^DOMAIN_MIN/i.test(ligne)) this.domaineMin = d;
      else this.domaineMax = d;
      return this.horsCouleur();
    }
    if (/^[A-Z_]+\b/i.test(ligne) && !/^[-+.\d]/.test(ligne)) return this.horsCouleur(); // autre mot-clé d'en-tête, ignoré
    if (!this.valeurs) throw new ErreurLisible("Ce fichier de couleur n'annonce pas sa taille avant ses couleurs.");
    if (this.lues >= this.attendues) throw new ErreurLisible(`Ce fichier de couleur annonce ${this.attendues} couleurs mais en contient davantage.`);
    this.valeurs.set(nombresBornes(ligne.split(/\s+/), 3, "Une ligne de couleurs est illisible."), this.lues * 3);
    this.lues++;
  }
}

/**
 * Lit un fichier `.cube` (Adobe / Resolve). Lève une erreur en français, en phrase simple, si le fichier est cassé ou
 * hors bornes. La taille doit être annoncée AVANT les couleurs : la place est réservée une fois (bornée), et la
 * lecture s'arrête dès la première couleur en trop (jamais de mémoire qui grossit sans fin). Le texte est parcouru
 * ligne par ligne, sans tableau (`LecteurCube`).
 */
export function lireCube(texte: string): Lut3D {
  if (texte.length > CARACTERES_MAX_CUBE) throw new ErreurLisible(TROP_GROS);
  return new LecteurCube().pousser(texte).terminer();
}

function index(taille: number, r: number, g: number, b: number): number {
  return (r + g * taille + b * taille * taille) * 3;
}

/** Couleur de la LUT pour une entrée (0-1), interpolation trilinéaire. */
export function echantillonner(lut: Lut3D, r: number, g: number, b: number): [number, number, number] {
  const n = lut.taille;
  const norm = (v: number, i: 0 | 1 | 2) => {
    const min = lut.domaineMin[i];
    const max = lut.domaineMax[i];
    return Math.min(1, Math.max(0, (v - min) / (max - min || 1))) * (n - 1);
  };
  const x = norm(r, 0);
  const y = norm(g, 1);
  const z = norm(b, 2);
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const z0 = Math.floor(z);
  const x1 = Math.min(n - 1, x0 + 1);
  const y1 = Math.min(n - 1, y0 + 1);
  const z1 = Math.min(n - 1, z0 + 1);
  const fx = x - x0;
  const fy = y - y0;
  const fz = z - z0;
  const d = lut.donnees;
  const sortie: [number, number, number] = [0, 0, 0];
  for (let c = 0; c < 3; c++) {
    const v = (xi: number, yi: number, zi: number) => d[index(n, xi, yi, zi) + c];
    const c00 = v(x0, y0, z0) * (1 - fx) + v(x1, y0, z0) * fx;
    const c10 = v(x0, y1, z0) * (1 - fx) + v(x1, y1, z0) * fx;
    const c01 = v(x0, y0, z1) * (1 - fx) + v(x1, y0, z1) * fx;
    const c11 = v(x0, y1, z1) * (1 - fx) + v(x1, y1, z1) * fx;
    const c0 = c00 * (1 - fy) + c10 * fy;
    const c1 = c01 * (1 - fy) + c11 * fy;
    sortie[c] = c0 * (1 - fz) + c1 * fz;
  }
  return sortie;
}

/** Réduit une LUT à `taille`³ par rééchantillonnage trilinéaire (65³ → 33³ pour le navigateur). */
export function reduireLut(lut: Lut3D, taille = TAILLE_LUT_NAVIGATEUR): Lut3D {
  if (lut.taille <= taille) return lut;
  const donnees = new Float32Array(taille ** 3 * 3);
  const pas = (i: 0 | 1 | 2, k: number) => lut.domaineMin[i] + ((lut.domaineMax[i] - lut.domaineMin[i]) * k) / (taille - 1);
  for (let b = 0; b < taille; b++)
    for (let g = 0; g < taille; g++)
      for (let r = 0; r < taille; r++) {
        const [x, y, z] = echantillonner(lut, pas(0, r), pas(1, g), pas(2, b));
        const i = index(taille, r, g, b);
        donnees[i] = x;
        donnees[i + 1] = y;
        donnees[i + 2] = z;
      }
  return { ...lut, taille, donnees };
}

/** Applique la LUT à des pixels RGBA (0-255) EN PLACE, avec une intensité 0-1 (mélange avec l'original). */
export function appliquerLutPixels(pixels: Uint8ClampedArray, lut: Lut3D, intensite: number): void {
  const k = Math.min(1, Math.max(0, intensite));
  if (k === 0) return;
  for (let i = 0; i < pixels.length; i += 4) {
    const r = pixels[i] / 255;
    const g = pixels[i + 1] / 255;
    const b = pixels[i + 2] / 255;
    const [lr, lg, lb] = echantillonner(lut, r, g, b);
    pixels[i] = Math.round((r + (lr - r) * k) * 255);
    pixels[i + 1] = Math.round((g + (lg - g) * k) * 255);
    pixels[i + 2] = Math.round((b + (lb - b) * k) * 255);
  }
}

/** Données d'une texture 3D WebGL2 (RGBA8, largeur = rouge, hauteur = vert, profondeur = bleu). */
export function donneesTexture3D(lut: Lut3D): Uint8Array {
  const n = lut.taille ** 3;
  const sortie = new Uint8Array(n * 4);
  for (let i = 0; i < n; i++) {
    sortie[i * 4] = Math.round(Math.min(1, Math.max(0, lut.donnees[i * 3])) * 255);
    sortie[i * 4 + 1] = Math.round(Math.min(1, Math.max(0, lut.donnees[i * 3 + 1])) * 255);
    sortie[i * 4 + 2] = Math.round(Math.min(1, Math.max(0, lut.donnees[i * 3 + 2])) * 255);
    sortie[i * 4 + 3] = 255;
  }
  return sortie;
}

/** LUT identité (tests, et aperçu « sans couleurs »). */
export function lutIdentite(taille = 2): Lut3D {
  const donnees = new Float32Array(taille ** 3 * 3);
  for (let b = 0; b < taille; b++)
    for (let g = 0; g < taille; g++)
      for (let r = 0; r < taille; r++) {
        const i = index(taille, r, g, b);
        donnees[i] = r / (taille - 1);
        donnees[i + 1] = g / (taille - 1);
        donnees[i + 2] = b / (taille - 1);
      }
  return { taille, domaineMin: [0, 0, 0], domaineMax: [1, 1, 1], donnees };
}

/* --- Shader WebGL2 : l'image composée (texture 2D) passe dans la LUT (texture 3D), mélangée selon l'intensité --- */

export const SOMMETS_LUT = `#version 300 es
in vec2 position;
out vec2 uv;
void main() {
  uv = vec2((position.x + 1.0) * 0.5, 1.0 - (position.y + 1.0) * 0.5);
  gl_Position = vec4(position, 0.0, 1.0);
}`;

export const FRAGMENTS_LUT = `#version 300 es
precision highp float;
precision highp sampler3D;
uniform sampler2D image;
uniform sampler3D lut;
uniform float taille;
uniform float intensite;
in vec2 uv;
out vec4 couleur;
void main() {
  vec4 c = texture(image, uv);
  vec3 coord = c.rgb * ((taille - 1.0) / taille) + 0.5 / taille;
  vec3 l = texture(lut, coord).rgb;
  couleur = vec4(mix(c.rgb, l, intensite), c.a);
}`;

/* --- Aperçu rapide (02/10) : LUT réduite 33³ en binaire 8 bits, servie à l'aperçu du navigateur ---
 * Le `.cube` 65³ (7,4 Mo de texte) reste la LUT du RENDU FINAL, intacte. L'aperçu lit une copie réduite à 33³ et
 * quantifiée sur 8 bits (≈ 105 Ko) : exactement ce que la texture WebGL2 recevait déjà (`donneesTexture3D`), sans
 * télécharger ni lire 275 000 lignes. Fabriquée par `outils/lut/apercus.mts`, gardée à jour par `tests/apercu-lut.test.ts`.
 * Format : « ALUT » · version (1) · taille · 2 octets nuls · taille³ × (r, g, b) sur 8 bits, rouge le plus rapide.
 */

/** Dossier public des copies d'aperçu. */
export const DOSSIER_APERCU_LUT = "/luts/apercu/";
const ENTETE_APERCU = [0x41, 0x4c, 0x55, 0x54]; // « ALUT »
const VERSION_APERCU = 1;
const TAILLE_ENTETE_APERCU = 8;

/** Encode une LUT (domaine 0-1) en copie d'aperçu binaire, réduite à `taille`³. */
export function encoderLutApercu(lut: Lut3D, taille = TAILLE_LUT_NAVIGATEUR): Uint8Array {
  if (lut.domaineMin.some((v) => v !== 0) || lut.domaineMax.some((v) => v !== 1)) throw new Error("La copie d'aperçu n'accepte qu'une LUT de domaine 0-1.");
  const reduite = reduireLut(lut, taille);
  const n = reduite.taille ** 3 * 3;
  const sortie = new Uint8Array(TAILLE_ENTETE_APERCU + n);
  sortie.set(ENTETE_APERCU, 0);
  sortie[4] = VERSION_APERCU;
  sortie[5] = reduite.taille;
  for (let i = 0; i < n; i++) sortie[TAILLE_ENTETE_APERCU + i] = Math.round(Math.min(1, Math.max(0, reduite.donnees[i])) * 255);
  return sortie;
}

/** Lit une copie d'aperçu binaire. Lève une erreur en français si elle est cassée. */
export function lireLutApercu(octets: ArrayBuffer | Uint8Array): Lut3D {
  const o = octets instanceof Uint8Array ? octets : new Uint8Array(octets);
  if (o.length < TAILLE_ENTETE_APERCU || ENTETE_APERCU.some((b, i) => o[i] !== b)) throw new Error("Ce fichier n'est pas une copie d'aperçu de LUT.");
  if (o[4] !== VERSION_APERCU) throw new Error("Version de copie d'aperçu inconnue.");
  const taille = o[5];
  const n = taille ** 3 * 3;
  if (taille < 2 || o.length !== TAILLE_ENTETE_APERCU + n) throw new Error("La copie d'aperçu de la LUT est incomplète.");
  const donnees = new Float32Array(n);
  for (let i = 0; i < n; i++) donnees[i] = o[TAILLE_ENTETE_APERCU + i] / 255;
  return { taille, domaineMin: [0, 0, 0], domaineMax: [1, 1, 1], donnees };
}

/**
 * Adresse de la copie d'aperçu d'une LUT servie par le studio (`/luts/<nom>.cube` → `/luts/apercu/<nom>.33.bin`),
 * ou `null` (LUT importée, lue ailleurs) : l'aperçu lit alors le `.cube` lui-même, comme avant.
 */
export function urlApercuLut(url: string | null | undefined, taille = TAILLE_LUT_NAVIGATEUR): string | null {
  if (!url) return null;
  const m = /^\/luts\/([a-z0-9-]+)\.cube(?:\?.*)?$/i.exec(url);
  return m ? `${DOSSIER_APERCU_LUT}${m[1]}.${taille}.bin` : null;
}
