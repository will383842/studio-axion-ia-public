/**
 * INTÉGRATION PAQUET 4 — points de jonction entre équipes (docs/controles/INTEGRATION-PAQUET4.md).
 * Chaque test rougit si la jonction casse :
 *  1. garde argent (équipe 3, B6 « confirmation du total ») × écriture en série (équipe 6) ;
 *  2. séries TikTok (équipe 7) × écriture en série (équipe 6) : chaque idée partie devient un épisode ;
 *  3. « Vos hashtags » (équipe 7) × écriture en série (équipe 6) : les versions écrites en série piochent dans la famille ;
 *  4. rappel « Votre marque » (équipe 7) × notifications persistées et réessayées (équipe 2).
 * Aucun réseau, aucune clé : Claude « branché » répond par un faux `fetch` qui INTERDIT tout appel ; faux transports.
 */
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { mockHeaders, mockNavigation, reinitialiserRequete } from "./helpers/next-mocks";
import { preparerMotDePasse } from "./helpers/g1a";
import { CLE_ESSAI_CLAUDE } from "./helpers/g0";
import { SUJETS_BANC } from "./generateur/banc/registre-banc-g4";

vi.mock("next/headers", () => mockHeaders);
vi.mock("next/navigation", () => mockNavigation);
vi.mock("next/cache", () => ({ revalidatePath: () => undefined, revalidateTag: () => undefined }));

const { reinitialiserDepots, depots } = await import("@/donnees/memoire");
const auth = await import("@/services/auth");
const bg = await import("@/services/boucle-generation");
const gc = await import("@/services/generation-claude");
const couts = await import("@/services/couts");
const { ecrireParametre } = await import("@/services/_commun");
const { RESEAUX_DECLINAISON } = await import("@/reseaux/codes");
const serie = await import("@/services/serie-ecriture");
const series = await import("@/services/series");
const hashtags = await import("@/services/hashtags");
const pub = await import("@/services/publications");
const notifications = await import("@/services/notifications");
const { estInterdit } = await import("@/reseaux/hashtags");
const { RAPPEL_VOTRE_MARQUE } = await import("@/domaine/votre-marque");

const MDP = "paquet4-jonctions";
const appelsClaude: string[] = [];
const fetchInterdit = (async (url: string | URL | Request) => {
  appelsClaude.push(String(url));
  throw new Error("réseau interdit");
}) as typeof fetch;

const REGLAGES = { reseaux: [...RESEAUX_DECLINAISON], formatId: "avocat", adresse: "vous" as const, mode: "avatar" as const, objectif: "notoriete" as const };
const IDEES = [...SUJETS_BANC.map((s) => s.idee), "Les réunions qui auraient pu être un e-mail", "Le devis refait trois fois"];

beforeAll(async () => preparerMotDePasse(MDP));
beforeEach(async () => {
  reinitialiserDepots();
  reinitialiserRequete();
  bg.suspendreBoucleGeneration(true);
  appelsClaude.length = 0;
  await auth.seConnecter(MDP, false);
  for (const m of SUJETS_BANC.flatMap((s) => s.matieres)) await depots().matieres.enregistrer(m);
  for (const p of SUJETS_BANC.flatMap((s) => s.preuves)) await depots().preuves.enregistrer(p);
});
afterEach(() => {
  gc.injecterClaudePourEssai(null);
  bg.arreterBoucleGeneration();
});

async function brancherClaude() {
  await ecrireParametre("fournisseur.script", "claude");
  gc.injecterClaudePourEssai({ cle: CLE_ESSAI_CLAUDE, fetch: fetchInterdit, attenteMs: () => 0 });
  await ecrireParametre(gc.PARAM_PLAFOND_MENSUEL, 10_000);
  const b = await couts.resumeBudget();
  await ecrireParametre("budget.mensuel", { centimes: b.depense.centimes + b.engage.centimes + 1_000_000, devise: "EUR" });
}

const sujetsDesIdees = (textes: string[]) => depots().scriptsMaitres.lister((m) => !m.estDemo && textes.includes(m.brief.idee));

