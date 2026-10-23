/**
 * TRANSITIONS SPECTACULAIRES (lot F3) : vitre qui se brise, écran qui se plie, zoom à travers l'écran.
 *
 * Deux calques : dessous, le plan révélé (piste qui continue, ou carte déjà rendue) ; dessus, un canevas 2D où l'image
 * FIGÉE du plan qui part est découpée (triangles projetés en perspective par la brique `effets-speciaux`). Flou de
 * mouvement EXACT : chaque image est la moyenne de plusieurs sous-instants pendant l'obturateur (180°, 1/50 s),
 * cumulés en mode additif avec un poids 1/K. Tout dépend du numéro d'image : rendu déterministe.
 */
import { useLayoutEffect, useMemo, useRef, useState } from "react";
import { AbsoluteFill, continueRender, delayRender, Freeze, Img, OffthreadVideo, Sequence, useCurrentFrame } from "remotion";
import { dessinTransition, echelleApres, genererEclats, type Dessin, type ParametresTransition } from "../../../../src/briques/effets-speciaux/transitions";
import type { ProprietesEffetTransition } from "../../../../src/briques/effets-speciaux/types";

const OBTURATEUR_SEC = 1 / 50;
const SOUS_INSTANTS: Record<ProprietesEffetTransition["style"], number> = { "vitre-brisee": 7, "ecran-plie": 6, "zoom-traversant": 16 };

type P2 = [number, number];

/** Matrice affine qui envoie le triangle source sur le triangle écran. */
function affine(s: [P2, P2, P2], d: [P2, P2, P2]): [number, number, number, number, number, number] | null {
  const [[x0, y0], [x1, y1], [x2, y2]] = s;
  const [[u0, v0], [u1, v1], [u2, v2]] = d;
  const det = (x1 - x0) * (y2 - y0) - (x2 - x0) * (y1 - y0);
  if (Math.abs(det) < 1e-9) return null;
  const a = ((u1 - u0) * (y2 - y0) - (u2 - u0) * (y1 - y0)) / det;
  const c = ((u2 - u0) * (x1 - x0) - (u1 - u0) * (x2 - x0)) / det;
  const b = ((v1 - v0) * (y2 - y0) - (v2 - v0) * (y1 - y0)) / det;
  const dd = ((v2 - v0) * (x1 - x0) - (v1 - v0) * (x2 - x0)) / det;
  return [a, b, c, dd, u0 - a * x0 - c * y0, v0 - b * x0 - dd * y0];
}

/** Triangle légèrement agrandi (0,6 px) autour de son centre : aucun jour entre deux triangles voisins. */
function gonfler(t: [P2, P2, P2], px: number): [P2, P2, P2] {
  const cx = (t[0][0] + t[1][0] + t[2][0]) / 3;
  const cy = (t[0][1] + t[1][1] + t[2][1]) / 3;
  return t.map(([x, y]) => {
    const d = Math.hypot(x - cx, y - cy) || 1;
    return [x + ((x - cx) / d) * px, y + ((y - cy) / d) * px];
  }) as [P2, P2, P2];
}

function chemin(ctx: CanvasRenderingContext2D, pts: P2[]) {
  ctx.beginPath();
  pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
  ctx.closePath();
}

