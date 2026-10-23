import React from "react";
/**
 * ÉLÉMENT 3 « TAMPON-DÉCHIRURE » (Lot 1 « Papier & collage », fiche § D ; coup de poing P4 « Tampon et déchirure »).
 *
 *  - Emplacement E7 (plein écran) : VISAGE COUVERT en entier de i-4 à i25 (coupe franche : aucune image à moitié).
 *    Il n'apparaît JAMAIS avant 10 s (c'est au réalisateur de le garantir, règle D9/D10).
 *  - Formes F7 + F9 + F10 : papier ivoire plein cadre avec grain de 6 % et fibres, 2 scotchs aux coins hauts, tampon à
 *    double contour orange (0,010 L et 0,004 L) avec texture d'encre (masque de bruit qui retire ≈ 18 % de l'encre),
 *    incliné de −12°, puis déchirure en dents de scie.
 *  - Chorégraphie P4 (images relatives à i0, 30 i/s) :
 *      i−4 coupe franche (papier) · i−3 et i−1 les 2 scotchs claquent (cascade de 2 i) · i0 → i3 le tampon claque
 *      (échelle 1,7 → 1, CLAQUER) · i3 → i8 six gouttes d'encre orange collent au papier et le papier SE SECOUE
 *      (A = 0,008 L, de i3 à i12) · i12 → i24 l'encre sèche (opacité 1 → 0,92) · i25 → i29 DÉCHIRURE : deux moitiés
 *      s'écartent à 0,12 L par image et pivotent de ±6° ; le visage est dégagé dès la 2e image (1 seule image
 *      partielle, sous la tolérance de 3).
 *  - Le mot est UN mot dit par Will (verdict, validation : « réglé », « fini »), capitales, 12 lettres au plus.
 *  - Bruitages : papier à i−4, tampon à i0, déchirure à i25 (3 sons à sourcer en CC0).
 */
import { POLICES, largeurTexte } from "../../charte";
import { C, FPS, Fibres, GrainPapier, Scotch, alea, bordVertical, easeIn3, entre, ressort, secousse, versPoints } from "./commun-lot1";

export const FICHE_TAMPON_DECHIRURE = Object.freeze({
  id: "tampon-dechirure",
  nom: "Tampon sur papier, puis déchirure",
  emplacement: "E7" as const,
  forme: "F7+F9+F10" as const,
  mouvement: "P4" as const,
  sortie: "déchirure" as const,
  visage: "couvert" as const,
  angle: -12,
  ouvertureAutorisee: false,
  dureeMin: 1,
  dureeMax: 1.3,
  quandUtiliser: "Un verdict, une validation (« réglé », « fini ») : jamais avant 10 s, un seul coup de poing de ce type par vidéo.",
  sons: [
    { a: -0.13, fichier: "papier (à sourcer, CC0)" },
    { a: 0, fichier: "tampon (à sourcer, CC0)" },
    { a: 0.83, fichier: "déchirure (à sourcer, CC0)" },
  ],
  instantsPlanche: [0, 2, 4, 8, 16, 26] as const,
});

export type TamponDechirureProps = {
  t: number;
  /** i0 : le tampon claque (s). Le papier est posé 4 images avant. */
  debut: number;
  largeurImage: number;
  hauteurImage: number;
  /** Mot DIT par Will (capitales, 12 lettres au plus). */
  mot: string;
};

/** Images (relatives à i0) où la déchirure démarre, et où tout est terminé. */
export const IMAGE_DECHIRURE = 25;
export const IMAGE_FIN_TAMPON = 31;

