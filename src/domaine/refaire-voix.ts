/**
 * S2-16-a : « refaire la voix » (module PUR, sans importeur : éteint, 0 €). Pour chaque format : peut-on redire UNE
 * phrase, seulement la voix ENTIÈRE, ou rien (prise filmée, visage) ; combien de caractères seront relus (PIRE CAS =
 * ceux que le format relit réellement, pas ceux de la phrase) ; estimation = caractères × tarif INJECTÉ, arrondie au
 * centime supérieur ; plafond par vidéo INJECTÉ (il n'existe pas encore dans le code). Refus en phrases simples, sans
 * montant, rendus AVANT tout appel. Aucun fournisseur, aucun fichier d'argent, aucun réglage.
 */

export type CapaciteRefaireVoix = "phrase" | "voix-entiere" | "impossible";

/**
 * Table FERMÉE par format (tout format du registre des codes y figure). Cas concret : la voix réelle est lue en UNE prise
 * (`voixDeRetouche`, une prise dont l'empreinte change est relue EN ENTIER) ; la relecture phrase par phrase existe en
 * module pur (`prises-phrases`) mais n'est PAS branchée : une fiche future repassera à "phrase" quand elle le sera. Tableau : la voix est lue en une prise (voix entière + scènes). Face caméra,
 * avocat, avatar, image → vidéo : refaire la voix referait le visage ou n'a pas de moteur → impossible.
 */
export const CAPACITE_REFAIRE_VOIX: Readonly<Record<string, CapaciteRefaireVoix>> = Object.freeze({
  "cas-concret": "voix-entiere",
  "tableau-anime": "voix-entiere",
  avocat: "impossible",
  podcast: "impossible",
  "ecran-partage": "impossible",
  ugc: "impossible",
  selfie: "impossible",
  motion: "impossible",
  "createur-b": "impossible",
  "podcast-a-deux": "impossible",
  "derriere-un-bureau": "impossible",
  "avis-client": "impossible",
  test: "impossible",
  facecam: "impossible",
  "facecam-animee": "impossible",
  "image-video": "impossible",
  "tutoriel-outil": "impossible",
  "demo-facecam": "impossible",
  visuel: "impossible",
  "video-longue": "impossible",
  "tableau-de-bord": "impossible",
});

/** Capacité d'un format ; un format inconnu (ou un nom hérité comme « constructor ») est « impossible ». */
export function capaciteRefaireVoix(format: string): CapaciteRefaireVoix {
  return Object.hasOwn(CAPACITE_REFAIRE_VOIX, format) ? CAPACITE_REFAIRE_VOIX[format] : "impossible";
}

/** Tarif, plafond et déjà engagé sont dans la MÊME monnaie (le tarif du code est en centimes USD, heygen/voix.ts:26) : injecter un tarif en USD contre un plafond en euros sur-estime (sens prudent), l'inverse sous-estimerait. */
export interface DemandeRefaireVoix {
  format: string;
  /** Texte entier lu par la voix. */
  texteLu: string;
  /** Texte des phrases à redire. */
  phrasesVisees: readonly string[];
  /** Tarif par caractère, en centimes (INJECTÉ). */
  tarifCentimesParCaractere: number;
  /** Plafond par vidéo, en centimes (INJECTÉ). */
  plafondCentimes: number;
  /** Déjà engagé sur cette vidéo pour la voix refaite, en centimes. */
  dejaEngageCentimes: number;
}

export type CodeRefusRefaireVoix = "format-impossible" | "rien-a-refaire" | "tarif-illisible" | "plafond-illisible" | "plafond-depasse";

export type EstimationRefaireVoix = { ok: true; capacite: "phrase" | "voix-entiere"; caracteres: number; centimes: number } | { ok: false; code: CodeRefusRefaireVoix; phrase: string };

const PHRASES: Record<CodeRefusRefaireVoix, string> = {
  "format-impossible": "Refaire la voix n'est pas possible pour ce format : pour ce changement, il faut refaire la vidéo. Votre vidéo reste telle quelle.",
  "rien-a-refaire": "Aucune phrase à refaire : choisissez la phrase à redire.",
  "tarif-illisible": "Le prix de la voix est illisible : rien n'est lancé, votre vidéo reste telle quelle.",
  "plafond-illisible": "La limite prévue pour cette vidéo est illisible : rien n'est lancé, votre vidéo reste telle quelle.",
  "plafond-depasse": "Cette nouvelle voix dépasserait la limite prévue pour cette vidéo : rien n'est lancé, votre vidéo reste telle quelle.",
};

const refus = (code: CodeRefusRefaireVoix): EstimationRefaireVoix => ({ ok: false, code, phrase: PHRASES[code] });
const nombreValide = (n: number) => Number.isFinite(n) && n >= 0;

export function estimerRefaireVoix(d: DemandeRefaireVoix): EstimationRefaireVoix {
  const capacite = capaciteRefaireVoix(d.format);
  if (capacite === "impossible") return refus("format-impossible");
  if (!nombreValide(d.tarifCentimesParCaractere) || d.tarifCentimesParCaractere <= 0) return refus("tarif-illisible"); // tarif 0 ou −0 : estimation gratuite, le plafond ne refuserait plus jamais
  if (!nombreValide(d.plafondCentimes) || !nombreValide(d.dejaEngageCentimes)) return refus("plafond-illisible");
  const visees = d.phrasesVisees.map((p) => p.trim()).filter(Boolean);
  if (!visees.length) return refus("rien-a-refaire");
  const texte = d.texteLu.trim();
  // Pire cas : une voix entière relit TOUT le texte, même pour une seule phrase visée.
  const caracteres = capacite === "voix-entiere" ? texte.length : visees.reduce((s, p) => s + p.length, 0);
  if (!caracteres) return refus("rien-a-refaire");
  const centimes = Math.ceil(Math.round(caracteres * d.tarifCentimesParCaractere * 1e6) / 1e6);
  if (d.dejaEngageCentimes + centimes > d.plafondCentimes) return refus("plafond-depasse");
  return { ok: true, capacite, caracteres, centimes };
}
