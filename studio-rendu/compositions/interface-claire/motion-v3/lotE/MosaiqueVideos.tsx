import React from "react";
/**
 * ÉLÉMENT 24 « MOSAÏQUE DE VIDÉOS » (standard v3, lot E ; `mosaique-videos`, bibliothèque d'images qui défile).
 *
 * Emplacement E7 plein écran · un PLAN INCLINÉ EN PERSPECTIVE (rotateX 16°, rotateZ -8°) porte une grille de tuiles (3 colonnes,
 * coins de 0,03 L, liseré ivoire, reflet) sur un fond encre en dégradé radial · 6 B-roll de la MÊME scène dite
 * (énumération, « des dizaines de… »), répétés dans la grille · aucune ligne factice, aucun chiffre. Visage : COUVERT (le fond
 * est plein cadre dès i0, coupe franche).
 *
 * Chorégraphie (i0 = le mot est dit ; 30 i/s) : la grille DÉFILE vers le haut à vitesse constante (0,6 % H / i) · les tuiles
 * arrivent en cascade (2 i, JAILLIR) · sur le MOT FORT (i34) UNE TUILE SORT DU PLAN : vraie 3D (translateZ 520 px, le plan
 * est en `preserve-3d`), elle se redresse face caméra (rotateX -16°, rotateZ +8°, VERRE) et grossit par la perspective
 * (≈ ×1,5) pendant que les autres s'estompent ; sa puce de verre chevauche son coin (plan P2, plus proche) · sortie T1 :
 * le plan BASCULE vers le haut (rotateX 16° → 60°) et part en FOUET (flou directionnel), le fond avec lui.
 * Profondeur (V6) : perspective réelle + parallaxe de plans (tuile en avant, puce encore plus en avant), ombres en 3
 * couches qui grandissent avec la proximité, estompe des tuiles de fond, flou de mouvement à la sortie.
 * Vidéo : 6 sources littérales (bureau, papiers/signature, équipe, écriture, clavier, téléphone). 12 flux environ sont
 * décodés en parallèle (6 sources répétées) : dérogation du standard (V14), à mesurer au rendu de production.
 * Bruitage : `whoosh-in` à i0, `select_002` sur le mot fort, `whoosh-out` à la sortie.
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
  imageDepuis,
  lerp,
  NUANCES,
  ombre3,
  Puce,
  PropsElementE,
  ressort,
  VideoCover,
} from "./commun-lotE";

export const ID_MOSAIQUE_VIDEOS = "mosaique-videos";
export const DUREE_MOSAIQUE = Object.freeze({ min: 1.8, max: 2.6 });

export const FICHE_MOSAIQUE_VIDEOS = Object.freeze({
  id: ID_MOSAIQUE_VIDEOS,
  nom: "Mosaïque de vidéos (coup de poing)",
  emplacement: "E7 plein écran",
  forme: "plan incliné en perspective, grille de tuiles K1, fond encre radial",
  mouvement: "défilement continu, cascade, une tuile sort du plan (3D), bascule et fouet",
  visage: "couvert" as const,
  video: true,
  ressorts: ["VERRE", "PIVOT", "FOUET"],
  quandUtiliser: "Une énumération dite, « des dizaines de… » (sans chiffre inventé). Jamais avant 10 s.",
});

export type MosaiqueVideosProps = PropsElementE & {
  debut: number;
  fin: number;
  /** 6 B-roll (noms de fichiers dans `broll/`), littéraux par rapport à la scène dite. Le n° 1 est celui qui sort du plan. */
  videos: readonly string[];
  /** Le mot fort DIT, porté par la puce de la tuile qui sort du plan. */
  motFort: string;
};

const T = Object.freeze({ cascade: 1, hero: 34, sortie: 68, dureeSortie: 6, vitesse: 0.006, inclinaison: 14, rotZ: -8, profondeur: 380 });

