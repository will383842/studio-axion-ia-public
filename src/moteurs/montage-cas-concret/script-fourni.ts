/**
 * SCRIPT FOURNI PAR WILL (24/10/2026). Will tape ou colle SON script pour un cas ; il est rejoué mot pour mot, l'IA n'écrit
 * rien. PUR : aucun accès au serveur, aucun appel, aucun hasard. Une ligne = un écran ; une étiquette facultative en début de
 * ligne donne sa forme (`[accroche]`, `[avant]`, `[bascule]`, `[étape 2]`, `[détail]`, `[humain]`, `[résultat]`,
 * `[question]`…), sinon des règles fixes la devinent. La fiche est construite sans hasard (textes d'écran tirés du cas), puis
 * passe `completerFiche` et `validerFicheEcrans` avec la fin la plus courte ET la plus longue : ce sont les règles que la
 * fabrication rejoue (R02 à R23, mots interdits). Chaque refus est dit « Ligne N : … » avec le geste à faire. Jamais un texte
 * de Will n'est corrigé en silence (seuls les sigles sont écrits pour être lus, comme partout). La clarté (C1 à C7) ne
 * s'applique pas : c'est SON script.
 *
 * `evenements` et `rangDe` sont des COPIES de ceux d'`ecriture.ts` (recouvert côté serveur : on n'y touche pas).
 */
import { TABLE_FINS_DIAGNOSTIC } from "@/briques/fins";
import { VERSION_CHARTE_DUO } from "@/briques/habillage/charte-duo";
import type { CasConcret } from "@/formats/cas-concret/cas";
import { completerFiche, HAUTEURS_BARRES_SANS_FAIT, type FicheFixe } from "./champs-du-cas";
import { couper, dureeDiteMs, sigleLu } from "./ecriture";
import { regrouperFins } from "./etapes";
import {
  cleMot,
  EVENEMENT_DE_L_OBJET,
  motsLus,
  validerSchemaFiche,
  texteDuCorps,
  type Evenement,
  type EcranCorps,
  type FinPlanifiee,
} from "./fiche";
import { planDesFins } from "./fins";
import { DEBIT_RECETTE, DUREE_TOTALE_REFUS_MS, dureeFinMs, dureeFinParDefautMs, MOTS_MAX, nombresDe, sansPointsDeSigle, tempsEcrans, texteNormalise, validerFicheEcrans } from "./regles";
import { scriptDeFiche, type EcranScript } from "./script-valide";
import { ETIQUETTE_POSTURE } from "@/formats/cas-concret/recette";
import type { ContexteCasConcret } from "./regles";

export const TEXTE_FOURNI_MAX = 4000;
export const LIGNE_FOURNIE_MAX = 400;
export const LIGNES_FOURNIES_MAX = 26;
/** Mots dits au plus sans événement à l'écran (comme le gabarit). */
export const PAS_EVENEMENT = 6;

export type FormeLigne = "accroche" | "chiffre" | "avant" | "bascule" | "etape" | "detail" | "humain" | "preuve" | "resultat" | "question";

export interface LigneFournie {
  /** 1, 2… : le rang de la ligne (les lignes vides ne comptent pas). */
  rang: number;
  forme: FormeLigne;
  texte: string;
  /** Rang de l'étape du cas (formes « etape » et « detail »). */
  etapeCas?: number;
  /** Vrai : la forme vient d'une étiquette de Will. */
  explicite: boolean;
}

export interface RefusFourni {
  /** Rang de la ligne (absent : le texte entier). */
  ligne?: number;
  message: string;
}

/** Les formes en clair (aperçu et messages). */
export const NOMS_FORMES: Readonly<Record<FormeLigne, string>> = {
  accroche: "Accroche",
  chiffre: "Chiffre",
  avant: "Avant",
  bascule: "Bascule",
  etape: "Étape",
  detail: "Détail",
  humain: "Partie humaine",
  preuve: "Preuve",
  resultat: "Résultat",
  question: "Question",
};

const ETIQUETTES_POSSIBLES = "[accroche] [chiffre] [avant] [bascule] [étape] [détail] [humain] [preuve] [résultat] [question]";