function dessiner(ctx: CanvasRenderingContext2D, dessins: Dessin[], img: CanvasImageSource, l: number, h: number, versoPapier: boolean) {
  for (const d of dessins) {
    switch (d.type) {
      case "image": {
        ctx.drawImage(img, 0, 0, l, h);
        if (d.trous.length) {
          ctx.globalCompositeOperation = "destination-out";
          ctx.fillStyle = "#000";
          for (const t of d.trous) {
            chemin(ctx, t);
            ctx.fill();
          }
          ctx.globalCompositeOperation = "source-over";
        }
        break;
      }
      case "ombre": {
        if (d.opacite <= 0) break;
        ctx.save();
        ctx.filter = `blur(${d.flou}px)`;
        ctx.fillStyle = `rgba(8,6,5,${d.opacite})`;
        chemin(
          ctx,
          d.polygone.map(([x, y]) => [x + d.decalage[0], y + d.decalage[1]] as P2),
        );
        ctx.fill();
        ctx.restore();
        break;
      }
      case "triangle": {
        const m = affine(d.source, d.ecran);
        if (!m) break;
        ctx.save();
        ctx.globalAlpha = d.opacite ?? 1;
        chemin(ctx, gonfler(d.ecran, 0.6));
        ctx.clip();
        if (d.verso && versoPapier) {
          // Dos de la feuille pliée : papier sombre chaud de la charte, avec un léger grain de lumière.
          ctx.fillStyle = "#2C221B";
          ctx.fill();
        } else {
          ctx.setTransform(...m);
          ctx.drawImage(img, 0, 0, l, h);
          ctx.setTransform(1, 0, 0, 1, 0, 0);
          // Dos d'un éclat de verre : l'image vue à travers, un peu assombrie.
          if (d.verso) {
            ctx.fillStyle = "rgba(12,10,8,0.18)";
            ctx.fill();
          }
        }
        const o = d.ombre;
        if (o > 0.01) {
          ctx.fillStyle = `rgba(255,244,230,${(o * 0.55).toFixed(3)})`;
          ctx.fill();
        } else if (o < -0.01) {
          ctx.fillStyle = `rgba(12,10,8,${(-o * 0.75).toFixed(3)})`;
          ctx.fill();
        }
        ctx.restore();
        break;
      }
      case "contour": {
        if (d.opacite <= 0.02) break;
        ctx.save();
        chemin(ctx, d.polygone);
        ctx.lineJoin = "round";
        ctx.strokeStyle = `rgba(12,10,8,${(0.45 * d.opacite).toFixed(3)})`;
        ctx.lineWidth = 3;
        ctx.stroke();
        ctx.strokeStyle = `rgba(246,238,224,${Math.min(1, d.opacite).toFixed(3)})`;
        ctx.lineWidth = 1.6;
        ctx.stroke();
        ctx.restore();
        break;
      }
      case "fissures": {
        ctx.save();
        ctx.lineCap = "round";
        // Ombre de la fissure (le verre se décale), puis le liseré de lumière sur la tranche.
        for (const [x1, y1, x2, y2, a, e] of d.segments) {
          ctx.strokeStyle = `rgba(12,10,8,${(0.5 * a).toFixed(3)})`;
          ctx.lineWidth = e + 1.6;
          ctx.beginPath();
          ctx.moveTo(x1 + 0.8, y1 + 0.8);
          ctx.lineTo(x2 + 0.8, y2 + 0.8);
          ctx.stroke();
        }
        ctx.shadowColor = "rgba(255,240,225,0.8)";
        ctx.shadowBlur = 4;
        for (const [x1, y1, x2, y2, a, e] of d.segments) {
          ctx.strokeStyle = `rgba(246,238,224,${(0.85 * a).toFixed(3)})`;
          ctx.lineWidth = e;
          ctx.beginPath();
          ctx.moveTo(x1, y1);
          ctx.lineTo(x2, y2);
          ctx.stroke();
        }
        ctx.restore();
        break;
      }
      case "eclair": {
        const g = ctx.createRadialGradient(d.centre[0], d.centre[1], 0, d.centre[0], d.centre[1], d.rayon);
        g.addColorStop(0, `rgba(255,248,238,${d.opacite})`);
        g.addColorStop(0.35, `rgba(224,112,64,${(d.opacite * 0.45).toFixed(3)})`);
        g.addColorStop(1, "rgba(224,112,64,0)");
        ctx.save();
        ctx.globalCompositeOperation = "lighter";
        ctx.fillStyle = g;
        ctx.fillRect(d.centre[0] - d.rayon, d.centre[1] - d.rayon, d.rayon * 2, d.rayon * 2);
        ctx.restore();
        break;
      }
      case "zoom": {
        const [cx, cy] = d.centre;
        ctx.save();
        ctx.translate(cx, cy);
        ctx.scale(d.echelle, d.echelle);
        ctx.translate(-cx, -cy);
        ctx.drawImage(img, 0, 0, l, h);
        ctx.restore();
        if (d.lumiere > 0) {
          ctx.save();
          ctx.globalCompositeOperation = "lighter";
          ctx.fillStyle = `rgba(255,236,214,${(d.lumiere * 0.5).toFixed(3)})`;
          ctx.fillRect(0, 0, l, h);
          ctx.restore();
        }
        if (d.iris > 0) {
          // Iris à bord doux : on perce l'image figée, le plan suivant apparaît dessous.
          const bord = 70;
          const g = ctx.createRadialGradient(cx, cy, Math.max(0, d.iris - bord), cx, cy, d.iris + 1);
          g.addColorStop(0, "rgba(0,0,0,1)");
          g.addColorStop(1, "rgba(0,0,0,0)");
          ctx.save();
          ctx.globalCompositeOperation = "destination-out";
          ctx.fillStyle = g;
          ctx.fillRect(0, 0, l, h);
          ctx.restore();
          if (d.anneau > 0) {
            ctx.save();
            ctx.globalCompositeOperation = "lighter";
            ctx.strokeStyle = `rgba(224,112,64,${(0.8 * d.anneau).toFixed(3)})`;
            ctx.shadowColor = "rgba(224,112,64,0.9)";
            ctx.shadowBlur = 36;
            ctx.lineWidth = 10 + 14 * d.anneau;
            ctx.beginPath();
            ctx.arc(cx, cy, Math.max(1, d.iris - bord / 2), 0, Math.PI * 2);
            ctx.stroke();
            ctx.restore();
          }
        }
        break;
      }
    }
  }
}

