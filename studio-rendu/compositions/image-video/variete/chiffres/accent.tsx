import React from "react";
/**
 * Correctif « le chiffre qui claque sur une étape déjà posée n'est pas dessiné » (doc 72 § 7 point 4) : sur la toile,
 * le chiffre dit claque en badge à côté de son nœud, à sa position à l'écran (caméra comprise, ou place du nœud dans
 * la vue d'ensemble si elle est ouverte), dans le premier espace libre (dessous, dessus, à droite, à gauche), sans
 * toucher `Toile.tsx`. Le badge ne couvre JAMAIS le libellé d'un nœud : sans espace libre autour, il passe en
 * surimpression hors du schéma (bande de l'en-tête), relié au nœud par un filet. Badge orange vif, texte encre
 * (rapport 6,4), Anton 96 px (72 px en surimpression). Il reste 1,6 s puis s'efface.
 */
import { cameraA, ECRAN_IV, type BoiteNoeud, type TrajectoireCamera } from "../../../../../src/briques/schema-motion";
import type { AccentToileRendu, RectRendu } from "./donnees";
import { a, ANTON, C, c01, doux, progres, rebond } from "./outils";

/** Ce que l'accent lit de la scène calculée d'une toile (`calculerScene`). */
export type SceneAccents = { parId: Map<string, BoiteNoeud>; trajectoire: Pick<TrajectoireCamera, "images"> };

export const TAILLE_ACCENT = 96;
/** Badge posé hors du schéma (bande de l'en-tête) : réduit pour tenir entre la marque et l'étiquette. */
export const TAILLE_ACCENT_SURIMPRESSION = 72;
/** En-tête (fractions de la hauteur, `Entete.tsx`) : bas de la marque, haut de l'étiquette, bas de l'en-tête. */
const MARQUE_BAS = 0.075;
const ETIQUETTE_HAUT = 0.135;
const BAS_ENTETE = 0.245;
/** Zone protégée à droite (TikTok, 16 %) : le badge en surimpression n'y va pas. */
const ZONE_PROTEGEE_DROITE = 0.16;
const largeurBadge = (texte: string, taille: number) => texte.length * 0.5 * taille + 2 * 30;
const TENUE_SEC = 1.6;
/** Cadre du texte (standard 74 § 3, 9:16) : au-dessus de la bande des sous-titres (y 1152). */
const CADRE = { x0: 65, x1: 1015, y0: 269, y1: 1140 };
const ECART = 12;

/** Surface commune de deux rectangles. */
export const commun = (p: RectRendu, q: RectRendu) => Math.max(0, Math.min(p.x + p.largeur, q.x + q.largeur) - Math.max(p.x, q.x)) * Math.max(0, Math.min(p.y + p.hauteur, q.y + q.hauteur) - Math.max(p.y, q.y));

/** Boîte du nœud et des autres nœuds à l'écran (pixels 1080 × 1920) à l'instant `t`, ou `null` si inconnu. */
export function boitesEcran(scene: SceneAccents, ac: AccentToileRendu, t: number): { noeud: RectRendu; obstacles: RectRendu[] } | null {
  const vue = ac.vues?.find((v) => t >= v.debut && t < v.fin);
  if (vue) return { noeud: vue, obstacles: vue.obstacles };
  if (!scene.parId.get(ac.noeud)) return null;
  const pose = cameraA(scene.trajectoire, t);
  const dx = ECRAN_IV.largeur / 2 - pose.cx * pose.zoom;
  const dy = ECRAN_IV.hauteur / 2 - pose.cy * pose.zoom;
  const ecran = (b: BoiteNoeud): RectRendu => ({ x: b.x * pose.zoom + dx, y: b.y * pose.zoom + dy, largeur: b.largeur * pose.zoom, hauteur: b.hauteur * pose.zoom });
  return { noeud: ecran(scene.parId.get(ac.noeud)!), obstacles: [...scene.parId.values()].filter((b) => b.id !== ac.noeud).map(ecran) };
}

/** Place du badge : son rectangle ; `surimpression` : posé hors du schéma, relié à son nœud (`noeud`) par un filet. */
export type PlaceAccent = RectRendu & { surimpression?: { noeud: RectRendu; filet: { x: number; y: number }[] } };

/**
 * Rectangle du badge. Règle : il ne recouvre JAMAIS un nœud (ni donc son libellé), ni un chiffre posé, ni l'en-tête.
 * 1. Autour du nœud (dessous, dessus, à droite, à gauche), dans le cadre du texte sous l'en-tête : le premier libre.
 * 2. Sinon (vue d'ensemble dense : aucun espace libre), en surimpression hors du schéma, dans la bande libre entre la
 *    marque et l'étiquette de l'en-tête, au-dessus du nœud (réduit à 72 px), avec un filet vers le nœud par la marge.
 */
