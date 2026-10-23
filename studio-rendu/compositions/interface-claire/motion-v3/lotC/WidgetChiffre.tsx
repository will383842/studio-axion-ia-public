import React, { useId } from "react";
/**
 * n° 13 `widget-chiffre` (lot C, standard v3 § G) : un widget de verre VERTICAL à droite (0,30 L × 0,30 H, x 0,755-1,055,
 * déborde de 5,5 % ; le contenu est centré dans la partie visible). Un NOMBRE DIT : le compteur défile jusqu'au chiffre
 * dit pendant que l'anneau-jauge orange se remplit (12 images), l'unité dite dessous. Entrée N4 : glissement diagonal
 * (≈ 25°) depuis le coin haut-droit avec 2 copies fantômes (25 % puis 12 %), rotateY 30° → 12° (le widget « regarde » Will,
 * perspective bien visible), secousse de 0,006 L à l'arrêt ; le chiffre se pose en CLAQUER ; sortie : glissement hors cadre
 * vers la droite en 7 images (accélération, flou directionnel), rien ne reste. Vie après pose : flottement, roulis du
 * pivot, reflet qui passe deux fois.
 * Visage : entier — le bord gauche (0,755 L) reste à plus de 0,005 L de Z même à 12° et en perspective.
 * AUCUN chiffre n'est affiché sans être dit : `nombre`, `unite` et `precision` viennent de la phrase. Textes ≥ 54 px.
 */
import { Easing } from "remotion";
import { Icone } from "../../elements";
import { alpha, courbe, Flou, lerp, NUANCES, Perspective, PropsElement, ReflePassant, ressort, secousse, SonElement, styleOrange, styleVerre, texte, titre, vitesse } from "./commun-lotC";

export type PropsWidgetChiffre = PropsElement & {
  /** Le nombre dit (entier). */
  nombre?: number;
  /** L'unité dite (« heures »). */
  unite?: string;
  /** Précision dite (« gagnées »). */
  precision?: string;
  iconeTitre?: string;
  /** Image où le compteur démarre, et image de la sortie. */
  compteA?: number;
  sortieA?: number;
};

export const SONS_WIDGET = (compteA = 14, sortieA = 56): readonly SonElement[] => [
  [0, "whoosh-in", 0.6],
  [compteA, "tick_001", 0.45],
  [compteA + 4, "tick_001", 0.45],
  [compteA + 8, "tick_001", 0.45],
  [compteA + 12, "ding-2", 0.7],
  [sortieA, "whoosh-out", 0.55],
];

const ANGLE = (25 * Math.PI) / 180;

