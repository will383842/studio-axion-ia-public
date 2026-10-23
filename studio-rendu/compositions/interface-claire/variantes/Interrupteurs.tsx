import React from "react";
/**
 * MAQUETTE « Interrupteurs » (designer n° 4, 15/10) — une checklist de critères (« vérifiez trois choses »).
 *
 * Panneau qui couvre TOUT le visage (aucune descente de la prise : le visage est entièrement caché, jamais à moitié).
 * 3 ou 4 lignes pleine largeur, hautes d'au moins 0,09 H ; chaque ligne porte un gros interrupteur (20 % de la largeur
 * de l'image) et le critère en gros. Ce n'est PAS la liste cochée : ici chaque bascule remplit une ligne ENTIÈRE.
 *  - N1 : le panneau entre par la droite, tous les interrupteurs sur OFF (sable) ;
 *  - N2 : sur chaque critère, son interrupteur bascule sur ON ; la ligne se remplit d'orange EN UNE IMAGE et le texte
 *    passe en ivoire ; à la fin, un grand voyant PRÊT s'allume (zone entière qui passe à l'encre) ;
 *  - N3 : les interrupteurs sur ON pulsent d'une petite lueur ivoire.
 * Chaque bascule change plus de 8 % de l'image d'un coup (ligne ≈ 0,9 L × 0,10 H).
 */
import { Img } from "remotion";
import { COULEURS, POLICES, largeurTexte } from "../charte";
import { mesures, styleBoite } from "../elements";
import { progression, rebond, sortie } from "../mouvement";

export type CritereInterrupteur = { texte: string; a: number };
export type DonneesInterrupteurs = {
  titre: string;
  debut: number;
  fin: number;
  criteres: CritereInterrupteur[];
  pret: { texte: string; a: number };
};

export const EXEMPLE_PHRASE_INTERRUPTEURS = "Vérifiez trois choses : vos tâches qui se répètent, vos outils et le temps de votre équipe.";

export const EXEMPLE_INTERRUPTEURS: DonneesInterrupteurs = {
  titre: "Vérifiez trois choses",
  debut: 0,
  fin: 5.4,
  criteres: [
    { texte: "Vos tâches qui se répètent", a: 1.35 }, // « tâches »
    { texte: "Vos outils", a: 2.5 }, // « outils »
    { texte: "Le temps de votre équipe", a: 3.6 }, // « équipe »
  ],
  pret: { texte: "Prêt", a: 4.3 },
};

export const EXEMPLE_SONS_INTERRUPTEURS = [
  { t: 0, son: "maximize_004" },
  ...EXEMPLE_INTERRUPTEURS.criteres.map((c) => ({ t: c.a, son: "click_002" })),
  { t: 4.3, son: "confirmation_002" },
];

export const IMAGE_FIXE_INTERRUPTEURS = 4.6;

export type ProprietesInterrupteurs = { t: number; donnees?: DonneesInterrupteurs; largeur?: number; hauteur?: number; prise?: string };

/** Emprise du panneau (fractions) : couvre tout le visage de la prise (cheveux 0,14 H → menton ≈ 0,52 H, 0,18 → 0,66 L). */
export const PANNEAU_INTERRUPTEURS = Object.freeze({ x0: 0.05, x1: 0.95, y0: 0.11, y1: 0.67 });

/** Lumière d'un rayon du voyant. */
function Rayons({ taille, p }: { taille: number; p: number }) {
  if (p <= 0 || p >= 1) return null;
  return (
    <svg width={taille * 2.2} height={taille * 2.2} viewBox="-110 -110 220 220" style={{ position: "absolute", left: -taille * 0.6, top: -taille * 0.6, overflow: "visible" }}>
      {Array.from({ length: 10 }, (_, i) => {
        const ang = (i / 10) * Math.PI * 2;
        const r0 = 58 + 40 * p;
        const r1 = r0 + 26 * (1 - p) + 8;
        return <line key={i} x1={Math.cos(ang) * r0} y1={Math.sin(ang) * r0} x2={Math.cos(ang) * r1} y2={Math.sin(ang) * r1} stroke={COULEURS.orange} strokeWidth={9} strokeLinecap="round" />;
      })}
    </svg>
  );
}

