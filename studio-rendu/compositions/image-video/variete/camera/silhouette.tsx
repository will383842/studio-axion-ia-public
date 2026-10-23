import React from "react";
/**
 * CAM-B · vue d'ensemble d'abord (maquette `d3-camera-schema-transitions/camera.tsx`, CamB1) : sur la nuit, le schéma
 * ENTIER de la séquence en silhouettes pleines (une barre à la place du texte, illisible de loin), ses fils, et une seule
 * carte allumée (le premier nœud dont on parle) dans un viseur. Puis la caméra plonge : le calque grossit vers la carte
 * et s'efface. Aucun fil ni carte dans la bande des sous-titres. Aucun JSX au niveau module.
 */
import { AbsoluteFill } from "remotion";
import { COULEURS_DUO } from "../../../../../src/briques/habillage/charte-duo";
import { ECRAN_IV, type BoiteNoeud } from "../../../../../src/briques/schema-motion";
import { famille, graisse, teinte } from "../../../cas-concret/plans/commun";
import { Fond } from "../../../cas-concret/socle/Fond";
import { Icone } from "../../../interface-claire/elements";
import type { SceneCalculee } from "../../plan";

const C = COULEURS_DUO;
/** Cadre où le schéma est posé en entier (pixels de 1080 × 1920, haut sous l'en-tête) ; la bande des sous-titres en est retirée par un masque. */
const CADRE = { x: 80, l: 920, bas: 1520 };
const MASQUE = "linear-gradient(to bottom, #000 0, #000 1128px, transparent 1146px, transparent 1292px, #000 1304px, #000 1500px, transparent 1536px)";
/** Carte allumée, à sa taille d'écran (texte net, jamais agrandi en flou). */
const CARTE = { l: 600, h: 190, taille: 76 };

/** Boîte de toile → écran, schéma entier tenu dans le cadre. */
function ajustement(boites: readonly BoiteNoeud[], haut: number) {
  const cadre = { ...CADRE, y: haut, h: CADRE.bas - haut };
  const x0 = Math.min(...boites.map((b) => b.x));
  const y0 = Math.min(...boites.map((b) => b.y));
  const x1 = Math.max(...boites.map((b) => b.x + b.largeur));
  const y1 = Math.max(...boites.map((b) => b.y + b.hauteur));
  // Vu de loin, le schéma peut s'étaler en largeur (jusqu'à 2,2 fois son échelle verticale) : les branches restent des colonnes.
  const ky = Math.min(cadre.h / (y1 - y0), 0.62);
  const kx = Math.min(cadre.l / (x1 - x0), ky * 2.2);
  const dx = cadre.x + (cadre.l - (x1 - x0) * kx) / 2 - x0 * kx;
  const dy = cadre.y + (cadre.h - (y1 - y0) * ky) / 2 - y0 * ky;
  return (b: Pick<BoiteNoeud, "x" | "y" | "largeur" | "hauteur">) => ({ x: dx + b.x * kx, y: dy + b.y * ky, l: b.largeur * kx, h: b.hauteur * ky });
}

