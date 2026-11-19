// T-EXT-23 : la marque CODÉE (mots, argent, étiquettes, tutoiement, jargon, couleurs, police, noms, mention « exemple »).
// Pur, sans IA : ni disque, ni réseau, ni horloge. Rien ne l'importe en production. Tout est bloquant.
// Les couleurs et les polices se jugent dans la pièce commune `video-finie` ; la palette vient de la charte, jamais recopiée.
import { couleursHorsCharte, policesHorsCharte } from "@/briques/controle-image/video-finie";
import { interditsCommuns, interditsTousEcrivains } from "@/domaine/qualite-script/regles/interdits";
import { JARGON } from "./scenariste";
import { MOTS_PROMESSE } from "./strategie-valeur";
import type { ResultatControleTutoriel } from "./controleur";

export { couleursHorsCharte, policesHorsCharte };

export type OrigineTexte = "voix" | "sous-titres" | "ecran-studio" | "maquette" | "conversation" | "fin";

export interface TexteControle {
  texte: string;
  origine: OrigineTexte;
}

/** Espaces insécables et fines → espace ; caractères invisibles retirés. */
function aplatir(t: string): string {
  return String(t ?? "")
    .normalize("NFKC")
    .replace(/[   -   　]/g, " ")
    .replace(/[­​-‏‪-‮⁠-⁤﻿]/g, "");
}

