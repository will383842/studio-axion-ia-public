/**
 * BANC D'ÉCRITURE À L'AVEUGLE : la grande chaîne (`src/generateur/chaine.ts`) contre la chaîne courte
 * (`src/generateur/chaine-courte.ts`), sur les mêmes sujets. Lancé À LA MAIN, jamais par le studio.
 *
 *   npx tsx --conditions=react-server tests/banc-ecriture/banc-ecriture.ts [--sujets <fichier.json>] [--sortie <dossier>]
 *       [--graine <n>] [--simulation | --reel --confirmer-prix=<montant en dollars> [--sujets-depuis-idees=<n>]]
 *
 * Par défaut c'est une SIMULATION : aucun appel, aucune clé, 0 $ (les sorties simulées des rôles).
 * `--reel` exige `ANTHROPIC_API_KEY`, affiche D'ABORD le prix MAXIMAL estimé, et ne lance rien sans
 * `--confirmer-prix=<montant>` au moins égal à ce prix. Chaque appel passe alors par `executerRoleFacture`
 * (`src/services/generation-claude.ts`) : plafond du sujet (une écriture par sujet et par chaîne), plafond Claude du
 * mois, pré-vol de la brique Crédits, réservation, dépense enregistrée. Aucun garde-fou n'est contourné ; si Claude
 * n'est pas choisi pour l'écriture dans Réglages, le banc refuse (il ne tourne jamais en simulation déguisée).
 *
 * Socle de Will : en `--reel`, les deux chaînes lisent le VRAI socle (`chargerSocleWill` : charte, fiche de style
 * validée, textes retenus, preuves ; plus les tournures interdites actives), comme le générateur du studio, et le prix
 * est estimé avec ce socle. En simulation (et dans les tests), des données FIXES : le contexte du banc G4.
 * `--sujets-depuis-idees=<n>` (réel seulement) : les n idées RÉELLES les plus récentes du carnet de Will (non démo, non
 * archivées) remplacent le fichier de sujets ; leurs matières sont celles du carnet, comme pour un sujet du studio.
 * Sans idée réelle, le banc s'arrête (code 1) avant tout appel.
 *
 * Sorties (dossier `--sortie`, défaut `sorties/banc-ecriture/<date>`) :
 *  - `LISEZ-MOI.md` : le déroulé, pour Will ;
 *  - `sujet-<n>.md` : deux textes « A » et « B » tirés au hasard (graine fixe), sans dire d'où ils viennent ;
 *  - `vote.md` : la feuille de vote (A, B ou égal, et une phrase) ;
 *  - `cle.md` : quelle lettre est quelle chaîne, à n'ouvrir qu'APRÈS le vote ;
 *  - `tableau.md` : coût réel, durée, nombre d'appels, note des contrôles de chaque chaîne, prix estimé ;
 *  - `apres-le-vote/` : les états complets des chaînes (ils disent qui a écrit quoi).
 *
 * Codes de sortie : 0 terminé, 1 arguments, fichier de sujets, aucune idée réelle ou aucun sujet écrivable, 2 clé absente ou Claude non branché,
 * 3 prix non confirmé.
 */
import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { z } from "zod";
import type { TournureControle } from "@/domaine/controles-script/types";
import type { ContexteAxion, ExempleStyle, FicheStyle, Idee, Matiere, Preuve, ReseauDeclinaison } from "@/domaine/types";
import { executerChaine, texteVersion, type EtatChaine, type ExecuteurRoles, type OptionsChaine, type SortieExecution, type VersionEcrite } from "@/generateur/chaine";
import { executerChaineCourte } from "@/generateur/chaine-courte";
import type { DonneesGeneration } from "@/generateur/contexte";
import { briefMinimal, etapeZero } from "@/generateur/etape-zero";
import { estimationRealisteRole } from "@/generateur/roles/estimation";
import { pireCasRole, type DefinitionRole, type EntreeRole } from "@/generateur/roles/types";
import { matierePourSujet } from "@/domaine/matieres";
import { DRAPEAUX_TOURNURES } from "@/donnees/generateur/tournures-calibrees";
import { formatGenerateur } from "@/formats";
import { CONTEXTE_BANC } from "../generateur/banc/registre-banc-g4";
import { TOURNURES_G4 } from "../helpers/g4";

/**
 * Plafond d'UNE écriture de sujet (`PLAFOND_SUJET_USD` de `src/services/generateur.ts`), recopié ici pour estimer le
 * prix sans charger les services en simulation. Un test vérifie l'égalité ; en `--reel`, le banc relit la vraie valeur
 * et refuse de partir si elles diffèrent.
 */
export const PLAFOND_SUJET_BANC_USD = 1.5;

/** Arrêt propre du banc, avec son code de sortie (rien n'est parti quand il précède les écritures). */
class ErreurBanc extends Error {
  constructor(
    public readonly code: number,
    message: string,
  ) {
    super(message);
  }
}

export type NomChaine = "grande" | "courte";
export const LIBELLES_CHAINE: Record<NomChaine, string> = {
  grande: "grande chaîne (étape 0 + 12 étapes)",
  courte: "chaîne courte (3 appels)",
};

/* ------------------------------------------------------------------ */
/* Fichier de sujets                                                    */
/* ------------------------------------------------------------------ */

