/**
 * SOCLE QUALITÉ · INTERDITS (LG). PUR. Observation seulement.
 *
 * LA LISTE UNIQUE des interdits permanents, LUE depuis l'existant (aucune copie, aucun verdict changé) :
 *  - Écrire, C42 : `INTERDITS_PERMANENTS` (`controles-script/style.ts`) ;
 *  - cas concret, R10 : `MOTS_INTERDITS_FORMAT` (`montage-cas-concret/regles.ts`) ;
 *  - image → vidéo, Q08 : la liste du cas concret + `INTERDITS_EN_PLUS_IMAGE_VIDEO` (égalité vérifiée par les tests :
 *    le fichier du format tire des modules serveur, il n'est pas importé ici) ;
 *  - tableau : `MOTS_INTERDITS` (`scripts-tableau-controles.ts`), qui garde ses règles propres (prix, « notre équipe »…) ;
 *  - TOUS les écrivains (règles du studio) : `INTERDITS_TOUS_ECRIVAINS`, la certification Certifexemple revendiquée
 *    (« certifié(e)(s) Certifexemple », « Certifexemple certifié(e)(s) », « certification Certifexemple obtenue », dans les deux ordres).
 *    Le mot « Certifexemple » seul n'est refusé que là où il l'était déjà (image → vidéo). La chaîne « équipe » réutilise
 *    cette liste (`generateur/roles/equipe-commun.ts`).
 * Une même expression citée par plusieurs écrivains n'a qu'UNE entrée ; chaque écrivain garde SON test, celui qu'il
 * applique aujourd'hui (même verdict). La `portee` dit à qui elle s'applique aujourd'hui.
 *
 *  LG-01 interdit permanent trouvé (déjà refusé par l'écrivain lui-même).
 *  LG-02 récit d'un client : à vérifier (une preuve « cas client » avec accord ; C83, R14, Q08).
 *  LG-03 formule absolue : À TRANCHER par le responsable, avec une version prudente (modèle image → vidéo, adopté pour tous).
 *  LG-04 chiffre sans source (quand l'écrivain dit quelles lignes sont sourcées).
 *  LG-05 « machine(s) » dans TOUS les formats, en OBSERVATION seulement (info) : ne change aucun
 *        verdict existant (LG-01 reste celui des formats qui l'interdisent déjà).
 */
import { raconteUnClient } from "@/domaine/controles-script/probleme";
import { INTERDITS_PERMANENTS } from "@/domaine/controles-script/style";
import { contientExpression, normaliser, texteCompare } from "@/domaine/controles-script/texte";
import { formulesAbsoluesDe } from "@/domaine/image-video/formules";
import { MOTS_INTERDITS } from "@/domaine/scripts-tableau-controles";
import { appliquerInterdits } from "@/domaine/voix";
import { MOTS_INTERDITS_FORMAT } from "@/moteurs/montage-cas-concret/regles";
import type { Contexte, EcrivainInterdits, ResultatRegle } from "../types";
import { NOMBRE, norm, resultat } from "./outils";

/** Ce que l'image → vidéo ajoute à la liste du cas concret (Q08, `montage-image-video/regles.ts`). */
export const INTERDITS_EN_PLUS_IMAGE_VIDEO: readonly string[] = ["certifié", "certifiée", "certifiés", "Certifexemple"];

/** « certifié(e)(s) » sous toutes ses formes (y compris l'écriture « certifié(e) »), et « labellisé » (même revendication). */
const CERTIFIE = "(?:certifi|labellis)(?:e|ee|es|ees)?(?:\\(e\\))?(?:\\(s\\))?";
const OBTENU = "obtenu(?:e|s|es)?";
const SEP = "[\\s-]+";
/** « certifié Certifexemple », « certifié par Certifexemple », « certifié de Certifexemple ». */
const PAR = `(?:(?:par|de)${SEP})?`;

/**
 * Interdits permanents pour TOUS les écrivains et tous les formats : testés sur le texte normalisé (accents et casse
 * ignorés). Seule source : l'équipe et le socle les lisent ici.
 */
export const INTERDITS_TOUS_ECRIVAINS: readonly { libelle: string; motif: RegExp }[] = [
  {
    libelle: "« certifié Certifexemple » (ou « Certifexemple certifié »)",
    motif: new RegExp(
      `(?:^|[^a-z])(?:${CERTIFIE}${SEP}${PAR}certifexemple|certifexemple${SEP}${CERTIFIE}|certification${SEP}certifexemple${SEP}${OBTENU}|${OBTENU}${SEP}(?:la${SEP})?certification${SEP}certifexemple)(?=$|[^a-z])`,
    ),
  },
];

/** Le texte contient-il un interdit de tous les écrivains ? (libellés trouvés) */
export function interditsTousEcrivains(texte: string): string[] {
  const n = normaliser(texte);
  return INTERDITS_TOUS_ECRIVAINS.filter((i) => i.motif.test(n)).map((i) => i.libelle);
}

/** Le mot « machine » : interdit étendu à tous les formats, en observation (LG-05). */
const MOTS_MACHINE: readonly string[] = ["machine", "machines"];

export interface InterditPermanent {
  /** Clé : l'expression normalisée. */
  cle: string;
  libelle: string;
  /** D'où vient l'entrée (règle de chaque écrivain). */
  sources: string[];
  portee: EcrivainInterdits[];
  /** Le test de chaque écrivain, tel qu'il l'applique aujourd'hui. */
  tests: Partial<Record<EcrivainInterdits, (texte: string) => boolean>>;
}

const cleDe = (libelle: string) => texteCompare(libelle.replace(/[«»]/g, ""));

