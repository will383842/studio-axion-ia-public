/**
 * RÈGLES DE LA FICHE D'ÉCRANS DU CAS CONCRET (tâches M1a et M1b, plan cas concret § 6.3). La règle R01 (schéma exact,
 * version connue, suite des identifiants) est `validerSchemaFiche` de `fiche.ts`.
 *
 * Chaque règle est une fonction PURE et nommée `(fiche, contexte) → manquements`. Tout ce qui vient de l'extérieur est
 * INJECTÉ par le `contexte` : le cas, le texte du script, les interdits de Will, le débit. Aucun accès base, aucun réseau.
 *
 * Temps : sur une fiche non calée, chaque écran est ESTIMÉ au débit de la recette du format, à la suite du précédent (un
 * écran démarre à son premier mot, moins `avanceMs`). Sur une fiche calée (début et fin posés sur tous les écrans), les
 * heures sont reprises et les mots répartis à débit égal entre le premier mot et la fin de l'écran.
 *
 * Les messages sont en français ; `verifierRegles` les préfixe de l'écran et du nom de la règle
 * (« Écran e03 · règle « … » : … »). `validerFicheEcrans` enchaîne le schéma (R01), le document promis du cas et R02 à R22.
 * N'importe AUCUN autre moteur.
 */
import type { ProblemeFiche, ResultatFiche } from "@/briques/fiche-scenes";
import { EMPLACEMENT_MOT, TABLE_FINS_DIAGNOSTIC } from "@/briques/fins";
import { raconteUnClient } from "@/domaine/controles-script";
import { contientExpression, motsPleins, normaliser, sansCitations, texteCompare } from "@/domaine/controles-script/texte";
import type { ContexteAxion } from "@/domaine/types";
import { appliquerInterdits } from "@/domaine/voix";
import { cadeauDeLOffre, finsParReseau, formatCasConcret, FIN_APRES_DERNIER_MOT_SEC } from "@/formats/cas-concret";
import { OBJETS, type CasConcret } from "@/formats/cas-concret/cas";
import { cleMot, motsLus, validerSchemaFiche, type Ecran, type EcranDeType, type FicheEcrans, type FinPlanifiee } from "./fiche";

/* ------------------------------------------------------------------ */
/* Seuils (plan § 6.3)                                                   */
/* ------------------------------------------------------------------ */

/** R03 : accroche de 8 mots dits au plus, finie avant 3,0 s. */
export const ACCROCHE_MOTS_DITS_MAX = 8;
export const ACCROCHE_FIN_MAX_MS = 3_000;
/** R04 : la liste « avant » commence avant 6 s. */
export const LISTE_DEBUT_MAX_MS = 6_000;
/** R05 : durée d'un écran (demande de Will). */
export const ECRAN_DUREE_MAX_MS = 5_000;
export const ECRAN_DUREE_MIN_MS = 1_000;
/**
 * V4-3 : une liste « avant » dure jusqu'à 12 s : ses tâches entrent une à une sur leur mot (R06 : un événement toutes les
 * 2 s au plus) ; la v4, validée par Will, montre les 6 tâches sur un seul plan de 9,2 s.
 */
export const LISTE_AVANT_DUREE_MAX_MS = 12_000;
/** R05 : tenue finale du dernier écran de la fin, hors compte. */
export const TENUE_FINALE_MS = Math.round(FIN_APRES_DERNIER_MOT_SEC * 1000);
/** R06 : un événement visible toutes les 2,0 s au plus ; débit de 3,0 à 3,9 mots par seconde. */
export const ECART_EVENEMENT_MAX_MS = 2_000;
export const DEBIT_MIN = 3.0;
export const DEBIT_MAX = 3.9;
/**
 * B3 : débit prudent pour le plafond de 5 s d'un écran estimé. La voix réelle a été mesurée à 3,15 / 3,27 / 3,52 mots par
 * seconde : estimer à 3,4 laissait passer des écrans de 16-17 mots, mesurés au-dessus de 5 s après la dépense de la voix.
 */
export const DEBIT_ECRAN_PRUDENT = 3.0;
/** Mots dits au plus par écran, au débit prudent (15). */
export const MOTS_ECRAN_MAX = Math.floor((ECRAN_DUREE_MAX_MS / 1000) * DEBIT_ECRAN_PRUDENT);
/** Mots dits au plus sur un écran liste-avant, au débit prudent (36). */
export const MOTS_LISTE_AVANT_MAX = Math.floor((LISTE_AVANT_DUREE_MAX_MS / 1000) * DEBIT_ECRAN_PRUDENT);
/** Débit d'estimation par défaut : celui de la recette du format. */
export const DEBIT_RECETTE = formatCasConcret.recetteScript.motsParSeconde;
/** R07 : jamais 4 écrans de suite sur le même fond (V4-3 : la v4, validée par Will, en a 3 : s11, s12, s13). */
export const FONDS_IDENTIQUES_MAX = 3;
/** R08 : textes d'écran courts. */
export const MOTS_MAX = { titre: 3, ligne: 8, puce: 3 } as const;
/** R09 : la marque, en haut de chaque écran. */
export const MARQUE = "axion-ia.com";
/** R10 : mots interdits du format, en plus des interdits de Will et de ceux passés par l'appelant. */
export const MOTS_INTERDITS_FORMAT: readonly string[] = ["machine", "machines", "Villeexemple", "aucun gain garanti"];

/* ------------------------------------------------------------------ */
/* Contexte, manquements, liste des règles                               */
/* ------------------------------------------------------------------ */

export interface ContexteCasConcret {
  /** Le cas dont la fiche est tirée (R03, R04 et règles des faits). */
  cas: CasConcret;
  /** Texte du script, corps seul (accroche → question), sans la fin (R02). */
  texteScript: string;
  /** Interdits de Will, avec expression (R10, comme le contrôle de script des interdits). */
  interdits?: ContexteAxion["interdits"];
  /** Mots interdits en clair, comparés mot entier sans accents (R10) : ceux de Will et ceux du cas. */
  motsInterdits?: readonly string[];
  /** Débit d'estimation, en mots par seconde ; par défaut celui de la recette. */
  debitMotsParSeconde?: number;
  /** Fins planifiées (R21) ; à défaut, la suite la plus longue de la table des fins pour l'offre du cas. */
  fins?: readonly Pick<FinPlanifiee, "ecrans">[];
}

/** Un manquement : l'écran concerné (si possible) et ce qui ne va pas. */
export interface Manquement {
  ecranId?: string;
  detail: string;
}

export type FonctionRegle = (fiche: FicheEcrans, contexte: ContexteCasConcret) => Manquement[];

export interface RegleCasConcret {
  /** Numéro du plan (« R05 »). */
  id: string;
  /** Nom en clair, cité dans le message. */
  nom: string;
  verifier: FonctionRegle;
}

/** Applique des règles et rend leurs manquements sous la forme commune des fiches. */
export function verifierRegles(fiche: FicheEcrans, contexte: ContexteCasConcret, regles: readonly RegleCasConcret[]): ProblemeFiche[] {
  return regles.flatMap((r) =>
    r.verifier(fiche, contexte).map((m) => ({
      regle: r.nom,
      ...(m.ecranId ? { sceneId: m.ecranId } : {}),
      message: `${m.ecranId ? `Écran ${m.ecranId}` : "Fiche"} · règle « ${r.nom} » : ${m.detail}`,
    })),
  );
}

/* ------------------------------------------------------------------ */
/* Outils                                                                */
/* ------------------------------------------------------------------ */

const secondes = (ms: number) => `${(Math.round(ms / 100) / 10).toFixed(1).replace(".", ",")} s`;