export function TamponDechirure(p: TamponDechirureProps) {
  const W = p.largeurImage;
  const H = p.hauteurImage;
  const k = (p.t - p.debut) * FPS;
  if (k < -4.01 || k >= IMAGE_FIN_TAMPON) return null;
  const mot = p.mot.toUpperCase();

  // Géométrie de la déchirure : ligne verticale en dents de scie (fixe).
  const rngT = alea(77);
  const ligne = bordVertical(rngT, -H * 0.02, H * 1.02, W * 0.5, W * 0.022, W);
  const demi = (cote: "g" | "d") => {
    const bord: [number, number][] = cote === "g" ? [[-W * 0.1, -H * 0.03], ...ligne, [-W * 0.1, H * 1.03]] : [[W * 1.1, -H * 0.03], ...ligne, [W * 1.1, H * 1.03]];
    return versPoints(bord);
  };

  const kk = k - IMAGE_DECHIRURE; // images depuis le début de la déchirure
  const dechire = kk >= 0;
  const d = dechire ? W * 0.16 * kk : 0;
  const rotD = dechire ? 6 * Math.min(1, kk / 4) : 0;

  // Secousse du papier (A = 0,008 L, de i3 à i12) : horizontale + une pointe verticale.
  const sx = secousse(k - 3, W * 0.008) * (k < 12 ? 1 : 0);
  const sy = secousse(k - 3.7, W * 0.004) * (k < 12 ? 1 : 0);

  const contenu = (id: string) => (
    <div style={{ position: "absolute", inset: 0, transform: `translate(${sx}px, ${sy}px)` }}>
      <Papier W={W} H={H} k={k} mot={mot} id={id} />
    </div>
  );

  if (!dechire) {
    return (
      <div style={{ position: "absolute", inset: 0, overflow: "hidden", pointerEvents: "none" }}>
        {contenu("a")}
      </div>
    );
  }
  return (
    <div style={{ position: "absolute", inset: 0, overflow: "hidden", pointerEvents: "none" }}>
      {/* Moitié gauche : sort vers la gauche en pivotant autour de son coin haut-gauche. */}
      <div style={{ position: "absolute", inset: 0, clipPath: `polygon(${demi("g").split(" ").map((s) => { const [x, y] = s.split(","); return `${x}px ${y}px`; }).join(", ")})`, transformOrigin: "0 0", transform: `translateX(${-d}px) rotate(${-rotD}deg)` }}>
        {contenu("g")}
      </div>
      <div style={{ position: "absolute", inset: 0, clipPath: `polygon(${demi("d").split(" ").map((s) => { const [x, y] = s.split(","); return `${x}px ${y}px`; }).join(", ")})`, transformOrigin: "100% 0", transform: `translateX(${d}px) rotate(${rotD}deg)` }}>
        {contenu("d")}
      </div>
    </div>
  );
}