function construire(): InterditPermanent[] {
  const brut: { libelle: string; source: string; ecrivain: EcrivainInterdits; test: (t: string) => boolean }[] = [
    ...INTERDITS_PERMANENTS.map((i) => ({ libelle: i.texte, source: "Écrire C42", ecrivain: "ecrire" as const, test: (t: string) => appliquerInterdits(t, [i]).length > 0 })),
    ...MOTS_INTERDITS_FORMAT.map((m) => ({ libelle: `« ${m} »`, source: "Cas concret R10", ecrivain: "cas-concret" as const, test: (t: string) => contientExpression(t, m) })),
    ...[...MOTS_INTERDITS_FORMAT, ...INTERDITS_EN_PLUS_IMAGE_VIDEO].map((m) => ({ libelle: `« ${m} »`, source: "Image → vidéo Q08", ecrivain: "image-video" as const, test: (t: string) => contientExpression(t, m) })),
    ...MOTS_INTERDITS.map((m) => ({ libelle: m.libelle, source: "Tableau", ecrivain: "tableau" as const, test: (t: string) => m.motif.test(normaliser(t)) })),
    ...INTERDITS_TOUS_ECRIVAINS.flatMap((i) =>
      (["ecrire", "tableau", "cas-concret", "image-video"] as const).map((ecrivain) => ({ libelle: i.libelle, source: "Règles de Will", ecrivain, test: (t: string) => i.motif.test(normaliser(t)) })),
    ),
  ];
  const parCle = new Map<string, InterditPermanent>();
  for (const b of brut) {
    const cle = cleDe(b.libelle);
    const e = parCle.get(cle) ?? { cle, libelle: b.libelle, sources: [], portee: [], tests: {} };
    if (!e.sources.includes(b.source)) e.sources.push(b.source);
    if (!e.portee.includes(b.ecrivain)) e.portee.push(b.ecrivain);
    e.tests[b.ecrivain] ??= b.test;
    parCle.set(cle, e);
  }
  return [...parCle.values()];
}

/** LA LISTE UNIQUE (calculée une fois). */
export const LISTE_INTERDITS: readonly InterditPermanent[] = construire();

/** Interdits communs aux quatre écrivains (« Villeexemple », « aucun gain garanti », « certifié Certifexemple »). */
export function interditsCommuns(): InterditPermanent[] {
  return LISTE_INTERDITS.filter((i) => i.portee.length === 4);
}

/** Les interdits trouvés dans un texte, pour un écrivain (son propre test). */
export function interditsDans(texte: string, ecrivain: EcrivainInterdits): InterditPermanent[] {
  return LISTE_INTERDITS.filter((i) => i.tests[ecrivain]?.(texte));
}

export function reglesInterdits(c: Contexte): ResultatRegle[] {
  const { script, recette } = c;
  const out: ResultatRegle[] = [];

  const trouves = script.lignes.flatMap((l) => interditsDans(l.dit, recette.interdits).map((i) => ({ l, i })));
  out.push(
    ...(trouves.length
      ? trouves.map(({ l, i }) => resultat(c, "LG-01", "interdits", "bloquant", "ecart", `Interdit permanent : ${i.libelle}.`, { ligneId: l.id }))
      : [resultat(c, "LG-01", "interdits", "bloquant", "ok", "Aucun interdit permanent.")]),
  );

  const recit = script.lignes.find((l) => raconteUnClient(l.dit));
  out.push(
    recit
      ? resultat(c, "LG-02", "interdits", "info", "ecart", "Récit d'un client : vérifiez qu'une preuve « cas client » avec accord existe.", { ligneId: recit.id })
      : resultat(c, "LG-02", "interdits", "info", "ok", "Aucun récit de client à vérifier."),
  );

  const absolus = script.lignes.flatMap((l) => formulesAbsoluesDe(l.dit, l.id).map((f) => ({ l, f })));
  out.push(
    ...(absolus.length
      ? absolus.map(({ l, f }) => resultat(c, "LG-03", "interdits", "bloquant", "a-trancher", `Formule absolue « ${f.texte} » : à trancher (garder ou version prudente).`, { ligneId: l.id, versionPrudente: f.proposition }))
      : [resultat(c, "LG-03", "interdits", "bloquant", "ok", "Aucune formule absolue.")]),
  );

  const machines = script.lignes.filter((l) => MOTS_MACHINE.some((m) => contientExpression(l.dit, m)));
  out.push(
    machines.length
      ? resultat(c, "LG-05", "interdits", "info", "ecart", "Le mot « machine » est à éviter dans tous les formats : dites « automatisation ».", { ligneId: machines[0].id })
      : resultat(c, "LG-05", "interdits", "info", "ok", "Pas de « machine »."),
  );

  const chiffrees = script.lignes.filter((l) => NOMBRE.test(norm(l.dit)));
  const sansSource = chiffrees.find((l) => l.sourcee === false);
  out.push(
    sansSource
      ? resultat(c, "LG-04", "interdits", "bloquant", "ecart", "Un chiffre sans source.", { ligneId: sansSource.id })
      : chiffrees.some((l) => l.sourcee === true)
        ? resultat(c, "LG-04", "interdits", "bloquant", "ok", "Chaque chiffre a sa source.")
        : resultat(c, "LG-04", "interdits", "bloquant", "non-mesure", "Les sources des chiffres sont vérifiées par l'écrivain (C1, R12, Q05, tableau)."),
  );
  return out;
}

/** L'entrée du mot « Certifexemple » seul (portée image → vidéo) : lue par les contrôles « Sur le site » (S2), jamais recopiée. */
export function interditCertificationSeule(): InterditPermanent | undefined {
  return LISTE_INTERDITS.find((i) => i.cle === cleDe("Certifexemple"));
}