export function VueSilhouette({ scene, noeud, icone, fin, t, haut, largeur, hauteur }: { scene: SceneCalculee; noeud: string; icone?: string; fin: number; t: number; haut: number; largeur: number; hauteur: number }) {
  const boites = scene.toile.boites;
  if (!boites.length) return null;
  const vers = ajustement(boites, haut + 40);
  const cible = scene.parId.get(noeud);
  const c = cible ? vers(cible) : { x: 540, y: 600, l: 0, h: 0 };
  const cx = Math.max(60 + CARTE.l / 2, Math.min(1020 - CARTE.l / 2, c.x + c.l / 2));
  const cy = Math.max(haut + 40 + CARTE.h / 2, Math.min(1100 - CARTE.h / 2, c.y + c.h / 2));
  const dit = (scene.premierMot.get(noeud) ?? Infinity) <= t + 0.15;
  const libelle = cible?.textes.find((x) => x.role === "libelle")?.texte ?? "";
  // Plongée : la vue grossit vers la carte allumée (0,6 s), opaque, puis s'efface en 0,15 s sur la toile déjà cadrée.
  const plongee = Math.max(0, Math.min(1, (t - (fin - 0.6)) / 0.6));
  const fondu = Math.max(0, Math.min(1, (t - (fin - 0.15)) / 0.15));
  const fil = teinte(C.grisClair, 0.45);
  return (
    <AbsoluteFill style={{ opacity: 1 - fondu }}>
      <Fond fond="sombre" largeur={largeur} hauteur={hauteur} />
      <div style={{ position: "absolute", left: 0, top: 0, width: ECRAN_IV.largeur, height: ECRAN_IV.hauteur, transform: `scale(${largeur / ECRAN_IV.largeur}) translate(${cx}px, ${cy}px) scale(${1 + 0.5 * plongee * plongee * (3 - 2 * plongee)}) translate(${-cx}px, ${-cy}px)`, transformOrigin: "0 0" }}>
        <div style={{ position: "absolute", inset: 0, maskImage: MASQUE, WebkitMaskImage: MASQUE }}>
          <svg width={ECRAN_IV.largeur} height={ECRAN_IV.hauteur} style={{ position: "absolute", left: 0, top: 0 }}>
            {scene.toile.fleches.map((f) => {
              const a = scene.parId.get(f.de);
              const b = scene.parId.get(f.vers);
              if (!a || !b) return null;
              const p = vers(a);
              const q = vers(b);
              const x1 = p.x + p.l / 2;
              const y1 = p.y + p.h;
              const x2 = q.x + q.l / 2;
              const y2 = q.y;
              const k = (y2 - y1) / 2;
              return <path key={f.id} d={`M ${x1} ${y1} C ${x1} ${y1 + k}, ${x2} ${y2 - k}, ${x2} ${y2}`} stroke={fil} strokeWidth={9} fill="none" strokeLinecap="round" />;
            })}
          </svg>
          {boites.map((b) => {
            if (b.id === noeud) return null;
            // Vue de loin, une étape reste une forme pleine et lisible comme une carte (300 × 110 px au moins).
            const v = vers(b);
            const l = Math.max(v.l, 300);
            const h = Math.max(v.h, 110);
            const r = { x: v.x + (v.l - l) / 2, y: v.y + (v.h - h) / 2, l, h };
            return (
              <div key={b.id} style={{ position: "absolute", left: r.x, top: r.y, width: r.l, height: r.h, borderRadius: Math.max(14, 30 * (r.h / 100)), background: C.gris }}>
                <div style={{ position: "absolute", left: r.l * 0.12, top: r.h / 2 - Math.max(6, r.h * 0.11), width: r.l * 0.56, height: Math.max(12, r.h * 0.22), borderRadius: 11, background: teinte(C.nuit, 0.32) }} />
              </div>
            );
          })}
        </div>
        {/* La seule carte allumée : là où la caméra va plonger. */}
        <div style={{ position: "absolute", left: cx - CARTE.l / 2, top: cy - CARTE.h / 2, width: CARTE.l, height: CARTE.h, boxSizing: "border-box", borderRadius: 34, background: C.blanc, border: `6px solid ${C.orangeVif}`, boxShadow: `0 0 120px 30px ${teinte(C.nuitLueur, 0.9)}, 0 20px 50px ${teinte(C.nuit, 0.5)}`, display: "flex", alignItems: "center", justifyContent: "center", padding: "0 30px 0 70px" }}>
          {dit ? <div style={{ fontFamily: famille("anton"), fontWeight: graisse("anton"), fontSize: CARTE.taille, lineHeight: 1.1, color: C.encre, textTransform: "uppercase", textAlign: "center" }}>{libelle}</div> : null}
          {icone ? (
            <div style={{ position: "absolute", left: -62, top: CARTE.h / 2 - 46, width: 92, height: 92, borderRadius: "50%", background: C.encre, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Icone nom={icone} taille={53} couleur={C.orangeVif} epaisseur={2.6} />
            </div>
          ) : null}
        </div>
        <Viseur x={cx - CARTE.l / 2 - 110} y={cy - CARTE.h / 2 - 50} l={CARTE.l + 160} h={CARTE.h + 100} />
      </div>
    </AbsoluteFill>
  );
}

/** Viseur : quatre coins en L autour d'un cadre. */
function Viseur({ x, y, l, h }: { x: number; y: number; l: number; h: number }) {
  const k = 64;
  const coins = [`M ${x} ${y + k} L ${x} ${y} L ${x + k} ${y}`, `M ${x + l - k} ${y} L ${x + l} ${y} L ${x + l} ${y + k}`, `M ${x + l} ${y + h - k} L ${x + l} ${y + h} L ${x + l - k} ${y + h}`, `M ${x + k} ${y + h} L ${x} ${y + h} L ${x} ${y + h - k}`];
  return (
    <svg width={ECRAN_IV.largeur} height={ECRAN_IV.hauteur} style={{ position: "absolute", left: 0, top: 0, overflow: "visible" }}>
      {coins.map((d) => (
        <path key={d} d={d} stroke={C.ivoire} strokeWidth={8} fill="none" strokeLinecap="round" strokeLinejoin="round" />
      ))}
    </svg>
  );
}
