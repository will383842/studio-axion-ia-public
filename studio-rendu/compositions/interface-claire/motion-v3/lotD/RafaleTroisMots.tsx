/**
 * ÉLÉMENT 18 — « RAFALE DE TROIS MOTS » (v3, lot D, rhabillé de la v2 ; standard § G ligne 18 et § F.2) = coup de poing, E7 plein écran.
 *
 * Quand : une ÉNUMÉRATION de 3 mots DITS à moins de 0,9 s d'écart (« devis, relances, factures »). Jamais avant 10 s, au moins 1 s de Will seul
 * ensuite, jamais deux E7 de suite. Visage : COUVERT en entier (pas de visage à moitié couvert sauf pendant le balayage de sortie).
 *
 * Ce qui change par rapport à la v2 (critique du 16/10 + § F.2) :
 *  - 3 aplats en DÉGRADÉ RADIAL (encre, orange, ivoire) au lieu d'aplats plats, avec grain de 2 % ;
 *  - mots en RELIEF LÉGER : 3 ombres empilées décalées de 0,004 L vers le bas (extrusion douce) + ombre douce portée ;
 *  - MISE AU POINT : chaque mot arrive flou (0,02 L → 0 en 5 i) ; le mot 1 entre avec un flou directionnel horizontal ;
 *  - RÉCAPITULATIF À 3 MOTS (mot 3 + 6 images) : trois PILULES alignées à gauche, inclinées de ±3° (encre, orange, verre), en cascade de 2 i (`JAILLIR`) ;
 *  - SORTIE en balayage diagonal de 5 images (bas-gauche → haut-droit) : les mots PARTENT AVEC l'aplat (aucun reste sur le visage découvert),
 *    le front franchit le visage en UNE image (`imagesVisagePartiel` de la v2, ≤ 3).
 * Chorégraphie (30 i/s ; i0 = mot 1, mot 2 à i8, mot 3 à i16 par défaut) :
 *  - MOT 1 : aplat ENCRE ; le mot ivoire entre lettre par lettre depuis la gauche (1 i par lettre, `GLISSER`), −10° → 0° ;
 *  - MOT 2 : aplat ORANGE ; le mot encre TOMBE du haut avec `JAILLIR`, +5°, flou vertical ;
 *  - MOT 3 : aplat IVOIRE ; le mot orange est CLAQUÉ : ×1,45 → ×1 avec `CLAQUER`, mise au point, secousse de l'élément (0,012 L), 4 traits d'impact.
 * Ressorts : `GLISSER`, `JAILLIR`, `CLAQUER`. Bruitages : `click_001` (i0), `click_002` (mot 2), `drop_002` (mot 3).
 * Les mots sont des mots DITS par Will (12 lettres au plus chacun). Aucun chiffre inventé.
 */
import React from "react";
import { alpha, avancesLettres, borne, boiteTournee, DEGRADE_ORANGE, dimensionsMot, FlouDir, FPS, grainUri, lin, N3, POLICES, PRISE_COMMUNE_LOT, rs, secousseD, usePolicesD } from "./communD";
import type { FicheLot3, PriseLot, SonD } from "./communD";
import { demiPlan, TraitsImpact } from "../../motion-v2/lot3/outils3";
import { balayageDiagonal, imagesRafale, seuilBalayage } from "../../motion-v2/lot3/RafaleTroisMots";

export const ID_RAFALE_TROIS_MOTS = "rafale-trois-mots";
export const DUREE_RAFALE = Object.freeze({ min: 1.2, max: 1.8 });
export const SONS_RAFALE: readonly SonD[] = [
  { k: 0, fichier: "click_001" },
  { k: 8, fichier: "click_002" },
  { k: 16, fichier: "drop_002" },
];

export const FICHE_RAFALE_TROIS_MOTS: FicheLot3 = Object.freeze({
  id: ID_RAFALE_TROIS_MOTS,
  numero: 18,
  nom: "Rafale de trois mots",
  emplacement: "E7 plein écran",
  forme: "3 aplats en dégradé radial (encre, orange, ivoire), grain 2 %, mots en relief léger",
  mouvement: "lettre par lettre, chute JAILLIR, claquement CLAQUER, récapitulatif à 3 mots",
  sortie: "balayage diagonal de 5 i, mots partant avec l'aplat",
  visage: "couvert" as const,
  ouvertureAutorisee: false,
  dureeMin: DUREE_RAFALE.min,
  dureeMax: DUREE_RAFALE.max,
  quandUtiliser: "Une énumération de 3 mots dits à moins de 0,9 s d'écart. Coup de poing : à partir de 10 s, jamais deux E7 de suite.",
  sons: SONS_RAFALE,
});

export type RafaleProps = {
  t: number;
  debut: number;
  fin: number;
  largeurImage: number;
  hauteurImage: number;
  /** Les 3 mots DITS (capitales automatiques, 12 lettres au plus). */
  mots: readonly [string, string, string];
  /** Instants (s, absolus) où Will dit les mots 2 et 3 ; par défaut 0,27 s puis 0,54 s après le mot 1. */
  tMots?: readonly [number, number];
  prise?: PriseLot;
};

