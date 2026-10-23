/**
 * Relecture finale A09 (PR #254), défaut 1 : sur la chaîne courte, un supplément (« + Je lis », « + Autre format »,
 * « + Tu ») gardait le plafond en dur de la grande chaîne (0,70 $ / 0,95 $), alors que son pire cas compte le script,
 * la relecture et une déclinaison par réseau en plus (0,539 / 0,691 / 0,865 $ pour 1 / 2 / 3 réseaux) : refusé dès
 * 3 réseaux, et sans issue (« Reprendre » grisé à vie, aucun réglage à relever). Après correction :
 *  - chaîne courte : le plafond d'un supplément est le réglage `generateur.plafondSujetUsd` (1,50 $ par défaut) ;
 *  - grande chaîne : les suppléments gardent leurs plafonds ; une retouche garde le sien ;
 *  - jamais de blocage sans issue : le message et la reprise nomment le réglage à relever.
 * Réserve RÉELLE (faux Claude facturé au pire, `fetch` interdit ailleurs), 0 $ réel.
 */
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { mockHeaders, mockNavigation, reinitialiserRequete } from "../helpers/next-mocks";
import { preparerMotDePasse } from "../helpers/g1a";
import { CLE_ESSAI_CLAUDE, reponseFlux, fluxReussi } from "../helpers/g0";
import { SUJETS_BANC } from "../generateur/banc/registre-banc-g4";

vi.mock("next/headers", () => mockHeaders);
vi.mock("next/navigation", () => mockNavigation);
vi.setConfig({ testTimeout: 60_000 });

const { reinitialiserDepots, depots } = await import("@/donnees/memoire");
const auth = await import("@/services/auth");
const credits = await import("@/services/credits");
const gc = await import("@/services/generation-claude");
const bg = await import("@/services/boucle-generation");
const { ecrireParametre } = await import("@/services/_commun");
const { creerLecteurAnthropic } = await import("@/fournisseurs/credits/suivis");
const { ROLES_ECRITURE } = await import("@/generateur/roles");
const { ROLES_CHAINE_COURTE, ROLES_CHAINE_COURTE_HORS_RECETTE } = await import("@/generateur/chaine-courte");
const { jetonsEstimes } = await import("@/fournisseurs/claude/tarifs");
const { usdVersEur } = await import("@/lib/montants");
import type { DefinitionRole } from "@/generateur/roles/types";
import type { ReseauDeclinaison } from "@/domaine/types";

const MDP = "essai-chaine-courte-supplements";
const fetchInterdit = (async () => {
  throw new Error("réseau interdit");
}) as typeof fetch;

beforeAll(async () => {
  await preparerMotDePasse(MDP);
});

beforeEach(async () => {
  reinitialiserDepots();
  reinitialiserRequete();
  bg.suspendreBoucleGeneration(true);
  await auth.seConnecter(MDP, false);
  for (const m of SUJETS_BANC.flatMap((s) => s.matieres)) await depots().matieres.enregistrer(m);
  for (const p of SUJETS_BANC.flatMap((s) => s.preuves)) await depots().preuves.enregistrer(p);
});

afterEach(() => {
  bg.arreterBoucleGeneration();
  credits.injecterLecteursPourEssai(null);
  gc.injecterClaudePourEssai(null);
});

const S = SUJETS_BANC[0];
const CINQ: ReseauDeclinaison[] = ["tiktok", "instagram", "youtube-shorts", "linkedin", "facebook"];

/** Faux Claude FACTURÉ AU PIRE (même règle que `boucle.test.ts`) : toute l'entrée, `maxTokens` en sortie. */
function claudeAuPire(liste: DefinitionRole[]) {
  const appels: string[] = [];
  const vus = new Set<string>();
  const f = (async (_url: string | URL | Request, init?: RequestInit) => {
    const brut = String(init?.body ?? "{}");
    const corps = JSON.parse(brut) as { system: { text: string; cache_control?: unknown }[]; messages: { content: string }[] };
    const consigne = corps.system.at(-1)!.text;
    const role = liste.find((r) => consigne.startsWith(r.consigne.trim()))!;
    appels.push(role.id);
    const bloc = (b: string) => corps.system.find((x) => x.text.startsWith(`<${b}>`))?.text.replace(new RegExp(`^<${b}>\\n|\\n</${b}>$`, "g"), "");
    const sortie = role.simuler({ contexte: { contexteAxion: bloc("contexte_axion"), styleWill: bloc("style_will"), preuves: bloc("preuves"), gagnants: bloc("gagnants") }, variable: corps.messages[0].content });
    const total = jetonsEstimes(brut);
    const socle = vus.has(role.id) ? 0 : jetonsEstimes(corps.system.filter((b) => b.cache_control).map((b) => b.text).join("\n"));
    vus.add(role.id);
    return reponseFlux(fluxReussi({ texte: JSON.stringify(sortie), modele: role.modele, entree: total - socle, cacheEcrit: socle, cacheLu: 0, sortie: role.maxTokens }));
  }) as typeof fetch;
  return { fetch: f, appels };
}

