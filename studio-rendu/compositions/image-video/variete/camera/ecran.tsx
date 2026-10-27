import React from "react";
/**
 * Écran « caméra » de la variété (lot CAM-TRA) : CAM-E · deux branches côte à côte (maquette
 * `d3-camera-schema-transitions/camera.tsx`, CamE1/CamE2). L'écran se partage sur toute la hauteur : la branche
 * majoritaire sur un panneau orange à gauche, l'autre sur un panneau nuit à droite ; l'étape en cours de chaque branche
 * en grande carte, la part (« 80 % ») en tête de panneau une fois dite (jamais avant), et, sous la bande des
 * sous-titres, la piste des étapes de chaque branche qui s'allume des deux côtés en même temps. Textes dans la zone où
 * ils se lisent (x 65 → 886 en 9:16). Aucun JSX au niveau module.
 */
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import { COULEURS_DUO } from "../../../../../src/briques/habillage/charte-duo";
import { largeurAnton } from "../../../../../src/briques/schema-motion/chasse-anton";
import { famille, graisse, planSurgir, progres, teinte } from "../../../cas-concret/plans/commun";
import { FondIV } from "../fond/FondVarie";
import { Icone } from "../../../interface-claire/elements";
import { Entete } from "../../Entete";
import type { ProprietesEcranVariete } from "../CompositionVariete";
import { donneesEcran, type BrancheCameraE } from "./donnees";

const C = COULEURS_DUO;

/** Mise en page en pixels (9:16 d'après la maquette validée ; 4:5 resserré au-dessus de sa bande de sous-titres). */
function mise(hauteur: number) {
  const bas = hauteur < 1600;
  return {
    panneaux: [
      { x: -40, l: 507, centre: 256, carteX: 65, carteL: 382 },
      { x: 483, l: 640, centre: 689, carteX: 498, carteL: 382 },
    ],
    haut: bas ? 170 : 290,
    basPanneau: bas ? 1010 : 1140,
    tete: bas ? 205 : 340,
    carteY: bas ? 410 : 580,
    carteH: bas ? 470 : 460,
    piste: bas ? null : { haut: 1300, bas: 1530 },
  };
}

/** Taille du libellé d'étape : 76 px, réduite (58 px au moins) pour que le mot le plus long tienne dans la carte. */
function tailleLibelle(texte: string, largeur: number): number {
  const mot = Math.max(...texte.toUpperCase().split(/\s+/).map((m) => largeurAnton(m, 76)));
  return Math.max(58, Math.min(76, Math.floor((76 * (largeur - 48)) / Math.max(1, mot))));
}

function Panneau({ b, cote, t, m }: { b: BrancheCameraE; cote: 0 | 1; t: number; m: ReturnType<typeof mise> }) {
  const p = m.panneaux[cote];
  const sombre = cote === 1;
  const encreTete = sombre ? C.ivoire : C.encre;
  const k = b.etapes.reduce((n, e, i) => (t >= e.t - 0.15 ? i : n), -1);
  const etape = k >= 0 ? b.etapes[k] : null;
  const s = planSurgir(etape ? progres(t, etape.t - 0.15, 0.3) : 0);
  const part = b.part && t >= b.part.t - 0.15 ? b.part.texte : null;
  const anton = { fontFamily: famille("anton"), fontWeight: graisse("anton"), textTransform: "uppercase" as const };
  return (
    <>
      <div style={{ position: "absolute", left: p.x, top: m.haut, width: p.l, height: m.basPanneau - m.haut, borderRadius: 34, background: sombre ? C.encre : C.orangeVif }} />
      {m.piste ? <div style={{ position: "absolute", left: p.x, top: m.piste.haut, width: p.l, height: m.piste.bas - m.piste.haut, borderRadius: 34, background: sombre ? C.encre : C.orangeVif }} /> : null}
      <div style={{ position: "absolute", left: p.carteX, top: m.tete, width: p.carteL, textAlign: "center", ...anton, fontSize: part ? 140 : 76, lineHeight: 1.05, color: encreTete, opacity: part ? progres(t, (b.part?.t ?? 0) - 0.15, 0.25) : 1 }}>
        {part ?? b.titre}
      </div>
      {/* La carte de l'étape en cours (style du nœud réel : blanche, arrondie, ombre douce). */}
      <div style={{ position: "absolute", left: p.carteX, top: m.carteY, width: p.carteL, height: m.carteH, boxSizing: "border-box", borderRadius: 34, background: etape ? C.blanc : teinte(C.blanc, sombre ? 0.12 : 0.35), boxShadow: etape ? `0 18px 44px ${teinte(C.encre, 0.12)}` : undefined, opacity: etape ? s.opacite : 1, transform: `scale(${etape ? s.echelle : 1})`, display: "flex", alignItems: "center", justifyContent: "center", padding: "0 24px" }}>
        {etape ? <div style={{ ...anton, fontSize: tailleLibelle(etape.libelle, p.carteL), lineHeight: 1.12, color: C.encre, textAlign: "center" }}>{etape.libelle}</div> : null}
      </div>
      {m.piste ? <Piste b={b} k={k} centre={p.centre} y={(m.piste.haut + m.piste.bas) / 2} sombre={sombre} /> : null}
    </>
  );
}

