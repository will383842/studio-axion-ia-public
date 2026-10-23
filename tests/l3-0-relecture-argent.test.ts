/**
 * L3-0 — correctifs de la RELECTURE ARGENT de la PR #387 (A, B, D, E). Doubles de test seulement : dépôts en mémoire,
 * faux `fetch` Claude, aucune clé réelle, aucun réseau, 0 €.
 *  A. l'écriture commandée par l'Usine passe par `verifierEtReserver` (verrou des crédits + engagement) : le budget du
 *     mois compte les réservations Claude en vol ; une fabrication et une écriture simultanées ne passent pas ensemble ;
 *  B. `origine` accepté aussi par le comité, les décors, la maquette et les pré-vols des réseaux (défaut manuel inchangé) ;
 *  D. garde structurelle : l'origine « usine » ne passe que par `reserverPourUsine` ;
 *  E. `plafond_cents` suit le plafond de la chaîne réellement active du sujet.
 */
import { hash } from "@node-rs/argon2";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { mockHeaders, mockNavigation, reinitialiserRequete } from "./helpers/next-mocks";
import { CLE_ESSAI_CLAUDE, fluxReussi, reponseFlux } from "./helpers/g0";
import { roleSonde } from "@/generateur/roles/sonde";
import { pireCasRole } from "@/generateur/roles/types";
import type { GenerationScript, LigneCout } from "@/domaine/types";

vi.mock("next/headers", () => mockHeaders);
vi.mock("next/navigation", () => mockNavigation);

const { reinitialiserDepots, depots } = await import("@/donnees/memoire");
const auth = await import("@/services/auth");
const credits = await import("@/services/credits");
const couts = await import("@/services/couts");
const budget = await import("@/services/budget-mensuel");
const gc = await import("@/services/generation-claude");
const { creerLecteurAnthropic } = await import("@/fournisseurs/credits/suivis");
const { ecrireParametre } = await import("@/services/_commun");

const MDP = "l3-0-relecture-argent";
const eur = (c: number) => ({ centimes: c, devise: "EUR" as const });
const ligne = (c: number): LigneCout => ({ etape: "Voix", fournisseur: "simulation", unite: "forfait", quantite: 1, prixUnitaire: eur(c), total: eur(c), nature: "estime" });
const estimation = (c: number) => ({ lignes: [ligne(c)], total: eur(c) });
let n = 0;
const demande = () => ({ videoId: `v-rel-${++n}`, travailId: `trv-rel-${++n}` });

beforeAll(async () => {
  process.env.SESSION_SECRET = "k".repeat(48);
  const e = await hash(MDP, { algorithm: 2, memoryCost: 19456, timeCost: 2, parallelism: 1 });
  process.env.STUDIO_PASSWORD_HASH_B64 = Buffer.from(e).toString("base64");
});

beforeEach(async () => {
  reinitialiserDepots();
  reinitialiserRequete();
  credits.injecterLecteursPourEssai([], []);
  await auth.seConnecter(MDP, false);
  for (const d of await depots().depenses.lister()) await depots().depenses.supprimer(d.id);
  await ecrireParametre("budget.seuilConfirmation", eur(1_000_000));
  await ecrireParametre("budget.mensuel", eur(15_000));
});

afterEach(() => {
  credits.injecterLecteursPourEssai(null);
  vi.useRealTimers();
});

/* --- A. écriture de l'Usine sous le verrou des crédits, engagée sur le budget du mois ---------------------------- */

const reponseOk = () => reponseFlux(fluxReussi({ texte: '{"phrase":"Vous recevez un PV."}' }));
const entreeRole = { contexte: { contexteAxion: "Axion-IA : formations IA pour dirigeants." }, variable: "<brief>Les PV de stationnement</brief>" };
const fetchInterdit = (async () => {
  throw new Error("réseau interdit");
}) as typeof fetch;

/** Faux Claude dont la réponse reste EN VOL tant que `liberer()` n'est pas appelé : l'écriture occupe sa réservation. */
async function brancherClaudeEnVol() {
  credits.injecterLecteursPourEssai([creerLecteurAnthropic({ ANTHROPIC_API_KEY: CLE_ESSAI_CLAUDE }, fetchInterdit)], ["anthropic"]);
  await credits.declarerRecharge("anthropic", 5000);
  await ecrireParametre("fournisseur.script", "claude");
  let liberer!: () => void;
  const attente = new Promise<void>((r) => (liberer = r));
  let appels = 0;
  const f = (async () => {
    appels++;
    await attente;
    return reponseOk();
  }) as typeof fetch;
  gc.injecterClaudePourEssai({ cle: CLE_ESSAI_CLAUDE, fetch: f, attenteMs: () => 0 });
  return { liberer, appels: () => appels };
}

async function nouvelleGeneration(): Promise<GenerationScript> {
  const le = new Date().toISOString();
  const g: GenerationScript = { id: `gen-rel-${++n}`, scriptMaitreId: `suj-rel-${n}`, hachageContexte: "h", plafondUsd: 1.5, portee: "sujet", etapes: [], statut: "en-cours", creeLe: le, modifieLe: le };
  await depots().generations.enregistrer(g);
  return g;
}

