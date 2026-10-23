/**
 * Axe « apparition » de la variété (lot APP-MAT) : comment les cartes du schéma (toile) arrivent.
 *  - APP-A (référence) : la carte surgit avec rebond (rendu d'aujourd'hui) ;
 *  - APP-B : tracé au feutre (contour, puis le blanc, puis le texte ; la place de la carte suivante attend en pointillé) ;
 *  - APP-C : fantôme qui s'allume (tout le schéma est là dès le début, éteint et sans texte ; chaque carte s'allume à
 *    son mot ; les cartes vues dans une séquence précédente restent « vues ») ;
 *  - APP-D : cartes qui tombent et se posent comme des fiches (la place de la suivante attend, pleine et éteinte).
 * Seul le DESSIN change : les mots, les heures et les événements restent ceux de la mise en scène (contrôles inchangés).
 * Chaque toile reçoit `variete.donnees.apparition` = `DonneesApparitionIV` (lu par `Toile.tsx` et `Noeud.tsx`).
 */
import { tirablesDe, type CodesParAxe, type FormatIV } from "@/briques/schema-motion/variete";
import type { CarteImage } from "@/domaine/image-video/carte";
import type { AxeVarieteIV, EtapeVarieteIV } from "../index";

/** Ce que porte une toile (recopié côté compositions, `variete/apparition/apparition.ts` : `src/` n'importe pas `studio-rendu/`). */
export interface DonneesApparitionIV {
  code: CodesParAxe["apparition"];
  /** APP-C : nœuds montrés éteints (sans texte) dès le début : tout le schéma sauf les « vus » ; chacun s'allume à son mot. */
  fantomes?: string[];
  /** APP-C : nœuds posés dans une séquence précédente (`dejaVus`), montrés « vus » dès le début. */
  vus?: string[];
}

/** Il faut un schéma (au moins 3 nœuds) pour qu'une carte apparaisse autrement. */
const NOEUDS_MIN = 3;

export const AXE_APPARITION: AxeVarieteIV = {
  axe: "apparition",
  possibles(carte: CarteImage, format: FormatIV) {
    void format;
    return carte.noeuds.length >= NOEUDS_MIN ? [...tirablesDe("apparition")] : [];
  },
  appliquer(etape: EtapeVarieteIV): EtapeVarieteIV {
    const code = etape.recette.apparition;
    if (code === "APP-A") return etape;
    let toiles = 0;
    const blocs = etape.blocs.map((b) => {
      if (b.sorte !== "toile") return b;
      toiles++;
      const p = b.proprietes;
      const dits = new Set(p.mots.map((m) => m.noeud));
      const vus = (p.dejaVus ?? []).filter((n) => !dits.has(n));
      const fantomes = p.schema.noeuds.map((n) => n.id).filter((n) => !vus.includes(n));
      const donnees: DonneesApparitionIV = code === "APP-C" ? { code, fantomes, vus } : { code };
      return { ...b, variete: { ...b.variete!, donnees: { ...b.variete?.donnees, apparition: donnees } } };
    });
    if (!toiles) return { ...etape, replis: [...etape.replis, { axe: "apparition", code, raison: "aucune toile dans cette version : rien n'apparaît sur un schéma" }] };
    return { ...etape, blocs };
  },
};