/** Sans casse ni accents, espaces simples. */
function normaliser(t: string): string {
  return aplatir(t)
    .normalize("NFD")
    .replace(/\p{M}+/gu, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

const coupe = (t: string): string => {
  const s = aplatir(t).trim();
  return s.length > 50 ? `${s.slice(0, 49)}…` : s;
};

/* ------------------------------------------------------------------ */
/* Mots interdits                                                      */
/* ------------------------------------------------------------------ */

const B = "(?<![a-z0-9])";
const E = "(?![a-z0-9])";

/** Mots de promesse propres à la marque (texte normalisé : sans accents, minuscules, mots entiers). */
export const MOTS_INTERDITS_MARQUE: readonly { libelle: string; motif: RegExp }[] = [
  { libelle: "garanti", motif: new RegExp(`${B}garanti(?:e|s|es)?${E}`) },
  { libelle: "certifié", motif: new RegExp(`${B}certifie(?:e|s|es)?${E}`) },
  { libelle: "certification", motif: new RegExp(`${B}certifications?${E}`) },
  { libelle: "Qualiopi", motif: new RegExp(`${B}qualiopi${E}`) },
  { libelle: "intégrateur", motif: new RegExp(`${B}integrateurs?${E}`) },
  { libelle: "100 %", motif: new RegExp(`(?<![0-9.,])100 ?%`) },
];

/** Libellés des mots interdits trouvés dans un texte (sans doublon). */
export function motsInterdits(texte: string): string[] {
  const n = normaliser(texte);
  const trouves: string[] = [];
  for (const m of MOTS_INTERDITS_MARQUE) if (m.motif.test(n)) trouves.push(m.libelle);
  const plat = aplatir(texte);
  if (MOTS_PROMESSE.test(plat) && !trouves.length) trouves.push("mot de promesse");
  for (const i of interditsCommuns()) {
    const touche = i.post ? i.post(texte) : Object.values(i.tests).some((t) => t?.(texte));
    if (touche) trouves.push(i.libelle);
  }
  for (const l of interditsTousEcrivains(texte)) trouves.push(l);
  return [...new Set(trouves)];
}

/* ------------------------------------------------------------------ */
/* Argent, étiquettes, tutoiement, jargon                              */
/* ------------------------------------------------------------------ */

const NOMBRE = String.raw`\d+(?:[ .,]\d+)*`;
const MONNAIE = String.raw`(?:[kKmM]\s*)?(?:€|euros?(?![\p{L}])|eur(?![\p{L}])|\$|dollars?(?![\p{L}])|usd(?![\p{L}]))`;
const MONTANT = new RegExp(
  [
    `${NOMBRE}\\s*${MONNAIE}(?:\\s*(?:HT|TTC)(?![\\p{L}]))?`,
    String.raw`(?:€|\$)\s*${NOMBRE}`,
    `${NOMBRE}\\s*(?:HT|TTC)(?![\\p{L}])`,
    `(?<![\\p{L}])(?:HT|TTC)\\s*${NOMBRE}`,
  ].join("|"),
  "giu",
);

/** Montants d'argent trouvés (« 1 200 € », « 3k€ », « 500 euros », « 49 $ », « 20 € HT »). */
export function montantsArgent(texte: string): string[] {
  return [...aplatir(texte).matchAll(MONTANT)].map((m) => m[0].trim());
}

const ETIQUETTES: readonly { libelle: string; debut: string }[] = [
  { libelle: "Douleur", debut: "douleur" },
  { libelle: "Solution", debut: "solution" },
  { libelle: "Exemple", debut: "exemple" },
  { libelle: "À vous", debut: "a vous" },
];

/** Étiquettes « Douleur · Solution · Exemple · À vous » : texte égal à l'une d'elles, ou commençant par elle + séparateur. */
export function etiquettesInterdites(texte: string): string[] {
  const n = normaliser(texte);
  const trouvees: string[] = [];
  for (const e of ETIQUETTES) {
    if (new RegExp(`^${e.debut}\\s*(?:$|[·:\\-–—])`).test(n)) trouvees.push(e.libelle);
  }
  return trouvees;
}

const TUTOIEMENT = new RegExp(`${B}(?:tu|toi|ton|ta|tes|te|t'[a-z]+)${E}`);

/** Le texte tutoie-t-il ? (la marque vouvoie) */
export function tutoiement(texte: string): boolean {
  return TUTOIEMENT.test(normaliser(texte));
}

/** Mots de jargon trouvés (`JARGON` du scénariste, mots entiers, sans casse ni accents). */
export function jargon(texte: string): string[] {
  const n = normaliser(texte);
  return JARGON.filter((j) => {
    const m = normaliser(j).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return new RegExp(`${B}${m}${E}`).test(n);
  });
}

/* ------------------------------------------------------------------ */
/* Noms neutres                                                        */
/* ------------------------------------------------------------------ */

const ESPACE_DEMO = /^Espace démo · \S.*$/;
const ENTREPRISE_EXEMPLE = "Entreprise exemple";

/** Noms refusés : un espace hors « Espace démo · <métier> », une entreprise autre que « Entreprise exemple ». */
export function nomsNonNeutres(noms: readonly string[]): string[] {
  return noms.filter((nom) => {
    const t = aplatir(nom).trim();
    return !(ESPACE_DEMO.test(t) || t === ENTREPRISE_EXEMPLE);
  });
}

/* ------------------------------------------------------------------ */
/* Contrôle complet                                                    */
/* ------------------------------------------------------------------ */

export interface EntreeControleMarque {
  textes: TexteControle[];
  couleurs: string[];
  polices: string[];
  noms: string[];
  /** Des chiffres de démonstration sont affichés. */
  chiffresAffiches: boolean;
  /** La mention « exemple » est visible à l'écran. */
  mentionExemple: boolean;
}

function resultat(id: string, libelle: string, details: string[], ok: string): ResultatControleTutoriel {
  return { id, libelle, etat: details.length ? "echoue" : "reussi", bloquant: true, details: details.length ? details : [ok] };
}

export function controlerMarque(e: EntreeControleMarque): ResultatControleTutoriel[] {
  const mots: string[] = [];
  const argent: string[] = [];
  const etiquettes: string[] = [];
  const tutoie: string[] = [];
  const jarg: string[] = [];
  for (const { texte, origine } of e.textes) {
    for (const m of motsInterdits(texte)) mots.push(`« ${coupe(texte)} » : le mot « ${m} » est interdit.`);
    for (const a of montantsArgent(texte)) argent.push(`« ${coupe(texte)} » : montant d'argent « ${a} » (aucun montant à l'écran ni dans la voix).`);
    /* La mention « exemple » est OBLIGATOIRE dans la maquette : l'origine du texte tranche. */
    if (origine !== "maquette") for (const l of etiquettesInterdites(texte)) etiquettes.push(`« ${coupe(texte)} » : l'étiquette « ${l} » est interdite à l'écran.`);
    if (tutoiement(texte)) tutoie.push(`« ${coupe(texte)} » : la marque vouvoie.`);
    for (const j of jargon(texte)) jarg.push(`« ${coupe(texte)} » : le mot « ${j} » est du jargon.`);
  }
  const couleurs = couleursHorsCharte(e.couleurs).map((c) => (c.motif === "hors charte" ? `Couleur « ${c.valeur} » hors charte.` : `Couleur « ${c.valeur} » : un ${c.motif} est interdit.`));
  const polices = policesHorsCharte(e.polices).map((p) => `Police « ${p.valeur} » hors charte (Manrope seulement).`);
  const noms = nomsNonNeutres(e.noms).map((n) => `Nom « ${n} » : il faut « Espace démo · <métier> » ou « ${ENTREPRISE_EXEMPLE} ».`);
  const exemple = e.chiffresAffiches && !e.mentionExemple ? ["Des chiffres de démonstration sont affichés sans la mention « exemple » visible."] : [];
  return [
    resultat("MARQUE-MOTS", "Mots interdits", mots, "Aucun mot interdit."),
    resultat("MARQUE-ARGENT", "Montants d'argent", argent, "Aucun montant d'argent."),
    resultat("MARQUE-ETIQUETTES", "Étiquettes interdites", etiquettes, "Aucune étiquette interdite."),
    resultat("MARQUE-TUTOIEMENT", "Vouvoiement", tutoie, "Tout est au vouvoiement."),
    resultat("MARQUE-JARGON", "Jargon", jarg, "Aucun jargon."),
    resultat("MARQUE-COULEURS", "Couleurs de la charte", couleurs, "Toutes les couleurs sont dans la charte."),
    resultat("MARQUE-POLICE", "Police de la charte", polices, "Seule la police de la charte est utilisée."),
    resultat("MARQUE-NOMS", "Noms neutres", noms, "Tous les noms sont neutres."),
    resultat("MARQUE-EXEMPLE", "Mention « exemple »", exemple, "La mention « exemple » est visible quand il le faut."),
  ];
}