/** Textes ÉCRITS par un écran (sans la marque, contrôlée par R09). */
export function textesEcrits(e: Ecran): string[] {
  switch (e.type) {
    case "accroche":
      return [e.etiquette, ...e.lignes];
    case "chiffre":
      return [`${e.valeur} ${e.unite}`, ...e.pastilles];
    case "liste-avant":
      return [...e.taches, ...(e.total ? [e.total] : [])];
    case "titre":
      return [...e.lignes];
    case "etape":
      return [e.titre, e.ligne, ...e.puces, ...(e.visuel.sorte === "objet" ? (e.visuel.textes ?? []) : [])];
    case "objet":
      return [e.titre, ...(e.ligne ? [e.ligne] : []), ...(e.visuel.textes ?? [])];
    case "preuve":
      return [e.titre, ...e.puces];
    case "resultat":
      return [e.titre, e.avant.libelle, e.maintenant.libelle, e.ligne];
    case "question":
      return [...e.lignes, e.question];
    case "appel-mot":
      return [e.mot];
    case "promesse":
      return [e.cadeau, ...(e.ligne ? [e.ligne] : [])];
    case "diagnostic":
      return [e.titre, ...(e.ligne ? [e.ligne] : [])];
    case "lien":
      return [e.titre, e.bulle];
  }
}

/** Textes d'écran par gabarit de longueur (R08). Les écrans de la fin viennent de la table des fins : non comptés. */
export function textesParGabarit(e: Ecran): { titre: string[]; ligne: string[]; puce: string[] } {
  switch (e.type) {
    case "accroche":
      return { titre: [...e.lignes], ligne: [e.etiquette], puce: [] };
    case "chiffre":
      // V4-3 : les pastilles et les textes portés par un objet (notification) ont la longueur d'une ligne (la v4).
      return { titre: [], ligne: [e.unite, ...e.pastilles], puce: [] };
    case "liste-avant":
      return { titre: [], ligne: [...e.taches, ...(e.total ? [e.total] : [])], puce: [] };
    case "titre":
      return { titre: [...e.lignes], ligne: [], puce: [] };
    case "etape":
      return { titre: [e.titre], ligne: [e.ligne, ...(e.visuel.sorte === "objet" ? (e.visuel.textes ?? []) : [])], puce: [...e.puces] };
    case "objet":
      return { titre: [e.titre], ligne: [...(e.ligne ? [e.ligne] : []), ...(e.visuel.textes ?? [])], puce: [] };
    case "preuve":
      return { titre: [e.titre], ligne: [], puce: [...e.puces] };
    case "resultat":
      return { titre: [e.titre], ligne: [e.ligne], puce: [e.avant.libelle, e.maintenant.libelle] };
    case "question":
      return { titre: [], ligne: [...e.lignes, e.question], puce: [] };
    default:
      return { titre: [], ligne: [], puce: [] };
  }
}

/* ---------- Nombres écrits en lettres (0 à 999 999) ---------- */

const VALEURS_NOMBRE: Readonly<Record<string, number>> = {
  zero: 0, un: 1, une: 1, deux: 2, trois: 3, quatre: 4, cinq: 5, six: 6, sept: 7, huit: 8, neuf: 9, dix: 10, onze: 11,
  douze: 12, treize: 13, quatorze: 14, quinze: 15, seize: 16, vingt: 20, vingts: 20, trente: 30, quarante: 40,
  cinquante: 50, soixante: 60, cent: 100, cents: 100, mille: 1000,
};
const CENT = new Set(["cent", "cents"]);
/** Mots devant lesquels « neuf » est l'adjectif (« du neuf », « tout neuf »), pas 9 (essai blog du 15/10). */
const AVANT_NEUF_ADJECTIF = new Set(["du", "tout", "flambant"]);
/** Unités devant lesquelles « un » et « une » sont un nombre (plan § 6.3, R12). */
export const UNITES_NOMBRE: readonly string[] = ["heure", "heures", "minute", "minutes", "seconde", "secondes", "jour", "jours", "semaine", "semaines", "mois", "euro", "euros", "%"];

/** La partie `suivant` prolonge-t-elle le nombre en cours (`nombre` : ses parties déjà lues) ? */
function prolonge(nombre: readonly string[], suivant: string): boolean {
  const dernier = nombre[nombre.length - 1]!;
  const d = VALEURS_NOMBRE[dernier];
  const s = VALEURS_NOMBRE[suivant];
  if (d === undefined || s === undefined) return false;
  // « neuf cents », « mille trois cents », « deux cent mille » : centaines et milliers. « cent » ne suit qu'un seul mot de
  // 2 à 9 (« quatre-vingt-dix-neuf cent » reste 99 puis 100).
  if (suivant === "mille") return dernier !== "mille";
  if (CENT.has(suivant)) {
    const groupe = nombre.slice(nombre.lastIndexOf("mille") + 1);
    return groupe.length === 1 && d >= 2 && d <= 9;
  }
  if (dernier === "mille") return s < 1000;
  if (CENT.has(dernier)) return s >= 1 && s < 100;
  if (dernier === "quatre" && (suivant === "vingt" || suivant === "vingts")) return true;
  if (dernier === "dix" && s >= 7 && s <= 9) return true;
  if ((d === 60 || dernier === "vingts" || d === 20) && s >= 1 && s <= 19) return true;
  if (d >= 30 && d <= 50 && s >= 1 && s <= 9) return true;
  return false;
}

function valeurDe(parties: readonly string[]): number {
  let total = 0;
  let courant = 0;
  for (let i = 0; i < parties.length; i++) {
    const p = parties[i];
    if (p === "mille") {
      total += (courant || 1) * 1000;
      courant = 0;
    } else if (CENT.has(p)) courant = (courant || 1) * 100;
    else if ((p === "vingt" || p === "vingts") && parties[i - 1] === "quatre") courant += 80 - 4;
    else courant += VALEURS_NOMBRE[p];
  }
  return total + courant;
}

/**
 * Texte comparé (`texteCompare`) dont les nombres en lettres de 0 à 100 sont écrits en chiffres, « pour cent » après un
 * nombre en « % », et les apostrophes séparées (« d'une » → « d une »). « un » et « une » ne deviennent « 1 » que devant
 * une unité (`UNITES_NOMBRE`) ; « vingt et un » vaut 21.
 */
