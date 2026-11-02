/**
 * MOTS (PV-3) · contrôle de SORTIE. Tout texte qui partira vers une personne passe ici, par les filtres EXISTANTS :
 * mots interdits de l'envoi (famille « certifié », nom du label qualité), expressions bannies (lieu interdit, « Aucun gain
 * garanti »), puis les règles du parcours : mention « réponse automatique » obligatoire, aucune promesse interdite,
 * aucune adresse e-mail. PUR. Les mots interdits ne sont jamais écrits en clair dans les tests (jetons).
 */
import { expressionsBannieDans, normaliser } from "@/domaine/controles-visuel/texte";
import { motsInterditsEnvoi } from "@/fournisseurs/publication/mots-interdits-envoi";
import { SECTIONS, type Section, type TextesMot } from "./mots-textes";

export const MENTION_AUTOMATIQUE = "réponse automatique";
export const LONGUEUR_MAX_TEXTE = 1000;

/** Promesses refusées (racines, comparées sans accents ni casse). */
const PROMESSES: readonly { libelle: string; motif: RegExp }[] = [
  { libelle: "promesse de garantie", motif: /garanti/ },
  { libelle: "promesse sans risque", motif: /sans (?:aucun )?risques?/ },
  { libelle: "promesse de résultat", motif: /resultats? (?:assures?|certains?)/ },
  { libelle: "promesse de réussite", motif: /(?:reussite|succes) (?:assure|certain)/ },
];
const EMAIL = /[^\s@]+@[^\s@]+\.[^\s@]+/;
/** Formes épelées d'une adresse (« nom arobase domaine point com »). */
const EMAIL_EPELE = /\barobase\b.{0,40}\b(?:point|dot)\b/;
/** Caractères invisibles (largeur nulle, joiners, BOM, trait d'union conditionnel) retirés avant tout contrôle. */
const INVISIBLES = /[\u00AD\u200B-\u200F\u2060-\u2064\uFEFF]/g;

export interface Refus {
  section: Section;
  code: "vide" | "trop_long" | "mot_interdit" | "expression_bannie" | "mention_absente" | "promesse_interdite" | "adresse_email";
  detail: string;
}

/** Contrôle d'un texte sortant. Retourne la liste des refus (vide = conforme). */
export function controlerTexteSortant(section: Section, texte: string): Refus[] {
  const refus: Refus[] = [];
  const r = (code: Refus["code"], detail: string) => refus.push({ section, code, detail });
  if (!texte.trim()) return [{ section, code: "vide", detail: "texte vide" }];
  if (texte.length > LONGUEUR_MAX_TEXTE) r("trop_long", `plus de ${LONGUEUR_MAX_TEXTE} caractères`);
  for (const m of motsInterditsEnvoi(texte.replace(INVISIBLES, ""))) r("mot_interdit", m);
  for (const e of expressionsBannieDans(texte.replace(INVISIBLES, ""))) r("expression_bannie", e);
  const nu = texte.replace(INVISIBLES, "");
  const plat = normaliser(nu);
  if (!plat.includes(normaliser(MENTION_AUTOMATIQUE))) r("mention_absente", `« ${MENTION_AUTOMATIQUE} » absent`);
  for (const p of PROMESSES) if (p.motif.test(plat)) r("promesse_interdite", p.libelle);
  if (EMAIL.test(nu) || EMAIL_EPELE.test(plat)) r("adresse_email", "adresse e-mail dans le texte");
  return refus;
}

/** Contrôle de tous les textes d'un mot. */
export function controlerTextesMot(t: TextesMot): Refus[] {
  const valeurs: Record<Section, string | null> = { reponse_publique: t.reponsePublique, message_prive: t.messagePrive, relance: t.relance, fin: t.fin };
  return SECTIONS.flatMap((s) => (valeurs[s] === null ? [] : controlerTexteSortant(s, valeurs[s]!)));
}