/* ------------------------------------------------------------------ */
describe("Jonction 1 · garde argent (B6) × écriture en série : le total vu sur la feuille est exigé au-delà du seuil", () => {
  it("au-delà du seuil, sans total confirmé : CONFIRMATION_REQUISE, rien n'est créé, aucun appel", async () => {
    await brancherClaude();
    const prix = (await bg.prixLancement()).centimes;
    await ecrireParametre("budget.seuilConfirmation", { centimes: 2 * prix, devise: "EUR" });
    const textes = IDEES.slice(0, 3);
    await expect(serie.lancerSerie(textes.map((texte) => ({ texte })), REGLAGES, "serie-p4-sans-total")).rejects.toMatchObject({ code: "CONFIRMATION_REQUISE" });
    expect(await sujetsDesIdees(textes)).toHaveLength(0);
    expect(await depots().generations.compter((g) => !g.estDemo && g.statut === "en-cours")).toBe(0);
    expect(appelsClaude).toHaveLength(0);
  });

  it("un total confirmé plus bas que le prix du jour ne vaut pas confirmation ; le bon total fait partir la série", async () => {
    await brancherClaude();
    const prix = (await bg.prixLancement()).centimes;
    await ecrireParametre("budget.seuilConfirmation", { centimes: 2 * prix, devise: "EUR" });
    const textes = IDEES.slice(0, 3);
    const plan = await serie.planSerie(3);
    expect(plan.totalPartant.centimes).toBe(3 * prix);
    await expect(serie.lancerSerie(textes.map((texte) => ({ texte })), REGLAGES, "serie-p4-total-bas", plan.totalPartant.centimes - 1)).rejects.toMatchObject({ code: "CONFIRMATION_REQUISE" });
    expect(await sujetsDesIdees(textes)).toHaveLength(0);
    const { serie: s } = await serie.lancerSerie(textes.map((texte) => ({ texte })), REGLAGES, "serie-p4-total-ok", plan.totalPartant.centimes, plan.partiront);
    expect(s.elements.map((e) => e.sort)).toEqual(["parti", "parti", "parti"]);
    expect(appelsClaude).toHaveLength(0);
  });

  it("sous le seuil, ou en essai (rien n'est payé) : aucune confirmation demandée", async () => {
    // Essai : Claude pas branché.
    await ecrireParametre("budget.seuilConfirmation", { centimes: 1, devise: "EUR" });
    const a = await serie.lancerSerie(IDEES.slice(0, 2).map((texte) => ({ texte })), REGLAGES, "serie-p4-essai");
    expect(a.plan.essai).toBe(true);
    expect(a.serie.elements.every((e) => e.sort === "parti")).toBe(true);
    // Claude branché, total sous le seuil.
    await brancherClaude();
    await ecrireParametre("budget.seuilConfirmation", { centimes: 1_000_000, devise: "EUR" });
    const b = await serie.lancerSerie(IDEES.slice(2, 4).map((texte) => ({ texte })), REGLAGES, "serie-p4-sous-seuil");
    expect(b.serie.elements.every((e) => e.sort === "parti")).toBe(true);
  });

  it("l'écran envoie le total affiché sur la feuille (aucune confirmation écrite en dur)", async () => {
    const { readFileSync } = await import("node:fs");
    const feuille = readFileSync("src/components/generateur/FeuilleSerie.tsx", "utf8");
    // Relecture paquet 4 (petit défaut 5) : la taille du plan vu part avec son total.
    expect(feuille).toMatch(/lancerSerieAction\([^)]*plan\.totalPartant\.centimes, plan\.partiront\)/);
    const action = readFileSync("src/app/(studio)/ecrire/serie/actions.ts", "utf8");
    expect(action).toMatch(/lancerSerie\(idees, reglages, cle, typeof totalConfirme === "number"/);
  });
});

/* ------------------------------------------------------------------ */
describe("Jonction 2 · séries TikTok × écriture en série", () => {
  it("la série choisie dans l'atelier suit chaque idée partie : épisodes 1, 2, 3 dans l'ordre", async () => {
    // Relecture finale : l'épisode se prend à la première étape vraiment payée (Claude relié, écriture déroulée) ;
    // les épisodes 1, 2, 3 après écriture réelle sont vérifiés de bout en bout dans e2e-verif1-bc-serie. Ici, la
    // première étape payée est jouée directement, dans l'ordre des idées.
    const generateur = await import("@/services/generateur");
    const s = await series.creerSerie("L'IA qui fait gagner 1 h");
    const textes = IDEES.slice(0, 3);
    const { serie: lot } = await serie.lancerSerie(textes.map((texte) => ({ texte })), { ...REGLAGES, serieId: s.id }, "serie-p4-episodes");
    for (const e of lot.elements) await generateur.prendreEpisode(e.scriptMaitreId!);
    const episodes: (number | undefined)[] = [];
    for (const e of lot.elements) {
      const m = (await depots().scriptsMaitres.obtenir(e.scriptMaitreId!))!;
      expect(m.brief.serieId).toBe(s.id);
      episodes.push(m.episodeSerie);
    }
    expect(episodes).toEqual([1, 2, 3]);
  });

  it("CORRIGÉ (relecture finale) — une écriture d'essai (Claude non relié) ne consomme aucun épisode de la série", async () => {
    const s = await series.creerSerie("L'IA qui fait gagner 1 h");
    const { serie: lot } = await serie.lancerSerie(IDEES.slice(0, 2).map((texte) => ({ texte })), { ...REGLAGES, serieId: s.id }, "serie-p4-essai");
    for (let i = 0; i < 3; i++) await bg.tourBoucleGeneration();
    for (const e of lot.elements) {
      const m = (await depots().scriptsMaitres.obtenir(e.scriptMaitreId!))!;
      expect(m.brief.serieId).toBe(s.id);
      expect(m.episodeSerie).toBeUndefined();
    }
    expect((await depots().series.obtenir(s.id))!.dernierEpisode ?? 0).toBe(0);
  });

  it("sans série choisie : aucun sujet rattaché", async () => {
    const { serie: lot } = await serie.lancerSerie(IDEES.slice(0, 2).map((texte) => ({ texte })), REGLAGES, "serie-p4-sans-serie");
    for (const e of lot.elements) expect((await depots().scriptsMaitres.obtenir(e.scriptMaitreId!))!.brief.serieId).toBeUndefined();
  });
});

