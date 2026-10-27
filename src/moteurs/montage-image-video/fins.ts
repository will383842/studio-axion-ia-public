/**
 * IMAGE → VIDÉO · Plan des fins à 5 réseaux (plan 50 § 6, B1). PUR.
 *
 * `planDesFins` du cas concret n'est pas emprunté (4 réseaux, `offre` obligatoire, code « CC »). Celui-ci lit la banque
 * de fins EN LECTURE SEULE (jamais modifiée) et regroupe les réseaux dont la suite est identique : un fichier par segment.
 *
 * FINS DE 26/10/2026 (validées par Will) : une fin = ACCROCHE + APPEL + PHRASE DU LIEN, dits à la suite, IDENTIQUES sur
 * tous les réseaux d'une même vidéo ; seule la phrase du lien change selon le réseau (Instagram et TikTok : « dans mon
 * profil » ; Shorts : « sur ma chaîne » ; Facebook et LinkedIn : « en premier commentaire »). Une seule demande par fin :
 * la question de commentaire n'est plus posée par défaut (`appelCommentaire` = `fin-seule`) ; le réglage
 * `question-puis-fin` existe toujours (la question passe alors AVANT la fin).
 * - Le choix est PUR et déterministe, à partir du numéro de version (`choixDeFinIV`) : une vidéo sur quatre une fin
 *   « Tour de France IA » (désactivée tant que la page du Tour n'est pas connue), les autres un appel diagnostic (deux
 *   sur trois) ou accompagnement (un sur trois) ; jamais la même accroche sur deux numéros consécutifs.
 * - LinkedIn n'est plus muet : il dit et affiche la fin comme les autres. Le drapeau `muet` ne reste que pour LIRE les
 *   plans des vidéos faites avant (jamais produit ici).
 * - La fin au mot ne passe que si le cadeau existe (`cadeauReel`), le mot est valide et branché sur ce réseau : sa suite
 *   (mot, envoi) est celle d'avant, inchangée.
 */
import { RESEAUX_IV, RESEAUX_IV_HISTORIQUE, type ReseauIV } from "@/domaine/image-video/plafonds";
// Pièces communes (non empruntées au cas concret) : lien suivi et code court du réseau.
import { PAGES_LIEN, construireLienSuivi, type ActiviteLien } from "@/domaine/mesures";
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
import { nombreMots, type FinTable } from "@/briques/fins";

export { RESEAUX_IV };
export type { ReseauIV };

export const CODE_FORMAT_IV = "IV";

export type AppelCommentaire = "question-puis-fin" | "fin-seule";

/** Texte dit d'une fin du plan (défini dans `texte-fin.ts`, sans import serveur, pour les écrans). */
export { texteDeFinIV } from "./texte-fin";

/** Ancienne fin « diagnostic » de chaque réseau (avant le 26/10/2026), gardée pour mémoire : `planDesFinsIV` ne la choisit plus. */
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

/** Ligne de question de la banque par réseau (phrase écrite à l'écran ; la phrase dite est celle de l'image). Réglage `question-puis-fin` seulement. */
const QUESTION_BANQUE: Readonly<Record<ReseauIV, string>> = Object.freeze({
  facebook: "fin-if-question",
  instagram: "fin-if-question",
  linkedin: "fin-if-question",
  tiktok: "fin-ty-question-tache",
  "youtube-shorts": "fin-ty-question-tache",
});

/* ------------------------------------------------------------------ */
/* Choix de la fin d'une vidéo (26/10/2026)                              */
/* ------------------------------------------------------------------ */

export type SorteFinIV = "diagnostic" | "accompagnement" | "tour";

/** Accroches des fins « appel » (treize phrases validées), dans l'ordre de la banque. */
export const ACCROCHES_APPEL_IV: readonly string[] = Object.freeze(Array.from({ length: 13 }, (_, i) => `fin-iv-accroche-${String(i + 1).padStart(2, "0")}`));
export const APPELS_DIAGNOSTIC_IV: readonly string[] = Object.freeze([1, 2, 3, 4].map((i) => `fin-iv-appel-diagnostic-0${i}`));
export const APPELS_ACCOMPAGNEMENT_IV: readonly string[] = Object.freeze([1, 2, 3].map((i) => `fin-iv-appel-accompagnement-0${i}`));
export const ACCROCHES_TOUR_IV: readonly string[] = Object.freeze([1, 2, 3, 4, 5, 6].map((i) => `fin-iv-tour-accroche-0${i}`));
export const INVITATIONS_TOUR_IV: readonly string[] = Object.freeze([1, 2, 3, 4, 5].map((i) => `fin-iv-tour-invitation-0${i}`));

