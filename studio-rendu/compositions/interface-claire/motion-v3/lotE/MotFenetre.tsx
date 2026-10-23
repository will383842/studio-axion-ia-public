import React, { useId } from "react";
/**
 * ÉLÉMENT 23 « MOT-FENÊTRE » (standard v3, lot E ; masque K10).
 *
 * Emplacement E7 plein écran · aplat ivoire en dégradé (lumière du haut) · UN MOT DIT (8 lettres au plus, ≥ 0,9 L de large)
 * dont les LETTRES sont des FENÊTRES sur un B-roll littéral (la vidéo joue dedans), ombre douce sous les lettres, liseré ivoire
 * fin sur le bord des lettres, grand mot fantôme qui dérive derrière (parallaxe). Lettres étirées en hauteur (×2,4) : les
 * fenêtres sont assez grandes pour qu'on voie la vidéo. Visage : COUVERT (aplat plein cadre dès i0 ; coupe franche).
 *
 * Chorégraphie (i0 = le mot est dit ; 30 i/s) : i0-i14 les lettres MONTENT en cascade (1 i par lettre, JAILLIR, mise au
 * point), la vidéo joue dedans · i12-i20 les lettres s'ÉLARGISSENT jusqu'à FUSIONNER en plein cadre (masque qui grandit depuis la
 * ligne du mot, 8 i, ce n'est PAS un zoom : la vidéo reste fixe sous le masque) · i34-i46 la vidéo plein cadre se RÉTRACTE en
 * fenêtre K1 (coins 0 → 0,045 L, POSER, légère inclinaison de -2,5°) qui couvre toujours le visage, un reflet la traverse,
 * une puce en verre chevauche son coin (plan P2) · i54-i59 FOUET : la fenêtre part vers la gauche en pivot (rotateY 25°),
 * flou directionnel ; le visage est découvert en 3 images au plus.
 * Profondeur (V6) : ombre portée des lettres puis ombre en 3 couches de la fenêtre, perspective (rotateY) à la sortie,
 * flou directionnel, puce en P2 qui chevauche, mot fantôme en parallaxe.
 * Vidéo : 1 B-roll littéral du mot dit (signature de documents). Aucun zoom : la source n'est jamais agrandie.
 * Bruitage : `whoosh-in` à i0, `maximize_004` à i20, `whoosh-out` à la sortie.
 */
import {
  alpha,
  BruitageMotion,
  borne,
  chargerPoliceMontserrat,
  courbe,
  DefFlouDirectionnel,
  FPS,
  GrainPlein,
  balayage,
  imageDepuis,
  lerp,
  NUANCES,
  ombre3Filtre,
  POLICES,
  Puce,
  PropsElementE,
  ressort,
  VideoCover,
  vignette,
} from "./commun-lotE";
import { largeurTexte } from "../../charte";

export const ID_MOT_FENETRE = "mot-fenetre";
export const DUREE_MOT_FENETRE = Object.freeze({ min: 1.5, max: 2.2 });

export const FICHE_MOT_FENETRE = Object.freeze({
  id: ID_MOT_FENETRE,
  nom: "Mot-fenêtre (coup de poing)",
  emplacement: "E7 plein écran",
  forme: "K10 : les lettres du mot dit servent de masque à la vidéo",
  mouvement: "lettres en cascade, fusion plein cadre, rétractation en K1, fouet en pivot",
  visage: "couvert" as const,
  video: true,
  ressorts: ["JAILLIR", "POSER", "FOUET"],
  quandUtiliser: "Un mot dit, fort et concret, qui se montre (« devis », « chantier »). 8 lettres au plus. Jamais avant 10 s.",
});

export type MotFenetreProps = PropsElementE & {
  debut: number;
  fin: number;
  /** Le mot DIT (8 lettres au plus). */
  mot: string;
  /** B-roll littéral du mot (nom de fichier dans `broll/`). */
  video: string;
};

const T = Object.freeze({ cascade: 1, expansion: 12, fusion: 8, retract: 26, sortie: 46, dureeSortie: 6, hauteurLettres: 0.23, yMot: 0.4 });