export function dureeMosaique(): number {
  return (T.sortie + T.dureeSortie) / FPS;
}

export function MosaiqueVideos(p: MosaiqueVideosProps) {
  chargerPoliceMontserrat();
  const { t, largeurImage: W, hauteurImage: H } = p;
  const k = imageDepuis(t, p.debut);
  if (k < 0 || t >= p.fin) return null;

  // Géométrie de la grille (repère du plan, px).
  const tw = 0.66 * W;
  const th = tw * 1.25;
  const gap = 0.03 * W;
  const px = tw + gap;
  const py = th + gap;
  const x0 = (W - (2 * tw + gap)) / 2;
  const scroll = k * T.vitesse * H;
  // La tuile héroïne (r = 0, c = 1) est au centre de l'écran à l'image `hero`.
  const y0 = H / 2 + T.hero * T.vitesse * H - th / 2;

  // Sortie T1 : le plan bascule vers le haut et part (FOUET), le fond avec lui.
  const kX = k - T.sortie;
  const pX = ressort("FOUET", kX);
  const vit = Math.abs(pX - ressort("FOUET", kX - 1));
  const stdY = Math.min(0.05 * H, vit * 1.4 * H * 0.3);
  const flouId = "flouMosaique";

  // Tuile qui sort du plan (VERRE : vive, posée, avec un petit dépassement).
  const kH = k - T.hero;
  const sH = ressort("VERRE", kH);
  const sPivot = ressort("PIVOT", kH);
  const estompe = borne(kH / 8);

  const tuiles: React.ReactNode[] = [];
  for (let r = -4; r <= 3; r++) {
    for (let c = 0; c < 2; c++) {
      const y = y0 + r * py - scroll;
      // Au plus 3 rangées × 2 colonnes = 6 flux vidéo simultanés (V14).
      if (y + th < -0.05 * H || y > 1.0 * H) continue;
      const hero = r === 0 && c === 0;
      const idx = (((r + 12) * 2 + c) % 6 + 6) % 6;
      // Tuiles présentes dès i0 (petit pop de 3 images, jamais d'écran vide).
      const s = 0.9 + 0.1 * borne(k / 3);
      const video = p.videos[idx % p.videos.length];
      const echelle = lerp(0.55, 1, s);
      const gloss = `linear-gradient(160deg, ${alpha(NUANCES.ivoire, 0.2)} 0%, rgba(0,0,0,0) 38%)`;
      const faceVideo = (
        <div style={{ position: "absolute", inset: 0, borderRadius: 0.03 * W, overflow: "hidden", boxShadow: `${ombre3(W, hero ? 0.4 + 1.4 * sH : 0.5)}` }}>
          <VideoCover nom={video} debutImage={Math.round(p.debut * FPS)} depuisSec={(idx * 0.3) % 1.2} sansVideo={p.sansVideo} filtre="saturate(0.9) contrast(1.05)" />
          <div style={{ position: "absolute", inset: 0, background: alpha(NUANCES.orangeChaud, 0.2), mixBlendMode: "soft-light" }} />
          <div style={{ position: "absolute", inset: 0, background: gloss }} />
          <div style={{ position: "absolute", inset: 0, borderRadius: 0.03 * W, boxShadow: `inset 0 0 0 ${Math.max(2, 0.003 * W)}px ${alpha(NUANCES.ivoire, 0.55)}` }} />
          {!hero ? <div style={{ position: "absolute", inset: 0, background: alpha(NUANCES.encre, 0.5 * estompe) }} /> : null}
          {hero && kH > 12 && kH < 24 ? <div style={{ position: "absolute", left: lerp(-0.3 * tw, 1.1 * tw, (kH - 12) / 12), top: -0.2 * th, width: 0.25 * tw, height: 1.4 * th, transform: "rotate(20deg)", background: `linear-gradient(90deg, rgba(0,0,0,0), ${alpha(NUANCES.ivoire, 0.22)}, rgba(0,0,0,0))` }} /> : null}
        </div>
      );
      tuiles.push(
        <div
          key={`${r}-${c}`}
          style={{
            position: "absolute",
            left: x0 + c * px,
            top: y,
            width: tw,
            height: th,
            opacity: 1,
            transform: hero
              ? `translateX(${((W / 2 - (x0 + tw / 2)) * sH).toFixed(1)}px) translateY(${(Math.sin(Math.max(0, kH - 12) * 0.3) * 0.004 * H).toFixed(2)}px) translateZ(${(T.profondeur * sH).toFixed(1)}px) rotateZ(${(-T.rotZ * sPivot).toFixed(2)}deg) rotateX(${(-T.inclinaison * sPivot).toFixed(2)}deg) scale(${kH > 0 ? 1 : echelle})`
              : `translateY(${(1 - s) * 0.03 * H}px) scale(${echelle})`,
            transformStyle: "preserve-3d",
          }}
        >
          {faceVideo}
          {hero && kH > 4 ? (
            <div style={{ position: "absolute", left: -0.012 * W, bottom: -0.03 * W, transform: `translateZ(${(70 * sH).toFixed(0)}px)`, opacity: borne((kH - 4) / 2) }}>
              <Puce texte={p.motFort} W={W} taille={0.056 * W} inclinaison={-3} echelle={lerp(0.5, 1, ressort("JAILLIR", kH - 4))} />
            </div>
          ) : null}
        </div>,
      );
    }
  }

  const fx = pX * 1.45 * H;
  return (
    <div style={{ position: "absolute", inset: 0, overflow: "hidden", pointerEvents: "none" }}>
      <DefFlouDirectionnel id={flouId} stdX={0} stdY={stdY} />
      <div style={{ position: "absolute", inset: 0, transform: `translateY(${-fx}px)`, filter: stdY > 0.4 ? `url(#${flouId})` : undefined }}>
        {/* Fond : encre en dégradé radial, lumière douce au centre, grain léger. */}
        <div style={{ position: "absolute", left: 0, top: -0.02 * H, width: W, height: H * 1.04, background: `radial-gradient(ellipse 80% 55% at 50% 45%, ${NUANCES.encreDouce} 0%, #261B13 48%, ${NUANCES.encre} 100%)` }} />
        <div style={{ position: "absolute", inset: 0, perspective: 1500, perspectiveOrigin: "50% 50%" }}>
          <div
            style={{
              position: "absolute",
              left: 0,
              top: 0,
              width: W,
              height: H,
              transformStyle: "preserve-3d",
              transformOrigin: "50% 50%",
              transform: `rotateX(${lerp(T.inclinaison, 62, pX).toFixed(2)}deg) rotateZ(${T.rotZ}deg)`,
            }}
          >
            {tuiles}
          </div>
        </div>
        <GrainPlein W={W} H={H} opacite={0.07} graine={3} clair />
      </div>
    </div>
  );
}

export function bruitagesMosaique(p: Pick<MosaiqueVideosProps, "debut">): BruitageMotion[] {
  return [
    [p.debut, "whoosh-in", 0.1],
    [+(p.debut + T.hero / FPS).toFixed(3), "select_002", 0.14],
    [+(p.debut + T.sortie / FPS).toFixed(3), "whoosh-out", 0.16],
  ];
}

/** Exemple : « des dizaines de dossiers » (aucun chiffre affiché). Les 6 B-roll sont ceux du pool partagé et du lot E. */
export const EXEMPLE_MOSAIQUE_VIDEOS = {
  phrase: "Des dizaines de chantiers en même temps.",
  debut: 0.3,
  fin: 0.3 + dureeMosaique(),
  motFort: "chantiers",
  videos: ["lotE-m1.mp4", "lotE-m2.mp4", "lotE-m3.mp4", "lotE-m4.mp4", "lotE-m5.mp4", "lotE-m6.mp4"],
};
