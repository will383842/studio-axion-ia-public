/**
 * CALAGE DU TABLEAU ANIMÉ (tâche TB-02, plan `02-FORMAT-TABLEAU-ANIME.md` § 4.2 étape 4).
 *
 * Fonction PURE : fiche valide + mots horodatés de la voix maître (`AudioMaitre.mots`, `src/briques/voix-maitre`)
 * → fiche CALÉE : `debutMs` / `finMs` de chaque scène, et l'heure de début de chaque élément (son `ancre` = index du
 * mot dans le `texteDit`, même découpe que les règles : `mots` de `src/domaine/controles-script/texte`).
 *
 *  - Les mots dits doivent correspondre aux mots écrits, dans l'ordre (casse, accents et ponctuation ignorés ; un mot
 *    coupé ou collé autrement par la voix est recollé). Écart toléré, celui que prévoit `src/domaine/prononciations.ts` :
 *    un mot de la liste des prononciations dit sous sa prononciation (`substituerPrononciations`, variantes de
 *    `motifMot` comprises), un nombre dit en lettres (`nombreEnLettres`). Tout autre écart est refusé, en nommant la
 *    scène.
 *  - Les scènes se suivent sans trou ni chevauchement : la première commence à 0 ; une scène commence au premier mot
 *    qu'elle dit et finit où la suivante commence ; la dernière finit à la fin de son dernier mot (ou à la fin du son
 *    si elle est donnée et plus tardive).
 *  - Un élément part au début de son mot d'ancre ; l'ancre 0 part au début de la scène (accroche visible dès la
 *    première image). Une mention, sans ancre, part au début de la scène.
 *  - Les heures d'éléments ne vont pas dans la fiche (son schéma est exact) : elles sont rendues à côté.
 *  - La fiche calée repasse la validation complète (`validerFicheTableau`) ; un refus est rendu tel quel.
 *  - Style « blocs/2 » (11/10) : le second écran d'une scène et chaque élément de liste d'un écran ont aussi leur heure
 *    (`<scène>~e<k>`, `<scène>~e<k>~<i>`, à leur mot d'ancre) ; et l'écran de fin RESTE après la voix
 *    (`TENUE_FIN_TOTALE_MS` : 2,5 s de tenue puis 0,4 s de fondu de l'image) : la dernière scène finit d'autant après
 *    son dernier mot. Style « reference/1 » (14/10) : même tenue de la page finie. Style d'avant : inchangé.
 *  - Style « reference/2 » (14/10) : la pastille numérotée d'une étape a son heure (`<scène>~n`), au mot où la voix
 *    dit le numéro (« Un… », « Deux… »).
 *
 * Réutilise `src/briques/motion/calage.ts` (importé, non modifié) : le type `MotCalage` des mots horodatés. Ses
 * fonctions de recherche d'un texte dans la parole (`instantDit`, `calerCarte`) ne s'appliquent pas ici : l'ancre
 * désigne déjà le mot exact.
 */
import type { MotCalage } from "@/briques/motion/calage";
import type { ProblemeFiche } from "@/briques/fiche-scenes";
import { mots } from "@/domaine/controles-script/texte";
import { cleMot, nombreEnLettres, substituerPrononciations } from "@/domaine/prononciations";
import { TENUE_FIN_TOTALE_MS } from "@/briques/tableau-scene/v2/charte";
import { appelEnFinDeFiche, idBloc, idEcran, idItemEcran, idNumero, idVisuel, validerFicheTableau, type FicheTableau } from "./fiche";
import { REGLES_TABLEAU, type ContexteTableau } from "./regles";
import { reparerRythmeFiche } from "./rythme";

export interface OptionsCalage {
  /** Contexte de la validation de la fiche calée (même contexte que la validation de la fiche brute). */
  contexte: ContexteTableau;
  /** Prononciations envoyées à la voix (`prononciationsActives`) : seul écart toléré entre mot écrit et mot dit. */
  prononciations?: readonly { mot: string; prononciation: string }[];
  /** Durée du son maître (s) ; la dernière scène finit au plus tard des deux (fin du dernier mot, fin du son). */
  dureeSec?: number;
}

export interface ElementCale {
  elementId: string;
  sceneId: string;
  debutMs: number;
}