export function placeAccent(scene: SceneAccents, ac: AccentToileRendu, t: number, hauteurEcran = ECRAN_IV.hauteur): PlaceAccent | null {
  const b = boitesEcran(scene, ac, t);
  if (!b) return null;
  const n = b.noeud;
  const largeur = largeurBadge(ac.texte, TAILLE_ACCENT);
  const hauteur = TAILLE_ACCENT + 24;
  const cx = n.x + n.largeur / 2 - largeur / 2;
  const cy = n.y + n.hauteur / 2 - hauteur / 2;
  const y0 = Math.max(CADRE.y0, BAS_ENTETE * hauteurEcran);
  const borne = (p: RectRendu): RectRendu => ({ ...p, x: Math.min(CADRE.x1 - p.largeur, Math.max(CADRE.x0, p.x)), y: Math.min(CADRE.y1 - p.hauteur, Math.max(y0, p.y)) });
  const obstacles = [n, ...b.obstacles];
  const libre = (p: RectRendu) => obstacles.every((o) => commun(p, o) === 0);
  const cotes: RectRendu[] = [
    { x: cx, y: n.y + n.hauteur + ECART, largeur, hauteur },
    { x: cx, y: n.y - hauteur - ECART, largeur, hauteur },
    { x: n.x + n.largeur + ECART, y: cy, largeur, hauteur },
    { x: n.x - largeur - ECART, y: cy, largeur, hauteur },
  ].map(borne);
  const cote = cotes.find(libre);
  if (cote) return cote;
  // Surimpression : bande libre de l'en-tête (sous la marque, au-dessus de l'étiquette), au plus près du nœud.
  const lS = largeurBadge(ac.texte, TAILLE_ACCENT_SURIMPRESSION);
  const hS = TAILLE_ACCENT_SURIMPRESSION + 20;
  const yS = (MARQUE_BAS * hauteurEcran + ETIQUETTE_HAUT * hauteurEcran - hS) / 2;
  const xMax = Math.min(CADRE.x1, ECRAN_IV.largeur * (1 - ZONE_PROTEGEE_DROITE)) - lS;
  const essais = [n.x + n.largeur / 2 - lS / 2, ...Array.from({ length: 41 }, (_, i) => CADRE.x0 + ((xMax - CADRE.x0) * i) / 40)]
    .map((x) => Math.min(xMax, Math.max(CADRE.x0, x)))
    .map((x) => ({ x, y: yS, largeur: lS, hauteur: hS }));
  const p = essais.find(libre) ?? essais[0];
  // Filet par la marge la plus proche du nœud (hors des nœuds), du badge au milieu du bord du nœud.
  const tous = obstacles.filter((o) => o.y + o.hauteur > yS + hS);
  const droite = Math.max(...tous.map((o) => o.x + o.largeur));
  const gauche = Math.min(...tous.map((o) => o.x));
  const parDroite = droite - (n.x + n.largeur) <= n.x - gauche;
  const xm = parDroite ? Math.min(ECRAN_IV.largeur - 10, droite + 14) : Math.max(10, gauche - 14);
  const ym = n.y + n.hauteur / 2;
  const filet = [
    { x: parDroite ? p.x + p.largeur : p.x, y: p.y + p.hauteur / 2 },
    { x: xm, y: p.y + p.hauteur / 2 },
    { x: xm, y: ym },
    { x: parDroite ? n.x + n.largeur : n.x, y: ym },
  ];
  return { ...p, surimpression: { noeud: n, filet } };
}

export function AccentsToile({ scene, accents, t }: { scene: SceneAccents; accents: AccentToileRendu[]; t: number }) {
  return (
    <>
      {accents.map((ac, i) => {
        if (t < ac.t - 0.05 || t > ac.t + TENUE_SEC + 0.3) return null;
        const p = placeAccent(scene, ac, t);
        if (!p) return null;
        const u = progres(t, ac.t, 0.32);
        const sortie = doux(progres(t, ac.t + TENUE_SEC, 0.3));
        const echelle = t < ac.t ? 0 : 1.5 - 0.5 * rebond(u);
        const opacite = c01(u * 4) * (1 - sortie);
        const s = p.surimpression;
        const badge = (
          <div key={i} style={{ position: "absolute", left: p.x, top: p.y, width: p.largeur, height: p.hauteur, borderRadius: p.hauteur / 2, background: C.orangeVif, border: `6px solid ${C.blanc}`, boxSizing: "border-box", display: "flex", alignItems: "center", justifyContent: "center", opacity: opacite, transform: `scale(${echelle})`, boxShadow: `0 14px 40px ${a(C.encre, 0.3)}` }}>
            <div style={{ ...ANTON, fontSize: s ? TAILLE_ACCENT_SURIMPRESSION : TAILLE_ACCENT, color: C.encre, whiteSpace: "nowrap", marginTop: 4 }}>{ac.texte}</div>
          </div>
        );
        if (!s) return badge;
        // Hors du schéma : un filet orange par la marge jusqu'au nœud, et le contour du nœud souligné (sans le couvrir).
        const trace = doux(progres(t, ac.t, 0.4));
        return (
          <React.Fragment key={i}>
            <svg width={1080} height={ECRAN_IV.hauteur} style={{ position: "absolute", left: 0, top: 0, overflow: "visible", opacity: 1 - sortie }}>
              <polyline points={s.filet.map((q) => `${q.x},${q.y}`).join(" ")} pathLength={1} strokeDasharray="1 1" strokeDashoffset={1 - trace} fill="none" stroke={C.orangeVif} strokeWidth={6} strokeLinecap="round" strokeLinejoin="round" />
              <rect x={s.noeud.x - 7} y={s.noeud.y - 7} width={s.noeud.largeur + 14} height={s.noeud.hauteur + 14} rx={Math.min((s.noeud.hauteur + 14) / 2, 50)} fill="none" stroke={C.orangeVif} strokeWidth={6} opacity={trace} />
            </svg>
            {badge}
          </React.Fragment>
        );
      })}
    </>
  );
}
