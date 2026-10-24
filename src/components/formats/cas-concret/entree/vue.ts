/**
 * VUE DE L'ÉCRAN « CAS CONCRET MD » (tâche U1, plan § 7) : ce que la page montre d'un cas, les libellés en clair et le
 * classement de la case « Quel cas voulez-vous montrer ? ». PUR : aucun accès au serveur.
 */
import { ecranDerriereConnexion, NATURES_EN_CLAIR, type CasConcret, type Offre, type SourceFait } from "@/formats/cas-concret/cas";
import type { EcranApercu } from "@/moteurs/montage-cas-concret/script-valide";

export type FiltreOffre = "tous" | Offre;

/** Toutes les pastilles possibles ; « Coaching » n'apparaît que lorsqu'un cas validé le porte (`pastillesOffres`). */
export const OFFRES_PASTILLES: { valeur: FiltreOffre; libelle: string }[] = [
  { valeur: "tous", libelle: "Tous" },
  { valeur: "formation", libelle: "Formation" },
  { valeur: "audit", libelle: "Audit" },
  { valeur: "integration", libelle: "Intégration" },
  { valeur: "coaching", libelle: "Coaching" },
];

/** Offres toujours montrées, même sans cas validé. */
const PASTILLES_TOUJOURS: readonly FiltreOffre[] = ["tous", "formation", "audit", "integration"];

/** Les pastilles affichées : Tous, Formation, Audit, Intégration, et toute autre offre portée par un cas validé. */
export function pastillesOffres(cas: readonly Pick<VueCas, "offre" | "valide">[]): { valeur: FiltreOffre; libelle: string }[] {
  const portees = new Set(cas.filter((c) => c.valide).map((c) => c.offre));
  return OFFRES_PASTILLES.filter((o) => PASTILLES_TOUJOURS.includes(o.valeur) || portees.has(o.valeur as Offre));
}

export const RESEAUX_ECRAN = [
  { valeur: "facebook", libelle: "Facebook" },
  { valeur: "instagram", libelle: "Instagram" },
  { valeur: "tiktok", libelle: "TikTok" },
  { valeur: "linkedin", libelle: "LinkedIn" },
] as const;

/** D'où vient un chiffre, en clair. */
export const SOURCES_EN_CLAIR: Record<SourceFait, string> = {
  code: "d'après le fonctionnement réel",
  site: "d'après le site",
  will: "d'après vous",
  estimation: "estimation",
};

export interface VueCas {
  id: string;
  titre: string;
  promesse: string;
  cible: string;
  offre: Offre;
  offreLibelle: string;
  /** Nature en clair d'une intégration (« Automatisation », « Outils reliés ») : affichage seul, hors classement. */
  nature?: string;
  /** « Chez nous » ou « Notre offre ». */
  posture: string;
  vraisEcrans: boolean;
  etapes: string[];
  /** Le récit du cas, gratuit et lisible (sans les mots clés) : de quoi parle la vidéo, la scène, l'exemple suivi. Absent : cas du catalogue d'origine. */
  recit?: { sujet: string; scene: string; exemple: string };
  faits: { id: string; phrase: string; source: string }[];
  mot: string;
  /** Empreinte du cas à l'écran : le serveur refuse si le cas a changé depuis. */
  empreinte: string;
  valide: boolean;
  /** V4-3 : le script validé du cas (texte dit et ordre des écrans), montré avant la voix ; absent : Claude écrira. */
  script?: EcranApercu[];
  /** Le script validé du cas est celui de Will (tapé ou collé dans « Mon script »). */
  scriptFourni?: boolean;
  /** P2C : numéros (à partir de 1) des étapes dont l'écran est derrière une connexion : « Fournir cet écran ». Absent : réglage éteint. */
  ecransAFournir?: number[];
  /**
   * Lots K4-K5 : où en est le cas dans le stock. Présent SEULEMENT quand le réglage `casConcret.stockMetiers` est allumé et que
   * le stock a des cas rangés (absent : l'écran est celui d'avant). `fiche`, `secteur` et `taille` : cas du stock par métier seulement.
   */
  stock?: { traite: boolean; fiche?: string; secteur?: string; taille?: string };
  /** P2S · cas né de la porte B : son brouillon et les faits à confirmer (absent : cas du catalogue). */
  porteB?: { videoId: string; aConfirmer: { id: string; enonce: string }[] };
}

