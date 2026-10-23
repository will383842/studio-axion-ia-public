/**
 * Banc à l'aveugle « chaîne équipe contre chaîne courte » (`scripts/banc-aveugle.ts`) : AUCUN appel réel, 0 $.
 * Plafond bloquant avant l'appel qui le dépasserait, refus d'un plafond > 8 $, paires sans trace de la méthode, tirage
 * A/B selon la graine, 5 paires en simulation.
 */
import { mkdtempSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { ErreurClaude, type ReponseClaude } from "@/fournisseurs/claude/client";
import { tarifDe } from "@/fournisseurs/claude/tarifs";
import { pireCasRole } from "@/generateur/roles/types";
import { lancerBanc, lettres, lirePlafond, type Appelant, type Rapport } from "../../scripts/banc-aveugle";
import { SUJETS_AVEUGLE } from "./banc/registre-banc-aveugle";

const dossier = () => mkdtempSync(join(tmpdir(), "banc-aveugle-"));
const muet = () => {};

describe("banc à l'aveugle : plafond", () => {
  it("PLAFOND_USD : 8 par défaut, refusé au-dessus de 8 ou s'il n'est pas un montant", () => {
    expect(lirePlafond({})).toBe(8);
    expect(lirePlafond({ PLAFOND_USD: "8" })).toBe(8);
    expect(lirePlafond({ PLAFOND_USD: "2,5" })).toBe(2.5);
    expect(() => lirePlafond({ PLAFOND_USD: "8.01" })).toThrow(/dépasse/);
    expect(() => lirePlafond({ PLAFOND_USD: "20" })).toThrow(/dépasse/);
    expect(() => lirePlafond({ PLAFOND_USD: "abc" })).toThrow(/refusé/);
    expect(() => lirePlafond({ PLAFOND_USD: "0" })).toThrow(/refusé/);
  });

  it("PLAFOND_USD > 8 : le banc refuse de partir, aucun appel", async () => {
    let appels = 0;
    const appelant: Appelant = async () => {
      appels++;
      throw new Error("ne doit pas partir");
    };
    const lignes: string[] = [];
    const code = await lancerBanc(["--graine", "1"], { env: { PLAFOND_USD: "9", DOSSIER: dossier(), ANTHROPIC_API_KEY: "x" }, appelant, ecrire: (l) => lignes.push(l) });
    expect(code).toBe(1);
    expect(appels).toBe(0);
    expect(lignes.join("\n")).toMatch(/PLAFOND_USD refusé/);
  });

  it("l'appel qui dépasserait le plafond NE PART PAS ; rien ne part ensuite ; rapport partiel écrit", async () => {
    // Appelant simulé qui « coûte » 90 % du pire cas de chaque appel (un appel réel ne coûte jamais plus que son pire cas).
    const vus: { depenseAvant: number; pire: number }[] = [];
    let depense = 0;
    const appelant: Appelant = async (role, entree) => {
      const pire = pireCasRole(role, entree);
      vus.push({ depenseAvant: depense, pire });
      const cout = 0.9 * pire;
      depense += cout;
      const brut = role.simuler(entree);
      const reponse: ReponseClaude = { texte: JSON.stringify(brut), modeleDemande: role.modele, modele: role.modele, replis: [], stopReason: "end_turn", jetons: { entree: 0, cacheLu: 0, cacheEcrit: 0, sortie: (cout * 1_000_000) / tarifDe(role.modele).sortie } };
      return { reponse, donnees: role.schema ? role.schema.parse(brut) : undefined };
    };
    const d = dossier();
    const plafond = 1.2;
    const code = await lancerBanc(["--graine", "3"], { env: { PLAFOND_USD: String(plafond), DOSSIER: d, ANTHROPIC_API_KEY: "x" }, appelant, ecrire: muet });
    expect(code).toBe(0);
    // Chaque appel parti tenait sous le plafond AVANT de partir (dépensé + pire cas).
    for (const v of vus) expect(v.depenseAvant + v.pire).toBeLessThanOrEqual(plafond + 1e-9);
    const r = JSON.parse(readFileSync(join(d, "couts.json"), "utf8")) as Rapport;
    expect(r.arret).toBeDefined();
    expect(r.depenseUsd).toBeLessThanOrEqual(plafond);
    const refus = r.appels.filter((a) => a.resultat === "refuse-plafond");
    expect(refus).toHaveLength(1);
    // Le refusé aurait dépassé : son message porte dépensé + pire cas > plafond.
    expect(refus[0].message).toMatch(/> 1\.2 \$/);
    // Rien n'est parti après le refus, et l'appelant n'a jamais vu l'appel refusé.
    expect(r.appels.at(-1)!.resultat).toBe("refuse-plafond");
    expect(vus).toHaveLength(r.appels.filter((a) => a.resultat === "ok").length);
    expect(r.sujets.length).toBeLessThan(SUJETS_AVEUGLE.length);
    expect(readFileSync(join(d, "paires.md"), "utf8")).toMatch(/Script A/);
  });
});

describe("banc à l'aveugle : simulation et paires", () => {
  it("le mode simulation produit 5 paires complètes, 0 $, et les états bruts", async () => {
    const d = dossier();
    const lignes: string[] = [];
    const code = await lancerBanc(["--simulation", "--graine", "7"], { env: { DOSSIER: d }, ecrire: (l) => lignes.push(l) });
    expect(code).toBe(0);
    const paires = readFileSync(join(d, "paires.md"), "utf8");
    expect(paires.match(/^## Sujet \d/gm)).toHaveLength(5);
    expect(paires.match(/^### Script A$/gm)).toHaveLength(5);
    expect(paires.match(/^### Script B$/gm)).toHaveLength(5);
    expect(paires).not.toMatch(/Pas de texte/);
    const r = JSON.parse(readFileSync(join(d, "couts.json"), "utf8")) as Rapport;
    expect(r.depenseUsd).toBe(0);
    expect(r.sujets.flatMap((s) => Object.values(s.chaines).map((c) => c!.statut))).toEqual(Array(10).fill("terminee"));
    expect(readdirSync(join(d, "brut"))).toHaveLength(10);
    const cle = JSON.parse(readFileSync(join(d, "cle.json"), "utf8")) as { graine: number; cle: Record<string, { A: string; B: string }> };
    expect(cle.graine).toBe(7);
    expect(Object.keys(cle.cle)).toEqual(SUJETS_AVEUGLE.map((s) => s.code));
    // Une ligne par appel, avec le cumul.
    expect(lignes.filter((l) => /cumul .* \/ 8 \$$/.test(l)).length).toBeGreaterThanOrEqual(5 * 7);
  });

  it("paires.md ne contient aucun mot qui trahit la méthode", async () => {
    const d = dossier();
    await lancerBanc(["--simulation", "--graine", "11"], { env: { DOSSIER: d }, ecrire: muet });
    const paires = readFileSync(join(d, "paires.md"), "utf8");
    const interdits = [/\bcha[iî]nes?\b/i, /\bcourte\b/i, /\bequipe\b/, /\b[ée]quipe (courte|longue)\b/i, /court-(angle|script|relecture)/, /equipe-(chef|scenariste|accroches|relecteur)/, /r[ée]dacteur en chef/i, /sc[ée]nariste/i, /relecteur/i, /\brelecture\b/i, /\b[ée]tapes?\b/i, /\br[ôo]les?\b/i, /\$/, /\bUSD\b/, /\bjetons?\b/i, /\bopus\b/i, /\bsonnet\b/i, /\bclaude\b/i, /\bsimul/i, /\bmod[èe]le\b/i, /\bco[uû]t(s)? (r[ée]el|du sujet)/i, /\bnote \d/i];
    for (const x of interdits) expect(paires, String(x)).not.toMatch(x);
  });

  it("l'ordre A/B dépend de la graine (même graine, même ordre)", () => {
    const codes = SUJETS_AVEUGLE.map((s) => s.code);
    expect(lettres(codes, 5)).toEqual(lettres(codes, 5));
    const ordres = new Set(Array.from({ length: 20 }, (_, g) => codes.map((c) => lettres(codes, g)[c].A).join(",")));
    expect(ordres.size).toBeGreaterThan(1);
    for (const g of [1, 2, 3]) for (const c of codes) expect(new Set(Object.values(lettres(codes, g)[c]))).toEqual(new Set(["courte", "equipe"]));
  });
});

describe("banc à l'aveugle : certains sujets, banc à compléter", () => {
  const codes = SUJETS_AVEUGLE.map((s) => s.code);
  const lire = (d: string) => JSON.parse(readFileSync(join(d, "couts.json"), "utf8")) as Rapport;
  const cleDe = (d: string) => (JSON.parse(readFileSync(join(d, "cle.json"), "utf8")) as { graine: number; cle: Record<string, { A: string; B: string }> });

  it("--sujets ne joue que ces sujets ; les lettres sont celles du tirage complet", async () => {
    const d = dossier();
    const complet = lettres(codes, 7);
    const code = await lancerBanc(["--simulation", "--graine", "7", "--sujets", `${codes[3]},${codes[1]}`], { env: { DOSSIER: d }, ecrire: muet });
    expect(code).toBe(0);
    expect(lire(d).sujets.map((s) => s.code)).toEqual([codes[1], codes[3]]);
    expect(cleDe(d).cle).toEqual({ [codes[1]]: complet[codes[1]], [codes[3]]: complet[codes[3]] });
    expect(readdirSync(join(d, "brut"))).toHaveLength(4);
  });

  it("--sujets : un code inconnu est refusé, rien ne part", async () => {
    const lignes: string[] = [];
    const code = await lancerBanc(["--simulation", "--sujets", "nexiste-pas"], { env: { DOSSIER: dossier() }, ecrire: (l) => lignes.push(l) });
    expect(code).toBe(1);
    expect(lignes.join("\n")).toMatch(/sujet inconnu/);
  });

  it("--ajouter-a ajoute sans écraser, garde les textes et les lettres, ne rejoue pas un sujet fini", async () => {
    const d = dossier();
    await lancerBanc(["--simulation", "--graine", "9", "--sujets", codes[0]], { env: { DOSSIER: d }, ecrire: muet });
    const avant = readFileSync(join(d, "paires.md"), "utf8");
    const lignes: string[] = [];
    const code = await lancerBanc(["--simulation", "--sujets", `${codes[0]},${codes[2]}`, "--ajouter-a", d], { env: {}, ecrire: (l) => lignes.push(l) });
    expect(code).toBe(0);
    expect(lignes.join("\n")).toMatch(/déjà fini/);
    const r = lire(d);
    expect(r.sujets.map((s) => s.code)).toEqual([codes[0], codes[2]]);
    expect(cleDe(d).graine).toBe(9);
    const paires = readFileSync(join(d, "paires.md"), "utf8");
    expect(paires.match(/^### Script A$/gm)).toHaveLength(2);
    expect(paires).not.toMatch(/Pas de texte/);
    // Le premier sujet garde exactement ses textes A et B.
    const premier = (t: string) => t.split(/^## Sujet 2/m)[0].replace(/^## Sujet 1/m, "").trim();
    expect(premier(paires)).toBe(premier(avant));
    expect(r.sujets).toHaveLength(2);
  });

  it("--ajouter-a : le plafond vaut pour le cumul (dépense déjà faite + nouveaux appels)", async () => {
    const d = dossier();
    await lancerBanc(["--simulation", "--graine", "4", "--sujets", codes[0]], { env: { DOSSIER: d }, ecrire: muet });
    const fichier = join(d, "couts.json");
    const r = lire(d);
    writeFileSync(fichier, JSON.stringify({ ...r, depenseUsd: 7.999 }));
    let appels = 0;
    const appelant: Appelant = async () => {
      appels++;
      throw new Error("ne doit pas partir");
    };
    // mode « simulation » dans le rapport : on passe en réel avec un appelant de test.
    writeFileSync(fichier, JSON.stringify({ ...r, mode: "reel", depenseUsd: 7.999 }));
    const code = await lancerBanc(["--sujets", codes[1], "--ajouter-a", d], { env: { ANTHROPIC_API_KEY: "x" }, appelant, ecrire: muet });
    expect(code).toBe(0);
    expect(appels).toBe(0);
    const apres = lire(d);
    expect(apres.arret).toBeDefined();
    expect(apres.depenseUsd).toBeLessThanOrEqual(8);
    expect(apres.sujets.map((s) => s.code)).toContain(codes[0]);
  });

  it("--ajouter-a : un sujet arrêté par manque de crédit est rejoué s'il est redemandé", async () => {
    const d = dossier();
    const sansCredit: Appelant = async () => {
      throw new ErreurClaude("facturation", "crédit épuisé");
    };
    await lancerBanc(["--graine", "2", "--sujets", codes[0]], { env: { DOSSIER: d, ANTHROPIC_API_KEY: "x" }, appelant: sansCredit, ecrire: muet });
    expect(Object.values(lire(d).sujets[0].chaines).every((c) => c!.statut !== "terminee")).toBe(true);
    // Le même banc est complété en réel (appelant simulé de test) : le sujet est rejoué et fini.
    const { appelantSimule } = await import("../../scripts/banc-aveugle");
    const code = await lancerBanc(["--sujets", codes[0], "--ajouter-a", d], { env: { ANTHROPIC_API_KEY: "x" }, appelant: appelantSimule, ecrire: muet });
    expect(code).toBe(0);
    const r = lire(d);
    expect(r.sujets).toHaveLength(1);
    expect(Object.values(r.sujets[0].chaines).map((c) => c!.statut)).toEqual(["terminee", "terminee"]);
    expect(readFileSync(join(d, "paires.md"), "utf8")).not.toMatch(/Pas de texte/);
  });

  it("--ajouter-a : dossier illisible ou graine différente refusés", async () => {
    expect(await lancerBanc(["--simulation", "--ajouter-a", join(tmpdir(), "inexistant-banc")], { env: {}, ecrire: muet })).toBe(1);
    const d = dossier();
    await lancerBanc(["--simulation", "--graine", "5", "--sujets", codes[0]], { env: { DOSSIER: d }, ecrire: muet });
    expect(await lancerBanc(["--simulation", "--graine", "6", "--ajouter-a", d], { env: {}, ecrire: muet })).toBe(1);
  });
});