/** Les étapes de la branche en jetons d'icônes (rien d'indispensable seul : on lit l'étape au-dessus). */
function Piste({ b, k, centre, y, sombre }: { b: BrancheCameraE; k: number; centre: number; y: number; sombre: boolean }) {
  const pas = 88;
  const n = b.etapes.length;
  const x0 = centre - ((n - 1) * pas) / 2;
  const trait = sombre ? C.ivoire : C.encre;
  return (
    <>
      <svg width={1080} height={1920} style={{ position: "absolute", left: 0, top: 0 }}>
        <path d={`M ${x0} ${y} L ${x0 + (n - 1) * pas} ${y}`} stroke={teinte(trait, sombre ? 0.2 : 0.25)} strokeWidth={7} strokeLinecap="round" />
        {k > 0 ? <path d={`M ${x0} ${y} L ${x0 + k * pas} ${y}`} stroke={trait} strokeWidth={7} strokeLinecap="round" /> : null}
      </svg>
      {b.etapes.map((e, i) => {
        const allume = i <= k;
        const fin = allume && i === n - 1 && !sombre;
        // Sur le panneau nuit, un jeton allumé est ivoire (encre sur encre ne se verrait pas).
        const fond = allume ? (fin ? C.vert : sombre ? C.ivoire : C.encre) : sombre ? C.nuitHaut : teinte(C.grisClair, 0.45);
        return (
          <div key={e.id} style={{ position: "absolute", left: x0 + i * pas - 36, top: y - 36, width: 72, height: 72, borderRadius: "50%", background: fond, display: "flex", alignItems: "center", justifyContent: "center", boxShadow: allume ? `0 10px 24px ${teinte(C.encre, 0.12)}` : undefined }}>
            {e.icone ? <Icone nom={e.icone} taille={43} couleur={allume ? (sombre ? C.encre : C.blanc) : sombre ? teinte(C.grisClair, 0.4) : C.blanc} epaisseur={2.6} /> : null}
          </div>
        );
      })}
    </>
  );
}

export function EcranCamera(p: ProprietesEcranVariete) {
  const { fps } = useVideoConfig();
  const t = useCurrentFrame() / fps;
  const d = donneesEcran(p.bloc.donnees);
  const m = mise(p.hauteur);
  return (
    <AbsoluteFill>
      <FondIV fond="ivoire" largeur={p.largeur} hauteur={p.hauteur} />
      {d ? (
        <AbsoluteFill style={{ overflow: "hidden" }}>
          <Panneau b={d.branches[0]} cote={0} t={t} m={m} />
          <Panneau b={d.branches[1]} cote={1} t={t} m={m} />
        </AbsoluteFill>
      ) : null}
      <Entete entete={null} ecoule={0} sortie={0} fond="ivoire" marque={p.marque} largeur={p.largeur} hauteur={p.hauteur} />
    </AbsoluteFill>
  );
}
