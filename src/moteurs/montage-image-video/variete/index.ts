/**
 * VARIÉTÉ « Image → vidéo » : application d'une recette aux blocs de rendu d'une version (PUR).
 *
 * Appelée par `mettreEnSceneIV` SEULEMENT si une recette est donnée (sans recette, rien ne change). Les axes passent
 * dans un ORDRE FIXE : récit → ouverture → typo → chiffres → caméra → apparition → fin → transitions → matière (les
 * sous-titres sont lus au rendu). Règle : un bloc déjà `sorte: "variete"` n'est plus transformé par un axe suivant,
 * sauf par transitions et matière, qui n'ajoutent que des propriétés.
 */
import { REFERENCES, type FormatIV, type RecetteVarieteIV, type AxeVariete, type CodeVariante } from "@/briques/schema-motion/variete";
import type { CarteImage } from "@/domaine/image-video/carte";
import type { FicheImage } from "@/domaine/image-video/fiche";
import type { ReseauIV } from "@/domaine/image-video/plafonds";
import type { BlocRenduIV, LigneDeTempsIV, PlanIV } from "../mise-en-scene";
import { AXE_APPARITION } from "./axes/apparition";
import { AXE_CAMERA } from "./axes/camera";
import { AXE_CHIFFRES } from "./axes/chiffres";
import { AXE_FIN } from "./axes/fin";
import { AXE_MATIERE } from "./axes/matiere";
import { AXE_OUVERTURE } from "./axes/ouverture";
import { AXE_RECIT } from "./axes/recit";
import { AXE_TRANSITIONS } from "./axes/transitions";
import { AXE_TYPO } from "./axes/typo";

/** Une variante impossible sur cette image : l'axe garde sa référence, et le dit. */
export interface RepliVarieteIV {
  axe: AxeVariete;
  code: CodeVariante;
  raison: string;
}

/** Ce que chaque axe reçoit et rend. */
export interface EtapeVarieteIV {
  blocs: BlocRenduIV[];
  plans: readonly PlanIV[];
  recette: RecetteVarieteIV;
  format: FormatIV;
  carte: CarteImage;
  fiche: FicheImage;
  chiffresDits: LigneDeTempsIV["chiffresDits"];
  reseaux: readonly ReseauIV[];
  replis: RepliVarieteIV[];
  /** Mots de la voix calée (heures sur l'horloge de la vidéo) : l'axe typo cale chaque mot écrit sur son mot dit. */
  mots?: readonly { mot: string; debutSec: number }[];
}

/** Un axe de variété : les variantes possibles sur une image, et leur application (identité tant qu'il est un bouchon). */
export interface AxeVarieteIV {
  axe: AxeVariete;
  possibles(carte: CarteImage, format: FormatIV): CodeVariante[];
  appliquer(etape: EtapeVarieteIV): EtapeVarieteIV;
}

/**
 * Variantes possibles d'un axe, référence comprise : quand la référence (le rendu d'aujourd'hui) est tirable pour cet axe, elle
 * reste un choix honnête dès que l'image permet une autre variante (sinon une carte qui n'en permet qu'une ou deux rendait toutes
 * les vidéos pareilles, issue 124). Jamais seule : sans variante, le tirage prend la référence d'office. Une seule source pour le
 * tirage, la liste proposée à Will et les tests.
 */
const AXES_A_REFERENCE: readonly AxeVariete[] = ["recit", "chiffres", "camera", "transitions"];
const avecReference = (a: AxeVarieteIV): AxeVarieteIV => {
  const ref = REFERENCES[a.axe];
  if (!ref || !AXES_A_REFERENCE.includes(a.axe)) return a;
  return {
    ...a,
    possibles(carte, format) {
      const codes = a.possibles(carte, format);
      return codes.length && !codes.includes(ref as CodeVariante) ? [...codes, ref as CodeVariante] : codes;
    },
  };
};

/** Les axes appliqués aux blocs, dans l'ordre fixe. */
export const AXES_APPLIQUES_IV: readonly AxeVarieteIV[] = [AXE_RECIT, AXE_OUVERTURE, AXE_TYPO, AXE_CHIFFRES, AXE_CAMERA, AXE_APPARITION, AXE_FIN, AXE_TRANSITIONS, AXE_MATIERE].map(avecReference);

/** Applique la recette : chaque bloc reçoit `variete` (recette, format), puis chaque axe passe dans l'ordre fixe. */
export function appliquerVarieteIV(etape: EtapeVarieteIV): EtapeVarieteIV {
  let e: EtapeVarieteIV = { ...etape, blocs: etape.blocs.map((b) => ({ ...b, variete: { ...b.variete, recette: etape.recette, format: etape.format } })) };
  for (const axe of AXES_APPLIQUES_IV) e = axe.appliquer(e);
  return e;
}
