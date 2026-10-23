/**
 * PLATEAU DE DÉMONSTRATION DES EFFETS (lot F3, planche de validation) : une pièce sombre chaude, une personne
 * dessinée (aucun visage réel, comme le double simulé du studio) qui parle, et une main qui suit une piste
 * SIMULÉE (images clés). Rendu en MP4, il sert de « piste montée » aux compositions d'effets, exactement comme en
 * production ; la piste de main donnée à l'effet est échantillonnée sur la même trajectoire, une image sur 6, avec
 * le bruit d'une vraie détection.
 */
import { AbsoluteFill, useCurrentFrame } from "remotion";

export interface CleMain {
  t: number;
  /** Centre de la paume, normalisé sur l'image. */
  x: number;
  y: number;
  /** 0 : poing fermé ; 1 : main grande ouverte. */
  ouverture: number;
}

export type ProprietesPlateau = {
  largeur: number;
  hauteur: number;
  fps: number;
  images: number;
  /** Trajectoire de la main droite (vide : main hors champ). */
  main: CleMain[];
  /** Plan serré (1 = plan poitrine ; 1,25 = plan rapproché) : « plan suivant » des transitions. */
  serre: number;
  /** Teinte du mur (variante du plan suivant). */
  mur?: string;
};

/** Boîte du visage dessiné (px, plan poitrine 1080 × 1920) : sert de piste du visage simulée. */
export const VISAGE_PLATEAU = { cx: 540, cy: 640, rx: 150, ry: 190 } as const;

const doux = (u: number) => {
  const x = Math.min(1, Math.max(0, u));
  return x * x * (3 - 2 * x);
};

/** Position et ouverture de la main à l'instant t (interpolation douce entre les images clés). */
export function mainA(cles: CleMain[], t: number): CleMain | null {
  if (!cles.length) return null;
  if (t <= cles[0].t) return cles[0];
  for (let i = 1; i < cles.length; i++) {
    if (t <= cles[i].t) {
      const a = cles[i - 1];
      const b = cles[i];
      const k = doux((t - a.t) / Math.max(1e-6, b.t - a.t));
      return { t, x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k, ouverture: a.ouverture + (b.ouverture - a.ouverture) * k };
    }
  }
  return cles[cles.length - 1];
}

function Main({ cle, paume, l, h }: { cle: CleMain; paume: number; l: number; h: number }) {
  const x = cle.x * l;
  const y = cle.y * h;
  const o = cle.ouverture;
  const doigts = [
    { a: -0.42, long: 0.78 },
    { a: -0.14, long: 0.92 },
    { a: 0.13, long: 0.86 },
    { a: 0.38, long: 0.68 },
  ];
  const largeurDoigt = paume * 0.2;
  return (
    <g>
      {/* Avant-bras (manche du pull) depuis le bas de l'image. */}
      <path d={`M ${x + paume * 0.9} ${h + 40} C ${x + paume * 0.7} ${y + paume * 2.2}, ${x + paume * 0.25} ${y + paume * 1.3}, ${x + paume * 0.05} ${y + paume * 0.75} L ${x - paume * 0.45} ${y + paume * 0.62} C ${x - paume * 0.4} ${y + paume * 1.5}, ${x - paume * 0.1} ${y + paume * 2.6}, ${x - paume * 0.3} ${h + 40} Z`} fill="url(#pull)" />
      {/* Paume (face à la caméra), éclairée de la gauche. */}
      <ellipse cx={x} cy={y + paume * 0.12} rx={paume * 0.46} ry={paume * 0.5} fill="url(#peauMain)" />
      {doigts.map((d, i) => {
        const long = paume * d.long * (0.32 + 0.68 * o);
        const bx = x + Math.sin(d.a * 0.6) * paume * 0.36 + d.a * paume * 0.18;
        const by = y - paume * 0.28;
        const ang = d.a * (0.35 + 0.65 * o);
        const ex = bx + Math.sin(ang) * long;
        const ey = by - Math.cos(ang) * long;
        return <line key={i} x1={bx} y1={by} x2={ex} y2={ey} stroke="url(#peauMain)" strokeWidth={largeurDoigt} strokeLinecap="round" />;
      })}
      {/* Pouce : écarté main ouverte, replié sur le poing. */}
      <line x1={x - paume * 0.32} y1={y + paume * 0.1} x2={x - paume * (0.32 + 0.4 * o)} y2={y - paume * (0.05 + 0.25 * o)} stroke="url(#peauMain)" strokeWidth={largeurDoigt * 1.1} strokeLinecap="round" />
      {/* Plis de la paume (discrets). */}
      <path d={`M ${x - paume * 0.25} ${y + paume * 0.05} Q ${x} ${y + paume * 0.18} ${x + paume * 0.28} ${y - paume * 0.02}`} stroke="rgba(90,50,35,0.35)" strokeWidth={3} fill="none" />
    </g>
  );
}