const sansAccent = (t: string): string => t.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();

/** Forme d'une étiquette (sans les crochets), ou `undefined` si elle est inconnue. */
function formeDeEtiquette(brut: string): { forme: FormeLigne; etapeCas?: number } | undefined {
  const e = sansAccent(brut).replace(/\s+/g, " ").trim();
  const etape = /^etape(?: ?(\d{1,2}))?$/.exec(e);
  if (etape) return { forme: "etape", ...(etape[1] ? { etapeCas: Number(etape[1]) } : {}) };
  const table: Record<string, FormeLigne> = {
    accroche: "accroche",
    chiffre: "chiffre",
    avant: "avant",
    bascule: "bascule",
    titre: "bascule",
    methode: "bascule",
    detail: "detail",
    objet: "detail",
    humain: "humain",
    preuve: "preuve",
    resultat: "resultat",
    question: "question",
  };
  return table[e] ? { forme: table[e] } : undefined;
}

/* ------------------------------------------------------------------ */
/* Lecture du texte                                                      */
/* ------------------------------------------------------------------ */

export type LectureFournie = { ok: true; lignes: LigneFournie[] } | { ok: false; refus: RefusFourni[] };

/**
 * Le texte de Will, en lignes typées. `cas` (facultatif) sert à reconnaître la partie humaine d'une ligne sans étiquette.
 * Aucune ligne n'est jamais réécrite : seules les puces de tête et l'étiquette sont retirées.
 */