async function brancherAuPire() {
  credits.injecterLecteursPourEssai([creerLecteurAnthropic({ ANTHROPIC_API_KEY: CLE_ESSAI_CLAUDE }, fetchInterdit)], ["anthropic"]);
  await credits.declarerRecharge("anthropic", 100_000);
  await ecrireParametre("fournisseur.script", "claude");
  const claude = claudeAuPire([...Object.values(ROLES_CHAINE_COURTE), ...Object.values(ROLES_CHAINE_COURTE_HORS_RECETTE), ROLES_ECRITURE.declinaison] as DefinitionRole[]);
  gc.injecterClaudePourEssai({ cle: CLE_ESSAI_CLAUDE, fetch: claude.fetch, attenteMs: () => 0 });
  return claude;
}

/** Un sujet écrit par la chaîne courte, facturée au pire, sur ces réseaux. */
async function sujetEcrit(reseaux: ReseauDeclinaison[], formatId = "avocat") {
  await ecrireParametre(bg.PARAM_CHAINE, "courte");
  const r = await bg.lancerGeneration({ idee: S.idee, reseaux, formatId, pilier: S.pilier.id, mode: "avatar" });
  if (!r.ok) throw new Error(`lancement : ${r.ceQuIlFaudrait}`);
  await bg.tourBoucleGeneration();
  expect((await depots().generations.obtenir(r.generationId))?.statut).toBe("terminee");
  return r;
}

async function supplement(id: string, options: Parameters<typeof bg.ajouterDeclinaison>[1]) {
  const s = await bg.ajouterDeclinaison(id, options);
  if (!s.ok) throw new Error(`supplément : ${s.ceQuIlFaudrait}`);
  return s;
}

const SUPPLEMENTS = [
  { nom: "+ Je lis", options: { mode: "teleprompteur" as const }, suffixe: "" },
  { nom: "+ Tu", options: { adresse: "tu" as const }, suffixe: "-T" },
];

