/**
 * MOTS (PV-3) · contrôle de SORTIE. Tout texte qui partira vers une personne passe ici, par les filtres EXISTANTS :
 * mots interdits de l'envoi (famille « certifié », nom du label qualité), expressions bannies (lieu interdit, expression de gain interdite), puis les règles du parcours : aucune mention « Message automatique » en ouverture, aucune signature, jamais de mention STOP, jamais de question d'accord, aucune promesse interdite,
 * aucune adresse e-mail. PUR. Les mots interdits ne sont jamais écrits en clair dans les tests (jetons).
 */
import { expressionsBannieDans, normaliser } from "@/domaine/controles-visuel/texte";
import { motsInterditsEnvoi } from "@/fournisseurs/publication/mots-interdits-envoi";
import { SECTIONS, type Section, type TextesMot } from "./mots-textes";

/** Aucun texte (toute section) ne contient cette mention d'automatisme, en ouverture comme au milieu (« ça ne fait pas très pro »). */
const MOTIF_MENTION_AUTOMATIQUE = /\bmessage automatique\b/;
/** Aucune signature en fin de texte (les réseaux sociaux affichent déjà le nom du compte). */
const MOTIF_SIGNATURE = /(?:\b(?:l )?equipe (?:de )?axion ia|\bmessage automatique envoye par axion ia|\b(?:bien )?cordialement(?: axion ia)?)$/;
/** Signature « Axion IA » seule en dernière phrase ou dernière ligne (texte sans accents MAIS avec sa ponctuation) : début de texte ou signe . ! ? … , ; : — – - ou saut de ligne avant, éventuellement « l'équipe », puis axion ia, puis éventuellement . ou !, puis la fin. « proposé par Axion IA » dans une phrase reste accepté. */
const MOTIF_SIGNATURE_NOM = /(?:^|[.!?…,;:\u2014\u2013\-\n])\s*(?:l['’ ]?equipe\s+(?:de\s+)?)?axion\s+ia\s*[.!]*\s*$/;
export const LONGUEUR_MAX_TEXTE = 1000;

/** Promesses refusées (racines, comparées sans accents ni casse). */
const PROMESSES: readonly { libelle: string; motif: RegExp }[] = [
  { libelle: "promesse de garantie", motif: /garanti/ },
  { libelle: "promesse sans risque", motif: /sans (?:aucun )?risques?/ },
  { libelle: "promesse de résultat", motif: /resultats? (?:assures?|certains?)/ },
  { libelle: "promesse de réussite", motif: /(?:reussite|succes) (?:assure|certain)/ },
];
/** Aucune mention d'arrêt dans un texte sortant (texte normalisé ; la personne écrit d'elle-même « stop » ou « arrêtez » : silence). */
const MOTIF_STOP = /\bstop\b|\barretez\b|se desabonner|desinscri/;
/** Aucune question « voulez-vous recevoir d'autres informations » : le parcours livre le guide et rien d'autre. */
const MOTIF_QUESTION_ACCORD = /voulez vous|souhaitez vous|autres informations|conseils par e ?mail|newsletter|repondez (?:par )?(?:oui|non)|\boui ou non\b/;
const EMAIL = /[^\s@]+@[^\s@]+\.[^\s@]+/;
/** Formes épelées d'une adresse (« nom arobase domaine point com »). */
const EMAIL_EPELE = /\barobase\b.{0,40}\b(?:point|dot)\b/;
/** Caractères invisibles (largeur nulle, joiners, BOM, trait d'union conditionnel) retirés avant tout contrôle. */
const INVISIBLES = /[\u00AD\u200B-\u200F\u2060-\u2064\uFEFF]/g;

export interface Refus {
  section: Section;
  code: "vide" | "trop_long" | "mot_interdit" | "expression_bannie" | "mention_automatique" | "signature" | "promesse_interdite" | "adresse_email" | "mention_stop" | "question_accord";
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
  if (MOTIF_MENTION_AUTOMATIQUE.test(plat)) r("mention_automatique", "mention d'automatisme interdite");
  const sansAccents = nu.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  if (MOTIF_SIGNATURE.test(plat) || MOTIF_SIGNATURE_NOM.test(sansAccents)) r("signature", "signature interdite en fin de texte");
  if (MOTIF_STOP.test(plat)) r("mention_stop", "mention de l'arrêt interdite");
  if (MOTIF_QUESTION_ACCORD.test(plat)) r("question_accord", "question d'accord interdite");
  for (const p of PROMESSES) if (p.motif.test(plat)) r("promesse_interdite", p.libelle);
  if (EMAIL.test(nu) || EMAIL_EPELE.test(plat)) r("adresse_email", "adresse e-mail dans le texte");
  return refus;
}

/** Contrôle de tous les textes d'un mot. */
export function controlerTextesMot(t: TextesMot): Refus[] {
  const valeurs: Record<Section, string | null> = { reponse_publique: t.reponsePublique, message_prive: t.messagePrive, relance: t.relance, fin: t.fin };
  return SECTIONS.flatMap((s) => (valeurs[s] === null ? [] : controlerTexteSortant(s, valeurs[s]!)));
}