function Canevas(p: ProprietesEffetTransition & { image: CanvasImageSource | null; pretAttente: () => void }) {
  const image = useCurrentFrame();
  const ref = useRef<HTMLCanvasElement>(null);
  const tampon = useRef<HTMLCanvasElement | null>(null);
  const parametres: ParametresTransition = useMemo(
    () => ({ largeur: p.largeur, hauteur: p.hauteur, dureeSec: p.dureeEffetImages / p.fps, point: p.point, visageApres: p.visageApres, graine: p.graine }),
    [p.largeur, p.hauteur, p.dureeEffetImages, p.fps, p.point, p.visageApres, p.graine],
  );
  const eclats = useMemo(() => (p.style === "vitre-brisee" ? genererEclats(parametres) : undefined), [p.style, parametres]);
  useLayoutEffect(() => {
    const c = ref.current;
    if (!c) return;
    const ctx = contexte2d(c);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalCompositeOperation = "source-over";
    ctx.globalAlpha = 1;
    ctx.clearRect(0, 0, p.largeur, p.hauteur);
    const t = (image - p.debutEffetImage) / p.fps;
    if (!p.image || t < 0 || t >= parametres.dureeSec) {
      p.pretAttente();
      return;
    }
    if (!tampon.current) {
      tampon.current = document.createElement("canvas");
      tampon.current.width = p.largeur;
      tampon.current.height = p.hauteur;
    }
    const tc = contexte2d(tampon.current);
    // Canevas 8 bits : chaque ajout à 1/K perd jusqu'à un niveau par canal (teinte qui dérive) ; on borne alors K.
    const K = flottant(ctx) ? SOUS_INSTANTS[p.style] : Math.min(4, SOUS_INSTANTS[p.style]);
    for (let k = 0; k < K; k++) {
      // Obturateur à 180° : sous-instants répartis sur la demi-image qui PRÉCÈDE l'instant (traînée derrière).
      const ts = Math.max(0, t - (OBTURATEUR_SEC * k) / Math.max(1, K - 1));
      tc.setTransform(1, 0, 0, 1, 0, 0);
      tc.globalCompositeOperation = "source-over";
      tc.globalAlpha = 1;
      tc.clearRect(0, 0, p.largeur, p.hauteur);
      dessiner(tc, dessinTransition(p.style, parametres, ts, eclats), p.image, p.largeur, p.hauteur, p.style === "ecran-plie");
      ctx.globalCompositeOperation = "lighter";
      ctx.globalAlpha = 1 / K;
      ctx.drawImage(tampon.current, 0, 0);
    }
    ctx.globalCompositeOperation = "source-over";
    ctx.globalAlpha = 1;
    p.pretAttente();
  });
  return <canvas ref={ref} width={p.largeur} height={p.hauteur} style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }} />;
}

