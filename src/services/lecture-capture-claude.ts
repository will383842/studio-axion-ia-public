/**
 * CLAUDE LIT LES CHIFFRES D'UNE CAPTURE DU TABLEAU DE BORD (G4-07-b) : branche la requête préparée par G4-07-a
 * (`requeteLectureCapture`, `lireLectureCapture`) sur le chemin gardé de l'argent (`executerRolePourVideo`, reçu par
 * injection). Aucun appel direct à Claude ici : ni `client.ts` en valeur, ni `fetch`.
 *
 *  - ÉTEINT PAR DÉFAUT : sans le réglage `tableau.lectureCaptureClaude` à exactement `true`, aucun appel : repli.
 *  - UN SEUL modèle : `claude-sonnet-5-5`, même si la requête de la brique en porte un autre.
 *  - PLAFOND DUR en code : 0,25 € pour cet usage et 1,25 € pour les trois usages de Claude d'une même vidéo, contrôlés
 *    AVANT l'appel, quel que soit le mode du budget (indicatif ou non) et quel que soit le réglage de plafond.
 *  - Le résultat est un BROUILLON : tous les chiffres sont à confirmer par Williams. Échec ou refus : saisie à la main.
 *  - Ne lève jamais. Aucun montant dans les phrases rendues.
 */
import "server-only";
import { lireLectureCapture, requeteLectureCapture, type ChiffreARelire, type ImageCapture } from "@/briques/donnees-video/lecture-capture";
import type { TableauDeBord } from "@/briques/donnees-video/types";
import type { CommandeFabrication, Id } from "@/domaine/types";
import type { ImageClaude } from "@/fournisseurs/claude/client";
import { pireCasUsd } from "@/fournisseurs/claude/tarifs";
import { pireCasRequete, type DefinitionRole, type EntreeRole } from "@/generateur/roles/types";
import type { executerRolePourVideo } from "./depense-claude-video";

/** Le seul modèle permis pour ces usages. */
export const MODELE_CLAUDE_VIDEO = "claude-sonnet-5-5";
export const PARAM_LECTURE_CAPTURE_CLAUDE = "tableau.lectureCaptureClaude";
export const PARAM_PLAFOND_LECTURE_CAPTURE = "tableau.plafondLectureCaptureUsd";
export const ETAPE_LECTURE_CAPTURE = "Tableau de bord · lecture capture";

/** Table commune aux trois usages de Claude d'une vidéo : identique dans les trois fichiers. */
export const PLAFONDS_CLAUDE_VIDEO_EUR = Object.freeze({ dmpln: 0.85, tbnar: 0.15, tblec: 0.25 } as const);
export const PLAFOND_TOTAL_CLAUDE_VIDEO_EUR = 1.25;
export const PREFIXES_ETAPE_CLAUDE_VIDEO = Object.freeze({ dmpln: "Démo · plan de scènes", tbnar: "Tableau de bord · narration", tblec: "Tableau de bord · lecture capture" } as const);

/** Réglages de plafond des deux autres usages (lus seulement par le compteur, jamais écrits). */
const PARAM_PLAFOND_PLAN = "demoFacecam.plafondPlanUsd";
const PARAM_PLAFOND_NARRATION = "tableau.plafondNarrationUsd";

/** Jetons d'une image au palier haute résolution : ⌈l/28⌉ × ⌈h/28⌉, au plus 4 784. */
export const JETONS_IMAGE_MAX = 4784;
/** Ce que `pireCasRequete` compte déjà pour une image. */
const JETONS_IMAGE_DEJA_COMPTES = 1600;
/** Même marge que le pré-vol d'`executerRolePourVideo`. */
const MARGE = 1.2;

type PlafondPropre = NonNullable<Parameters<typeof executerRolePourVideo>[3]["plafondPropre"]>;
type Lire = <T>(id: string, defaut: T) => Promise<T>;

export type ResultatLectureCaptureClaude =
  | { ok: true; brouillon: TableauDeBord; aRelire: ChiffreARelire[]; source: "claude" }
  | { ok: false; repli: "saisie-manuelle"; raison: string };

export type DepsLectureCapture = {
  executer?: typeof executerRolePourVideo;
  engage?: (videoId: Id, plafond: PlafondPropre) => Promise<number>;
  taux?: () => Promise<number>;
  lire?: Lire;
};

/** Vrai SEULEMENT si la valeur lue est exactement `true` (absente, `"true"`, `1`, lecture en échec : éteint). */
export async function lectureCaptureClaudeActive(lire?: Lire): Promise<boolean> {
  try {
    const l = lire ?? (await import("./_commun")).lireParametre;
    return (await l<unknown>(PARAM_LECTURE_CAPTURE_CLAUDE, false)) === true;
  } catch {
    return false;
  }
}

export function jetonsImage(largeur: number, hauteur: number): number {
  return Math.min(JETONS_IMAGE_MAX, Math.ceil(largeur / 28) * Math.ceil(hauteur / 28));
}