export type ResultatCalage =
  | { ok: true; fiche: FicheTableau; elements: ElementCale[] }
  | { ok: false; problemes: string[]; validation?: ProblemeFiche[] };

/** Un mot écrit de la fiche, avec la scène d'où il vient. */
interface MotEcrit {
  texte: string;
  scene: number;
  rang: number;
}

/** Intervalle (ms) où un mot écrit est dit. */
interface Dit {
  debutMs: number;
  finMs: number;
}

const ms = (s: number) => Math.round(s * 1000);

/** Formes dites admises d'un mot écrit isolé : lui-même, un nombre en lettres. */
function formesDites(texte: string): string[] {
  const cle = cleMot(texte);
  const formes = [cle];
  if (/^\d+$/.test(cle) && cle.length <= 9) formes.push(cleMot(nombreEnLettres(Number(cle))));
  return formes;
}

/**
 * Cherche à partir de `i` (mots écrits) et `j` (mots dits) la plus courte correspondance : `a` mots écrits ↔ `b`
 * mots dits, par recollement des clés ou par une prononciation de la liste.
 */
function correspondance(
  ecrits: MotEcrit[],
  dits: MotCalage[],
  i: number,
  j: number,
  prononciations: readonly { mot: string; prononciation: string }[],
): { a: number; b: number } | null {
  const FENETRE = 6;
  const cleDits = (b: number) => dits.slice(j, j + b).map((d) => cleMot(d.mot)).join("");
  for (let a = 1; a <= FENETRE && i + a <= ecrits.length; a++) {
    const bloc = ecrits.slice(i, i + a).map((e) => e.texte);
    const attendues = new Set<string>(a === 1 ? formesDites(bloc[0]) : [bloc.map(cleMot).join("")]);
    // Ce que la voix a reçu : le texte écrit, prononciations substituées (même fonction que l'écoute d'essai).
    if (prononciations.length) attendues.add(cleMot(substituerPrononciations(bloc.join(" "), [...prononciations])));
    for (let b = 1; b <= FENETRE && j + b <= dits.length; b++) {
      if (attendues.has(cleDits(b))) return { a, b };
    }
  }
  return null;
}

/**
 * Correspondance des mots écrits (texte dit des scènes) et des mots dits : l'intervalle (ms) où chaque mot écrit est dit,
 * dans l'ordre. Refus en français (scène nommée) sur le premier écart non toléré.
 */
function alignerMots(fiche: FicheTableau, ecrits: MotEcrit[], motsDits: readonly MotCalage[], prononciations: readonly { mot: string; prononciation: string }[]): { ok: true; temps: Dit[] } | { ok: false; problemes: string[] } {
  const problemes: string[] = [];
  const dits = motsDits.filter((d) => cleMot(d.mot) !== "");
  for (const [k, d] of dits.entries()) {
    if (!(d.debutSec >= 0 && d.finSec >= d.debutSec) || (k > 0 && d.debutSec < dits[k - 1].debutSec)) {
      return { ok: false, problemes: [`Le mot dit n° ${k + 1} (« ${d.mot} ») a des heures incohérentes (${d.debutSec} s → ${d.finSec} s).`] };
    }
  }
  const temps: Dit[] = [];
  let i = 0;
  let j = 0;
  while (i < ecrits.length) {
    const e = ecrits[i];
    const s = fiche.scenes[e.scene];
    if (j >= dits.length) {
      problemes.push(`Scène ${s.id} · la voix s'arrête avant le mot ${e.rang + 1} (« ${e.texte} ») : il manque la fin du texte dit.`);
      break;
    }
    const c = correspondance(ecrits, dits, i, j, prononciations);
    if (!c) {
      problemes.push(`Scène ${s.id} · le mot ${e.rang + 1} écrit « ${e.texte} » ne correspond pas au mot dit « ${dits[j].mot} » (à ${dits[j].debutSec} s).`);
      break;
    }
    const intervalle = { debutMs: ms(dits[j].debutSec), finMs: ms(dits[j + c.b - 1].finSec) };
    for (let k = 0; k < c.a; k++) temps.push(intervalle);
    i += c.a;
    j += c.b;
  }
  if (!problemes.length && j < dits.length) {
    const s = fiche.scenes[fiche.scenes.length - 1];
    problemes.push(`Scène ${s.id} · la voix dit ${dits.length - j} mot${dits.length - j > 1 ? "s" : ""} de plus que le texte dit (à partir de « ${dits[j].mot} »).`);
  }
  return problemes.length ? { ok: false, problemes } : { ok: true, temps };
}