export function lireTexteFourni(texte: unknown, cas?: Pick<CasConcret, "resteHumain">): LectureFournie {
  if (typeof texte !== "string") return { ok: false, refus: [{ message: "Le script doit être un texte." }] };
  if (texte.length > TEXTE_FOURNI_MAX) return { ok: false, refus: [{ message: `Le script est trop long : ${TEXTE_FOURNI_MAX} caractères au plus (il en compte ${texte.length}).` }] };
  const brutes = texte
    .replace(/\r\n?/g, "\n")
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u0009\u000B-\u001F\u007F]/g, "")
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
  if (!brutes.length) return { ok: false, refus: [{ message: "Le script est vide : écrivez une ligne par écran." }] };
  if (brutes.length > LIGNES_FOURNIES_MAX) return { ok: false, refus: [{ message: `Le script compte ${brutes.length} lignes ; ${LIGNES_FOURNIES_MAX} au plus (une ligne = un écran).` }] };

  const refus: RefusFourni[] = [];
  const lignes = brutes.map((brut, i) => {
    const rang = i + 1;
    let t = brut.replace(/^(?:[-–—•*·]\s+|\d{1,2}[.)]\s+)/, "").trim();
    let forme: FormeLigne | null = null;
    let etapeCas: number | undefined;
    const e = /^\[\s*([^\]]*?)\s*\]\s*/.exec(t);
    if (e) {
      const f = formeDeEtiquette(e[1]);
      if (!f) refus.push({ ligne: rang, message: `Ligne ${rang} : l'étiquette [${e[1]}] est inconnue. Étiquettes possibles : ${ETIQUETTES_POSSIBLES}.` });
      else {
        forme = f.forme;
        etapeCas = f.etapeCas;
      }
      t = t.slice(e[0].length).trim();
    }
    if (!t) refus.push({ ligne: rang, message: `Ligne ${rang} : la ligne est vide après son étiquette ; écrivez la phrase dite.` });
    if (t.length > LIGNE_FOURNIE_MAX) refus.push({ ligne: rang, message: `Ligne ${rang} : la ligne compte ${t.length} caractères ; ${LIGNE_FOURNIE_MAX} au plus. Coupez-la en deux lignes.` });
    return { rang, forme, etapeCas, texte: t, explicite: forme !== null };
  });
  if (refus.length) return { ok: false, refus };

  const formes: (FormeLigne | null)[] = lignes.map((l) => l.forme);
  const libre = (i: number) => formes[i] === null;
  // (a) « Avant… » (seulement dans la suite des lignes qui suivent l'accroche, et un chiffre, avant toute autre ligne : « Avant le
  // rendez-vous, le client reçoit un rappel. » au milieu des étapes n'est pas une liste) et « Résultat… » en tête de ligne.
  let enTete = true;
  lignes.forEach((l, i) => {
    if (i === 0) return;
    if (enTete && (formes[i] === "chiffre" || formes[i] === "avant")) return;
    if (enTete && libre(i) && /^avant\b/i.test(l.texte)) {
      formes[i] = "avant";
      return;
    }
    enTete = false;
    if (libre(i) && /^r[ée]sultat\b/i.test(l.texte)) formes[i] = "resultat";
  });
  // (b) la première ligne est l'accroche, la dernière la question.
  if (libre(0)) formes[0] = "accroche";
  if (libre(lignes.length - 1)) formes[lignes.length - 1] = "question";
  // (c) sans résultat : la ligne juste avant la question.
  if (!formes.includes("resultat") && lignes.length >= 2 && libre(lignes.length - 2)) formes[lignes.length - 2] = "resultat";
  // (d) sans bascule : l'« avant » qui suit l'accroche (et un chiffre), puis la première ligne libre devient la bascule.
  if (!formes.includes("bascule")) {
    let i = 1;
    if (formes[i] === "chiffre") i++;
    const debutAvant = i;
    while (i < lignes.length && formes[i] === "avant") i++;
    if (i === debutAvant && i < lignes.length && libre(i)) {
      formes[i] = "avant";
      i++;
      while (i < lignes.length && formes[i] === "avant") i++;
    }
    while (i < lignes.length && !libre(i)) i++;
    if (i < lignes.length && formes[i] === null) formes[i] = "bascule";
  }
  // Des étapes étiquetées sans aucune bascule : on ne devine pas où la méthode commence.
  if (!formes.includes("bascule")) {
    const premiere = formes.findIndex((f) => f === "etape");
    if (premiere >= 0) return { ok: false, refus: [{ ligne: premiere + 1, message: `Ligne ${premiere + 1} : ajoutez une ligne [bascule] avant la première étape.` }] };
  }
  // (e) entre la bascule et le résultat : la ligne qui dit la partie humaine mot pour mot, sinon une étape.
  const humain = cas ? texteNormalise(cas.resteHumain) : "";
  lignes.forEach((l, i) => {
    if (!libre(i)) return;
    formes[i] = humain && texteNormalise(l.texte).includes(humain) ? "humain" : "etape";
  });

  // (f) le rang de l'étape du cas : l'étiquette le fixe, sinon l'étape suivante ; un détail s'attache à l'étape d'avant.
  let derniere = 0;
  const sortie: LigneFournie[] = [];
  for (const [i, l] of lignes.entries()) {
    const forme = formes[i]!;
    let etapeCas = l.etapeCas;
    if (forme === "etape") {
      etapeCas = etapeCas ?? derniere + 1;
      derniere = etapeCas;
    } else if (forme === "detail") {
      if (!derniere) refus.push({ ligne: l.rang, message: `Ligne ${l.rang} : un détail complète l'étape d'avant, et il n'y en a pas encore. Marquez la ligne [étape] ou placez-la après une étape.` });
      etapeCas = derniere;
    }
    sortie.push({ rang: l.rang, forme, texte: l.texte, explicite: l.explicite, ...(etapeCas ? { etapeCas } : {}) });
  }
  return refus.length ? { ok: false, refus } : { ok: true, lignes: sortie };
}

/* ------------------------------------------------------------------ */
/* Construction de la fiche                                              */
/* ------------------------------------------------------------------ */

/** COPIE de `evenements` d'ecriture.ts : événements donnés, complétés par `relais` pour qu'il n'y ait jamais plus de PAS_EVENEMENT mots sans événement. */
function evenements(t: string, donnes: readonly [string, number][], relais: readonly string[]): Evenement[] {
  const n = motsLus(t).length;
  const pris = [...donnes].filter(([, r]) => r > 0 && r < n).sort((a, b) => a[1] - b[1]);
  const res: [string, number][] = [];
  const reserve = [...relais];
  let dernier = 0;
  for (const p of [...pris, ["", n] as [string, number]]) {
    while (p[1] - dernier > PAS_EVENEMENT && reserve.length) {
      dernier += PAS_EVENEMENT;
      res.push([reserve.shift()!, dernier]);
    }
    if (p[0]) res.push(p);
    dernier = Math.max(dernier, p[1]);
  }
  return res.sort((a, b) => a[1] - b[1]).map(([cible, r]) => ({ cible, surMot: r, avanceMs: 0 }));
}

