/**
 * ÉLÉMENT 14 (refonte, 16/10/2026) — « PILE DE LETTRES » : remplace « orbite de lettres » (abandonnée par la critique).
 * Lot 3 « La typo est le personnage », designer n° 3. Forme F11 (typographie seule, orange, contour encre), E3 BORD DROIT,
 * mouvement de CHUTE EN CASCADE (une lettre par image, `JAILLIR`) puis micro-vie par lettre ; sortie : envol latéral en cascade.
 *
 * Différence avec les 4 autres : le mot n'est ni horizontal (11, 15), ni couché le long du bord gauche (12), ni plein écran (13) :
 * ses lettres sont DEBOUT et EMPILÉES l'une sous l'autre dans la colonne de droite, chacune penchée de 7° (alternée) et
 * décalée en zigzag de 0,012 L : une pile de blocs qui vient de tomber.
 *
 * Quand : une LISTE ou un NOM court dit par Will (« AGENDA », « CLIENT », « DEVIS » : 4 à 6 lettres). Au plus un par vidéo.
 * Visage : ENTIER (la colonne reste à droite de Z, aucune lettre ne la franchit, même pendant la chute et l'envol).
 *
 * Chorégraphie (30 i/s, i0 = Will dit le mot) :
 *  - i0 → i(n−1)  : la lettre j tombe du haut du cadre à l'image j, `JAILLIR` (rebond), de −0,15 H à sa place ;
 *  - à la pose    : écrasement vertical de 6 % sur 2 images ;
 *  - ensuite      : chaque lettre oscille de ±1,5° (déphasée) : jamais immobile ;
 *  - sortie       : ENVOL latéral : les lettres partent vers la droite, du haut vers le bas, une demi-image d'écart, en 6 images.
 * Taille : corps de 0,175 L au plus (réduit pour tenir dans la colonne libre à droite de Z) ; la pile fait plus de 6 % de l'image.
 * Bruitage : `drop_001` aux premières lettres (volume décroissant).
 */
import React from "react";
import { avancesLettres, borne, boiteTournee, Cadre, entrant, FPS, intersecte, lin, MotSvg, N3, PRISE_COMMUNE_LOT, ressort, TAILLE_MIN, usePoliceLot3, zonePx } from "./outils3";
import type { FicheLot3, PriseLot, RectPx } from "./outils3";

export const ID_PILE_LETTRES = "pile-de-lettres";
export const DUREE_PILE_LETTRES = Object.freeze({ min: 1.4, max: 3.0 });

export const FICHE_PILE_LETTRES: FicheLot3 = Object.freeze({
  id: ID_PILE_LETTRES,
  numero: 14,
  nom: "Pile de lettres",
  emplacement: "E3 bord droit (colonne à droite de Z, y 0,13 → 0,60 H)",
  forme: "F11 typographie seule : lettres orange debout, contour encre, ombre dure",
  mouvement: "chute en cascade JAILLIR (1 lettre par image), écrasement 6 %, micro-vie ±1,5°",
  sortie: "envol latéral en cascade",
  visage: "entier" as const,
  ouvertureAutorisee: true,
  dureeMin: DUREE_PILE_LETTRES.min,
  dureeMax: DUREE_PILE_LETTRES.max,
  quandUtiliser: "Un nom ou une liste courte dite par Will (4 à 6 lettres). Au plus un par vidéo ; à alterner avec le mot vertical du bord gauche.",
  sons: [
    { k: 0, fichier: "drop_001", volume: 0.8 },
    { k: 2, fichier: "drop_001", volume: 0.6 },
    { k: 4, fichier: "drop_001", volume: 0.5 },
  ],
});

export type PileLettresProps = {
  t: number;
  debut: number;
  fin: number;
  largeurImage: number;
  hauteurImage: number;
  /** Le mot DIT par Will (4 à 6 lettres ; au-delà on REFUSE au lieu de tronquer : le réalisateur choisit un autre élément). */
  mot: string;
  prise?: PriseLot;
};

