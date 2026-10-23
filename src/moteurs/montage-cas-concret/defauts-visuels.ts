/**
 * DÉFAUTS VISIBLES « BROUILLON » (tâche V4-3, qualité « sérieuse »). Contrôle PUR, mesuré sur la mise en page réelle de
 * la brique (`disposer`) des écrans tels que la chaîne les rend (`proprietesPleineImage`) :
 *  - texte sur texte : deux textes posés dont les boîtes se recouvrent de 4 px au moins (hors pastille d'un total posée sur sa liste,
 *    voulue par la v4) ;
 *  - objet vide : un téléphone (`telephone-capture`) sans image ni vrai écran ;
 *  - objet sous les sous-titres : un objet ou le fil qui descend dans la bande des sous-titres ;
 *  - phrase en double : un texte d'écran de 5 mots ou plus qui répète, mot pour mot, une phrase entière dite sur cet écran
 *    (le sous-titre la montre déjà).
 * Rendu en phrases ; la chaîne les garde en indicatif au compte rendu (jamais bloquant : la v4 validée par Will en porte).
 */
import { disposer, type ProprietesEcran } from "@/briques/ecrans-motion";
import { texteCompare } from "@/domaine/controles-script/texte";
import { motsLus } from "./fiche";

export type SorteDefaut = "texte-sur-texte" | "objet-vide" | "objet-sous-sous-titres" | "phrase-en-double";

export interface DefautVisuel {
  ecranId: string;
  sorte: SorteDefaut;
  detail: string;
}

/** Mots au moins d'un texte d'écran pour compter comme une phrase répétée. */
export const MOTS_PHRASE_EN_DOUBLE = 5;

type Boite = { x: number; y: number; largeur: number; hauteur: number };
/** Recouvrement en largeur et en hauteur ; deux boîtes jointives (arrondis du gabarit, ≤ 3 px) ne se recouvrent pas. */
export const RECOUVREMENT_MIN_PX = 4;
const recouvrent = (a: Boite, b: Boite) =>
  Math.min(a.x + a.largeur, b.x + b.largeur) - Math.max(a.x, b.x) >= RECOUVREMENT_MIN_PX && Math.min(a.y + a.hauteur, b.y + b.hauteur) - Math.max(a.y, b.y) >= RECOUVREMENT_MIN_PX;
/** La pastille d'un total est posée sur la fin de sa liste (v4, plan s4) : voulu. */
const voulu = (a: string, b: string) => [a, b].includes("total") && [a, b].some((n) => n.startsWith("tache-"));
const sansBalises = (t: string) => t.replace(/\*/g, "");

/** Défauts visibles d'un écran rendu ; `texteDit` : ce que la voix dit pendant cet écran (pour la phrase en double). */
export function defautsEcran(p: ProprietesEcran, texteDit?: string): DefautVisuel[] {
  const res: DefautVisuel[] = [];
  const { textes, boites } = disposer(p);
  const poses = textes.filter((t) => t.texte.trim());
  for (let i = 0; i < poses.length; i++) {
    for (let j = i + 1; j < poses.length; j++) {
      const a = poses[i];
      const b = poses[j];
      if (voulu(a.nom, b.nom)) continue;
      if (recouvrent(a.boite, b.boite)) res.push({ ecranId: p.id, sorte: "texte-sur-texte", detail: `« ${sansBalises(a.texte)} » et « ${sansBalises(b.texte)} » se recouvrent.` });
    }
  }
  if ((p.type === "etape" || p.type === "objet") && "objet" in p.visuel && p.visuel.objet === "telephone-capture") {
    res.push({ ecranId: p.id, sorte: "objet-vide", detail: "le téléphone n'a ni image ni vrai écran à montrer." });
  }
  const basUtile = p.zone.y + p.zone.hauteur;
  for (const o of boites.objets) {
    if (o.boite.y + o.boite.hauteur > basUtile + 0.5) res.push({ ecranId: p.id, sorte: "objet-sous-sous-titres", detail: `l'objet « ${o.nom} » descend jusqu'à ${Math.round(o.boite.y + o.boite.hauteur)} px, dans la bande des sous-titres (dès ${Math.round(basUtile)} px).` });
  }
  if (texteDit) {
    const phrases = texteDit.split(/[.?!:…]+/).map(texteCompare).filter(Boolean);
    for (const t of poses) {
      if (t.nom === "marque" || motsLus(sansBalises(t.texte)).length < MOTS_PHRASE_EN_DOUBLE) continue;
      const c = texteCompare(sansBalises(t.texte));
      if (phrases.includes(c)) res.push({ ecranId: p.id, sorte: "phrase-en-double", detail: `« ${sansBalises(t.texte)} » est écrit à l'écran et dit tel quel (le sous-titre le montre déjà).` });
    }
  }
  return res;
}

/** Défauts visibles d'une suite d'écrans ; `textesDits` : le texte dit de chaque écran, par identifiant. */
export function defautsVisuels(ecrans: readonly ProprietesEcran[], textesDits: Readonly<Record<string, string>> = {}): DefautVisuel[] {
  return ecrans.flatMap((p) => defautsEcran(p, textesDits[p.id]));
}
