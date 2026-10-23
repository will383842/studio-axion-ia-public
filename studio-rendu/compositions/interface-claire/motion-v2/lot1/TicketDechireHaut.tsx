import React from "react";
/**
 * ÉLÉMENT 5 « TICKET-DÉCHIRÉ-HAUT » (Lot 1 « Papier & collage », standard DA v2, fiche § D).
 *
 *  - REFONDU (critique du 16/10) : bande de papier ORANGE de 0,70 L (x 0,03 → 0,73), inclinée de −5°, posée SUR la prise
 *    (y 0,02 → 0,105 H), 4 bords déchirés (0,012 L), mot IVOIRE, scotch de travers à +20° sur le bout droit. Plus de
 *    bandeau pleine largeur ni de descente de la prise.
 *  - (ancienne fiche) Emplacement E1 (haut) : bande de 0,02 à ≈ 0,087 H (bord déchiré compris), pendue au bord haut ; le bas déchiré reste
 *    à plus de 0,015 H au-dessus de la zone Z (même incliné de −3° et balancé de ±2°) : aucune descente de la prise n'est
 *    nécessaire et le visage reste entier.
 *  - Forme F10 : bande de papier ivoire à bord bas déchiré (dents de 0,006 à 0,018 L) et liseré de fibres, mot encre
 *    incliné de −3° (toute la bande l'est), grain de papier, ombre dure vers le bas ; une chute de papier sable
 *    dépasse dessous à gauche (collage à 2 couches) ; un trait de feutre orange souligne le mot (tracé).
 *  - Mouvement M10 : dépliage depuis le haut (échelle verticale 0 → 1, ressort POSER, la chute sable 2 images plus tard),
 *    puis M9 : balancier de ±2° amorti, puis micro-vie ±1° (1,6 s).
 *  - Sortie : REPLI vers le haut (anticipation 2 i à 103 %, puis échelle verticale 1 → 0 en 5 images).
 *  - Visage : ENTIER. Quand : un titre de séquence ou une question (« le problème »). Mot(s) = DITS (12 lettres environ).
 */
import { POLICES, largeurTexte } from "../../charte";
import { C, Fibres, FPS, GrainPapier, Scotch, alea, bordHorizontal, bordVertical, easeIn3, entre, ressort, versPoints } from "./commun-lot1";

export const FICHE_TICKET_DECHIRE_HAUT = Object.freeze({
  id: "ticket-dechire-haut",
  nom: "Bande de papier déchirée en haut du cadre",
  emplacement: "E1" as const,
  forme: "F10" as const,
  mouvement: "M10+M9" as const,
  sortie: "repli" as const,
  visage: "entier" as const,
  angle: -5,
  ouvertureAutorisee: true,
  dureeMin: 1.5,
  dureeMax: 3,
  quandUtiliser: "Un titre de séquence ou une question (« le problème »). Le texte affiché est DIT par Will.",
  sons: [{ a: 0, fichier: "déchirure courte (à sourcer, CC0)" }],
  instantsPlanche: [0, 2, 4, 8, 20, "sortie"] as const,
});

export type TicketDechireHautProps = {
  t: number;
  debut: number;
  fin: number;
  largeurImage: number;
  hauteurImage: number;
  /** Titre DIT par Will (capitales). */
  mot: string;
};

export const IMAGES_SORTIE_TICKET = 7;