/**
 * Intervalle (ms) où chaque mot du texte dit de chaque scène est dit par la voix (même découpe que l'ancre) ; `null` si
 * les mots ne correspondent pas (le calage dit alors pourquoi). Lu par les heures fines du style « reference/3 ».
 */
export function motsDitsParScene(fiche: FicheTableau, motsDits: readonly MotCalage[], prononciations: readonly { mot: string; prononciation: string }[] = []): { debutMs: number; finMs: number }[][] | null {
  const motsScenes = fiche.scenes.map((s) => mots(s.texteDit));
  const ecrits: MotEcrit[] = motsScenes.flatMap((m, scene) => m.map((texte, rang) => ({ texte, scene, rang })));
  const a = alignerMots(fiche, ecrits, motsDits, prononciations);
  if (!a.ok) return null;
  let i = 0;
  return motsScenes.map((m) => m.map(() => a.temps[i++]));
}

/** Cale une fiche valide sur les mots horodatés de la voix maître. */
export function calerFicheTableau(fiche: FicheTableau, motsDits: readonly MotCalage[], options: OptionsCalage): ResultatCalage {
  const problemes: string[] = [];

  // 1. Ancres dans le texte dit.
  const motsScenes = fiche.scenes.map((s) => mots(s.texteDit));
  fiche.scenes.forEach((s, k) => {
    const n = motsScenes[k].length;
    for (const e of s.elements) {
      if ("ancre" in e && e.ancre >= n) {
        problemes.push(`Scène ${s.id} · l'élément « ${e.id} » part du mot ${e.ancre + 1}, mais le texte dit n'a que ${n} mot${n > 1 ? "s" : ""}.`);
      }
    }
    const num = s.gabarit?.numero;
    if (num && num.ancre >= n) problemes.push(`Scène ${s.id} · le numéro ${num.n} part du mot ${num.ancre + 1}, mais le texte dit n'a que ${n} mot${n > 1 ? "s" : ""}.`);
    for (const [quoi, x] of [["le visuel", s.gabarit?.visuel], ["le bloc orange", s.gabarit?.bloc]] as const)
      if (x?.ancre !== undefined && x.ancre >= n) problemes.push(`Scène ${s.id} · ${quoi} part du mot ${x.ancre + 1}, mais le texte dit n'a que ${n} mot${n > 1 ? "s" : ""}.`);
    for (const [j, ec] of (s.ecrans ?? []).entries()) {
      for (const a of [ec.ancre ?? 0, ...(ec.liste ?? []).map((it) => it.ancre)]) {
        if (a >= n) problemes.push(`Scène ${s.id} · l'écran ${j + 1} part (ou montre un élément de liste) au mot ${a + 1}, mais le texte dit n'a que ${n} mot${n > 1 ? "s" : ""}.`);
      }
    }
  });
  if (problemes.length) return { ok: false, problemes };

  // 2. Correspondance des mots écrits et des mots dits.
  const ecrits: MotEcrit[] = motsScenes.flatMap((m, scene) => m.map((texte, rang) => ({ texte, scene, rang })));
  const aligne = alignerMots(fiche, ecrits, motsDits, options.prononciations ?? []);
  if (!aligne.ok) return { ok: false, problemes: aligne.problemes };
  const temps = aligne.temps;

  // 3. Début et fin des scènes, sans trou ni chevauchement.
  const premier: number[] = [];
  let curseur = 0;
  for (const m of motsScenes) {
    premier.push(curseur);
    curseur += m.length;
  }
  const dernierMot = temps.length ? temps[temps.length - 1].finMs : 0;
  const finSon = options.dureeSec !== undefined ? ms(options.dureeSec) : 0;
  const debuts = fiche.scenes.map((_, k) => (k === 0 ? 0 : temps[premier[k]].debutMs));
  for (let k = 1; k < debuts.length; k++) debuts[k] = Math.max(debuts[k], debuts[k - 1]);
  // « blocs/2 » et « reference/1 » : la page de fin tient après la voix, puis l'image s'efface.
  const tenue = appelEnFinDeFiche(fiche) ? TENUE_FIN_TOTALE_MS : 0;
  const fins = fiche.scenes.map((_, k) => (k + 1 < debuts.length ? debuts[k + 1] : Math.max(dernierMot + tenue, finSon)));
  fiche.scenes.forEach((s, k) => {
    if (fins[k] <= debuts[k]) problemes.push(`Scène ${s.id} · la scène ne dure pas (début ${debuts[k]} ms, fin ${fins[k]} ms) : ses mots ne sont pas dits après ceux de la scène précédente.`);
  });
  if (problemes.length) return { ok: false, problemes };

  const calee: FicheTableau = { ...fiche, scenes: fiche.scenes.map((s, k) => ({ ...s, debutMs: debuts[k], finMs: fins[k] })) };
  const heureAncre = (k: number, ancre: number) => (ancre === 0 ? debuts[k] : Math.min(fins[k], Math.max(debuts[k], temps[premier[k] + ancre].debutMs)));
  const elementsDe = (f: FicheTableau): ElementCale[] =>
    f.scenes.flatMap((s, k) => [
      ...s.elements.map((e) => ({ elementId: e.id, sceneId: s.id, debutMs: heureAncre(k, "ancre" in e ? e.ancre : 0) })),
      // Style « reference/2 » : la pastille numérotée part au mot où la voix dit le numéro.
      ...(s.gabarit?.numero ? [{ elementId: idNumero(s.id), sceneId: s.id, debutMs: heureAncre(k, s.gabarit.numero.ancre) }] : []),
      // Style « reference/3 » (peps) : le visuel part à son mot (sinon après les lignes de sa scène) ; le bloc orange, à
      // son mot (sinon au début de la scène).
      ...(s.gabarit?.visuel ? [{ elementId: idVisuel(s.id), sceneId: s.id, debutMs: heureAncre(k, s.gabarit.visuel.ancre ?? Math.max(0, ...s.elements.map((e) => (e.type === "ligne" ? e.ancre : 0)))) }] : []),
      ...(s.gabarit?.bloc ? [{ elementId: idBloc(s.id), sceneId: s.id, debutMs: heureAncre(k, s.gabarit.bloc.ancre ?? 0) }] : []),
      ...(s.ecrans ?? []).flatMap((ec, j) => [
        ...(j > 0 ? [{ elementId: idEcran(s.id, j), sceneId: s.id, debutMs: heureAncre(k, ec.ancre ?? 0) }] : []),
        ...(ec.liste ?? []).map((it, i) => ({ elementId: idItemEcran(s.id, j, i), sceneId: s.id, debutMs: heureAncre(k, it.ancre) })),
      ]),
    ]);

  // 4. La fiche calée repasse la validation complète.
  const v = validerFicheTableau(calee, options.contexte);
  if (v.ok) return { ok: true, fiche: v.fiche, elements: elementsDe(v.fiche) };
  // Refus par la seule règle du rythme, lue sur les temps de la VRAIE voix : la réparation automatique (`rythme.ts`)
  // passe avant de refuser (ancres redistribuées, gestes sûrs ajoutés ; le texte dit et les textes écrits ne changent
  // pas, ni le nombre de scènes : une scène calée n'est jamais coupée). Elle n'est gardée que si la validation passe.
  if (v.problemes.every((p) => p.regle === REGLE_RYTHME)) {
    const reparee = reparerRythmeFiche(calee, { ...(options.contexte.caracteresParSeconde ? { debit: options.contexte.caracteresParSeconde } : {}), ...(options.contexte.motsDouleur ? { motsDouleur: options.contexte.motsDouleur } : {}) });
    const r = reparee !== calee && reparee.scenes.length === calee.scenes.length ? validerFicheTableau(reparee, options.contexte) : null;
    if (r?.ok) return { ok: true, fiche: r.fiche, elements: elementsDe(r.fiche) };
  }
  return { ok: false, problemes: v.problemes.map((p) => p.message), validation: v.problemes };
}

/** Nom de la règle 16 (du rythme), tel que la validation le rend dans `ProblemeFiche.regle`. */
const REGLE_RYTHME = REGLES_TABLEAU.find((r) => r.numero === 16)!.nom;