const fondRadial = (c: 1 | 2 | 3) =>
  c === 1
    ? `radial-gradient(ellipse 85% 60% at 50% 42%, ${N3.encreDouce} 0%, ${N3.encre} 75%)`
    : c === 2
      ? `radial-gradient(ellipse 85% 60% at 50% 42%, ${N3.orangeChaud} 0%, ${N3.orange} 45%, ${N3.orangeProfond} 100%)`
      : `radial-gradient(ellipse 85% 60% at 50% 42%, ${N3.ivoire} 0%, ${N3.ivoire} 35%, ${N3.sableClair} 100%)`;

/** Mot en relief léger : 3 extrusions vers le bas + ombre douce ; centré en (cx, cy), tourné de `rot`, mis à l'échelle de `s`. */
function MotRelief({ texte, cx, cy, taille, rot = 0, s = 1, couleur, extrusion, W, op = 1, focus = 0, flouDir, angle = 0 }: { texte: string; cx: number; cy: number; taille: number; rot?: number; s?: number; couleur: string; extrusion: string; W: number; op?: number; focus?: number; flouDir?: number; angle?: number }) {
  const ombre = [1, 2, 3].map((i) => `0 ${i * 0.004 * W}px 0 ${extrusion}`).join(", ") + `, 0 ${0.03 * W}px ${0.05 * W}px ${alpha(N3.encre, 0.35)}`;
  return (
    <FlouDir cx={cx} cy={cy} cote={2 * W} angle={angle} px={flouDir ?? 0}>
      <div style={{ transform: `rotate(${rot}deg) scale(${s})`, opacity: op, filter: focus > 0.3 ? `blur(${focus}px)` : undefined, fontFamily: POLICES.titre, fontWeight: 800, fontSize: taille, lineHeight: 1, color: couleur, textShadow: ombre, whiteSpace: "nowrap", paddingTop: taille * 0.08 }}>{texte}</div>
    </FlouDir>
  );
}

