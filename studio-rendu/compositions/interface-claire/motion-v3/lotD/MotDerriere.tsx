/**
 * ÉLÉMENT 17 — « MOT DERRIÈRE WILL » (v3, lot D ; standard § G ligne 17, § B.3 « texte derrière la personne »).
 *
 * Quand : un mot DIT par Will, de 8 lettres au plus. Le mot est posé ENTRE le mur et Will : la tête passe devant les lettres.
 * Visage : ENTIER (le mot est derrière ; aucun pixel ne couvre le visage).
 *
 * DÉTOURAGE. Le composant reçoit :
 *  - `priseNode` : la prise (image ou vidéo) telle que le rendu la pose déjà sous l'élément ;
 *  - `masque`    : URL d'une image PNG dont le canal alpha découpe Will (même taille que l'image).
 * Il dessine le mot AU-DESSUS de la prise, puis repose la prise détourée PAR-DESSUS le mot. Sans `masque` (détourage non
 * disponible ou bords ratés : « Effet non réussi »), le mot passe AU-DESSUS de la tête, sans chevauchement (repli du standard § K).
 * En production le masque vient de la route `/segmenter` du studio-aligneur (MediaPipe + plaque vide), image par image sur les
 * SEULES secondes de l'effet (`demandeSegmentation`, monteur/detourage.ts). Pour cet extrait, le masque est un GrabCut (OpenCV)
 * de l'image fixe de la prise commune : la tête de Will est fixe sur cette image.
 *
 * Chorégraphie (30 i/s, i0 = mot dit) :
 *  - i0 → i(n−1) : les lettres MONTENT une à une depuis le bas du mot (1 image par lettre, `JAILLIR`), à travers une ligne de découpe
 *                  posée à la base du mot ; mise au point (flou 0,008 L → 0 en 4 i) ;
 *  - ensuite     : défilement lent de 0,15 % L par image (le mot glisse vers la droite), jamais immobile ;
 *  - sortie      : les lettres RETOMBENT en cascade (1 image par lettre, `Easing.in`) derrière la ligne de découpe.
 * Matière : Montserrat ExtraBold en `degradeOrange` (clair en haut), reflet de bord, relief léger (3 extrusions vers le bas et la
 * gauche, plus sombres), et ombre douce PORTÉE SUR LE MUR (décalée vers le bas et la gauche). Profondeur (V6) : occlusion par Will,
 * ombre portée sur le mur, mise au point, parallaxe du défilement.
 * Ressort : `JAILLIR`. Bruitage : `whoosh-in` grave (lecture à 0,7 ; « à sourcer » en CC0 : on ralentit le fichier existant).
 */
import React from "react";
import { avancesLettres, courbe, entrant, FPS, lin, N3, POLICES, rs, usePolicesD } from "./communD";
import type { FicheLot3, SonD } from "./communD";

export const ID_MOT_DERRIERE = "mot-derriere";
export const DUREE_MOT_DERRIERE = Object.freeze({ min: 1.5, max: 2.5 });
export const SONS_MOT_DERRIERE: readonly SonD[] = [{ k: 0, fichier: "whoosh-in", volume: 0.85, rate: 0.7 }];

export const FICHE_MOT_DERRIERE: FicheLot3 = Object.freeze({
  id: ID_MOT_DERRIERE,
  numero: 17,
  nom: "Mot derrière Will",
  emplacement: "Derrière la tête : mot de 0,9 à 1,0 L, juste au-dessus et derrière les cheveux (le bas des lettres centrales est masqué par la tête)",
  forme: "Montserrat ExtraBold, dégradé orange, relief léger, ombre portée sur le mur",
  mouvement: "montée lettre par lettre (1 i, JAILLIR) → défilement 0,15 % L/i → chute en cascade",
  sortie: "chute en cascade",
  visage: "entier" as const,
  ouvertureAutorisee: false,
  dureeMin: DUREE_MOT_DERRIERE.min,
  dureeMax: DUREE_MOT_DERRIERE.max,
  quandUtiliser: "Un mot dit, 8 lettres au plus. Besoin d'un détourage de Will (repli : mot au-dessus de la tête).",
  sons: SONS_MOT_DERRIERE,
});

export type MotDerriereProps = {
  t: number;
  debut: number;
  fin: number;
  largeurImage: number;
  hauteurImage: number;
  /** Mot DIT par Will, 8 lettres au plus. */
  mot: string;
  /** Prise (image ou vidéo) à reposer par-dessus le mot, détourée. */
  priseNode?: React.ReactNode;
  /** URL du PNG de détourage de Will (canal alpha). Absent : repli « mot au-dessus de la tête ». */
  masque?: string;
  /** Bas des lettres (fraction de H). Défaut : 0,182 H avec détourage, 0,12 H sans. */
  basLettres?: number;
};

