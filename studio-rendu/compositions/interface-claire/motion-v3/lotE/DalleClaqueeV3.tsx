import React from "react";
/**
 * ÉLÉMENT 21 « DALLE CLAQUÉE » (standard v3, lot E ; `dalle-claquee` v2 rhabillée).
 *
 * Emplacement E7 plein écran · aplat orange en DÉGRADÉ RADIAL (orangeChaud au centre → orangeProfond aux bords) + grain de 2,5 %
 * + reflet du haut · mot encre en RELIEF léger (3 ombres empilées) · mot en creux qui défile derrière.
 * Visage : COUVERT (coupe franche : aucune image partielle à l'entrée). Sortie par MASQUE CIRCULAIRE qui se referme vers le
 * coin haut-droit (hors de la zone du visage) : plus de blob raté.
 * Quand : la phrase choc, un basculement (« stop », « fuite »). Jamais avant 10 s.
 *
 * Chorégraphie (i0 = le mot est dit ; 30 i/s) : i-1 pré-éclat · i0 COUPE FRANCHE, MISE AU POINT (échelle 1,45 → 1 et flou
 * 0,02 L → 0 en 5 i, CLAQUER) · onde de choc ivoire qui s'étend (i0-i9) · i4-i8 quatre traits d'impact lumineux ·
 * i4-i12 secousse de la dalle ET du mot (0,010 L) · i5-i14 soulignement tracé · en creux, le même mot défile de 0,3 % L / i ·
 * anticipation (le mot gonfle à 1,04) puis SORTIE en 5 i : la dalle se referme en cercle vers le coin haut-droit, le mot
 * est aspiré avec elle (échelle 0,2, rotation +24°).
 * Profondeur (V6) : mise au point, flou, extrusion + ombre portée du mot, dégradé de lumière, onde de choc.
 * Bruitage : `drop_004` à i0 (+ « boum » à sourcer, CC0), `whoosh-out` à la sortie.
 */
import {
  alpha,
  BruitageMotion,
  borne,
  chargerPoliceMontserrat,
  courbe,
  FPS,
  GrainPlein,
  imageDepuis,
  lerp,
  NUANCES,
  POLICES,
  PropsElementE,
  relief,
  ressort,
  secousse,
  trace,
} from "./commun-lotE";
import { largeurTexte } from "../../charte";

export const ID_DALLE_CLAQUEE_V3 = "dalle-claquee";
export const DUREE_DALLE_V3 = Object.freeze({ min: 0.9, max: 1.4 });

export const FICHE_DALLE_CLAQUEE_V3 = Object.freeze({
  id: ID_DALLE_CLAQUEE_V3,
  nom: "Dalle claquée (coup de poing)",
  emplacement: "E7 plein écran",
  forme: "aplat orange radial + grain, mot en relief",
  mouvement: "coupe franche, mise au point, secousse, sortie en masque circulaire vers le coin haut-droit",
  visage: "couvert" as const,
  video: false,
  ressorts: ["CLAQUER", "POSER"],
  quandUtiliser: "La phrase choc, un basculement (« stop », « fuite »). 1 à 2 mots dits. Jamais avant 10 s.",
});

export type DalleClaqueeV3Props = PropsElementE & {
  /** Instant (s) où Will dit le mot : la dalle claque à cet instant précis. */
  debut: number;
  /** Fin de la sortie (s). La durée est ramenée à 0,9 s au moins. */
  fin: number;
  /** Le mot dit par Will (1 à 2 mots, 12 lettres au plus). */
  mot: string;
};

const SORTIE = 3; // images de la sortie en masque circulaire
const BASE = 27; // durée minimale (images)

export function dureeDalleV3(d: { debut: number; fin: number }): number {
  return Math.max(BASE, Math.round((d.fin - d.debut) * FPS));
}

