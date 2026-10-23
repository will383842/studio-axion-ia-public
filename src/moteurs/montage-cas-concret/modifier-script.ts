/**
 * MODIFIER LE SCRIPT AVANT DE LE VALIDER (demande de Will du 14/10 : « aucune vidéo ne doit pouvoir être générée sans
 * que nous ayons validé le script, et que l'on puisse le modifier si nécessaire »). PUR.
 *
 * Pour chaque écran du corps : la phrase dite et les textes affichés, dans l'ordre de `textesEcrits` (celui de l'aperçu).
 * Le chiffre d'un écran « chiffre » (valeur + unité, tiré d'un fait du cas) et le type de l'écran ne se modifient pas.
 * La fiche modifiée repasse par TOUS les contrôles (schéma, règles R02 à R23, faits) avant de devenir le script validé.
 */
import { motsLus, type Ecran, type FicheEcrans } from "./fiche";

export interface ModificationEcran {
  /** 1, 2… : rang de l'écran (celui de l'aperçu). */
  rang: number;
  texteDit?: string;
  /** Textes affichés, dans l'ordre de l'aperçu ; `null` à une place : texte inchangé. */
  ecrits?: (string | null)[];
}

/** Les textes affichés modifiables d'un écran, dans l'ordre de `textesEcrits` ; `false` : non modifiable (le chiffre). */
export function ecritsModifiables(e: Ecran): boolean[] {
  if (e.type === "chiffre") return [false, ...e.pastilles.map(() => true)];
  return ecritsDe(e).map(() => true);
}

/** Les textes affichés d'un écran, bruts (balises d'accent `*…*` comprises), dans l'ordre de `textesEcrits`. */
export function ecritsDe(e: Ecran): string[] {
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

/** Réécrit les textes affichés d'un écran dans ses champs, dans l'ordre de `ecritsDe`. */
function avecEcrits(e: Ecran, t: string[]): Ecran {
  let i = 0;
  const pris = (n: number) => t.slice(i, (i += n));
  const un = () => t[i++];
  switch (e.type) {
    case "accroche":
      return { ...e, etiquette: un(), lignes: pris(e.lignes.length) };
    case "chiffre":
      un();
      return { ...e, pastilles: pris(e.pastilles.length) };
    case "liste-avant": {
      const taches = pris(e.taches.length);
      return { ...e, taches, ...(e.total ? { total: un() } : {}) };
    }
    case "titre":
      return { ...e, lignes: pris(e.lignes.length) };
    case "etape": {
      const titre = un();
      const ligne = un();
      const puces = pris(e.puces.length);
      const visuel = e.visuel.sorte === "objet" && e.visuel.textes ? { ...e.visuel, textes: pris(e.visuel.textes.length) } : e.visuel;
      return { ...e, titre, ligne, puces, visuel };
    }
    case "objet": {
      const titre = un();
      const ligne = e.ligne ? un() : undefined;
      const visuel = e.visuel.textes ? { ...e.visuel, textes: pris(e.visuel.textes.length) } : e.visuel;
      return { ...e, titre, ...(ligne !== undefined ? { ligne } : {}), visuel };
    }
    case "preuve":
      return { ...e, titre: un(), puces: pris(e.puces.length) };
    case "resultat":
      return { ...e, titre: un(), avant: { ...e.avant, libelle: un() }, maintenant: { ...e.maintenant, libelle: un() }, ligne: un() };
    case "question":
      return { ...e, lignes: pris(e.lignes.length), question: un() };
    case "appel-mot":
      return { ...e, mot: un() };
    case "promesse": {
      const cadeau = un();
      return { ...e, cadeau, ...(e.ligne ? { ligne: un() } : {}) };
    }
    case "diagnostic": {
      const titre = un();
      return { ...e, titre, ...(e.ligne ? { ligne: un() } : {}) };
    }
    case "lien":
      return { ...e, titre: un(), bulle: un() };
  }
}

const net = (s: string) => s.replace(/\s+/g, " ").trim();

/**
 * Nouvelle phrase dite : les apparitions de l'écran sont posées sur des mots de la phrase (`surMot`). Elles suivent la
 * phrase modifiée à la même place relative (le 7ᵉ mot sur 10 devient le 4ᵉ sur 6), sans dépasser son dernier mot.
 */
function avecTexteDit(e: Ecran, texteDit: string): Ecran {
  const avant = Math.max(1, motsLus(e.texteDit).length);
  const apres = Math.max(1, motsLus(texteDit).length);
  if (avant === apres) return { ...e, texteDit } as Ecran;
  const evenements = e.evenements.map((ev) => ({ ...ev, surMot: Math.min(apres - 1, Math.round((ev.surMot * (apres - 1)) / Math.max(1, avant - 1))) }));
  return { ...e, texteDit, evenements } as Ecran;
}

/**
 * Applique les modifications de Will à la fiche (nouvel objet ; l'entrée n'est pas modifiée). Un rang inconnu, un texte
 * vide, ou un texte non modifiable changé : refus en phrase (rien n'est appliqué).
 */
export function appliquerModifications(fiche: FicheEcrans, modifications: readonly ModificationEcran[]): { ok: true; fiche: FicheEcrans } | { ok: false; raisons: string[] } {
  const raisons: string[] = [];
  const ecrans = fiche.ecrans.map((e, i) => {
    const m = modifications.find((x) => x.rang === i + 1);
    if (!m) return e;
    let suite = e as Ecran;
    if (m.texteDit !== undefined) {
      if (!net(m.texteDit)) raisons.push(`Écran ${i + 1} : la phrase dite ne peut pas être vide.`);
      else suite = { ...avecTexteDit(suite, net(m.texteDit)) };
    }
    if (m.ecrits) {
      const actuels = ecritsDe(suite);
      const modifiables = ecritsModifiables(suite);
      if (m.ecrits.length !== actuels.length) {
        raisons.push(`Écran ${i + 1} : ${actuels.length} textes affichés attendus, ${m.ecrits.length} reçus.`);
        return e;
      }
      const nouveaux = actuels.map((a, k) => {
        const v = m.ecrits![k];
        if (v === null || v === undefined || net(v) === net(a)) return a;
        if (!modifiables[k]) {
          raisons.push(`Écran ${i + 1} : le chiffre « ${a} » vient d'un fait du cas et ne se modifie pas ici.`);
          return a;
        }
        if (!net(v)) {
          raisons.push(`Écran ${i + 1} : un texte affiché ne peut pas être vide.`);
          return a;
        }
        return net(v);
      });
      suite = avecEcrits(suite, nouveaux);
    }
    return suite;
  });
  for (const m of modifications) if (m.rang < 1 || m.rang > fiche.ecrans.length) raisons.push(`L'écran ${m.rang} n'existe pas.`);
  return raisons.length ? { ok: false, raisons } : { ok: true, fiche: { ...fiche, ecrans: ecrans as FicheEcrans["ecrans"] } };
}
