import React from "react";
/**
 * ÉLÉMENT 20 « DUEL-VIDÉO » (standard v3, lot E « Coups de poing » ; `duel-triangles` v2 rhabillé, enrichi de VIDÉO).
 *
 * Emplacement E7 plein écran · DEUX TRIANGLES le long de la diagonale bas-gauche → haut-droit. Chacun est une FENÊTRE VIDÉO
 * TEINTÉE (vidéo en duotone : encre à 60 % pour A, orange pour B) · liseré ivoire LUMINEUX sur la diagonale, ombre douce
 * portée de A sur B · disque de verre ivoire avec un éclair · mots en relief léger. Visage : COUVERT (les deux triangles
 * couvrent tout le cadre), partiellement couvert 3 images au plus à l'entrée et à la sortie (en mouvement).
 * Quand : une opposition dite (« à la main / en auto », « eux / vous »). Jamais avant 10 s. Au moins 1 s de Will seul ensuite.
 *
 * Image par image (i0 = 1er mot dit) : i0-i3 triangle A glisse (3 i, Easing.out cubic, flou de mouvement) · i1-i4 triangle B
 * (1 i de retard : tient la tolérance de 3 i) · i2 mot A jaillit (mise au point) · i4 RENCONTRE : flash du liseré (1 i) +
 * secousse de l'élément (0,010 L, A et B en sens opposés), mot B jaillit · i5 disque de verre à l'éclair, vrille ·
 * verdict (s'il est dit) : le perdant passe en noir et blanc et recule de 0,05 L, le gagnant pulse · sortie 3 i : chaque
 * triangle retourne à son coin (Easing.in).
 * Profondeur (V6) : ombre douce portée sur la diagonale, flou de mouvement, mise au point des mots, ombres en 3 couches.
 * Vidéo : 2 B-roll, un par côté de l'opposition (littéraux : écriture à la main / clavier et code). Aucun zoom.
 * Bruitage : `whoosh-in` à i0, `drop_004` à la rencontre.
 */
import {
  alpha,
  BruitageMotion,
  borne,
  chargerPoliceMontserrat,
  courbe,
  FPS,
  freinCubique,
  GrainPlein,
  imageDepuis,
  lerp,
  NUANCES,
  ombre3,
  POLICES,
  PropsElementE,
  relief,
  ressort,
  secousse,
  VideoCover,
  vignette,
} from "./commun-lotE";
import { Icone } from "../../elements";
import { largeurTexte } from "../../charte";

export const ID_DUEL_VIDEO = "duel-video";
export const DUREE_DUEL_VIDEO = Object.freeze({ min: 1.5, max: 2.5 });

export const FICHE_DUEL_VIDEO = Object.freeze({
  id: ID_DUEL_VIDEO,
  nom: "Duel vidéo (coup de poing)",
  emplacement: "E7 plein écran",
  forme: "2 triangles (fenêtres vidéo en duotone), disque de verre",
  mouvement: "glissement diagonal en 3 i + rencontre secouée",
  visage: "couvert" as const,
  video: true,
  ressorts: ["GLISSER (remplacé par Easing.out cubic sur 3 i)", "CLAQUER", "JAILLIR"],
  quandUtiliser: "Une opposition dite : « à la main / en auto », « eux / vous ». Jamais avant 10 s.",
});

export type DuelVideoProps = PropsElementE & {
  debut: number;
  fin: number;
  /** Les deux termes DITS : A (triangle sombre, en haut à gauche) et B (triangle orange, en bas à droite). */
  motA: string;
  motB: string;
  /** B-roll (nom de fichier dans `broll/`) de chaque côté de l'opposition. */
  videoA: string;
  videoB: string;
  /** Si Will tranche : le gagnant pulse, le perdant passe en noir et blanc et recule. */
  verdict?: { gagnant: "A" | "B"; a: number };
};

const G = Object.freeze({ glisse: 3, decalageB: 1, rencontre: 4, secousse: 0.01, sortie: 3, marge: 40, recouvrement: 0.04, disque: 0.13 });

