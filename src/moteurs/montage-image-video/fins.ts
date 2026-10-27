/**
 * IMAGE → VIDÉO · Plan des fins à 5 réseaux (plan 50 § 6, B1). PUR.
 *
 * `planDesFins` du cas concret n'est pas emprunté (4 réseaux, `offre` obligatoire, code « CC »). Celui-ci lit la banque
 * de fins EN LECTURE SEULE (jamais modifiée) et regroupe les réseaux dont la suite est identique : un fichier par segment.
 *
 * - Facebook, Instagram, TikTok, YouTube Shorts : question de commentaire (propre à l'image) PUIS fin de la banque.
 * - LinkedIn : MUET. Rien n'est dit ni affiché après la phrase-choc (décision de Will du 12/10, lignes `fin-li-*` à
 *   `dit: ""`) : la question et le lien vont dans le texte du post (`publication.ts`).
 * - Fin « diagnostic » partout tant qu'aucun cadeau réel ni mot branché : aucune promesse d'envoi. La fin au mot
 *   n'est choisie que si le cadeau existe (`cadeauReel`), le mot est valide et branché sur ce réseau.
 */
import { RESEAUX_IV, RESEAUX_IV_HISTORIQUE, type ReseauIV } from "@/domaine/image-video/plafonds";
// Pièces communes (non empruntées au cas concret) : lien suivi et code court du réseau.
import { construireLienSuivi, type ActiviteLien } from "@/domaine/mesures";
import { codeReseau } from "@/reseaux/codes";
import {
  ErreurFin,
  MOTS_DIT_MAX,
  TABLE_FINS_DIAGNOSTIC,
  appelDeLaBanque,
  estAppelACommenter,
  groupeDe,
  motValide,
  suiteDeFins,
  type FinChoisie,
  type Offre,
} from "./emprunts";
import type { FinTable } from "@/briques/fins";

export { RESEAUX_IV };
export type { ReseauIV };

export const CODE_FORMAT_IV = "IV";

export type AppelCommentaire = "question-puis-fin" | "fin-seule";

/** Texte dit d'une fin du plan (défini dans `texte-fin.ts`, sans import serveur, pour les écrans). */
export { texteDeFinIV } from "./texte-fin";

/** Fin « diagnostic » de chaque réseau, en identifiants de la banque (lecture seule). */
export const FINS_DIAGNOSTIC_IV: Readonly<Record<Exclude<ReseauIV, "linkedin">, readonly string[]>> = Object.freeze({
  facebook: ["fin-if-diagnostic-gratuit", "fin-fb-lien-commentaire"],
  instagram: ["fin-if-diagnostic-gratuit", "fin-ig-lien-profil"],
  tiktok: ["fin-ty-diagnostic-gratuit", "fin-tt-lien-profil"],
  // `fin-tt-lien-profil` est limitée à TikTok : Shorts lit la ligne de la banque Usine dont `reseaux` le couvre.
  "youtube-shorts": ["fin-ty-diagnostic-gratuit", "fin-ty-lien-profil"],
});

/** Fins au mot, seulement là où le mot est branché ET le cadeau réel (Facebook, Instagram). */
export const FINS_AU_MOT_IV: Readonly<Partial<Record<ReseauIV, readonly string[]>>> = Object.freeze({
  facebook: ["fin-if-mot", "fin-if-envoi-structure"],
  instagram: ["fin-ig-mot-abonnement"],
});

/** Ligne de question de la banque par réseau (phrase écrite à l'écran ; la phrase dite est celle de l'image). */
const QUESTION_BANQUE: Readonly<Record<Exclude<ReseauIV, "linkedin">, string>> = Object.freeze({
  facebook: "fin-if-question",
  instagram: "fin-if-question",
  tiktok: "fin-ty-question-tache",
  "youtube-shorts": "fin-ty-question-tache",
});

/** Lignes LinkedIn qui doivent rester muettes (`dit` et `ecran` vides) pour que la vidéo le soit. */
const LIGNES_LINKEDIN_MUETTES = ["fin-li-question", "fin-li-rdv-texte"] as const;

export const RAISON_LINKEDIN_NON_MUET = "La banque dit ou affiche maintenant quelque chose sur LinkedIn : la vidéo muette ne peut pas suivre, vérifiez la banque.";

export interface DemandePlanDesFinsIV {
  reseaux: readonly ReseauIV[];
  /** Offre de la carte (corrigeable au dépôt). Le coaching n'a pas de cadeau : jamais de fin au mot. */
  offre: Offre;
  /** Question propre à l'image (fiche L6). Absente : la question générique de la banque. */
  questionCommentaire?: string;
  /** Défaut `question-puis-fin`. */
  appelCommentaire?: AppelCommentaire;
  mot?: string;
  motDit?: string;
  /** Réseaux où le mot est branché. */
  motSur?: readonly ReseauIV[];
  /** Vrai seulement quand le cadeau existe réellement (jamais tant que rien n'est branché). */
  cadeauReel?: boolean;
}

