import React from "react";
/**
 * n° 11 `carte-preuve` (lot C, standard v3 § G) : une fenêtre de navigateur en verre posée SUR le visage (x 0,05-0,86,
 * y 0,10-0,70) qui montre une capture d'écran ANIMÉE — l'en-tête de la page reste FIXE, la liste défile SOUS lui, un
 * curseur vient cliquer sur la ligne citée, un anneau orange s'étend (8 images) et un surlignage orange balaie la ligne.
 *
 * Entrée N1 miroir (depuis la gauche) : translateX -1,0 L → 0 (VERRE, temps ×1,25 pour traverser le visage vite), rotateY
 * 38° → 0 (PIVOT), rotateZ → +2,5°, flou directionnel de 0,02 L et mise au point de 0,008 L. Sortie : fouet vers la droite
 * (FOUET, rotateY -25°). Vie après pose : flottement, léger roulis, reflet qui passe deux fois.
 * La capture réelle de la page se passe dans `capture` (image, défile sous l'en-tête) ; sans elle, une page de démonstration est dessinée.
 * Textes : tous ≥ 52 px à 1080 de large.
 */
import { Img } from "remotion";
import { Icone } from "../../elements";
import { alpha, borne01, courbe, Flou, lerp, NUANCES, Perspective, PropsElement, ReflePassant, ressort, SonElement, styleOrange, styleVerre, texte, titre, vitesse } from "./commun-lotC";

export type PropsCartePreuve = PropsElement & {
  /** Adresse affichée dans la barre. */
  adresse?: string;
  /** Titre fixe de la page. */
  titrePage?: string;
  /** Capture d'écran réelle (chemin `staticFile` ou URL) ; sinon page de démonstration. */
  capture?: string;
  /** Lignes de la page de démonstration et index de la ligne citée (surlignée au clic). */
  lignes?: { texte: string; icone: string }[];
  cible?: number;
  /** Image du clic et de la sortie. */
  clicA?: number;
  sortieA?: number;
  etiquette?: string;
};

const LIGNES = [
  { texte: "Devis envoyé", icone: "document" },
  { texte: "Silence du client", icone: "horloge" },
  { texte: "Relance prête", icone: "eclair" },
  { texte: "Message adapté", icone: "mail" },
  { texte: "Relance envoyée", icone: "coche" },
  { texte: "Le client répond", icone: "utilisateur" },
  { texte: "Rendez-vous calé", icone: "calendrier" },
  { texte: "Facture envoyée", icone: "envoyer" },
];

export const SONS_CARTE_PREUVE = (clicA = 34, sortieA = 72): readonly SonElement[] => [
  [0, "whoosh-in", 0.7],
  [clicA, "click_002", 0.8],
  [sortieA, "whoosh-out", 0.6],
];

const TEMPS_ENTREE = 1.25;

