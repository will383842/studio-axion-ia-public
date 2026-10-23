/**
 * CHAÎNE « ÉQUIPE » · BRIQUES COMMUNES (PUR) : les règles de Will écrites dans les consignes du rédacteur en chef et du
 * relecteur, et l'étape 0 faite par le CODE, sans appel : objectif de la vidéo, cible (taille + fonction), appel final
 * pris dans la banque des fins, rotation des extraits de Will. Rien ici ne nomme un format.
 */
import { tirerSansRecent } from "@/domaine/ecriture-commune/memoire";
import { diyImperatif } from "@/domaine/positionnement";
import { appelsDeLaBanque, type ObjectifAppel } from "@/briques/fins/banque";
import { RESEAUX_FIN, type ReseauFin } from "@/briques/fins/types";
import { EXTRAITS_WILL } from "@/donnees/generateur/modeles-will";
import { ANNONCES_OUTIL_WILL, REGLES_WILL, TICS_IA_WILL } from "@/donnees/generateur/regles-will";
import { rendreExtraits, type ExtraitModele } from "@/donnees/generateur/modeles-avocatref";
import type { ReseauDeclinaison, TypeAppel } from "@/domaine/types";
import { normaliser } from "@/domaine/controles-script/texte";
import { INTERDITS_TOUS_ECRIVAINS } from "@/domaine/qualite-script/regles/interdits";
import { nombresAffirmes } from "@/domaine/nombres-fr";
import type { DonneesGeneration } from "../contexte";

/* ------------------------------------------------------------------ */
/* Règles de Will (une seule source : équipe et chaîne courte)          */
/* ------------------------------------------------------------------ */

/** Le texte vit dans les données (il nomme un réseau, ce que le générateur ne fait jamais en dur). */
export { REGLES_WILL };