const RESEAUX: [ReseauDeclinaison, ...ReseauDeclinaison[]] = ["tiktok", "instagram", "facebook", "linkedin", "youtube-shorts"];

const schemaFichierSujets = z.object({
  description: z.string().optional(),
  maintenant: z.string().optional(),
  sujets: z
    .array(
      z.object({
        code: z.string().regex(/^[a-z0-9-]+$/, "code : minuscules, chiffres et tirets"),
        titre: z.string().min(1),
        idee: z.string().min(1),
        phraseWill: z.string().optional(),
        pilier: z.object({ id: z.string(), nom: z.string() }),
        reseau: z.enum(RESEAUX),
        formatId: z.string().default("avocat"),
        mode: z.enum(["avatar", "teleprompteur", "trame"]).default("avatar"),
        adresse: z.enum(["vous", "tu"]).default("vous"),
        objectif: z.enum(["notoriete", "sauvegarde", "conversation", "rendez-vous"]).default("notoriete"),
        matieres: z
          .array(z.object({ id: z.string(), type: z.string(), texte: z.string().min(1), motsCles: z.array(z.string()), croyanceAttribuee: z.boolean().optional() }))
          .min(1),
      }),
    )
    .min(1)
    .max(10),
});
export type FichierSujets = z.infer<typeof schemaFichierSujets>;
/** Un sujet du banc : du fichier (matières fournies) ou d'une idée réelle de Will (matières du carnet, pilier rattaché à l'étape 0). */
export type SujetBancEcriture = Omit<FichierSujets["sujets"][number], "pilier"> & { pilier?: { id: string; nom: string }; ideeId?: string };

export async function lireSujets(chemin: string): Promise<FichierSujets> {
  const brut = JSON.parse(await readFile(chemin, "utf8")) as unknown;
  const r = schemaFichierSujets.safeParse(brut);
  if (!r.success) throw new Error(`Fichier de sujets refusé : ${r.error.issues.map((i) => `${i.path.join(".")} : ${i.message}`).join(" ; ")}`);
  const codes = r.data.sujets.map((s) => s.code);
  if (new Set(codes).size !== codes.length) throw new Error("Fichier de sujets refusé : deux sujets ont le même code.");
  return r.data;
}

/* ------------------------------------------------------------------ */
/* Socle de Will                                                        */
/* ------------------------------------------------------------------ */

/** Ce que les deux chaînes lisent de Will : la même chose pour l'une et l'autre. */
export interface SocleBanc {
  /** « fixe » : simulation et tests ; « will » : le vrai socle (mode réel). */
  origine: "fixe" | "will";
  contexteAxion?: Pick<ContexteAxion, "positionIds" | "piliers" | "interdits" | "promessesInterdites" | "jargonInterdit" | "rolesDestinataires" | "carnetVoix" | "termesVagues"> & Partial<ContexteAxion>;
  ficheStyle?: FicheStyle;
  exemplesStyle: ExempleStyle[];
  preuves: Preuve[];
  /** Matières de Will lues en plus de celles du sujet (fichier : ses avis, d'où les positions ; idées : tout le carnet). */
  matieres: Matiere[];
  tournures: TournureControle[];
}

/** Données fixes (simulation, tests) : le contexte du banc G4, ni fiche, ni textes, ni preuves. */
export const SOCLE_FIXE: SocleBanc = { origine: "fixe", contexteAxion: CONTEXTE_BANC, exemplesStyle: [], preuves: [], matieres: [], tournures: TOURNURES_G4 };

/** Ce que les chaînes reçoivent du socle en options : comme `boucle-generation.ts` (carnet de voix validé seulement). */
export function optionsDuSocle(s: SocleBanc): Pick<OptionsChaine, "tournures" | "contexteWill"> {
  const c = s.contexteAxion;
  if (!c) return { tournures: s.tournures };
  return { tournures: s.tournures, contexteWill: { interdits: c.interdits, promessesInterdites: c.promessesInterdites, rolesDestinataires: c.rolesDestinataires, termesVagues: c.termesVagues, jargonInterdit: c.jargonInterdit, carnetVoix: c.carnetVoix.filter((x) => x.validee).map((x) => x.expression) } };
}

/** Une ligne lisible du socle lu (affichée avant le prix). */
export function resumeSocle(s: SocleBanc): string {
  if (s.origine === "fixe") return "Socle : données FIXES (contexte du banc G4 ; ni fiche de style, ni textes, ni preuves).";
  const c = s.contexteAxion;
  return `Socle de Will (réel) : charte ${c?.version !== undefined ? `v${c.version}` : "absente"} · fiche de style ${s.ficheStyle ? `v${s.ficheStyle.version} validée` : "aucune validée"} · ${s.exemplesStyle.length} texte(s) retenu(s) · ${s.preuves.length} preuve(s) · ${s.matieres.length} matière(s) · ${s.tournures.length} tournure(s) interdite(s).`;
}

