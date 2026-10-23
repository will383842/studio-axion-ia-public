import React from "react";
/**
 * CAM-C · le voyage du message (maquette `d3-camera-schema-transitions/camera.tsx`, CamC1/CamC2) : un point orange qui
 * brille (lueur orangée de la charte, cœur blanc) court sur le fil d'un nœud au suivant, avec sa traînée orange et ses
 * positions d'avant (pelures d'oignon). Il roule avec la même courbe que la caméra : elle le suit. Dessiné en pixels de
 * toile sous la pose de la caméra réécrite. Aucun JSX au niveau module.
 */
import { COULEURS_DUO } from "../../../../../src/briques/habillage/charte-duo";
import { ECRAN_IV, doux, type BoiteNoeud, type PoseCamera } from "../../../../../src/briques/schema-motion";
import { teinte } from "../../../cas-concret/plans/commun";
import { Icone } from "../../../interface-claire/elements";
import type { SceneCalculee } from "../../plan";

const C = COULEURS_DUO;
/** Rayon du point, positions d'avant (décalage en part de la course, opacité), fondu à l'arrivée (s). */
const POINT = { r: 44, traces: [[0.07, 0.48], [0.14, 0.36], [0.21, 0.26]] as const, fondu: 0.3 };

/** Courbe en S du bas de `a` au haut de `b` (comme les fils de la toile). */
function courbe(a: BoiteNoeud, b: BoiteNoeud) {
  const x1 = a.x + a.largeur / 2;
  const y1 = a.y + a.hauteur;
  const x2 = b.x + b.largeur / 2;
  const y2 = b.y;
  const k = (y2 - y1) / 2;
  const p = [x1, y1, x1, y1 + k, x2, y2 - k, x2, y2];
  const en = (u: number): [number, number] => {
    const v = 1 - u;
    return [v * v * v * p[0] + 3 * v * v * u * p[2] + 3 * v * u * u * p[4] + u * u * u * p[6], v * v * v * p[1] + 3 * v * v * u * p[3] + 3 * v * u * u * p[5] + u * u * u * p[7]];
  };
  return { d: `M ${x1} ${y1} C ${p[2]} ${p[3]}, ${p[4]} ${p[5]}, ${x2} ${y2}`, en };
}

export function PointSurLeFil({ scene, courses, pose, t, largeur }: { scene: SceneCalculee; courses: { de: string; vers: string; t0: number; t1: number }[]; pose: PoseCamera; t: number; largeur: number }) {
  const c = courses.find((x) => t >= x.t0 && t < x.t1 + POINT.fondu);
  const a = c && scene.parId.get(c.de);
  const b = c && scene.parId.get(c.vers);
  if (!c || !a || !b) return null;
  const u = doux((t - c.t0) / (c.t1 - c.t0));
  const opacite = t <= c.t1 ? 1 : 1 - (t - c.t1) / POINT.fondu;
  const { d, en } = courbe(a, b);
  const [x, y] = en(u);
  const dx = ECRAN_IV.largeur / 2 - pose.cx * pose.zoom;
  const dy = ECRAN_IV.hauteur / 2 - pose.cy * pose.zoom;
  return (
    <div style={{ position: "absolute", left: 0, top: 0, width: ECRAN_IV.largeur, height: ECRAN_IV.hauteur, transform: `scale(${largeur / ECRAN_IV.largeur})`, transformOrigin: "0 0", overflow: "hidden", opacity: opacite }}>
      <div style={{ position: "absolute", left: 0, top: 0, transform: `translate(${dx}px, ${dy}px) scale(${pose.zoom})`, transformOrigin: "0 0" }}>
        <svg width={1} height={1} style={{ position: "absolute", left: 0, top: 0, overflow: "visible" }}>
          {/* La traînée : le fil s'allume en orange derrière le point. */}
          <path d={d} pathLength={1} fill="none" stroke={C.orangeVif} strokeWidth={9} strokeLinecap="round" strokeDasharray="1 1" strokeDashoffset={1 - u} />
        </svg>
        {POINT.traces.map(([du, o]) => {
          if (u - du <= 0) return null;
          const [tx, ty] = en(u - du);
          const r = POINT.r * 0.55;
          return <div key={du} style={{ position: "absolute", left: tx - r, top: ty - r, width: 2 * r, height: 2 * r, borderRadius: "50%", background: teinte(C.orangeVif, o) }} />;
        })}
        <div style={{ position: "absolute", left: x - 190, top: y - 190, width: 380, height: 380, borderRadius: "50%", background: `radial-gradient(circle, ${teinte(C.orangeVif, 0.55)} 0%, ${teinte(C.orangeVif, 0.18)} 38%, ${teinte(C.orangeVif, 0)} 70%)` }} />
        <div style={{ position: "absolute", left: x - POINT.r, top: y - POINT.r, width: 2 * POINT.r, height: 2 * POINT.r, borderRadius: "50%", background: C.orangeVif, boxShadow: `0 0 0 10px ${teinte(C.blanc, 0.9)}, 0 8px 24px ${teinte(C.encre, 0.12)}` }} />
        <div style={{ position: "absolute", left: x - 16, top: y - 16, width: 32, height: 32, borderRadius: "50%", background: C.blanc }} />
      </div>
    </div>
  );
}

/** Carte éteinte de la maquette v3 (« étape pas encore allumée ») : beige plein, sans texte, pastille grise. */
const BEIGE_ETEINT = "#E2D7C9";

/**
 * CAM-C · les étapes qui attendent dessous (maquette CamC1 v3) : sous la bande des sous-titres (zone d'appoint), les
 * nœuds que le point va atteindre ensuite (suivants du nœud dont on parle, pas encore dits), en cartes pleines éteintes,
 * sans texte (rien d'indispensable seul). Effacées pendant une vue d'ensemble. Pixels de l'écran 1080 × 1920.
 */
export function CartesEnAttente({ scene, icones, ensembles, t, largeur }: { scene: SceneCalculee; icones: Record<string, string>; ensembles: { debut: number; fin: number }[]; t: number; largeur: number }) {
  if (ensembles.some((e) => t >= e.debut - 0.3 && t < e.fin + 0.2)) return null;
  const dits = scene.mots.filter((m) => m.t - 0.15 <= t);
  const courant = dits.length ? dits[dits.length - 1].noeud : null;
  if (!courant) return null;
  const pasDit = (id: string) => (scene.premierMot.get(id) ?? Infinity) - 0.15 > t;
  const suivants = scene.toile.fleches.filter((f) => f.de === courant && pasDit(f.vers) && scene.parId.has(f.vers)).map((f) => f.vers).slice(0, 2);
  if (!suivants.length) return null;
  const l = 370;
  const xs = suivants.length === 2 ? [150, 610] : [355];
  return (
    <div style={{ position: "absolute", left: 0, top: 0, width: ECRAN_IV.largeur, height: ECRAN_IV.hauteur, transform: `scale(${largeur / ECRAN_IV.largeur})`, transformOrigin: "0 0" }}>
      {suivants.map((id, i) => (
        <div key={id} style={{ position: "absolute", left: xs[i], top: 1318, width: l, height: 188, borderRadius: 34, background: BEIGE_ETEINT }}>
          {icones[id] ? (
            <div style={{ position: "absolute", left: -62, top: 94 - 46, width: 92, height: 92, borderRadius: "50%", background: C.grisClair, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Icone nom={icones[id]} taille={53} couleur={C.blanc} epaisseur={2.6} />
            </div>
          ) : null}
        </div>
      ))}
    </div>
  );
}