export interface QuestionIV {
  dit: string;
  ecran: string;
  /** `image` : écrite pour cette image ; `banque` : phrase générique de la banque. */
  origine: "image" | "banque";
  ligne: string;
}

export interface FinIV {
  id: string;
  reseaux: ReseauIV[];
  /** LinkedIn : vrai, rien n'est dit ni affiché après la phrase-choc. */
  muet: boolean;
  question?: QuestionIV;
  appels: FinChoisie[];
  /** 15/10 : fin de secours posée après un refus de la voix (`secours.ts`) ; jamais par `planDesFinsIV`. */
  secours?: true;
  /**
   * 15/10 : repli sans lecture (`secours.ts`) : toutes les fins de secours de ce réseau ont été refusées, la version
   * reprend la question et la fin DITES du réseau nommé (même son déjà payé et validé, même rendu).
   */
  repli?: ReseauIV;
}

export interface PlanDesFinsIV {
  fins: FinIV[];
  /** Fins « diagnostic » données à la place de la fin au mot. */
  reduites: { reseaux: ReseauIV[]; raison: string }[];
  sansFin: { reseaux: ReseauIV[]; raison: string }[];
}

export const RAISON_MOT_NON_BRANCHE = "Le mot n'est pas branché sur ce réseau : la fin propose le diagnostic.";
export const RAISON_SANS_CADEAU = "Le cadeau n'existe pas encore : la fin propose le diagnostic.";
export const RAISON_SANS_CADEAU_OFFRE = "Cette offre n'a pas de document à envoyer : la fin propose le diagnostic.";

/** Une ligne de la banque (base 7), lue en lecture seule, sous la forme d'une ligne de table de fins. */
function ligneDeBanque(code: string): FinTable | null {
  const a = appelDeLaBanque(code);
  if (!a) return null;
  return { id: a.code, groupe: groupeDe(a.reseaux[0]), type: a.type, dit: a.dit, ecran: a.ecran, validee: a.etat === "valide", reseaux: a.reseaux };
}

/** Table lue : la table « diagnostic » du studio, plus les lignes de la banque Usine qui n'y sont pas (`fin-ty-lien-profil`). */
function tableIV(ids: readonly string[]): FinTable[] {
  const table: FinTable[] = [...TABLE_FINS_DIAGNOSTIC];
  for (const id of ids) {
    if (table.some((f) => f.id === id)) continue;
    const l = ligneDeBanque(id);
    if (l) table.push(l);
  }
  return table;
}

/** Code de version d'une vidéo pour un réseau : « 0042-IV-YS ». */
export function codeVersionIV(numeroVersion: number, reseau: ReseauIV): string {
  if (!Number.isInteger(numeroVersion) || numeroVersion < 1 || numeroVersion > 9999) {
    throw new ErreurFin("Le numéro de version doit être un entier entre 1 et 9999.");
  }
  return [String(numeroVersion).padStart(4, "0"), CODE_FORMAT_IV, codeReseau(reseau)].join("-");
}

/**
 * Un lien suivi par réseau (ADR 0002) : `utm_source` = le réseau, `utm_campaign` = le code de version (« 0042-IV-YS »),
 * `utm_content` = l'activité visée. Sans numéro de version, aucun code de version n'existe : une erreur (jamais un lien
 * sans rattachement). Deux réseaux n'ont jamais le même lien.
 */
export function liensSuivisIV(reseaux: readonly ReseauIV[], numeroVersion: number | undefined, activite: ActiviteLien = "clients"): Record<string, string> {
  if (numeroVersion === undefined) throw new ErreurFin("Le numéro de la version est introuvable : le lien suivi (code de version) ne peut pas être posé.");
  return Object.fromEntries(
    [...new Set(reseaux)].map((r) => [r, construireLienSuivi({ typeLien: "video", reseau: r, code: codeVersionIV(numeroVersion, r), activite, page: "/fr/diagnostic" })]),
  );
}

/**
 * Contrôle de la question de commentaire : ≤ 12 mots, pas de lien, pas de mot à commenter (« Écrivez… en commentaire »,
 * « Commentez… »). Rend la phrase simple de refus, ou `null` si la question tient.
 */
export function refusQuestion(question: string): string | null {
  const q = question.trim();
  if (!q) return "La question de commentaire est vide.";
  if (q.split(/\s+/).length > MOTS_DIT_MAX) return `La question compte plus de ${MOTS_DIT_MAX} mots : raccourcissez-la.`;
  if (/https?:\/\/|www\.|\.(com|fr|net)\b/i.test(q)) return "La question ne doit contenir aucun lien.";
  if (estAppelACommenter({ type: "question", dit: q, ecran: "" })) return "La question ne doit pas demander d'écrire un mot en commentaire.";
  return null;
}

