/**
 * IMAGES DÉCLARÉES PAR LE CAS (tâche V4-1, mission B). Fonction PURE.
 *
 * L'objet `telephone-capture` est un téléphone qui montre une image ; sans image, il est VIDE (essai réel du 14/10 :
 * l'étape « L'annonce » montrait un téléphone vide, la v4 y met l'annonce). Pour chaque écran dont le visuel est cet
 * objet :
 *  - l'étape du cas qui lui correspond (même titre ; pour un écran `etape`, sinon même rang) déclare une image
 *    (`visuel.image`) DÉPOSÉE dans le stockage : l'écran garde son objet et reçoit l'image (rangée avec les captures du
 *    site, par identifiant d'écran), que `contenuEcran` pose dans le téléphone ;
 *  - sinon (pas d'image, image pas déposée, aucune étape du cas) : l'objet de repli dessiné, et une ligne au journal.
 * Ainsi aucun téléphone ne part vide au rendu.
 */
import type { CasConcret } from "@/formats/cas-concret/cas";
import type { CaptureVraiEcran } from "./etapes";
import { cleMot, type EcranCorps, type FicheEcrans } from "./fiche";

/** Objet dessiné à la place d'un téléphone qui n'a pas d'image à montrer. */
export const REPLI_TELEPHONE_SANS_IMAGE = "telephone-notification" as const;

export interface ImagesDuCas {
  fiche: FicheEcrans;
  /** Image montrée par écran (même forme que les captures du site, sans adresse). */
  captures: Record<string, Omit<CaptureVraiEcran, "src">>;
  /** Une ligne par téléphone remplacé par son repli. */
  journal: string[];
}

const sansBalises = (t: string) => t.replace(/\*/g, "");
const memeTitre = (a: string, b: string) => cleMot(sansBalises(a)) === cleMot(sansBalises(b));

/** Images des téléphones de la fiche, d'après le cas ; `deposees` : clés présentes dans le stockage. */
export function imagesDuCas(fiche: FicheEcrans, cas: Pick<CasConcret, "etapes">, deposees: ReadonlySet<string>): ImagesDuCas {
  const captures: ImagesDuCas["captures"] = {};
  const journal: string[] = [];
  const ecrans = fiche.ecrans.map((e): EcranCorps => {
    if ((e.type !== "etape" && e.type !== "objet") || e.visuel.sorte !== "objet" || e.visuel.objet !== "telephone-capture") return e;
    const titre = sansBalises(e.titre);
    const repli = (raison: string): EcranCorps => {
      journal.push(`Téléphone de « ${titre} » dessiné sans image : ${raison}.`);
      return { ...e, visuel: { sorte: "objet", objet: REPLI_TELEPHONE_SANS_IMAGE } } as EcranCorps;
    };
    let k = cas.etapes.findIndex((x) => memeTitre(x.titre, e.titre));
    if (k < 0 && e.type === "etape" && cas.etapes[e.numero - 1]?.visuel.sorte === "objet") k = e.numero - 1;
    const visuel = k >= 0 ? cas.etapes[k].visuel : undefined;
    const image = visuel && visuel.sorte === "objet" && visuel.objet === "telephone-capture" ? visuel.image : undefined;
    if (!image) return repli("le cas ne déclare aucune image pour cette étape");
    if (!deposees.has(image.cle)) return repli(`l'image ${image.cle} n'est pas déposée dans le stockage`);
    // La fiche garde son objet (schéma exact) ; `contenuEcran` pose l'image de l'écran dans le téléphone.
    captures[e.id] = { cle: image.cle, sorte: "image", largeur: image.largeur, hauteur: image.hauteur };
    return e;
  });
  return { fiche: { ...fiche, ecrans: ecrans as FicheEcrans["ecrans"] }, captures, journal };
}

/** Clés d'images déclarées par le cas (à vérifier dans le stockage avant `imagesDuCas`). */
export function clesImagesDuCas(cas: Pick<CasConcret, "etapes">): string[] {
  return [...new Set(cas.etapes.flatMap((e) => (e.visuel.sorte === "objet" && e.visuel.image ? [e.visuel.image.cle] : [])))];
}