export function DuelVideo(p: DuelVideoProps) {
  chargerPoliceMontserrat();
  const { t, debut, fin, largeurImage: W, hauteurImage: H } = p;
  const i = imageDepuis(t, debut);
  if (i < 0 || t >= fin) return null;
  const hyp = Math.hypot(W, H);

  // Sortie : 3 images, retour aux coins (Easing.in quadratique, la dernière image est hors cadre).
  const kS = (t - (fin - G.sortie / FPS)) * FPS;
  const sortie = kS >= 0 ? borne(((kS + 1) / G.sortie) ** 2) : 0;

  // Glissement d'entrée de chaque triangle (3 i, freinage net) + flou de mouvement.
  const gA = courbe(i, 0, G.glisse, freinCubique);
  const gB = courbe(i - G.decalageB, 0, G.glisse, freinCubique);
  const decA = 1 - gA + sortie;
  const decB = 1 - gB + sortie;

  // Verdict.
  const iV = p.verdict ? imageDepuis(t, p.verdict.a) : -1;
  const recul = p.verdict && iV >= 0 ? ressort("POSER", iV) : 0;
  const perdant = p.verdict ? (p.verdict.gagnant === "A" ? "B" : "A") : null;
  const nbV = p.verdict && iV >= 0 ? borne(iV / 6) : 0; // passage au noir et blanc du perdant
  const pulse = p.verdict && iV >= 0 ? 1 + 0.06 * Math.sin(Math.PI * borne(iV / 9)) : 1;

  // Secousse de l'élément (A et B en sens opposés), à partir de la rencontre.
  const sh = secousse(i - G.rencontre, G.secousse * W);

  const dxA = -decA * W * 1.04 + sh + (perdant === "A" ? -0.05 * W * recul * 0.7 : 0);
  const dyA = -decA * H * 1.04 + (perdant === "A" ? -0.05 * W * recul * 0.7 : 0);
  const dxB = decB * W * 1.04 - sh + (perdant === "B" ? 0.05 * W * recul * 0.7 : 0);
  const dyB = decB * H * 1.04 + (perdant === "B" ? 0.05 * W * recul * 0.7 : 0);
  const flouA = 0.016 * W * Math.min(1, decA) * (decA > 0.01 ? 1 : 0);
  const flouB = 0.016 * W * Math.min(1, decB) * (decB > 0.01 ? 1 : 0);

  // Polygones (px) : chaque triangle déborde de `recouvrement` au-delà de la diagonale, aucune fente pendant la secousse.
  const m = G.marge;
  const dl = G.recouvrement;
  const polyA = `polygon(${-m}px ${-m}px, ${W * (1 + dl) + (m * W) / H}px ${-m}px, ${-m}px ${H * (1 + dl) + (m * H) / W}px)`;
  const polyB = `polygon(${W + m}px ${H + m}px, ${W + m}px ${-H * dl - (m * H) / W}px, ${-W * dl - (m * W) / H}px ${H + m}px)`;

  // Géométrie de la diagonale.
  const angle = (Math.atan2(-H, W) * 180) / Math.PI; // ≈ -60,6°
  const nx = H / hyp;
  const ny = W / hyp;

  const tailleMot = (mot: string) => Math.min(0.17 * W, (0.5 * W) / Math.max(1, largeurTexte(mot, 1, 0.0)));
  const mot = (texte: string, cx: number, cy: number, rot: number, k: number, couleurRelief: string, pulser: number) => {
    const s = ressort("JAILLIR", k);
    if (s <= 0) return null;
    const fs = tailleMot(texte);
    const flou = 0.009 * W * (1 - courbe(k, 0, 4));
    return (
      <div
        style={{
          position: "absolute",
          left: cx,
          top: cy,
          transform: `translate(-50%, calc(-50% + ${(Math.sin(i * 0.22 + cx) * 0.004 * H).toFixed(2)}px)) rotate(${rot}deg) scale(${lerp(0.4, 1, s) * pulser})`,
          fontFamily: POLICES.titre,
          fontSize: fs,
          lineHeight: 1,
          color: NUANCES.ivoire,
          letterSpacing: "0.01em",
          whiteSpace: "nowrap",
          textShadow: relief(W, couleurRelief, 0.0042, 0.5),
          filter: flou > 0.05 ? `blur(${flou}px)` : undefined,
          opacity: borne(k / 1.2 + 0.2),
        }}
      >
        {texte.toUpperCase()}
      </div>
    );
  };

  const tri = (poly: string, dx: number, dy: number, flou: number, enfants: React.ReactNode, cle: string) => (
    <div key={cle} style={{ position: "absolute", left: 0, top: 0, width: W, height: H, clipPath: poly, transform: `translate(${dx}px, ${dy}px)`, filter: flou > 0.3 ? `blur(${flou.toFixed(1)}px)` : undefined, willChange: "transform" }}>
      {enfants}
    </div>
  );

  // Teinte duotone (vidéo en noir et blanc + calque de couleur).
  const grisA = perdant === "A" ? nbV : 0;
  const grisB = perdant === "B" ? nbV : 0;
  const triA = tri(
    polyA,
    dxA,
    dyA,
    flouA,
    <>
      <VideoCover nom={p.videoA} debutImage={Math.round(debut * FPS)} depuisSec={0.3} sansVideo={p.sansVideo} filtre={`grayscale(${0.35 + 0.65 * grisA}) contrast(1.1) brightness(${1.05 - 0.2 * grisA})`} />
      <div style={{ position: "absolute", inset: 0, background: alpha(NUANCES.encre, 0.3 + 0.12 * grisA) }} />
      <div style={{ position: "absolute", inset: 0, background: `linear-gradient(180deg, ${alpha(NUANCES.ivoire, 0.14)} 0%, rgba(0,0,0,0) 30%)` }} />
      <div style={{ position: "absolute", inset: 0, background: vignette }} />
      {mot(p.motA, 0.34 * W, 0.25 * H, -8, i - 2, NUANCES.orangeProfond, p.verdict?.gagnant === "A" ? pulse : 1)}
    </>,
    "A",
  );
  const triB = tri(
    polyB,
    dxB,
    dyB,
    flouB,
    <>
      <VideoCover nom={p.videoB} debutImage={Math.round(debut * FPS)} depuisSec={0.4} sansVideo={p.sansVideo} filtre={`grayscale(${0.1 + 0.9 * grisB}) contrast(1.1) brightness(${1.05 - 0.2 * grisB})`} />
      <div style={{ position: "absolute", inset: 0, background: NUANCES.orange, mixBlendMode: "color", opacity: 0.35 * (1 - grisB) }} />
      <div style={{ position: "absolute", inset: 0, background: alpha(NUANCES.orangeProfond, 0.18 * (1 - grisB)), mixBlendMode: "multiply" }} />
      <div style={{ position: "absolute", inset: 0, background: `radial-gradient(ellipse 70% 60% at 62% 62%, ${alpha(NUANCES.orangeChaud, 0.3)} 0%, rgba(0,0,0,0) 70%)` }} />
      <div style={{ position: "absolute", inset: 0, background: vignette }} />
      {/* Ombre douce portée par A sur B, le long de la diagonale (une seule lumière, du haut). */}
      <div
        style={{
          position: "absolute",
          left: W / 2 + nx * 0.05 * W - hyp * 0.6,
          top: H / 2 + ny * 0.05 * W - 0.05 * W,
          width: hyp * 1.2,
          height: 0.1 * W,
          transform: `rotate(${angle}deg)`,
          background: `linear-gradient(180deg, ${alpha(NUANCES.encre, 0.55)} 0%, rgba(17,10,5,0) 100%)`,
        }}
      />
      {mot(p.motB, 0.66 * W, 0.76 * H, 6, i - G.rencontre, NUANCES.encre, p.verdict?.gagnant === "B" ? pulse : 1)}
    </>,
    "B",
  );

  // Liseré lumineux de la diagonale : flash d'1 image à la rencontre, puis trait fin qui reste.
  const flash = i >= G.rencontre && i < G.rencontre + 1;
  const apres = i >= G.rencontre;
  const epLisere = flash ? 0.02 * W : 0.0048 * W;
  const lisere = apres ? (
    <div
      style={{
        position: "absolute",
        left: W / 2 - hyp * 0.6,
        top: H / 2 - epLisere / 2,
        width: hyp * 1.2,
        height: epLisere,
        transform: `translate(${sh}px, 0) rotate(${angle}deg)`,
        transformOrigin: "50% 50%",
        background: `linear-gradient(90deg, ${alpha(NUANCES.ivoire, 0)} 0%, ${NUANCES.ivoire} 18%, ${NUANCES.ivoire} 82%, ${alpha(NUANCES.ivoire, 0)} 100%)`,
        boxShadow: `0 0 ${(flash ? 0.07 : 0.022) * W}px ${alpha(NUANCES.ivoire, flash ? 0.95 : 0.55)}`,
        opacity: (flash ? 1 : 0.9) * (1 - sortie),
        borderRadius: epLisere,
      }}
    />
  ) : null;

  // Disque de verre ivoire à l'éclair, au milieu de la diagonale (vrille à l'arrivée).
  const iD = i - 5;
  const sD = ressort("JAILLIR", iD) * (1 - sortie);
  const dDisque = G.disque * W;
  const tourne = -90 * (1 - ressort("CLAQUER", iD * 0.6)) + 70 * sortie;
  const disque =
    sD > 0.001 ? (
      <div
        style={{
          position: "absolute",
          left: W / 2 - dDisque / 2,
          top: H / 2 - dDisque / 2,
          width: dDisque,
          height: dDisque,
          borderRadius: "50%",
          background: `radial-gradient(circle at 38% 28%, ${NUANCES.ivoire} 0%, ${NUANCES.ivoireCreux} 70%, ${NUANCES.sableClair} 100%)`,
          boxShadow: `inset 0 ${0.003 * W}px 0 ${alpha("#FFFFFF", 0.45)}, inset 0 0 0 ${0.003 * W}px ${alpha(NUANCES.ivoire, 0.8)}, ${ombre3(W, 1.5)}`,
          transform: `translate(${sh * 0.5}px, ${(Math.sin(i * 0.22) * 0.004 * H).toFixed(2)}px) rotate(${tourne}deg) scale(${sD})`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Icone nom="eclair" taille={dDisque * 0.56} couleur={NUANCES.orange} epaisseur={2.4} />
      </div>
    ) : null;

  return (
    <div style={{ position: "absolute", inset: 0, pointerEvents: "none", overflow: "hidden" }}>
      {triB}
      {triA}
      {lisere}
      {i > 10 && i < 24 ? <div style={{ position: "absolute", left: lerp(-0.4 * W, 1.3 * W, borne((i - 10) / 14)), top: -0.2 * H, width: 0.22 * W, height: 1.4 * H, transform: "rotate(20deg)", background: `linear-gradient(90deg, rgba(0,0,0,0), ${alpha(NUANCES.ivoire, 0.2)}, rgba(0,0,0,0))`, opacity: 1 - sortie }} /> : null}
      {disque}
      <GrainPlein W={W} H={H} opacite={0.05} />
    </div>
  );
}

/** Bruitage : `whoosh-in` au départ des triangles, `drop_004` à leur rencontre. */
export function bruitagesDuelVideo(p: Pick<DuelVideoProps, "debut">): BruitageMotion[] {
  return [
    [p.debut, "whoosh-in", 0.1],
    [+(p.debut + G.rencontre / FPS).toFixed(3), "drop_004", 0.12],
  ];
}

/** Exemple : « manuel » contre « auto », Will tranche pour l'auto. Mots dits, 2 B-roll littéraux. */
export const EXEMPLE_DUEL_VIDEO = {
  phrase: "Le bureau ou le chantier ? Le chantier.",
  debut: 0.3,
  fin: 2.7,
  motA: "Bureau",
  motB: "Chantier",
  videoA: "lotE-bureau.mp4",
  videoB: "lotE-chantier.mp4",
  verdict: { gagnant: "B" as const, a: 1.0 },
};
