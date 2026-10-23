/**
 * SOUS-TITRES DU STYLE « blocs/2 » : mot à mot, par groupes de 2 à 4 mots d'une même phrase, dans une pastille ivoire
 * à bord encre (texte encre, le mot dit souligné d'orange), centrée dans la bande des sous-titres (zone sûre). Comme la
 * vidéo modèle. Effacés à la fin de la voix (l'écran de fin prend la place). PUR, sans alias « @/ ».
 */
import { largeurEcrite } from "../../stylo/mesure-ecriture";
import { TAILLES_V2 } from "./charte";
import type { GeometrieV2, MotDitV2, RectV2 } from "./types";

const finDePhrase = (m: string) => /[.!?…]["»”]?$/.test(m.trim());
const ponctue = (m: string) => /[,.:;!?…]["»”]?$/.test(m.trim());

/** Groupes de mots (index dans `mots`) : 2 à 4 mots, coupés à la ponctuation, jamais à cheval sur deux phrases. */
export function groupesSousTitres(mots: readonly MotDitV2[]): number[][] {
  const phrases: number[][] = [];
  let cour: number[] = [];
  mots.forEach((m, i) => {
    cour.push(i);
    if (finDePhrase(m.mot)) {
      phrases.push(cour);
      cour = [];
    }
  });
  if (cour.length) phrases.push(cour);
  const groupes: number[][] = [];
  for (const ph of phrases) {
    const G: number[][] = [];
    let g: number[] = [];
    ph.forEach((i, k) => {
      g.push(i);
      const suiv = ph[k + 1];
      if (g.length >= 4 || (ponctue(mots[i].mot) && g.length >= 2) || (g.length === 3 && suiv !== undefined && !ponctue(mots[suiv].mot) && ph[k + 2] !== undefined)) {
        G.push(g);
        g = [];
      }
    });
    if (g.length) {
      if (g.length === 1 && G.length && G[G.length - 1].length < 4) G[G.length - 1].push(...g);
      else G.push(g);
    }
    groupes.push(...G);
  }
  return groupes;
}

export interface SousTitreV2 {
  mots: string[];
  /** Index (dans `mots`) du mot dit. */
  actif: number;
  taille: number;
  /** Pastille (px). */
  boite: RectV2;
  /** Début du groupe (ms) : petite entrée. */
  debutMs: number;
}

const typo = (t: string) => t.replace(/'/g, "’");

/** Sous-titre à l'instant `t` (ms), ou null (avant le premier mot, après la voix). */
export function sousTitreA(mots: readonly MotDitV2[], g: GeometrieV2, t: number, finVoixMs: number, groupes = groupesSousTitres(mots)): SousTitreV2 | null {
  if (!mots.length || t > finVoixMs + 150 || t < mots[0].debutMs - 400) return null;
  let k = 0;
  mots.forEach((m, i) => {
    if (m.debutMs <= t + 20) k = i;
  });
  const gr = groupes.find((x) => x.includes(k)) ?? groupes[0];
  const textes = gr.map((i) => typo(mots[i].mot));
  const k1 = g.k;
  const padX = 30 * k1;
  const padY = 16 * k1;
  let taille = TAILLES_V2.sousTitres * k1;
  const largeurMax = g.bande.largeur - 24 * k1;
  const largeur = (s: number) => largeurEcrite(textes.join(" "), "texte", s) + 2 * padX + 12 * k1 * textes.length;
  while (largeur(taille) > largeurMax && taille > 24 * k1) taille -= 1;
  taille = Math.min(taille, (g.bande.hauteur - 2 * padY - 10 * k1) / 1.12);
  const l = largeur(taille);
  const h = taille * 1.12 + 2 * padY;
  return {
    mots: textes,
    actif: gr.indexOf(k),
    taille,
    boite: { x: g.bande.x + (g.bande.largeur - l) / 2, y: g.bande.y + (g.bande.hauteur - h) / 2, largeur: l, hauteur: h },
    debutMs: mots[gr[0]].debutMs,
  };
}
