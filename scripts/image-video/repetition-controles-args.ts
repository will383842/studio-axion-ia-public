/**
 * Pièces PURES du script de répétition des contrôles (aucun effet de bord à l'import) : lecture des arguments et
 * aiguillage de l'état de fabrication. Testées dans `tests/image-video/repetition-controles-script.test.ts`.
 */
import type { EtatFabricationIV } from "../../src/moteurs/montage-image-video/fabrication";

export class ErreurArgumentsRepetition extends Error {}

export const USAGE_REPETITION =
  "Usage : repetition-controles.mts trav-xxxxxxxxxxxx | --tous [--depuis <date ISO>] [--limite <n>] | --fichier <etat.json>  [--json] [--images]";

export interface ArgumentsRepetition {
  id?: string;
  tous: boolean;
  fichier?: string;
  depuis?: string;
  limite?: number;
  json: boolean;
  images: boolean;
}

const DRAPEAUX = ["--json", "--tous", "--images"];
const AVEC_VALEUR = ["--fichier", "--depuis", "--limite"];

/** Lit la ligne de commande. Lève `ErreurArgumentsRepetition` (message en français). */
export function lireArgumentsRepetition(argv: readonly string[]): ArgumentsRepetition {
  const drapeaux = new Set<string>();
  const valeurs = new Map<string, string>();
  const libres: string[] = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (DRAPEAUX.includes(a)) drapeaux.add(a);
    else if (AVEC_VALEUR.includes(a)) {
      const x = argv[i + 1];
      if (x === undefined || x === "" || x.startsWith("--")) throw new ErreurArgumentsRepetition(`Il manque la valeur de ${a}.`);
      valeurs.set(a, x);
      i++;
    } else if (a.startsWith("--")) throw new ErreurArgumentsRepetition(`Option inconnue : ${a}.`);
    else libres.push(a);
  }
  if (libres.length > 1) throw new ErreurArgumentsRepetition(`Un seul travail à la fois (reçu : ${libres.join(", ")}).`);
  const id = libres[0];
  const tous = drapeaux.has("--tous");
  const fichier = valeurs.get("--fichier");
  const depuis = valeurs.get("--depuis");
  const limiteBrute = valeurs.get("--limite");
  if (Number(Boolean(id)) + Number(tous) + Number(fichier !== undefined) !== 1) throw new ErreurArgumentsRepetition("Choisissez un seul mode : un travail, --tous ou --fichier.");
  if (depuis !== undefined && (!tous || Number.isNaN(Date.parse(depuis)))) throw new ErreurArgumentsRepetition("--depuis demande --tous et une date ISO lisible.");
  let limite: number | undefined;
  if (limiteBrute !== undefined) {
    limite = Number(limiteBrute);
    if (!tous || !Number.isInteger(limite) || limite < 1) throw new ErreurArgumentsRepetition("--limite demande --tous et un entier d'au moins 1.");
  }
  return { ...(id ? { id } : {}), tous, ...(fichier !== undefined ? { fichier } : {}), ...(depuis !== undefined ? { depuis } : {}), ...(limite !== undefined ? { limite } : {}), json: drapeaux.has("--json"), images: drapeaux.has("--images") };
}

/** L'état de fabrication : l'état lui-même (`--fichier`) ou celui d'un travail (`parametres.imageVideo`). */
export function etatDe(x: unknown): EtatFabricationIV | null {
  const o = x as { version?: string; parametres?: { imageVideo?: unknown } } | null;
  if (o?.version === "fabrication-iv/1") return o as EtatFabricationIV;
  const e = o?.parametres?.imageVideo as EtatFabricationIV | undefined;
  return e?.version === "fabrication-iv/1" ? e : null;
}
