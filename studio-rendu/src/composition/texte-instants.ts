/**
 * CALQUES TEXTE : UNE IMAGE PAR ÉTAT DIFFÉRENT (lot M4b) — PUR, testé.
 *
 * Le texte (sous-titres, encadré, incrustations) ne change qu'à quelques instants : un mot qui s'allume, un groupe
 * qui arrive (rebond de 0,24 s), un soulignement (0,15 s), l'encadré qui part. Entre deux, l'image est identique.
 * On calcule l'état DESSINÉ de chaque image avec les MÊMES fonctions que le rendu (`sceneAuTemps`, `encadreVisible`,
 * `incrustationsAuTemps`) et on ne fait dessiner au navigateur qu'une image par suite d'états égaux ; FFmpeg la
 * répète ensuite (`concat` + `fps`). Le rendu est identique, image pour image.
 */
import { sceneAuTemps } from "../../../src/briques/sous-titres/scene.js";
import { encadreVisible, incrustationsAuTemps, type ProprietesTexteComposition } from "../../../src/briques/composition/scene.js";

export interface InstantsTexte {
  /** Instant (s) dessiné pour chaque image rendue. */
  instants: number[];
  /** Nombre d'images de la vidéo que tient chaque image rendue (somme = `images`). */
  durees: number[];
}

/** Ce qui est dessiné à l'instant t, sous une forme comparable (deux images égales ⇔ même empreinte). */
export function empreinteTexte(p: Pick<ProprietesTexteComposition, "sousTitres" | "encadre" | "incrustations">, t: number): string {
  const el = p.sousTitres ? sceneAuTemps(p.sousTitres, t) : null;
  const sous = el
    ? [el.cle, el.taillePx, +el.yPx.toFixed(2), el.rotationDeg, +el.echelle.toFixed(4), +el.opacite.toFixed(4), +el.decalageYPx.toFixed(2), el.mots.map((m) => [m.texte, m.couleur, +m.opacite.toFixed(4), +m.souligne.toFixed(4)])]
    : null;
  const inc = incrustationsAuTemps(p.incrustations, t).map((i) => p.incrustations.indexOf(i));
  return JSON.stringify([sous, encadreVisible(p.encadre, t), inc]);
}

/** Suites d'images égales : une image rendue par suite, à l'instant de sa première image. */
export function instantsTexte(p: Pick<ProprietesTexteComposition, "sousTitres" | "encadre" | "incrustations" | "images" | "fps">): InstantsTexte {
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
