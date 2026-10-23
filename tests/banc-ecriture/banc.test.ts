/**
 * BANC D'ÉCRITURE À L'AVEUGLE (`tests/banc-ecriture/banc-ecriture.ts`). Aucune clé réelle, aucun appel, aucune dépense :
 *  - en simulation, il produit les textes A/B, la feuille de vote, le tableau et une clé COHÉRENTE avec les textes ;
 *  - en `--reel`, il refuse sans clé, sans `--confirmer-prix`, ou avec un prix confirmé sous le maximum, AVANT tout
 *    branchement (rien n'est parti, aucun dossier écrit) ;
 *  - le plafond d'un sujet recopié pour l'estimation est celui du studio ;
 *  - en `--reel`, les deux chaînes lisent le socle de Will (ici un double : fiche, textes, preuves), le prix le compte ;
 *    `--sujets-depuis-idees` prend ses idées réelles, et s'arrête net sans idée. En simulation : données fixes.
 */
import { existsSync, mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { mockHeaders, mockNavigation } from "../helpers/next-mocks";
import { texteVersion, type EtatChaine } from "@/generateur/chaine";
import type { Idee } from "@/domaine/types";
import { executeurSimulation, lancerBanc, lettres, PLAFOND_SUJET_BANC_USD, SOCLE_FIXE, type BranchementsReels, type LecturesReelles, type NomChaine, type SocleBanc } from "./banc-ecriture";
import { PREUVES_FICTIVES } from "../generateur/preuves-fictives";
import { SUJETS_BANC } from "../generateur/banc/registre-banc-g4";

vi.mock("next/headers", () => mockHeaders);
vi.mock("next/navigation", () => mockNavigation);

const SUJETS = "tests/banc-ecriture/sujets-exemple.json";
const CLE_FACTICE = "sk-ant-api03-ESSAI_banc_ecriture_aucun_appel";

function dossierTemp(): string {
  return join(mkdtempSync(join(tmpdir(), "banc-ecriture-")), "sortie");
}

const LE = "2026-10-01T08:00:00.000Z";
const base = { creeLe: LE, modifieLe: LE };

/** Un « vrai » socle de Will (double) : charte, fiche de style validée, textes retenus, preuves. */
const SOCLE_WILL: SocleBanc = {
  ...SOCLE_FIXE,
  origine: "will",
  contexteAxion: { ...SOCLE_FIXE.contexteAxion!, version: 7 },
  ficheStyle: { ...base, id: "fiche-3", version: 3, ouvertures: [], tournures: [], longueurPhraseMediane: 9, ecartTypeLongueurs: 4, expressions: ["on arrête de bricoler"], motsBannis: ["révolutionnaire"], tutoiementObserve: false, notes: "Will parle court, il pose le verdict à la fin.", tireeDe: [], valideeParWillLe: LE },
  exemplesStyle: [{ ...base, id: "ex-1", texte: "Avant, je relançais chaque devis à la main. Maintenant, ça part tout seul.", origine: "video", mots: 13, retenu: true }],
  preuves: [PREUVES_FICTIVES[0]],
};

/** Lectures du mode réel (double, aucune base) : compte les lectures et la portée demandée. */
function lecturesDouble(o: { socle?: SocleBanc; idees?: Idee[] } = {}) {
  const vues = { socle: [] as string[], idees: 0 };
  const lectures = async (): Promise<LecturesReelles> => ({
    socle: async (portee) => (vues.socle.push(portee), o.socle ?? SOCLE_WILL),
    idees: async () => ((vues.idees += 1), o.idees ?? []),
  });
  return { vues, lectures };
}

async function lancer(argv: string[], o: { env?: Record<string, string | undefined>; reels?: () => Promise<BranchementsReels>; lectures?: () => Promise<LecturesReelles> } = {}) {
  const lignes: string[] = [];
  const code = await lancerBanc(argv, { ecrire: (l) => lignes.push(l), env: o.env ?? {}, reels: o.reels, lectures: o.lectures ?? lecturesDouble().lectures, maintenant: () => new Date("2026-10-14T08:00:00.000Z") });
  return { code, lignes, sortie: lignes.join("\n") };
}

/** Un exécutant « réel » (double) qui note le contexte en cache de chaque appel. */
function reelsEspions() {
  const vus: string[] = [];
  const contextes: { contexte: unknown }[] = [];
  const reels = async (): Promise<BranchementsReels> => ({
    plafondSujetUsd: PLAFOND_SUJET_BANC_USD,
    async executeur(code, chaine) {
      vus.push(`${code}:${chaine}`);
      const sim = executeurSimulation();
      return { executer: async (role, entree) => (contextes.push({ contexte: entree.contexte }), { ...(await sim.executer(role, entree)), simule: false, coutUsd: 0.01, modele: role.modele }) as never };
    },
  });
  return { vus, contextes, reels };
}

/** Le prix maximal affiché (en centimes). */
const prixAffiche = (sortie: string) => Number(/--confirmer-prix=(\d+,\d\d)/.exec(sortie)![1].replace(",", ""));

/** Les lignes dites d'un texte (A ou B) d'un fichier de sujet. */
function lignesDuTexte(md: string, lettre: "A" | "B"): string[] {
  const partie = md.split(`## Texte ${lettre}`)[1].split("\n---")[0];
  return partie
    .split("\n")
    .filter((l) => l.startsWith("### "))
    .map((l) => l.slice(4));
}

describe("Banc d'écriture, en simulation (défaut)", () => {
  it("produit 5 sujets A/B, la feuille de vote, le tableau, et une clé cohérente avec les textes", async () => {
    const sortie = dossierTemp();
    const { vues, lectures } = lecturesDouble();
    const r = await lancer(["--sujets", SUJETS, "--sortie", sortie], { lectures });
    expect(r.code, r.sortie).toBe(0);
    // Simulation : des données fixes, le socle de Will n'est jamais lu.
    expect(vues).toEqual({ socle: [], idees: 0 });
    expect(r.sortie).toMatch(/Socle : données FIXES/);
    for (const f of ["LISEZ-MOI.md", "vote.md", "cle.md", "tableau.md", ...[1, 2, 3, 4, 5].map((n) => `sujet-${n}.md`)]) expect(existsSync(join(sortie, f)), f).toBe(true);

    const cle = JSON.parse(/```json\n([\s\S]*?)\n```/.exec(readFileSync(join(sortie, "cle.md"), "utf8"))![1]) as { graine: number; sujets: { n: number; code: string; A: NomChaine; B: NomChaine }[] };
    expect(cle.graine).toBe(2026);
    expect(cle.sujets).toHaveLength(5);
    expect(cle.sujets.map((s) => ({ A: s.A, B: s.B }))).toEqual(lettres(5, 2026));
    for (const s of cle.sujets) expect([s.A, s.B].sort()).toEqual(["courte", "grande"]);

    for (const s of cle.sujets) {
      const md = readFileSync(join(sortie, `sujet-${s.n}.md`), "utf8");
      // Aucun indice sur l'origine des textes dans le fichier lu par Will.
      expect(md).not.toMatch(/chaîne courte|grande chaîne|\d+ appels|\/100|\d,\d\d \$/i);
      for (const lettre of ["A", "B"] as const) {
        const etat = (JSON.parse(readFileSync(join(sortie, "apres-le-vote", `${s.n}-${s.code}-${s[lettre]}.json`), "utf8")) as { etat: EtatChaine }).etat;
        const attendu = texteVersion(etat, etat.versions![0]).split("\n").map((l) => l.trim()).filter(Boolean);
        expect(lignesDuTexte(md, lettre)).toEqual(attendu);
      }
    }

    const vote = readFileSync(join(sortie, "vote.md"), "utf8");
    expect(vote.match(/- \[ \] égal/g)).toHaveLength(5);
    const tableau = readFileSync(join(sortie, "tableau.md"), "utf8");
    expect(tableau).toMatch(/simulation \(aucun appel, 0 \$\)/);
    expect(tableau.match(/\| 3 \| \d+\/100/g)).toHaveLength(5);
    expect(tableau).toMatch(/Prix MAXIMAL estimé/);
  });

  it("même graine, même tirage ; une autre graine peut tirer autrement", () => {
    expect(lettres(5, 7)).toEqual(lettres(5, 7));
    const tirages = new Set([1, 2, 3, 4, 5, 6, 7, 8].map((g) => JSON.stringify(lettres(5, g))));
    expect(tirages.size).toBeGreaterThan(1);
  });

  it("un fichier de sujets invalide est refusé (code 1), sans rien écrire", async () => {
    const sortie = dossierTemp();
    const r = await lancer(["--sujets", "tests/banc-ecriture/inexistant.json", "--sortie", sortie]);
    expect(r.code).toBe(1);
    expect(existsSync(sortie)).toBe(false);
  });
});

describe("Banc d'écriture, --reel : aucun appel sans accord explicite", () => {
  const reelsInterdits = () => {
    const appels = { n: 0 };
    return { appels, reels: async (): Promise<BranchementsReels> => ((appels.n += 1), { plafondSujetUsd: PLAFOND_SUJET_BANC_USD, executeur: async () => executeurSimulation() }) };
  };

  it("sans ANTHROPIC_API_KEY : refus (code 2), rien de branché", async () => {
    const { appels, reels } = reelsInterdits();
    const sortie = dossierTemp();
    const r = await lancer(["--reel", "--confirmer-prix=100", "--sortie", sortie], { reels });
    expect(r.code).toBe(2);
    expect(r.sortie).toMatch(/ANTHROPIC_API_KEY est absente/);
    expect(appels.n).toBe(0);
    expect(existsSync(sortie)).toBe(false);
  });

  it("sans --confirmer-prix : affiche d'abord le prix maximal, puis refuse (code 3), rien de branché", async () => {
    const { appels, reels } = reelsInterdits();
    const sortie = dossierTemp();
    const r = await lancer(["--reel", "--sortie", sortie], { env: { ANTHROPIC_API_KEY: CLE_FACTICE }, reels });
    expect(r.code).toBe(3);
    const iPrix = r.lignes.findIndex((l) => /Prix MAXIMAL estimé du banc réel \(5 sujets/.test(l));
    const iRefus = r.lignes.findIndex((l) => /Rien n'est lancé\. Pour accepter ce prix, relancez avec --confirmer-prix=\d+,\d\d/.test(l));
    expect(iPrix).toBeGreaterThanOrEqual(0);
    expect(iRefus).toBeGreaterThan(iPrix);
    expect(appels.n).toBe(0);
    expect(existsSync(sortie)).toBe(false);
  });

  it("prix confirmé sous le maximum : refus (code 3), rien de branché", async () => {
    const { appels, reels } = reelsInterdits();
    const r = await lancer(["--reel", "--confirmer-prix=0,50", "--sortie", dossierTemp()], { env: { ANTHROPIC_API_KEY: CLE_FACTICE }, reels });
    expect(r.code).toBe(3);
    expect(r.sortie).toMatch(/sous le prix maximal/);
    expect(appels.n).toBe(0);
  });

  it("prix confirmé : chaque écriture passe par l'exécutant du studio (ici un double, aucun réseau), coûts au tableau", async () => {
    const vus: string[] = [];
    const reels = async (): Promise<BranchementsReels> => ({
      plafondSujetUsd: PLAFOND_SUJET_BANC_USD,
      async executeur(code, chaine) {
        vus.push(`${code}:${chaine}`);
        const sim = executeurSimulation();
        return { executer: async (role, entree) => ({ ...(await sim.executer(role, entree)), simule: false, coutUsd: 0.01, modele: role.modele }) as never };
      },
    });
    const sortie = dossierTemp();
    const premier = await lancer(["--reel", "--sortie", sortie], { env: { ANTHROPIC_API_KEY: CLE_FACTICE }, reels });
    const prix = /--confirmer-prix=(\d+,\d\d)/.exec(premier.sortie)![1];
    const r = await lancer(["--reel", `--confirmer-prix=${prix}`, "--sortie", sortie], { env: { ANTHROPIC_API_KEY: CLE_FACTICE }, reels });
    expect(r.code, r.sortie).toBe(0);
    expect(vus).toHaveLength(10);
    const tableau = readFileSync(join(sortie, "tableau.md"), "utf8");
    expect(tableau).toMatch(/RÉEL \(appels payants\)/);
    expect(tableau).toMatch(/\| chaîne courte \(3 appels\) \| terminee \| 0,03 \$ \|/);
  });

  it("un plafond du studio différent de celui de l'estimation : refus (code 2)", async () => {
    const reels = async (): Promise<BranchementsReels> => ({ plafondSujetUsd: 9, executeur: async () => executeurSimulation() });
    const r = await lancer(["--reel", "--confirmer-prix=1000", "--sortie", dossierTemp()], { env: { ANTHROPIC_API_KEY: CLE_FACTICE }, reels });
    expect(r.code).toBe(2);
    expect(r.sortie).toMatch(/plafond d'un sujet a changé/);
  });

  it("sans clé, rien n'est lu non plus (ni socle, ni idées)", async () => {
    const { vues, lectures } = lecturesDouble();
    const r = await lancer(["--reel", "--sujets-depuis-idees=3", "--sortie", dossierTemp()], { lectures });
    expect(r.code).toBe(2);
    expect(vues).toEqual({ socle: [], idees: 0 });
  });

  it("le plafond recopié pour l'estimation est celui du studio", async () => {
    const { PLAFOND_SUJET_USD } = await import("@/services/generateur");
    expect(PLAFOND_SUJET_BANC_USD).toBe(PLAFOND_SUJET_USD);
  });
});

describe("Banc d'écriture, --reel : le vrai socle de Will et ses vraies idées", () => {
  const ENV = { ANTHROPIC_API_KEY: CLE_FACTICE };

  it("les deux chaînes reçoivent le socle de Will en cache (fiche, textes, preuves) ; le prix maximal le compte", async () => {
    const { vues, lectures } = lecturesDouble();
    const { contextes, reels } = reelsEspions();
    const sortie = dossierTemp();
    const premier = await lancer(["--reel", "--sortie", sortie], { env: ENV, reels, lectures });
    expect(premier.code).toBe(3);
    expect(premier.sortie).toMatch(/Socle de Will \(réel\) : charte v7 · fiche de style v3 validée · 1 texte\(s\) retenu\(s\) · 1 preuve\(s\)/);
    // Fichier de sujets : seuls les avis de Will (positions) sont lus en plus des matières du fichier.
    expect(vues.socle).toEqual(["positions"]);
    expect(vues.idees).toBe(0);

    const fixe = await lancer(["--reel", "--sortie", dossierTemp()], { env: ENV, reels, lectures: lecturesDouble({ socle: { ...SOCLE_FIXE, origine: "will" } }).lectures });
    expect(prixAffiche(premier.sortie)).toBeGreaterThan(prixAffiche(fixe.sortie));

    const r = await lancer(["--reel", `--confirmer-prix=${/--confirmer-prix=(\d+,\d\d)/.exec(premier.sortie)![1]}`, "--sortie", sortie], { env: ENV, reels, lectures });
    expect(r.code, r.sortie).toBe(0);
    expect(contextes.length).toBeGreaterThan(10);
    for (const { contexte } of contextes) {
      const c = contexte as { styleWill: string; preuves: string; gagnants: string };
      expect(c.styleWill).toContain("on arrête de bricoler");
      expect(c.styleWill).toContain("Maintenant, ça part tout seul.");
      expect(c.preuves).toContain('id="prv-fictive-1"');
      expect(c.gagnants).toContain("Oui, quinze minutes.");
    }
    expect(readFileSync(join(sortie, "tableau.md"), "utf8")).toMatch(/Socle de Will \(réel\)/);
  });

  it("--sujets-depuis-idees=<n> : les n idées réelles les plus récentes, avec tout le carnet de Will", async () => {
    const idees: Idee[] = [
      { ...base, id: "idee-b", texte: SUJETS_BANC[0].idee, etat: "nouvelle" },
      { ...base, id: "idee-a", texte: SUJETS_BANC[1].idee, etat: "nouvelle" },
      { ...base, id: "idee-c", texte: "Une troisième idée qui ne doit pas partir", etat: "nouvelle" },
    ];
    // Le carnet de Will : ses matières servent aux sujets tirés de ses idées, comme dans le studio.
    const carnet = { ...SOCLE_WILL, matieres: [...SUJETS_BANC[0].matieres, ...SUJETS_BANC[1].matieres] };
    const { vues, lectures } = lecturesDouble({ socle: carnet, idees });
    const { vus, reels } = reelsEspions();
    const sortie = dossierTemp();
    const premier = await lancer(["--reel", "--sujets-depuis-idees=2", "--sortie", sortie], { env: ENV, reels, lectures });
    expect(premier.code, premier.sortie).toBe(3);
    expect(premier.sortie).toMatch(/2 sujets \(idées réelles de Will\)/);
    expect(vues.socle).toEqual(["carnet"]);
    const r = await lancer(["--reel", "--sujets-depuis-idees=2", `--confirmer-prix=${/--confirmer-prix=(\d+,\d\d)/.exec(premier.sortie)![1]}`, "--sortie", sortie], { env: ENV, reels, lectures });
    expect(r.code, r.sortie).toBe(0);
    expect(readFileSync(join(sortie, "sujet-1.md"), "utf8")).toContain(idees[0].texte.slice(0, 40));
    expect(readFileSync(join(sortie, "sujet-2.md"), "utf8")).toContain(idees[1].texte.slice(0, 40));
    expect(existsSync(join(sortie, "sujet-3.md"))).toBe(false);
    expect(readFileSync(join(sortie, "vote.md"), "utf8")).toMatch(/les 2 votes écrits/);
    expect(vus.every((v) => /^idee-[12]:/.test(v))).toBe(true);
  });

  it("aucune idée réelle : arrêt clair (code 1), rien de branché, aucun dossier", async () => {
    const { lectures } = lecturesDouble({ idees: [] });
    const { vus, reels } = reelsEspions();
    const sortie = dossierTemp();
    const r = await lancer(["--reel", "--sujets-depuis-idees=5", "--confirmer-prix=1000", "--sortie", sortie], { env: ENV, reels, lectures });
    expect(r.code).toBe(1);
    expect(r.sortie).toMatch(/Aucune idée réelle dans le carnet de Will/);
    expect(vus).toHaveLength(0);
    expect(existsSync(sortie)).toBe(false);
  });

  it("aucun sujet ne passe l'étape 0 (carnet vide) : arrêt clair (code 1) avant le prix, rien de branché", async () => {
    const { lectures } = lecturesDouble({ idees: [{ ...base, id: "idee-x", texte: "Une idée sans aucune matière", etat: "nouvelle" }] });
    const { vus, reels } = reelsEspions();
    const sortie = dossierTemp();
    const r = await lancer(["--reel", "--sujets-depuis-idees=1", "--confirmer-prix=1000", "--sortie", sortie], { env: ENV, reels, lectures });
    expect(r.code).toBe(1);
    expect(r.sortie).toMatch(/Aucun sujet ne passe l'étape 0/);
    expect(vus).toHaveLength(0);
    expect(existsSync(sortie)).toBe(false);
  });

  it("--sujets-depuis-idees sans --reel, ou avec --sujets : refusé (code 1)", async () => {
    const { vues, lectures } = lecturesDouble();
    expect((await lancer(["--sujets-depuis-idees=2", "--sortie", dossierTemp()], { lectures })).code).toBe(1);
    expect((await lancer(["--reel", "--sujets-depuis-idees=2", "--sujets", SUJETS], { env: ENV, lectures })).code).toBe(1);
    expect((await lancer(["--reel", "--sujets-depuis-idees=0"], { env: ENV, lectures })).code).toBe(1);
    expect(vues).toEqual({ socle: [], idees: 0 });
  });
});
