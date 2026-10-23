/**
 * BANC À L'AVEUGLE « chaîne équipe contre chaîne courte » (accord de Will : 5 sujets, 8 $ au plus). Lancé À LA MAIN,
 * hors de l'application : ni base de données, ni Redis, rien écrit ailleurs que dans le dossier de sortie.
 *
 *   npx tsx --conditions=react-server scripts/banc-aveugle.ts [--simulation | --estimer] [--graine <n>]
 *                                                              [--sujets code1,code2] [--ajouter-a <dossier>]
 *   Variables : PLAFOND_USD (défaut 8, refus au-dessus de 8), DOSSIER (défaut banc-aveugle-sortie/),
 *               ANTHROPIC_API_KEY (mode réel seulement, jamais affichée).
 *
 * Pour chaque sujet de `tests/generateur/banc/registre-banc-aveugle.ts` (TEST) : la chaîne courte PUIS la chaîne
 * équipe, telles qu'elles sont (`executerChaineCourte`, `executerChaineEquipe`), sur les MÊMES données (étape 0,
 * gratuite) et avec le MÊME exécutant : le vrai appel du studio (`creerFournisseurScriptClaude(cle).executerRole`), sans
 * `executerRoleFacture` (qui lit et écrit la base).
 *
 * PLAFOND BLOQUANT : avant CHAQUE appel, coût réel cumulé (jetons de la réponse × prix du modèle, jamais sous celui du
 * modèle demandé) + appels en vol (à leur pire cas) + pire cas de l'appel (`pireCasRole`) > PLAFOND_USD → l'appel ne
 * part pas : la chaîne reçoit « plafond-atteint », le banc s'arrête et écrit son rapport partiel. Une erreur après envoi
 * (délai, réseau, réponse illisible) compte le pire cas de l'appel comme dépensé.
 *
 * Modes : `--simulation` (sorties simulées des rôles, aucune clé, 0 $, même parcours) ; `--estimer` (aucun appel :
 * coût prévu par sujet et par chaîne, pire cas compris, et total).
 *
 * Sorties (`DOSSIER`) : `paires.md` (Script A / Script B par sujet, ordre tiré au hasard, graine notée, textes dits
 * seulement), `cle.json` (sujet → A/B), `couts.json` (coût et durée par sujet et par chaîne), `brut/` (états complets).
 * `--sujets` ne joue que ces sujets (les lettres A/B restent tirées pour TOUS les sujets du registre : la graine fait foi).
 * `--ajouter-a <dossier>` relit paires/cle/couts d'un banc précédent et y AJOUTE les sujets joués, sans écraser les autres ;
 * le plafond vaut pour le CUMUL (dépense déjà faite lue dans couts.json + nouveaux appels). Un sujet déjà fini n'est pas
 * rejoué ; un sujet arrêté (manque de crédit, plafond, erreur) l'est s'il est redemandé (ou si aucun --sujets n'est donné).
 * Codes de sortie : 0 fini (même arrêté par le plafond), 1 arguments ou plafond refusé, 2 clé absente.
 */