/** COPIE de `rangDe` d'ecriture.ts : rang lu du premier mot de `partie` dans `t` (à partir de `depuis`). */
function rangDe(t: string, partie: string, depuis = 0): number {
  const a = motsLus(t).map(cleMot);
  const b = motsLus(partie).map(cleMot);
  for (let i = depuis; i <= a.length - b.length; i++) if (b.every((m, k) => a[i + k] === m)) return i;
  return depuis;
}

const sansPointFinal = (t: string) => t.trim().replace(/[.,;:!?…]+$/, "");
const nombreLus = (t: string) => motsLus(t).length;
const plusLongMot = (t: string): string => [...t.split(/\s+/).map((m) => m.replace(/[^\p{L}\p{N}'-]+/gu, "")).filter(Boolean)].sort((a, b) => b.length - a.length)[0] ?? "";
const relaisDuVisuel = (objet: string): string[] => [EVENEMENT_DE_L_OBJET[objet as keyof typeof EVENEMENT_DE_L_OBJET] ?? "objet"];

type Brouillon = Record<string, unknown>;

export type FicheDuTexte = { ok: true; brute: { ecrans: Brouillon[] }; lignes: LigneFournie[] } | { ok: false; refus: RefusFourni[] };

/** Une fiche brute (avant `completerFiche`) : un écran par ligne, aucun hasard. */
export function ficheBruteDuTexteFourni(texte: unknown, cas: CasConcret): FicheDuTexte {
  const lu = lireTexteFourni(texte, cas);
  if (!lu.ok) return lu;
  const refus: RefusFourni[] = [];
  const non = (l: LigneFournie, message: string) => void refus.push({ ligne: l.rang, message: `Ligne ${l.rang} : ${message}` });
  const ecrans: Brouillon[] = [];

  lu.lignes.forEach((l, i) => {
    const dit = sigleLu(l.texte);
    const fond = i % 2 === 0 ? "sombre" : "ivoire";
    const commun = { fond, avanceMs: 0, texteDit: dit };
    const etapeDuCas = l.etapeCas ? cas.etapes[l.etapeCas - 1] : undefined;
    switch (l.forme) {
      case "accroche": {
        const n = nombreLus(l.texte);
        if (n > 8 || n < 2) return non(l, `l'accroche compte ${n} mot${n > 1 ? "s" : ""} ; de 2 à 8 mots. Dites le sujet de la vidéo, par exemple « ${cas.recit?.sujet ?? cas.promesse} ».`);
        const mots = sansPointsDeSigle(sansPointFinal(l.texte)).split(/\s+/);
        const nl = mots.length <= 6 ? 2 : 3;
        const tailles = Array.from({ length: nl }, (_, k) => Math.floor(mots.length / nl) + (k < mots.length % nl ? 1 : 0));
        const lignes: string[] = [];
        tailles.reduce((d, k) => (lignes.push(mots.slice(d, d + k).join(" ")), d + k), 0);
        const chiffre = mots.map((m) => m.replace(/[^\p{L}\p{N}]+/gu, "")).find((m) => /^\d+$/.test(m));
        ecrans.push({ ...commun, type: "accroche", etiquette: ETIQUETTE_POSTURE[cas.posture], lignes, motOrange: chiffre ?? plusLongMot(lignes[lignes.length - 1]), eclair: true, evenements: evenements(dit, lignes.slice(1).map((x, k) => [`titre-${k + 2}`, rangDe(dit, x)] as [string, number]), []) });
        return;
      }
      case "chiffre": {
        const nombres = nombresDe(sansPointsDeSigle(l.texte));
        const fait = cas.faits.find((f) => f.valeurs.some((v) => nombres.includes(v)));
        if (!fait) {
          const chiffres = cas.faits.filter((f) => f.valeurs.length).map((f) => `« ${f.enonce} »`);
          return non(l, chiffres.length ? `cette ligne ne dit le chiffre d'aucun fait du cas. Les chiffres du cas : ${chiffres.join(" ; ")}.` : "ce cas n'a aucun fait chiffré : retirez cette ligne.");
        }
        ecrans.push({ ...commun, type: "chiffre", faitId: fait.id, pastilles: [], variante: "simple", evenements: evenements(dit, [], ["unite"]) });
        return;
      }
      case "avant": {
        const sans = l.texte.replace(/^avant\s*:?\s*/i, "");
        const morceaux = sans.split(/[,;]/).map((m) => m.trim()).filter(Boolean);
        // Les morceaux de la phrase servent de cases s'ils tiennent (2 au moins, 8 mots au plus) ET si l'écran bouge assez souvent ;
        // sinon les premières tâches du cas, qui apparaissent tous les 5 mots.
        const bons = morceaux.length >= 2 && morceaux.every((m) => nombreLus(m) <= 8);
        if (bons) {
          let depuis = 0;
          const donnes = morceaux.slice(0, 6).map((m, k) => {
            const r = rangDe(dit, sigleLu(m), depuis);
            depuis = r + 1;
            return [`tache-${k + 1}`, r] as [string, number];
          });
          const n = nombreLus(dit);
          const rangs = [0, ...donnes.map(([, r]) => r).filter((r) => r > 0 && r < n), n];
          const serre = rangs.every((r, k) => k === 0 || r - rangs[k - 1] <= PAS_EVENEMENT);
          if (serre) {
            ecrans.push({ ...commun, type: "liste-avant", taches: morceaux.slice(0, 6).map((m) => couper(sansPointsDeSigle(sansPointFinal(m)), 8)), evenements: evenements(dit, donnes, []) });
            return;
          }
        }
        const taches = cas.avant.taches.slice(0, 4).map((t) => couper(t, 8));
        ecrans.push({ ...commun, type: "liste-avant", taches, evenements: evenements(dit, taches.map((_, k) => [`tache-${k + 1}`, 5 * (k + 1)] as [string, number]), []) });
        return;
      }
      case "bascule": {
        const mots = sansPointsDeSigle(sansPointFinal(l.texte)).split(/\s+/);
        const lignes = mots.length <= 3 ? [mots.join(" ")] : [mots.slice(0, 3).join(" "), couper(mots.slice(3).join(" "), 3)];
        ecrans.push({ ...commun, type: "titre", lignes, orange: [plusLongMot(lignes[lignes.length - 1])], eclair: true, evenements: evenements(dit, [], lignes.map((_, k) => `titre-${k + 1}`)) });
        return;
      }
      case "etape": {
        if (!etapeDuCas) return non(l, `le cas n'a que ${cas.etapes.length} étape${cas.etapes.length > 1 ? "s" : ""} ; marquez cette ligne [détail] ou fusionnez-la avec la précédente.`);
        const visuel = etapeDuCas.visuel.sorte === "objet" ? { sorte: "objet", objet: etapeDuCas.visuel.objet } : { sorte: "ecran", etapeCas: l.etapeCas, repli: etapeDuCas.visuel.repli ?? "telephone-capture" };
        const objet = etapeDuCas.visuel.sorte === "objet" ? etapeDuCas.visuel.objet : "telephone-capture";
        ecrans.push({ ...commun, type: "etape", titre: couper(etapeDuCas.titre, MOTS_MAX.titre), ligne: couper(etapeDuCas.ligne, MOTS_MAX.ligne), visuel, puces: [], evenements: evenements(dit, [], ["ligne", ...relaisDuVisuel(objet)]) });
        return;
      }
      case "detail": {
        if (!etapeDuCas) return non(l, `le cas n'a que ${cas.etapes.length} étape${cas.etapes.length > 1 ? "s" : ""} ; ce détail ne complète aucune étape.`);
        const objet = etapeDuCas.visuel.sorte === "objet" ? etapeDuCas.visuel.objet : (etapeDuCas.visuel.repli ?? "telephone-capture");
        ecrans.push({ ...commun, type: "objet", titre: couper(etapeDuCas.titre, MOTS_MAX.titre), ligne: couper(sansPointsDeSigle(sansPointFinal(l.texte)), MOTS_MAX.ligne), visuel: { sorte: "objet", objet }, evenements: evenements(dit, [], ["ligne", ...relaisDuVisuel(objet)]) });
        return;
      }
      case "humain": {
        ecrans.push({ ...commun, type: "objet", titre: "La part humaine", ligne: couper(sansPointFinal(cas.resteHumain), MOTS_MAX.ligne), visuel: { sorte: "objet", objet: "liste-taches" }, evenements: evenements(dit, [], ["ligne", ...relaisDuVisuel("liste-taches")]) });
        return;
      }
      case "preuve": {
        const rgpd = cas.conformite?.rgpd?.phrase;
        if (!rgpd) return non(l, "ce cas n'a aucune phrase de conformité validée : retirez cette ligne.");
        const phrase = new Set(texteNormalise(rgpd).split(" "));
        const dansPhrase = (t: string) => texteNormalise(t).split(" ").every((m) => phrase.has(m));
        const titre = ["Conforme au RGPD", "Conforme"].find(dansPhrase) ?? "Vérifié";
        const puces = ["100 % automatique", "Sans intervention"].every(dansPhrase) ? ["100 % automatique", "Sans intervention"] : ["Vérifié", "Validé"];
        ecrans.push({ ...commun, type: "preuve", titre, puces, evenements: evenements(dit, [], ["puce-1", "puce-2"]) });
        return;
      }
      case "resultat": {
        ecrans.push({
          ...commun,
          type: "resultat",
          titre: "Le résultat",
          avant: { libelle: "Avant", valeur: HAUTEURS_BARRES_SANS_FAIT.avant },
          maintenant: { libelle: "Maintenant", valeur: HAUTEURS_BARRES_SANS_FAIT.maintenant },
          ligne: couper(sansPointsDeSigle(sansPointFinal(l.texte.replace(/^r[ée]sultat\s*:?\s*/i, ""))), MOTS_MAX.ligne),
          eclair: true,
          evenements: evenements(dit, [["barre-maintenant", 2]], ["ligne"]),
        });
        return;
      }
      case "question": {
        if (!/\?\s*$/.test(l.texte)) return non(l, "la question finale doit finir par un point d'interrogation (« ? »).");
        const question = nombreLus(l.texte) <= 8 ? sansPointsDeSigle(l.texte) : `${couper(sansPointsDeSigle(sansPointFinal(l.texte)), 8)} ?`;
        ecrans.push({ ...commun, type: "question", lignes: ["Et chez vous,", "dans votre entreprise"], question, evenements: evenements(dit, [["titre-2", 4], ["question", 9]], []) });
        return;
      }
    }
  });
  return refus.length ? { ok: false, refus } : { ok: true, brute: { ecrans }, lignes: lu.lignes };
}

/* ------------------------------------------------------------------ */
/* Fins et contrôle                                                      */
/* ------------------------------------------------------------------ */

/** La fin la plus courte et la plus longue des quatre réseaux, sans le mot (comme l'estimation « essai » de la page). */
export function bornesDesFins(cas: Pick<CasConcret, "offre" | "nature" | "mot">): { courte: FinPlanifiee; longue: FinPlanifiee } {
  const fins = (["facebook", "instagram", "tiktok", "linkedin"] as const).flatMap((reseau) =>
    regrouperFins(planDesFins({ reseaux: [reseau], offre: cas.offre, ...(cas.nature ? { nature: cas.nature } : {}), mot: cas.mot, avecMot: false, table: TABLE_FINS_DIAGNOSTIC })).fins,
  );
  const duree = (f: FinPlanifiee) => dureeDiteMs(f.ecrans);
  const tri = [...fins].sort((a, b) => duree(a) - duree(b));
  return { courte: tri[0]!, longue: tri[tri.length - 1]! };
}

export type ControleFourni =
  | { ok: true; ecrans: EcranScript[]; dureeMs: { min: number; max: number }; lignes: LigneFournie[] }
  | { ok: false; refus: RefusFourni[]; dureeMs?: { min: number; max: number } };

/** Un refus des règles, dit en « Ligne N : … » avec le geste à faire (la durée totale est jugée à part, par `controlerTexteFourni`). */
function messageFourni(p: { regle: string; message: string }, cas: CasConcret): RefusFourni {
  const m = /^Écran e(\d+) · règle « (.+?) » : ([\s\S]*)$/.exec(p.message);
  const rang = m ? Number(m[1]) : undefined;
  const detail = (m ? m[3] : p.message.replace(/^Fiche · règle « .+? » : /, "")).trim();
  const ou = rang ? `Ligne ${rang} : ` : "";
  let geste = "";
  switch (p.regle) {
    case "durée d'un écran":
      geste = /trop long|dépasse|au plus|plus de/i.test(detail) ? " Coupez cette phrase en deux lignes." : " Allongez-la ou collez-la à la ligne d'avant.";
      break;
    case "accroche":
      geste = ` La première phrase dit le sujet : « ${cas.recit?.sujet ?? cas.promesse} », en 8 mots au plus.`;
      break;
    case "nombre d'écrans":
      geste = ` Il faut de 12 à 26 lignes, dont 3 à 7 étapes.`;
      break;
    case "ordre du fonctionnement":
      geste = ` Dites mot pour mot « ${cas.resteHumain} », après l'étape ${cas.resteHumainApresEtape ?? "indiquée"}.`;
      break;
    case "nombres des faits":
      geste = " Ce nombre ne vient d'aucun fait du cas : retirez-le.";
      break;
    case "aucun appel dans le corps":
      geste = " La fin (lien, mot à commenter, diagnostic) est ajoutée toute seule selon le réseau : retirez-la.";
      break;
    case "rythme":
      geste = " Phrase trop longue sans changement à l'écran : coupez-la en deux lignes.";
      break;
    case "vouvoiement":
      geste = " Dites « vous », jamais « tu ».";
      break;
    default:
      break;
  }
  return { ...(rang ? { ligne: rang } : {}), message: `${ou}${detail}${geste}` };
}

/**
 * Contrôle COMPLET d'un script fourni : lecture, fiche, champs du cas, puis les règles de la fabrication avec la fin la plus
 * courte ET la plus longue. Conforme : les écrans du script (sans identifiant ni marque) et la durée estimée.
 */
export function controlerTexteFourni(texte: unknown, cas: CasConcret, options: { motsInterdits?: readonly string[] } = {}): ControleFourni {
  const fixe: FicheFixe = { videoId: "relecture", versionId: "relecture", habillage: VERSION_CHARTE_DUO, origine: "porte-a" };
  const f = ficheBruteDuTexteFourni(texte, cas);
  if (!f.ok) return f;
  // Le nombre de lignes et d'étapes se dit tout de suite, en clair (sinon le schéma refuserait par un message technique).
  const nbEtapes = f.lignes.filter((l) => l.forme === "etape").length;
  if (f.lignes.length < 12 || f.lignes.length > 26 || nbEtapes < 3 || nbEtapes > 7) {
    const refus: RefusFourni[] = [];
    if (f.lignes.length < 12 || f.lignes.length > 26) refus.push({ message: `Le script compte ${f.lignes.length} lignes. Il faut de 12 à 26 lignes (une ligne = un écran).` });
    if (nbEtapes < 3 || nbEtapes > 7) refus.push({ message: `Le script compte ${nbEtapes} ligne${nbEtapes > 1 ? "s" : ""} d'étape. Il faut de 3 à 7 étapes ([étape]).` });
    return { ok: false, refus };
  }
  const c = completerFiche(f.brute, { ...fixe, cas });
  const lignes = f.lignes;
  const refus: RefusFourni[] = [];
  const vus = new Set<string>();
  const ajouter = (r: RefusFourni) => {
    if (vus.has(r.message)) return;
    vus.add(r.message);
    refus.push(r);
  };
  for (const r of c.refus) ajouter(messageFourni({ regle: "champs du cas", message: r }, cas));
  const forme = validerSchemaFiche(c.brute);
  if (!forme.ok) {
    for (const p of forme.problemes) ajouter(messageFourni(p, cas));
    return { ok: false, refus };
  }
  const { courte } = bornesDesFins(cas);
  const contexte = { cas, texteScript: texteDuCorps(forme.fiche), ...(options.motsInterdits?.length ? { motsInterdits: options.motsInterdits } : {}) } as ContexteCasConcret;
  // Les règles que la fabrication rejoue, avec la fin la plus courte puis la plus longue (la durée totale est jugée plus bas).
  for (const fins of [[courte], undefined] as const) {
    const v = validerFicheEcrans(c.brute, { ...contexte, ...(fins ? { fins } : {}) });
    if (!v.ok) for (const p of v.problemes) if (p.regle !== "durée totale") ajouter(messageFourni(p, cas));
  }
  // R21 comme la règle : le corps au débit de la recette, plus la fin la plus courte (trop court) ou la plus longue (trop long).
  const temps = tempsEcrans(forme.fiche.ecrans, DEBIT_RECETTE);
  const corpsMs = temps.length ? temps[temps.length - 1].finMs - temps[0].debutMs : 0;
  const dureeMs = { min: corpsMs + dureeFinMs(courte), max: corpsMs + dureeFinParDefautMs(cas) };
  // Vers le bas pour « trop court », vers le haut pour « trop long » : le nombre dit n'est jamais du bon côté de la borne.
  const secBas = (ms: number) => String(Math.floor(ms / 100) / 10).replace(".", ",");
  const secHaut = (ms: number) => String(Math.ceil(ms / 100) / 10).replace(".", ",");
  if (dureeMs.min < DUREE_TOTALE_REFUS_MS.min) ajouter({ message: `Durée : avec la fin la plus courte la vidéo ferait environ ${secBas(dureeMs.min)} s, il en faut au moins ${DUREE_TOTALE_REFUS_MS.min / 1000} : ajoutez une phrase.` });
  if (dureeMs.max > DUREE_TOTALE_REFUS_MS.max) ajouter({ message: `Durée : avec la fin la plus longue la vidéo ferait environ ${secHaut(dureeMs.max)} s, ${DUREE_TOTALE_REFUS_MS.max / 1000} au plus : retirez une phrase.` });
  if (refus.length) return { ok: false, refus, dureeMs };
  const script = scriptDeFiche(forme.fiche, { versionCas: cas.version, valideLe: "2000-01-01", source: "contrôle" });
  return { ok: true, ecrans: script.ecrans, dureeMs, lignes };
}

/* ------------------------------------------------------------------ */
/* Pré-remplissage                                                       */
/* ------------------------------------------------------------------ */

/** Le texte d'un script (validé ou du gabarit) sous la forme que Will modifie : une ligne par écran, étiquette tirée du type. */
export function texteFourniDesEcrans(ecrans: readonly (EcranScript | EcranCorps)[], cas: Pick<CasConcret, "etapes" | "resteHumain">): string {
  const humain = texteNormalise(cas.resteHumain);
  let derniere = 0;
  return ecrans
    .map((e) => {
      let etiquette = "";
      switch (e.type) {
        case "accroche":
          etiquette = "accroche";
          break;
        case "chiffre":
          etiquette = "chiffre";
          break;
        case "liste-avant":
          etiquette = "avant";
          break;
        case "titre":
          etiquette = "bascule";
          break;
        case "etape": {
          const k = e.visuel.sorte === "ecran" ? e.visuel.etapeCas : cas.etapes.findIndex((x) => couper(x.titre, MOTS_MAX.titre) === e.titre) + 1 || derniere + 1;
          derniere = k;
          etiquette = `étape ${k}`;
          break;
        }
        case "objet":
          etiquette = humain && texteNormalise(e.texteDit).includes(humain) ? "humain" : "détail";
          break;
        case "preuve":
          etiquette = "preuve";
          break;
        case "resultat":
          etiquette = "résultat";
          break;
        case "question":
          etiquette = "question";
          break;
      }
      return `[${etiquette}] ${e.texteDit}`;
    })
    .join("\n");
}
