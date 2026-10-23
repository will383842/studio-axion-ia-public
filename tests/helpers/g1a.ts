/**
 * Aides des tests du lot G1a (générateur de scripts) : session d'essai, matière vraie, format d'essai inscrit PAR DES
 * DONNÉES depuis `tests/` (le générateur central ne le nomme jamais, plan v5 B.4.0).
 */
import { hash } from "@node-rs/argon2";
import type { DefinitionFormat } from "@/formats/types";
import { codeDuFormat } from "@/formats/registre-codes";
import type { Matiere, ModeDeclinaison, TypeMatiere } from "@/domaine/types";

export async function preparerMotDePasse(mdp: string): Promise<void> {
  process.env.SESSION_SECRET = "g".repeat(48);
  const empreinte = await hash(mdp, { algorithm: 2, memoryCost: 19456, timeCost: 2, parallelism: 1 });
  process.env.STUDIO_PASSWORD_HASH_B64 = Buffer.from(empreinte).toString("base64");
}

let compteur = 0;

/** Une matière vraie, validée (saisie par Will). */
export function matiere(texte: string, type: TypeMatiere = "anecdote-will", extra: Partial<Matiere> = {}): Matiere {
  const le = new Date(Date.UTC(2026, 9, 1, 8, 0, compteur)).toISOString();
  compteur++;
  return {
    id: `mat-essai-${compteur}`,
    type,
    texte,
    source: { origine: "dictee", date: le },
    motsCles: [],
    saisiePar: "will",
    statut: "validee",
    creeLe: le,
    modifieLe: le,
    ...extra,
  };
}

/**
 * Format d'essai « test » (famille face caméra, code TST réservé aux essais) : une COPIE de données d'un format existant,
 * avec ses propres blocs. Ne touche à aucun fichier de `src/`.
 */
export function formatEssai(base: DefinitionFormat, id: string, declinaison: ModeDeclinaison, codeClassement?: string): DefinitionFormat {
  return {
    ...base,
    id,
    nom: `Format d'essai ${id}`,
    nomCourt: "Essai",
    statut: "masque",
    famille: "face-camera",
    codeClassement: codeClassement ?? codeDuFormat(id) ?? "TST",
    declinaison,
    reseauxConseilles: ["tiktok", "instagram", "facebook", "linkedin", "youtube-shorts"],
    recetteScript: {
      ...base.recetteScript,
      blocs: [
        { id: "accroche", nom: "Accroche", couleur: "orange", consigne: "", dureeCibleSec: [1, 3] },
        { id: "promesse", nom: "Promesse", couleur: "ambre", consigne: "", dureeCibleSec: [2, 4] },
        { id: "milieu", nom: "Milieu", couleur: "sauge", consigne: "", dureeCibleSec: [10, 25] },
        { id: "preuve", nom: "Preuve", couleur: "texte-doux", consigne: "", dureeCibleSec: [3, 8] },
        { id: "appel", nom: "Appel", couleur: "orange-vif", consigne: "", dureeCibleSec: [2, 5] },
        { id: "boucle", nom: "Boucle", couleur: "brique", consigne: "", dureeCibleSec: [1, 3] },
      ],
      version: 4,
      segmentsFacultatifsMax: 1,
    },
  };
}
