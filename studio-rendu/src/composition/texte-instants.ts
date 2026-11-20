/**
 * CALQUES TEXTE : UNE IMAGE PAR ÉTAT DIFFÉRENT (lot M4b) — PUR, testé.
 *
 * Le texte (sous-titres, encadré, incrustations) ne change qu'à quelques instants : un mot qui s'allume, un groupe
 * qui arrive (rebond de 0,24 s), un soulignement (0,15 s), l'encadré qui part. Entre deux, l'image est identique.
 * On calcule l'état DESSINÉ de chaque image avec les MÊMES fonctions que le rendu (`sceneAuTemps`, `encadreVisible`,
 * `incrustationsAuTemps`) et on ne fait dessiner au navigateur qu'une image par suite d'états égaux ; FFmpeg la
 * répète ensuite (`concat` + `fps`). Le rendu est identique, image pour image.
 */
import { etiquetteAuTemps, opaciteBandeFond, paveAuTemps, sceneAuTemps } from "../../../src/briques/sous-titres/scene.js";
import { geometriePave } from "../../../src/briques/sous-titres/pave.js";
import { bandeauAuTemps } from "../../../src/briques/sous-titres/bandeau-nom.js";
import { encadreVisible, imagePlanAuTemps, incrustationsAuTemps, type ProprietesTexteComposition } from "../../../src/briques/composition/scene.js";

export interface InstantsTexte {
  /** Instant (s) dessiné pour chaque image rendue. */
  instants: number[];
  /** Nombre d'images de la vidéo que tient chaque image rendue (somme = `images`). */
  durees: number[];
}

/** Ce qui est dessiné à l'instant t, sous une forme comparable (deux images égales ⇔ même empreinte). */
export function empreinteTexte(p: Pick<ProprietesTexteComposition, "sousTitres" | "encadre" | "incrustations" | "planScenes">, t: number): string {
  const el = p.sousTitres ? sceneAuTemps(p.sousTitres, t) : null;
  const sous = el
    ? [el.cle, el.taillePx, +el.yPx.toFixed(2), el.rotationDeg, +el.echelle.toFixed(4), +el.opacite.toFixed(4), +el.decalageYPx.toFixed(2), el.mots.map((m) => [m.texte, m.couleur, +m.opacite.toFixed(4), +m.souligne.toFixed(4), ...(m.echelle === undefined && m.monteePx === undefined ? [] : [+(m.echelle ?? 1).toFixed(4), +(m.monteePx ?? 0).toFixed(2)]), ...(m.plaque ? [1] : []), ...(m.etiquette ? [m.etiquette] : []), ...(p.sousTitres?.poidsVariable === true && m.graisse !== undefined ? [Math.round(m.graisse / 50) * 50] : [])])]
    : null;
  const inc = incrustationsAuTemps(p.incrustations, t).map((i) => p.incrustations.indexOf(i));
  const bandeau = p.sousTitres?.bandeauNom ? bandeauAuTemps(p.sousTitres.bandeauNom, t) : null;
  const etiquette = p.sousTitres?.etiquettesOutils ? etiquetteAuTemps(p.sousTitres, t) : null;
  // 18/11 (FIX-BANDE-VIDE-TABLEAU) : l'opacité de la bande change à l'image, donc elle entre dans l'empreinte (sans bandeFond : inchangé).
  const bande = p.sousTitres?.bandeFond ? +opaciteBandeFond(p.sousTitres, t).toFixed(3) : null;
  // BR-PAVE-MARQUES : la plaque animée change à l'image pendant son entrée ; elle entre dans l'empreinte (sans `paveAnime` : inchangé).
  const pave = p.sousTitres?.paveAnime === true ? paveAuTemps(p.sousTitres, t) : null;
  const gp = pave ? geometriePave(pave.boite, pave.taillePx, t - pave.debutS) : null;
  // BR-DESSIN-FACECAM-b-v20a : l'image du plan à l'instant entre dans l'empreinte seulement si le plan est posé (sans : inchangé).
  const imagePlan = p.planScenes ? imagePlanAuTemps(p.planScenes, t) : undefined;
  return JSON.stringify([sous, encadreVisible(p.encadre, t), inc, ...(bandeau ? [[bandeau.visible, +bandeau.opacite.toFixed(4), +bandeau.decalageXPx.toFixed(2)]] : []), ...(etiquette ? [[etiquette.id, +etiquette.opacite.toFixed(4)]] : []), ...(bande === null ? [] : [["bande", bande]]), ...(gp && pave ? [["pave", +gp.echelle.toFixed(4), +gp.opacite.toFixed(4), pave.marque ?? null]] : []), ...(imagePlan === undefined ? [] : [["plan", imagePlan]])]);
}

/** Suites d'images égales : une image rendue par suite, à l'instant de sa première image. */
export function instantsTexte(p: Pick<ProprietesTexteComposition, "sousTitres" | "encadre" | "incrustations" | "planScenes" | "images" | "fps">): InstantsTexte {
  const instants: number[] = [];
  const durees: number[] = [];
  let precedente: string | null = null;
  for (let i = 0; i < Math.max(1, p.images); i++) {
    const t = i / p.fps;
    const e = empreinteTexte(p, t);
    if (e === precedente) durees[durees.length - 1]++;
    else {
      instants.push(t);
      durees.push(1);
      precedente = e;
    }
  }
  return { instants, durees };
}