describe("chaîne courte : un supplément a le plafond du réglage `generateur.plafondSujetUsd`", () => {
  for (const n of [1, 3, 5]) {
    for (const sup of SUPPLEMENTS) {
      it(`${sup.nom}, ${n} réseau(x), facturé au pire : réservé sous 1,50 $, il va au bout, dépense ≤ pire cas`, async () => {
        const claude = await brancherAuPire();
        const r = await sujetEcrit(CINQ.slice(0, n));
        const s = await supplement(r.scriptMaitreId, sup.options);
        claude.appels.length = 0;
        expect((await depots().generations.obtenir(s.generationId))?.plafondUsd).toBe(1.5);
        await bg.tourBoucleGeneration();
        const reserve = await gc.lireReserveChaine(s.generationId);
        expect(reserve).toMatchObject({ accepte: true, chaine: "courte", reglage: "generateur.plafondSujetUsd", plafondUsd: 1.5 });
        const g = (await depots().generations.obtenir(s.generationId))!;
        expect(g.statut).toBe("terminee");
        expect(gc.depenseGenerationUsd(g)).toBeLessThanOrEqual(reserve!.pireCasUsd + 1e-9);
        expect(claude.appels.filter((x) => x === "declinaison")).toHaveLength(n - 1);
        if (sup.suffixe) expect(await depots().variantes.compter((v) => v.scriptMaitreId === r.scriptMaitreId && v.code.endsWith(sup.suffixe))).toBe(n);
      });

      it(`face caméra : ${sup.nom}, ${n} réseau(x), facturé au pire : réservé sous 1,50 $, il va au bout, dépense ≤ pire cas (une seule ouverture, aucune déclinaison payée)`, async () => {
        const claude = await brancherAuPire();
        const r = await sujetEcrit(CINQ.slice(0, n), "facecam");
        const s = await supplement(r.scriptMaitreId, sup.options);
        claude.appels.length = 0;
        expect((await depots().generations.obtenir(s.generationId))?.plafondUsd).toBe(1.5);
        await bg.tourBoucleGeneration();
        const reserve = await gc.lireReserveChaine(s.generationId);
        expect(reserve).toMatchObject({ accepte: true, chaine: "courte", reglage: "generateur.plafondSujetUsd", plafondUsd: 1.5 });
        const g = (await depots().generations.obtenir(s.generationId))!;
        expect(g.statut).toBe("terminee");
        expect(gc.depenseGenerationUsd(g)).toBeLessThanOrEqual(reserve!.pireCasUsd + 1e-9);
        expect(claude.appels.filter((x) => x === "declinaison")).toHaveLength(0);
        if (sup.suffixe) expect(await depots().variantes.compter((v) => v.scriptMaitreId === r.scriptMaitreId && v.code.endsWith(sup.suffixe))).toBe(1);
      });
    }
  }

  it("pire cas au-dessus du réglage : refusé avant le 1er appel, le message et « Reprendre » nomment le réglage ; relevé, la reprise part", async () => {
    const claude = await brancherAuPire();
    const r = await sujetEcrit(CINQ.slice(0, 3));
    await ecrireParametre(gc.PARAM_PLAFOND_SUJET, 0.4);
    const s = await supplement(r.scriptMaitreId, { mode: "teleprompteur" });
    claude.appels.length = 0;
    await bg.tourBoucleGeneration();
    expect((await depots().generations.obtenir(s.generationId))?.statut).toBe("plafond-atteint");
    expect(claude.appels).toHaveLength(0);
    expect(await gc.lireReserveChaine(s.generationId)).toMatchObject({ accepte: false, reglage: "generateur.plafondSujetUsd" });
    expect(await gc.phraseReserveRefusee(s.generationId)).toMatch(/relevez le réglage « generateur\.plafondSujetUsd »/);
    const bloque = await bg.devisRepriseDuSujet(r.scriptMaitreId);
    expect(bloque.possible).toBe(false);
    expect(bloque.raison).toMatch(/relevez le réglage « generateur\.plafondSujetUsd »/);
    // Will relève le réglage : la reprise est possible, à un prix confirmé, et va au bout.
    await ecrireParametre(gc.PARAM_PLAFOND_SUJET, 1.5);
    const devis = await bg.devisRepriseDuSujet(r.scriptMaitreId);
    expect(devis.possible).toBe(true);
    expect(devis.centimesEur).toBeGreaterThan(0);
    expect(await bg.reprendreEcriture(r.scriptMaitreId, devis.centimesEur)).toBe(1);
    await bg.tourBoucleGeneration();
    expect((await depots().generations.obtenir(s.generationId))).toMatchObject({ statut: "terminee", plafondUsd: 1.5 });
  });
});

describe("grande chaîne et retouches : leurs plafonds ne changent pas", () => {
  it("grande : « + Je lis » 0,70 $, « + Tu » 0,95 $ ; courte : le réglage ; retouche : 0,70 $ même sur la courte", async () => {
    const taux = 0.92;
    await ecrireParametre("taux.usdEur", taux);
    expect(await bg.prixLancement(true, "grande")).toEqual(usdVersEur(70, taux));
    expect(await bg.prixLancement("adresse", "grande")).toEqual(usdVersEur(95, taux));
    expect(await bg.prixLancement(true, "courte")).toEqual(usdVersEur(150, taux));
    expect(await bg.prixLancement("adresse", "courte")).toEqual(usdVersEur(150, taux));
    await ecrireParametre(gc.PARAM_PLAFOND_SUJET, 2);
    expect(await bg.prixLancement(true, "courte")).toEqual(usdVersEur(200, taux));
    await ecrireParametre(bg.PARAM_CHAINE, "courte");
    expect(await bg.prixRetouche()).toEqual(usdVersEur(70, taux));
  });
});