export function texteAvecNombres(t: string): string {
  const jetons = texteCompare(t).replace(/'/g, " ").replace(/(\d)\s*%/g, "$1 %").split(" ").filter(Boolean);
  const sortie: string[] = [];
  let i = 0;
  while (i < jetons.length) {
    const parties = jetons[i].split("-");
    const neufAdjectif = jetons[i] === "neuf" && AVANT_NEUF_ADJECTIF.has(jetons[i - 1] ?? "") && !UNITES_NOMBRE.includes(jetons[i + 1] ?? "") && !(jetons[i + 1] ?? "").split("-").every((p) => p in VALEURS_NOMBRE);
    if (neufAdjectif || !parties.every((p) => p in VALEURS_NOMBRE)) {
      sortie.push(jetons[i]);
      i++;
      continue;
    }
    // Un nombre : ses parties, puis tant que le jeton suivant (éventuellement après « et ») le prolonge.
    const nombre = [...parties];
    let j = i + 1;
    for (;;) {
      const avecEt = jetons[j] === "et" && j + 1 < jetons.length;
      const suivant = avecEt ? jetons[j + 1] : jetons[j];
      if (suivant === undefined) break;
      const ps = suivant.split("-");
      if (!ps.every((p) => p in VALEURS_NOMBRE)) break;
      const dernier = nombre[nombre.length - 1];
      const ok = avecEt ? (dernier === "vingt" || VALEURS_NOMBRE[dernier] >= 30) && (ps[0] === "un" || ps[0] === "une" || ps[0] === "onze") : prolonge(nombre, ps[0]);
      if (!ok) break;
      nombre.push(...ps);
      j += avecEt ? 2 : 1;
    }
    const seul = nombre.length === 1 && (nombre[0] === "un" || nombre[0] === "une");
    if (seul && !UNITES_NOMBRE.includes(jetons[j] ?? "") && !(jetons[j] === "pour" && jetons[j + 1] === "cent")) {
      sortie.push(jetons[i]);
      i++;
      continue;
    }
    sortie.push(String(valeurDe(nombre)));
    i = j;
    if (jetons[i] === "pour" && jetons[i + 1] === "cent") {
      sortie.push("%");
      i += 2;
    }
  }
  return sortie.join(" ");
}

/** Nombres d'un texte, en chiffres (après `texteAvecNombres`). */
export function nombresDe(t: string): number[] {
  return texteAvecNombres(t)
    .split(" ")
    .filter((m) => /^\d+(?:[.,]\d+)?$/.test(m))
    .map((m) => Number(m.replace(",", ".")));
}

/* ---------- Temps des écrans ---------- */

/** Temps d'un écran : repris du calage s'il est posé sur toute la liste, sinon estimé au débit à la suite du précédent. */
export interface TempsEcran {
  ecran: Ecran;
  debutMs: number;
  finMs: number;
  /** Heure de chaque mot lu du `texteDit` (`motsLus`, même compte que `surMot`). */
  motsMs: number[];
}

export function estCalee(ecrans: readonly Ecran[]): boolean {
  return ecrans.length > 0 && ecrans.every((e) => e.debutMs !== undefined && e.finMs !== undefined);
}

export function tempsEcrans(ecrans: readonly Ecran[], debit: number = DEBIT_RECETTE): TempsEcran[] {
  if (estCalee(ecrans)) {
    return ecrans.map((e) => {
      const n = motsLus(e.texteDit).length;
      const premier = Math.min(e.debutMs! + e.avanceMs, e.finMs!);
      const pas = n > 0 ? (e.finMs! - premier) / n : 0;
      return { ecran: e, debutMs: e.debutMs!, finMs: e.finMs!, motsMs: Array.from({ length: n }, (_, r) => premier + r * pas) };
    });
  }
  const msParMot = 1000 / debit;
  let lusAvant = 0;
  const bruts = ecrans.map((e) => {
    const n = motsLus(e.texteDit).length;
    const premier = lusAvant * msParMot;
    lusAvant += n;
    return { e, premier, finMots: lusAvant * msParMot, motsMs: Array.from({ length: n }, (_, r) => premier + r * msParMot) };
  });
  return bruts.map((b, i) => {
    const suivant = bruts[i + 1];
    return {
      ecran: b.e,
      debutMs: Math.max(0, b.premier - b.e.avanceMs),
      finMs: suivant ? Math.max(0, suivant.premier - suivant.e.avanceMs) : b.finMots,
      motsMs: b.motsMs,
    };
  });
}

const debitDe = (contexte: Pick<ContexteCasConcret, "debitMotsParSeconde">) => contexte.debitMotsParSeconde ?? DEBIT_RECETTE;

/** Index du premier écran d'un type (−1 s'il n'y en a pas) et du dernier. */
const premierDe = (ecrans: readonly Ecran[], type: Ecran["type"]) => ecrans.findIndex((e) => e.type === type);
const dernierDe = (ecrans: readonly Ecran[], type: Ecran["type"]) => ecrans.map((e) => e.type).lastIndexOf(type);

/* ------------------------------------------------------------------ */
/* R02 : le texte dit est le script entier                               */
/* ------------------------------------------------------------------ */

export function regleTexteDuScript(fiche: FicheEcrans, contexte: ContexteCasConcret): Manquement[] {
  const attendu = texteCompare(contexte.texteScript).split(" ").filter(Boolean);
  let k = 0;
  for (const e of fiche.ecrans) {
    const dits = texteCompare(e.texteDit).split(" ").filter(Boolean);
    for (const m of dits) {
      if (attendu[k] !== m) {
        const suite = attendu.slice(k, k + 4).join(" ");
        return [{ ecranId: e.id, detail: `le texte dit « ${m} » s'écarte du script, qui dit ${suite ? `« ${suite} »` : "plus rien"} à cet endroit ; le texte dit doit reprendre le script mot pour mot.` }];
      }
      k++;
    }
  }
  if (k < attendu.length) {
    return [{ ecranId: fiche.ecrans[fiche.ecrans.length - 1]?.id, detail: `il manque la fin du script (« ${attendu.slice(k, k + 6).join(" ")} »…) ; le texte dit doit reprendre le script entier.` }];
  }
  return [];
}

/* ------------------------------------------------------------------ */
/* R03 : accroche                                                        */
/* ------------------------------------------------------------------ */

export function regleAccroche(fiche: FicheEcrans, contexte: ContexteCasConcret): Manquement[] {
  const premier = fiche.ecrans[0];
  if (!premier || premier.type !== "accroche") return [{ ecranId: premier?.id, detail: "le premier écran doit être l'accroche." }];
  const res: Manquement[] = [];
  const n = motsLus(premier.texteDit).length;
  if (n > ACCROCHE_MOTS_DITS_MAX) res.push({ ecranId: premier.id, detail: `l'accroche dit ${n} mots ; ${ACCROCHE_MOTS_DITS_MAX} au plus.` });

  // V4-3 : la promesse peut finir sur l'écran qui suit l'accroche (la v4 : « On recrute nos collaborateurs en… », puis
  // « quinze minutes. » sur le chiffre) ; elle tient alors dans les 8 premiers mots dits et finit avant 3 s.
  const temps = tempsEcrans(fiche.ecrans, debitDe(contexte));
  const premiers = temps.flatMap((t) => motsLus(t.ecran.texteDit).map((m, r) => ({ m, ms: t.motsMs[r] }))).slice(0, ACCROCHE_MOTS_DITS_MAX + 1);
  // Un cas qui a un récit : l'accroche dit son sujet à la place de la promesse (clarté des scripts).
  const ditParAccroche = contexte.cas.recit?.sujet ?? contexte.cas.promesse;
  const promesse = texteNormalise(ditParAccroche);
  const manque = (k: number) => {
    const t = premiers.slice(0, k).map((x) => x.m).join(" ");
    const motsDits = new Set(motsPleins(texteNormalise(t)));
    const nombresDits = nombresDe(t);
    return [...motsPleins(promesse).filter((m) => !motsDits.has(m)), ...nombresDe(ditParAccroche).filter((v) => !nombresDits.includes(v)).map(String)];
  };
  const k = Array.from({ length: Math.min(ACCROCHE_MOTS_DITS_MAX, premiers.length) }, (_, i) => i + 1).find((x) => manque(x).length === 0);
  if (k === undefined) {
    res.push({ ecranId: premier.id, detail: `l'accroche ne dit pas ${contexte.cas.recit ? "le sujet" : "la promesse"} du cas (« ${ditParAccroche} ») ; il manque ${manque(Math.min(n, ACCROCHE_MOTS_DITS_MAX)).map((m) => `« ${m} »`).join(", ")}.` });
  }

  // Promesse dite par l'accroche seule : l'accroche finit avant 3 s ; finie sur l'écran suivant : le mot qui la suit.
  const fin = k === undefined || k <= n ? temps[0].finMs : (premiers[k]?.ms ?? temps[1]?.finMs ?? temps[0].finMs);
  if (fin > ACCROCHE_FIN_MAX_MS) res.push({ ecranId: premier.id, detail: `l'accroche finit à ${secondes(fin)} ; elle doit finir avant ${secondes(ACCROCHE_FIN_MAX_MS)}.` });
  return res;
}

/* ------------------------------------------------------------------ */
/* R04 : ordre des écrans                                                */
/* ------------------------------------------------------------------ */

export function regleOrdre(fiche: FicheEcrans, contexte: ContexteCasConcret): Manquement[] {
  const e = fiche.ecrans;
  const res: Manquement[] = [];
  if (e[0]?.type !== "accroche") res.push({ ecranId: e[0]?.id, detail: "le premier écran doit être une accroche." });

  const liste = premierDe(e, "liste-avant");
  const derniereListe = dernierDe(e, "liste-avant");
  const etape = premierDe(e, "etape");
  const derniereEtape = dernierDe(e, "etape");
  if (liste < 0) res.push({ detail: "la liste « avant » manque ; elle vient avant les étapes." });
  if (etape < 0) res.push({ detail: "aucune étape ; la fiche montre le cas étape par étape." });

  if (liste >= 0) {
    const debut = tempsEcrans(e, debitDe(contexte))[liste].debutMs;
    if (debut >= LISTE_DEBUT_MAX_MS) res.push({ ecranId: e[liste].id, detail: `la liste « avant » commence à ${secondes(debut)} ; elle doit commencer avant ${secondes(LISTE_DEBUT_MAX_MS)}.` });
  }
  if (liste >= 0 && etape >= 0) {
    if (derniereListe > etape) res.push({ ecranId: e[derniereListe].id, detail: `la liste « avant » vient après la première étape (${e[etape].id}) ; elle doit la précéder.` });
    else if (!e.slice(derniereListe + 1, etape).some((x) => x.type === "titre")) {
      res.push({ ecranId: e[etape].id, detail: `aucun titre entre la liste « avant » (${e[derniereListe].id}) et la première étape ; la bascule les sépare.` });
    }
  }

  // Le reste humain se place n'importe où après la première étape (la vidéo 1 le dit entre deux étapes).
  if (etape >= 0) {
    const reste = texteAvecNombres(contexte.cas.resteHumain);
    let avant = "";
    for (let i = 0; i < etape; i++) {
      avant = `${avant} ${texteAvecNombres(e[i].texteDit)}`;
      if (reste && ` ${avant} `.includes(` ${reste} `)) {
        res.push({ ecranId: e[i].id, detail: "le reste humain du cas est dit avant la première étape ; il vient après." });
        break;
      }
    }
  }

  const resultat = dernierDe(e, "resultat");
  if (resultat < 0) res.push({ detail: "l'écran de résultat manque ; il suit la dernière étape." });
  else if (derniereEtape >= 0 && resultat < derniereEtape) res.push({ ecranId: e[resultat].id, detail: `le résultat vient avant la dernière étape (${e[derniereEtape].id}) ; il la suit.` });

  const dernier = e[e.length - 1];
  if (dernier?.type !== "question") res.push({ ecranId: dernier?.id, detail: "le dernier écran du corps doit être la question." });
  e.slice(0, -1).forEach((x) => {
    if (x.type === "question") res.push({ ecranId: x.id, detail: "une question avant la fin du corps ; la question est le dernier écran." });
  });
  return res;
}

/* ------------------------------------------------------------------ */
/* R05 : durée d'un écran                                                */
/* ------------------------------------------------------------------ */

/** Durée d'un écran refusé, au centième, arrondie en s'éloignant du seuil (jamais « 1,00 s ; 1 s au moins ») ; seuil en secondes. */
const centiemes = (ms: number, sens: "bas" | "haut") => `${((sens === "bas" ? Math.floor(Math.round(ms) / 10) : Math.ceil(Math.round(ms) / 10)) / 100).toFixed(2).replace(".", ",")} s`;
const seuil = (ms: number) => `${String(ms / 1000).replace(".", ",")} s`;

/**
 * Durées d'une suite d'écrans ; `finale` : la tenue finale du dernier écran (fin d'une vidéo) n'est pas comptée ;
 * `seulement` : ne rend que les manquements de ce sens (sans elle, tous, comme avant).
 */
export function manquementsDurees(ecrans: readonly Ecran[], debit: number, options: { finale?: boolean; seulement?: "trop-long" | "trop-court" } = {}): Manquement[] {
  const temps = tempsEcrans(ecrans, debit);
  // B3 : sur une estimation, le plafond se juge au débit prudent (jamais plus rapide que DEBIT_ECRAN_PRUDENT).
  const calee = estCalee(ecrans);
  const tempsMax = calee ? temps : tempsEcrans(ecrans, Math.min(debit, DEBIT_ECRAN_PRUDENT));
  const res: Manquement[] = [];
  temps.forEach((t, i) => {
    const tenue = options.finale && i === temps.length - 1 ? TENUE_FINALE_MS : 0;
    const duree = Math.max(0, t.finMs - t.debutMs - tenue);
    const dureeMax = Math.max(0, tempsMax[i].finMs - tempsMax[i].debutMs - tenue);
    const ou = calee ? "dure" : "est estimé à";
    const max = t.ecran.type === "liste-avant" ? LISTE_AVANT_DUREE_MAX_MS : ECRAN_DUREE_MAX_MS;
    if (Math.round(dureeMax) > max) {
      if (options.seulement !== "trop-court") res.push({ ecranId: t.ecran.id, detail: `l'écran ${ou} ${centiemes(dureeMax, "haut")} ; ${seuil(max)} au plus.` });
    } else if (duree < ECRAN_DUREE_MIN_MS && options.seulement !== "trop-long") res.push({ ecranId: t.ecran.id, detail: `l'écran ${ou} ${centiemes(duree, "bas")} ; ${seuil(ECRAN_DUREE_MIN_MS)} au moins.` });
  });
  return res;
}

export function regleDureeEcran(fiche: FicheEcrans, contexte: ContexteCasConcret): Manquement[] {
  return manquementsDurees(fiche.ecrans, debitDe(contexte));
}

/** R05 sur les écrans d'une fin (contrôle final) : la tenue de 2,1 s du dernier écran ne compte pas. */
export function regleDureeEcransFin(fin: Pick<FinPlanifiee, "ecrans">, contexte: Pick<ContexteCasConcret, "debitMotsParSeconde">): Manquement[] {
  return manquementsDurees(fin.ecrans, debitDe(contexte), { finale: true });
}

/* ------------------------------------------------------------------ */
/* R06 : rythme                                                          */
/* ------------------------------------------------------------------ */

export function regleRythme(fiche: FicheEcrans, contexte: ContexteCasConcret): Manquement[] {
  const debit = debitDe(contexte);
  const temps = tempsEcrans(fiche.ecrans, debit);
  const res: Manquement[] = [];
  if (!temps.length) return res;

  // Débit : celui de l'estimation, ou celui mesuré sur les heures calées.
  const calee = estCalee(fiche.ecrans);
  const lus = fiche.ecrans.reduce((s, e) => s + motsLus(e.texteDit).length, 0);
  const dureeMs = temps[temps.length - 1].finMs - temps[0].debutMs;
  const mesure = calee ? (dureeMs > 0 ? (lus * 1000) / dureeMs : Infinity) : debit;
  if (mesure < DEBIT_MIN || mesure > DEBIT_MAX) {
    const v = Number.isFinite(mesure) ? (Math.round(mesure * 10) / 10).toFixed(1).replace(".", ",") : "sans fin";
    res.push({ detail: `débit de ${v} mots par seconde ; il doit rester entre ${String(DEBIT_MIN).replace(".", ",")} et ${String(DEBIT_MAX).replace(".", ",")}.` });
  }

  // Événements visibles : l'entrée de chaque écran et chacun de ses événements.
  const moments = temps
    .flatMap((t) => [{ ms: t.debutMs, id: t.ecran.id }, ...t.ecran.evenements.map((ev) => ({ ms: Math.max(t.debutMs, (t.motsMs[ev.surMot] ?? t.debutMs) - ev.avanceMs), id: t.ecran.id }))])
    .sort((a, b) => a.ms - b.ms);
  moments.push({ ms: temps[temps.length - 1].finMs, id: temps[temps.length - 1].ecran.id });
  for (let i = 1; i < moments.length; i++) {
    const ecart = moments[i].ms - moments[i - 1].ms;
    if (ecart > ECART_EVENEMENT_MAX_MS) {
      res.push({ ecranId: moments[i - 1].id, detail: `rien ne bouge pendant ${secondes(ecart)} à partir de ${secondes(moments[i - 1].ms)} ; un événement visible toutes les ${secondes(ECART_EVENEMENT_MAX_MS)} au plus.` });
    }
  }
  return res;
}

/* ------------------------------------------------------------------ */
/* R07 : fonds alternés                                                  */
/* ------------------------------------------------------------------ */

export function regleFondsAlternes(fiche: FicheEcrans): Manquement[] {
  const res: Manquement[] = [];
  let suite = 0;
  fiche.ecrans.forEach((e, i) => {
    suite = i > 0 && fiche.ecrans[i - 1].fond === e.fond ? suite + 1 : 1;
    if (suite === FONDS_IDENTIQUES_MAX + 1) res.push({ ecranId: e.id, detail: `${["deuxième", "troisième", "quatrième", "cinquième"][FONDS_IDENTIQUES_MAX - 1]} écran de suite sur fond ${e.fond} ; les fonds alternent.` });
  });
  return res;
}

/* ------------------------------------------------------------------ */
/* R08 : textes d'écran courts                                           */
/* ------------------------------------------------------------------ */

export function regleTextesCourts(fiche: FicheEcrans): Manquement[] {
  const noms = { titre: "titre", ligne: "ligne", puce: "puce" } as const;
  const res: Manquement[] = [];
  for (const e of fiche.ecrans) {
    const g = textesParGabarit(e);
    for (const sorte of ["titre", "ligne", "puce"] as const) {
      for (const t of g[sorte]) {
        const n = motsLus(t).length;
        if (n > MOTS_MAX[sorte]) res.push({ ecranId: e.id, detail: `${noms[sorte]} « ${t} » de ${n} mots ; ${MOTS_MAX[sorte]} au plus.` });
      }
    }
  }
  return res;
}

/* ------------------------------------------------------------------ */
/* R09 : la marque                                                       */
/* ------------------------------------------------------------------ */

export function regleMarque(fiche: FicheEcrans): Manquement[] {
  return fiche.ecrans.filter((e) => e.marque.trim() !== MARQUE).map((e) => ({ ecranId: e.id, detail: `la marque « ${MARQUE} » doit figurer en haut de l'écran (lu : « ${e.marque} »).` }));
}

/* ------------------------------------------------------------------ */
/* R10 : mots interdits                                                  */
/* ------------------------------------------------------------------ */

export function regleMotsInterdits(fiche: FicheEcrans, contexte: ContexteCasConcret): Manquement[] {
  const enClair = [...MOTS_INTERDITS_FORMAT, ...(contexte.motsInterdits ?? [])];
  const deWill = (contexte.interdits ?? []).filter((i) => i.regex);
  const res: Manquement[] = [];
  for (const e of fiche.ecrans) {
    for (const t of [e.texteDit, ...textesEcrits(e)]) {
      for (const m of enClair) if (contientExpression(t, m)) res.push({ ecranId: e.id, detail: `« ${t} » contient le mot interdit « ${m} ».` });
      for (const i of appliquerInterdits(t, deWill)) res.push({ ecranId: e.id, detail: `« ${t} » enfreint un interdit de Will : ${i.texte} (« ${i.extrait} »).` });
    }
  }
  return res;
}

/* ------------------------------------------------------------------ */
/* R11 : vouvoiement                                                     */
/* ------------------------------------------------------------------ */

const MOTIF_TU = /(?:^|[^a-z'])(tu|te|toi|ton|ta|tes|t')(?=$|[^a-z])/g;
/** Mots après lesquels « ton » est le nom (la tonalité) : « le ton », « au bon ton », « un ton ». */
const AVANT_TON_NOM = new Set(["le", "un", "ce", "au", "du", "bon", "mauvais", "meme", "haut", "juste", "beau", "vrai", "premier", "dernier", "doux"]);

/** Le texte tutoie-t-il ? « ton » n'est un tutoiement que comme possessif : le nom « ton » (tonalité) n'en est pas un. */
export function tutoie(texte: string): boolean {
  const n = normaliser(sansCitations(texte));
  for (const m of n.matchAll(MOTIF_TU)) {
    if (m[1] !== "ton") return true;
    const avant = n.slice(0, m.index + m[0].length - m[1].length).match(/[a-z]+/g) ?? [];
    const [dernier, avantDernier] = [avant[avant.length - 1], avant[avant.length - 2]];
    if (AVANT_TON_NOM.has(dernier) || (dernier === "de" && /^chang/.test(avantDernier ?? ""))) continue;
    return true;
  }
  return false;
}

export function regleVouvoiement(fiche: FicheEcrans): Manquement[] {
  const res: Manquement[] = [];
  for (const e of fiche.ecrans) {
    for (const t of [e.texteDit, ...textesEcrits(e)]) {
      if (tutoie(t)) res.push({ ecranId: e.id, detail: `« ${t} » tutoie ; le format vouvoie.` });
    }
  }
  return res;
}

/* ------------------------------------------------------------------ */
/* Liste R02 à R11                                                       */
/* ------------------------------------------------------------------ */

export const REGLES_R02_R11: readonly RegleCasConcret[] = [
  { id: "R02", nom: "texte du script", verifier: regleTexteDuScript },
  { id: "R03", nom: "accroche", verifier: regleAccroche },
  { id: "R04", nom: "ordre des écrans", verifier: regleOrdre },
  { id: "R05", nom: "durée d'un écran", verifier: regleDureeEcran },
  { id: "R06", nom: "rythme", verifier: regleRythme },
  { id: "R07", nom: "fonds alternés", verifier: regleFondsAlternes },
  { id: "R08", nom: "textes courts", verifier: regleTextesCourts },
  { id: "R09", nom: "marque présente", verifier: regleMarque },
  { id: "R10", nom: "mots interdits", verifier: regleMotsInterdits },
  { id: "R11", nom: "vouvoiement", verifier: regleVouvoiement },
];

/* ------------------------------------------------------------------ */
/* Outils des règles R12 à R22                                           */
/* ------------------------------------------------------------------ */

/** Noms propres permis (R14). Les sigles (« RGPD », « CRM ») ne sont pas des noms propres : R22 les contrôle. */
export const LISTE_BLANCHE_NOMS: readonly string[] = ["Axion-IA", "IA", "Facebook", "Instagram", "LinkedIn", "TikTok"];
/** R13 : réserves d'un fait de source « estimation ». */
export const RESERVES_ESTIMATION: readonly string[] = ["plus d'", "plus de", "environ"];
/** Le texte porte-t-il une réserve (« plus d'une heure », « environ 20 ») ? */
function aUneReserve(t: string): boolean {
  const n = ` ${texteCompare(t)} `;
  return RESERVES_ESTIMATION.some((r) => {
    const c = texteCompare(r);
    return c.endsWith("'") ? n.includes(` ${c}`) : n.includes(` ${c} `);
  });
}

/** R14 : mots de témoignage. */
export const MOTS_TEMOIGNAGE: readonly string[] = ["avis", "témoignage", "témoignages", "client satisfait", "clients satisfaits", "cliente satisfaite", "clientes satisfaites"];
/** R15 : tournures d'usage réel, refusées en posture « offre » et en porte B. */
export const TOURNURES_USAGE_REEL: readonly string[] = [
  "chez nous", "nos collaborateurs", "notre entreprise", "notre équipe", "notre seul travail", "on utilise", "nous utilisons",
  "on a automatisé", "on a tout automatisé", "nous avons automatisé", "nous avons tout automatisé", "on recrute", "nous recrutons",
];
/** R16 : unités d'un prix. */
const MOTIF_PRIX = /(\d+(?:[.,]\d+)?)\s*(?:€|euros?\b|eur\b|ht\b|ttc\b)/;
/** R18 : tournures d'appel refusées dans le corps (la fin vient de la table). */
export const TOURNURES_APPEL: readonly string[] = ["en commentaire", "commentez", "premier commentaire", "dans la bio", "dans mon profil", "diagnostic gratuit"];
/** R20 : bornes du corps. */
export const ECRANS_CORPS = { min: 12, max: 26 } as const;
export const ETAPES = { min: 3, max: 7 } as const;
/** R21 : durée du tout (corps + fin la plus longue) ; refus hors de 35 à 65 s, visée de 40 à 60 s. */
export const DUREE_TOTALE_REFUS_MS = { min: 35_000, max: 65_000 } as const;
/** R17 : mots qui annoncent la conformité. */
const DECLENCHEURS_CONFORMITE: readonly string[] = ["rgpd", "conforme", "conformite", "100 % automatique", "intervention manuelle"];

/** Sigle écrit pour être lu (« R.G.P.D. ») ramené à sa forme écrite (« RGPD »). */
export function sansPointsDeSigle(t: string): string {
  return t.replace(/\b((?:\p{Lu}\.){2,})/gu, (s) => s.replace(/\./g, ""));
}

/** Texte comparé après normalisation des sigles et des nombres (R17). */
export const texteNormalise = (t: string): string => texteAvecNombres(sansPointsDeSigle(t));

const contientNormalise = (texte: string, expr: string): boolean => {
  const e = texteNormalise(expr);
  return e.length > 0 && ` ${texteNormalise(texte)} `.includes(` ${e} `);
};

/** Le texte annonce-t-il la conformité (R17) ? Lu aussi avant le prix (`avant-prix.ts`) sur les textes du cas. */
export const annonceConformite = (t: string): boolean => DECLENCHEURS_CONFORMITE.some((d) => contientNormalise(t, d));

/** Tous les textes d'un écran, dit d'abord. */
const textesEcran = (e: Ecran): string[] => [e.texteDit, ...textesEcrits(e)];

/** Valeurs permises (R12) : celles des faits du cas, et celles de la phrase de conformité validée. */
function valeursPermises(cas: CasConcret): Set<number> {
  const v = new Set(cas.faits.flatMap((f) => f.valeurs));
  if (cas.conformite?.rgpd) for (const n of nombresDe(sansPointsDeSigle(cas.conformite.rgpd.phrase))) v.add(n);
  return v;
}

const nombreFr = (n: number) => String(n).replace(".", ",");

/* ------------------------------------------------------------------ */
/* R12 : aucun nombre libre                                              */
/* ------------------------------------------------------------------ */

export function regleNombresDesFaits(fiche: FicheEcrans, contexte: ContexteCasConcret): Manquement[] {
  const permis = valeursPermises(contexte.cas);
  const res: Manquement[] = [];
  for (const e of fiche.ecrans) {
    // Les barres d'un résultat ne sont ni dites ni écrites : leur hauteur seule est montrée.
    const libres = new Set<number>();
    for (const t of textesEcran(e)) for (const n of nombresDe(sansPointsDeSigle(t))) if (!permis.has(n)) libres.add(n);
    if (libres.size) res.push({ ecranId: e.id, detail: `${[...libres].map((n) => `« ${nombreFr(n)} »`).join(", ")} ne vien${libres.size > 1 ? "nent" : "t"} d'aucun fait du cas ; tout nombre dit ou écrit est la valeur d'un fait.` });
    if (e.type === "chiffre") {
      const fait = contexte.cas.faits.find((f) => f.id === e.faitId);
      if (!fait) res.push({ ecranId: e.id, detail: "le chiffre cite un fait absent du cas." });
      else if (!fait.valeurs.includes(e.valeur)) res.push({ ecranId: e.id, detail: `le chiffre « ${nombreFr(e.valeur)} » n'est pas une valeur du fait « ${fait.enonce} ».` });
    }
  }
  return res;
}

/* ------------------------------------------------------------------ */
/* R13 : une estimation est dite avec sa réserve                         */
/* ------------------------------------------------------------------ */

export function regleReserveEstimation(fiche: FicheEcrans, contexte: ContexteCasConcret): Manquement[] {
  const faits = contexte.cas.faits;
  const sourcesDe = (v: number) => new Set(faits.filter((f) => f.valeurs.includes(v)).map((f) => f.source));
  const res: Manquement[] = [];
  for (const e of fiche.ecrans) {
    const estimes = new Set<string>();
    if (e.type === "chiffre") {
      const fait = faits.find((f) => f.id === e.faitId);
      if (fait?.source === "estimation") estimes.add(fait.enonce);
    }
    for (const v of nombresDe(e.texteDit)) {
      const s = sourcesDe(v);
      if (s.size === 1 && s.has("estimation")) for (const f of faits.filter((x) => x.valeurs.includes(v))) estimes.add(f.enonce);
    }
    if (estimes.size && !aUneReserve(e.texteDit)) {
      res.push({ ecranId: e.id, detail: `« ${[...estimes][0]} » est une estimation ; dites-la avec sa réserve (${RESERVES_ESTIMATION.map((r) => `« ${r} »`).join(", ")}).` });
    }
  }
  return res;
}

/* ------------------------------------------------------------------ */
/* R14 : aucun récit de client, aucun nom propre hors liste blanche      */
/* ------------------------------------------------------------------ */

/** Mots écrits avec une majuscule ailleurs qu'en début de phrase, hors sigles (tout en capitales) et hors liste blanche. */
export function nomsPropres(t: string): string[] {
  const permis = new Set(LISTE_BLANCHE_NOMS.map((n) => n.toLowerCase()));
  const res: string[] = [];
  let debut = true;
  let precedent = "";
  for (const brut of t.split(/\s+/).filter(Boolean)) {
    const mot = brut.replace(/^[«"“(\[]+/, "").replace(/[»"”)\],;:.!?…]+$/, "");
    const sansElision = mot.replace(/^(?:[ldjmnstc]|qu|jusqu|lorsqu|puisqu)['’]/i, "");
    // V4-3 : « +1 H » (la v4) : l'unité « H » après un nombre n'est pas un nom propre.
    const unite = sansElision === "H" && /\d$/.test(precedent);
    precedent = mot;
    if (sansElision && !debut && !unite && /^\p{Lu}/u.test(sansElision)) {
      const sigle = sansElision.replace(/\./g, "");
      const estSigle = sigle.length >= 2 && sigle === sigle.toUpperCase();
      if (!estSigle && !permis.has(sansElision.toLowerCase())) res.push(sansElision);
    }
    if (/^[«"“(\[]+$/.test(brut)) continue;
    debut = /[.!?…:]$/.test(brut.replace(/[»"”)\]]+$/, "")) && !/^(?:\p{Lu}\.){2,}$/u.test(brut);
  }
  return res;
}

export function regleSansTemoignage(fiche: FicheEcrans): Manquement[] {
  const res: Manquement[] = [];
  for (const e of fiche.ecrans) {
    for (const t of textesEcran(e)) {
      if (raconteUnClient(t)) res.push({ ecranId: e.id, detail: `« ${t} » raconte un client ; le format montre le cas, jamais un témoignage.` });
      const mot = MOTS_TEMOIGNAGE.find((m) => contientExpression(t, m));
      if (mot) res.push({ ecranId: e.id, detail: `« ${t} » contient « ${mot} » ; aucun avis ni témoignage.` });
      const noms = nomsPropres(t);
      if (noms.length) res.push({ ecranId: e.id, detail: `« ${t} » cite ${noms.map((n) => `« ${n} »`).join(", ")} ; aucun nom propre hors ${LISTE_BLANCHE_NOMS.join(", ")}.` });
    }
  }
  return res;
}

/* ------------------------------------------------------------------ */
/* R15 : posture « offre » ou porte B, aucune tournure d'usage réel      */
/* ------------------------------------------------------------------ */

export function regleSansUsageReel(fiche: FicheEcrans): Manquement[] {
  if (fiche.posture !== "offre" && fiche.origine !== "porte-b") return [];
  const res: Manquement[] = [];
  for (const e of fiche.ecrans) {
    for (const t of textesEcran(e)) {
      const tournure = TOURNURES_USAGE_REEL.find((x) => contientExpression(t, x));
      if (tournure) res.push({ ecranId: e.id, detail: `« ${t} » dit « ${tournure} » ; ce cas est une offre, pas un usage réel chez nous.` });
    }
  }
  return res;
}

/* ------------------------------------------------------------------ */
/* R16 : aucun prix, sauf fait de la grille officielle                   */
/* ------------------------------------------------------------------ */

/** Prix permis : valeurs des faits de source « site » qui énoncent un montant (la grille officielle publiée). */
function prixPermis(cas: CasConcret): Set<number> {
  return new Set(cas.faits.filter((f) => f.source === "site" && /€|euro/i.test(f.enonce)).flatMap((f) => f.valeurs));
}

export function regleSansPrix(fiche: FicheEcrans, contexte: ContexteCasConcret): Manquement[] {
  const permis = prixPermis(contexte.cas);
  const res: Manquement[] = [];
  for (const e of fiche.ecrans) {
    for (const t of textesEcran(e)) {
      const m = MOTIF_PRIX.exec(texteAvecNombres(t).replace(/(\d) (\d{3})\b/g, "$1$2"));
      if (m && !permis.has(Number(m[1].replace(",", ".")))) res.push({ ecranId: e.id, detail: `« ${t} » donne un prix ; aucun prix hors de la grille officielle.` });
    }
  }
  return res;
}

/* ------------------------------------------------------------------ */
/* R17 : phrase de conformité                                            */
/* ------------------------------------------------------------------ */

export function regleConformite(fiche: FicheEcrans, contexte: ContexteCasConcret): Manquement[] {
  const rgpd = contexte.cas.conformite?.rgpd;
  const annonce = annonceConformite;
  const res: Manquement[] = [];
  if (!rgpd) {
    for (const e of fiche.ecrans) {
      if (textesEcran(e).some(annonce)) res.push({ ecranId: e.id, detail: "la conformité n'est dite que si le cas porte le fait validé ; ce cas ne le porte pas." });
    }
    return res;
  }
  const phrase = texteNormalise(rgpd.phrase);
  const motsPhrase = new Set(phrase.split(" "));
  const corps = texteNormalise(fiche.ecrans.map((e) => e.texteDit).join(" "));
  const premierDit = fiche.ecrans.find((e) => annonce(e.texteDit));
  if (premierDit && !` ${corps} `.includes(` ${phrase} `)) {
    res.push({ ecranId: premierDit.id, detail: `la phrase de conformité doit être dite mot pour mot : « ${rgpd.phrase} »` });
  }
  for (const e of fiche.ecrans) {
    for (const t of textesEcrits(e).filter(annonce)) {
      const hors = texteNormalise(t).split(" ").filter((m) => m && !motsPhrase.has(m));
      if (hors.length) res.push({ ecranId: e.id, detail: `« ${t} » s'écarte de la phrase de conformité validée (${hors.map((m) => `« ${m} »`).join(", ")}).` });
    }
  }
  return res;
}

/* ------------------------------------------------------------------ */
/* R18 : aucune phrase d'appel dans le corps                             */
/* ------------------------------------------------------------------ */

export function regleSansAppel(fiche: FicheEcrans): Manquement[] {
  const res: Manquement[] = [];
  for (const e of fiche.ecrans) {
    for (const t of textesEcran(e)) {
      const tournure = TOURNURES_APPEL.find((x) => contientExpression(t, x));
      if (tournure) res.push({ ecranId: e.id, detail: `« ${t} » contient « ${tournure} » ; l'appel vient de la table des fins, jamais du corps.` });
    }
  }
  return res;
}

/* ------------------------------------------------------------------ */
/* R19 : objets et captures connus, toute capture a un repli             */
/* ------------------------------------------------------------------ */

export function regleVisuelsConnus(fiche: FicheEcrans, contexte: ContexteCasConcret): Manquement[] {
  const connus = new Set<string>(OBJETS);
  const res: Manquement[] = [];
  for (const e of fiche.ecrans) {
    if (e.type !== "etape" && e.type !== "objet") continue;
    const v = e.visuel;
    if (v.sorte === "objet") {
      if (!connus.has(v.objet)) res.push({ ecranId: e.id, detail: `l'objet « ${v.objet} » n'est pas dans la banque.` });
      continue;
    }
    const etape = contexte.cas.etapes[v.etapeCas - 1];
    if (!etape) res.push({ ecranId: e.id, detail: `le vrai écran vise l'étape ${v.etapeCas} ; le cas n'en a que ${contexte.cas.etapes.length}.` });
    else if (etape.visuel.sorte !== "ecran") res.push({ ecranId: e.id, detail: `l'étape ${v.etapeCas} du cas n'a pas de vrai écran à montrer.` });
    if (!connus.has(v.repli)) res.push({ ecranId: e.id, detail: `le repli « ${v.repli} » n'est pas dans la banque ; toute capture a un repli connu.` });
  }
  return res;
}

/* ------------------------------------------------------------------ */
/* R20 : nombre d'écrans et d'étapes                                     */
/* ------------------------------------------------------------------ */

export function regleNombreEcrans(fiche: FicheEcrans): Manquement[] {
  const res: Manquement[] = [];
  const n = fiche.ecrans.length;
  if (n < ECRANS_CORPS.min || n > ECRANS_CORPS.max) res.push({ detail: `le corps compte ${n} écrans ; de ${ECRANS_CORPS.min} à ${ECRANS_CORPS.max}.` });
  const etapes = fiche.ecrans.filter((e): e is EcranDeType<"etape"> => e.type === "etape");
  if (etapes.length < ETAPES.min || etapes.length > ETAPES.max) res.push({ detail: `la fiche compte ${etapes.length} étapes ; de ${ETAPES.min} à ${ETAPES.max}.` });
  etapes.forEach((e, i) => {
    if (e.numero !== i + 1 || e.total !== etapes.length) res.push({ ecranId: e.id, detail: `l'étape est numérotée ${e.numero} sur ${e.total} ; attendu ${i + 1} sur ${etapes.length}.` });
  });
  return res;
}

/* ------------------------------------------------------------------ */
/* R21 : durée estimée du tout                                           */
/* ------------------------------------------------------------------ */

/** Durée estimée d'une fin planifiée (tenue finale comprise quand elle n'est pas calée), au débit donné. */
export function dureeFinMs(fin: Pick<FinPlanifiee, "ecrans">, debit: number = DEBIT_RECETTE): number {
  const t = tempsEcrans(fin.ecrans, debit);
  return t.length ? t[t.length - 1].finMs - t[0].debutMs + (estCalee(fin.ecrans) ? 0 : TENUE_FINALE_MS) : 0;
}

/** Durée estimée de la fin la plus longue : celle des fins planifiées si l'appelant les passe, sinon la suite la plus longue de la table. */
function dureeFinLaPlusLongueMs(contexte: ContexteCasConcret, debit: number): number {
  if (contexte.fins?.length) return Math.max(...contexte.fins.map((f) => dureeFinMs(f, debit)));
  return dureeFinParDefautMs(contexte.cas, debit);
}

/** Durée de la suite la plus longue de la table pour ce cas (fins pas encore planifiées), tenue finale comprise. */
export function dureeFinParDefautMs(cas: Pick<ContexteCasConcret["cas"], "offre" | "nature" | "mot" | "motDit">, debit: number = DEBIT_RECETTE): number {
  const table = new Map(TABLE_FINS_DIAGNOSTIC.map((l) => [l.id, l]));
  const motDit = cas.motDit ?? cas.mot;
  // Le mot branché partout où il peut l'être : la suite la plus longue, fin au mot comme fin « diagnostic ».
  const suites = Object.values(finsParReseau(cas.offre, ["facebook", "instagram"], cas.nature));
  const motsMax = Math.max(...suites.map((ids) => ids.reduce((s, id) => s + motsLus((table.get(id)?.dit ?? "").replace(EMPLACEMENT_MOT, motDit)).length, 0)));
  return (motsMax * 1000) / debit + TENUE_FINALE_MS;
}

export function regleDureeTotale(fiche: FicheEcrans, contexte: ContexteCasConcret): Manquement[] {
  const debit = debitDe(contexte);
  const t = tempsEcrans(fiche.ecrans, debit);
  if (!t.length) return [];
  const total = t[t.length - 1].finMs - t[0].debutMs + dureeFinLaPlusLongueMs(contexte, debit);
  if (total < DUREE_TOTALE_REFUS_MS.min || total > DUREE_TOTALE_REFUS_MS.max) {
    return [{ detail: `la vidéo est estimée à ${secondes(total)}, fin la plus longue comprise ; elle doit tenir de ${secondes(DUREE_TOTALE_REFUS_MS.min)} à ${secondes(DUREE_TOTALE_REFUS_MS.max)} (visée : 40 à 60 s).` }];
  }
  return [];
}

/* ------------------------------------------------------------------ */
/* R22 : sigles écrits pour être lus dans le texte dit seulement         */
/* ------------------------------------------------------------------ */

export function regleSigles(fiche: FicheEcrans): Manquement[] {
  const res: Manquement[] = [];
  for (const e of fiche.ecrans) {
    for (const brut of e.texteDit.split(/\s+/)) {
      const m = brut.replace(/^[«"“(\[]+/, "").replace(/[»"”)\],;:!?…]+$/, "").replace(/\.$/, "");
      if (/^\p{Lu}{2,}$/u.test(m)) res.push({ ecranId: e.id, detail: `« ${m} » est dit ; écrivez-le pour être lu (« ${[...m].join(".")}. »).` });
    }
    for (const t of textesEcrits(e)) {
      const s = /(?:\p{Lu}\.){2,}/u.exec(t);
      if (s) res.push({ ecranId: e.id, detail: `« ${t} » montre « ${s[0]} » ; à l'écran, le sigle s'écrit « ${s[0].replace(/\./g, "")} ».` });
    }
  }
  return res;
}

/* ------------------------------------------------------------------ */
/* R23 : l'ordre du fonctionnement (V4-3)                                */
/* ------------------------------------------------------------------ */

/** Titre comparé : sans le balisage d'accent (« L'*annonce* »), sans casse, sans accent. */
const cleTitre = (t: string) => motsLus(t.replace(/\*/g, "")).map(cleMot).join(" ");

/** Les étapes du cas reconnues dans une fiche (écran → rang dans le cas), et l'écran où commence la partie humaine. */
export interface EtapesMontrees {
  etapes: { ecran: number; rang: number }[];
  /** Index de l'écran où la partie humaine du cas (`resteHumain`, mot pour mot) commence ; `null` : pas dite. */
  resteHumain: number | null;
}

/**
 * Reconnaît, écran par écran, l'étape du cas montrée : un vrai écran par son `etapeCas` ; sinon un écran « etape » ou
 * « objet » par son titre (celui de l'étape), ou par la ligne de l'étape dite mot pour mot ; sinon un écran « etape » par
 * son objet, quand une seule étape du cas porte cet objet. L'écran qui dit la partie humaine n'est jamais une étape.
 */
export function etapesMontrees(fiche: Pick<FicheEcrans, "ecrans">, cas: CasConcret): EtapesMontrees {
  const e = fiche.ecrans;
  const reste = texteAvecNombres(cas.resteHumain).split(" ").filter(Boolean);
  const mots = e.flatMap((x, i) => texteAvecNombres(x.texteDit).split(" ").filter(Boolean).map((m) => ({ m, i })));
  let resteHumain: number | null = null;
  for (let k = 0; reste.length && k <= mots.length - reste.length; k++) {
    if (reste.every((w, j) => mots[k + j].m === w)) {
      resteHumain = mots[k].i;
      break;
    }
  }
  const titres = cas.etapes.map((x) => cleTitre(x.titre));
  const lignes = cas.etapes.map((x) => texteAvecNombres(x.ligne));
  const parObjet = new Map<string, number[]>();
  cas.etapes.forEach((x, i) => {
    if (x.visuel.sorte === "objet") parObjet.set(x.visuel.objet, [...(parObjet.get(x.visuel.objet) ?? []), i + 1]);
  });
  const etapes: EtapesMontrees["etapes"] = [];
  e.forEach((x, i) => {
    if (i === resteHumain || (x.type !== "etape" && x.type !== "objet")) return;
    let rang: number | undefined;
    if (x.type === "etape" && x.visuel.sorte === "ecran") rang = x.visuel.etapeCas;
    else {
      const t = titres.indexOf(cleTitre(x.titre));
      const dit = ` ${texteAvecNombres(x.texteDit)} `;
      const l = lignes.findIndex((ligne) => ligne && dit.includes(` ${ligne} `));
      const parSonObjet = x.type === "etape" && x.visuel.sorte === "objet" ? parObjet.get(x.visuel.objet) : undefined;
      rang = t >= 0 ? t + 1 : l >= 0 ? l + 1 : parSonObjet?.length === 1 ? parSonObjet[0] : undefined;
    }
    if (rang) etapes.push({ ecran: i, rang });
  });
  return { etapes, resteHumain };
}

/** « après l'étape 5 « Le rappel », avant l'étape 6 « Le contrat » ». */
function placeDuResteHumain(cas: CasConcret, n: number): string {
  const nom = (r: number) => `l'étape ${r} « ${cas.etapes[r - 1].titre} »`;
  return `après ${nom(n)}${n < cas.etapes.length ? `, avant ${nom(n + 1)}` : ""}`;
}

/**
 * R23 : les étapes montrées suivent l'ordre du cas (une étape peut tenir sur plusieurs écrans, une étape peut manquer) ;
 * la partie humaine est dite, mot pour mot, à sa place dans la suite des étapes (`resteHumainApresEtape`).
 */
export function regleOrdreDuFonctionnement(fiche: FicheEcrans, contexte: ContexteCasConcret): Manquement[] {
  const cas = contexte.cas;
  const e = fiche.ecrans;
  const m = etapesMontrees(fiche, cas);
  const res: Manquement[] = [];
  let plusLoin = 0;
  for (const x of m.etapes) {
    if (x.rang < plusLoin) res.push({ ecranId: e[x.ecran].id, detail: `« ${cas.etapes[x.rang - 1].titre} » (étape ${x.rang} du cas) est montrée après « ${cas.etapes[plusLoin - 1].titre} » (étape ${plusLoin}) ; les étapes se montrent dans l'ordre du cas.` });
    else plusLoin = x.rang;
  }
  const n = cas.resteHumainApresEtape;
  if (n === undefined) return res;
  const place = placeDuResteHumain(cas, n);
  if (m.resteHumain === null) {
    res.push({ detail: `la partie humaine du cas (« ${cas.resteHumain} ») n'est pas dite ; elle se dit mot pour mot, ${place}.` });
    return res;
  }
  const r = m.resteHumain;
  const tropTard = m.etapes.find((x) => x.rang > n && x.ecran < r);
  const tropTot = [...m.etapes].reverse().find((x) => x.rang <= n && x.ecran > r);
  const ecart = tropTard ? `après « ${cas.etapes[tropTard.rang - 1].titre} »` : tropTot ? `avant « ${cas.etapes[tropTot.rang - 1].titre} »` : null;
  if (ecart) res.push({ ecranId: e[r].id, detail: `la partie humaine (« ${cas.resteHumain} ») est dite ${ecart} ; dans le vrai fonctionnement, elle vient ${place}.` });
  return res;
}

/* ------------------------------------------------------------------ */
/* Liste ordonnée R02 à R22, validation complète                        */
/* ------------------------------------------------------------------ */

export const REGLES_R12_R22: readonly RegleCasConcret[] = [
  { id: "R12", nom: "nombres des faits", verifier: regleNombresDesFaits },
  { id: "R13", nom: "réserve des estimations", verifier: regleReserveEstimation },
  { id: "R14", nom: "aucun témoignage", verifier: regleSansTemoignage },
  { id: "R15", nom: "aucun usage réel", verifier: regleSansUsageReel },
  { id: "R16", nom: "aucun prix", verifier: regleSansPrix },
  { id: "R17", nom: "phrase de conformité", verifier: regleConformite },
  { id: "R18", nom: "aucun appel dans le corps", verifier: regleSansAppel },
  { id: "R19", nom: "visuels connus", verifier: regleVisuelsConnus },
  { id: "R20", nom: "nombre d'écrans", verifier: regleNombreEcrans },
  { id: "R21", nom: "durée totale", verifier: regleDureeTotale },
  { id: "R22", nom: "sigles", verifier: regleSigles },
  { id: "R23", nom: "ordre du fonctionnement", verifier: regleOrdreDuFonctionnement },
];

export const REGLES_CAS_CONCRET: readonly RegleCasConcret[] = [...REGLES_R02_R11, ...REGLES_R12_R22];

export { cadeauDeLOffre };

/** Cadeau annoncé par la fin du cas : celui de son offre, selon sa nature (une automatisation, des outils reliés). */
export function cadeauDuCas(cas: Pick<CasConcret, "offre" | "nature">): string | undefined {
  return cadeauDeLOffre(cas.offre, cas.nature);
}

/** Le document promis du cas est-il le cadeau annoncé par la fin de son offre ? (Une offre sans cadeau n'en annonce aucun.) */
export function problemesDuCas(cas: CasConcret): ProblemeFiche[] {
  const attendu = cadeauDuCas(cas);
  if (!attendu || cas.documentPromis.finCadeauId === attendu) return [];
  const regle = "document promis";
  return [{ regle, message: `Fiche · règle « ${regle} » : le document promis « ${cas.documentPromis.nom} » ne correspond pas au cadeau annoncé par la fin de l'offre.` }];
}

/** Validation complète : schéma exact (R01), document promis du cas, puis les règles R02 à R22. Ne modifie jamais la fiche. */
export function validerFicheEcrans(brut: unknown, contexte: ContexteCasConcret): ResultatFiche<FicheEcrans> {
  const forme = validerSchemaFiche(brut);
  if (!forme.ok) return forme;
  const problemes = [...problemesDuCas(contexte.cas), ...verifierRegles(forme.fiche, contexte, REGLES_CAS_CONCRET)];
  return problemes.length ? { ok: false, problemes } : forme;
}
