/**
 * CALAGE DU CAS CONCRET (tâche M5, plan cas concret § 4-f et § 6). Fonction PURE.
 *
 * Fiche valide (le corps) + fin choisie + mots horodatés de la voix assemblée (corps puis fin, au tempo final) → fiche CALÉE :
 * `debutMs` / `finMs` de chaque écran, et l'heure de chaque événement (rendue à côté : le schéma de la fiche est exact).
 *
 *  - Les mots dits doivent correspondre aux mots écrits des `texteDit`, dans l'ordre (casse, accents, ponctuation ignorés ;
 *    un mot coupé ou collé autrement par la voix est recollé). Seuls écarts permis : un nombre dit en lettres, un mot dit
 *    sous sa prononciation. Tout autre écart est refusé, en nommant l'écran et le mot.
 *  - Un écran démarre au début du premier mot de son `texteDit` moins `avanceMs`, arrondi à l'image (40 ms) ; le premier à 0.
 *    Il finit au début du suivant ; le dernier finit à la fin du dernier mot plus `finApresDernierMotSec` (2,1 s).
 *  - Un événement tombe au début de son mot `surMot` (compté par `motsLus`, comme la fiche) moins son avance, dans les
 *    limites de son écran.
 *  - Les écrans de la fin (s'il y en a une) suivent ceux du corps sur la même ligne de temps.
 *  - Un écran trop court ne sort jamais du calage (R05, tâche X1) : quand le mot-repère d'un écran arrive moins d'une
 *    seconde après celui du précédent, l'écran commence plus tôt en prenant au précédent ce qu'il a en trop, sinon il
 *    retarde le suivant ; le dernier écran d'une suite ne peut que commencer plus tôt. La jonction du corps et de la fin
 *    ne bouge jamais (le corps finit au même instant pour toutes les fins). Déterministe.
 */
import type { MotCalage } from "@/briques/motion/calage";
import { cleMot, nombreEnLettres, substituerPrononciations } from "@/domaine/prononciations";
import { ECRAN_DUREE_MIN_MS } from "./regles";
import { motsLus, problemesEcran, validerSchemaFiche, type Ecran, type EcranFin, type FicheEcrans, type FinPlanifiee } from "./fiche";

/** Durée d'une image : 25 images par seconde. */
export const IMAGE_MS = 40;

export interface OptionsCalageCasConcret {
  /** Prononciations envoyées à la voix : seul écart toléré entre le mot écrit et le mot dit. */
  prononciations?: readonly { mot: string; prononciation: string }[];
  /** Tenue du dernier écran après son dernier mot, en secondes (2,1 s). */
  finApresDernierMotSec: number;
}

export interface EvenementCale {
  ecranId: string;
  cible: string;
  debutMs: number;
}

export type ResultatCalageCasConcret =
  | { ok: true; fiche: FicheEcrans; fin: FinPlanifiee | null; evenements: EvenementCale[]; dureeMs: number }
  | { ok: false; problemes: string[] };

interface MotEcrit {
  texte: string;
  ecran: number;
  rang: number;
}

const ms = (s: number) => Math.round(s * 1000);
const aLImage = (v: number) => Math.round(v / IMAGE_MS) * IMAGE_MS;

/**
 * Étire les écrans trop courts de la suite [s, e) : le début de l'écran `s` et la fin `bout` du dernier sont fixes ; le
 * dernier écran doit durer `minDernier` (tenue finale comprise pour la fin d'une vidéo). Heures à l'image (40 ms).
 */
function etirerEcransCourts(debuts: number[], s: number, e: number, bout: number, minDernier: number): void {
  const min = (k: number) => (k === e - 1 ? minDernier : ECRAN_DUREE_MIN_MS);
  const finDe = (k: number) => (k + 1 < e ? debuts[k + 1] : bout);
  for (let k = s; k < e; k++) {
    let manque = min(k) - (finDe(k) - debuts[k]);
    if (manque <= 0) continue;
    // 1. Commencer plus tôt, sur ce que le précédent a en trop (le premier écran de la suite ne bouge pas).
    if (k > s) {
      const pris = Math.max(0, Math.min(manque, debuts[k] - debuts[k - 1] - ECRAN_DUREE_MIN_MS));
      debuts[k] -= pris;
      manque -= pris;
    }
    if (manque <= 0) continue;
    // 2. Retarder le suivant (qui sera étiré à son tour s'il devient trop court).
    if (k + 1 < e) {
      debuts[k + 1] += manque;
      continue;
    }
    // 3. Le dernier écran : commencer plus tôt, en reculant les précédents d'autant qu'il le faut.
    debuts[k] = bout - minDernier;
    for (let j = k; j > s + 1 && debuts[j] - debuts[j - 1] < ECRAN_DUREE_MIN_MS; j--) debuts[j - 1] = debuts[j] - ECRAN_DUREE_MIN_MS;
  }
}