/** Pire cas de l'écriture en centimes d'euro, et un budget de l'Usine où UNE écriture tient mais pas l'écriture + 11 centimes. */
async function budgetOuUneSeuleTient() {
  const t = await gc.taux();
  const ecriture = Math.ceil(gc.ligne("Écriture · sonde", pireCasRole(roleSonde, entreeRole), t, "estime").total.centimes);
  expect(ecriture).toBeGreaterThan(0);
  const usine = ecriture + 10;
  await budget.reglerBudgetUsine({ budget_mensuel_cents: usine, mois: couts.moisParis() });
  return { ecriture, usine, fabrication: 11 };
}

describe("A. l'écriture commandée par l'Usine compte dans le budget du mois", () => {
  it("écriture en vol : une fabrication de l'Usine qui ferait dépasser le budget est refusée (BUDGET_MENSUEL_ATTEINT)", async () => {
    const claude = await brancherClaudeEnVol();
    const { fabrication } = await budgetOuUneSeuleTient();
    const g = await nouvelleGeneration();
    const ecriture = gc.executerRoleFacture(g.id, roleSonde, entreeRole, { origine: "usine" });
    await vi.waitFor(() => expect(claude.appels()).toBe(1));
    await expect(credits.reserverPourUsine(estimation(fabrication), true, "Cette vidéo", demande())).rejects.toMatchObject({ code: "BUDGET_MENSUEL_ATTEINT" });
    claude.liberer();
    expect(await ecriture).toMatchObject({ ok: true, simule: false });
  });

  it("écriture terminée : son engagement est rendu, la fabrication passe ensuite", async () => {
    const claude = await brancherClaudeEnVol();
    const { fabrication } = await budgetOuUneSeuleTient();
    const g = await nouvelleGeneration();
    const ecriture = gc.executerRoleFacture(g.id, roleSonde, entreeRole, { origine: "usine" });
    await vi.waitFor(() => expect(claude.appels()).toBe(1));
    claude.liberer();
    expect(await ecriture).toMatchObject({ ok: true });
    expect(await couts.budgetEngage()).toBe(0);
    await expect(credits.reserverPourUsine(estimation(fabrication), true, "Cette vidéo", demande())).resolves.toBeUndefined();
  });

  it("course : une écriture et une fabrication de l'Usine lancées ENSEMBLE ne passent pas toutes deux", async () => {
    const claude = await brancherClaudeEnVol();
    const { fabrication } = await budgetOuUneSeuleTient();
    const g = await nouvelleGeneration();
    const ecriture = gc.executerRoleFacture(g.id, roleSonde, entreeRole, { origine: "usine" });
    const fab = credits.reserverPourUsine(estimation(fabrication), true, "Cette vidéo", demande()).then(
      () => "passe",
      (e: { code?: string }) => e.code,
    );
    // L'écriture n'a pas appelé Claude : son refus (budget-usine) ne laisse pas l'appel en vol.
    const issueFab = await fab;
    claude.liberer();
    const issueEcriture = await ecriture;
    const passes = [issueFab === "passe", issueEcriture.ok === true].filter(Boolean).length;
    expect(passes).toBe(1);
    if (issueFab !== "passe") expect(issueFab).toBe("BUDGET_MENSUEL_ATTEINT");
    else expect(issueEcriture).toMatchObject({ ok: false, arret: "budget-usine" });
  });

  it("défaut manuel inchangé : sans origine, l'écriture part sans budget de l'Usine et s'engage aussi", async () => {
    const claude = await brancherClaudeEnVol();
    const g = await nouvelleGeneration();
    const ecriture = gc.executerRoleFacture(g.id, roleSonde, entreeRole);
    await vi.waitFor(() => expect(claude.appels()).toBe(1));
    expect(await couts.budgetEngage()).toBeGreaterThan(0);
    claude.liberer();
    expect(await ecriture).toMatchObject({ ok: true });
    expect(await couts.budgetEngage()).toBe(0);
  });
});

/* --- B. `origine` accepté par les autres sites de dépense -------------------------------------------------------- */

const SRC = join(process.cwd(), "src");
const lire = (f: string) => readFileSync(join(SRC, f), "utf8");

/** Texte (parenthèses équilibrées) de chaque appel `nom(…)` d'un source, hors lignes d'import. */
function appelsDe(source: string, nom: string): string[] {
  const sortie: string[] = [];
  const re = new RegExp(`(?<![A-Za-z])${nom}\\(`, "g");
  for (let m = re.exec(source); m; m = re.exec(source)) {
    if (/function\s+$/.test(source.slice(0, m.index))) continue;
    const debut = m.index + m[0].length;
    let profondeur = 1;
    let i = debut;
    for (; i < source.length && profondeur > 0; i++) {
      if (source[i] === "(") profondeur++;
      else if (source[i] === ")") profondeur--;
    }
    sortie.push(source.slice(debut, i - 1));
  }
  return sortie;
}