/** Le papier complet (fond, grain, fibres, scotchs, tampon, gouttes). */
function Papier({ W, H, k, mot, id }: { W: number; H: number; k: number; mot: string; id: string }) {
  const rng = alea(5);
  // Tampon : dimensions selon le mot.
  const em = largeurTexte(mot, 100) / 100;
  const taille = Math.min(H * 0.16, (W * 0.63) / em);
  const sw = em * taille + W * 0.12;
  const sh = taille * 1.55;
  const cx = W * 0.5;
  const cy = H * 0.46;
  const echelle = 1 + 0.7 * (1 - ressort(k, "CLAQUER"));
  const seche = k >= 12 ? 1 - 0.08 * entre(k, 12, 24) : 1;
  const visible = k >= 0;
  const g1 = ressort(k + 3, "CLAQUER"); // scotch gauche à i-3
  const g2 = ressort(k + 1, "CLAQUER"); // scotch droit à i-1

  // Gouttes d'encre : jaillissent de i3 à i8 puis collent au papier (6 gouttes).
  const gouttes = Array.from({ length: 6 }, (_, i) => {
    const a = (i / 6) * Math.PI * 2 + rng() * 0.8;
    const dist = (0.2 + rng() * 0.14) * W * 0.5 + sw * 0.35;
    const rayon = W * (0.013 + rng() * 0.012);
    const vol = entre(k, 3, 8, (x) => 1 - Math.pow(1 - x, 3));
    return { x: cx + Math.cos(a) * dist * vol * 1.25, y: cy + Math.sin(a) * dist * vol * 0.8, r: rayon, a: vol };
  });

  return (
    <>
      {/* Papier plein cadre (légèrement plus grand que le cadre pour que la secousse ne montre pas de bord). */}
      <div style={{ position: "absolute", left: -W * 0.03, top: -H * 0.02, width: W * 1.06, height: H * 1.04, background: C.ivoire }} />
      <GrainPapier id={`gr-${id}`} largeur={W} hauteur={H} opacite={0.03} graine={9} />
      <Fibres largeur={W} hauteur={H} graine={21} nombre={150} couleur={C.sableClair} opacite={0.55} epaisseur={3} />
      {/* Liseré de lumière du papier : un filet sable aux 4 bords. */}
      <div style={{ position: "absolute", left: W * 0.025, top: H * 0.014, right: W * 0.025, bottom: H * 0.014, border: `2px solid ${C.sableClair}`, borderRadius: 6, opacity: 0.8 }} />
      {/* Scotchs aux coins hauts. */}
      <div style={{ position: "absolute", left: W * 0.085, top: H * 0.032, transform: `rotate(-38deg) scale(${1 + 0.7 * (1 - g1)})`, opacity: g1 > 0 ? Math.min(1, g1 * 3) : 0 }}>
        <Scotch l={W * 0.22} h={W * 0.06} graine={3} />
      </div>
      <div style={{ position: "absolute", left: W * 0.915, top: H * 0.032, transform: `rotate(38deg) scale(${1 + 0.7 * (1 - g2)})`, opacity: g2 > 0 ? Math.min(1, g2 * 3) : 0 }}>
        <Scotch l={W * 0.22} h={W * 0.06} graine={4} />
      </div>
      {visible && (
        <svg width={W} height={H} style={{ position: "absolute", left: 0, top: 0, overflow: "visible" }}>
          <defs>
            {/* Texture d'encre : le masque retire ≈ 18 % de l'encre en taches. */}
            <filter id={`bruit-${id}`} x="0" y="0" width="100%" height="100%" colorInterpolationFilters="sRGB">
              <feTurbulence type="fractalNoise" baseFrequency="0.035 0.05" numOctaves={3} seed={12} />
              <feColorMatrix type="matrix" values="-22 0 0 0 13.2  -22 0 0 0 13.2  -22 0 0 0 13.2  0 0 0 0 1" />
            </filter>
            <mask id={`encre-${id}`} maskUnits="userSpaceOnUse" x={-W} y={-H} width={W * 2} height={H * 2}>
              <rect x={-W} y={-H} width={W * 2} height={H * 2} fill="#fff" />
              <rect x={-W} y={-H} width={W * 2} height={H * 2} filter={`url(#bruit-${id})`} />
            </mask>
          </defs>
          <g opacity={seche}>
            <g transform={`translate(${cx} ${cy}) rotate(-12) scale(${echelle})`}>
              <g mask={`url(#encre-${id})`}>
                <rect x={-sw / 2} y={-sh / 2} width={sw} height={sh} rx={sh * 0.16} fill="none" stroke={C.orange} strokeWidth={W * 0.01} />
                <rect x={-sw / 2 + W * 0.018} y={-sh / 2 + W * 0.018} width={sw - W * 0.036} height={sh - W * 0.036} rx={sh * 0.12} fill="none" stroke={C.orange} strokeWidth={W * 0.004} />
                <text x={0} y={taille * 0.36} textAnchor="middle" fontFamily={POLICES.titre} fontSize={taille} fill={C.orange}>
                  {mot}
                </text>
              </g>
            </g>
          </g>
          {/* Gouttes d'encre orange collées au papier. */}
          {gouttes.map((g, i) =>
            g.a > 0 ? <ellipse key={i} cx={g.x} cy={g.y} rx={g.r * (1 + (1 - g.a) * 0.8)} ry={g.r * (1 - (1 - g.a) * 0.3)} fill={C.orange} opacity={seche} /> : null,
          )}
        </svg>
      )}
    </>
  );
}