export function PlateauEffets(p: ProprietesPlateau) {
  const image = useCurrentFrame();
  const t = image / p.fps;
  const { largeur: l, hauteur: h } = p;
  const v = VISAGE_PLATEAU;
  const balance = 5 * Math.sin(t * 2 * Math.PI * 0.31) + 2 * Math.sin(t * 2 * Math.PI * 0.83);
  const inclinaison = 1.6 * Math.sin(t * 2 * Math.PI * 0.23);
  const respiration = 1 + 0.005 * Math.sin(t * 2 * Math.PI * 0.27);
  // Bouche : parole (ouverture irrégulière), clignement toutes les ≈ 3,4 s.
  const parole = Math.max(0, Math.sin(t * 13.1) * 0.6 + Math.sin(t * 7.3 + 1) * 0.4);
  const cligne = (t % 3.4) > 3.28 ? 0.15 : 1;
  const cle = mainA(p.main, t);
  const paume = v.rx * 2 * 0.62;
  const mur = p.mur ?? "#2E2119";
  return (
    <AbsoluteFill style={{ backgroundColor: "#16120F", overflow: "hidden" }}>
      <AbsoluteFill style={{ transform: `scale(${p.serre})`, transformOrigin: `${(v.cx / l) * 100}% ${(v.cy / h) * 100}%` }}>
        <svg viewBox={`0 0 ${l} ${h}`} width="100%" height="100%">
          <defs>
            <radialGradient id="mur" cx="0.3" cy="0.3" r="0.9">
              <stop offset="0" stopColor={mur} />
              <stop offset="1" stopColor="#120E0B" />
            </radialGradient>
            <radialGradient id="peau" cx="0.38" cy="0.32" r="0.75">
              <stop offset="0" stopColor="#E2B496" />
              <stop offset="0.6" stopColor="#C08A6C" />
              <stop offset="1" stopColor="#8A5A44" />
            </radialGradient>
            <linearGradient id="peauMain" x1="0" x2="1" y1="0" y2="1">
              <stop offset="0" stopColor="#E0B293" />
              <stop offset="1" stopColor="#A9765C" />
            </linearGradient>
            <linearGradient id="pull" x1="0" x2="1" y1="0" y2="0">
              <stop offset="0" stopColor="#3B332D" />
              <stop offset="0.6" stopColor="#2A2420" />
              <stop offset="1" stopColor="#1B1714" />
            </linearGradient>
            <filter id="flou40">
              <feGaussianBlur stdDeviation="40" />
            </filter>
            <filter id="flou14">
              <feGaussianBlur stdDeviation="14" />
            </filter>
          </defs>
          <rect width={l} height={h} fill="url(#mur)" />
          {/* Lumière de fenêtre à gauche, objets flous du décor (étagère, lampe). */}
          <ellipse cx={-60} cy={560} rx={420} ry={760} fill="rgba(255,206,160,0.16)" filter="url(#flou40)" />
          <circle cx={900} cy={420} r={70} fill="rgba(224,112,64,0.35)" filter="url(#flou40)" />
          <rect x={780} y={980} width={300} height={22} rx={8} fill="rgba(246,238,224,0.08)" filter="url(#flou14)" />
          <circle cx={830} cy={930} r={36} fill="rgba(198,90,46,0.25)" filter="url(#flou14)" />
          <circle cx={950} cy={920} r={46} fill="rgba(246,238,224,0.1)" filter="url(#flou14)" />
          <g transform={`translate(${balance * 0.4} 0) scale(1 ${respiration})`} style={{ transformOrigin: "540px 1920px" }}>
            {/* Buste et cou. */}
            <path d="M 470 770 L 610 770 L 628 1000 C 590 1030, 490 1030, 452 1000 Z" fill="#A36F56" />
            <path d="M 470 860 C 520 900, 570 900, 610 860 L 612 900 C 570 940, 510 940, 468 900 Z" fill="rgba(70,40,28,0.35)" />
            <path d="M 50 1920 C 70 1380, 180 1060, 410 990 C 470 1030, 610 1030, 670 990 C 900 1060, 1010 1380, 1030 1920 Z" fill="url(#pull)" />
            <path d="M 410 990 C 470 1045, 610 1045, 670 990 L 690 1010 C 620 1080, 460 1080, 390 1010 Z" fill="#231E1A" />
          </g>
          {/* Tête. */}
          <g transform={`rotate(${inclinaison} ${v.cx} ${v.cy + 160}) translate(${balance} 0)`}>
            <ellipse cx={v.cx - v.rx + 6} cy={v.cy + 20} rx={22} ry={40} fill="#B07D62" />
            <ellipse cx={v.cx + v.rx - 6} cy={v.cy + 20} rx={22} ry={40} fill="#8E5E48" />
            <ellipse cx={v.cx} cy={v.cy} rx={v.rx} ry={v.ry} fill="url(#peau)" />
            <path d={`M ${v.cx - v.rx - 4} ${v.cy - 30} C ${v.cx - v.rx} ${v.cy - v.ry - 40}, ${v.cx + v.rx} ${v.cy - v.ry - 50}, ${v.cx + v.rx + 4} ${v.cy - 40} C ${v.cx + v.rx - 30} ${v.cy - v.ry + 10}, ${v.cx - 40} ${v.cy - v.ry + 30}, ${v.cx - v.rx - 4} ${v.cy - 30} Z`} fill="#2A1C15" />
            {/* Sourcils, yeux, nez, bouche (traits simples). */}
            <path d={`M ${v.cx - 95} ${v.cy - 52} Q ${v.cx - 62} ${v.cy - 68} ${v.cx - 28} ${v.cy - 54}`} stroke="#3A271D" strokeWidth={9} strokeLinecap="round" fill="none" />
            <path d={`M ${v.cx + 28} ${v.cy - 54} Q ${v.cx + 62} ${v.cy - 68} ${v.cx + 95} ${v.cy - 52}`} stroke="#3A271D" strokeWidth={9} strokeLinecap="round" fill="none" />
            <ellipse cx={v.cx - 60} cy={v.cy - 18} rx={15} ry={11 * cligne} fill="#22170F" />
            <ellipse cx={v.cx + 60} cy={v.cy - 18} rx={15} ry={11 * cligne} fill="#22170F" />
            <path d={`M ${v.cx + 4} ${v.cy - 10} Q ${v.cx + 18} ${v.cy + 50} ${v.cx - 6} ${v.cy + 58}`} stroke="rgba(110,66,48,0.6)" strokeWidth={6} strokeLinecap="round" fill="none" />
            <rect x={v.cx - 42} y={v.cy + 96 - parole * 9} width={84} height={10 + parole * 22} rx={10 + parole * 8} fill="#5A2A20" />
          </g>
          {cle && cle.y < 1.08 ? <Main cle={cle} paume={paume} l={l} h={h} /> : null}
        </svg>
      </AbsoluteFill>
      {/* Vignette légère. */}
      <AbsoluteFill style={{ background: "radial-gradient(ellipse at 50% 42%, rgba(0,0,0,0) 55%, rgba(0,0,0,0.38) 100%)" }} />
    </AbsoluteFill>
  );
}
