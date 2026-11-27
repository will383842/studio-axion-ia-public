// Vidéos sur le site — thèmes fermés et bornes de longueur du site (PUR). Le site refuse (422) toute page qui sort de
// ces bornes : le Studio les contrôle AVANT l'appel (contrôle SITE-18). Valeurs relues dans le contrat du site (ADR-0016).
import type { PasseportWeb } from "./types";

/** Liste fermée des thèmes du site (un `theme` hors liste est refusé). */
export const THEMES_SITE = ["formations-ia", "coaching-ia", "audit-ia", "automatisation", "sites-web-ia"] as const;
export type ThemeSite = (typeof THEMES_SITE)[number];

/** Libellés lisibles des thèmes, pour rapprocher la rubrique saisie à la main. */
const LIBELLES_THEMES: Record<ThemeSite, string[]> = {
  "formations-ia": ["formations ia", "formation ia", "formations"],
  "coaching-ia": ["coaching ia", "coaching ia 1 to 1", "coaching"],
  "audit-ia": ["audit ia", "audit"],
  automatisation: ["automatisation", "implementation ia", "implementation"],
  "sites-web-ia": ["sites web et saas ia", "sites web ia", "site web ia", "sites web", "site web"],
};

const normaliser = (t: string) =>
  t.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, " ").trim();

/** Thème du site pour une rubrique saisie à la main, ou `null` si elle n'en désigne aucun. */
export function themeDeRubrique(rubrique: string): ThemeSite | null {
  const n = normaliser(rubrique);
  if (!n) return null;
  for (const theme of THEMES_SITE) {
    if (normaliser(theme) === n || LIBELLES_THEMES[theme].some((l) => normaliser(l) === n)) return theme;
  }
  return null;
}

/** Bornes [min, max] en caractères. Titre : le maximum de 60 du Studio est gardé (plus strict que les 100 du site). */
export const BORNES_SITE = {
  titre: [20, 60],
  resume: [400, 1500],
  aRetenir: [20, 200],
  question: [10, 160],
  reponse: [40, 600],
} as const;

export interface EchecBorne {
  message: string;
  champ: keyof PasseportWeb;
}

function hors(valeur: string, [min, max]: readonly [number, number]): "court" | "long" | null {
  // Longueur brute, comme le site (qui ne retire aucune espace) : l'envoi n'ajuste rien.
  const n = valeur.length;
  return n < min ? "court" : n > max ? "long" : null;
}

/** Échecs de bornes d'un passeport (un par texte hors borne), dans l'ordre de la page. Vide = conforme. */
export function echecsBornes(p: PasseportWeb): EchecBorne[] {
  const echecs: EchecBorne[] = [];
  const verifier = (ou: string, champ: keyof PasseportWeb, valeur: string, borne: readonly [number, number]) => {
    const h = hors(valeur, borne);
    if (h) echecs.push({ champ, message: `${ou} fait ${valeur.length} caractères : ${h === "court" ? `${borne[0]} au moins` : `${borne[1]} au plus`} pour le site.` });
  };
  verifier("Le titre", "titreWeb", p.titreWeb, BORNES_SITE.titre);
  verifier("Le résumé", "resume", p.resume, BORNES_SITE.resume);
  p.aRetenir.forEach((t, i) => verifier(`Le point « À retenir » n° ${i + 1}`, "aRetenir", t, BORNES_SITE.aRetenir));
  p.questions.forEach((q, i) => {
    verifier(`La question n° ${i + 1}`, "questions", q.question, BORNES_SITE.question);
    verifier(`La réponse n° ${i + 1}`, "questions", q.reponse, BORNES_SITE.reponse);
  });
  if (!themeDeRubrique(p.rubrique)) echecs.push({ champ: "rubrique", message: "La rubrique doit être l'un des thèmes du site : Formations IA, Coaching IA 1-to-1, Audit IA, Automatisation ou Sites web et SaaS IA." });
  return echecs;
}

/** SITE-18 : bornes de longueur et thème du site. Un contrôle par échec, ou un seul contrôle vert. */
export function controlerBornesSite(p: PasseportWeb): { code: "SITE-18"; gravite: "bloquant"; ok: boolean; message: string; champ?: keyof PasseportWeb }[] {
  const echecs = echecsBornes(p);
  if (!echecs.length) return [{ code: "SITE-18", gravite: "bloquant", ok: true, message: "Les longueurs conviennent au site." }];
  return echecs.map((e) => ({ code: "SITE-18" as const, gravite: "bloquant" as const, ok: false, message: e.message, champ: e.champ }));
}