export function CartePreuve({ i, W = 1080, H = 1920, adresse = "votre-site.fr", titrePage = "Suivi des devis", capture, lignes = LIGNES, cible = 4, clicA = 34, sortieA = 72, etiquette = "La preuve" }: PropsCartePreuve) {
  if (i < 0 || i > sortieA + 12) return null;
  const x = 0.05 * W;
  const l = 0.81 * W;
  const y = 0.1 * H;
  const h = 0.6 * H;
  const rayon = 0.045 * W;
  const barreH = 0.06 * H;
  const enteteH = 0.07 * H;
  const entree = (j: number) => ressort("VERRE", j * TEMPS_ENTREE);
  const sortie = (j: number) => ressort("FOUET", j - sortieA);
  const pe = entree(i);
  const ps = sortie(i);
  const rot = ressort("PIVOT", i);
  const dx = lerp(-1.0 * W, 0, pe) + 1.0 * W * ps;
  const ry = lerp(38, 0, rot) - 25 * ps;
  const calme = i > 14 && ps === 0;
  const rz = lerp(7, 2.5, rot) + (calme ? Math.sin((2 * Math.PI * i) / 60) * 0.5 : 0);
  const vit = Math.max(vitesse((j) => lerp(1.0 * W, 0, entree(j)), i), vitesse((j) => W * sortie(j), i));
  const sx = Math.min(0.022 * W, vit * 0.2);
  const mise = 0.008 * W * (1 - courbe(i, 0, 4));
  const flot = calme ? Math.sin((2 * Math.PI * i) / 60) * 0.004 * H : 0;

  // Géométrie de la liste (px, repère de la zone défilante).
  const zoneH = h - barreH - enteteH;
  const rowH = 0.062 * H;
  const gap = 0.01 * H;
  const pasLigne = rowH + gap;
  const tTexte = 0.052 * W;
  const yCible = 0.012 * H + cible * pasLigne;
  const defilement = lerp(0, Math.max(0, yCible - zoneH * 0.32), courbe(i, 6, 28, (t) => 1 - Math.pow(1 - t, 2.2)));
  const cibleEcranY = barreH + enteteH + yCible + rowH / 2 - defilement; // repère de la fenêtre
  // Curseur : arrive du bas-droite, courbe douce vers la ligne citée, clique à `clicA`.
  const pc = courbe(i, 12, clicA - 12, (t) => 1 - Math.pow(1 - t, 3));
  const cx = lerp(l * 0.9, l * 0.55, pc);
  const cy = lerp(h * 0.95, cibleEcranY, pc) - Math.sin(Math.PI * pc) * h * 0.04;
  const appuye = i >= clicA && i < clicA + 4;
  const anneau = courbe(i, clicA, 8);
  const surlign = courbe(i, clicA + 1, 10, (t) => t * t * (3 - 2 * t));
  const chipE = ressort("JAILLIR", i - 6);
  const chipDx = dx * 1.35 - dx; // parallaxe P2 : la puce « arrive après » et dépasse légèrement la fenêtre
  const curseur = 0.09 * W;
  return (
    <Flou sx={sx} mise={mise}>
      <Perspective W={W}>
        <div style={{ position: "absolute", left: x, top: y, width: l, height: h, transform: `translateX(${dx}px) translateY(${flot}px) rotateY(${ry}deg) rotateZ(${rz}deg)`, transformOrigin: "50% 50%" }}>
          <div style={{ position: "absolute", inset: 0, ...styleVerre(W, rayon, { opacite: 0.92 }), overflow: "hidden", display: "flex", flexDirection: "column" }}>
            {/* Barre de navigateur en verre : 3 pastilles orange et sable, barre d'adresse en verre. */}
            <div style={{ height: barreH, flexShrink: 0, display: "flex", alignItems: "center", gap: barreH * 0.14, padding: `0 ${barreH * 0.3}px`, background: `linear-gradient(180deg, ${alpha(NUANCES.ivoire, 1)} 0%, ${alpha(NUANCES.ivoireCreux, 0.95)} 100%)`, boxShadow: `0 1px 0 ${alpha(NUANCES.sableProfond, 0.3)}` }}>
              {[NUANCES.orange, NUANCES.sable, NUANCES.sable].map((c, k) => (
                <div key={k} style={{ width: barreH * 0.2, height: barreH * 0.2, borderRadius: "50%", background: c, boxShadow: `inset 0 1px 0 ${alpha(NUANCES.ivoire, 0.45)}, 0 1px 2px ${alpha(NUANCES.encre, 0.25)}` }} />
              ))}
              <div style={{ flex: 1, marginLeft: barreH * 0.14, height: barreH * 0.74, borderRadius: barreH * 0.37, background: alpha(NUANCES.sableClair, 0.55), boxShadow: `inset 0 2px 4px ${alpha(NUANCES.encre, 0.1)}`, display: "flex", alignItems: "center", gap: barreH * 0.14, padding: `0 ${barreH * 0.24}px` }}>
                <Icone nom="cadenas" taille={0.05 * W} couleur={NUANCES.sableProfond} epaisseur={2.6} />
                <span style={{ ...texte(0.05 * W, NUANCES.encreDouce), whiteSpace: "nowrap" }}>{adresse}</span>
              </div>
            </div>
            {/* En-tête de page FIXE : le contenu défile dessous. */}
            <div style={{ height: enteteH, flexShrink: 0, ...styleOrange(W, 0, 0.3), display: "flex", alignItems: "center", gap: enteteH * 0.2, padding: `0 ${enteteH * 0.34}px`, zIndex: 2 }}>
              <Icone nom="tableur" taille={0.06 * W} couleur={NUANCES.ivoire} epaisseur={2.6} />
              <span style={{ ...titre(0.05 * W, NUANCES.ivoire, 0.03), whiteSpace: "nowrap" }}>{titrePage}</span>
            </div>
            {/* Zone défilante : une capture réelle ou la page de démonstration. */}
            <div style={{ position: "relative", flex: 1, overflow: "hidden", background: `linear-gradient(180deg, ${NUANCES.ivoire} 0%, ${NUANCES.ivoireCreux} 100%)` }}>
              <div style={{ position: "absolute", left: 0, top: 0, width: l, transform: `translateY(${-defilement}px)` }}>
                {capture ? (
                  <Img src={capture} style={{ width: "100%", display: "block" }} />
                ) : (
                  <div style={{ position: "relative", width: l, paddingTop: 0.012 * H, display: "flex", flexDirection: "column", gap, alignItems: "center" }}>
                    {lignes.map((r, k) => {
                      const estCible = k === cible;
                      return (
                        <div key={k} style={{ position: "relative", width: l * 0.92, height: rowH, borderRadius: rowH * 0.3, background: alpha(NUANCES.sableClair, 0.45), boxShadow: `inset 0 1px 0 ${alpha(NUANCES.ivoire, 0.7)}, 0 ${0.003 * W}px ${0.008 * W}px ${alpha(NUANCES.encre, 0.08)}`, display: "flex", alignItems: "center", gap: rowH * 0.24, padding: `0 ${rowH * 0.3}px`, overflow: "hidden" }}>
                          {estCible ? (
                            <div style={{ position: "absolute", inset: 0, background: `linear-gradient(90deg, ${alpha(NUANCES.orange, 0.38)}, ${alpha(NUANCES.orangeChaud, 0.26)})`, clipPath: `inset(0 ${(1 - surlign) * 100}% 0 0)`, boxShadow: `inset 0 0 0 ${Math.max(2, 0.003 * W)}px ${alpha(NUANCES.orange, 0.6 * surlign)}` }} />
                          ) : null}
                          <Icone nom={r.icone} taille={rowH * 0.5} couleur={estCible ? NUANCES.orange : NUANCES.sableProfond} epaisseur={2.8} />
                          <span style={{ ...texte(tTexte, NUANCES.encre), position: "relative", whiteSpace: "nowrap" }}>{r.texte}</span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
              {/* Anneau orange du clic, qui s'étend en 8 images (0,04 L de rayon). */}
              {anneau > 0 && anneau < 1 ? <div style={{ position: "absolute", left: cx - 0.04 * W * anneau, top: cy - barreH - enteteH - 0.04 * W * anneau, width: 0.08 * W * anneau, height: 0.08 * W * anneau, borderRadius: "50%", border: `${Math.max(3, 0.007 * W * (1 - anneau))}px solid ${alpha(NUANCES.orange, 1 - anneau * 0.85)}`, boxSizing: "border-box" }} /> : null}
              {/* Curseur : flèche d'encre à liseré ivoire (0,09 L), légèrement écrasée au clic. */}
              {i >= 12 ? (
                <svg width={curseur} height={curseur * 1.15} viewBox="0 0 24 28" style={{ position: "absolute", left: cx, top: cy - barreH - enteteH, overflow: "visible", transform: `scale(${appuye ? 0.86 : 1})`, transformOrigin: "0 0", filter: `drop-shadow(0 ${0.004 * W}px ${0.006 * W}px ${alpha(NUANCES.encre, 0.35)})`, opacity: borne01((i - 12) / 3) }}>
                  <path d="M2 2 L2 22 L7.5 17.2 L11 25.5 L14.6 24 L11.2 15.8 L18.5 15.6 Z" fill={NUANCES.encre} stroke={NUANCES.ivoire} strokeWidth={1.8} strokeLinejoin="round" />
                </svg>
              ) : null}
              <div style={{ position: "absolute", inset: 0, pointerEvents: "none", background: `radial-gradient(ellipse at 50% 50%, transparent 62%, ${alpha(NUANCES.encre, 0.1)} 100%)` }} />
            </div>
            <ReflePassant i={i} i0={14} W={l} n={10} hauteur={h} force={0.5} />
            <ReflePassant i={i} i0={52} W={l} n={10} hauteur={h} force={0.45} />
          </div>
          {/* Puce-étiquette (plan P2, ×1,35) qui chevauche le bord bas-gauche de 0,03 L. */}
          {i >= 6 ? (
            <div
              style={{
                position: "absolute",
                left: -0.012 * W,
                top: h - 0.07 * W - 0.03 * W,
                ...styleOrange(W, 0.05 * W, 1.3),
                padding: `${0.014 * W}px ${0.03 * W}px`,
                display: "flex",
                alignItems: "center",
                gap: 0.016 * W,
                transform: `translateX(${chipDx}px) rotate(-3deg) scale(${0.4 + 0.6 * chipE})`,
                transformOrigin: "0% 50%",
                opacity: borne01((i - 6) / 2),
                boxShadow: `inset 0 2px 0 ${alpha(NUANCES.ivoire, 0.35)}, 0 ${0.012 * W}px ${0.03 * W}px ${alpha(NUANCES.encre, 0.35)}`,
              }}
            >
              <Icone nom="loupe" taille={0.05 * W} couleur={NUANCES.ivoire} epaisseur={2.8} />
              <span style={{ ...titre(0.05 * W, NUANCES.ivoire), whiteSpace: "nowrap" }}>{etiquette}</span>
            </div>
          ) : null}
        </div>
      </Perspective>
    </Flou>
  );
}