/** Motif d'une liste de tournures en clair : texte normalisé (sans accents, apostrophes en espaces), mots entiers. */
function motifDe(tournures: readonly string[]): RegExp {
  const corps = tournures.map((t) => normaliser(t).replace(/['’]/g, " ").replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  return new RegExp(corps.map((c) => `\\b${c}\\b`).join("|"));
}

/** Ce que le code repère seul des règles de Will (relevé envoyé au relecteur, correction refusée si elle en ajoute). */
const MOTIFS_WILL: readonly { id: string; motif: RegExp; texte: string }[] = [
  { id: "WILL-DIY", motif: /\bfaites[- ]le (vous[- ]memes?|par vous[- ]memes?)\b|\bfais[- ]le toi[- ]meme\b/, texte: "« faites-le vous-même »" },
  { id: "WILL-NOUVEAUTE", motif: motifDe(ANNONCES_OUTIL_WILL), texte: "annonce d'un outil ou d'une nouveauté" },
  { id: "WILL-PAS-X-Y", motif: /\bce n est pas\b[^.!?]{1,60}[,.;:]\s*c est\b/, texte: "« ce n'est pas X, c'est Y »" },
  { id: "WILL-TIC", motif: motifDe(TICS_IA_WILL), texte: "tic d'IA" },
  { id: "WILL-SUPERLATIF", motif: /\b(incroyables?|revolutionnaires?|extraordinaires?|exceptionnel(le)?s?|le meilleur|la meilleure|les meilleur(e)?s)\b/, texte: "superlatif" },
  // Les interdits de tous les écrivains (certification Certifexemple, dans les deux ordres) : la liste unique du socle.
  { id: "WILL-INTERDIT", motif: new RegExp([/\bvilleexemple\b/.source, /\baucun gain garanti\b/.source, ...INTERDITS_TOUS_ECRIVAINS.map((i) => i.motif.source)].join("|")), texte: "interdit permanent" },
];

/** Règles de Will enfreintes par ce texte (ids et libellés), d'après le code seul. */
export function violationsReglesWill(texte: string): { id: string; texte: string }[] {
  const n = ` ${normaliser(texte).replace(/['’]/g, " ")} `;
  // WILL-DIY : le repère partagé du positionnement (faites-le, testez-le, une suite de consignes à l'impératif…), sauf quand c'est nous qui faisons.
  const diy = diyImperatif(texte) !== undefined;
  return MOTIFS_WILL.filter((m) => (m.id === "WILL-DIY" ? diy || m.motif.test(n) : m.motif.test(n))).map(({ id, texte: t }) => ({ id, texte: t }));
}

/* ------------------------------------------------------------------ */
/* Étape 0 par le code                                                  */
/* ------------------------------------------------------------------ */

export type ObjectifEquipe = "notoriete" | "conversation" | "diagnostic";
export type TailleCible = "TPE" | "PME" | "ETI" | "GE";

/** Objectif de la vidéo, déduit du brief : un diagnostic demandé, la notoriété, sinon la conversation (défaut). */
export function objectifEquipe(sujet: Pick<DonneesGeneration["sujet"], "objectif" | "idee" | "phraseWill">): ObjectifEquipe {
  const texte = normaliser(`${sujet.idee} ${sujet.phraseWill ?? ""}`);
  if (sujet.objectif === "rendez-vous" || /\b(diagnostic|audit|rendez vous|rdv)\b/.test(texte)) return "diagnostic";
  if (sujet.objectif === "notoriete" || sujet.objectif === "sauvegarde") return "notoriete";
  return "conversation";
}

const LIBELLES_TAILLE: Record<TailleCible, string> = { TPE: "TPE (moins de 10 salariés)", PME: "PME (10 à 249 salariés)", ETI: "ETI (250 à 4 999 salariés)", GE: "grand groupe (5 000 salariés et plus)" };
const MOTIFS_TAILLE: readonly [TailleCible, RegExp][] = [
  ["GE", /\b(ge|grands? groupes?|grandes? entreprises?|grands comptes)\b/],
  ["ETI", /\beti\b/],
  ["TPE", /\b(tpe|artisans?|independants?|commercants?|auto entrepreneurs?|micro entreprises?)\b/],
  ["PME", /\bpme\b/],
];

/** Cible = une taille (TPE, PME, ETI, GE ; PME par défaut) + la fonction si le brief en donne une. */
export function cibleEquipe(cible?: string): { taille: TailleCible; fonction?: string; texte: string } {
  const n = normaliser(cible ?? "");
  const taille = MOTIFS_TAILLE.find(([, m]) => m.test(n))?.[0] ?? "PME";
  const fonction = (cible ?? "")
    .replace(/\b(TPE|PME|ETI|GE)\b/g, "")
    .replace(/\b(de|des|en|d')\s*$/i, "")
    .replace(/^[\s,;:·/-]+|[\s,;:·/-]+$/g, "")
    .trim();
  return { taille, ...(fonction ? { fonction } : {}), texte: `${LIBELLES_TAILLE[taille]}${fonction ? `, ${fonction}` : ""}` };
}

/** Rotation de 3 extraits de Will, espacés dans sa structure (jamais un seul modèle cloné), choisis par la graine du sujet. */
export function extraitsWillTournants(g: number, n = 3): ExtraitModele[] {
  const pas = Math.max(1, Math.floor(EXTRAITS_WILL.length / n));
  return Array.from({ length: Math.min(n, EXTRAITS_WILL.length) }, (_, i) => EXTRAITS_WILL[(g + i * pas) % EXTRAITS_WILL.length]);
}

export function rendreExtraitsTournants(xs: readonly ExtraitModele[]): string {
  return `<modeles_will_du_sujet>\n${rendreExtraits(xs)}\n</modeles_will_du_sujet>`;
}

/** Objectifs de la banque des fins servis par chaque objectif de la vidéo, dans l'ordre de préférence. */
export const OBJECTIFS_BANQUE: Readonly<Record<ObjectifEquipe, readonly ObjectifAppel[]>> = {
  notoriete: ["PARTAGER", "ENREGISTRER", "ABONNEMENT"],
  conversation: ["QUESTION", "MOT_CADEAU"],
  diagnostic: ["RENDEZ_VOUS"],
};

/** Type d'appel du studio pour un objectif de la banque (absent : celui que le code choisit pour le réseau). */
const TYPE_APPEL: Partial<Record<ObjectifAppel, TypeAppel>> = { PARTAGER: "envoi", ENREGISTRER: "sauvegarde", QUESTION: "question-expert", RENDEZ_VOUS: "diagnostic" };

export interface AppelEquipe {
  code: string;
  objectif: ObjectifAppel;
  /** Type du studio si la banque en donne un ; sinon le code du réseau tranche (`appelPour`). */
  type?: TypeAppel;
  texte: string;
}

/**
 * L'appel final, choisi par le CODE dans la banque des fins (lignes validées, public « clients », vidéo) selon le réseau
 * et l'objectif ; plusieurs lignes possibles : la graine du sujet tourne. LinkedIn ne dit rien dans la vidéo d'après la
 * base 7 : sa légende sert de phrase. Une ligne qui attend un mot ou un cadeau ({MOT}, {CADEAU}) n'est pas prise (le
 * code n'en a pas). Aucune ligne : null (le scénariste écrit l'appel du type imposé).
 */
export function appelEquipe(reseau: ReseauDeclinaison, objectif: ObjectifEquipe, g: number, recents?: readonly string[]): AppelEquipe | null {
  if (!(RESEAUX_FIN as readonly string[]).includes(reseau)) return null;
  const lignes = appelsDeLaBanque({ reseau: reseau as ReseauFin, public: "public.clients", typeContenu: "video" })
    .map((a) => ({ a, texte: (a.dit || a.legende).trim() }))
    .filter((x) => x.texte && !/\{[A-Z]+\}/.test(x.texte));
  for (const voulu of OBJECTIFS_BANQUE[objectif]) {
    const possibles = lignes.filter((x) => x.a.objectif === voulu);
    if (!possibles.length) continue;
    // Lot C3 : avec des récents donnés (mémoire commune), tirage sans récents ; sans eux, `g % n` comme avant.
    const { a, texte } = recents?.length ? possibles[possibles.findIndex((x) => x.a.code === tirerSansRecent(possibles.map((y) => y.a.code), recents, String(g)))] : possibles[g % possibles.length];
    return { code: a.code, objectif: a.objectif, ...(TYPE_APPEL[a.objectif] ? { type: TYPE_APPEL[a.objectif] } : {}), texte };
  }
  return null;
}

/* ------------------------------------------------------------------ */
/* Contrôles d'accroche par le code                                     */
/* ------------------------------------------------------------------ */

const PRE_ROLL = /^(bonjour|salut|hello|coucou|hey|bienvenue|aujourd hui (on|je|nous)|dans cette video|je vais vous|on va (parler|voir)|petite video|alors voila|vous l avez peut etre)\b/;
const POUR_QUI = /\b(tpe|pme|eti|dirigeants?|dirigeantes?|patrons?|gerants?|gerantes?|artisans?|commercants?|independants?|entrepreneurs?|entreprises?|societes?|cabinets?|groupes?|drh|daf|rh|comptables?|managers?|directeurs?|directrices?|equipes?|salaries?|commerciaux|commerciales?|assistantes?|assistants?|responsables?)\b/;

/** Mots qui situent la cible du sujet (taille et fonction données), en plus de la liste générale. */
function motsCible(cible: { taille: TailleCible; fonction?: string }): string[] {
  return [cible.taille.toLowerCase(), ...normaliser(cible.fonction ?? "").split(" ").filter((m) => m.length >= 4)];
}

/**
 * Motifs d'élimination d'une accroche (vide : elle passe) : 1re phrase de 12 mots au plus et finie avant 3 s au débit
 * de la recette ; un chiffre ou un « pour qui » dans les 9 premiers mots ; ni pré-roll ni salut.
 */
export function motifsAccrocheRefusee(dit: string, o: { debit: number; cible: { taille: TailleCible; fonction?: string } }): string[] {
  const texte = dit.trim();
  const premiere = texte.split(/(?<=[.!?…])\s+/)[0] ?? "";
  const mots = premiere.split(/\s+/).filter(Boolean).length;
  const motifs: string[] = [];
  if (mots > 12) motifs.push(`1re phrase de ${mots} mots (12 au plus)`);
  if (o.debit > 0 && mots / o.debit > 3) motifs.push(`1re phrase finie à ${(mots / o.debit).toFixed(1)} s (avant 3 s)`);
  const neuf = texte.split(/\s+/).slice(0, 9).join(" ");
  const n = ` ${normaliser(neuf).replace(/['’]/g, " ")} `;
  const chiffre = /\d/.test(neuf) || nombresAffirmes(neuf).length > 0;
  const pourQui = POUR_QUI.test(n) || motsCible(o.cible).some((m) => n.includes(` ${m} `));
  if (!chiffre && !pourQui) motifs.push("ni chiffre ni « pour qui » dans les 9 premiers mots");
  if (PRE_ROLL.test(normaliser(texte).replace(/['’]/g, " "))) motifs.push("pré-roll ou salut");
  return motifs;
}