export function MotDerriere(p: MotDerriereProps) {
  usePolicesD();
  const { t, debut, fin } = p;
  const W = p.largeurImage;
  const H = p.hauteurImage;
  if (t < debut || t >= fin) return null;
  const k = (t - debut) * FPS;
  const kFin = (fin - debut) * FPS;
  const mot = p.mot.toUpperCase().slice(0, 8);
  const detoure = !!p.masque && !!p.priseNode;

  const adv1 = avancesLettres(mot, 100);
  const em = adv1.reduce((a, b) => a + b, 0) / 100;
  const taille = Math.min((0.8 * W) / em, 0.34 * W);
  const adv = avancesLettres(mot, taille);
  const total = adv.reduce((a, b) => a + b, 0);
  const cap = taille * 0.7;
  const flotte = k > mot.length + 6 && k < kFin - (mot.length + 7) ? 0.003 * H * Math.sin((2 * Math.PI * (k - mot.length - 6)) / 60) : 0;
  const bas = (p.basLettres ?? (detoure ? 0.182 : 0.12)) * H + flotte; // ligne de base (bas des capitales)
  const kSortie = kFin - (mot.length + 7);

  const derive = 0.0015 * W * k;
  const x0 = 0.5 * W - total / 2 + derive - 0.0015 * W * 15;
  const commun = { fontFamily: POLICES.titre, fontWeight: 800 as const, fontSize: taille, textAnchor: "middle" as const };
  const yTexte = bas; // la ligne de base du texte SVG est le bas des capitales
  const focus = 0.008 * W * (1 - lin(k, 0, 4));

  let xl = x0;
  const lettres = [...mot].map((c, i) => {
    const cx = xl + adv[i] / 2;
    xl += adv[i];
    const kk = k - i;
    const m = rs(kk, "JAILLIR");
    const mont = (1 - Math.min(1.12, m)) * (cap * 1.25);
    const kc = k - (kSortie + i);
    const chute = kc > 0 ? entrant(kc, 0, 7) * (cap * 1.4) : 0;
    const dy = mont + chute;
    return { c, cx, dy, i, visible: kk > 0 };
  });

  // La ligne de découpe s'ouvre une fois les lettres posées (l'ombre portée sur le mur n'est plus coupée) et se referme pour la chute.
  const clipBas = bas + 0.004 * W + (k < kSortie ? lin(k, mot.length + 3, mot.length + 8) * 0.12 * H : 0);

  // Reflet de lumière qui traverse le mot, à la pose puis une seconde fois.
  const kg = k < 42 ? courbe(k, mot.length + 6, mot.length + 18, [0.65, 0, 0.35, 1]) : courbe(k, 50, 62, [0.65, 0, 0.35, 1]);
  const glintX = x0 - 0.15 * W + (total + 0.3 * W) * kg;

  const extrusion = (i: number) => (
    <g key={i} transform={`translate(${-i * 0.0035 * W} ${i * 0.004 * W})`}>
      {lettres.map((l) => (l.visible ? <text key={l.i} x={l.cx} y={yTexte + l.dy} {...commun} fill={N3.orangeProfond}>{l.c}</text> : null))}
    </g>
  );

  return (
    <div style={{ position: "absolute", left: 0, top: 0, width: W, height: H, overflow: "hidden", pointerEvents: "none" }}>
      <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ position: "absolute", left: 0, top: 0, overflow: "hidden", filter: focus > 0.3 ? `blur(${focus}px)` : undefined }}>
        <defs>
          {/* Ligne de découpe : tout ce qui est sous la base du mot est caché (les lettres montent « de derrière un rebord »). */}
          <clipPath id="coupe-derriere">
            <rect x={0} y={0} width={W} height={clipBas} />
          </clipPath>
          <linearGradient id="orange-derriere" gradientUnits="userSpaceOnUse" x1={0} y1={bas - cap} x2={0} y2={bas}>
            <stop offset="0" stopColor={N3.orangeChaud} />
            <stop offset="1" stopColor={N3.orangeProfond} />
          </linearGradient>
          <linearGradient id="reflet-der" gradientUnits="userSpaceOnUse" x1={glintX - 0.12 * W} y1={bas - cap} x2={glintX + 0.12 * W} y2={bas} gradientTransform={`rotate(20 ${glintX} ${bas - cap / 2})`}>
            <stop offset="0" stopColor={N3.ivoire} stopOpacity={0} />
            <stop offset="0.5" stopColor={N3.ivoire} stopOpacity={0.7} />
            <stop offset="1" stopColor={N3.ivoire} stopOpacity={0} />
          </linearGradient>
          <filter id="ombre-mur" filterUnits="userSpaceOnUse" x={-W} y={-H} width={3 * W} height={3 * H} colorInterpolationFilters="sRGB">
            <feDropShadow dx={-0.016 * W} dy={0.022 * W} stdDeviation={0.014 * W} floodColor={N3.encre} floodOpacity={0.34} />
            <feDropShadow dx={-0.004 * W} dy={0.006 * W} stdDeviation={0.005 * W} floodColor={N3.encre} floodOpacity={0.22} />
          </filter>
        </defs>
        <g clipPath="url(#coupe-derriere)">
          <g filter="url(#ombre-mur)">
            {[2, 1].map(extrusion)}
            {lettres.map((l) => (l.visible ? <text key={l.i} x={l.cx} y={yTexte + l.dy - 0.0032 * W} {...commun} fill={N3.ivoire} fillOpacity={0.6}>{l.c}</text> : null))}
            {lettres.map((l) => (l.visible ? <text key={l.i} x={l.cx} y={yTexte + l.dy} {...commun} fill="url(#orange-derriere)">{l.c}</text> : null))}
            {lettres.map((l) => (l.visible ? <text key={`g${l.i}`} x={l.cx} y={yTexte + l.dy} {...commun} fill="url(#reflet-der)">{l.c}</text> : null))}
          </g>
        </g>
      </svg>
      {detoure ? (
        <div
          style={{
            position: "absolute",
            left: 0,
            top: 0,
            width: W,
            height: H,
            WebkitMaskImage: `url(${p.masque})`,
            maskImage: `url(${p.masque})`,
            WebkitMaskSize: `${W}px ${H}px`,
            maskSize: `${W}px ${H}px`,
            // Seul le haut de l'image est reposé par-dessus le mot : les sous-titres du bas restent visibles.
            clipPath: "inset(0 0 55% 0)",
          }}
        >
          {p.priseNode}
        </div>
      ) : null}
    </div>
  );
}

