/**
 * DOUBLE SIMULÉ (lot M4) : une silhouette dessinée, assise, de la tête à mi-cuisse, en trois-quarts (regard vers la
 * droite), dans le cadre source 1080 × 1920, fond transparent. Aucun visage réel : elle sert aux essais sans clé
 * (montage, cadrages, liseré, LUT), et, rendue en webm transparent (`DoubleEssai`), à mesurer le décodage d'un webm
 * alpha 1080p comme celui de HeyGen. Léger mouvement : respiration, tête, gestes des mains au rythme de `t`.
 */
import { AbsoluteFill } from "remotion";

export type ProprietesSilhouette = { tenue: string; peau: string; t: number };

export function Silhouette({ tenue, peau, t }: ProprietesSilhouette) {
  const respiration = 1 + 0.006 * Math.sin(t * 2 * Math.PI * 0.25);
  const tete = 6 * Math.sin(t * 2 * Math.PI * 0.37) + 3 * Math.sin(t * 2 * Math.PI * 0.91);
  const inclinaison = 2.2 * Math.sin(t * 2 * Math.PI * 0.21);
  // Main droite : un geste ouvert à hauteur de poitrine toutes les ≈ 4 s, puis retour au repos sur la cuisse.
  const phase = (t % 4) / 4;
  const geste = phase < 0.35 ? Math.sin((phase / 0.35) * Math.PI) : 0;
  const mainX = 700 + 60 * geste;
  const mainY = 1720 - 520 * geste;
  return (
    <AbsoluteFill>
      <svg viewBox="0 0 1080 1920" width="100%" height="100%">
        <defs>
          <linearGradient id="veste" x1="0" x2="1" y1="0" y2="0">
            <stop offset="0" stopColor={tenue} stopOpacity="1" />
            <stop offset="0.65" stopColor={tenue} />
            <stop offset="1" stopColor="#2C313B" />
          </linearGradient>
          <radialGradient id="peau" cx="0.6" cy="0.4" r="0.7">
            <stop offset="0" stopColor={peau} />
            <stop offset="1" stopColor="#8E6553" />
          </radialGradient>
          <linearGradient id="pantalon" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0" stopColor="#23262D" />
            <stop offset="1" stopColor="#15171B" />
          </linearGradient>
        </defs>
        {/* Cuisses (assis, coupées à mi-cuisse par le bas du cadre). */}
        <path d="M300 1500 C 290 1700, 300 1860, 310 1920 L 1010 1920 C 1020 1800, 1000 1650, 960 1540 C 840 1500, 460 1480, 300 1500 Z" fill="url(#pantalon)" />
        {/* Buste (veste), respiration. */}
        <g transform={`translate(540 1100) scale(${respiration}) translate(-540 -1100)`}>
          <path d="M330 760 C 250 820, 230 1000, 250 1250 C 260 1420, 280 1520, 300 1560 L 940 1560 C 960 1480, 980 1380, 960 1240 C 950 1050, 930 840, 830 760 C 760 720, 640 700, 580 700 C 500 700, 400 720, 330 760 Z" fill="url(#veste)" />
          {/* Chemise et col. */}
          <path d="M520 712 L 600 712 L 640 980 L 580 1060 L 520 980 Z" fill="#E8E2D8" />
          <path d="M500 720 L 560 1010 L 470 860 Z M 640 720 L 600 1010 L 690 860 Z" fill="#191C22" />
          {/* Bras gauche, posé. */}
          <path d="M300 820 C 230 1000, 240 1300, 330 1560 L 420 1560 C 380 1350, 370 1050, 390 880 Z" fill={tenue} opacity="0.95" />
          {/* Bras droit, du coude vers la main (geste). */}
          <path d={`M820 820 C 900 980, 920 1220, 880 1380 L ${mainX - 30} ${mainY - 10} L ${mainX + 30} ${mainY + 30} L 940 1420 C 990 1240, 960 980, 880 840 Z`} fill={tenue} />
        </g>
        {/* Mains. */}
        <ellipse cx="380" cy="1680" rx="70" ry="44" fill="url(#peau)" />
        <ellipse cx={mainX} cy={mainY} rx="66" ry="46" fill="url(#peau)" transform={`rotate(${-20 * geste} ${mainX} ${mainY})`} />
        {/* Cou et tête (trois-quarts, regard vers la droite). */}
        <g transform={`translate(0 ${tete}) rotate(${inclinaison} 570 640)`}>
          <path d="M520 560 L 620 560 L 615 720 L 525 720 Z" fill="url(#peau)" />
          <ellipse cx="575" cy="440" rx="125" ry="158" fill="url(#peau)" />
          {/* Cheveux. */}
          <path d="M450 420 C 440 300, 520 250, 590 255 C 680 260, 715 320, 700 400 C 680 350, 600 330, 520 350 C 480 360, 465 390, 450 420 Z" fill="#2A211C" />
          {/* Oreille (trois-quarts : visible à gauche). */}
          <ellipse cx="455" cy="455" rx="20" ry="38" fill="#B07F68" />
        </g>
      </svg>
    </AbsoluteFill>
  );
}
