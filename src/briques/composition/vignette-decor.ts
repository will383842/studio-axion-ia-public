/**
 * VIGNETTE D'UN DÉCOR SUR LE DOUBLE — brique commune « composition » (lot B1, `decors/CATALOGUE-DECORS.md` : « chaque
 * décor a une vignette sur le double de Will, et pas sur un décor vide »). PUR.
 *
 * Une seule image (`image-fixe` de `studio-rendu`, composition `CompositionImage`) : le décor tel que la vidéo le pose
 * (même flou, même liseré de lumière), le double en plan large devant. GRATUIT (aucun appel payant) : c'est la même
 * mise en image que les vidéos, sur une image. Le double est l'image détourée du visage s'il en a une, sinon la
 * silhouette simulée (aucun double réel n'existe encore).
 */
import type { ValeurDecor } from "@/domaine/types";
import { coteContour, SILHOUETTE } from "./image";
import { DIMENSIONS_SCENE, PREFIXE_ENTREE, type DecorScene, type ProprietesImageComposition, type RatioScene, type SourceDouble } from "./scene";

/** Décor de la scène depuis la valeur d'un décor (mêmes règles que `decorScene` : une photo est toujours floutée). */
export function decorDepuisValeur(v: ValeurDecor, avecImage: boolean, repli: DecorScene): DecorScene {
  const methode = v.methode ?? "neutre-incruste";
  return {
    image: avecImage ? `${PREFIXE_ENTREE}decor` : undefined,
    teinte: v.teinte ?? repli.teinte,
    teinteLumiere: v.teinteLumiere ?? repli.teinteLumiere,
    directionLumiere: v.directionLumiere,
    flouPx: methode === "photo-incrustee" ? Math.max(12, v.profondeurFlou) : v.profondeurFlou,
    clair: v.clair ?? false,
  };
}

/**
 * Propriétés de `CompositionImage` pour la vignette (une image, plan large, cadre plein). `largeur` : taille de sortie
 * (540 par défaut, la moitié du 1080 : une vignette, pas une image de vidéo).
 */
export function proprietesVignetteDecor(o: { decor: DecorScene; double?: SourceDouble; ratio?: RatioScene }): ProprietesImageComposition {
  const ratio = o.ratio ?? "9:16";
  const { largeur, hauteur } = DIMENSIONS_SCENE[ratio];
  return {
    ratio,
    largeur,
    hauteur,
    fps: 25,
    images: 1,
    decor: o.decor,
    doubles: { principal: o.double ?? SILHOUETTE },
    contour: o.decor.teinteLumiere ? { couleur: o.decor.teinteLumiere, cote: coteContour(o.decor.directionLumiere) } : undefined,
    plans: [{ debutSec: 0, finSec: 1, type: "double", angle: "principal", cadrage: { valeur: "large", zoom: 1, zoomFin: 1, pointX: 0.5, pointY: 0.4 } }],
  };
}

/** Double de la vignette : l'image détourée (entrée « double-principal ») si elle existe, sinon la silhouette. */
export function doubleVignette(avecDetoure: boolean): SourceDouble {
  return avecDetoure ? { type: "image", url: `${PREFIXE_ENTREE}double-principal` } : SILHOUETTE;
}

/** Paramètres de la demande `image-fixe` (sérialisables) : composition commune + propriétés à références d'entrées. */
export function parametresVignetteDecor(proprietes: ProprietesImageComposition): Record<string, unknown> {
  return { composition: "CompositionImage", image: 0, proprietes, references: true };
}
