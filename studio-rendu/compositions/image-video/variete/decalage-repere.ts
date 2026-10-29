/** Décalage du repère de chapitre d'un écran de variété (PUR : ni React ni `remotion`, les tests l'appellent directement). */
import type { ProprietesEcranVariete } from "./CompositionVariete";
import { decalageRepereSurEtiquette, HAUT_REPERE } from "../plan-objets";
import { miseEnPageDeHauteurIV } from "../mise-en-page";
import { cadreChiffres } from "./chiffres/cadre";

/** 4:5, écran « chiffres » : son étiquette est sur la ligne du repère ; le repère se décale pour ne pas la recouvrir (9:16 inchangé). */
export function decalageRepere(p: Pick<ProprietesEcranVariete, "bloc" | "hauteur" | "repere">): { dx: number; dy: number; largeurEtiquette?: number } {
  if (!p.repere || p.bloc.axe !== "chiffres" || miseEnPageDeHauteurIV(p.hauteur).format !== "4:5") return { dx: 0, dy: 0 };
  const d = (p.bloc.donnees ?? {}) as { etiquette?: unknown; code?: unknown };
  const cadre = cadreChiffres(p.hauteur);
  return decalageRepereSurEtiquette({
    etiquette: typeof d.etiquette === "string" && d.etiquette && p.bloc.code !== "CHI-D" ? d.etiquette : undefined,
    yEtiquette: cadre.etiquetteY,
    hautRepere: HAUT_REPERE * 1920 - miseEnPageDeHauteurIV(p.hauteur).decalageReference,
    total: p.repere.total,
    prefixe: p.repere.prefixe,
  });
}