export function DalleClaqueeV3(p: DalleClaqueeV3Props) {
  chargerPoliceMontserrat();
  const { t, largeurImage: W, hauteurImage: H } = p;
  const f = imageDepuis(t, p.debut);
  const total = dureeDalleV3(p);
  if (f < -1 || f >= total) return null;

  // Pré-éclat : un point orange de 0,04 L au centre, à l'image i-1.
  if (f < 0) {
    return (
      <div style={{ position: "absolute", inset: 0 }}>
        <div style={{ position: "absolute", left: W / 2 - 0.02 * W, top: H * 0.45 - 0.02 * W, width: 0.04 * W, height: 0.04 * W, borderRadius: "50%", background: NUANCES.orange, boxShadow: `0 0 ${0.03 * W}px ${alpha(NUANCES.orangeChaud, 0.8)}` }} />
      </div>
    );
  }

  const debutSortie = total - SORTIE;
  const debutAnti = debutSortie - 3;
  const kS = f - debutSortie; // images de sortie (≥ 0)
  const u = kS >= 0 ? borne(kS / (SORTIE - 1)) : 0;
  const uAsp = u * u; // Easing.in quadratique

  // Masque circulaire : rayon de couverture totale → 0, centre qui file vers le coin haut-droit.
  const R0 = Math.hypot(W, H) * 0.62;
  const rayon = kS >= 0 ? R0 * (1 - u) ** 2.6 : R0;
  const cx = lerp(W / 2, 0.97 * W, uAsp);
  const cy = lerp(H * 0.45, 0.06 * H, uAsp);
  const clip = kS >= 0 ? `circle(${Math.max(0, rayon).toFixed(1)}px at ${cx.toFixed(1)}px ${cy.toFixed(1)}px)` : undefined;

  // Secousse de l'élément seul (dalle ET mot), i4 → i12.
  const dx = f >= 4 && f < 13 ? secousse(f - 4, 0.01 * W) : 0;
  const dy = f >= 4 && f < 13 ? secousse(f - 4 + 0.75, 0.006 * W) : 0;

  // Le mot : mise au point (échelle 1,45 → 1, flou 0,02 L → 0 en 5 i), CLAQUER.
  const mots = p.mot.trim().toUpperCase().split(/\s+/).slice(0, 2);
  const lignes = mots.length === 2 && mots.join("").length > 8 ? mots : [mots.join(" ")];
  const tailles = lignes.map((x) => Math.min(H * (lignes.length > 1 ? 0.15 : 0.21), (W * 0.9) / Math.max(1e-6, largeurTexte(x, 1))));
  const interligne = 0.98;
  const claque = ressort("CLAQUER", f);
  const gonfle = f >= debutAnti ? 1 + 0.04 * borne((f - debutAnti) / 3) : 1;
  const echelle = lerp(1.45, 1, claque) * gonfle;
  const flou = 0.02 * W * (1 - courbe(f, 0, 5));
  const motX = lerp(W / 2, cx, uAsp);
  const motY = lerp(H * 0.45, cy, uAsp);
  const echelleMot = echelle * (kS < 0 && f >= 13 ? 1 + 0.012 * Math.sin((f - 13) * 0.45) : 1) * (kS >= 0 ? lerp(1, 0.2, uAsp) : 1);
  const rotMot = -4 + (kS >= 0 ? 24 * uAsp : 0);

  // Micro-vibration de 0,004 L pendant la pose + respiration : jamais figé plus de 0,5 s.
  const vib = kS < 0 && f >= 13 ? Math.sin(f * 1.9) * 0.004 * W : 0;

  // Onde de choc ivoire (anneau doux) i0 → i9.
  const onde = borne(f / 9);
  const rOnde = lerp(0.05, 0.85, 1 - (1 - onde) ** 3) * W;
  const opOnde = f < 9 ? 0.4 * (1 - onde) : 0;

  // Traits d'impact lumineux (i4 → i8) aux quatre coins du mot.
  const largeurMot = Math.max(...lignes.map((x, i) => largeurTexte(x, tailles[i]))) * 0.92;
  const hBloc = tailles.reduce((s, x) => s + x * interligne, 0);
  const trait = f >= 4 && f < 8 ? borne((f - 4) / 2) * (1 - 0.6 * borne((f - 6) / 2)) : 0;
  const coins = [
    { sx: -1, sy: -1 },
    { sx: 1, sy: -1 },
    { sx: 1, sy: 1 },
    { sx: -1, sy: 1 },
  ];

  // Soulignement tracé i5 → i14.
  const tr = courbe(f, 5, 9, trace);
  const lSou = largeurMot * 0.5;
  const ySou = hBloc * 0.5 + 0.035 * H;

  // Mot en creux derrière (défile de 0,3 % L / i).
  const texte = lignes.join(" ");
  const tailleEcho = (W * 1.5) / Math.max(1e-6, largeurTexte(texte, 1));
  const derive = -f * 0.003 * W;
  const echo = Array.from({ length: 4 }, () => texte).join("   ·   ");

  return (
    <div style={{ position: "absolute", inset: 0, overflow: "hidden", pointerEvents: "none" }}>
      <div style={{ position: "absolute", inset: 0, clipPath: clip, transform: `translate(${dx * (1 - uAsp)}px, ${dy * (1 - uAsp)}px)` }}>
        {/* Aplat : dégradé radial orangeChaud → orangeProfond, reflet du haut, grain. */}
        <div style={{ position: "absolute", left: -0.03 * W, top: -0.03 * H, width: W * 1.06, height: H * 1.06, background: `radial-gradient(ellipse 72% 54% at 50% 40%, ${NUANCES.orangeChaud} 0%, ${NUANCES.orange} 46%, ${NUANCES.orangeProfond} 112%)` }} />
        <div style={{ position: "absolute", inset: 0, background: `radial-gradient(circle at 50% 28%, ${alpha(NUANCES.ivoire, 0.26)} 0%, rgba(0,0,0,0) 46%), radial-gradient(ellipse 90% 80% at 50% 45%, rgba(0,0,0,0) 45%, ${alpha(NUANCES.encre, 0.42)} 100%)` }} />
        {(f > 5 && f < 20) || (f > 40 && f < 52) ? <div style={{ position: "absolute", left: lerp(-0.5 * W, 1.3 * W, borne(((f > 40 ? f - 41 : f - 6)) / 12)), top: -0.2 * H, width: 0.3 * W, height: 1.4 * H, transform: "rotate(20deg)", background: `linear-gradient(90deg, rgba(0,0,0,0), ${alpha(NUANCES.ivoire, 0.24)}, rgba(0,0,0,0))` }} /> : null}
        <div style={{ position: "absolute", inset: 0, background: `linear-gradient(180deg, ${alpha(NUANCES.ivoire, 0.14)} 0%, rgba(0,0,0,0) 22%)` }} />
        <GrainPlein W={W} H={H} opacite={0.085} graine={5} />
        {/* Mot en creux qui défile derrière. */}
        <div style={{ position: "absolute", left: derive, top: H * 0.45, transform: "translateY(-50%)", fontFamily: POLICES.titre, fontSize: tailleEcho, lineHeight: 1, color: "transparent", WebkitTextStroke: `${Math.max(2, 0.004 * W)}px ${alpha(NUANCES.encre, 0.2)}`, whiteSpace: "nowrap", opacity: 1 - uAsp }}>
          {echo}
        </div>
        <div style={{ position: "absolute", left: -derive * 0.8 - W * 0.4, top: H * 0.79, transform: "translateY(-50%)", fontFamily: POLICES.titre, fontSize: tailleEcho * 0.42, lineHeight: 1, color: "transparent", WebkitTextStroke: `${Math.max(2, 0.003 * W)}px ${alpha(NUANCES.encre, 0.16)}`, whiteSpace: "nowrap", opacity: 1 - uAsp }}>
          {echo}
        </div>
        {/* Onde de choc ivoire. */}
        {opOnde > 0.01 ? <div style={{ position: "absolute", left: W / 2 - rOnde, top: H * 0.45 - rOnde, width: rOnde * 2, height: rOnde * 2, borderRadius: "50%", border: `${0.012 * W}px solid ${alpha(NUANCES.ivoire, opOnde)}`, boxSizing: "border-box", filter: `blur(${0.004 * W}px)` }} /> : null}
      {/* Le mot géant, ses traits d'impact lumineux et son soulignement. */}
      <div style={{ position: "absolute", left: motX + vib, top: motY, transform: `translate(-50%, -50%) rotate(${rotMot}deg) scale(${echelleMot})`, filter: flou > 0.05 ? `blur(${flou.toFixed(1)}px)` : undefined, opacity: kS >= 0 ? 1 - 0.3 * uAsp : 1 }}>
        <div style={{ position: "relative" }}>
          {lignes.map((ligne, i) => (
            <div key={ligne} style={{ fontFamily: POLICES.titre, fontSize: tailles[i], lineHeight: interligne, color: NUANCES.encre, textAlign: "center", whiteSpace: "nowrap", textShadow: relief(W, NUANCES.orangeProfond, 0.0062, 0.5) }}>
              {ligne}
            </div>
          ))}
          {trait > 0 &&
            coins.map((c, i) => {
              const L = 0.06 * W * trait;
              const ox = c.sx * (largeurMot / 2 + 0.02 * W);
              const oy = c.sy * (hBloc * 0.36 + 0.02 * W);
              const ang = (Math.atan2(c.sy, c.sx) * 180) / Math.PI;
              return <div key={i} style={{ position: "absolute", left: `calc(50% + ${ox}px)`, top: `calc(50% + ${oy}px)`, width: L, height: 0.009 * W, borderRadius: 0.01 * W, transformOrigin: "0 50%", transform: `rotate(${ang}deg)`, background: `linear-gradient(90deg, ${NUANCES.ivoire}, ${alpha(NUANCES.ivoire, 0)})`, boxShadow: `0 0 ${0.02 * W}px ${alpha(NUANCES.ivoire, 0.6)}` }} />;
            })}
          {tr > 0 ? (
            <svg width={lSou * 2 + 40} height={60} style={{ position: "absolute", left: `calc(50% - ${lSou + 20}px)`, top: `calc(50% + ${ySou - 30}px)`, overflow: "visible" }}>
              <path d={`M 20 34 C ${20 + lSou * 0.65} 20, ${20 + lSou * 1.2} 44, ${20 + lSou * 2} 28`} fill="none" stroke={NUANCES.encre} strokeWidth={0.014 * W} strokeLinecap="round" pathLength={1} strokeDasharray={1} strokeDashoffset={1 - tr} />
            </svg>
          ) : null}
        </div>
      </div>
      </div>
    </div>
  );
}

/** Bruitage (« boum » à sourcer en CC0, jamais dans une banque payante). */
export function bruitagesDalleClaqueeV3(p: Pick<DalleClaqueeV3Props, "debut" | "fin">): BruitageMotion[] {
  return [
    [p.debut, "drop_004", 0.14],
    [+(p.debut + (dureeDalleV3(p) - SORTIE) / FPS).toFixed(3), "whoosh-out", 0.16],
  ];
}

export const EXEMPLE_DALLE_CLAQUEE_V3 = { phrase: "Là, il faut dire stop.", debut: 0.4, fin: 1.4, mot: "stop" };