/** `ecranFourni` : le réglage `casConcret.ecranFourni` est allumé (éteint par défaut : aucun lien « Fournir cet écran »). */
export function versVueCas(cas: CasConcret, empreinte: string, valide: boolean, script?: EcranApercu[], ecranFourni = false): VueCas {
  return {
    id: cas.id,
    titre: cas.titre,
    promesse: cas.promesse,
    cible: cas.cible,
    offre: cas.offre,
    offreLibelle: OFFRES_PASTILLES.find((o) => o.valeur === cas.offre)?.libelle ?? "",
    ...(cas.nature ? { nature: NATURES_EN_CLAIR[cas.nature] } : {}),
    posture: cas.posture === "chez-nous" ? "Chez nous" : "Notre offre",
    vraisEcrans: cas.etapes.some((e) => e.visuel.sorte === "ecran"),
    etapes: cas.etapes.map((e) => e.titre),
    ...(cas.recit ? { recit: { sujet: cas.recit.sujet, scene: cas.recit.scene, exemple: cas.recit.exemple } } : {}),
    faits: cas.faits.map((f) => ({ id: f.id, phrase: f.enonce, source: SOURCES_EN_CLAIR[f.source] })),
    mot: cas.mot,
    empreinte,
    valide,
    ...(script?.length ? { script } : {}),
    ...(ecranFourni && cas.etapes.some(ecranDerriereConnexion) ? { ecransAFournir: cas.etapes.flatMap((e, i) => (ecranDerriereConnexion(e) ? [i + 1] : [])) } : {}),
  };
}

/** Mention montrée sur la feuille d'un cas de la porte B. */
export const MENTION_EXEMPLE = "Exemple, pas un cas réel";

/** Vue d'un cas de la porte B : jamais validé (jamais au catalogue), avec son brouillon et ses faits à confirmer. */
export function versVueCasPorteB(cas: CasConcret, empreinte: string, videoId: string, aConfirmer: { id: string; enonce: string }[]): VueCas {
  return { ...versVueCas(cas, empreinte, false), porteB: { videoId, aConfirmer } };
}

/** Longueur permise dans la case : celle d'une description de la porte B (`DESCRIPTION_CARACTERES_MAX`, vérifié par un test). */
export const LONGUEUR_CASE = 1500;

/* ------------------------------------------------------------------ */
/* Classement de la case                                                 */
/* ------------------------------------------------------------------ */

const MOTS_VIDES = new Set([
  "le", "la", "les", "un", "une", "des", "de", "du", "d", "l", "a", "au", "aux", "et", "ou", "en", "sur", "pour", "par", "avec", "sans",
  "dans", "ce", "cet", "cette", "ces", "mon", "ma", "mes", "ton", "ta", "tes", "son", "sa", "ses", "notre", "nos", "votre", "vos", "je",
  "tu", "il", "elle", "on", "nous", "vous", "ils", "est", "sont", "que", "qui", "se", "s", "y", "ne", "pas", "plus", "fais", "fait", "faire",
  "faites", "veux", "voudrais", "video", "videos", "cas", "montrer", "montre", "montrez", "sujet", "qu", "n", "c", "j", "m", "t",
]);

/** Mots utiles d'un texte : minuscules, sans accent, sans mot vide, sans « s » final. */
export function motsUtiles(texte: string): string[] {
  const sansAccent = texte.toLowerCase().normalize("NFD").replace(/\p{Diacritic}/gu, "");
  return [...new Set(sansAccent.split(/[^a-z0-9]+/).filter((m) => m && !MOTS_VIDES.has(m)).map((m) => (m.length > 3 && m.endsWith("s") ? m.slice(0, -1) : m)))];
}

/** Nombre de mots communs entre la phrase et le titre, la promesse, la cible, l'offre et les étapes du cas. */
export function motsCommuns(phrase: string, cas: Pick<VueCas, "titre" | "promesse" | "cible" | "offreLibelle"> & { etapes?: readonly string[] }): number {
  const voulus = motsUtiles(phrase);
  const du_cas = new Set(motsUtiles(`${cas.titre} ${cas.promesse} ${cas.cible} ${cas.offreLibelle} ${(cas.etapes ?? []).join(" ")}`));
  return voulus.filter((m) => du_cas.has(m)).length;
}

/** Cas classés par mots communs ; une phrase non vide masque les cartes sans aucun mot commun. Ordre d'origine à égalité. */
export function classerCas<T extends Pick<VueCas, "titre" | "promesse" | "cible" | "offreLibelle"> & { etapes?: readonly string[] }>(phrase: string, cas: readonly T[]): T[] {
  if (!motsUtiles(phrase).length) return [...cas];
  return cas
    .map((c, i) => ({ c, i, n: motsCommuns(phrase, c) }))
    .filter((x) => x.n > 0)
    .sort((a, b) => b.n - a.n || a.i - b.i)
    .map((x) => x.c);
}

/** Le bouton « Faire la vidéo de ce cas » : dès que la case dit au moins deux mots utiles. */
export const MOTS_POUR_PORTE_B = 2;
export const porteBProposee = (phrase: string): boolean => motsUtiles(phrase).length >= MOTS_POUR_PORTE_B;

/** La case de texte libre ne propose « Faire la vidéo de ce cas » que si le réglage `casConcret.porteB` est allumé. */
export const boutonPorteBVisible = (reglageAllume: boolean | undefined, phrase: string): boolean => reglageAllume === true && porteBProposee(phrase);