export function TicketDechireHaut(p: TicketDechireHautProps) {
  const { t, debut, fin } = p;
  const W = p.largeurImage;
  const H = p.hauteurImage;
  const k = (t - debut) * FPS;
  const kSortie = (t - fin) * FPS;
  if (k < 0 || kSortie >= IMAGES_SORTIE_TICKET) return null;
  const mot = p.mot.toUpperCase();

  const top = H * 0.012;
  const hBande = H * 0.08;
  const x0 = W * 0.03;
  const x1 = W * 0.73;
  const cxB = (x0 + x1) / 2;
  const cyB = top + hBande / 2;

  // Dépliage depuis le haut (POSER) ; la chute sable 2 images plus tard.
  const plie = Math.max(0, ressort(k, "POSER"));
  const plieSable = Math.max(0, ressort(k - 2, "POSER"));
  let echV = plie;
  if (kSortie > 0) {
    const ant = entre(kSortie, 0, 2);
    const rep = easeIn3(entre(kSortie, 2, IMAGES_SORTIE_TICKET));
    echV = (1 + 0.03 * ant) * (1 - rep);
  }

  // Balancier amorti de ±2,5° autour de −5°, puis micro-vie ±1°.
  const theta = -5 + 2.5 * Math.exp(-(k - 5) / 9) * Math.cos((2 * Math.PI * (k - 5)) / 28) * (k > 5 ? 1 : 0) + Math.sin((2 * Math.PI * k) / 48) * 1 * entre(k, 24, 34);

  // Bande : 4 bords déchirés (amplitude 0,012 L).
  const amp = W * 0.012;
  const rng = alea(91);
  const haut = bordHorizontal(rng, x0, x1, top, amp, W);
  const droite = bordVertical(rng, top, top + hBande, x1, amp, W);
  const bas = bordHorizontal(rng, x1, x0, top + hBande, amp, W);
  const gauche = bordVertical(rng, top + hBande, top, x0, amp, W);
  const poly: [number, number][] = [...haut, ...droite.slice(1), ...bas.slice(1), ...gauche.slice(1)];
  // Chute sable dessous (collage à 2 couches), décalée vers le bas-gauche.
  const rngS = alea(17);
  const hautS = bordHorizontal(rngS, x0 - W * 0.012, W * 0.42, top + H * 0.006, amp, W);
  const basS = bordHorizontal(rngS, W * 0.42, x0 - W * 0.012, top + hBande + H * 0.008, amp * 1.2, W);
  const polyS: [number, number][] = [...hautS, ...basS];

  const dispo = (x1 - x0) * 0.9;
  const taille = Math.min(hBande * 0.5, dispo / (largeurTexte(mot, 100) / 100));
  const trait = entre(k, 10, 16, (x) => 1 - Math.pow(1 - x, 3));
  const ombre = W * 0.0065;
  const tScotch = ressort(k - 4, "CLAQUER");

  return (
    <div style={{ position: "absolute", inset: 0, overflow: "hidden", pointerEvents: "none" }}>
      <div style={{ position: "absolute", left: 0, top: 0, width: W, height: H, transformOrigin: `${cxB}px ${cyB}px`, transform: `rotate(${theta}deg)` }}>
        <div style={{ position: "absolute", left: 0, top: 0, width: W, height: H, transformOrigin: `0 ${top}px`, transform: `scaleY(${plieSable * (kSortie > 0 ? echV : 1)})` }}>
          <svg width={W} height={H} style={{ position: "absolute", left: 0, top: 0, overflow: "visible" }}>
            <polygon points={versPoints(polyS)} transform={`translate(${ombre} ${ombre})`} fill={C.encre} opacity={0.9} />
            <polygon points={versPoints(polyS)} fill={C.sableClair} stroke={C.ivoire} strokeWidth={2} strokeOpacity={0.7} strokeLinejoin="round" />
          </svg>
        </div>
        <div style={{ position: "absolute", left: 0, top: 0, width: W, height: H, transformOrigin: `0 ${top}px`, transform: `scaleY(${echV})` }}>
          <svg width={W} height={H} style={{ position: "absolute", left: 0, top: 0, overflow: "visible" }}>
            <polygon points={versPoints(poly)} transform={`translate(${ombre * 0.5} ${ombre})`} fill={C.encre} />
            <polygon points={versPoints(poly)} fill={C.orange} stroke={C.orange} strokeWidth={3} strokeLinejoin="round" />
          </svg>
          <div style={{ position: "absolute", left: 0, top: 0, width: W, height: H, clipPath: `polygon(${poly.map(([x, y]) => `${x.toFixed(1)}px ${y.toFixed(1)}px`).join(", ")})` }}>
            <GrainPapier id="gr-ticket" largeur={W} hauteur={H} opacite={0.05} graine={14} />
            <Fibres largeur={W} hauteur={H} graine={44} nombre={60} couleur={C.orangeProfond} opacite={0.5} epaisseur={3} />
          </div>
          <div
            style={{
              position: "absolute",
              left: x0,
              top,
              width: x1 - x0,
              height: hBande * 0.9,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontFamily: POLICES.titre,
              fontSize: taille,
              lineHeight: 1,
              color: C.ivoire,
              whiteSpace: "nowrap",
            }}
          >
            {mot}
          </div>
          {/* Trait de feutre encre sous le mot (tracé). */}
          {trait > 0 && (
            <svg width={W} height={H} style={{ position: "absolute", left: 0, top: 0, overflow: "visible" }}>
              <path
                d={`M${cxB - (largeurTexte(mot, taille) / 2) * 0.96} ${top + hBande * 0.82} q${W * 0.1} ${-hBande * 0.07} ${largeurTexte(mot, taille) * 0.5} ${hBande * 0.01} t${largeurTexte(mot, taille) * 0.46} ${-hBande * 0.015}`}
                fill="none"
                stroke={C.encre}
                strokeWidth={W * 0.0085}
                strokeLinecap="round"
                pathLength={1}
                strokeDasharray={1}
                strokeDashoffset={1 - trait}
              />
            </svg>
          )}
          {/* Scotch de travers (+20°) sur le bout droit. */}
          <div style={{ position: "absolute", left: x1 - W * 0.02, top: top + hBande * 0.1, transform: `rotate(20deg) scale(${1 + 0.4 * (1 - tScotch)})`, opacity: tScotch > 0 ? Math.min(1, tScotch * 3) : 0 }}>
            <Scotch l={W * 0.14} h={W * 0.04} graine={6} />
          </div>
        </div>
      </div>
    </div>
  );
}