/** Un sujet du banc depuis une idée réelle du carnet (réseau et format : ceux du banc, sauf format suggéré connu). */
export function sujetDepuisIdee(i: Pick<Idee, "id" | "texte" | "formatSuggere">, n: number, formatsConnus: (id: string) => boolean): SujetBancEcriture {
  const texte = i.texte.trim();
  return {
    code: `idee-${n}`,
    titre: texte.length > 80 ? `${texte.slice(0, 79).trimEnd()}…` : texte,
    idee: texte,
    reseau: "linkedin",
    formatId: i.formatSuggere && formatsConnus(i.formatSuggere) ? i.formatSuggere : "avocat",
    mode: "avatar",
    adresse: "vous",
    objectif: "notoriete",
    matieres: [],
    ideeId: i.id,
  };
}

/** Étape 0 (gratuite) d'un sujet du banc : les DONNÉES que les deux chaînes recevront, ou le manque. */
export function donneesDuSujet(s: SujetBancEcriture, maintenant: string, socle: SocleBanc = SOCLE_FIXE): { ok: true; donnees: DonneesGeneration } | { ok: false; message: string } {
  const propres: Matiere[] = s.matieres.map((m) => ({
    id: m.id,
    type: m.type as Matiere["type"],
    texte: m.texte,
    pilier: s.pilier?.id,
    motsCles: m.motsCles,
    ...(m.croyanceAttribuee ? { croyanceAttribuee: true } : {}),
    saisiePar: "will",
    statut: "validee",
    creeLe: maintenant,
    modifieLe: maintenant,
    source: { origine: "dictee", detail: "banc d'écriture (fichier de sujets)", date: maintenant },
  }));
  const matieres = [...propres, ...socle.matieres.filter((m) => !propres.some((x) => x.id === m.id))];
  const brief = briefMinimal({ idee: s.idee, phraseWill: s.phraseWill, reseaux: [s.reseau], formatId: s.formatId, objectif: s.objectif, pilier: s.pilier?.id, adresse: s.adresse, mode: s.mode });
  const z0 = etapeZero({ maintenant, brief, mode: s.mode, matieres, preuves: socle.preuves, contexteAxion: socle.contexteAxion, ficheStyle: socle.ficheStyle, exemplesStyle: socle.exemplesStyle, tournures: socle.tournures });
  return z0.ok ? { ok: true, donnees: z0.donnees } : { ok: false, message: `${z0.manque.type} : ${z0.manque.ceQuIlFaudrait}` };
}

/* ------------------------------------------------------------------ */
/* Les deux chaînes, avec le même exécutant                             */
/* ------------------------------------------------------------------ */

export interface ResultatUneChaine {
  statut: string;
  message?: string;
  etat: EtatChaine;
  version?: VersionEcrite;
  texte?: string;
}

/** Une chaîne sur un sujet. La grande garde ses réglages de production (deux corps, juges, reprises, corrections). */
export async function ecrireAvec(chaine: NomChaine, d: DonneesGeneration, executeur: ExecuteurRoles, socle: SocleBanc = SOCLE_FIXE): Promise<ResultatUneChaine> {
  const reseau = d.sujet.reseaux[0];
  const options = optionsDuSocle(socle);
  if (chaine === "grande") {
    const r = await executerChaine(d, executeur, options);
    const version = r.etat.versions?.find((v) => v.reseau === reseau);
    const message = r.statut === "attente" ? r.message : r.etat.arret?.message;
    return { statut: r.statut, message, etat: r.etat, version, texte: version ? texteVersion(r.etat, version) : undefined };
  }
  const r = await executerChaineCourte(d, executeur, { ...options, reseau });
  const version = r.statut === "terminee" ? r.version : undefined;
  const message = r.statut === "attente" ? r.message : r.etat.arret?.message;
  return { statut: r.statut, message, etat: r.etat, version, texte: version ? texteVersion(r.etat, version) : undefined };
}

/** Exécutant SIMULÉ : la sortie déterministe de chaque rôle (aucune clé, aucun appel, 0 $) ; `espion` voit chaque appel. */
export function executeurSimulation(espion?: (role: DefinitionRole, entree: EntreeRole) => void): ExecuteurRoles {
  return {
    async executer<S extends z.ZodType>(role: DefinitionRole<S>, entree: EntreeRole): Promise<SortieExecution<z.infer<S>>> {
      espion?.(role, entree);
      const brut = role.simuler(entree);
      return { ok: true, simule: true, donnees: role.schema ? (role.schema.parse(brut) as z.infer<S>) : undefined, coutUsd: 0, modele: "simulation", stopReason: "end_turn" };
    },
  };
}

/* ------------------------------------------------------------------ */
/* Prix maximal estimé, AVANT tout appel                                */
/* ------------------------------------------------------------------ */

export interface EstimationChaine {
  appels: number;
  /** Somme des pires cas des appels prévus (toute l'entrée écrite en cache + `maxTokens` en sortie). */
  pireCasUsd: number;
  /** Le plus gros pire cas d'un seul appel. */
  pireAppelUsd: number;
  /** Médianes mesurées au banc G4 (`estimationRealisteRole`). */
  realisteUsd: number;
  /** Ce que cette chaîne peut coûter AU PLUS sur ce sujet. */
  maxUsd: number;
}

