/**
 * TIRAGE de la variété « Image → vidéo » (PUR) : une recette (un code par axe) tirée de façon DÉTERMINISTE par une
 * graine (l'identifiant de la vidéo). Rang = sha256(`graine|axe|k`) modulo le nombre de variantes possibles sur cette
 * image : aucun hasard, jamais l'heure. `k` augmente tant que l'historique refuse la recette (lot TIR).
 */
import { createHash } from "node:crypto";
import { AXES_VARIETE, REFERENCES, tirablesDe, type AxeVariete, type CodesParAxe, type FormatIV, type RecetteVarieteIV } from "@/briques/schema-motion/variete";
import type { CarteImage } from "@/domaine/image-video/carte";
import type { ReseauIV } from "@/domaine/image-video/plafonds";
import { accepteHistoriqueIV, meilleurRepliIV } from "./historique";
import { AXES_APPLIQUES_IV } from "./index";

export { tirablesDe };

/** Recette de référence : le rendu d'aujourd'hui (l'ouverture actuelle ≈ OUV-D). */
export const RECETTE_REFERENCE_IV: RecetteVarieteIV = Object.freeze({
  ouverture: "OUV-D",
  recit: "REC-A",
  chiffres: "CHI-A",
  camera: "CAM-A",
  texte: "TYP-A",
  apparition: "APP-A",
  transitions: "TRA-A",
  fin: "FIN-A",
  matiere: "MAT-A",
  sousTitres: "SOU-B",
  fond: "FON-A",
  rail: "RAI-A",
  objets: "OBJ-A",
  entete: "ENT-A",
});

/** Essais au plus avant de garder la première recette (historique trop exigeant). */
const ESSAIS_MAX = 20;

/** Ouvertures qui conviennent à chaque format, par ordre de préférence (doc 73 § 2). */
export const OUVERTURES_PAR_FORMAT: { readonly [F in FormatIV]: readonly CodesParAxe["ouverture"][] } = Object.freeze({
  "9:16": ["OUV-A", "OUV-D", "OUV-C"],
  "4:5": ["OUV-B", "OUV-E", "OUV-A"],
});

/** Substitutions d'une version 4:5 (LinkedIn, fil Facebook) : ce qui ne tient pas dans le cadre bas. SOU-D retombe sur SOU-B au rendu si Q22 4:5 échoue (`codeSousTitresIV`). */
const SUBSTITUTIONS_4_5: Partial<Record<string, string>> = Object.freeze({ "TYP-B": "TYP-C", "SOU-C": "SOU-D", "FIN-C": "FIN-D", "CAM-E": "CAM-B" });

const rang = (cle: string, n: number) => parseInt(createHash("sha256").update(cle).digest("hex").slice(0, 12), 16) % n;

/** Codes possibles d'un axe sur cette image (l'axe le dit ; les sous-titres, lus au rendu, n'ont pas d'axe appliqué). */
function possibles(axe: AxeVariete, carte: CarteImage, format: FormatIV): readonly string[] {
  const tirables = tirablesDe(axe) as readonly string[];
  const a = AXES_APPLIQUES_IV.find((x) => x.axe === axe);
  return a ? a.possibles(carte, format).filter((c) => tirables.includes(c)) : tirables;
}

function tirer(graine: string, carte: CarteImage, format: FormatIV, k: number): RecetteVarieteIV {
  const r: Record<string, string> = {};
  for (const axe of AXES_VARIETE) {
    const p = possibles(axe, carte, format);
    r[axe] = p.length ? p[rang(`${graine}|${axe}|${k}`, p.length)] : (REFERENCES[axe] ?? RECETTE_REFERENCE_IV[axe]);
  }
  return r as RecetteVarieteIV;
}

/**
 * Tire la recette d'une vidéo : même graine, même carte, même format → même recette. Si aucun essai ne passe
 * l'historique, la moins ressemblante des candidates (lot TIR) : jamais de blocage.
 */
export function tirerVarieteIV(o: { graine: string; carte: CarteImage; format: FormatIV; historique?: readonly RecetteVarieteIV[] }): RecetteVarieteIV {
  const historique = o.historique ?? [];
  const candidats: RecetteVarieteIV[] = [];
  for (let k = 0; k < ESSAIS_MAX; k++) {
    const r = tirer(o.graine, o.carte, o.format, k);
    if (accepteHistoriqueIV(r, historique)) return r;
    candidats.push(r);
  }
  return meilleurRepliIV(candidats, historique);
}

/**
 * Ouverture d'un format quand celle tirée n'y convient pas (lot F) : une correspondance FIXE, par parenté d'image
 * (avant / après → le résultat d'abord ; détail → situation précise ; question → avant / après…). Deux vidéos d'ouvertures
 * tirées différentes (l'historique y veille) gardent ainsi le plus souvent des ouvertures différentes dans chaque format ;
 * un nouveau tirage par version faisait tomber les trois vidéos de la répétition générale sur la même en 9:16.
 */
const OUVERTURE_DU_FORMAT: { readonly [F in FormatIV]: Readonly<Partial<Record<CodesParAxe["ouverture"], CodesParAxe["ouverture"]>>> } = Object.freeze({
  "9:16": Object.freeze({ "OUV-B": "OUV-A", "OUV-E": "OUV-C" }),
  "4:5": Object.freeze({ "OUV-D": "OUV-B", "OUV-C": "OUV-E" }),
});

/**
 * Recette d'une version (groupe de réseaux, format) : en 4:5, les substitutions du cadre bas ; l'ouverture devient
 * celle qui convient au format si la sienne n'y est pas (correspondance fixe ; les mots dits ne changent pas).
 */
export function recettePourVersion(recette: RecetteVarieteIV, reseaux: readonly ReseauIV[], format: FormatIV): RecetteVarieteIV {
  const r: Record<string, string> = { ...recette };
  if (format === "4:5") for (const axe of AXES_VARIETE) r[axe] = SUBSTITUTIONS_4_5[r[axe]] ?? r[axe];
  const ouvertures = OUVERTURES_PAR_FORMAT[format];
  if (!(ouvertures as readonly string[]).includes(r.ouverture)) r.ouverture = OUVERTURE_DU_FORMAT[format][recette.ouverture] ?? ouvertures[rang(`${JSON.stringify(recette)}|${[...reseaux].sort().join(",")}|${format}`, ouvertures.length)];
  return r as RecetteVarieteIV;
}