/** Géométrie de la pile (pure) : taille des lettres, centres, boîte globale. */
export function planPile(p: Pick<PileLettresProps, "largeurImage" | "hauteurImage" | "mot" | "prise">) {
  const W = p.largeurImage;
  const H = p.hauteurImage;
  const lettres = [...p.mot.toUpperCase()];
  const n = lettres.length;
  const Z = zonePx(p.prise ?? PRISE_COMMUNE_LOT, W, H, 0.005);
  const largeurLibre = W - Z.x1 - 0.01 * W;
  const adv = (s: number) => avancesLettres(lettres.join(""), s);
  // Largeur d'une lettre tournée de 7° (boîte englobante) + zigzag de 0,024 L : doit tenir dans la colonne libre.
  const largeurMax = (s: number) => Math.max(...adv(s)) * 1.06 * Math.cos(0.122) + s * 0.8 * Math.sin(0.122) + 0.024 * W;
  let taille = 0.2 * W;
  while (largeurMax(taille) > largeurLibre && taille > TAILLE_MIN(W)) taille *= 0.98;
  let pas = taille * 0.86;
  const haut = 0.13 * H;
  while (haut + n * pas > 0.6 * H && pas > taille * 0.6) pas *= 0.98;
  const xc = Z.x1 + 0.005 * W + largeurLibre / 2;
  const centres = lettres.map((c, j) => ({ c, x: xc + (j % 2 === 0 ? -1 : 1) * 0.012 * W, y: haut + pas * (j + 0.5), rot: j % 2 === 0 ? -7 : 7 }));
  const a = adv(taille);
  const boites: RectPx[] = centres.map((q, j) => boiteTournee(q.x, q.y, a[j] * 1.06, taille * 0.8, q.rot));
  const globale: RectPx = { x0: Math.min(...boites.map((b) => b.x0)), x1: Math.max(...boites.map((b) => b.x1)), y0: Math.min(...boites.map((b) => b.y0)), y1: Math.max(...boites.map((b) => b.y1)) };
  return { W, H, lettres, Z, taille, centres, boites, globale, hors: boites.some((b) => intersecte(b, Z)) };
}

export function PileLettres(p: PileLettresProps) {
  usePoliceLot3();
  const { t, debut, fin } = p;
  if (t < debut || t >= fin) return null;
  if ([...p.mot].length > 6) return null;
  const { W, H, centres, taille } = planPile(p);
  const k = (t - debut) * FPS;
  const kSortie = (fin - debut) * FPS - 6;
  const contourPx = Math.max(4, 0.005 * W);
  const ombrePx = Math.max(5, 0.008 * W);

  return (
    <Cadre W={W} H={H}>
      {centres.map((q, j) => {
        const kk = k - j;
        if (kk < 0) return null;
        const e = ressort(kk, "JAILLIR");
        const y0 = q.y - (q.y + 0.15 * H) * (1 - e);
        const ecrase = 1 - 0.06 * (kk >= 3 && kk < 5 ? 1 : 0);
        const vie = kk > 8 ? 1.5 * Math.sin((2 * Math.PI * (kk - 8)) / 54 + j) : 0;
        let dx = 0;
        let dy = 0;
        let tourne = 0;
        if (k >= kSortie) {
          const d = entrant(k - kSortie - j * 0.5, 0, 4.5);
          dx = 0.3 * W * d;
          dy = -0.02 * H * d;
          tourne = 14 * d;
        }
        return <MotSvg key={j} texte={q.c} cx={q.x + dx} cy={y0 + dy} taille={taille} rot={q.rot + vie + tourne} etireY={ecrase} remplissage={N3.orange} contour={N3.encre} contourPx={contourPx} ombrePx={ombrePx} opacite={borne(lin(kk, 0, 1), 0, 1)} />;
      })}
    </Cadre>
  );
}