/** Formes dites admises d'un mot écrit isolé : lui-même, ou un nombre en lettres. */
function formesDites(texte: string): string[] {
  const cle = cleMot(texte);
  const formes = [cle];
  if (/^\d+$/.test(cle) && cle.length <= 9) formes.push(cleMot(nombreEnLettres(Number(cle))));
  return formes;
}

/** Plus courte correspondance entre `a` mots écrits (depuis `i`) et `b` mots dits (depuis `j`). */
function correspondance(ecrits: MotEcrit[], dits: MotCalage[], i: number, j: number, prononciations: readonly { mot: string; prononciation: string }[]): { a: number; b: number } | null {
  const FENETRE = 6;
  const cleDits = (b: number) => dits.slice(j, j + b).map((d) => cleMot(d.mot)).join("");
  for (let a = 1; a <= FENETRE && i + a <= ecrits.length; a++) {
    const bloc = ecrits.slice(i, i + a).map((e) => e.texte);
    const attendues = new Set<string>(a === 1 ? formesDites(bloc[0]) : [bloc.map(cleMot).join("")]);
    if (prononciations.length) attendues.add(cleMot(substituerPrononciations(bloc.join(" "), [...prononciations])));
    for (let b = 1; b <= FENETRE && j + b <= dits.length; b++) if (attendues.has(cleDits(b))) return { a, b };
  }
  return null;
}