/** Fenêtre K1 posée (fractions de l'image) : couvre toute la zone du visage (x 0,25-0,75, y 0,12-0,58). */
const K1 = Object.freeze({ x0: 0.05, y0: 0.1, x1: 0.86, y1: 0.69, rayon: 0.045 });

export function dureeMotFenetre(): number {
  return (T.sortie + T.dureeSortie) / FPS;
}

export function MotFenetre(p: MotFenetreProps) {
  chargerPoliceMontserrat();
  const id = useId().replace(/[^a-zA-Z0-9]/g, "");
  const { t, largeurImage: W, hauteurImage: H } = p;
  const k = imageDepuis(t, p.debut);
  if (k < 0 || t >= p.fin) return null;

  const mot = p.mot.trim().toUpperCase();
  const lettres = [...mot];
  const fs = Math.min((0.94 * W) / Math.max(1e-6, largeurTexte(mot, 1, 0)), 0.3 * W);
  const sy = (T.hauteurLettres * H) / (fs * 0.72); // lettres de 0,23 H, étirées en hauteur
  const yc = T.yMot * H; // centre vertical du mot (px)
  const hMot = fs * 0.72 * sy; // hauteur des capitales étirées

  // Cascade des lettres : montée avec ressort, mise au point.
  const decal = lettres.map((_, j) => (1 - ressort("JAILLIR", k - j * T.cascade)) * 0.14 * H);
  const dys = decal.map((d, j) => (d - (j === 0 ? 0 : decal[j - 1])) / sy);
  const baseY = (yc + hMot / 2) / sy; // ligne de base dans le repère étiré
  const flouLettres = 0.01 * W * (1 - courbe(k, 0, 5));

  // Masque qui grandit depuis la ligne du mot (fusion), puis rétractation en K1.
  const pE = courbe(k, T.expansion, T.fusion, balayage);
  const full = { l: -20, t: -20, r: W + 20, b: H + 20 };
  const mG = k < T.retract ? { l: lerp(0.03 * W, full.l, pE), t: lerp(yc, full.t, pE), r: lerp(0.97 * W, full.r, pE), b: lerp(yc, full.b, pE), rx: lerp(0.02 * W, 0, pE) } : null;
  const pR = ressort("POSER", k - T.retract);
  const kW = { l: K1.x0 * W, t: K1.y0 * H, r: K1.x1 * W, b: K1.y1 * H };
  const mR = { l: lerp(full.l, kW.l, pR), t: lerp(full.t, kW.t, pR), r: lerp(full.r, kW.r, pR), b: lerp(full.b, kW.b, pR), rx: lerp(0, K1.rayon * W, pR) };
  const rect = mG && k < T.retract ? mG : mR;
  const avecLettres = k < T.retract;
  const modeRect = k >= T.expansion || k >= T.retract;
  const rectVisible = pE > 0.001 || k >= T.retract;

  // Aplat ivoire : visible tant que la fusion n'est pas terminée.
  const aplat = k < T.expansion + T.fusion + 1;

  // Inclinaison de K1 et sortie en FOUET (pivot).
  const incl = -2.5 * pR;
  const kX = k - T.sortie;
  const rF = ressort("FOUET", kX);
  const rF1 = ressort("FOUET", kX - 1);
  const vit = Math.abs(rF - rF1);
  const dxSortie = -rF * 1.3 * W;
  const rotY = 25 * rF;
  const stdX = Math.min(0.06 * W, vit * 1.3 * W * 0.28);

  // Reflet qui traverse la fenêtre (une fois), 10 images après la pose.
  const pRef = courbe(k, T.retract + 9, 10, balayage);

  // Mot fantôme (parallaxe) : dérive lente, derrière l'aplat clair.
  const fsGhost = fs * 1.55;
  const derive = -k * 0.004 * W;

  // Lettres épaissies (4 copies décalées de 0,007 L, réunies dans le masque) : les fenêtres sont assez larges pour voir la vidéo.
  const eb = 0.007 * W;
  const gras: [number, number][] = [[-eb, 0], [eb, 0], [0, -eb * 0.5], [0, eb * 0.5], [0, 0]];
  const clipId = `cp${id}`;
  const flouId = `fl${id}`;
  const texte = (extra: React.SVGProps<SVGTextElement>) => (
    <text x={0} y={0} textAnchor="middle" fontFamily={POLICES.titre} fontWeight={800} fontSize={fs} transform={`translate(${W / 2} 0) scale(1 ${sy})`} {...extra}>
      {lettres.map((c, j) => (
        <tspan key={j} dy={j === 0 ? baseY + dys[0] : dys[j]} {...(j === 0 ? { x: 0 } : {})}>
          {c}
        </tspan>
      ))}
    </text>
  );

  const stage = (
    <div style={{ position: "absolute", inset: 0, transform: `perspective(${1.3 * W}px) translate(${dxSortie.toFixed(1)}px, ${(k > T.retract + 8 && kX < 0 ? Math.sin((k - T.retract - 8) * 0.3) * 0.004 * H : 0).toFixed(2)}px) rotateY(${rotY.toFixed(2)}deg) rotateZ(${incl}deg)`, transformOrigin: "46% 40%", filter: `${pR > 0.01 ? ombre3Filtre(W, 1.2) : ""} ${stdX > 0.4 ? `url(#${flouId})` : ""}`.trim() || undefined }}>
      <div style={{ position: "absolute", inset: 0, clipPath: `url(#${clipId})` }}>
        <VideoCover nom={p.video} debutImage={Math.round(p.debut * FPS)} depuisSec={0.4} sansVideo={p.sansVideo} filtre={`saturate(1.15) contrast(1.3) brightness(${lerp(0.88, 1, pE).toFixed(3)})`} />
        <div style={{ position: "absolute", inset: 0, background: vignette }} />
        <div style={{ position: "absolute", inset: 0, background: `linear-gradient(180deg, ${alpha(NUANCES.ivoire, 0.1)} 0%, rgba(0,0,0,0) 35%)` }} />
        {pRef > 0 && pRef < 1 ? <div style={{ position: "absolute", left: lerp(kW.l - 0.3 * W, kW.r + 0.1 * W, pRef), top: kW.t - 0.2 * H, width: 0.25 * W, height: (kW.b - kW.t) * 1.6, transform: "rotate(20deg)", background: `linear-gradient(90deg, rgba(0,0,0,0), ${alpha(NUANCES.ivoire, 0.2)}, rgba(0,0,0,0))` }} /> : null}
      </div>
      {/* Liseré ivoire intérieur (fenêtre) ou bord fin des lettres. */}
      <svg width={W} height={H} style={{ position: "absolute", left: 0, top: 0, overflow: "visible" }}>
        {k >= T.retract ? <rect x={rect.l + 2} y={rect.t + 2} width={rect.r - rect.l - 4} height={rect.b - rect.t - 4} rx={Math.max(0, rect.rx - 2)} fill="none" stroke={alpha(NUANCES.ivoire, 0.55 * pR)} strokeWidth={Math.max(2, 0.003 * W)} /> : null}
      </svg>
      {/* Puce de verre (plan P2) qui chevauche le coin bas-gauche de la fenêtre, 10 images après la pose. */}
      {k >= T.retract + 10 ? (
        <div style={{ position: "absolute", left: kW.l - 0.02 * W, top: kW.b - 0.075 * W + (1 - ressort("JAILLIR", k - T.retract - 10)) * 0.04 * H, opacity: borne((k - T.retract - 10) / 2) }}>
          <Puce texte={mot} W={W} taille={0.05 * W} inclinaison={-3} echelle={lerp(0.5, 1, ressort("JAILLIR", k - T.retract - 10))} />
        </div>
      ) : null}
    </div>
  );

  return (
    <div style={{ position: "absolute", inset: 0, pointerEvents: "none", overflow: "hidden" }}>
      <DefFlouDirectionnel id={flouId} stdX={stdX} />
      {/* Masque : lettres (avant la rétractation) + rectangle qui grandit / se rétracte. */}
      <svg width={0} height={0} style={{ position: "absolute" }}>
        <defs>
          <clipPath id={clipId} clipPathUnits="userSpaceOnUse">
            {avecLettres ? gras.map(([ox, oy], q) => <React.Fragment key={q}>{texte({ transform: `translate(${W / 2 + ox} ${oy}) scale(1 ${sy})` })}</React.Fragment>) : null}
            {rectVisible && modeRect ? <rect x={rect.l} y={rect.t} width={Math.max(0, rect.r - rect.l)} height={Math.max(0, rect.b - rect.t)} rx={rect.rx} ry={rect.rx} /> : null}
          </clipPath>
          <filter id={`om${id}`} x="-10%" y="-20%" width="120%" height="150%">
            <feGaussianBlur stdDeviation={0.012 * W} />
          </filter>
        </defs>
      </svg>
      {aplat ? (
        <div style={{ position: "absolute", inset: 0, opacity: 1 - 0 }}>
          <div style={{ position: "absolute", inset: 0, background: `radial-gradient(ellipse 95% 70% at 50% 36%, ${NUANCES.ivoire} 0%, ${NUANCES.ivoire} 45%, ${NUANCES.ivoireCreux} 100%)` }} />
          <div style={{ position: "absolute", inset: 0, background: `linear-gradient(180deg, ${alpha("#FFFFFF", 0.2)} 0%, rgba(0,0,0,0) 26%)` }} />
          {/* Mot fantôme en creux, qui dérive (parallaxe). */}
          <div style={{ position: "absolute", left: derive, top: H * 0.17, transform: "translateY(-50%)", fontFamily: POLICES.titre, fontSize: fsGhost, color: "transparent", WebkitTextStroke: `${Math.max(2, 0.004 * W)}px ${alpha(NUANCES.sable, 0.5)}`, whiteSpace: "nowrap", lineHeight: 1 }}>{`${mot}   ${mot}   ${mot}`}</div>
          <div style={{ position: "absolute", left: -derive * 0.9 - 0.5 * W, top: H * 0.8, transform: "translateY(-50%)", fontFamily: POLICES.titre, fontSize: fsGhost, color: "transparent", WebkitTextStroke: `${Math.max(2, 0.004 * W)}px ${alpha(NUANCES.sable, 0.4)}`, whiteSpace: "nowrap", lineHeight: 1 }}>{`${mot}   ${mot}   ${mot}`}</div>
          <GrainPlein W={W} H={H} opacite={0.06} graine={4} />
          {/* Ombre douce sous les lettres (lumière du haut : elle tombe vers le bas). */}
          {avecLettres && pE < 0.5 ? (
            <svg width={W} height={H} style={{ position: "absolute", left: 0, top: 0, opacity: 1 - pE * 2 }}>
              <g transform={`translate(0 ${0.02 * W})`} filter={`url(#om${id})`}>
                {gras.map(([ox, oy], q) => <React.Fragment key={q}>{texte({ fill: alpha(NUANCES.encre, 0.2), transform: `translate(${W / 2 + ox} ${oy}) scale(1 ${sy})` })}</React.Fragment>)}
              </g>
            </svg>
          ) : null}
        </div>
      ) : null}
      <div style={{ position: "absolute", inset: 0, filter: flouLettres > 0.1 && k < 8 ? `blur(${flouLettres.toFixed(1)}px)` : undefined }}>{stage}</div>
    </div>
  );
}

/** Bruitage : `whoosh-in` à i0, `maximize_004` à la fusion, `whoosh-out` au fouet. */
export function bruitagesMotFenetre(p: Pick<MotFenetreProps, "debut">): BruitageMotion[] {
  return [
    [p.debut, "whoosh-in", 0.1],
    [+(p.debut + T.expansion / FPS).toFixed(3), "maximize_004", 0.12],
    [+(p.debut + T.sortie / FPS).toFixed(3), "whoosh-out", 0.16],
  ];
}

export const EXEMPLE_MOT_FENETRE = { phrase: "Vos devis partent tout seuls.", debut: 0.3, fin: 0.3 + dureeMotFenetre(), mot: "devis", video: "lotE-devis.mp4" };