import { existsSync, readFileSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import type { z } from "zod";
import { ErreurClaude, type ReponseClaude } from "@/fournisseurs/claude/client";
import type { ResultatRole } from "@/fournisseurs/claude/inscription";
import { masquerSecrets } from "@/fournisseurs/claude/secret";
import { coutUsd } from "@/fournisseurs/claude/tarifs";
import { texteBlocs, type EtatChaine, type ExecuteurRoles, type SortieExecution, type VersionEcrite } from "@/generateur/chaine";
import { executerChaineCourte, pireCasChaineCourte } from "@/generateur/chaine-courte";
import { executerChaineEquipe, pireCasChaineEquipe } from "@/generateur/chaine-equipe";
import type { DonneesGeneration } from "@/generateur/contexte";
import { briefMinimal, etapeZero } from "@/generateur/etape-zero";
import { estimationRealisteRole } from "@/generateur/roles/estimation";
import { pireCasRole, type DefinitionRole, type EntreeRole } from "@/generateur/roles/types";
import { tirage } from "../tests/banc-ecriture/banc-ecriture";
import { CONTEXTE_BANC } from "../tests/generateur/banc/registre-banc-g4";
import { MAINTENANT_BANC_AVEUGLE, SUJETS_AVEUGLE, type SujetAveugle } from "../tests/generateur/banc/registre-banc-aveugle";
import { TOURNURES_G4 } from "../tests/helpers/g4";

/** Plafond accordé par Will : jamais plus. */
export const PLAFOND_MAX_USD = 8;
export const DOSSIER_DEFAUT = "banc-aveugle-sortie";
export const ESSAIS_SURCHARGE = 3;

export type NomChaine = "courte" | "equipe";
export const CHAINES: readonly NomChaine[] = ["courte", "equipe"];

/** PLAFOND_USD lu de l'environnement : défaut 8, refus s'il n'est pas un nombre > 0 ou s'il dépasse 8. */
export function lirePlafond(env: Record<string, string | undefined> = process.env): number {
  const brut = env.PLAFOND_USD?.trim();
  if (!brut) return PLAFOND_MAX_USD;
  const v = Number(brut.replace(",", "."));
  if (!Number.isFinite(v) || v <= 0) throw new Error(`PLAFOND_USD refusé : « ${brut} » n'est pas un montant positif.`);
  if (v > PLAFOND_MAX_USD) throw new Error(`PLAFOND_USD refusé : ${v} $ dépasse les ${PLAFOND_MAX_USD} $ accordés par Will.`);
  return v;
}

/* ------------------------------------------------------------------ */
/* Exécutant plafonné                                                   */
/* ------------------------------------------------------------------ */

/** L'appel lui-même : en réel, `creerFournisseurScriptClaude(cle).executerRole` ; en simulation et dans les tests, simulé. */
export type Appelant = <S extends z.ZodType>(role: DefinitionRole<S>, entree: EntreeRole) => Promise<ResultatRole<z.infer<S>>>;

export interface LigneAppel {
  sujet: string;
  chaine: NomChaine;
  role: string;
  modele: string;
  dureeMs: number;
  coutUsd: number;
  cumulUsd: number;
  resultat: "ok" | "invalide" | "erreur" | "refuse-plafond";
  message?: string;
}

/** Ce que le banc a dépensé et ce qui est en vol (partagé par toutes les chaînes du banc). */
export class Compteur {
  depenseUsd = 0;
  enVolUsd = 0;
  readonly appels: LigneAppel[] = [];
  /** Le premier refus du plafond : plus rien ne part ensuite. */
  arret?: { sujet: string; chaine: NomChaine; role: string; message: string };
  sujet = "";
  chaine: NomChaine = "courte";
  constructor(readonly plafondUsd: number) {}
  /** Coût d'un sujet et d'une chaîne, en ne comptant que les appels partis depuis `depuis` (rejeu d'un sujet déjà tenté). */
  coutDe(sujet: string, chaine: NomChaine, depuis = 0): number {
    return this.appels.slice(depuis).filter((a) => a.sujet === sujet && a.chaine === chaine).reduce((t, a) => t + a.coutUsd, 0);
  }
}

/** Coût réel d'une réponse : jetons × prix du modèle qui a répondu, jamais sous le prix du modèle demandé (repli). */
export function coutReponseUsd(rep: Pick<ReponseClaude, "jetons" | "modele" | "modeleDemande" | "replis">): number {
  const cout = coutUsd(rep.jetons, rep.modele);
  return rep.replis.length || rep.modele !== rep.modeleDemande ? Math.max(cout, coutUsd(rep.jetons, rep.modeleDemande)) : cout;
}

const usd = (x: number) => `${x.toFixed(4)} $`;

/**
 * L'exécutant des deux chaînes. Avant chaque appel : dépensé + en vol + pire cas de l'appel > plafond → l'appel ne part
 * pas (« plafond-atteint »), et plus aucun ensuite. Une ligne par appel sur `ecrire`, avec le cumul.
 */
export function executeurPlafonne(appelant: Appelant, compteur: Compteur, ecrire: (l: string) => void = () => {}, cles: string[] = []): ExecuteurRoles {
  return {
    async executer<S extends z.ZodType>(role: DefinitionRole<S>, entree: EntreeRole): Promise<SortieExecution<z.infer<S>>> {
      const { sujet, chaine } = compteur;
      const pire = pireCasRole(role, entree);
      if (compteur.arret || compteur.depenseUsd + compteur.enVolUsd + pire > compteur.plafondUsd) {
        const message = compteur.arret
          ? "Banc arrêté par le plafond : aucun appel ne part plus."
          : `Plafond du banc : ${usd(compteur.depenseUsd)} dépensés + ${usd(compteur.enVolUsd)} en vol + pire cas ${usd(pire)} > ${compteur.plafondUsd} $ : « ${role.id} » ne part pas.`;
        compteur.arret ??= { sujet, chaine, role: role.id, message };
        compteur.appels.push({ sujet, chaine, role: role.id, modele: "-", dureeMs: 0, coutUsd: 0, cumulUsd: compteur.depenseUsd, resultat: "refuse-plafond", message });
        ecrire(`  ${sujet} · ${role.id} : REFUSÉ (${message})`);
        return { ok: false, arret: "plafond-atteint", message };
      }
      compteur.enVolUsd += pire;
      const debut = Date.now();
      try {
        for (let essai = 1; ; essai++) {
          try {
            const r = await appelant(role, entree);
            const cout = coutReponseUsd(r.reponse);
            compteur.depenseUsd += cout;
            const ligne: LigneAppel = { sujet, chaine, role: role.id, modele: r.reponse.modele, dureeMs: Date.now() - debut, coutUsd: cout, cumulUsd: compteur.depenseUsd, resultat: r.invalide ? "invalide" : "ok", ...(r.invalide ? { message: r.invalide } : {}) };
            compteur.appels.push(ligne);
            ecrire(`  ${sujet} · ${role.id.padEnd(16)} ${r.reponse.modele} ${(ligne.dureeMs / 1000).toFixed(1)} s ${usd(cout)} · cumul ${usd(compteur.depenseUsd)} / ${compteur.plafondUsd} $${r.invalide ? ` · INVALIDE ${r.invalide}` : ""}`);
            return { ok: true, donnees: r.donnees, texte: r.reponse.texte, invalide: r.invalide, marqueur: r.marqueur, coutUsd: cout, modele: r.reponse.modele, stopReason: r.reponse.stopReason };
          } catch (e) {
            const err = e instanceof ErreurClaude ? e : null;
            if (err?.code === "surcharge" && essai < ESSAIS_SURCHARGE) {
              await new Promise((ok) => setTimeout(ok, Math.max(3000 * essai, (err.attenteSec ?? 0) * 1000)));
              continue;
            }
            // Refus avant facturation (crédit, modèle, clé, requête) : 0 $. Sinon : le pire cas compte comme dépensé.
            const nonFacture = err && ["facturation", "modele-introuvable", "cle-refusee", "requete", "surcharge"].includes(err.code);
            const cout = nonFacture ? 0 : pire;
            compteur.depenseUsd += cout;
            const message = masquerSecrets((e as Error).message, cles);
            compteur.appels.push({ sujet, chaine, role: role.id, modele: role.modele, dureeMs: Date.now() - debut, coutUsd: cout, cumulUsd: compteur.depenseUsd, resultat: "erreur", message });
            ecrire(`  ${sujet} · ${role.id} : ERREUR (${err?.code ?? "inconnue"}) ${message} · compté ${usd(cout)} · cumul ${usd(compteur.depenseUsd)}`);
            if (err?.code === "facturation") return { ok: false, arret: "en-attente-credit", message };
            if (err?.code === "modele-introuvable") return { ok: false, arret: "bloquee-modele", message };
            throw new Error(message);
          }
        }
      } finally {
        compteur.enVolUsd -= pire;
      }
    },
  };
}

/** Appelant SIMULÉ : la sortie déterministe du rôle, aucun jeton (0 $). */
export const appelantSimule: Appelant = async (role, entree) => {
  const brut = role.simuler(entree);
  const reponse: ReponseClaude = { texte: JSON.stringify(brut), modeleDemande: role.modele, modele: role.modele, replis: [], stopReason: "end_turn", jetons: { entree: 0, cacheLu: 0, cacheEcrit: 0, sortie: 0 } };
  return { reponse, donnees: role.schema ? role.schema.parse(brut) : undefined };
};

/* ------------------------------------------------------------------ */
/* Données et chaînes                                                   */
/* ------------------------------------------------------------------ */

const OPTIONS = { tournures: TOURNURES_G4, contexteWill: { interdits: CONTEXTE_BANC.interdits, promessesInterdites: CONTEXTE_BANC.promessesInterdites, rolesDestinataires: CONTEXTE_BANC.rolesDestinataires, termesVagues: CONTEXTE_BANC.termesVagues } };

/** Étape 0 (gratuite) : les données que les deux chaînes recevront, ou le manque. */
export function donneesAveugle(s: SujetAveugle): { ok: true; donnees: DonneesGeneration } | { ok: false; message: string } {
  const brief = { ...briefMinimal({ idee: s.idee, reseaux: [s.reseau], formatId: "avocat", objectif: s.objectif, pilier: s.pilier.id }), cible: s.cible };
  const z0 = etapeZero({ maintenant: MAINTENANT_BANC_AVEUGLE, brief, mode: "avatar", matieres: s.matieres, preuves: s.preuves, contexteAxion: CONTEXTE_BANC, tournures: TOURNURES_G4 });
  return z0.ok ? { ok: true, donnees: z0.donnees } : { ok: false, message: `${z0.manque.type} : ${z0.manque.ceQuIlFaudrait}` };
}

export interface ResultatChaine {
  statut: string;
  message?: string;
  etat: EtatChaine;
  version?: VersionEcrite;
  /** Le texte DIT (accroche, corps, appel), une phrase par ligne. */
  texte?: string;
  coutUsd: number;
  dureeMs: number;
}

/** Le texte dit d'une version : accroche, corps, appel (aucune indication de montage ni de méthode). */
export function texteDit(etat: EtatChaine, v: VersionEcrite): string {
  return [v.declinaison.accroche, texteBlocs(etat.corps?.[etat.gagnant ?? 0]?.blocs ?? []), v.appel.texte].map((t) => t.trim()).filter(Boolean).join("\n");
}

export async function ecrireAvec(chaine: NomChaine, d: DonneesGeneration, executeur: ExecuteurRoles): Promise<Omit<ResultatChaine, "coutUsd" | "dureeMs">> {
  const reseau = d.sujet.reseaux[0];
  const r = chaine === "courte" ? await executerChaineCourte(d, executeur, { ...OPTIONS, reseau }) : await executerChaineEquipe(d, executeur, { ...OPTIONS, reseau });
  const version = r.statut === "terminee" ? r.version : undefined;
  const message = r.statut === "attente" || r.statut === "coupee" ? r.message : r.etat.arret?.message;
  return { statut: r.statut, message, etat: r.etat, version, texte: version ? texteDit(r.etat, version) : undefined };
}

/* ------------------------------------------------------------------ */
/* Estimation (aucun appel)                                             */
/* ------------------------------------------------------------------ */

export interface EstimationChaine {
  appels: number;
  realisteUsd: number;
  /** Le plus grand de : pire cas prudent de la chaîne (règle de la réserve du studio), somme des `pireCasRole` vus. */
  pireCasUsd: number;
}

export async function estimerSujet(d: DonneesGeneration): Promise<Record<NomChaine, EstimationChaine>> {
  const sortie = {} as Record<NomChaine, EstimationChaine>;
  for (const chaine of CHAINES) {
    const vus: { pire: number; realiste: number }[] = [];
    const espion: ExecuteurRoles = {
      async executer(role, entree) {
        vus.push({ pire: pireCasRole(role, entree), realiste: estimationRealisteRole(role, entree) });
        const r = await appelantSimule(role, entree);
        return { ok: true, simule: true, donnees: r.donnees, coutUsd: 0, modele: "simulation", stopReason: "end_turn" };
      },
    };
    await ecrireAvec(chaine, d, espion);
    const officiel = (chaine === "courte" ? pireCasChaineCourte : pireCasChaineEquipe)(d, { ...OPTIONS, reseau: d.sujet.reseaux[0] });
    const somme = vus.reduce((t, x) => t + x.pire, 0);
    // L'équipe peut rappeler le chef une fois (test « influenceur IA ») : le pire cas officiel le compte.
    sortie[chaine] = { appels: Math.max(vus.length, officiel.appels), realisteUsd: vus.reduce((t, x) => t + x.realiste, 0), pireCasUsd: Math.max(officiel.usd, somme) };
  }
  return sortie;
}

/* ------------------------------------------------------------------ */
/* Rendus                                                               */
/* ------------------------------------------------------------------ */

/** Pour chaque sujet, la chaîne qui porte la lettre A (l'autre porte B), tirée avec la graine. */
export function lettres(codes: readonly string[], graine: number): Record<string, { A: NomChaine; B: NomChaine }> {
  const h = tirage(graine);
  return Object.fromEntries(codes.map((c) => [c, h() < 0.5 ? { A: "courte" as const, B: "equipe" as const } : { A: "equipe" as const, B: "courte" as const }]));
}

export interface LigneSujet {
  sujet: SujetAveugle;
  etape0?: string;
  resultats: Partial<Record<NomChaine, ResultatChaine>>;
  /** Sujet repris d'un banc précédent (`--ajouter-a`) : sa ligne de rapport est reprise telle quelle. */
  repris?: Rapport["sujets"][number];
}

function texteLu(r: ResultatChaine | undefined): string {
  if (!r?.texte) return "_Pas de texte : l'écriture s'est arrêtée avant la fin._";
  return r.texte.split("\n").map((l) => `> ${l}`).join("\n>\n");
}

/** `paires.md` : les textes dits seulement, aucune trace de la méthode (ni chaîne, ni rôle, ni étape, ni coût). */
export function rendrePaires(lignes: readonly LigneSujet[], cle: Record<string, { A: NomChaine; B: NomChaine }>, graine: number): string {
  const l: string[] = ["# Banc à l'aveugle : paires de scripts", "", `Graine du tirage : ${graine}. Pour chaque sujet, lisez A et B, puis notez lequel vous publieriez.`, ""];
  lignes.forEach((x, i) => {
    const k = cle[x.sujet.code];
    l.push(`## Sujet ${i + 1} : ${x.sujet.titre.replace(/\s*\(.*\)\s*$/, "")}`, "", `Cible : ${x.sujet.cible}. Réseau : ${x.sujet.reseau}.`, "");
    if (x.etape0) l.push(`_Sujet non écrit : ${x.etape0}_`, "");
    else l.push("### Script A", "", texteLu(x.resultats[k.A]), "", "### Script B", "", texteLu(x.resultats[k.B]), "");
  });
  return l.join("\n");
}

export interface Rapport {
  mode: "reel" | "simulation";
  graine: number;
  plafondUsd: number;
  depenseUsd: number;
  arret?: Compteur["arret"];
  sujets: { code: string; etape0?: string; chaines: Partial<Record<NomChaine, { statut: string; message?: string; coutUsd: number; dureeSec: number; note?: number; voyant?: string }>> }[];
  appels: LigneAppel[];
}

export function rapport(lignes: readonly LigneSujet[], compteur: Compteur, mode: Rapport["mode"], graine: number): Rapport {
  return {
    mode,
    graine,
    plafondUsd: compteur.plafondUsd,
    depenseUsd: +compteur.depenseUsd.toFixed(5),
    ...(compteur.arret ? { arret: compteur.arret } : {}),
    sujets: lignes.map((x) => x.repris ?? ({
      code: x.sujet.code,
      ...(x.etape0 ? { etape0: x.etape0 } : {}),
      chaines: Object.fromEntries(Object.entries(x.resultats).map(([c, r]) => [c, { statut: r!.statut, ...(r!.message ? { message: r!.message } : {}), coutUsd: +r!.coutUsd.toFixed(5), dureeSec: +(r!.dureeMs / 1000).toFixed(1), ...(r!.version ? { note: r!.version.note.globale, voyant: r!.version.note.voyant } : {}) }])),
    })),
    appels: compteur.appels.map((a) => ({ ...a, coutUsd: +a.coutUsd.toFixed(5), cumulUsd: +a.cumulUsd.toFixed(5) })),
  };
}

async function ecrireSorties(dossier: string, lignes: readonly LigneSujet[], compteur: Compteur, mode: Rapport["mode"], graine: number): Promise<void> {
  // Les lettres sont tirées pour tous les sujets du registre : jouer seulement certains sujets ne les déplace pas.
  const cle = lettres(SUJETS_AVEUGLE.map((s) => s.code), graine);
  await writeFile(join(dossier, "paires.md"), rendrePaires(lignes, cle, graine));
  await writeFile(join(dossier, "cle.json"), JSON.stringify({ graine, cle: Object.fromEntries(lignes.map((x) => [x.sujet.code, cle[x.sujet.code]])) }, null, 1));
  await writeFile(join(dossier, "couts.json"), JSON.stringify(rapport(lignes, compteur, mode, graine), null, 1));
}

/* ------------------------------------------------------------------ */
/* Lancement                                                            */
/* ------------------------------------------------------------------ */

/** Un banc précédent relu (`--ajouter-a`). */
export interface BancPrecedent {
  rapport: Rapport;
  graine: number;
  /** Les textes dits de `paires.md`, par titre de sujet puis lettre. */
  textes: Record<string, { A?: string; B?: string }>;
}

/** Relit `couts.json`, `cle.json` et `paires.md` d'un dossier ; un message d'erreur si l'un manque ou est illisible. */
export function lireBancPrecedent(dossier: string): BancPrecedent | string {
  try {
    const rapport = JSON.parse(readFileSync(join(dossier, "couts.json"), "utf8")) as Rapport;
    const cle = JSON.parse(readFileSync(join(dossier, "cle.json"), "utf8")) as { graine: number };
    const paires = readFileSync(join(dossier, "paires.md"), "utf8");
    if (!Array.isArray(rapport.sujets) || !Number.isFinite(rapport.depenseUsd) || !Number.isInteger(cle.graine)) return `--ajouter-a : « ${dossier} » n'est pas un banc lisible.`;
    const textes: BancPrecedent["textes"] = {};
    for (const bloc of paires.split(/^## Sujet \d+ : /m).slice(1)) {
      const titre = bloc.split("\n")[0].trim();
      const lettre = (l: "A" | "B") => {
        const m = bloc.match(new RegExp(`^### Script ${l}$([\\s\\S]*?)(?=^### |^## |$(?![\\s\\S]))`, "m"));
        const lignes = (m?.[1] ?? "").split("\n").filter((x) => x.startsWith("> ")).map((x) => x.slice(2));
        return lignes.length ? lignes.join("\n") : undefined;
      };
      textes[titre] = { A: lettre("A"), B: lettre("B") };
    }
    return { rapport, graine: cle.graine, textes };
  } catch {
    return `--ajouter-a : « ${dossier} » n'a pas de couts.json, cle.json et paires.md lisibles.`;
  }
}

/** Un sujet est « fini » quand l'étape 0 l'a laissé passer et que ses deux chaînes sont terminées (ou qu'il a été arrêté à l'étape 0, 0 $). */
const sujetFini = (r: Rapport["sujets"][number]): boolean => !!r.etape0 || CHAINES.every((c) => r.chaines[c]?.statut === "terminee");

export interface OptionsLancement {
  env?: Record<string, string | undefined>;
  ecrire?: (l: string) => void;
  /** Tests : un appelant à la place du vrai (le plafond et les comptes restent ceux du banc). */
  appelant?: Appelant;
  sujets?: SujetAveugle[];
}

export async function lancerBanc(argv: string[], o: OptionsLancement = {}): Promise<number> {
  const env = o.env ?? process.env;
  const ecrire = o.ecrire ?? ((l: string) => console.log(l));
  const registre = o.sujets ?? SUJETS_AVEUGLE;
  const valeurs = ["--graine", "--sujets", "--ajouter-a"];
  const inconnus = argv.filter((a, i) => !["--simulation", "--estimer", ...valeurs].includes(a) && !valeurs.includes(argv[i - 1]));
  if (inconnus.length) {
    ecrire(`Argument inconnu : ${inconnus.join(" ")}`);
    return 1;
  }
  let plafond: number;
  try {
    plafond = lirePlafond(env);
  } catch (e) {
    ecrire((e as Error).message);
    return 1;
  }
  const valeurDe = (nom: string): string | undefined => {
    const i = argv.indexOf(nom);
    return i >= 0 ? argv[i + 1] ?? "" : undefined;
  };
  const brutSujets = valeurDe("--sujets");
  const demandes = brutSujets === undefined ? undefined : brutSujets.split(",").map((c) => c.trim()).filter(Boolean);
  if (demandes) {
    const absents = demandes.filter((c) => !registre.some((s) => s.code === c));
    if (!demandes.length || absents.length) {
      ecrire(demandes.length ? `--sujets : sujet inconnu : ${absents.join(", ")}. Sujets du registre : ${registre.map((s) => s.code).join(", ")}.` : "--sujets : au moins un code de sujet.");
      return 1;
    }
  }
  const dossierAjout = valeurDe("--ajouter-a");
  let precedent: BancPrecedent | undefined;
  if (dossierAjout !== undefined) {
    const lu = dossierAjout ? lireBancPrecedent(resolve(dossierAjout)) : "--ajouter-a : un dossier.";
    if (typeof lu === "string") {
      ecrire(lu);
      return 1;
    }
    precedent = lu;
  }
  const brutGraine = valeurDe("--graine");
  const graine = brutGraine !== undefined ? Number(brutGraine) : precedent ? precedent.graine : Math.floor(Math.random() * 1_000_000);
  if (!Number.isInteger(graine)) {
    ecrire("--graine : un nombre entier.");
    return 1;
  }
  if (precedent && graine !== precedent.graine) {
    ecrire(`--ajouter-a : la graine ${graine} n'est pas celle du banc à compléter (${precedent.graine}) : les lettres A/B changeraient.`);
    return 1;
  }
  const sujets = demandes ? registre.filter((s) => demandes.includes(s.code)) : registre;
  const donnees = sujets.map((s) => ({ s, z0: donneesAveugle(s) }));

  if (argv.includes("--estimer")) {
    ecrire(`Estimation (aucun appel) · plafond ${plafond} $`);
    let realiste = 0;
    let pire = 0;
    for (const { s, z0 } of donnees) {
      if (!z0.ok) {
        ecrire(`- ${s.code} : arrêt à l'étape 0, 0 $ (${z0.message})`);
        continue;
      }
      const e = await estimerSujet(z0.donnees);
      const r = e.courte.realisteUsd + e.equipe.realisteUsd;
      const p = e.courte.pireCasUsd + e.equipe.pireCasUsd;
      realiste += r;
      pire += p;
      ecrire(`- ${s.code} (${s.reseau}) : courte ${e.courte.appels} appels, prévu ${e.courte.realisteUsd.toFixed(2)} $, pire cas ${e.courte.pireCasUsd.toFixed(2)} $ · équipe ${e.equipe.appels} appels, prévu ${e.equipe.realisteUsd.toFixed(2)} $, pire cas ${e.equipe.pireCasUsd.toFixed(2)} $ · sujet : prévu ${r.toFixed(2)} $, pire cas ${p.toFixed(2)} $`);
    }
    ecrire(`TOTAL : prévu ${realiste.toFixed(2)} $ · pire cas ${pire.toFixed(2)} $ · plafond ${plafond} $${pire > plafond ? " (le pire cas dépasse le plafond : le banc s'arrêterait proprement avant)" : " (tient sous le plafond même au pire)"}`);
    return 0;
  }

  const simulation = argv.includes("--simulation");
  const cle = env.ANTHROPIC_API_KEY?.trim() ?? "";
  let appelant = o.appelant;
  if (!appelant) {
    if (simulation) appelant = appelantSimule;
    else {
      if (!cle) {
        ecrire("ANTHROPIC_API_KEY absente : rien n'est parti.");
        return 2;
      }
      const { creerFournisseurScriptClaude } = await import("@/fournisseurs/claude/inscription");
      const f = creerFournisseurScriptClaude(cle);
      appelant = (role, entree) => f.executerRole(role, entree);
    }
  }
  const mode = simulation ? "simulation" : "reel";
  if (precedent && precedent.rapport.mode !== mode) {
    ecrire(`--ajouter-a : le banc à compléter est en mode ${precedent.rapport.mode}, pas ${mode}.`);
    return 1;
  }
  const dossier = resolve(dossierAjout || env.DOSSIER?.trim() || DOSSIER_DEFAUT);
  await mkdir(join(dossier, "brut"), { recursive: true });
  const compteur = new Compteur(plafond);
  // Banc à compléter : la dépense déjà faite compte dans le plafond ; les appels déjà faits restent au rapport.
  const lignes: LigneSujet[] = [];
  if (precedent) {
    compteur.depenseUsd = precedent.rapport.depenseUsd;
    compteur.appels.push(...precedent.rapport.appels);
    const rejoues = new Set(donnees.filter(({ s }) => {
      const avant = precedent.rapport.sujets.find((x) => x.code === s.code);
      return !avant || !sujetFini(avant);
    }).map(({ s }) => s.code));
    for (const r of precedent.rapport.sujets) {
      if (rejoues.has(r.code)) continue;
      const sujet = registre.find((s) => s.code === r.code);
      if (!sujet) continue;
      const t = precedent.textes[sujet.titre.replace(/\s*\(.*\)\s*$/, "")] ?? {};
      const k = lettres(registre.map((s) => s.code), graine)[r.code];
      const res = (c: NomChaine): ResultatChaine | undefined => {
        const texte = t[k.A === c ? "A" : "B"];
        return r.chaines[c] ? { statut: r.chaines[c]!.statut, etat: { version: 1, etape: 0, coutUsd: 0, journal: [] }, texte, coutUsd: r.chaines[c]!.coutUsd, dureeMs: r.chaines[c]!.dureeSec * 1000 } : undefined;
      };
      lignes.push({ sujet, etape0: r.etape0, resultats: { courte: res("courte"), equipe: res("equipe") }, repris: r });
    }
    for (const { s } of donnees) if (!rejoues.has(s.code)) ecrire(`=== ${s.code} : déjà fini dans le banc à compléter, non rejoué.`);
    donnees.splice(0, donnees.length, ...donnees.filter(({ s }) => rejoues.has(s.code)));
  }
  const executeur = executeurPlafonne(appelant, compteur, ecrire, cle ? [cle] : []);
  ecrire(`Banc à l'aveugle · mode ${mode} · plafond ${plafond} $ · graine ${graine} · ${sujets.length} sujets · dossier ${dossier}`);

  for (const { s, z0 } of donnees) {
    const ligne: LigneSujet = { sujet: s, resultats: {} };
    lignes.push(ligne);
    lignes.sort((a, b) => registre.indexOf(a.sujet) - registre.indexOf(b.sujet));
    const depuis = compteur.appels.length;
    if (!z0.ok) {
      ligne.etape0 = z0.message;
      ecrire(`=== ${s.code} : arrêt à l'étape 0 (0 $) : ${z0.message}`);
      await ecrireSorties(dossier, lignes, compteur, mode, graine);
      continue;
    }
    for (const chaine of CHAINES) {
      if (compteur.arret) break;
      compteur.sujet = s.code;
      compteur.chaine = chaine;
      ecrire(`=== ${s.code} · ${chaine}`);
      const debut = Date.now();
      let r: Omit<ResultatChaine, "coutUsd" | "dureeMs">;
      try {
        r = await ecrireAvec(chaine, z0.donnees, executeur);
      } catch (e) {
        r = { statut: "erreur", message: masquerSecrets((e as Error).message, cle ? [cle] : []), etat: { version: 1, etape: 0, coutUsd: 0, journal: [] } };
      }
      const res: ResultatChaine = { ...r, coutUsd: compteur.coutDe(s.code, chaine, depuis), dureeMs: Date.now() - debut };
      ligne.resultats[chaine] = res;
      await writeFile(join(dossier, "brut", `${s.code}-${chaine}.json`), JSON.stringify({ statut: res.statut, message: res.message, coutUsd: res.coutUsd, dureeMs: res.dureeMs, etat: res.etat }, null, 1));
      ecrire(`  → ${res.statut}${res.message ? ` (${res.message})` : ""} · ${usd(res.coutUsd)} · ${(res.dureeMs / 1000).toFixed(1)} s · cumul ${usd(compteur.depenseUsd)}`);
      await ecrireSorties(dossier, lignes, compteur, mode, graine);
    }
    if (compteur.arret) {
      ecrire(`ARRÊT : ${compteur.arret.message} Rapport partiel écrit.`);
      break;
    }
  }
  await ecrireSorties(dossier, lignes, compteur, mode, graine);
  ecrire(`Fini · dépense ${usd(compteur.depenseUsd)} / ${plafond} $ · dossier ${dossier}`);
  return 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href && existsSync(process.argv[1])) {
  void lancerBanc(process.argv.slice(2)).then((code) => {
    process.exitCode = code;
  });
}
