/**
 * T-EXT-V2-10 · ESSAI DE BOUT EN BOUT À 0 € : « un tableau de bord pour un atelier » (cas 2) et « je veux un tri d'e-mails »
 * (cas 3), de la phrase à la vidéo finie, plus tous les refus attendus.
 *
 * PIÈCES RÉELLES (importées, jamais recopiées) : dépôt du formulaire (33), moteur et chaîne du tutoriel, ports de l'équipe et
 * orchestre (55, V2-08), contrôles des textes créés (V2-02, V2-06), poste « écrire la maquette » et constructeur vivant
 * (V2-03, V2-04), contrôle de la charte, écran « Votre maquette » (V2-09), validation du script (33), registre (40), garde des
 * chiffres (G4-03), contrôle de marque (23).
 * DOUBLES : Claude (le chemin de l'argent `executer` est un double qui compte chaque appel), voix, rendu, capteur d'aperçu,
 * film de navigation. Aucun appel réel, aucun réseau (`fetch` fait échouer le test), aucun navigateur, aucun secret.
 * RÉGLAGES : jamais écrits ; ils ne sont « allumés » que dans le lecteur injecté de cet essai.
 *
 * PONT « EN ATTENDANT » (dans ce fichier seulement ; il tient la place d'un raccord absent de master) : les ponts 1 (chaîne : option
 * `phraseOuverte`), 2 (écran : dépôt de la pièce) et 3 (écran : flux) sont retirés, leurs maillons étant corrigés sur master ; le bloc « maillons » en bas
 * de fichier prouve la chaîne et l'écran sans pont.
 *  - PONT 3 (cas 3) : RETIRÉ (V2-09b). L'écran lit et garde un flux comme une maquette ; le poste (`ecrire-maquette.mts`) fabrique l'aperçu du flux
 *    (`apercuPieceFlux`) : le test dépose le vrai aperçu du poste, sans fichier fabriqué.
 *
 * Règle de la fiche : si un maillon casse, le test reste ROUGE avec le nom du maillon ; aucune correction de production ici.
 */
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/* ------------------------------------------------------------------ */
/* Session simulée                                                     */
/* ------------------------------------------------------------------ */

vi.mock("@/services/auth", () => ({ exigerSession: async () => ({}) }));

import { garderChiffres } from "@/briques/donnees-video/garde-chiffres";
import type { PlanValide } from "@/briques/plan-scenes/schema";
import type { CommandeFabrication, Fichier, Travail } from "@/domaine/types";
import { depots, reinitialiserDepots } from "@/donnees/memoire";
import type { ReponseClaude } from "@/fournisseurs/claude/client";
import { creerMoteurTutorielOutil, type EtatTutoriel, type OutilsTutoriel } from "@/moteurs/montage-tutoriel-outil";
import { lireDescriptionMaquette, type DescriptionMaquette } from "@/moteurs/montage-tutoriel-outil/description-maquette";
import { ENTREE_TUTORIEL } from "@/moteurs/montage-tutoriel-outil/entrees";
import { DUREE_CIBLE_SEC } from "@/moteurs/montage-tutoriel-outil/equipe/chef-de-projet";
import { controlerMarque, etiquettesInterdites, montantsArgent, nomsNonNeutres, tutoiement } from "@/moteurs/montage-tutoriel-outil/equipe/controle-marque";
import { roleMaquettiste } from "@/moteurs/montage-tutoriel-outil/equipe/maquettiste";
import { ROLES_APPELES, type EtatEquipe } from "@/moteurs/montage-tutoriel-outil/equipe/orchestre";
import { CODE_PIECE_A_CONSTRUIRE, CODE_PIECE_A_REVOIR, CODE_PIECE_A_VALIDER } from "@/moteurs/montage-tutoriel-outil/equipe/pas-piece-creee";
import { verifierRendu } from "@/moteurs/montage-tutoriel-outil/equipe/registre-textes";
import { lirePropositionScripts } from "@/moteurs/montage-tutoriel-outil/equipe/scenariste";
import { controlerFluxCree, DOMAINE_COURRIEL_EXEMPLE, textesDuFlux } from "@/moteurs/montage-tutoriel-outil/flux-cree";
import type { FluxAutomatisation } from "@/moteurs/montage-tutoriel-outil/gabarit-flux";
import { empreinteDescription, PARAM_ENTREE_PHRASE, PARAM_PIECE_CLAUDE, textesDeLaMaquette } from "@/moteurs/montage-tutoriel-outil/maquette-creee";
import { ETAPE_PIECE_TUTORIEL, PARAM_CLAUDE_TUTORIEL, plafondTutorielPhraseUsd } from "@/services/tutoriel-claude";
import { deposerTutoriel, lireInterrupteursTutoriel, PARAM_FORMULAIRE, PHRASE_PHRASE_FERMEE, PHRASE_TUTORIEL_FERME } from "@/services/tutoriel-depot";
import { equipeTutorielActive, PARAM_EQUIPE_TUTORIEL, portsEquipeAvecPhrase } from "@/services/tutoriel-equipe";
import { autreProposition, corrigerTexte, enregistrerApercu, garderPiece, NOM_FICHIER_APERCU, vuePieceCreee, type DependancesPiece } from "@/services/tutoriel-piece-creee";
import { choisirVersion, validerTutoriel } from "@/services/tutoriel-validation";
import { commandeTutoriel, outilsDoubles, type Journal } from "../doubles";
// Le poste et le constructeur vivent sous `outils/` : import par chemin relatif (jamais `@/`).
// @ts-expect-error TS5097 : l'extension .mts est voulue (outil lancé par tsx) ; les types restent résolus.
import { CODE_EMPREINTE, CODE_OK, CODE_REFUSE, ecrireMaquette, type DependancesEcriture } from "../../../outils/maquettes-tableaux-de-bord/constructeur/ecrire-maquette.mts";
import { MENTION_ECRAN, NOMS_FICHIERS } from "../../../outils/maquettes-tableaux-de-bord/constructeur/construire";
import {
  CHIFFRE_AVANT,
  CHIFFRE_MAINTENANT,
  descriptionAtelier,
  descriptionAtelierAutre,
  descriptionAvecNomReel,
  DOMAINE_EXEMPLE,
  fluxTri,
  IMAGE_APERCU_FIXE,
  navigationFixe,
  NOM_REEL,
  PHRASE_ASSISTANT,
  PHRASE_ATELIER,
  PHRASE_CHIFFREE,
  PHRASE_TRI,
  planDuDouble,
  scriptsDuDouble,
  TEXTE_AVANT_CORRECTION,
  TEXTE_CORRIGE,
  type MomentFiche,
} from "./phrases";

/* ------------------------------------------------------------------ */
/* Outils de l'essai                                                    */
/* ------------------------------------------------------------------ */

const T0 = Date.UTC(2026, 10, 20, 9);
const T_ISO = new Date(T0).toISOString();
const VIDEO = "v-phrase";
const TRAVAIL = "t-phrase";

/** Fait casser le test avec le NOM du maillon (règle de la fiche : on nomme, on ne répare pas). */
function maillon(nom: string, raison: string): never {
  throw new Error(`essai phrase : maillon : ${nom} — ${raison}`);
}

