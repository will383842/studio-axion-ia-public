/**
 * IMAGE → VIDÉO · « Version prudente » (plan § 2 et § 4, I7). PUR : aucune dépendance serveur, donc utilisable dans un
 * composant client (l'écran montre le vrai texte) comme sur le serveur (la validation pose ce même texte).
 */
import { texteCompare } from "@/domaine/controles-script/texte";
import type { FicheImage } from "./fiche";
import { remplacerFormules } from "./formules";

export type ChoixFormule = "garder" | "reformuler";

/** Clé d'une formule absolue : « Risque d'erreur : zéro » et « risque erreur : zéro » ont la même. */
export function cleFormule(t: string): string {
  return texteCompare(t)
    .replace(/\b0\b/g, "zero")
    .replace(/\b1er\b/g, "premier")
    .replace(/\bd'/g, "")
    .replace(/'/g, " ")
    .replace(/[^a-z0-9%]+/g, "");
}

/**
 * « Version prudente » choisie par Will : dans chaque texte du script (dit et écrit) où la formule est repérée (même
 * repérage que les contrôles), le texte devient sa proposition prudente, en UN SEUL passage par texte. `null` : rien
 * à changer. PUR.
 */
export function avecVersionsPrudentes(fiche: FicheImage, choix: Readonly<Record<string, ChoixFormule>>): FicheImage | null {
  const prudentes = new Set(Object.entries(choix).filter(([, c]) => c === "reformuler").map(([k]) => k));
  if (!prudentes.size) return null;
  const adoucir = (t: string): string => remplacerFormules(t, (f) => prudentes.has(cleFormule(f)));
  let change = false;
  const ecrans = fiche.ecrans.map((e) => {
    const texteDit = adoucir(e.texteDit);
    const textesEcran = e.textesEcran.map((t) => {
      const brut = adoucir(t);
      // Formule coupée par le mot orange : repérée sur le texte sans étoiles (le mot orange est alors perdu).
      const sansEtoiles = brut === t && /\*/.test(t) ? adoucir(t.replace(/\*/g, "")) : brut;
      return (sansEtoiles !== t.replace(/\*/g, "") ? sansEtoiles : brut).slice(0, 80);
    });
    if (texteDit !== e.texteDit || textesEcran.some((t, k) => t !== e.textesEcran[k])) change = true;
    return { ...e, texteDit, textesEcran };
  });
  return change ? { ...fiche, ecrans } : null;
}