/** Phrase du lien de chaque réseau (lignes de la banque ; Instagram et TikTok partagent la leur, Facebook et LinkedIn la leur). */
export const LIEN_FIN_IV: Readonly<Record<ReseauIV, string>> = Object.freeze({
  instagram: "fin-iv-lien-profil",
  tiktok: "fin-iv-lien-profil",
  "youtube-shorts": "fin-iv-lien-chaine",
  facebook: "fin-iv-lien-commentaire",
  linkedin: "fin-iv-lien-commentaire",
});

/**
 * Tour activé : un quart des vidéos au Tour (n ≡ 0 mod 4), un tiers à l'accompagnement (quatre restes sur douze, hors Tour),
 * le reste (cinq sur douze) au diagnostic.
 */
const RESIDUS_ACCOMPAGNEMENT_TOUR: readonly number[] = Object.freeze([2, 5, 7, 10]);

/** Une vidéo sur `TOUR_UN_SUR` prend la fin « Tour de France IA » (quand elle est activée). */
export const TOUR_UN_SUR = 4;

/**
 * Page du Tour de France IA, vers laquelle pointe le lien suivi de la fin « Tour ». LE CHEMIN EXACT N'EST PAS CONNU
 * (rien dans le dépôt) : il n'est pas deviné. Tant que cette constante vaut `null`, les fins « Tour » sont DÉSACTIVÉES
 * (tirage zéro sur quatre) : toutes les vidéos prennent un appel. Pour les activer : écrire ici le chemin (« /fr/… ») ET
 * l'ajouter à `PAGES_LIEN` (`domaine/mesures.ts`), seul endroit où un lien suivi peut viser une page.
 */
export const PAGE_TOUR_DE_FRANCE_IA: (typeof PAGES_LIEN)[number] | null = null;
/** Page des fins « appel » (inchangée : le diagnostic). */
export const PAGE_FIN_APPEL_IV = "/fr/diagnostic" as const;

/** Vrai quand les fins « Tour » peuvent être tirées : la page du Tour est connue ET permise pour un lien suivi. */
export const finsTourActivesIV = (): boolean => PAGE_TOUR_DE_FRANCE_IA !== null && (PAGES_LIEN as readonly string[]).includes(PAGE_TOUR_DE_FRANCE_IA);

export interface ChoixFinIV {
  sorte: SorteFinIV;
  /** Code de banque de l'accroche et de l'appel (ou de l'invitation du Tour) : les mêmes pour tous les réseaux. */
  accroche: string;
  appel: string;
}

/** Plafond de mots d'une fin « appel » (accroche + appel + phrase du lien) : 29 mots, soit 8 à 9 s au débit réel de 3,3 mots/s. */
export const MOTS_FIN_APPEL_MAX = 29;

const motsDeLigne = (code: string): number => {
  const l = appelDeLaBanque(code);
  if (!l) throw new ErreurFin(`La fin « ${code} » est absente de la banque.`);
  return nombreMots(l.dit);
};

/** Paires (accroche, appel) d'une sorte qui tiennent sous le plafond, phrase du lien la plus longue comprise. */
export function pairesAppelIV(appels: readonly string[]): { accroche: string; appels: string[] }[] {
  const lien = Math.max(...Object.values(LIEN_FIN_IV).map(motsDeLigne));
  return ACCROCHES_APPEL_IV.map((accroche) => ({ accroche, appels: appels.filter((p) => motsDeLigne(accroche) + motsDeLigne(p) + lien <= MOTS_FIN_APPEL_MAX) })).filter((x) => x.appels.length > 0);
}