/** Les cinq réglages de la fiche, allumés DANS LE DOUBLE seulement (aucun n'est écrit nulle part). */
const TOUT_ALLUME: Readonly<Record<string, unknown>> = { [PARAM_FORMULAIRE]: true, [PARAM_ENTREE_PHRASE]: true, [PARAM_PIECE_CLAUDE]: true, [PARAM_EQUIPE_TUTORIEL]: true, [PARAM_CLAUDE_TUTORIEL]: true };
const sans = (...cles: string[]): Record<string, unknown> => Object.fromEntries(Object.entries(TOUT_ALLUME).filter(([k]) => !cles.includes(k)));

interface Appel {
  role: string;
  etape: string;
  plafond: number;
  /** Numéro de proposition lu dans l'entrée du maquettiste (`<proposition>`). */
  proposition?: number;
}

interface Options {
  reglages?: Record<string, unknown>;
  /** Contenu rendu par le double du maquettiste, par numéro de proposition. */
  propositions?: Partial<Record<1 | 2, () => Record<string, unknown>>>;
  /** Le double du scénariste dit les chiffres d'exemple de la maquette. */
  scriptChiffre?: boolean;
  /** Pannes du rendu (composition) avant qu'il réussisse. */
  renduEchecs?: number;
}

const dossiersTemporaires: string[] = [];
let appelsReseau = 0;