/* ------------------------------------------------------------------ */
describe("Jonction 3 · « Vos hashtags » × écriture en série", () => {
  it("les versions TikTok écrites en série ne portent que des mots-dièse de la famille (3 à 5), jamais #fyp", { timeout: 60_000 }, async () => {
    const famille = ["#IA", "#PME", "#automatisation", "#ChatGPT"];
    await hashtags.definirFamille("tiktok", famille);
    const textes = IDEES.slice(0, 2);
    const { serie: lot } = await serie.lancerSerie(textes.map((texte) => ({ texte })), REGLAGES, "serie-p4-hashtags");
    for (let i = 0; i < 4; i++) await bg.tourBoucleGeneration();
    const ids = lot.elements.map((e) => e.scriptMaitreId!);
    const tiktok = await depots().variantes.lister((v) => ids.includes(v.scriptMaitreId) && v.reseau === "tiktok");
    expect(new Set(tiktok.map((v) => v.scriptMaitreId)).size).toBe(2);
    const cle = (m: string) => m.toLowerCase();
    for (const v of tiktok) {
      const mots = v.publication.motsDiese;
      expect(mots.length).toBeGreaterThanOrEqual(3);
      expect(mots.length).toBeLessThanOrEqual(5);
      for (const m of mots) {
        expect(estInterdit(m), m).toBe(false);
        expect(famille.map(cle), m).toContain(cle(m));
      }
    }
  });
});

/* ------------------------------------------------------------------ */
describe("Jonction 4 · rappel « Votre marque » × notifications persistées et réessayées", () => {
  const EMAIL = { cle: "faux", expediteur: "studio@axion-ia.com", destinataire: "will@example.com", adresse: "https://zepto.invalid", site: "https://studio.axion-ia.com" };

  it("le rappel est écrit en base « à envoyer », réessayé après un échec, et chaque envoi porte le geste TikTok", async () => {
    await ecrireParametre("notifications", { videoPrete: true, echec: true, budget: true, canal: "email" });
    const modele = (await depots().videos.obtenir("v-15"))!;
    await depots().videos.enregistrer({ ...modele, id: "v-p4-marque", titre: "Pourquoi Axion IA forme vos équipes", estDemo: false, scriptId: undefined });
    for (const c of ["image", "son", "sousTitres", "mentionIA", "droits"] as const) await pub.cocherAvantDePublier("v-p4-marque", c, true);
    await pub.envoyerVersBuffer("v-p4-marque", ["tiktok"], new Date(Date.now() + 86_400_000).toISOString());

    const [note] = await depots().notifications.lister((n) => (n.message ?? "").includes(RAPPEL_VOTRE_MARQUE) && !n.estDemo);
    expect(note).toBeDefined();
    expect(note.envoi).toMatchObject({ statut: "a-envoyer", essais: 0 });

    let t = Date.parse("2026-10-03T10:00:00Z");
    let reponse = false;
    const envoyes: { titre: string; message?: string }[] = [];
    const dep = { push: null, email: EMAIL, maintenant: () => t, envoyerEmail: async (_c: unknown, n: { titre: string; message?: string }) => (envoyes.push(n), { envoye: reponse, simule: false }) };

    await notifications.diffuserNotifications(dep);
    expect((await depots().notifications.obtenir(note.id))!.envoi).toMatchObject({ statut: "a-envoyer", essais: 1 });
    t += 60 * 60_000;
    reponse = true;
    await notifications.diffuserNotifications(dep);
    expect((await depots().notifications.obtenir(note.id))!.envoi).toMatchObject({ statut: "envoyee", essais: 2 });
    const pourLeRappel = envoyes.filter((e) => (e.message ?? "").includes(RAPPEL_VOTRE_MARQUE));
    expect(pourLeRappel).toHaveLength(2);
  });
});