/** Sorte d'un numéro hors Tour : accompagnement un sur trois (Tour désactivé : n ≡ 2 mod 3 ; activé : `RESIDUS_ACCOMPAGNEMENT_TOUR`). */
const estAccompagnement = (n: number, tourActif: boolean): boolean => (tourActif ? RESIDUS_ACCOMPAGNEMENT_TOUR.includes(n % 12) : n % 3 === 2);

/**
 * Accroche et appel de chaque numéro hors Tour (1 à 9999), calculés une fois par réglage : chaque sorte parcourt ses
 * accroches utilisables (celles qui ont au moins un appel sous le plafond) dans l'ordre, en sautant celle du numéro
 * précédent ; l'appel tourne parmi ceux que son accroche permet, à chaque retour de cette accroche.
 */
const FINS_MEMO = new Map<boolean, { accroche: string; appel: string }[]>();
function tableDesFinsIV(tourActif: boolean): { accroche: string; appel: string }[] {
  const memo = FINS_MEMO.get(tourActif);
  if (memo) return memo;
  const paires = { diagnostic: pairesAppelIV(APPELS_DIAGNOSTIC_IV), accompagnement: pairesAppelIV(APPELS_ACCOMPAGNEMENT_IV) };
  const vus = { diagnostic: 0, accompagnement: 0 };
  const retours = new Map<string, number>();
  const table: { accroche: string; appel: string }[] = [{ accroche: "", appel: "" }];
  for (let n = 1; n <= 9999; n++) {
    if (tourActif && n % TOUR_UN_SUR === 0) {
      table.push({ accroche: "", appel: "" });
      continue;
    }
    const sorte = estAccompagnement(n, tourActif) ? "accompagnement" : "diagnostic";
    const pool = paires[sorte];
    let paire = pool[vus[sorte]++ % pool.length];
    if (paire.accroche === table[n - 1].accroche) paire = pool[vus[sorte]++ % pool.length];
    const cle = `${sorte}|${paire.accroche}`;
    const k = retours.get(cle) ?? 0;
    retours.set(cle, k + 1);
    table.push({ accroche: paire.accroche, appel: paire.appels[k % paire.appels.length] });
  }
  FINS_MEMO.set(tourActif, table);
  return table;
}

/**
 * Fin d'une vidéo, choisie à partir de son numéro de version seul (PUR, déterministe) :
 * - `n` multiple de quatre : fin « Tour » (si activée) ;
 * - sinon appel « accompagnement » (Tour désactivé : `n` ≡ 2 mod 3, un sur trois ; Tour activé : `n` mod 12 dans
 *   `RESIDUS_ACCOMPAGNEMENT_TOUR`, soit un tiers de toutes les vidéos), les autres « diagnostic » ;
 * `options.tourActif` (tests) force l'activation ; sans lui, elle suit `finsTourActivesIV()`.
 * - seules les paires accroche + appel qui tiennent en 29 mots avec la phrase du lien sont tirées (`pairesAppelIV`) ;
 * - l'accroche tourne sur le jeu de sa sorte et saute celle du numéro précédent : deux numéros consécutifs n'ont jamais
 *   la même accroche (jeux séparés entre Tour et appels).
 */
export function choixDeFinIV(numeroVersion: number, options: { tourActif?: boolean } = {}): ChoixFinIV {
  if (!Number.isInteger(numeroVersion) || numeroVersion < 1 || numeroVersion > 9999) {
    throw new ErreurFin("Le numéro de version doit être un entier entre 1 et 9999.");
  }
  const n = numeroVersion;
  const tourActif = options.tourActif ?? finsTourActivesIV();
  if (tourActif && n % TOUR_UN_SUR === 0) {
    const rang = n / TOUR_UN_SUR - 1;
    return { sorte: "tour", accroche: ACCROCHES_TOUR_IV[rang % ACCROCHES_TOUR_IV.length], appel: INVITATIONS_TOUR_IV[rang % INVITATIONS_TOUR_IV.length] };
  }
  const { accroche, appel } = tableDesFinsIV(tourActif)[n];
  return { sorte: estAccompagnement(n, tourActif) ? "accompagnement" : "diagnostic", accroche, appel };
}