/** Tout ce qu'il faut pour mener UNE vidéo partie d'une phrase : dépôt réel, moteur réel, doubles comptés. */
async function monde(phrase: string, options: Options = {}) {
  const reglages = options.reglages ?? TOUT_ALLUME;
  const lire = async <T,>(id: string, defaut: T): Promise<T> => (id in reglages ? (reglages[id] as T) : defaut);
  const flux = phrase === PHRASE_TRI;
  const journal: Journal = { voix: [], claude: [], rendus: [] };
  const textesVoix: string[] = [];
  const appels: Appel[] = [];
  const fabriques = { 1: options.propositions?.[1] ?? (flux ? fluxTri : descriptionAtelier), 2: options.propositions?.[2] ?? descriptionAtelierAutre };

  /* ---- Dépôt (T-EXT-33, vrai `deposerTutoriel`, interrupteurs lus par le lecteur injecté) ---- */
  let entrees: Record<string, unknown> | undefined;
  const depot = await deposerTutoriel(
    { mode: "phrase", phrase, ratios: ["4:5"] },
    {
      interrupteurs: () => lireInterrupteursTutoriel((id, d) => lire(id, d)),
      brouillon: async (e) => {
        entrees = e.entrees;
        return { id: VIDEO };
      },
      ratios: async () => undefined,
      lancer: async () => ({ statut: "lancee", travailId: TRAVAIL }),
      abandonner: async () => undefined,
    },
  );

  /* ---- Double du chemin de l'argent : jamais Claude ; chaque appel est compté avec son étape et son plafond ---- */
  const executer = (async (_videoId: string, role: { id: string; simuler: (e: never) => unknown }, entree: { variable: string }, opts: { etape: string; plafondPropre: { defautUsd: number } }) => {
    const id = Object.entries(ROLES_APPELES).find(([, d]) => d?.id === role.id)?.[0] ?? role.id;
    const proposition = id === "maquettiste" ? Number(entree.variable.match(/<proposition>(\d)<\/proposition>/)?.[1] ?? 1) : undefined;
    appels.push({ role: id, etape: opts.etape, plafond: opts.plafondPropre.defautUsd, ...(proposition ? { proposition } : {}) });
    let donnees: unknown;
    if (id === "maquettiste") donnees = { manque: flux ? "flux-automatisation" : "maquette", contenu: fabriques[proposition === 2 ? 2 : 1]() };
    else if (id === "scenariste") {
      const brut = entree.variable.match(/<scenariste>([\s\S]*)<\/scenariste>/)?.[1] ?? "{}";
      const fiche = (JSON.parse(brut.replace(/<\\\//g, "</")) as { fiche: { moments: MomentFiche[] } }).fiche;
      donnees = scriptsDuDouble(fiche.moments, options.scriptChiffre ? PHRASE_CHIFFREE : undefined);
    } else donnees = role.simuler(entree as never);
    return { ok: true, simule: false, donnees, texte: "", modele: "double", coutUsd: 0, jetons: { entree: 0, cacheLu: 0, cacheEcrit: 0, sortie: 0 } };
  }) as never;

  /* ---- Outils du moteur : doubles de `doubles.ts` ; l'équipe par les VRAIS ports, derrière les réglages du lecteur ---- */
  let navigation: unknown;
  let textesPlan: [string, string] = ["", ""];
  const commande = (): CommandeFabrication =>
    commandeTutoriel({ videoId: VIDEO, ratios: ["4:5"], script: { blocs: [], texteComplet: "" }, entrees: { [ENTREE_TUTORIEL]: { ...((entrees?.[ENTREE_TUTORIEL] as object | undefined) ?? {}), ...(navigation ? { navigationFilmee: navigation } : {}) } } });
  const base = outilsDoubles(journal, { renduEchecs: options.renduEchecs });
  const voixDoubles = base.voix!;
  const voixBase = voixDoubles.voix();
  const voix = {
    ...voixBase,
    async lire(d: { texte: string; idExterne: string }) {
      textesVoix.push(d.texte);
      return (voixBase as unknown as { lire: (x: typeof d) => Promise<unknown> }).lire(d);
    },
  };
  const outils = async (): Promise<OutilsTutoriel> => {
    const c = commande();
    const equipe = (await equipeTutorielActive(lire)) ? await portsEquipeAvecPhrase(c, VIDEO, { executer, lire }) : undefined;
    return {
      ...base,
      voix: { ...voixDoubles, voix: () => voix as unknown as ReturnType<typeof voixDoubles.voix> },
      claude: async (requete): Promise<ReponseClaude> => {
        journal.claude.push(requete);
        return { texte: planDuDouble(requete.messages[0].contenu, textesPlan), modeleDemande: requete.modele, modele: requete.modele, replis: [], stopReason: "end_turn", jetons: { entree: 10, sortie: 10 } } as unknown as ReponseClaude;
      },
      ...(equipe ? { equipe: { ...equipe, maintenant: () => T_ISO } } : {}),
    };
  };
  const moteur = creerMoteurTutorielOutil({ outils });

  /* ---- Le travail vit dans le dépôt en mémoire (les gestes de validation de 33 le lisent là) ---- */
  const travail = async (): Promise<Travail> => (await depots().travaux.obtenir(TRAVAIL)) as Travail;
  const ranger = async (t: Travail) => void (await depots().travaux.enregistrer(t));
  let tours = 0;
  let resultat: Awaited<ReturnType<typeof moteur.avancer>>["resultat"];
  if (depot.statut === "lancee") await ranger(await moteur.lancer(commande(), { travailId: TRAVAIL, versionId: "ver-1", titre: phrase, maintenant: T0 }));
  /** Avance jusqu'à une pause, un échec ou la fin. */
  const mener = async (): Promise<Travail> => {
    let t = await travail();
    for (let i = 0; i < 500; i++) {
      const r = await moteur.avancer(t, commande(), T0 + tours++ * 1000);
      t = r.travail;
      resultat = r.resultat ?? resultat;
      if (["termine", "echec", "annule"].includes(t.statut) || t.parametres?.pause) break;
    }
    await ranger(t);
    return t;
  };
  const etat = async (): Promise<EtatTutoriel> => (await travail()).parametres!.tutoriel as EtatTutoriel;
  const equipe = async (): Promise<EtatEquipe> => (await etat()).equipe!;
  const pause = async (): Promise<string | undefined> => ((await travail()).parametres?.pause as { code?: string } | undefined)?.code;
  const ecrireEquipe = async (e: EtatEquipe) => {
    const t = await travail();
    await ranger({ ...t, parametres: { ...t.parametres, tutoriel: { ...(t.parametres!.tutoriel as EtatTutoriel), equipe: e } } });
  };

  const deposes = new Map<string, { fichier: Fichier; json?: unknown }>();
  const ecran: DependancesPiece = {
    reglage: lire,
    session: async () => ({}),
    fichiers: async (ids) => (ids as string[]).map((id) => deposes.get(id)!.fichier),
    lireJson: async (f) => deposes.get(f.id)!.json,
    urls: async (ids) => Object.fromEntries(ids.map((i) => [i, `https://stockage.test/${i}`])),
    maintenant: () => T_ISO,
  };

  /* ---- Poste de capture (V2-04, vrai `ecrireMaquette`) : le capteur est un double qui pose l'image fixe, aucun navigateur ---- */
  const poste = async (plus: { attendue?: string; apercu?: boolean } = {}): Promise<{ code: number; sortie: string; fichiers: Record<string, string> }> => {
    const p = (await equipe()).pieceCreee!;
    const racine = mkdtempSync(join(tmpdir(), "essai-phrase-"));
    dossiersTemporaires.push(racine);
    const description = join(racine, "description.json");
    writeFileSync(description, JSON.stringify(p.contenu));
    const sortie = join(racine, "sortie");
    const dep: DependancesEcriture = {
      env: { CI: "true" },
      plateforme: "linux",
      racineDepot: process.cwd(),
      journal: () => undefined,
      lancerCapteur: (argv: readonly string[]) => {
        const valeur = (nom: string) => argv[argv.indexOf(nom) + 1]!;
        const scenario = JSON.parse(readFileSync(valeur("--scenario"), "utf8")) as { etapes: { id: string }[] };
        mkdirSync(valeur("--sortie"), { recursive: true });
        scenario.etapes.forEach((e, i) => writeFileSync(join(valeur("--sortie"), `${String(i + 1).padStart(2, "0")}-${e.id}.png`), IMAGE_APERCU_FIXE));
        return { status: 0 };
      },
    };
    const code = ecrireMaquette(["--description", description, "--sortie", sortie, ...(plus.apercu === false ? [] : ["--apercu"]), ...(plus.attendue ? ["--attendue", plus.attendue] : [])], dep) as number;
    const fichiers: Record<string, string> = {};
    if (code === CODE_OK) for (const nom of NOMS_FICHIERS) fichiers[nom] = readFileSync(join(sortie, "maquette", nom), "utf8");
    return { code, sortie, fichiers };
  };
  /** Le test dépose l'aperçu fabriqué par le poste : `apercu-piece.json` et ses images (vrai `enregistrerApercu`). */
  const deposerApercu = async (sortie: string) => {
    const json = JSON.parse(readFileSync(join(sortie, NOM_FICHIER_APERCU), "utf8")) as { images: { cle: string }[] };
    const fichier = (id: string, nom: string): Fichier => ({ id, nom, mime: nom.endsWith(".json") ? "application/json" : "image/png", taille: 10, origine: "depot", statut: "pret", cleStockage: `studio/test/entree/${VIDEO}/${id}`, creeLe: T_ISO, modifieLe: T_ISO }) as unknown as Fichier;
    const lot = `${deposes.size}`;
    deposes.set(`f-json-${lot}`, { fichier: fichier(`f-json-${lot}`, NOM_FICHIER_APERCU), json });
    json.images.forEach((im, i) => deposes.set(`f-img-${lot}-${i}`, { fichier: fichier(`f-img-${lot}-${i}`, basename(im.cle)) }));
    return enregistrerApercu(VIDEO, [...deposes.keys()].filter((k) => k.endsWith(`-${lot}`) || k.includes(`-${lot}-`)), ecran);
  };

  return {
    depot,
    journal,
    textesVoix,
    appels,
    mener,
    moteur,
    travail,
    ranger,
    etat,
    equipe,
    pause,
    ecrireEquipe,
    ecran,
    poste,
    deposerApercu,
    resultat: () => resultat,
    deposerFilm: (n: unknown) => void (navigation = n),
    choisirTextesDuPlan: (t: [string, string]) => void (textesPlan = t),
  };
}

type Monde = Awaited<ReturnType<typeof monde>>;
const compos = (j: Journal) => j.rendus.filter((d) => d.operation === "composition");
const roles = (m: Monde) => m.appels.map((a) => a.role);
const unMot = (s: string) => s.replace(/\s+/g, " ").trim();

/** Textes visibles du plan de scènes passé au rendu (les seuls champs de texte des pièces du double du plan). */
function textesDuPlan(v: unknown, cle = "", sortie: string[] = []): string[] {
  if (typeof v === "string") {
    if (["titre", "onglets", "texte", "sousTexte"].includes(cle) && v.trim() !== "") sortie.push(v);
  } else if (Array.isArray(v)) for (const x of v) textesDuPlan(x, cle, sortie);
  else if (typeof v === "object" && v !== null) for (const [k, x] of Object.entries(v)) textesDuPlan(x, k, sortie);
  return sortie;
}

/** Du script validé jusqu'à la vidéo finie : choix de la version A, validation (registre figé), voix, film déposé, plan, montage. */
async function duScriptALaVideo(m: Monde, avantLeFilm?: () => Promise<void>) {
  expect(await choisirVersion(VIDEO, "A")).toMatchObject({ statut: "ok" });
  expect(await validerTutoriel(VIDEO)).toMatchObject({ statut: "ok" });
  const registre = (await m.equipe()).registre!;
  if (!registre.fige) maillon("validation du script", "le registre des textes n'est pas figé après « Valider »");
  // Le double du plan n'écrit à l'écran que deux textes de la maquette gardée, pris dans le registre figé.
  const deMaquette = registre.entrees.filter((x) => x.ou === "maquette" && x.choisi).map((x) => x.texte);
  m.choisirTextesDuPlan([deMaquette[0]!, deMaquette[1]!]);

  const attente = await m.mener();
  if (await m.pause() !== "TO_FILM_A_CAPTURER") maillon("voix puis film", `pause « ${await m.pause()} » / statut « ${attente.statut} » au lieu de TO_FILM_A_CAPTURER (${attente.erreur?.messagePourWill ?? "sans erreur"})`);
  expect(attente.erreur).toBeUndefined();
  expect(m.journal.voix).toHaveLength(1);
  expect(compos(m.journal)).toHaveLength(0);
  await avantLeFilm?.();

  const e = await m.equipe();
  const audio = (await m.etat()).audio!;
  m.deposerFilm(navigationFixe(e.carte!.maquette, e.parcours!.scenario.etapes.map((x) => x.id), Math.round(audio.dureeSec * 1000)));
  const fin = await m.mener();
  if (fin.statut !== "termine") maillon("film, plan ou montage", `statut « ${fin.statut} », pause « ${await m.pause()} » (${fin.erreur?.messagePourWill ?? "sans erreur"})`);
  return { registre, fin };
}

beforeEach(() => {
  reinitialiserDepots();
  appelsReseau = 0;
  vi.stubGlobal("fetch", () => {
    appelsReseau++;
    throw new Error("fetch interdit : l'essai « phrase » est à 0 €");
  });
});
afterEach(() => {
  // Aucun réseau : un seul appel à `fetch`, même rattrapé par la production, fait échouer le test.
  expect(appelsReseau, "appels réseau pendant l'essai").toBe(0);
});
afterAll(() => {
  for (const d of dossiersTemporaires) rmSync(d, { recursive: true, force: true });
});

/* ------------------------------------------------------------------ */
/* 1. Atelier (cas 2)                                                   */
/* ------------------------------------------------------------------ */

describe("V2-10 · « un tableau de bord pour un atelier » (cas 2), de la phrase à la vidéo finie, à 0 €", () => {
  it("chef de projet → maquettiste (double) → contrôles → constructeur vivant → charte → aperçu → maquette gardée → équipe → script validé → voix → film → plan → montage", async () => {
    const m = await monde(PHRASE_ATELIER);
    if (m.depot.statut !== "lancee") maillon("dépôt du formulaire", m.depot.phrase);

    /* ---- Chef de projet (règles, 0 €) puis UN appel du maquettiste, sous le plafond « phrase » ---- */
    await m.mener();
    if (await m.pause() !== CODE_PIECE_A_CONSTRUIRE) maillon("pas-piece-creee", `pause « ${await m.pause()} » au lieu de ${CODE_PIECE_A_CONSTRUIRE} (${JSON.stringify((await m.equipe()).pieceCreee?.erreurs ?? (await m.equipe()).remarques ?? [])})`);
    expect(m.appels).toEqual([{ role: "maquettiste", etape: ETAPE_PIECE_TUTORIEL, plafond: plafondTutorielPhraseUsd(), proposition: 1 }]);
    let e = await m.equipe();
    expect(e.cahier).toMatchObject({ entree: "C", cas: 2, manques: ["maquette"] });
    expect(e.pieceCreee).toMatchObject({ genre: "maquette", proposition: 1, statut: "a-construire" });
    // Rien n'est choisi tant que la maquette n'est pas gardée : ni registre, ni carte, ni texte.
    expect([e.registre, e.carte, e.textesMaquette]).toEqual([undefined, undefined, undefined]);
    expect([m.journal.voix.length, m.journal.rendus.length]).toEqual([0, 0]);

    /* ---- Poste : constructeur vivant, contrôle de la charte, aperçu (capteur double) ---- */
    const proposee = await m.poste();
    if (proposee.code !== CODE_OK) maillon("poste (constructeur ou charte)", `code ${proposee.code} : ${readFileSync(join(proposee.sortie, "rapport.json"), "utf8")}`);
    const css = proposee.fichiers["styles.css"]!;
    const couleurs = [...new Set((`${css}\n${proposee.fichiers["index.html"]}`.match(/#[0-9a-f]{6}\b|#[0-9a-f]{3}\b/gi) ?? []).map((c) => c.toLowerCase()))];
    const polices = [...new Set([...css.matchAll(/font-family\s*:\s*([^;}]+)/gi)].map((x) => x[1]!.trim()).filter((p) => !p.startsWith("var(") && p !== "inherit"))];
    expect(couleurs.length).toBeGreaterThan(0);
    expect(polices.some((p) => /Manrope/i.test(p))).toBe(true);
    expect(proposee.fichiers["index.html"]).toContain(MENTION_ECRAN);

    /* ---- Aperçu déposé par le test : la maquette attend le choix de Williams ---- */
    const depose = await m.deposerApercu(proposee.sortie);
    if (!depose.ok) maillon("écran « Votre maquette » (dépôt de l'aperçu)", depose.message);
    await m.mener();
    expect(await m.pause()).toBe(CODE_PIECE_A_VALIDER);
    expect([m.journal.voix.length, m.journal.rendus.length]).toEqual([0, 0]);

    /* ---- Le double de Williams voit CHAQUE texte, mot pour mot, puis garde ---- */
    const vue = await vuePieceCreee(VIDEO, m.ecran);
    if (!vue) maillon("écran « Votre maquette » (vue)", "rien à voir alors que l'aperçu est déposé");
    const description = e.pieceCreee!.contenu as DescriptionMaquette;
    expect(vue.textes.map((t) => t.textes)).toEqual(textesDeLaMaquette(description).map((t) => t.textes));
    expect(vue.phrase).toBe(PHRASE_ATELIER);
    expect(vue.defauts).toEqual([]);
    expect(vue.chiffres.map((c) => c.valeur)).toEqual(expect.arrayContaining([CHIFFRE_AVANT, CHIFFRE_MAINTENANT]));
    expect(vue.apercu.length).toBeGreaterThan(0);
    const garde = await garderPiece(VIDEO, { empreinte: vue.empreinte }, m.ecran);
    expect(garde).toMatchObject({ ok: true, statut: "gardee" });
    expect(m.appels).toHaveLength(1);

    /* ---- Carte et données déduites sans Claude, stratège et scénariste (doubles), contrôleur, registre ---- */
    await m.mener();
    e = await m.equipe();
    if (await m.pause() !== "TO_SCRIPT_A_VALIDER") maillon("équipe après la maquette gardée", `pause « ${await m.pause()} » (${JSON.stringify(e.remarques ?? e.pieceCreee?.erreurs ?? [])})`);
    expect(roles(m)).toEqual(["maquettiste", "stratege", "scenariste"]);
    expect(roles(m)).not.toContain("analyste");
    expect(m.appels.every((a) => a.plafond === plafondTutorielPhraseUsd())).toBe(true);
    expect(e.carte!.zones.map((z) => z.id)).toEqual(["commandes", "retards", "semaine"]);
    expect(e.verdict?.controles.filter((c) => c.etat !== "reussi")).toEqual([]);
    const empreinteGardee = e.pieceCreee!.gardee!.empreinte;
    expect(empreinteGardee).toBe(empreinteDescription(description));
    // Aucune voix ni rendu avant « maquette gardée » ET « script validé ».
    expect([m.journal.voix.length, m.journal.rendus.length]).toEqual([0, 0]);
    // Chaque texte de la maquette est au registre, origine « maquette créée », choisi (parce que gardée).
    const maquetteAuRegistre = e.registre!.entrees.filter((x) => x.ou === "maquette");
    expect(maquetteAuRegistre.map((x) => x.texte)).toEqual(textesDeLaMaquette(description).flatMap((t) => t.textes));
    expect(maquetteAuRegistre.every((x) => x.origine === "maquette-creee" && x.choisi === true)).toBe(true);

    /* ---- Script choisi et validé par le double de Williams, voix (double), film de la maquette GARDÉE, plan, montage ---- */
    const { registre, fin } = await duScriptALaVideo(m, async () => {
      // Le film est demandé au poste avec « --attendue » = l'empreinte gardée, lue dans l'état de la vidéo.
      const pourLeFilm = (await m.equipe()).pieceCreee!;
      expect(pourLeFilm.statut).toBe("gardee");
      const film = await m.poste({ attendue: pourLeFilm.gardee!.empreinte, apercu: false });
      expect(film.code).toBe(CODE_OK);
      expect(film.fichiers).toEqual(proposee.fichiers);
      expect((await m.poste({ attendue: "une-autre-empreinte", apercu: false })).code).toBe(CODE_EMPREINTE);
    });
    expect(fin.erreur).toBeUndefined();
    const resultat = m.resultat()!;
    expect(resultat.sorties.map((s) => s.ratio)).toEqual(["4:5"]);
    expect(compos(m.journal)).toHaveLength(1);
    expect(compos(m.journal)[0]!.entrees).toHaveProperty("filmNavigation");
    expect(resultat.lignesReelles.every((l) => l.total.centimes === 0)).toBe(true);
    // Les appels payants (doubles) : 1 maquettiste, 1 stratège, 1 scénariste ; le plan de scènes est le seul appel hors équipe.
    expect(roles(m)).toEqual(["maquettiste", "stratege", "scenariste"]);
    expect(m.journal.claude).toHaveLength(1);

    /* ---- Registre figé : la voix est le script choisi, mot pour mot ; aucun texte d'écran hors registre ---- */
    e = await m.equipe();
    const scriptChoisi = e.propositionScripts!.versions[0].phrases.map((p) => p.texte);
    expect(m.textesVoix.map(unMot)).toEqual([unMot(scriptChoisi.join(" "))]);
    expect(registre.entrees.filter((x) => x.ou === "voix").map((x) => x.texte)).toEqual(scriptChoisi);
    expect(registre.entrees.every((x) => x.choisi)).toBe(true);
    const plan = (compos(m.journal)[0]!.parametres.proprietes as { plan: PlanValide }).plan;
    const dureeSec = plan.dureeMs / 1000;
    expect(dureeSec).toBeGreaterThanOrEqual(DUREE_CIBLE_SEC[0]);
    expect(dureeSec).toBeLessThanOrEqual(DUREE_CIBLE_SEC[1]);
    const ecranRendu = [...textesDuPlan(plan.scenes), ...textesDeLaMaquette(description).flatMap((t) => t.textes)].map((texte) => ({ texte, ou: "maquette" as const }));
    expect(textesDuPlan(plan.scenes).length).toBeGreaterThan(0);
    expect(verifierRendu(registre, { voix: m.textesVoix[0]!, sousTitres: [], ecran: ecranRendu })).toMatchObject({ id: "TUT-REGISTRE", ok: true });
    // Le contrôle mord : une phrase ajoutée à la voix, ou un texte d'écran jamais choisi, le fait échouer.
    expect(verifierRendu(registre, { voix: `${m.textesVoix[0]} Essayez dès aujourd'hui.`, sousTitres: [], ecran: ecranRendu }).ok).toBe(false);
    expect(verifierRendu(registre, { voix: m.textesVoix[0]!, sousTitres: [], ecran: [...ecranRendu, { texte: "Texte jamais choisi", ou: "maquette" }] }).ok).toBe(false);

    /* ---- Marque (23) : étiquettes, montants, vouvoiement, couleurs, police, noms neutres, mention « exemple » ---- */
    const textes = [...scriptChoisi.map((texte) => ({ texte, origine: "voix" as const })), ...ecranRendu.map((x) => ({ texte: x.texte, origine: "maquette" as const }))];
    const marque = controlerMarque({ textes, couleurs, polices, noms: [description.nom, description.entreprise], chiffresAffiches: true, mentionExemple: proposee.fichiers["index.html"]!.includes(MENTION_ECRAN) });
    expect(marque.filter((c) => c.etat !== "reussi")).toEqual([]);
    for (const { texte } of textes) {
      expect(etiquettesInterdites(texte), texte).toEqual([]);
      expect(montantsArgent(texte), texte).toEqual([]);
      expect(tutoiement(texte), texte).toBe(false);
    }
    expect(scriptChoisi.some((p) => /\b(vous|votre|vos)\b/i.test(p))).toBe(true);
    expect(nomsNonNeutres([description.nom, description.entreprise])).toEqual([]);

    /* ---- Chiffres (G4-03 sur le tableau déduit) : tout chiffre dit est à l'écran ---- */
    const donnees = e.donnees!;
    expect(donnees.indicateurs.map((i) => i.valeur)).toEqual(expect.arrayContaining([CHIFFRE_AVANT, CHIFFRE_MAINTENANT]));
    const textesEcran = ecranRendu.map((x) => x.texte);
    expect(garderChiffres(donnees, { textesEcran, texteDit: m.textesVoix[0]! }).horsDonnee).toEqual([]);
    expect(garderChiffres(donnees, { textesEcran, texteDit: PHRASE_CHIFFREE }).horsDonnee).toEqual([]);
    expect(garderChiffres(donnees, { textesEcran, texteDit: "Vos commandes à préparer passent à 99." }).horsDonnee.length).toBeGreaterThan(0);
  });
});

/* ------------------------------------------------------------------ */
/* 2. Tri d'e-mails (cas 3)                                             */
/* ------------------------------------------------------------------ */

describe("V2-10 · « je veux un tri d'e-mails » (cas 3), le même chemin avec un flux, à 0 €", () => {
  it("gabarit G-Flux, courriels d'exemple, une étape humaine, aucun chiffre ; de la phrase à la vidéo finie", async () => {
    const m = await monde(PHRASE_TRI);
    if (m.depot.statut !== "lancee") maillon("dépôt du formulaire", m.depot.phrase);

    await m.mener();
    let e = await m.equipe();
    if (await m.pause() !== CODE_PIECE_A_CONSTRUIRE) maillon("pas-piece-creee (flux)", `pause « ${await m.pause()} » (${JSON.stringify(e.pieceCreee?.erreurs ?? e.remarques ?? [])})`);
    expect(m.appels).toEqual([{ role: "maquettiste", etape: ETAPE_PIECE_TUTORIEL, plafond: plafondTutorielPhraseUsd(), proposition: 1 }]);
    expect(e.cahier).toMatchObject({ entree: "C", cas: 3, gabarits: ["G-Flux"], manques: ["flux-automatisation"] });
    expect(e.pieceCreee).toMatchObject({ genre: "flux", statut: "a-construire" });
    expect([m.journal.voix.length, m.journal.rendus.length]).toEqual([0, 0]);

    /* ---- Le flux proposé : contrôles des textes créés (V2-06), courriels, étape humaine, aucun chiffre ---- */
    const flux = e.pieceCreee!.contenu as FluxAutomatisation;
    expect(controlerFluxCree(flux)).toEqual([]);
    expect(DOMAINE_EXEMPLE).toBe(DOMAINE_COURRIEL_EXEMPLE);
    const courriels = JSON.stringify(flux).match(/[^\s@<>"'(),;:]+@[^\s@<>"'(),;]+/g) ?? [];
    expect(courriels.length).toBeGreaterThan(0);
    expect(courriels.every((c) => c.endsWith(DOMAINE_COURRIEL_EXEMPLE))).toBe(true);
    expect(flux.etapes.filter((x) => x.acteur === "humain")).toHaveLength(1);
    const vus = textesDuFlux(flux);
    expect(vus.flatMap((t) => t.textes).filter((t) => /\p{Nd}/u.test(t))).toEqual([]);

    /* ---- Écran « Votre maquette » (V2-09b) : l'aperçu est déposé, Williams voit le flux et chaque texte, puis le garde ---- */
    // Le vrai poste (`ecrire-maquette.mts`, capteur doublé) fabrique l'aperçu du flux ; le test le dépose.
    const posteFlux = await m.poste();
    expect(posteFlux.code).toBe(CODE_OK);
    const depose = await m.deposerApercu(posteFlux.sortie);
    if (!depose.ok) maillon("écran « Votre maquette » (dépôt de l'aperçu du flux)", depose.message);
    await m.mener();
    expect(await m.pause()).toBe(CODE_PIECE_A_VALIDER);
    expect([m.journal.voix.length, m.journal.rendus.length]).toEqual([0, 0]);
    const vue = await vuePieceCreee(VIDEO, m.ecran);
    if (!vue) maillon("écran « Votre maquette » (vue du flux)", "rien à voir alors que l'aperçu du flux est déposé");
    expect(vue).toMatchObject({ genre: "flux", cas: "automatisation", defauts: [], chiffres: [] });
    expect(vue.etapes.filter((x) => x.nature === "etape").map((x) => x.id)).toEqual(flux.etapes.map((x) => x.id));
    expect(vue.textes.map((t) => t.textes)).toEqual(vus.map((t) => t.textes));
    const garde = await garderPiece(VIDEO, { empreinte: vue.empreinte }, m.ecran);
    expect(garde).toMatchObject({ ok: true, statut: "gardee" });
    expect(m.appels).toHaveLength(1);

    await m.mener();
    e = await m.equipe();
    if (await m.pause() !== "TO_SCRIPT_A_VALIDER") maillon("équipe après le flux gardé", `pause « ${await m.pause()} » (${JSON.stringify(e.remarques ?? e.pieceCreee?.erreurs ?? [])})`);
    expect(roles(m)).toEqual(["maquettiste", "stratege", "scenariste"]);
    expect(e.cahier).toMatchObject({ cas: 3, gabarits: ["G-Flux"] });
    expect(e.parcours?.gabarits).toEqual(["G-Flux"]);
    expect(e.carte!.zones.map((z) => z.id)).toEqual(flux.etapes.map((x) => x.id));
    expect(e.donnees).toBeUndefined(); // un flux ne montre aucun chiffre
    expect(e.verdict?.controles.filter((c) => c.etat !== "reussi")).toEqual([]);
    const auRegistre = e.registre!.entrees.filter((x) => x.ou === "maquette");
    expect(auRegistre.map((x) => x.texte)).toEqual(vus.flatMap((t) => t.textes));
    expect(auRegistre.every((x) => x.origine === "maquette-creee" && x.choisi === true)).toBe(true);
    expect([m.journal.voix.length, m.journal.rendus.length]).toEqual([0, 0]);

    const { registre, fin } = await duScriptALaVideo(m);
    expect(fin.erreur).toBeUndefined();
    expect(m.resultat()!.sorties.map((s) => s.ratio)).toEqual(["4:5"]);
    expect(roles(m)).toEqual(["maquettiste", "stratege", "scenariste"]);
    // Aucun chiffre dit, aucun montant, vouvoiement ; la voix est le script choisi, mot pour mot.
    e = await m.equipe();
    const scriptChoisi = e.propositionScripts!.versions[0].phrases.map((x) => x.texte);
    expect(m.textesVoix.map(unMot)).toEqual([unMot(scriptChoisi.join(" "))]);
    expect(/\p{Nd}/u.test(m.textesVoix[0]!)).toBe(false);
    const plan = (compos(m.journal)[0]!.parametres.proprietes as { plan: PlanValide }).plan;
    const ecranRendu = [...textesDuPlan(plan.scenes), ...vus.flatMap((t) => t.textes)].map((texte) => ({ texte, ou: "maquette" as const }));
    expect(verifierRendu(registre, { voix: m.textesVoix[0]!, sousTitres: [], ecran: ecranRendu })).toMatchObject({ ok: true });
    for (const texte of [...scriptChoisi, ...ecranRendu.map((x) => x.texte)]) {
      expect(etiquettesInterdites(texte), texte).toEqual([]);
      expect(montantsArgent(texte), texte).toEqual([]);
      expect(tutoiement(texte), texte).toBe(false);
    }
  });
});

/* ------------------------------------------------------------------ */
/* 3. Refus attendus                                                    */
/* ------------------------------------------------------------------ */

describe("V2-10 · refus attendus (un cas chacun), toujours à 0 €", () => {
  it("réglages éteints : le formulaire refuse, ou la chaîne s'arrête sur TO_CAS_V2 ; 0 appel, 0 voix", async () => {
    // Rien d'allumé, ou la phrase fermée : le dépôt lui-même refuse, rien n'est créé.
    const ferme = await monde(PHRASE_ATELIER, { reglages: {} });
    expect(ferme.depot).toEqual({ statut: "refusee", phrase: PHRASE_TUTORIEL_FERME });
    const sansPhrase = await monde(PHRASE_ATELIER, { reglages: sans(PARAM_ENTREE_PHRASE) });
    expect(sansPhrase.depot).toEqual({ statut: "refusee", phrase: PHRASE_PHRASE_FERMEE });
    expect([ferme.appels.length, sansPhrase.appels.length]).toEqual([0, 0]);

    // La création par Claude éteinte (absente, ou autre chose que `true` exact) : TO_CAS_V2, sans échec, sans appel.
    for (const reglages of [sans(PARAM_PIECE_CLAUDE), { ...TOUT_ALLUME, [PARAM_PIECE_CLAUDE]: "true" }, { ...TOUT_ALLUME, [PARAM_PIECE_CLAUDE]: 1 }]) {
      reinitialiserDepots();
      const m = await monde(PHRASE_ATELIER, { reglages });
      expect(m.depot.statut).toBe("lancee");
      const t = await m.mener();
      expect(await m.pause()).toBe("TO_CAS_V2");
      expect(t.statut).toBe("en_file");
      expect(t.erreur).toBeUndefined();
      expect([m.appels.length, m.journal.voix.length, m.journal.claude.length, m.journal.rendus.length]).toEqual([0, 0, 0, 0]);
      expect((await m.equipe()).pieceCreee).toBeUndefined();
    }

    // L'équipe ou Claude éteints : aucune pièce n'est proposée, aucun appel.
    for (const cle of [PARAM_EQUIPE_TUTORIEL, PARAM_CLAUDE_TUTORIEL]) {
      reinitialiserDepots();
      const m = await monde(PHRASE_ATELIER, { reglages: sans(cle) });
      const t = await m.mener();
      expect(t.statut).toBe("en_file");
      expect(await m.pause()).toMatch(/^TO_/);
      expect([m.appels.length, m.journal.voix.length, m.journal.claude.length, m.journal.rendus.length]).toEqual([0, 0, 0, 0]);
    }
  });

  it("maquette proposée avec un nom réel (« Dupont Menuiserie ») : TO_PIECE_A_REVOIR, rien n'est construit, 0 voix", async () => {
    const m = await monde(PHRASE_ATELIER, { propositions: { 1: descriptionAvecNomReel } });
    const t = await m.mener();
    expect(await m.pause()).toBe(CODE_PIECE_A_REVOIR);
    expect(t.statut).toBe("en_file");
    expect(t.erreur).toBeUndefined();
    const e = await m.equipe();
    expect(e.pieceCreee).toMatchObject({ statut: "a-revoir" });
    expect(e.pieceCreee!.erreurs!.join(" ")).toContain(NOM_REEL.split(" ")[1]);
    // Aucune reprise automatique : rejouer la pause ne rappelle personne ; rien n'entre au registre, rien n'est dit.
    await m.mener();
    expect(await m.pause()).toBe(CODE_PIECE_A_REVOIR);
    expect(roles(m)).toEqual(["maquettiste"]);
    expect([e.registre, e.carte, e.textesMaquette]).toEqual([undefined, undefined, undefined]);
    expect([m.journal.voix.length, m.journal.rendus.length]).toEqual([0, 0]);
    // Et la garde ne passe pas : le texte fautif ne peut pas être « gardé » par l'écran.
    expect(await garderPiece(VIDEO, { empreinte: e.pieceCreee!.empreinte }, m.ecran)).toMatchObject({ ok: false });
  });

  it("« une autre proposition » demandée deux fois : la seconde est refusée, 2 appels du maquettiste au plus", async () => {
    const m = await monde(PHRASE_ATELIER);
    await m.mener();
    expect(await autreProposition(VIDEO, m.ecran)).toMatchObject({ ok: true });
    await m.mener();
    const seconde = await autreProposition(VIDEO, m.ecran);
    expect(seconde.ok).toBe(false);
    expect(seconde.message).toContain("Vous avez déjà demandé une autre proposition");
    await m.mener();
    await m.mener();
    expect(roles(m).filter((r) => r === "maquettiste").length).toBeLessThanOrEqual(2);
    expect(roles(m).every((r) => r === "maquettiste")).toBe(true);
    expect([m.journal.voix.length, m.journal.rendus.length]).toEqual([0, 0]);
  });

  it("« Réessayer » après une panne du rendu : toujours 1 appel du maquettiste, la voix n'est pas relue", async () => {
    const m = await monde(PHRASE_ATELIER, { renduEchecs: 50 });
    await m.mener();
    const proposee = await m.poste();
    expect((await m.deposerApercu(proposee.sortie)).ok).toBe(true);
    await m.mener();
    expect(await garderPiece(VIDEO, { empreinte: (await m.equipe()).pieceCreee!.empreinte }, m.ecran)).toMatchObject({ ok: true });
    await m.mener();
    expect(await choisirVersion(VIDEO, "A")).toMatchObject({ statut: "ok" });
    expect(await validerTutoriel(VIDEO)).toMatchObject({ statut: "ok" });
    const registre = (await m.equipe()).registre!;
    m.choisirTextesDuPlan([registre.entrees.filter((x) => x.ou === "maquette")[0]!.texte, registre.entrees.filter((x) => x.ou === "maquette")[1]!.texte]);
    await m.mener();
    const e = await m.equipe();
    m.deposerFilm(navigationFixe(e.carte!.maquette, e.parcours!.scenario.etapes.map((x) => x.id), Math.round((await m.etat()).audio!.dureeSec * 1000)));
    const panne = await m.mener();
    if (panne.statut !== "echec") maillon("panne du rendu (double)", `statut « ${panne.statut} » au lieu d'un échec reprenable`);
    expect(panne.erreur?.reessayable).toBe(true);
    const avant = { appels: m.appels.length, voix: m.journal.voix.length, plans: m.journal.claude.length };

    await m.ranger(await m.moteur.reessayer(await m.travail(), T0 + 900_000));
    await m.mener();
    expect(roles(m).filter((r) => r === "maquettiste")).toHaveLength(1);
    expect({ appels: m.appels.length, voix: m.journal.voix.length, plans: m.journal.claude.length }).toEqual(avant);
    expect(roles(m)).toEqual(["maquettiste", "stratege", "scenariste"]);
  });

  it("correction d'un texte : nouvel aperçu exigé, l'ancien aperçu et l'ancienne empreinte sont refusés, le film aussi ; 0 appel de plus", async () => {
    const m = await monde(PHRASE_ATELIER);
    await m.mener();
    const ancienne = (await m.equipe()).pieceCreee!.empreinte;
    const ancienPoste = await m.poste();
    expect((await m.deposerApercu(ancienPoste.sortie)).ok).toBe(true);
    await m.mener();
    expect(await m.pause()).toBe(CODE_PIECE_A_VALIDER);

    // Le texte de Williams fait foi, mot pour mot ; jamais repassé par Claude.
    const corrige = await corrigerTexte(VIDEO, { ecranId: "accueil", avant: TEXTE_AVANT_CORRECTION, apres: TEXTE_CORRIGE }, m.ecran);
    expect(corrige).toMatchObject({ ok: true, statut: "a-construire" });
    const p = (await m.equipe()).pieceCreee!;
    expect(p.empreinte).not.toBe(ancienne);
    expect(p.apercu).toBeUndefined();
    const textes = textesDeLaMaquette(p.contenu as DescriptionMaquette).flatMap((t) => t.textes);
    expect(textes).toContain(TEXTE_CORRIGE);
    expect(textes).not.toContain(TEXTE_AVANT_CORRECTION);

    // Un nouvel aperçu est exigé : la chaîne attend le poste, l'ancien aperçu et l'ancienne empreinte ne passent plus.
    await m.mener();
    expect(await m.pause()).toBe(CODE_PIECE_A_CONSTRUIRE);
    const vieuxDepot = await m.deposerApercu(ancienPoste.sortie);
    expect(vieuxDepot.ok).toBe(false);
    expect(vieuxDepot.message).toContain("Cet aperçu ne correspond pas à la maquette proposée");
    expect((await garderPiece(VIDEO, { empreinte: ancienne }, m.ecran)).ok).toBe(false);
    // Le film (poste) est refusé avec l'ancienne empreinte, accepté avec la nouvelle.
    expect((await m.poste({ attendue: ancienne, apercu: false })).code).toBe(CODE_EMPREINTE);
    const neuf = await m.poste({ attendue: p.empreinte });
    expect(neuf.code).toBe(CODE_OK);
    expect(neuf.fichiers["index.html"]).toContain(TEXTE_CORRIGE);
    expect((await m.deposerApercu(neuf.sortie)).ok).toBe(true);
    await m.mener();
    expect(await m.pause()).toBe(CODE_PIECE_A_VALIDER);
    expect(roles(m)).toEqual(["maquettiste"]);
    expect([m.journal.voix.length, m.journal.rendus.length]).toEqual([0, 0]);
  });

  it("« un assistant pour mes clients » (cas 4, hors V2) : TO_CAS_V2, la demande est gardée, 0 appel", async () => {
    const m = await monde(PHRASE_ASSISTANT);
    expect(m.depot.statut).toBe("lancee");
    const t = await m.mener();
    expect(await m.pause()).toBe("TO_CAS_V2");
    expect(t.statut).toBe("en_file");
    expect(t.erreur).toBeUndefined();
    expect((await m.equipe()).decision).toMatchObject({ cas: 4 });
    expect([m.appels.length, m.journal.voix.length, m.journal.claude.length, m.journal.rendus.length]).toEqual([0, 0, 0, 0]);
  });
});

/* ------------------------------------------------------------------ */
/* 4. Maillons : ce que l'essai révèle sur master (ROUGES tant que la production n'est pas corrigée) */
/* ------------------------------------------------------------------ */

describe("V2-10 · maillons de la chaîne réelle, sans pont (rouge = raccord à faire en production)", () => {
  it("maillon chaîne : réglages allumés, la chaîne de master (sans pont) appelle le maquettiste pour une phrase", async () => {
    const m = await monde(PHRASE_ATELIER);
    await m.mener();
    const code = await m.pause();
    if (code !== CODE_PIECE_A_CONSTRUIRE || m.appels.length !== 1) {
      maillon("pas-piece-creee", `la chaîne s'arrête sur « ${code} » avec ${m.appels.length} appel(s) : \`chaine.ts\` appelle \`prochainPas\` sans l'option \`phraseOuverte\` et \`tutoriel-branchements.ts\` fournit \`portsEquipe\` au lieu de \`portsEquipeAvecPhrase\``);
    }
  });

  it("maillon écran : l'écran « Votre maquette » (dépôt par défaut) voit la pièce que l'équipe vient de proposer", async () => {
    const m = await monde(PHRASE_ATELIER);
    await m.mener();
    expect((await m.equipe()).pieceCreee).toMatchObject({ statut: "a-construire" });
    const vue = await vuePieceCreee(VIDEO, m.ecran);
    if (!vue) maillon("écran « Votre maquette »", "`tutoriel-piece-creee.ts` lit `parametres.pieceCreee` (forme d'avant V2-08) alors que l'équipe range la pièce dans `parametres.tutoriel.equipe.pieceCreee` : la page ne montre rien, aucun geste n'agit");
    expect(vue.empreinte).toBe((await m.equipe()).pieceCreee!.empreinte);
  });

  it("maillon autre proposition : après « En proposer une autre », le maquettiste est rappelé une fois, pour la proposition 2", async () => {
    const m = await monde(PHRASE_ATELIER);
    await m.mener();
    expect(await autreProposition(VIDEO, m.ecran)).toMatchObject({ ok: true });
    await m.mener();
    const maquettiste = m.appels.filter((a) => a.role === "maquettiste");
    if (maquettiste.length !== 2 || maquettiste[1]!.proposition !== 2) {
      maillon("autre proposition", `${maquettiste.length} appel(s) du maquettiste, pause « ${await m.pause()} » : l'orchestre ne demande une pièce que s'il n'y en a aucune, et toujours avec la proposition 1 (\`contextePiece(e, 1)\`) ; la demande de l'écran (proposition 2, « à construire ») ne déclenche aucun second appel`);
    }
    expect(maquettiste.every((a) => a.plafond === plafondTutorielPhraseUsd())).toBe(true);
  });

  it("maillon maquettiste (flux) : le rôle sait rendre un flux pour le cas 3 (son schéma de sortie l'accepte)", () => {
    const sortie = { manque: "flux-automatisation", contenu: fluxTri() };
    const lu = roleMaquettiste.schema.safeParse(sortie);
    if (!lu.success) maillon("maquettiste (flux)", "le schéma de sortie du rôle refuse le manque « flux-automatisation » (absent de `MANQUES_MAQUETTISTE`, et la consigne ne décrit pas le flux) : avec le vrai Claude, la réponse du cas 3 est refusée après avoir été payée");
  });

  it("maillon poste et écran (flux) : un flux proposé peut être construit sur le poste et gardé sur l'écran", async () => {
    const m = await monde(PHRASE_TRI);
    await m.mener();
    const p = (await m.equipe()).pieceCreee!;
    expect(p).toMatchObject({ genre: "flux", statut: "a-construire" });
    const poste = await m.poste();
    if (poste.code !== CODE_OK) maillon("poste et écran (flux)", `\`ecrire-maquette.mts\` rend le code ${poste.code}${poste.code === CODE_REFUSE ? " (refusé)" : ""} pour un flux : il ne lit que « description-maquette.v1 » ; l'écran « Votre maquette » aussi (\`lireDescriptionMaquette\`). Aucun aperçu, aucun « Garder » possible pour le cas 3`);
  });

  it("maillon chiffres : le scénariste peut dire un chiffre d'exemple de la maquette gardée (il est à l'écran et dans les données)", async () => {
    const m = await monde(PHRASE_ATELIER, { scriptChiffre: true });
    await m.mener();
    const proposee = await m.poste();
    expect((await m.deposerApercu(proposee.sortie)).ok).toBe(true);
    await m.mener();
    expect(await garderPiece(VIDEO, { empreinte: (await m.equipe()).pieceCreee!.empreinte }, m.ecran)).toMatchObject({ ok: true });
    await m.mener();
    const e = await m.equipe();
    // Les deux chiffres sont bien dans les données déduites (G4) et dans les textes de la maquette gardée.
    expect(garderChiffres(e.donnees!, { textesEcran: (e.textesMaquette ?? []).flatMap((t) => t.textes), texteDit: PHRASE_CHIFFREE }).horsDonnee).toEqual([]);
    if (await m.pause() !== "TO_SCRIPT_A_VALIDER") {
      const lu = lirePropositionScripts(scriptsDuDouble(e.fiche!.moments, PHRASE_CHIFFREE), { cahier: e.cahier!, carte: e.carte!, fiche: e.fiche!, dureeFinSec: 0 });
      maillon("carte déduite et scénariste", `pause « ${await m.pause()} » après ${roles(m).filter((r) => r === "scenariste").length} appel(s) du scénariste : \`carteDepuisDescription\` range dans \`chiffres\` les LIBELLÉS (${JSON.stringify(e.carte!.zones[0]!.chiffres)}) sans aucune valeur, et la garde du scénariste refuse tout nombre absent de la carte (${lu.ok ? "" : lu.erreurs[0]})`);
    }
  });
});

/* ------------------------------------------------------------------ */
/* 5. Pièces fixes de l'essai                                           */
/* ------------------------------------------------------------------ */

describe("V2-10 · pièces fixes (`phrases.ts`) : la marque et les interdits de Williams", () => {
  it("aucun montant, aucune étiquette, vouvoiement, noms neutres, courriels d'exemple", () => {
    const d = lireDescriptionMaquette(descriptionAtelier(), { interdits: [] });
    if (!d.ok) throw new Error(d.erreurs.join(" | "));
    const textes = [...textesDeLaMaquette(d.description).flatMap((t) => t.textes), ...textesDuFlux(fluxTri() as unknown as FluxAutomatisation).flatMap((t) => t.textes), PHRASE_CHIFFREE, TEXTE_CORRIGE];
    for (const versions of [scriptsDuDouble([{ id: "m1", zoneId: "z" }], PHRASE_CHIFFREE)] as { versions: { phrases: { texte: string }[] }[] }[]) textes.push(...versions.versions.flatMap((v) => v.phrases.map((p) => p.texte)));
    for (const texte of textes) {
      expect(montantsArgent(texte), texte).toEqual([]);
      expect(etiquettesInterdites(texte), texte).toEqual([]);
      expect(tutoiement(texte), texte).toBe(false);
      expect(/[€$£]|euros?\b/i.test(texte), texte).toBe(false);
    }
    expect(nomsNonNeutres([d.description.nom, d.description.entreprise])).toEqual([]);
    expect(JSON.stringify(fluxTri())).toContain(DOMAINE_EXEMPLE);
  });
});