describe("B. `origine` sur les sites de dépense restants", () => {
  const sites: [string, string][] = [
    ["services/comite-editorial.ts", "verifierEtReserverSelonOrigine"],
    // L3-01 : le look de décor et la maquette contrôlent ET réservent sous le verrou (`depenserSelonOrigine`).
    ["services/decors.ts", "depenserSelonOrigine"],
    ["services/decors.ts", "verifierEtReserverSelonOrigine"],
    ["services/fabrication.ts", "depenserSelonOrigine"],
    ["services/fabrication.ts", "verifierEtReserverSelonOrigine"],
    ["services/fabrication-reseaux.ts", "verifierBudgetEtCredits"],
  ];
  for (const [fichier, nom] of sites) {
    it(`${fichier} : chaque appel de ${nom} porte l'origine`, () => {
      const appels = appelsDe(lire(fichier), nom);
      expect(appels.length).toBeGreaterThan(0);
      for (const a of appels) expect(a).toContain("origine");
    });
  }

  it("aucun site de décors n'appelle plus `verifierEtReserver` directement", () => {
    expect(appelsDe(lire("services/decors.ts"), "verifierEtReserver")).toHaveLength(0);
  });

  it("l'aiguillage : « usine » exige le budget de l'Usine, sans origine la dépense manuelle est inchangée", async () => {
    await expect(credits.verifierEtReserverSelonOrigine("usine", estimation(10), true, "Cette vidéo", demande())).rejects.toMatchObject({ code: "BUDGET_USINE_ABSENT" });
    await expect(credits.verifierEtReserverSelonOrigine(undefined, estimation(10), true, "Cette vidéo", demande())).resolves.toBeUndefined();
    await expect(credits.verifierEtReserverSelonOrigine("studio", estimation(10), true, "Cette vidéo", demande())).resolves.toBeUndefined();
  });
});

/* --- D. garde structurelle : l'origine « usine » ne passe que par `reserverPourUsine` ---------------------------- */

function sources(dossier: string): string[] {
  return readdirSync(dossier).flatMap((nom) => {
    const p = join(dossier, nom);
    if (statSync(p).isDirectory()) return sources(p);
    return /\.(ts|tsx)$/.test(nom) ? [p] : [];
  });
}
const SANS_COMMENTAIRES = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

describe("D. garde : une dépense Claude ou de fabrication avec l'origine « usine » passe par reserverPourUsine", () => {
  const fichiers = sources(SRC).filter((f) => !f.endsWith("services/credits.ts"));

  it("le littéral « usine » comme origine n'existe que dans credits.ts (reserverPourUsine)", () => {
    const fautes = fichiers.filter((f) => /origine\s*:\s*["']usine["']/.test(SANS_COMMENTAIRES(readFileSync(f, "utf8"))));
    expect(fautes).toEqual([]);
  });

  it("aucun appel de `verifierEtReserver` ne reçoit d'origine (il faut `reserverPourUsine` ou l'aiguillage)", () => {
    const fautes = fichiers.filter((f) => appelsDe(SANS_COMMENTAIRES(readFileSync(f, "utf8")), "verifierEtReserver").some((a) => /origine/.test(a)));
    expect(fautes).toEqual([]);
  });

  it("`reserverPourUsine` fixe l'origine : son seul appel de verifierEtReserver porte « usine » en dur", () => {
    const appels = appelsDe(SANS_COMMENTAIRES(lire("services/credits.ts")), "verifierEtReserver").filter((a) => /origine/.test(a));
    expect(appels).toHaveLength(1);
    expect(appels[0]).toMatch(/origine:\s*"usine"/);
  });
});

/* --- E. plafond_cents : plafond de la chaîne réellement active ----------------------------------------------------- */

describe("E. plafond d'un sujet = plafond de la chaîne active", () => {
  it("chaîne grande (réglage « complete ») : suit `generateur.plafondGrandeChaineUsd` (3 $ à 0,9 = 270 centimes)", async () => {
    (await import("@/services/generation-claude")).forcerChainePourEssai("grande");
    await ecrireParametre(gc.PARAM_PLAFOND_GRANDE_CHAINE, 3);
    await ecrireParametre(gc.PARAM_PLAFOND_SUJET, 1.5);
    expect(await budget.plafondSujetCentimes()).toBe(270);
    expect(await budget.verifierPlafondCommande(270)).toBe(270);
    await expect(budget.verifierPlafondCommande(271)).rejects.toMatchObject({ code: "CHAMP_INVALIDE", champ: "plafond_cents" });
  });

  it("chaîne courte : suit `generateur.plafondSujetUsd` (2 $ à 0,5 = 100 centimes)", async () => {
    gc.forcerChainePourEssai(null);
    await ecrireParametre(gc.PARAM_CHAINE, "courte");
    await ecrireParametre(gc.PARAM_PLAFOND_GRANDE_CHAINE, 3);
    await ecrireParametre(gc.PARAM_PLAFOND_SUJET, 2);
    await ecrireParametre("taux.usdEur", 0.5);
    expect(await budget.plafondSujetCentimes()).toBe(100);
  });
});