/** Sorte de fin d'un plan, lue sur les lignes de banque de ses fins ; « diagnostic » par défaut (fin au mot comprise). */
export function sorteDuPlanIV(plan: Pick<PlanDesFinsIV, "fins">): SorteFinIV {
  const ids = plan.fins.flatMap((f) => f.appels.map((a) => a.id));
  if (ids.some((id) => ACCROCHES_TOUR_IV.includes(id))) return "tour";
  return ids.some((id) => APPELS_ACCOMPAGNEMENT_IV.includes(id)) ? "accompagnement" : "diagnostic";
}

export interface DemandePlanDesFinsIV {
  reseaux: readonly ReseauIV[];
  /** Offre de la carte (corrigeable au dépôt). Le coaching n'a pas de cadeau : jamais de fin au mot. */
  offre: Offre;
  /** Question propre à l'image (fiche L6). Absente : la question générique de la banque. */
  questionCommentaire?: string;
  /** Défaut `fin-seule` (26/10/2026) : une seule demande par fin, pas de question de commentaire. */
  appelCommentaire?: AppelCommentaire;
  /** Numéro de version de la vidéo : il décide de la fin (`choixDeFinIV`). Absent : 1. */
  numeroVersion?: number;
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
  /** Vrai seulement dans le plan d'une vidéo faite AVANT le 26/10/2026 (LinkedIn muet) ; jamais produit par `planDesFinsIV`. */
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
 * `utm_content` = l'activité visée ; la page est celle du diagnostic, ou du Tour de France IA pour la fin « Tour ». Sans numéro de version, aucun code de version n'existe : une erreur (jamais un lien
 * sans rattachement). Deux réseaux n'ont jamais le même lien.
 */
export function liensSuivisIV(reseaux: readonly ReseauIV[], numeroVersion: number | undefined, activite: ActiviteLien = "clients", sorte: SorteFinIV = "diagnostic"): Record<string, string> {
  if (numeroVersion === undefined) throw new ErreurFin("Le numéro de la version est introuvable : le lien suivi (code de version) ne peut pas être posé.");
  // La fin « Tour » vise la page du Tour (jamais le diagnostic) ; sans page connue, elle n'existe pas (`choixDeFinIV`).
  const page = sorte === "tour" ? PAGE_TOUR_DE_FRANCE_IA : PAGE_FIN_APPEL_IV;
  if (!page) throw new ErreurFin("La page du Tour de France IA n'est pas connue : aucun lien suivi ne peut y mener.");
  return Object.fromEntries(
    [...new Set(reseaux)].map((r) => [r, construireLienSuivi({ typeLien: "video", reseau: r, code: codeVersionIV(numeroVersion, r), activite, page })]),
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

function questionPour(reseau: ReseauIV, texte: string | undefined): QuestionIV {
  const ligne = QUESTION_BANQUE[reseau];
  const l = appelDeLaBanque(ligne);
  if (!l || l.etat !== "valide") throw new ErreurFin(`La question de la banque « ${ligne} » n'est pas disponible.`);
  const propre = texte?.trim();
  return { dit: propre || l.dit, ecran: l.ecran, origine: propre ? "image" : "banque", ligne };
}

/**
 * Suite du réseau quand un mot est demandé ET branché : la fin au mot (inchangée). `null` : la fin du 26/10 (accroche,
 * appel, lien), avec la raison à donner quand un mot demandé n'a pas pu être pris.
 */
function suiteAuMot(reseau: ReseauIV, d: DemandePlanDesFinsIV, table: readonly FinTable[]): { ids: readonly string[] | null; raison?: string } {
  const auMot = FINS_AU_MOT_IV[reseau];
  // Personne n'a demandé de mot, ou ce réseau n'a pas de fin au mot : la fin habituelle, sans raison à donner.
  if (!auMot || !d.mot) return { ids: null };
  if (!d.motSur?.includes(reseau)) return { ids: null, raison: RAISON_MOT_NON_BRANCHE };
  if (!d.cadeauReel) return { ids: null, raison: RAISON_SANS_CADEAU };
  if (d.offre === "coaching") return { ids: null, raison: RAISON_SANS_CADEAU_OFFRE };
  if (!d.mot || !motValide(d.mot)) return { ids: null, raison: RAISON_MOT_NON_BRANCHE };
  if (auMot.some((id) => table.find((f) => f.id === id)?.validee !== true)) return { ids: null, raison: "La fin au mot n'est pas encore validée : la fin propose l'appel." };
  return { ids: auMot };
}

/** Une ligne de banque lue pour un réseau : son groupe est celui du réseau (Facebook et LinkedIn partagent la même ligne). */
function ligneDuReseau(code: string, reseau: ReseauIV): FinTable {
  const a = appelDeLaBanque(code);
  if (!a) throw new ErreurFin(`La fin « ${code} » est absente de la banque.`);
  if (!(a.reseaux as readonly string[]).includes(reseau)) throw new ErreurFin(`La fin « ${code} » n'est pas prévue pour ${reseau}.`);
  return { id: a.code, groupe: groupeDe(reseau), type: a.type, dit: a.dit, ecran: a.ecran, validee: a.etat === "valide", reseaux: [reseau], parPhrase: true };
}

/** Les trois phrases de la fin d'un réseau (accroche, appel, lien), contrôlées par `choisir` (validée, 12 mots par phrase, 8 à l'écran). */
export function finDuReseauIV(reseau: ReseauIV, choix: ChoixFinIV): FinChoisie[] {
  const ids = [choix.accroche, choix.appel, LIEN_FIN_IV[reseau]];
  return suiteDeFins(reseau, ids, {}, ids.map((id) => ligneDuReseau(id, reseau)));
}

/** Plan des fins des réseaux : une fin par suite distincte (question comprise), regroupant les réseaux identiques. */
export function planDesFinsIV(demande: DemandePlanDesFinsIV): PlanDesFinsIV {
  const reglage: AppelCommentaire = demande.appelCommentaire ?? "fin-seule";
  if (demande.questionCommentaire !== undefined && reglage === "question-puis-fin") {
    const refus = refusQuestion(demande.questionCommentaire);
    if (refus) throw new ErreurFin(refus);
  }
  const reseaux = RESEAUX_IV.filter((r) => demande.reseaux.includes(r));
  const table = tableIV(Object.values(FINS_AU_MOT_IV).flat());
  const options = { ...(demande.mot ? { mot: demande.mot } : {}), ...(demande.motDit ? { motDit: demande.motDit } : {}) };
  const choix = choixDeFinIV(demande.numeroVersion ?? 1);

  const groupes = new Map<string, FinIV>();
  const sansFin: PlanDesFinsIV["sansFin"] = [];
  // Raison par RÉSEAU (deux réseaux d'un même fichier n'ont pas forcément la même : LinkedIn n'a jamais demandé de mot).
  const raisons = new Map<string, ReseauIV[]>();

  for (const reseau of reseaux) {
    const { ids, raison } = suiteAuMot(reseau, demande, table);
    let appels: FinChoisie[];
    try {
      appels = ids ? suiteDeFins(reseau, ids, options, table) : finDuReseauIV(reseau, choix);
    } catch (e) {
      if (!(e instanceof ErreurFin)) throw e;
      sansFin.push({ reseaux: [reseau], raison: e.message });
      continue;
    }
    const question = reglage === "question-puis-fin" ? questionPour(reseau, demande.questionCommentaire) : undefined;
    // Réseaux regroupés sur ce qui est DIT et AFFICHÉ (pas sur les codes de ligne) : Facebook et LinkedIn partagent un fichier.
    const cle = [question?.dit ?? "", question?.ecran ?? "", ...appels.flatMap((a) => [a.dit, a.ecran])].join("|");
    const g = groupes.get(cle);
    if (g) g.reseaux.push(reseau);
    else groupes.set(cle, { id: "", reseaux: [reseau], muet: false, ...(question ? { question } : {}), appels });
    if (raison) raisons.set(raison, [...(raisons.get(raison) ?? []), reseau]);
  }

  const fins: FinIV[] = [...groupes.values()].map((g) => ({ ...g, id: `fin-${g.reseaux.join("-")}` }));
  const reduites: PlanDesFinsIV["reduites"] = [...raisons].map(([raison, rs]) => ({ reseaux: rs, raison }));
  fins.sort((a, b) => RESEAUX_IV_HISTORIQUE.indexOf(a.reseaux[0]) - RESEAUX_IV_HISTORIQUE.indexOf(b.reseaux[0]));
  return { fins, reduites, sansFin };
}