/**
 * Méthode (écrite aussi dans `tableau.md`) : chaque chaîne est déroulée en simulation pour connaître ses appels et la
 * taille de leurs entrées ; pour chaque appel, le pire cas (`pireCasRole`). Puis, par sujet et par chaîne :
 *  - marge de 25 % sur la somme des pires cas : en réel, les sorties des étapes précédentes (plus longues que les
 *    sorties simulées) allongent les entrées des étapes suivantes ;
 *  - grande chaîne : chaque appel peut être repris une fois (évaluation critique ratée) → 2 × la somme des pires cas ;
 *    les branches conditionnelles (2e plan, prose raccourcie, 2e tour de corrections) sont couvertes par la borne
 *    suivante ;
 *  - chaîne courte : exactement 3 appels, aucune reprise → la somme des pires cas ;
 *  - borne du plafond du sujet (garde-fou de `executerRoleFacture`) : un appel ne part que si dépensé + réservé +
 *    estimation ≤ 1,50 $ ; le dépassement possible est celui des appels déjà partis ensemble (au plus 2 en parallèle
 *    ici), chacun borné par son pire cas → 1,50 $ + 2 × le plus gros pire cas d'un appel.
 *  Maximum = le plus petit des deux. Total = la somme sur les sujets et les deux chaînes, arrondie au centime supérieur.
 */
export const MARGE_ENTREES = 1.25;

export function estimerChaine(chaine: NomChaine, appels: { pireCasUsd: number; realisteUsd: number }[]): EstimationChaine {
  const pireCasUsd = appels.reduce((s, a) => s + a.pireCasUsd, 0);
  const pireAppelUsd = Math.max(0, ...appels.map((a) => a.pireCasUsd));
  const realisteUsd = appels.reduce((s, a) => s + a.realisteUsd, 0);
  const parAppels = MARGE_ENTREES * (chaine === "grande" ? 2 * pireCasUsd : pireCasUsd);
  const parPlafond = PLAFOND_SUJET_BANC_USD + 2 * pireAppelUsd;
  return { appels: appels.length, pireCasUsd, pireAppelUsd, realisteUsd, maxUsd: Math.min(parAppels, parPlafond) };
}

export async function estimerSujet(d: DonneesGeneration, socle: SocleBanc = SOCLE_FIXE): Promise<Record<NomChaine, EstimationChaine>> {
  const sortie = {} as Record<NomChaine, EstimationChaine>;
  for (const chaine of ["grande", "courte"] as const) {
    const appels: { pireCasUsd: number; realisteUsd: number }[] = [];
    await ecrireAvec(chaine, d, executeurSimulation((role, entree) => appels.push({ pireCasUsd: pireCasRole(role, entree), realisteUsd: estimationRealisteRole(role, entree) })), socle);
    sortie[chaine] = estimerChaine(chaine, appels);
  }
  return sortie;
}

export const dollars = (usd: number) => `${(Math.ceil(usd * 100 - 1e-9) / 100).toFixed(2).replace(".", ",")} $`;
const centimesSup = (usd: number) => Math.ceil(usd * 100 - 1e-9);

/* ------------------------------------------------------------------ */
/* Tirage à l'aveugle                                                   */
/* ------------------------------------------------------------------ */

