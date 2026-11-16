/**
 * GRAPHE « VISAGE + ÉCRAN » (écran divisé), FFmpeg pur (fiche G11-08). PUR : aucun appel, aucun fichier, aucun import de
 * `src/moteurs/**` ; la géométrie arrive en paramètres. Appelé par aucun chemin de production pour l'instant.
 *
 * Entrées FFmpeg : `0:v` = la vidéo du visage, `1:v` = la vidéo de l'écran. Sortie : l'étiquette `[sortie]`.
 * Seulement `scale`, `crop`, `overlay` (et les conversions de format) : ni texte, ni LUT, rien sur le visage.
 */
import { FORMATS_10_BITS, FORMATS_8_BITS } from "./image-ffmpeg.js";

/** Rectangle en pixels de la toile. */
export interface RectangleGraphe {
  x: number;
  y: number;
  largeur: number;
  hauteur: number;
}

export interface ParametresEcranDivise {
  largeur: number;
  hauteur: number;
  rectVisage: RectangleGraphe;
  rectEcran: RectangleGraphe;
  fps: number;
  /** Absent ou faux : 8 bits (graphe d'aujourd'hui). Seul `true` passe en 10 bits. */
  dixBits?: boolean;
}

const entier = (n: number): boolean => Number.isInteger(n);

function verifierRectangle(nom: string, r: RectangleGraphe, largeur: number, hauteur: number): void {
  if (![r.x, r.y, r.largeur, r.hauteur].every(entier) || r.largeur <= 0 || r.hauteur <= 0)
    throw new Error(`Rectangle ${nom} invalide : entiers attendus, largeur et hauteur positives (reçu ${JSON.stringify(r)}).`);
  if (r.x < 0 || r.y < 0 || r.x + r.largeur > largeur || r.y + r.hauteur > hauteur)
    throw new Error(`Rectangle ${nom} hors de la toile ${largeur}x${hauteur} (reçu ${JSON.stringify(r)}).`);
}

const seRecouvrent = (a: RectangleGraphe, b: RectangleGraphe): boolean =>
  Math.min(a.x + a.largeur, b.x + b.largeur) > Math.max(a.x, b.x) && Math.min(a.y + a.hauteur, b.y + b.hauteur) > Math.max(a.y, b.y);

/** Une vidéo remplit son rectangle : mise à l'échelle qui couvre, puis recadrage au centre, au format de superposition. */
const remplir = (entree: string, r: RectangleGraphe, rvb: string, etiquette: string): string =>
  `${entree}scale=${r.largeur}:${r.hauteur}:force_original_aspect_ratio=increase,crop=${r.largeur}:${r.hauteur},format=${rvb}[${etiquette}]`;

export function grapheEcranDivise(p: ParametresEcranDivise): string {
  if (!entier(p.largeur) || !entier(p.hauteur) || p.largeur <= 0 || p.hauteur <= 0) throw new Error(`Toile invalide : ${p.largeur}x${p.hauteur}.`);
  if (!Number.isFinite(p.fps) || p.fps <= 0) throw new Error(`fps invalide : ${p.fps}.`);
  verifierRectangle("écran", p.rectEcran, p.largeur, p.hauteur);
  verifierRectangle("visage", p.rectVisage, p.largeur, p.hauteur);
  if (seRecouvrent(p.rectEcran, p.rectVisage)) throw new Error("Le rectangle de l'écran recouvre celui du visage : rien ne se pose sur le visage.");

  const f = p.dixBits === true ? FORMATS_10_BITS : FORMATS_8_BITS;
  const ov = (dessous: string, dessus: string, r: RectangleGraphe, sortie: string) => `[${dessous}][${dessus}]overlay=x=${r.x}:y=${r.y}:format=${f.ov}:eof_action=pass[${sortie}]`;
  // 8 bits : conversion par RVB planaire ; 10 bits : YUV 4:4:4 10 bits (même choix que `grapheExport`), une seule descente à la fin.
  const entree = p.dixBits === true ? "yuv444p10le" : f.rvb;
  const sortieFormat = p.dixBits === true ? "yuv420p10le" : "yuv420p";
  return [
    `color=c=black:s=${p.largeur}x${p.hauteur}:r=${p.fps},format=${entree}[toile]`,
    remplir("[1:v]", p.rectEcran, entree, "e"),
    remplir("[0:v]", p.rectVisage, entree, "f"),
    ov("toile", "e", p.rectEcran, "t"),
    // Le visage est posé en dernier : rien ne passe par-dessus.
    ov("t", "f", p.rectVisage, "o"),
    `[o]scale=out_color_matrix=bt709:out_range=tv,format=${sortieFormat}[sortie]`,
  ].join(";");
}