export function RafaleTroisMots(p: RafaleProps) {
  usePolicesD();
  const { t, debut, fin } = p;
  const W = p.largeurImage;
  const H = p.hauteurImage;
  if (t < debut || t >= fin) return null;
  const k = (t - debut) * FPS;
  const { k2, k3 } = imagesRafale(debut, p.tMots);
  const mots = p.mots.map((m) => m.toUpperCase().slice(0, 12)) as [string, string, string];
  const kSortie = (fin - debut) * FPS - 5;
  const kR = k3 + 6;
  const prise = p.prise ?? PRISE_COMMUNE_LOT;

  const tailles = mots.map((m) => {
    const em = avancesLettres(m, 100).reduce((a, b) => a + b, 0) / 100;
    return Math.max(0.06 * W, Math.min(0.3 * W, (0.86 * W) / em));
  });
  const cy0 = 0.47 * H;
  const phase = k < k2 ? 1 : k < k3 ? 2 : 3;

  const contenu: React.ReactNode[] = [];
  if (phase === 1) {
    const adv = avancesLettres(mots[0], tailles[0]);
    const total = adv.reduce((a, b) => a + b, 0);
    const rot = -10 * (1 - lin(k, 0, 6));
    let x = -total / 2;
    const cr = Math.cos((rot * Math.PI) / 180);
    const sr = Math.sin((rot * Math.PI) / 180);
    [...mots[0]].forEach((c, i) => {
      const lx = x + adv[i] / 2;
      x += adv[i];
      const kk = k - i;
      const e = rs(kk, "GLISSER");
      const dxl = -(1 - borne(e, 0, 1.15)) * 0.3 * W;
      const px = lx + dxl;
      contenu.push(
        <MotRelief key={i} texte={c} cx={0.5 * W + px * cr} cy={cy0 + px * sr} taille={tailles[0]} rot={rot} couleur={N3.ivoire} extrusion={N3.orangeProfond} W={W} op={lin(kk, 0, 2)} flouDir={0.03 * W * (1 - borne(e, 0, 1))} focus={0.012 * W * (1 - lin(kk, 0, 4))} />,
      );
    });
  } else if (phase === 2) {
    const kk = k - k2;
    const e = rs(kk, "JAILLIR");
    const cy = cy0 - (1 - e) * 0.62 * H;
    contenu.push(<MotRelief key="m2" texte={mots[1]} cx={0.5 * W} cy={cy} taille={tailles[1]} rot={5} couleur={N3.encre} extrusion={N3.orangeProfond} W={W} flouDir={0.035 * W * (1 - borne(e, 0, 1))} angle={90} focus={0.012 * W * (1 - lin(kk, 0, 5))} />);
  } else {
    const kk = k - k3;
    const claque = 1.45 - 0.45 * rs(kk, "CLAQUER");
    const dx = secousseD(kk - 3, 0.012 * W);
    const kr = k - kR;
    if (kr < 0) {
      contenu.push(<MotRelief key="m3" texte={mots[2]} cx={0.5 * W + dx} cy={cy0} taille={tailles[2]} rot={-3} s={claque} couleur={N3.orange} extrusion={N3.orangeProfond} W={W} focus={0.02 * W * (1 - lin(kk, 0, 5))} />);
      if (kk >= 3) {
        const d = dimensionsMot(mots[2], tailles[2]);
        contenu.push(
          <svg key="imp" width={W} height={H} style={{ position: "absolute", left: 0, top: 0 }}>
            <TraitsImpact boite={boiteTournee(0.5 * W, cy0, d.w, d.h, -3)} kLocal={kk - 3} W={W} couleur={N3.orangeProfond} />
          </svg>,
        );
      }
    } else {
      // RÉCAPITULATIF (critique du 16/10) : trois pilules alignées à GAUCHE, inclinées de ±3°, chacune d'une matière (encre, orange, verre),
      // en cascade de 2 images (`JAILLIR`, départ à 75 %), avec un léger flottement : jamais figées.
      const lignes = [0.37, 0.49, 0.61].map((f) => f * H);
      const incl = [-3, 3, -3];
      const emR = mots.map((m) => avancesLettres(m, 100).reduce((a, b) => a + b, 0) / 100);
      const tailleR = mots.map((_, n) => Math.min(0.15 * W, (0.82 * W) / (emR[n] + 0.9)));
      const fonds = [`linear-gradient(180deg, ${N3.encreDouce}, ${N3.encre})`, DEGRADE_ORANGE, `linear-gradient(180deg, ${alpha(N3.sableClair, 0.95)}, ${alpha(N3.sable, 0.6)})`];
      const textes = [N3.ivoire, N3.ivoire, N3.encre];
      mots.forEach((m, n) => {
        const e = rs(kr - 2 * n, "JAILLIR");
        const fl = 0.004 * H * Math.sin((2 * Math.PI * (k - n * 5)) / 54);
        contenu.push(
          <div key={`p${n}`} style={{ position: "absolute", left: 0.08 * W, top: lignes[n] + fl, transform: `translateY(-50%) rotate(${incl[n]}deg) scale(${0.75 + 0.25 * Math.min(1.1, e)})`, transformOrigin: "0% 50%", opacity: lin(kr - 2 * n, 0, 1.5), filter: kr - 2 * n < 4 ? `blur(${0.008 * W * (1 - lin(kr - 2 * n, 0, 4))}px)` : undefined, background: fonds[n], borderRadius: tailleR[n] * 0.3, padding: `${tailleR[n] * 0.12}px ${tailleR[n] * 0.34}px`, fontFamily: POLICES.titre, fontWeight: 800, fontSize: tailleR[n], lineHeight: 1.05, color: textes[n], whiteSpace: "nowrap", boxShadow: `inset 0 ${0.003 * W}px 0 ${alpha(N3.ivoire, 0.4)}, 0 ${0.01 * W}px ${0.03 * W}px ${alpha(N3.encre, 0.3)}, 0 ${0.003 * W}px ${0.008 * W}px ${alpha(N3.encre, 0.22)}` }}>
            {m}
          </div>,
        );
      });
    }
  }

  // Sortie : balayage diagonal de 5 images ; les mots partent avec l'aplat.
  const sortant = k >= kSortie;
  const { d, smin, smax } = balayageDiagonal(W, H);
  const kk = k - kSortie;
  const seuil = sortant ? seuilBalayage(kk, smin, smax, prise, W, H) : smin - 10;
  const fuite = sortant ? 1.9 * (seuil - smin) : 0;
  const bande = 0.035 * W;
  const versCss = (pts: string) => (pts ? `polygon(${pts.split(" ").map((q) => q.split(",").map((v) => `${v}px`).join(" ")).join(", ")})` : undefined);
  const polyAplat = sortant ? demiPlan(W, H, d, seuil + bande) : "";
  const polyBande = sortant ? demiPlan(W, H, d, seuil) : "";
  if (sortant && !polyBande) return null;

  return (
    <div style={{ position: "absolute", left: 0, top: 0, width: W, height: H, overflow: "hidden", pointerEvents: "none" }}>
      {sortant ? <div style={{ position: "absolute", inset: 0, background: `linear-gradient(135deg, ${N3.orangeChaud}, ${N3.orangeProfond})`, clipPath: versCss(polyBande) }} /> : null}
      <div style={{ position: "absolute", inset: 0, clipPath: sortant ? versCss(polyAplat) : undefined }}>
        <div style={{ position: "absolute", inset: 0, background: fondRadial(phase as 1 | 2 | 3) }} />
        <div style={{ position: "absolute", inset: 0, backgroundImage: grainUri(0.02), opacity: 1 }} />
        <div style={{ position: "absolute", inset: 0, transform: `translate(${d.x * fuite}px, ${d.y * fuite}px)` }}>{contenu}</div>
      </div>
    </div>
  );
}