/** Générateur pseudo-aléatoire à graine (mulberry32) : même graine, même tirage. */
export function tirage(graine: number): () => number {
  let a = graine >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Pour chaque sujet, la chaîne qui porte la lettre A (l'autre porte B). */
export function lettres(n: number, graine: number): { A: NomChaine; B: NomChaine }[] {
  const h = tirage(graine);
  return Array.from({ length: n }, () => (h() < 0.5 ? { A: "courte" as const, B: "grande" as const } : { A: "grande" as const, B: "courte" as const }));
}

/* ------------------------------------------------------------------ */
/* Rendus                                                               */
/* ------------------------------------------------------------------ */

interface LigneSujet {
  n: number;
  sujet: SujetBancEcriture;
  etape0?: string;
  resultats: Partial<Record<NomChaine, ResultatUneChaine & { dureeMs: number; appels: number; coutUsd: number }>>;
  estimation?: Record<NomChaine, EstimationChaine>;
}

function texteLu(r: ResultatUneChaine | undefined): string[] {
  if (!r?.texte) return ["_Pas de texte pour cette lettre : l'écriture s'est arrêtée avant la fin._"];
  return r.texte
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => `### ${l.replace(/^#+\s*/, "")}`);
}

export function rendreSujetMd(l: LigneSujet, lettre: { A: NomChaine; B: NomChaine }): string {
  return [
    `# Sujet ${l.n} — ${l.sujet.titre}`,
    "",
    "> Lisez les deux textes à voix haute, comme s'ils passaient dans votre fil. Ne cherchez pas d'où ils viennent : votez ensuite dans `vote.md`.",
    "",
    "---",
    "",
    "## Texte A",
    "",
    ...texteLu(l.resultats[lettre.A]).flatMap((x) => [x, ""]),
    "---",
    "",
    "## Texte B",
    "",
    ...texteLu(l.resultats[lettre.B]).flatMap((x) => [x, ""]),
  ].join("\n");
}

export function rendreVoteMd(lignes: LigneSujet[]): string {
  return [
    "# Feuille de vote",
    "",
    "Pour chaque sujet : cochez UNE case (remplacez `[ ]` par `[x]`), puis écrivez une phrase sur ce qui vous a fait choisir.",
    `N'ouvrez \`cle.md\` qu'une fois ${lignes.length > 1 ? `les ${lignes.length} votes écrits` : "le vote écrit"}.`,
    "",
    ...lignes.flatMap((l) => [`## Sujet ${l.n} — ${l.sujet.titre}`, "", "- [ ] A", "- [ ] B", "- [ ] égal", "", "Une phrase : ", ""]),
  ].join("\n");
}

export function rendreCleMd(lignes: LigneSujet[], tirees: { A: NomChaine; B: NomChaine }[], graine: number): string {
  return [
    "# CLÉ DU BANC — à n'ouvrir qu'APRÈS avoir voté",
    "",
    `Tirage au hasard, graine ${graine} (même graine, même tirage).`,
    "",
    "| Sujet | Texte A | Texte B |",
    "| --- | --- | --- |",
    ...lignes.map((l, i) => `| ${l.n} · ${l.sujet.titre} | ${LIBELLES_CHAINE[tirees[i].A]} | ${LIBELLES_CHAINE[tirees[i].B]} |`),
    "",
    "```json",
    JSON.stringify({ graine, sujets: lignes.map((l, i) => ({ n: l.n, code: l.sujet.code, ...tirees[i] })) }, null, 1),
    "```",
    "",
  ].join("\n");
}

export function rendreTableauMd(lignes: LigneSujet[], o: { mode: "simulation" | "reel"; date: string; prixMaxUsd: number; realisteUsd: number; socle?: string }): string {
  const cel = (r: LigneSujet["resultats"][NomChaine], l: LigneSujet) =>
    r
      ? `${r.statut}${r.message ? ` (${r.message.replace(/\|/g, "/")})` : ""} | ${dollars(r.coutUsd)} | ${(r.dureeMs / 1000).toFixed(1).replace(".", ",")} s | ${r.appels} | ${r.version ? `${r.version.note.globale}/100 · ${r.version.note.voyant}` : "—"}`
      : `étape 0 : ${l.etape0 ?? "—"} | 0,00 $ | 0 s | 0 | —`;
  const total = (c: NomChaine) => lignes.reduce((s, l) => s + (l.resultats[c]?.coutUsd ?? 0), 0);
  return [
    "# Tableau du banc d'écriture",
    "",
    `Mode : **${o.mode === "reel" ? "RÉEL (appels payants)" : "simulation (aucun appel, 0 $)"}** · ${o.date}`,
    "",
    ...(o.socle ? [o.socle, ""] : []),
    `Prix MAXIMAL estimé avant le lancement (réel, les deux chaînes) : **${dollars(o.prixMaxUsd)}** · estimation réaliste (médianes du banc G4) : ${dollars(o.realisteUsd)}.`,
    "",
    "| Sujet | Chaîne | Statut | Coût réel | Durée | Appels | Note des contrôles |",
    "| --- | --- | --- | --- | --- | --- | --- |",
    ...lignes.flatMap((l) => (["grande", "courte"] as const).map((c) => `| ${l.n} · ${l.sujet.code} | ${LIBELLES_CHAINE[c]} | ${cel(l.resultats[c], l)} |`)),
    "",
    `Total réel : grande chaîne ${dollars(total("grande"))} · chaîne courte ${dollars(total("courte"))}.`,
    "",
    "## Estimation par sujet (avant lancement)",
    "",
    "| Sujet | Chaîne | Appels prévus | Somme des pires cas | Estimation réaliste | Maximum retenu |",
    "| --- | --- | --- | --- | --- | --- |",
    ...lignes.flatMap((l) => (l.estimation ? (["grande", "courte"] as const).map((c) => `| ${l.n} · ${l.sujet.code} | ${LIBELLES_CHAINE[c]} | ${l.estimation![c].appels} | ${dollars(l.estimation![c].pireCasUsd)} | ${dollars(l.estimation![c].realisteUsd)} | ${dollars(l.estimation![c].maxUsd)} |`) : [])),
    "",
    "Méthode du maximum : chaque chaîne est déroulée en simulation pour connaître ses appels et la taille de leurs entrées ; le pire cas d'un appel compte toute l'entrée au tarif d'écriture en cache et tout `maxTokens` en sortie. Grande chaîne : 2 × la somme (chaque appel peut être repris une fois). Chaîne courte : la somme (3 appels, aucune reprise). Les deux avec 25 % de marge (en réel, les sorties des étapes précédentes allongent les entrées). Les deux sont bornées par le plafond du sujet appliqué par le studio (1,50 $ + 2 × le plus gros pire cas d'un appel, pour les appels déjà partis ensemble). On retient le plus petit des deux.",
    "",
  ].join("\n");
}

function rendreLisezMoi(n: number, mode: "simulation" | "reel"): string {
  return [
    "# Banc d'écriture à l'aveugle",
    "",
    mode === "simulation" ? "**SIMULATION** : ces textes sont des gabarits produits sans Claude, pour vérifier l'outil. Ils ne disent rien de la qualité." : "Textes écrits par Claude (banc réel).",
    "",
    `1. Ouvrez \`sujet-1.md\` à \`sujet-${n}.md\`. Chacun contient deux textes, A et B, écrits par deux méthodes différentes. Personne ne sait laquelle est laquelle tant que la clé n'est pas ouverte.`,
    "2. Lisez-les à voix haute, comme s'ils passaient dans votre fil.",
    "3. Dans `vote.md`, cochez A, B ou égal, et écrivez une phrase.",
    "4. Seulement après : ouvrez `cle.md` (et, si besoin, `tableau.md` pour les coûts et les notes, `apres-le-vote/` pour le détail).",
    "",
  ].join("\n");
}

/* ------------------------------------------------------------------ */
/* Mode réel : branchements (chargés seulement avec --reel)             */
/* ------------------------------------------------------------------ */

export interface BranchementsReels {
  plafondSujetUsd: number;
  /** Un exécutant FACTURÉ par écriture (un sujet × une chaîne) : `executerRoleFacture` sur une écriture du studio. */
  executeur(code: string, chaine: NomChaine): Promise<ExecuteurRoles>;
}

/** Bouchons de `next/*` (hors de Next, comme le lanceur du tableau), avant tout import des services. */
const installerBouchonsNext = () => createRequire(import.meta.url)("../../scripts/tableau/bouchons-next.cjs");

/** Lectures du mode réel : gratuites, sans aucun appel (le socle de Will, ses idées). Tests : un double. */
export interface LecturesReelles {
  /** « positions » : avec un fichier de sujets (ses avis seulement, d'où les positions) ; « carnet » : tout le carnet. */
  socle(portee: "positions" | "carnet"): Promise<SocleBanc>;
  /** Idées RÉELLES du carnet (non démo, non archivées), la plus récente d'abord. */
  idees(): Promise<Idee[]>;
}

/** Identifiant de sujet du banc : une matière réservée à un VRAI sujet n'y entre pas (`matierePourSujet`). */
const SUJET_BANC = "banc-ecriture";

/** Le vrai socle de Will, lu comme le générateur du studio (`chargerSocleWill`, tournures interdites actives). */
export async function lecturesReelles(): Promise<LecturesReelles> {
  installerBouchonsNext();
  const [sw, commun] = await Promise.all([import("@/services/socle-will"), import("@/services/_commun")]);
  return {
    async socle(portee) {
      const s = await sw.chargerSocleWill({ estDemo: false, matieres: portee === "carnet" ? (m) => matierePourSujet(m, SUJET_BANC) : (m) => m.type === "avis-will" });
      const tournures = (await commun.depots().tournesInterdites.lister((t) => !t.archiveLe)).map((t) => ({ id: t.id, motif: t.motif, regex: t.regex, drapeaux: DRAPEAUX_TOURNURES, niveau: t.niveau, portee: t.portee }));
      return { origine: "will", ...s, tournures };
    },
    async idees() {
      const xs = await commun.depots().idees.lister((i) => !i.estDemo && i.etat !== "archivee" && !!i.texte.trim());
      return xs.sort((a, b) => b.creeLe.localeCompare(a.creeLe));
    },
  };
}

const formatConnu = (id: string) => {
  try {
    formatGenerateur(id);
    return true;
  } catch {
    return false;
  }
};

/** Charge les services du studio (hors de Next : bouchons de `next/*`, comme le lanceur du tableau). */
export async function branchementsReels(): Promise<BranchementsReels> {
  installerBouchonsNext();
  const [gc, gen, commun, ids] = await Promise.all([import("@/services/generation-claude"), import("@/services/generateur"), import("@/services/_commun"), import("@/lib/ids")]);
  if (!(await gc.claudeActif())) throw new ErreurBanc(2, "Claude n'est pas choisi pour l'écriture (Réglages) ou sa clé manque côté studio : le banc réel refuse de tourner en simulation.");
  const lancement = new Date().toISOString().slice(0, 16).replace(/[-:T]/g, "");
  return {
    plafondSujetUsd: gen.PLAFOND_SUJET_USD,
    async executeur(code, chaine) {
      const g = { id: ids.nouvelId("gen"), scriptMaitreId: `banc-ecriture-${lancement}-${code}-${chaine}`, hachageContexte: "banc-ecriture", plafondUsd: gen.PLAFOND_SUJET_USD, portee: "sujet" as const, etapes: [], statut: "en-cours" as const, essai: false, ...commun.horodatage() };
      await commun.depots().generations.enregistrer(g);
      return {
        async executer(role, entree) {
          const r = await gc.executerRoleFacture(g.id, role, entree);
          if (r.ok && r.simule) throw new ErreurBanc(2, "Un appel est parti en simulation pendant le banc réel : arrêt (Claude a-t-il été débranché ?).");
          return r;
        },
      };
    },
  };
}

/* ------------------------------------------------------------------ */
/* Lanceur                                                              */
/* ------------------------------------------------------------------ */

export interface ArgumentsBanc {
  sujets: string;
  /** `--sujets-depuis-idees=<n>` : n idées réelles du carnet au lieu du fichier (mode réel seulement). */
  sujetsDepuisIdees?: number;
  sortie?: string;
  graine: number;
  reel: boolean;
  confirmerPrixUsd?: number;
}

export function lireArguments(argv: string[]): ArgumentsBanc {
  const valeur = (nom: string): string | undefined => {
    const i = argv.findIndex((a) => a === `--${nom}` || a.startsWith(`--${nom}=`));
    if (i < 0) return undefined;
    const a = argv[i];
    if (a.includes("=")) return a.slice(a.indexOf("=") + 1);
    const suivant = argv[i + 1];
    if (!suivant || suivant.startsWith("--")) throw new ErreurBanc(1, `--${nom} attend une valeur.`);
    return suivant;
  };
  const connus = ["--sujets-depuis-idees", "--sujets", "--sortie", "--graine", "--simulation", "--reel", "--confirmer-prix"];
  for (const a of argv) if (a.startsWith("--") && !connus.some((c) => a === c || a.startsWith(`${c}=`))) throw new ErreurBanc(1, `Option inconnue : ${a}`);
  if (argv.includes("--reel") && argv.includes("--simulation")) throw new ErreurBanc(1, "Choisissez --simulation OU --reel.");
  const graine = Number(valeur("graine") ?? 2026);
  if (!Number.isInteger(graine)) throw new ErreurBanc(1, "--graine attend un nombre entier.");
  const prix = valeur("confirmer-prix");
  const confirmerPrixUsd = prix === undefined ? undefined : Number(prix.replace(",", ".").replace(/\s*\$$/, ""));
  if (confirmerPrixUsd !== undefined && !(Number.isFinite(confirmerPrixUsd) && confirmerPrixUsd > 0)) throw new ErreurBanc(1, "--confirmer-prix attend un montant en dollars (ex. --confirmer-prix=18,50).");
  const idees = valeur("sujets-depuis-idees");
  const sujetsDepuisIdees = idees === undefined ? undefined : Number(idees);
  if (sujetsDepuisIdees !== undefined) {
    if (!(Number.isInteger(sujetsDepuisIdees) && sujetsDepuisIdees >= 1 && sujetsDepuisIdees <= 10)) throw new ErreurBanc(1, "--sujets-depuis-idees attend un nombre entier de 1 à 10.");
    if (!argv.includes("--reel")) throw new ErreurBanc(1, "--sujets-depuis-idees ne vaut qu'avec --reel : en simulation, le banc garde ses données fixes (fichier de sujets).");
    if (valeur("sujets") !== undefined) throw new ErreurBanc(1, "Choisissez --sujets OU --sujets-depuis-idees.");
  }
  return { sujets: valeur("sujets") ?? "tests/banc-ecriture/sujets-exemple.json", sujetsDepuisIdees, sortie: valeur("sortie"), graine, reel: argv.includes("--reel"), confirmerPrixUsd };
}

export interface DependancesBanc {
  ecrire: (ligne: string) => void;
  env?: Record<string, string | undefined>;
  /** Branchements du mode réel (tests : un double qui compte ses appels). */
  reels?: () => Promise<BranchementsReels>;
  /** Lectures du mode réel (socle, idées) ; tests : un double. */
  lectures?: () => Promise<LecturesReelles>;
  maintenant?: () => Date;
}

/** Lance le banc. Renvoie le code de sortie (voir l'en-tête). */
export async function lancerBanc(argv: string[], deps: DependancesBanc): Promise<number> {
  const ecrire = deps.ecrire;
  try {
    const args = lireArguments(argv);
    const env = deps.env ?? process.env;
    const date = (deps.maintenant?.() ?? new Date()).toISOString();
    const fichier = args.sujetsDepuisIdees
      ? undefined
      : await lireSujets(resolve(args.sujets)).catch((e: Error) => {
          throw new ErreurBanc(1, e.message);
        });
    if (args.reel && !env.ANTHROPIC_API_KEY?.trim()) throw new ErreurBanc(2, "Mode réel : ANTHROPIC_API_KEY est absente. Rien n'est parti.");

    // Le socle : celui de Will en réel (lecture gratuite), des données fixes en simulation.
    let socle = SOCLE_FIXE;
    let sujets: SujetBancEcriture[] = fichier?.sujets ?? [];
    if (args.reel) {
      const lectures = await (deps.lectures ?? lecturesReelles)();
      socle = await lectures.socle(args.sujetsDepuisIdees ? "carnet" : "positions");
      if (args.sujetsDepuisIdees) {
        const idees = (await lectures.idees()).slice(0, args.sujetsDepuisIdees);
        if (!idees.length) throw new ErreurBanc(1, "Aucune idée réelle dans le carnet de Will (hors démo et archives) : rien n'est lancé. Ajoutez des idées dans « Écrire », ou lancez le banc sans --sujets-depuis-idees.");
        if (idees.length < args.sujetsDepuisIdees) ecrire(`Seulement ${idees.length} idée(s) réelle(s) dans le carnet (${args.sujetsDepuisIdees} demandées) : le banc porte sur celles-là.`);
        sujets = idees.map((x, i) => sujetDepuisIdee(x, i + 1, formatConnu));
      }
    }
    const maintenant = fichier?.maintenant ?? date;
    ecrire(`Banc d'écriture · ${sujets.length} sujets${args.sujetsDepuisIdees ? " (idées réelles de Will)" : ""} · mode ${args.reel ? "RÉEL" : "simulation"}`);
    ecrire(resumeSocle(socle));

    // Étape 0 (gratuite) et estimation (simulation, aucun appel) de chaque sujet, socle compris.
    const lignes: LigneSujet[] = [];
    for (const [i, sujet] of sujets.entries()) {
      const z = donneesDuSujet(sujet, maintenant, socle);
      lignes.push({ n: i + 1, sujet, resultats: {}, ...(z.ok ? { estimation: await estimerSujet(z.donnees, socle) } : { etape0: z.message }) });
    }
    const prixMaxUsd = centimesSup(lignes.reduce((s, l) => s + (l.estimation ? l.estimation.grande.maxUsd + l.estimation.courte.maxUsd : 0), 0)) / 100;
    const realisteUsd = lignes.reduce((s, l) => s + (l.estimation ? l.estimation.grande.realisteUsd + l.estimation.courte.realisteUsd : 0), 0);
    ecrire(`Prix MAXIMAL estimé du banc réel (${lignes.filter((l) => l.estimation).length} sujets, les deux chaînes) : ${dollars(prixMaxUsd)} (estimation réaliste : ${dollars(realisteUsd)}).`);
    for (const l of lignes) if (l.etape0) ecrire(`  Sujet ${l.n} (${l.sujet.code}) arrêté à l'étape 0, gratuite : ${l.etape0}`);
    if (!lignes.some((l) => l.estimation)) throw new ErreurBanc(1, "Aucun sujet ne passe l'étape 0 (gratuite) : rien n'est lancé. Complétez les matières de ces sujets, puis relancez.");

    let reels: BranchementsReels | undefined;
    if (args.reel) {
      if (args.confirmerPrixUsd === undefined) throw new ErreurBanc(3, `Rien n'est lancé. Pour accepter ce prix, relancez avec --confirmer-prix=${prixMaxUsd.toFixed(2).replace(".", ",")}`);
      if (centimesSup(args.confirmerPrixUsd) < centimesSup(prixMaxUsd)) throw new ErreurBanc(3, `Rien n'est lancé : le prix confirmé (${dollars(args.confirmerPrixUsd)}) est sous le prix maximal (${dollars(prixMaxUsd)}).`);
      reels = await (deps.reels ?? branchementsReels)();
      if (reels.plafondSujetUsd !== PLAFOND_SUJET_BANC_USD) throw new ErreurBanc(2, `Le plafond d'un sujet a changé (${reels.plafondSujetUsd} $ au lieu de ${PLAFOND_SUJET_BANC_USD} $) : mettez à jour l'estimation du banc avant de le lancer.`);
    }

    const dossier = resolve(args.sortie ?? join("sorties", "banc-ecriture", date.slice(0, 16).replace(/[:T]/g, "-")));
    await mkdir(join(dossier, "apres-le-vote"), { recursive: true });
    for (const l of lignes) {
      if (!l.estimation) continue;
      const z = donneesDuSujet(l.sujet, maintenant, socle);
      if (!z.ok) continue;
      for (const chaine of ["grande", "courte"] as const) {
        ecrire(`Sujet ${l.n} (${l.sujet.code}) · ${LIBELLES_CHAINE[chaine]}…`);
        const executeur = reels ? await reels.executeur(l.sujet.code, chaine) : executeurSimulation();
        const debut = Date.now();
        const r = await ecrireAvec(chaine, z.donnees, executeur, socle);
        const dureeMs = Date.now() - debut;
        const appels = r.etat.journal.filter((j) => j.resultat !== "credit").length;
        l.resultats[chaine] = { ...r, dureeMs, appels, coutUsd: r.etat.coutUsd };
        await writeFile(join(dossier, "apres-le-vote", `${l.n}-${l.sujet.code}-${chaine}.json`), JSON.stringify({ statut: r.statut, message: r.message, etat: r.etat }, null, 1));
        ecrire(`  → ${r.statut}${r.message ? ` (${r.message})` : ""} · ${appels} appels · ${dollars(r.etat.coutUsd)} · ${(dureeMs / 1000).toFixed(1)} s${r.version ? ` · note ${r.version.note.globale}/100 (${r.version.note.voyant})` : ""}`);
      }
    }

    const tirees = lettres(lignes.length, args.graine);
    for (const [i, l] of lignes.entries()) await writeFile(join(dossier, `sujet-${l.n}.md`), rendreSujetMd(l, tirees[i]));
    await writeFile(join(dossier, "vote.md"), rendreVoteMd(lignes));
    await writeFile(join(dossier, "cle.md"), rendreCleMd(lignes, tirees, args.graine));
    await writeFile(join(dossier, "tableau.md"), rendreTableauMd(lignes, { mode: args.reel ? "reel" : "simulation", date, prixMaxUsd, realisteUsd, socle: resumeSocle(socle) }));
    await writeFile(join(dossier, "LISEZ-MOI.md"), rendreLisezMoi(lignes.length, args.reel ? "reel" : "simulation"));
    ecrire(`Fini. Dossier : ${dossier}`);
    return 0;
  } catch (e) {
    if (e instanceof ErreurBanc) {
      ecrire(e.message);
      return e.code;
    }
    throw e;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href && existsSync(process.argv[1])) {
  void lancerBanc(process.argv.slice(2), { ecrire: (l) => console.log(l) }).then((code) => {
    process.exitCode = code;
  });
}