export function Interrupteurs({ t, donnees = EXEMPLE_INTERRUPTEURS, largeur = 1080, hauteur = 1920, prise }: ProprietesInterrupteurs) {
  const W = largeur;
  const H = hauteur;
  const d = donnees;
  const { contour, rayon } = mesures(W);
  const P = PANNEAU_INTERRUPTEURS;
  const lP = (P.x1 - P.x0) * W;
  const hP = (P.y1 - P.y0) * H;
  const visible = t >= d.debut && t < d.fin;
  const entree = rebond(t, d.debut, 0.18, 1.25);
  const s = sortie(t, d.fin - 0.12, 0.12);
  const dx = (1 - entree) * W * 1.05 - s * W * 1.1;
  const rot = 5 * (1 - entree) - 4 * s;

  const hEntete = H * 0.045;
  const marge = W * 0.026;
  const n = d.criteres.length;
  const hPret = H * 0.1;
  const ecart = H * 0.012;
  const hLigne = Math.max(H * 0.09, (hP - hEntete - 2 * contour - 2 * marge - hPret - n * ecart) / n);
  const lLigne = lP - 2 * contour - 2 * marge;
  const lInter = W * 0.2;
  const hInter = Math.min(hLigne * 0.62, lInter * 0.52);
  const lTexte = lLigne - lInter - marge * 3;

  const pretAllume = t >= d.pret.a;
  const pPret = rebond(t, d.pret.a, 0.16, 1.8);

  return (
    <div style={{ position: "absolute", inset: 0, width: W, height: H, overflow: "hidden", background: COULEURS.ivoire }}>
      {prise ? <Img src={prise} style={{ position: "absolute", left: 0, top: 0, width: W, height: H, objectFit: "cover" }} /> : <div style={{ position: "absolute", inset: 0, background: COULEURS.sable }} />}
      {visible ? (
        <div style={{ position: "absolute", left: P.x0 * W, top: P.y0 * H, width: lP, height: hP, transform: `translateX(${dx}px) rotate(${rot}deg)`, ...styleBoite(W, COULEURS.ivoire), overflow: "hidden", display: "flex", flexDirection: "column" }}>
          {/* En-tête */}
          <div style={{ height: hEntete, flexShrink: 0, background: COULEURS.orange, borderBottom: `${contour}px solid ${COULEURS.encre}`, display: "flex", alignItems: "center", padding: `0 ${marge}px`, gap: marge * 0.6 }}>
            <span style={{ fontFamily: POLICES.titre, fontSize: hEntete * 0.52, color: COULEURS.ivoire, flex: 1, whiteSpace: "nowrap" }}>{d.titre}</span>
            <span style={{ fontFamily: POLICES.titre, fontSize: hEntete * 0.46, color: COULEURS.ivoire, background: COULEURS.encre, borderRadius: 10, padding: `2px ${hEntete * 0.22}px` }}>
              {d.criteres.filter((c) => t >= c.a).length}/{n}
            </span>
          </div>
          <div style={{ flex: 1, padding: marge, display: "flex", flexDirection: "column", gap: ecart }}>
            {d.criteres.map((c, i) => {
              const on = t >= c.a;
              const bascule = rebond(t, c.a, 0.1, 1.6);
              const plein = t >= c.a + 1 / 30;
              const pop = plein && t < c.a + 0.15 ? 1.035 : 1;
              const lueur = on ? 0.5 + 0.5 * Math.sin((t - c.a) * Math.PI * 2 * 1.4) : 0;
              const taille = Math.min(H * 0.034, (2 * lTexte * 0.92) / Math.max(1, largeurTexte(c.texte, 1) * 0.88));
              const jeu = hInter * 0.06;
              const bouton = hInter - 2 * contour - 2 * jeu;
              const course = lInter - 2 * contour - 2 * jeu - bouton;
              return (
                <div key={i} style={{ position: "relative", height: hLigne, flexShrink: 0, transform: `scale(${pop})`, ...styleBoite(W, plein ? COULEURS.orange : COULEURS.ivoire, rayon * 1.2), display: "flex", alignItems: "center", gap: marge, padding: `0 ${marge}px` }}>
                  {/* Interrupteur */}
                  <div style={{ position: "relative", width: lInter, height: hInter, flexShrink: 0, borderRadius: hInter / 2, background: on ? COULEURS.encre : COULEURS.sable, border: `${contour}px solid ${COULEURS.encre}`, boxSizing: "border-box", boxShadow: on ? `0 0 ${W * (0.01 + 0.014 * lueur)}px ${W * 0.004 * lueur}px ${COULEURS.ivoire}` : "none" }}>
                    <span style={{ position: "absolute", top: "50%", transform: "translateY(-50%)", left: on ? hInter * 0.32 : undefined, right: on ? undefined : hInter * 0.28, fontFamily: POLICES.titre, fontSize: hInter * 0.3, color: on ? COULEURS.ivoire : COULEURS.encre }}>{on ? "ON" : "OFF"}</span>
                    <div style={{ position: "absolute", top: jeu, left: jeu + course * (on ? bascule : 0), width: bouton, height: bouton, borderRadius: "50%", background: on ? COULEURS.orange : COULEURS.ivoire, border: `${contour}px solid ${COULEURS.encre}`, boxSizing: "border-box", boxShadow: on ? `0 0 0 ${W * 0.005 * lueur}px ${COULEURS.ivoire}` : "none" }} />
                  </div>
                  <span style={{ width: lTexte, fontFamily: POLICES.titre, fontSize: taille, lineHeight: 1.04, color: plein ? COULEURS.ivoire : COULEURS.encre }}>{c.texte}</span>
                </div>
              );
            })}
            {/* Voyant PRÊT */}
            <div style={{ position: "relative", marginTop: "auto", height: hPret, flexShrink: 0, ...styleBoite(W, pretAllume ? COULEURS.encre : COULEURS.ivoire, rayon * 1.2), borderStyle: pretAllume ? "solid" : "dashed", boxShadow: pretAllume ? `${mesures(W).ombre}px ${mesures(W).ombre}px 0 ${COULEURS.orange}` : "none", display: "flex", alignItems: "center", justifyContent: "center", gap: marge * 1.2 }}>
              <div style={{ position: "relative", width: hPret * 0.68, height: hPret * 0.68, transform: `scale(${pretAllume ? 0.6 + 0.4 * pPret : 1})` }}>
                <Rayons taille={hPret * 0.68} p={progression(t, d.pret.a, 0.35)} />
                <div style={{ position: "absolute", inset: 0, borderRadius: "50%", background: pretAllume ? COULEURS.orange : COULEURS.sable, border: `${contour}px solid ${pretAllume ? COULEURS.ivoire : COULEURS.encre}`, boxSizing: "border-box", boxShadow: pretAllume ? `0 0 ${W * 0.03}px ${W * 0.008}px ${COULEURS.orange}` : "none" }}>
                  <div style={{ position: "absolute", left: "22%", top: "18%", width: "26%", height: "22%", borderRadius: "50%", background: COULEURS.ivoire, opacity: pretAllume ? 0.9 : 0.4 }} />
                </div>
              </div>
              <span style={{ fontFamily: POLICES.titre, fontSize: hPret * 0.52, color: pretAllume ? COULEURS.ivoire : COULEURS.sable, textTransform: "uppercase", letterSpacing: 4, transform: `scale(${pretAllume ? 1.25 - 0.25 * pPret : 1})` }}>{d.pret.texte}</span>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