/**
 * Contexte 2D en virgule flottante (float16) quand le navigateur le permet : la moyenne de 6 à 16 sous-instants
 * reste exacte, sans dérive de teinte. Repli : contexte 8 bits ordinaire.
 */
function contexte2d(c: HTMLCanvasElement): CanvasRenderingContext2D {
  const options = { colorType: "float16" } as unknown as CanvasRenderingContext2DSettings;
  return (c.getContext("2d", options) ?? c.getContext("2d"))!;
}

function flottant(ctx: CanvasRenderingContext2D): boolean {
  const attributs = (ctx as unknown as { getContextAttributes?: () => { colorType?: string } }).getContextAttributes?.();
  return attributs?.colorType === "float16";
}

/** Une source (vidéo ou image) montrée à partir d'une image donnée. */
function Source({ source, image, debut, style, onFrame }: { source: string; image?: boolean; debut: number; style?: React.CSSProperties; onFrame?: (f: CanvasImageSource) => void }) {
  const s: React.CSSProperties = { width: "100%", height: "100%", objectFit: "cover", ...style };
  if (image) return <Img src={source} style={s} onLoad={onFrame ? (e) => onFrame(e.currentTarget) : undefined} />;
  return <OffthreadVideo src={source} startFrom={Math.max(0, debut)} muted style={s} onVideoFrame={onFrame} />;
}

export function EffetTransition(p: ProprietesEffetTransition) {
  const image = useCurrentFrame();
  const figee = useRef<CanvasImageSource | null>(null);
  // L'image figée est aussi gardée en état : le rendu ne lit jamais la référence (règle react-hooks/refs).
  const [imageFigee, setImageFigee] = useState<CanvasImageSource | null>(null);
  // Le rendu attend l'image figée du plan qui part (une fois par onglet), puis dessine à chaque image, sans attente.
  const [attente] = useState(() => delayRender(`Transition ${p.style} : image figée`, { timeoutInMilliseconds: 60_000 }));
  const libere = useRef(false);
  const liberer = () => {
    if (!libere.current && figee.current) {
      libere.current = true;
      continueRender(attente);
    }
  };
  const recevoir = (f: CanvasImageSource) => {
    if (figee.current) return;
    figee.current = f;
    setImageFigee(f);
  };
  const t = (image - p.debutEffetImage) / p.fps;
  const echelle = echelleApres(p.style, t, p.dureeEffetImages / p.fps);
  const origine = `${((p.point.x / p.largeur) * 100).toFixed(2)}% ${((p.point.y / p.hauteur) * 100).toFixed(2)}%`;
  return (
    <AbsoluteFill style={{ backgroundColor: "#16120F", overflow: "hidden" }}>
      {/* Avant l'effet (planche, ou effet décalé dans un extrait plus long) : le plan qui part, en direct. */}
      {p.debutEffetImage > 0 ? (
        <Sequence from={0} durationInFrames={p.debutEffetImage} layout="none">
          <Source source={p.avant.source} image={p.avant.image} debut={p.avant.debutImage - (p.debutEffetImage - 1)} />
        </Sequence>
      ) : null}
      {/* Le plan révélé, dès le début de l'effet. */}
      <Sequence from={p.debutEffetImage} layout="none">
        <AbsoluteFill style={{ transform: `scale(${echelle.toFixed(4)})`, transformOrigin: origine }}>
          <Source source={p.apres.source} image={p.apres.image} debut={p.apres.debutImage} />
        </AbsoluteFill>
      </Sequence>
      {/* Image figée du plan qui part (cachée : elle n'est lue que par le canevas). */}
      <AbsoluteFill style={{ opacity: 0, pointerEvents: "none" }}>
        <Freeze frame={0}>
          <Source source={p.avant.source} image={p.avant.image} debut={p.avant.debutImage} onFrame={recevoir} />
        </Freeze>
      </AbsoluteFill>
      <Canevas {...p} image={imageFigee} pretAttente={liberer} />
    </AbsoluteFill>
  );
}
