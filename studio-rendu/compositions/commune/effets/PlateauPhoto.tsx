/**
 * PLATEAU PHOTOGRAPHIQUE DES EFFETS « MAIN » (lot I2, planche de validation). Remplace la personne dessinée, qui ne
 * permettait pas de juger le réalisme : une VRAIE photo de personne en buste et une VRAIE main photographiée paume
 * vers le haut (photos de test publiées avec MediaPipe, voir `scripts/planche-photos/LICENCES.md`), montées en une
 * fausse prise de 5 s : la main entre par le bas, se pose, bouge un peu, puis redescend. Léger flottement de caméra
 * et grain de capteur, comme une vraie prise. Les 21 points MediaPipe de la main, détectés sur la photo, suivent la
 * même transformation (`transformationMain`) : c'est la piste simulée donnée à l'effet.
 */
import { AbsoluteFill, Img, useCurrentFrame } from "remotion";

export const COMPOSITION_PLATEAU_PHOTO = "PlateauPhotoEffets";

export interface CleTransformation {
  t: number;
  /** Décalage de la main (px) et rotation (degrés) autour de l'épaule (hors champ, en bas à gauche). */
  dx: number;
  dy: number;
  angle: number;
}

export type ProprietesPlateauPhoto = {
  largeur: number;
  hauteur: number;
  fps: number;
  images: number;
  /** Adresses des deux photos (servies en local par la planche). */
  personne: string;
  main: string;
  cles: CleTransformation[];
};

/** Mise en place des photos (px de l'image 1080 × 1920). */
export const PLATEAU_PHOTO = {
  personne: { largeur: 958, hauteur: 1358, echelle: 1.33, x: -105, y: 116 },
  /** Détourage de la main : recadrage de la photo d'origine (640 × 317), agrandi et posé ici. */
  main: { recadrage: { x: 0, y: 95, largeur: 400, hauteur: 222 }, echelle: 2.8, x: -60, y: 1308 },
  /** Boîte du visage (px), pour la piste du visage simulée et la mesure de la lumière. */
  visage: [380, 360, 300, 350] as [number, number, number, number],
} as const;

/** Pivot de la rotation de la main : coin bas gauche du détourage (l'épaule est hors champ). */
const pivot = () => ({ x: PLATEAU_PHOTO.main.x, y: PLATEAU_PHOTO.main.y + PLATEAU_PHOTO.main.recadrage.hauteur * PLATEAU_PHOTO.main.echelle });

const doux = (u: number) => {
  const x = Math.min(1, Math.max(0, u));
  return x * x * (3 - 2 * x);
};

/** Transformation de la main à l'instant t (interpolation douce entre les clés). */
export function cleA(cles: CleTransformation[], t: number): CleTransformation {
  if (!cles.length) return { t, dx: 0, dy: 0, angle: 0 };
  if (t <= cles[0].t) return cles[0];
  for (let i = 1; i < cles.length; i++) {
    if (t <= cles[i].t) {
      const a = cles[i - 1];
      const b = cles[i];
      const k = doux((t - a.t) / Math.max(1e-6, b.t - a.t));
      return { t, dx: a.dx + (b.dx - a.dx) * k, dy: a.dy + (b.dy - a.dy) * k, angle: a.angle + (b.angle - a.angle) * k };
    }
  }
  return cles[cles.length - 1];
}

/** Léger flottement de la caméra tenue (px), commun à toute l'image. */
export function flottement(t: number): { x: number; y: number } {
  return { x: 3 * Math.sin(t * 1.3) + 1.2 * Math.sin(t * 3.1 + 1), y: 2.5 * Math.sin(t * 1.1 + 2) + 1 * Math.sin(t * 2.7) };
}

/**
 * Point de la photo d'origine de la main (px, 640 × 317 ; z en px) → point de l'image du plateau (px) à l'instant t.
 * La profondeur suit l'agrandissement (aucune rotation hors du plan de l'image).
 */
export function transformationMain(cles: CleTransformation[], t: number, p: [number, number, number]): [number, number, number] {
  const m = PLATEAU_PHOTO.main;
  const c = cleA(cles, t);
  const f = flottement(t);
  const x0 = m.x + (p[0] - m.recadrage.x) * m.echelle;
  const y0 = m.y + (p[1] - m.recadrage.y) * m.echelle;
  const o = pivot();
  const a = (c.angle * Math.PI) / 180;
  const rx = o.x + (x0 - o.x) * Math.cos(a) - (y0 - o.y) * Math.sin(a);
  const ry = o.y + (x0 - o.x) * Math.sin(a) + (y0 - o.y) * Math.cos(a);
  return [rx + c.dx + f.x, ry + c.dy + f.y, p[2] * m.echelle];
}

export function PlateauPhoto(p: ProprietesPlateauPhoto) {
  const image = useCurrentFrame();
  const t = image / p.fps;
  const P = PLATEAU_PHOTO.personne;
  const M = PLATEAU_PHOTO.main;
  const c = cleA(p.cles, t);
  const f = flottement(t);
  const o = pivot();
  const largeurMain = M.recadrage.largeur * M.echelle;
  const hauteurMain = M.recadrage.hauteur * M.echelle;
  return (
    <AbsoluteFill style={{ backgroundColor: "#F2F1EF", overflow: "hidden" }}>
      <AbsoluteFill style={{ transform: `translate(${f.x}px, ${f.y}px)` }}>
        {/* Fond de studio : la photo est sur un blanc pur, on le prolonge en gris très clair, éclairé en haut à gauche. */}
        <AbsoluteFill style={{ background: "radial-gradient(ellipse at 30% 20%, #FBFAF8 0%, #ECEAE6 55%, #D9D6D1 100%)" }} />
        <Img src={p.personne} style={{ position: "absolute", left: P.x, top: P.y, width: P.largeur * P.echelle, height: P.hauteur * P.echelle, mixBlendMode: "multiply" }} />
        {/* La main tendue, paume vers le haut, plus proche de la caméra. */}
        <div style={{ position: "absolute", left: 0, top: 0, width: p.largeur, height: p.hauteur, transform: `translate(${c.dx}px, ${c.dy}px) rotate(${c.angle}deg)`, transformOrigin: `${o.x}px ${o.y}px` }}>
          <Img src={p.main} style={{ position: "absolute", left: M.x, top: M.y, width: largeurMain, height: hauteurMain, filter: "drop-shadow(0px 26px 34px rgba(30,24,20,0.28)) saturate(1.04)" }} />
        </div>
      </AbsoluteFill>
      {/* Vignettage d'objectif et grain de capteur (déterministe : graine = numéro d'image). */}
      <AbsoluteFill style={{ background: "radial-gradient(ellipse at 50% 45%, rgba(0,0,0,0) 60%, rgba(40,32,26,0.22) 100%)" }} />
      <svg width={p.largeur} height={p.hauteur} style={{ position: "absolute", inset: 0, mixBlendMode: "overlay", opacity: 0.16 }}>
        <filter id="grain-capteur">
          <feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves={2} seed={image + 1} stitchTiles="stitch" />
          <feColorMatrix type="saturate" values="0.15" />
        </filter>
        <rect width="100%" height="100%" filter="url(#grain-capteur)" />
      </svg>
    </AbsoluteFill>
  );
}
