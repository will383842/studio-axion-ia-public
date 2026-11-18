/**
 * PLANCHE D'ATTENTE (C9-40b-a) : l'appel à l'action (C9-12a), l'anneau de part (N-08a), le compteur à rouleau (N-08c-a) et le bouton « Prendre rendez-vous » (C10-13, N-08c-a) sur une planche outil local,
 * en attendant la planche des petits objets. Pur (aucun hook, aucune horloge, aucun hasard). Imports relatifs seulement.
 * Rien n'est inscrit, rien n'est allumé : aucun générateur n'importe ce fichier.
 */
import type { JSX } from "react";
import { couleursSur, FAMILLE_CSS_AXION, type FondAxion } from "../../src/briques/jetons-motion";
import type { DefinitionObjet } from "../../src/briques/motion/petits-objets/contrat";
import { DEF_APPEL_ACTION, EXEMPLES_APPEL_ACTION } from "../../src/briques/motion/petits-objets/appel-action";
import { OBJET_ANNEAU_DONNEES, EXEMPLES_ANNEAU } from "../../src/briques/motion/petits-objets/anneau-donnees";
import { OBJET_COMPTEUR_ROULEAU, EXEMPLES_ROULEAU } from "../../src/briques/motion/petits-objets/compteur-rouleau";
import { DEF_APPEL_RDV, EXEMPLES_APPEL_RDV } from "../../src/briques/motion/petits-objets/appel-rdv";
import {
  colonnesPlanche,
  DIMENSIONS_PLANCHE,
  DUREE_IMAGES_PLANCHE,
  FPS_PLANCHE,
  IMAGE_PLANCHE,
  type FormatPlanche,
} from "../../studio-rendu/compositions/petits-objets/planche/PlancheTraits";

export const FORMATS_ATTENTE: readonly FormatPlanche[] = ["9x16", "4x5"];

export interface EntreeAttente {
  id: string;
  def: DefinitionObjet<unknown>;
  parametres: unknown;
}

function lister(def: DefinitionObjet<unknown>, exemples: readonly unknown[]): EntreeAttente[] {
  return exemples.map((parametres, i) => ({ id: `${def.id}#${i + 1}`, def, parametres }));
}

/** Quatorze entrées, ordre fixe : 4 appels à l action, 3 anneaux, 4 rouleaux, 3 boutons RDV. */
export const ENTREES_ATTENTE: readonly EntreeAttente[] = [
  ...lister(DEF_APPEL_ACTION as unknown as DefinitionObjet<unknown>, EXEMPLES_APPEL_ACTION),
  ...lister(OBJET_ANNEAU_DONNEES as unknown as DefinitionObjet<unknown>, EXEMPLES_ANNEAU),
  ...lister(OBJET_COMPTEUR_ROULEAU as unknown as DefinitionObjet<unknown>, EXEMPLES_ROULEAU),
  ...lister(DEF_APPEL_RDV as unknown as DefinitionObjet<unknown>, EXEMPLES_APPEL_RDV),
];

export function PlancheObjetsAttente({ fond, format, image = IMAGE_PLANCHE }: { fond: FondAxion; format: FormatPlanche; image?: number }): JSX.Element {
  const { largeur, hauteur } = DIMENSIONS_PLANCHE[format];
  const cols = colonnesPlanche(ENTREES_ATTENTE.length, largeur, hauteur);
  const cote = largeur / cols;
  const pal = couleursSur(fond);
  return (
    <div data-planche={`attente-${format}-${fond}`} style={{ position: "relative", width: largeur, height: hauteur, background: pal.fond, display: "flex", flexWrap: "wrap", alignContent: "flex-start", overflow: "hidden", fontFamily: FAMILLE_CSS_AXION }}>
      {ENTREES_ATTENTE.map((e) => (
        <div key={e.id} data-objet={e.id} style={{ position: "relative", width: cote, height: cote, boxSizing: "border-box", border: `1px solid ${pal.texteDoux}` }}>
          <div style={{ position: "absolute", inset: 0 }}>
            {e.def.Rendu({ image, fps: FPS_PLANCHE, dureeImages: DUREE_IMAGES_PLANCHE, fond, graine: 7, parametres: e.parametres })}
          </div>
          <span style={{ position: "absolute", left: 4, top: 2, fontSize: Math.max(8, cote / 16), color: pal.texte }}>{e.id.replace("objet-", "")}</span>
        </div>
      ))}
    </div>
  );
}