function questionPour(reseau: Exclude<ReseauIV, "linkedin">, texte: string | undefined): QuestionIV {
  const ligne = QUESTION_BANQUE[reseau];
  const l = appelDeLaBanque(ligne);
  if (!l || l.etat !== "valide") throw new ErreurFin(`La question de la banque « ${ligne} » n'est pas disponible.`);
  const propre = texte?.trim();
  return { dit: propre || l.dit, ecran: l.ecran, origine: propre ? "image" : "banque", ligne };
}

/** Choix de la suite de fins d'un réseau vidéo : fin au mot si tout est branché, sinon fin « diagnostic ». */
function suiteDe(reseau: Exclude<ReseauIV, "linkedin">, d: DemandePlanDesFinsIV, table: readonly FinTable[]): { ids: readonly string[]; raison?: string } {
  const auMot = FINS_AU_MOT_IV[reseau];
  const diagnostic = FINS_DIAGNOSTIC_IV[reseau];
  // Personne n'a demandé de mot, ou ce réseau n'a pas de fin au mot : fin « diagnostic », sans raison à donner.
  if (!auMot || !d.mot) return { ids: diagnostic };
  if (!d.motSur?.includes(reseau)) return { ids: diagnostic, raison: RAISON_MOT_NON_BRANCHE };
  if (!d.cadeauReel) return { ids: diagnostic, raison: RAISON_SANS_CADEAU };
  if (d.offre === "coaching") return { ids: diagnostic, raison: RAISON_SANS_CADEAU_OFFRE };
  if (!d.mot || !motValide(d.mot)) return { ids: diagnostic, raison: RAISON_MOT_NON_BRANCHE };
  if (auMot.some((id) => table.find((f) => f.id === id)?.validee !== true)) return { ids: diagnostic, raison: "La fin au mot n'est pas encore validée : la fin propose le diagnostic." };
  return { ids: auMot };
}

/** Plan des fins des 5 réseaux : une fin par suite distincte (question comprise), regroupant les réseaux identiques. */
export function planDesFinsIV(demande: DemandePlanDesFinsIV): PlanDesFinsIV {
  const reglage: AppelCommentaire = demande.appelCommentaire ?? "question-puis-fin";
  if (demande.questionCommentaire !== undefined && reglage === "question-puis-fin") {
    const refus = refusQuestion(demande.questionCommentaire);
    if (refus) throw new ErreurFin(refus);
  }
  const reseaux = RESEAUX_IV.filter((r) => demande.reseaux.includes(r));
  const tous = [...Object.values(FINS_DIAGNOSTIC_IV).flat(), ...Object.values(FINS_AU_MOT_IV).flat()];
  const table = tableIV(tous);
  const options = { ...(demande.mot ? { mot: demande.mot } : {}), ...(demande.motDit ? { motDit: demande.motDit } : {}) };

  const groupes = new Map<string, FinIV & { raison?: string }>();
  const sansFin: PlanDesFinsIV["sansFin"] = [];
  const reduites: PlanDesFinsIV["reduites"] = [];

  for (const reseau of reseaux) {
    if (reseau === "linkedin") {
      const muet = LIGNES_LINKEDIN_MUETTES.every((c) => {
        const a = appelDeLaBanque(c);
        return a !== null && a.dit === "" && a.ecran === "";
      });
      if (!muet) {
        sansFin.push({ reseaux: ["linkedin"], raison: RAISON_LINKEDIN_NON_MUET });
        continue;
      }
      groupes.set("linkedin", { id: "fin-linkedin", reseaux: ["linkedin"], muet: true, appels: [] });
      continue;
    }
    const { ids, raison } = suiteDe(reseau, demande, table);
    let appels: FinChoisie[];
    try {
      appels = suiteDeFins(reseau, ids, options, table);
    } catch (e) {
      if (!(e instanceof ErreurFin)) throw e;
      sansFin.push({ reseaux: [reseau], raison: e.message });
      continue;
    }
    const question = reglage === "question-puis-fin" ? questionPour(reseau, demande.questionCommentaire) : undefined;
    const cle = [question?.dit ?? "", question?.ecran ?? "", ...ids].join("|");
    const g = groupes.get(cle);
    if (g) g.reseaux.push(reseau);
    else groupes.set(cle, { id: "", reseaux: [reseau], muet: false, ...(question ? { question } : {}), appels, ...(raison ? { raison } : {}) });
  }

  const fins: FinIV[] = [];
  for (const g of groupes.values()) {
    const { raison, ...fin } = g;
    fins.push({ ...fin, id: fin.muet ? fin.id : `fin-${fin.reseaux.join("-")}` });
    if (raison) reduites.push({ reseaux: [...fin.reseaux], raison });
  }
  fins.sort((a, b) => RESEAUX_IV_HISTORIQUE.indexOf(a.reseaux[0]) - RESEAUX_IV_HISTORIQUE.indexOf(b.reseaux[0]));
  return { fins, reduites, sansFin };
}