function Corps({ i, W, H, nombre, unite, precision, iconeTitre, compteA, fantome }: Required<Pick<PropsWidgetChiffre, "nombre" | "unite" | "precision" | "iconeTitre" | "compteA">> & { i: number; W: number; H: number; fantome?: boolean }) {
  const id = `an${useId().replace(/[^a-zA-Z0-9]/g, "")}`;
  const h = 0.3 * H;
  const visible = 0.245 * W; // largeur visible (le widget déborde du cadre à droite)
  const compte = courbe(i, compteA, 12, Easing.out(Easing.cubic));
  const valeur = Math.round(nombre * compte);
  const apres = Math.max(0, Math.min(1, (i - (compteA + 12)) / 8));
  const pop = 1 + 0.12 * Math.sin(Math.PI * apres);
  const d = 0.2 * W; // diamètre de l'anneau
  const ep = 0.018 * W;
  const r = (d - ep) / 2;
  const circ = 2 * Math.PI * r;
  const remplissage = 0.82 * compte;
  const pastille = h * 0.12;
  return (
    <div style={{ position: "absolute", inset: 0, ...styleVerre(W, 0.04 * W, { opacite: fantome ? 0.9 : 0.88 }), overflow: "hidden" }}>
      <div style={{ position: "absolute", left: 0, width: visible, top: 0, bottom: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: h * 0.04 }}>
        <div style={{ width: pastille, height: pastille, ...styleOrange(W, pastille * 0.3, 0.6), display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Icone nom={iconeTitre} taille={pastille * 0.6} couleur={NUANCES.ivoire} epaisseur={2.8} />
        </div>
        <div style={{ position: "relative", width: d, height: d }}>
          <svg width={d} height={d} viewBox={`0 0 ${d} ${d}`} style={{ position: "absolute", inset: 0, overflow: "visible", filter: `drop-shadow(0 0 ${0.012 * W}px ${alpha(NUANCES.orange, 0.35 * compte)})` }}>
            <defs>
              <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={NUANCES.orangeChaud} />
                <stop offset="100%" stopColor={NUANCES.orangeProfond} />
              </linearGradient>
            </defs>
            <circle cx={d / 2} cy={d / 2} r={r} fill={alpha(NUANCES.ivoire, 0.5)} stroke={alpha(NUANCES.sable, 0.55)} strokeWidth={ep} />
            <circle cx={d / 2} cy={d / 2} r={r} fill="none" stroke={`url(#${id})`} strokeWidth={ep} strokeLinecap="round" strokeDasharray={`${circ * remplissage} ${circ}`} transform={`rotate(-90 ${d / 2} ${d / 2})`} />
          </svg>
          <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", transform: `scale(${pop})` }}>
            <span style={{ ...titre(d * 0.5, NUANCES.encre, 0), fontVariantNumeric: "tabular-nums" }}>{valeur}</span>
          </div>
        </div>
        <div style={{ textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center", gap: h * 0.005 }}>
          <span style={{ ...texte(0.058 * W, NUANCES.encre), fontWeight: 800, whiteSpace: "nowrap" }}>{unite}</span>
          <span style={{ ...texte(0.054 * W, NUANCES.sableProfond), whiteSpace: "nowrap" }}>{precision}</span>
        </div>
      </div>
    </div>
  );
}

export function WidgetChiffre({ i, W = 1080, H = 1920, nombre = 20, unite = "heures", precision = "gagnées", iconeTitre = "horloge", compteA = 14, sortieA = 56 }: PropsWidgetChiffre) {
  if (i < 0 || i > sortieA + 10) return null;
  const w = 0.3 * W;
  const h = 0.3 * H;
  const x = 0.755 * W;
  const y = 0.19 * H;
  const entree = (j: number) => ressort("GLISSER", j * 0.9);
  const rot = ressort("PIVOT", i);
  // Sortie : 7 images, accélération (rien ne reste ensuite : 0,32 L + marge de flou).
  const sortie = (j: number) => courbe(j, sortieA, 7, Easing.in(Easing.cubic));
  const d0x = 0.42 * W;
  const d0y = -d0x * Math.tan(ANGLE);
  const pos = (j: number) => {
    const p = entree(j);
    return { x: lerp(d0x, 0, p) + 0.5 * W * sortie(j), y: lerp(d0y, 0, p) };
  };
  const p0 = pos(i);
  const k = i - 11; // la secousse part quand le widget s'arrête
  const calme = i > 16 && sortie(i) === 0;
  const flot = calme ? Math.sin((2 * Math.PI * i) / 60) * 0.004 * H : 0;
  const roulis = calme ? Math.sin((2 * Math.PI * i) / 60 + 0.8) * 1.5 : 0;
  const ry = lerp(30, 12, rot) + roulis;
  const vit = vitesse((j) => Math.hypot(pos(j).x, pos(j).y), i);
  const sx = Math.min(0.02 * W, vit * 0.15);
  const mise = 0.006 * W * (1 - courbe(i, 0, 4));
  const commun = { W, H, nombre, unite, precision, iconeTitre, compteA };
  return (
    <Flou sx={sx} mise={mise}>
      <Perspective W={W}>
        {[2, 1].map((g) => {
          // Copies fantômes (25 % puis 12 %) : suivent la position avec 1 puis 2 images de retard, pendant les 6 premières images.
          if (i > 6 || i - g < 0) return null;
          const pf = pos(i - g);
          return (
            <div key={g} style={{ position: "absolute", left: x, top: y, width: w, height: h, opacity: g === 1 ? 0.25 : 0.12, transform: `translate(${pf.x}px, ${pf.y}px) rotateY(${ry}deg)`, transformOrigin: "50% 50%" }}>
              <Corps {...commun} i={i - g} fantome />
            </div>
          );
        })}
        <div style={{ position: "absolute", left: x, top: y, width: w, height: h, transform: `translate(${p0.x + secousse(k, 0.006 * W)}px, ${p0.y + flot}px) rotateY(${ry}deg)`, transformOrigin: "50% 50%" }}>
          <Corps {...commun} i={i} />
          <div style={{ position: "absolute", inset: 0 }}>
            <ReflePassant i={i} i0={12} W={w} n={10} hauteur={h} force={0.55} />
            <ReflePassant i={i} i0={40} W={w} n={10} hauteur={h} force={0.45} />
          </div>
        </div>
      </Perspective>
    </Flou>
  );
}