/** Cale le corps d'une fiche (et la fin choisie) sur les mots horodatés de la voix assemblée. */
export function calerFiche(fiche: FicheEcrans, fin: FinPlanifiee | null, motsDits: readonly MotCalage[], options: OptionsCalageCasConcret): ResultatCalageCasConcret {
  const ecrans: Ecran[] = [...fiche.ecrans, ...(fin?.ecrans ?? [])];
  const motsEcrans = ecrans.map((e) => motsLus(e.texteDit));
  const problemes: string[] = [];

  // 1. Événements posés sur un mot qui existe.
  ecrans.forEach((e, k) => {
    const n = motsEcrans[k].length;
    if (n === 0) problemes.push(`Écran ${e.id} · le texte dit n'a aucun mot à caler.`);
    e.evenements.forEach((ev, j) => {
      if (ev.surMot >= n) problemes.push(`Écran ${e.id} · l'événement n° ${j + 1} part du mot ${ev.surMot + 1}, mais le texte dit n'a que ${n} mot${n > 1 ? "s" : ""}.`);
    });
  });
  if (problemes.length) return { ok: false, problemes };

  // 2. Correspondance des mots écrits et des mots dits.
  const ecrits: MotEcrit[] = motsEcrans.flatMap((m, ecran) => m.map((texte, rang) => ({ texte, ecran, rang })));
  const dits = motsDits.filter((d) => cleMot(d.mot) !== "");
  for (const [k, d] of dits.entries()) {
    if (!(d.debutSec >= 0 && d.finSec >= d.debutSec) || (k > 0 && d.debutSec < dits[k - 1].debutSec)) {
      return { ok: false, problemes: [`Le mot dit n° ${k + 1} (« ${d.mot} ») a des heures incohérentes (${d.debutSec} s → ${d.finSec} s).`] };
    }
  }
  const temps: { debutMs: number; finMs: number }[] = [];
  const prononciations = options.prononciations ?? [];
  let i = 0;
  let j = 0;
  while (i < ecrits.length) {
    const e = ecrits[i];
    const id = ecrans[e.ecran].id;
    if (j >= dits.length) {
      problemes.push(`Écran ${id} · la voix s'arrête avant le mot ${e.rang + 1} (« ${e.texte} ») : il manque la fin du texte dit.`);
      break;
    }
    const c = correspondance(ecrits, dits, i, j, prononciations);
    if (!c) {
      problemes.push(`Écran ${id} · le mot ${e.rang + 1} écrit « ${e.texte} » ne correspond pas au mot dit « ${dits[j].mot} » (à ${dits[j].debutSec} s).`);
      break;
    }
    const intervalle = { debutMs: ms(dits[j].debutSec), finMs: ms(dits[j + c.b - 1].finSec) };
    for (let k = 0; k < c.a; k++) temps.push(intervalle);
    i += c.a;
    j += c.b;
  }
  if (!problemes.length && j < dits.length) {
    problemes.push(`Écran ${ecrans[ecrans.length - 1].id} · la voix dit ${dits.length - j} mot${dits.length - j > 1 ? "s" : ""} de plus que le texte dit (à partir de « ${dits[j].mot} »).`);
  }
  if (problemes.length) return { ok: false, problemes };

  // 3. Début et fin des écrans, sans trou ni chevauchement, à l'image près.
  const premier: number[] = [];
  let curseur = 0;
  for (const m of motsEcrans) {
    premier.push(curseur);
    curseur += m.length;
  }
  const debuts = ecrans.map((e, k) => (k === 0 ? 0 : aLImage(Math.max(0, temps[premier[k]].debutMs - e.avanceMs))));
  for (let k = 1; k < debuts.length; k++) debuts[k] = Math.max(debuts[k], debuts[k - 1]);
  const finTotale = aLImage(temps[temps.length - 1].finMs + ms(options.finApresDernierMotSec));
  const nCorps = fiche.ecrans.length;
  if (fin?.ecrans.length) {
    etirerEcransCourts(debuts, 0, nCorps, debuts[nCorps], ECRAN_DUREE_MIN_MS);
    etirerEcransCourts(debuts, nCorps, debuts.length, finTotale, Math.ceil((ECRAN_DUREE_MIN_MS + ms(options.finApresDernierMotSec)) / IMAGE_MS) * IMAGE_MS);
  } else etirerEcransCourts(debuts, 0, debuts.length, finTotale, ECRAN_DUREE_MIN_MS);
  const fins = ecrans.map((_, k) => (k + 1 < debuts.length ? debuts[k + 1] : finTotale));
  ecrans.forEach((e, k) => {
    if (fins[k] <= debuts[k]) problemes.push(`Écran ${e.id} · l'écran ne dure pas (début ${debuts[k]} ms, fin ${fins[k]} ms) : ses mots ne sont pas dits après ceux de l'écran précédent.`);
  });
  if (problemes.length) return { ok: false, problemes };

  const calee = ecrans.map((e, k) => ({ ...e, debutMs: debuts[k], finMs: fins[k] }) as Ecran);
  const evenements: EvenementCale[] = ecrans.flatMap((e, k) =>
    e.evenements.map((ev) => ({
      ecranId: e.id,
      cible: ev.cible,
      debutMs: Math.min(fins[k] - IMAGE_MS, Math.max(debuts[k], aLImage(temps[premier[k] + ev.surMot].debutMs - ev.avanceMs))),
    })),
  );

  const corps = calee.slice(0, fiche.ecrans.length) as FicheEcrans["ecrans"];
  const ficheCalee: FicheEcrans = { ...fiche, ecrans: corps };
  const finCalee: FinPlanifiee | null = fin ? { ...fin, ecrans: calee.slice(fiche.ecrans.length) as EcranFin[] } : null;

  // 4. La fiche calée repasse la validation de forme ; les écrans de fin, celle des horaires.
  const v = validerSchemaFiche(ficheCalee);
  if (!v.ok) return { ok: false, problemes: v.problemes.map((p) => p.message) };
  if (finCalee) {
    const horaires = finCalee.ecrans.flatMap((e, k) => problemesEcran(e, k === 0 ? corps[corps.length - 1] : finCalee.ecrans[k - 1]));
    if (horaires.length) return { ok: false, problemes: horaires.map((p) => p.message) };
  }
  return { ok: true, fiche: v.fiche, fin: finCalee, evenements, dureeMs: fins[fins.length - 1] };
}