/** Pire cas, en dollars : celui de la requête, plus le surplus de l'image au vrai prix. Jamais sous-estimé. */
export function pireCasLectureCaptureUsd(role: DefinitionRole, entree: EntreeRole, image: Pick<ImageCapture, "largeur" | "hauteur">): number {
  const surplus = Math.max(0, jetonsImage(image.largeur, image.hauteur) - JETONS_IMAGE_DEJA_COMPTES);
  return pireCasRequete(role, entree) + pireCasUsd(role.modele, surplus, 0);
}

const plafondDe = (id: keyof typeof PLAFONDS_CLAUDE_VIDEO_EUR, parametre: string): PlafondPropre =>
  ({ id, parametre, defautUsd: PLAFONDS_CLAUDE_VIDEO_EUR[id], prefixeEtape: PREFIXES_ETAPE_CLAUDE_VIDEO[id] }) as unknown as PlafondPropre;

const repli = (raison: string): ResultatLectureCaptureClaude => ({ ok: false, repli: "saisie-manuelle", raison });
const SAISIE = "Saisis les chiffres à la main.";

/**
 * Lit une capture avec Claude, ou rend le repli (saisie à la main) sans rien payer. Au plus UN appel par invocation.
 * `origine` : celle de la commande de fabrication, transmise telle quelle à la garde d'argent.
 */
export async function lireCaptureTableau(videoId: Id, image: ImageCapture, origine: CommandeFabrication["origine"], deps: DepsLectureCapture = {}): Promise<ResultatLectureCaptureClaude> {
  try {
    if (!(await lectureCaptureClaudeActive(deps.lire))) return repli(`La lecture par Claude est éteinte. ${SAISIE}`);
    const requete = requeteLectureCapture(image, MODELE_CLAUDE_VIDEO);
    if ("refus" in requete) return repli(`${requete.refus} ${SAISIE}`);
    const message = requete.messages[0];
    const role: DefinitionRole = {
      id: "tableau-lecture-capture",
      version: 1,
      consigne: requete.systeme.map((b) => b.texte).join("\n\n"),
      modele: MODELE_CLAUDE_VIDEO,
      effort: requete.effort,
      maxTokens: requete.maxTokens,
      sansPhrasesFixes: true,
      simuler: () => "",
    };
    const jointes: ImageClaude[] = message.images ?? [];
    const entree: EntreeRole = { contexte: {}, variable: message.contenu, images: jointes };

    // Plafond dur : refus sans appel, quel que soit le mode du budget et le réglage de plafond.
    const demande = Math.ceil(pireCasLectureCaptureUsd(role, entree, image) * 100 * MARGE);
    const t = await (deps.taux ?? (async () => (await import("./generation-claude")).taux()))();
    const engage = deps.engage ?? (await import("./depense-claude-video")).engagePlafondPropreCentimes;
    // Limite en centimes de $ ; négative (refus) si le taux est inutilisable (NaN, 0, négatif, infini).
    const enCentimes = (eur: number) => (Number.isFinite(t) && t > 0 ? Math.floor(Math.round(eur * 100) / t) : -1);
    const valide = (n: unknown): n is number => typeof n === "number" && Number.isFinite(n) && n >= 0;
    const mien = plafondDe("tblec", PARAM_PLAFOND_LECTURE_CAPTURE);
    const engageMien = await engage(videoId, mien);
    const autres = (await engage(videoId, plafondDe("dmpln", PARAM_PLAFOND_PLAN))) + (await engage(videoId, plafondDe("tbnar", PARAM_PLAFOND_NARRATION)));
    // Un montant invalide ne doit jamais laisser passer l'appel payant.
    if (!valide(demande) || !valide(engageMien) || !valide(autres)) return repli(`La limite de Claude pour cette vidéo ne peut pas être vérifiée : rien n'a été payé. ${SAISIE}`);
    if (engageMien + demande > enCentimes(PLAFONDS_CLAUDE_VIDEO_EUR.tblec)) return repli(`La limite de lecture des captures pour cette vidéo est atteinte : rien n'a été payé. ${SAISIE}`);
    if (autres + engageMien + demande > enCentimes(PLAFOND_TOTAL_CLAUDE_VIDEO_EUR)) return repli(`La limite de Claude pour cette vidéo est atteinte : rien n'a été payé. ${SAISIE}`);

    const executer = deps.executer ?? (await import("./depense-claude-video")).executerRolePourVideo;
    const r = await executer(videoId, role, entree, { etape: ETAPE_LECTURE_CAPTURE, plafondPropre: mien, origine });
    if (!r.ok) return repli(`Claude n'a pas été appelé : rien n'a été payé. ${SAISIE}`);
    if (r.simule || !r.texte?.trim()) return repli(`Claude n'a rien rendu pour cette capture. ${SAISIE}`);
    const lu = lireLectureCapture(r.texte);
    if (!lu.ok) return repli(`La lecture de la capture n'est pas utilisable. ${SAISIE}`);
    return { ok: true, brouillon: lu.brouillon, aRelire: lu.aRelire, source: "claude" };
  } catch {
    return repli(`La lecture par Claude a échoué. ${SAISIE}`);
  }
}
