/**
 * Opération `image-fixe` (file courte) : une image Remotion `still` (captures des styles de sous-titres au lot M2,
 * couverture, essai). Paramètres : `composition` (défaut « Essai »), `image` (numéro, défaut 0), `proprietes`.
 * Lot B1 : `references: true` → les chaînes `entree:<nom>` des propriétés sont remplacées par l'adresse de l'entrée
 * (vignette d'un décor SUR le double, `CompositionImage` de la brique commune). Sans lui : comportement d'avant
 * (entrées ajoutées à plat aux propriétés).
 * Sortie : PNG déposé à `sortie.urlDepot`.
 */
import { join } from "node:path";
import { remplacerReferences } from "../composition/entrees.js";
import { ErreurRendu, type Operation } from "../contrat.js";
import { deposer } from "../outils.js";
import { paquetCompositions, REGLAGES_RENDU } from "../remotion.js";

export const imageFixe: Operation = async (demande, contexte) => {
  const id = typeof demande.parametres.composition === "string" ? demande.parametres.composition : "Essai";
  const brutes = (demande.parametres.proprietes ?? {}) as Record<string, unknown>;
  const proprietes = demande.parametres.references === true ? remplacerReferences(brutes, demande.entrees) : { ...brutes, ...demande.entrees };
  const { renderStill, selectComposition } = await import("@remotion/renderer");
  const serveUrl = await paquetCompositions();
  contexte.progression(20);
  const composition = await selectComposition({ serveUrl, id, inputProps: proprietes }).catch((e: Error) => {
    throw new ErreurRendu({ code: "refuse", reessayable: false, message: `Composition « ${id} » introuvable : ${e.message}` });
  });
  const sortie = join(contexte.dossier, "image.png");
  await renderStill({ ...REGLAGES_RENDU, composition, serveUrl, output: sortie, frame: Number(demande.parametres.image ?? 0), inputProps: proprietes });
  contexte.progression(80);
  await deposer(demande.sortie.urlDepot, sortie, "image/png", contexte.signal);
  return { mesures: { largeur: composition.width, hauteur: composition.height } };
};
