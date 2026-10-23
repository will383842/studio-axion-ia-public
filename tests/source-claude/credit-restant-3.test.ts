/** Crédit restant, lot 3 : corrections de relecture de #572 (mode abonnements sans compte, groupe de clés, textes, avertissement). */
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { mockHeaders, mockNavigation, reinitialiserRequete } from "../helpers/next-mocks";
import { preparerMotDePasse } from "../helpers/g1a";

vi.mock("next/headers", () => mockHeaders);
vi.mock("next/navigation", () => ({ ...mockNavigation, usePathname: () => "/reglages", useSearchParams: () => new URLSearchParams(), useRouter: () => ({ refresh: () => {}, push: () => {}, replace: () => {} }) }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn(), revalidateTag: vi.fn() }));
vi.mock("@/components/generateur/EcritureEnCours", () => ({ EcritureEnCours: () => null }));
vi.stubGlobal("fetch", (async () => {
  throw new Error("réseau interdit");
}) as typeof fetch);

const { reinitialiserDepots } = await import("@/donnees/memoire");
const auth = await import("@/services/auth");
const cc = await import("@/services/credit-claude");
const credits = await import("@/services/credits");
const travaux = await import("@/services/travaux");
const { depots, ecrireParametre } = await import("@/services/_commun");
const { PARAM_SOURCES_CLAUDE } = await import("@/domaine/source-claude");
const { bandeauCredit } = await import("@/domaine/credits");
const { avertissementCreditClaude } = await import("@/domaine/credit-claude");
const { Credits } = await import("@/components/reglages/Credits");
const { CreditClaude } = await import("@/components/reglages/CreditClaude");
const { dateCourte } = await import("@/lib/dates");

const MDP = "credit-restant-3";
const CLE_1 = "sk-ant-fausse-cle-un-AAAA1111BBBB";
const CLE_API = "sk-ant-fausse-cle-api-EEEE3333FFFF";
const TOUS = ["abonnement-1", "abonnement-2", "abonnement-3"];
const VARS = ["ANTHROPIC_API_KEY", "ANTHROPIC_API_KEY_2", "ANTHROPIC_API_KEY_3", "ANTHROPIC_API_KEY_PAYANTE"];
const ENV_GROUPE = { ANTHROPIC_API_KEY: CLE_1, ANTHROPIC_API_KEY_2: CLE_1, ANTHROPIC_API_KEY_3: CLE_1, ANTHROPIC_API_KEY_PAYANTE: CLE_API };
const cycle = (debut: string, expireLe: string | null = null, prochainLe: string | null = null) => ({ montantCentimes: 20000, debut, expireLe, prochainLe });

async function reglerAbonnements(desactives: string[] = []) {
  await ecrireParametre(PARAM_SOURCES_CLAUDE, { mode: "abonnements", ordre: TOUS, desactives, changeLe: null });
}
async function travailEnAttenteClaude() {
  const le = new Date().toISOString();
  await depots().travaux.enregistrer({ id: "trv-r3", type: "fabrication", videoId: "vid-r3", statut: "en_cours", etapes: [], reprise: { motif: "credit", fournisseurCredit: "anthropic", prochainEssai: le, essais: 1 }, creeLe: le, modifieLe: le } as never);
}
const carteClaude = async () => (await credits.vueCredits()).find((c) => c.fournisseur === "anthropic")!;

beforeAll(async () => {
  await preparerMotDePasse(MDP);
});
beforeEach(async () => {
  reinitialiserDepots();
  reinitialiserRequete();
  vi.unstubAllEnvs();
  for (const v of VARS) vi.stubEnv(v, "");
  await auth.seConnecter(MDP, false);
  await reglerAbonnements();
});

describe("1 — mode abonnements sans compte utilisable : jamais « recharger »", () => {
  const cas = [
    { nom: "tous les comptes désactivés", env: { ANTHROPIC_API_KEY: CLE_1, ANTHROPIC_API_KEY_PAYANTE: CLE_API }, desactives: TOUS },
    { nom: "clé payante seule", env: { ANTHROPIC_API_KEY_PAYANTE: CLE_API }, desactives: [] as string[] },
    { nom: "doublons de la clé payante (clés 1 et 2 = clé payante)", env: { ANTHROPIC_API_KEY: CLE_API, ANTHROPIC_API_KEY_2: CLE_API, ANTHROPIC_API_KEY_PAYANTE: CLE_API }, desactives: [] as string[] },
  ];
  for (const c of cas) {
    it(`${c.nom} : bandeau sans « recharg », message « Aucun compte Claude actif »`, async () => {
      for (const [k, v] of Object.entries(c.env)) vi.stubEnv(k, v);
      await reglerAbonnements(c.desactives);
      await travailEnAttenteClaude();
      const carte = await carteClaude();
      expect(carte.abonnements).toBe(true);
      expect(carte.aucunCompte).toBe(true);
      const bandeau = bandeauCredit(await credits.vueCredits());
      expect(bandeau).not.toBeNull();
      const texte = bandeau!.lignes.join(" ");
      expect(texte).not.toMatch(/recharg/i);
      expect(texte).toContain("Aucun compte Claude actif : posez une clé d'abonnement ou passez en API payante");
    });
    it(`${c.nom} : Réglages > Crédits propose la console, jamais « Recharger »`, async () => {
      for (const [k, v] of Object.entries(c.env)) vi.stubEnv(k, v);
      await reglerAbonnements(c.desactives);
      const html = renderToStaticMarkup(createElement(Credits, { cartes: await credits.vueCredits() }));
      expect(html).toContain("Ouvrir la console");
      const claude = html.slice(html.indexOf("Claude"));
      expect(claude.split("</li>")[0]).not.toMatch(/Recharger/);
    });
  }
  it("mode api : « Recharger » reste proposé", async () => {
    vi.stubEnv("ANTHROPIC_API_KEY_PAYANTE", CLE_API);
    await ecrireParametre(PARAM_SOURCES_CLAUDE, { mode: "api", ordre: TOUS, desactives: [], changeLe: null });
    const carte = await carteClaude();
    expect(carte.abonnements).toBeUndefined();
    expect(renderToStaticMarkup(createElement(Credits, { cartes: [carte] }))).toContain("Recharger");
  });
});

describe("2 — groupe de comptes à clé partagée : cycle et relevé les plus récents", () => {
  it("cycle propre plus récent sur un compte du groupe : il gagne", async () => {
    await cc.enregistrerCycleCredit("abonnement-1", cycle("2026-08-01", "2026-09-01"));
    await cc.enregistrerCycleCredit("abonnement-3", cycle("2026-10-01", "2026-11-01", "2026-11-02"));
    const v = await cc.vueCreditClaude(ENV_GROUPE);
    const c1 = v.comptes.find((c) => c.source === "abonnement-1")!;
    expect(c1.expireLe).toBe("2026-11-01");
    expect(c1.prochainLe).toBe("2026-11-02");
    expect(c1.cycle?.debut).toBe("2026-08-01"); // le formulaire reste pré-rempli avec son propre cycle
    expect(c1.cycleSaisiSurTexte).toBe("Le cycle est saisi sur le compte 3.");
    expect(v.comptes.find((c) => c.source === "abonnement-3")!.cycleSaisiSurTexte).toBeNull();
  });
  it("compte 1 désactivé avec ancien cycle + compte 3 même clé : le cycle du compte 3 est lu", async () => {
    await reglerAbonnements(["abonnement-1"]);
    await cc.enregistrerCycleCredit("abonnement-1", cycle("2026-01-01", "2026-02-01"));
    await cc.enregistrerCycleCredit("abonnement-3", cycle("2026-10-01", "2026-11-01"));
    const v = await cc.vueCreditClaude(ENV_GROUPE);
    const c2 = v.comptes.find((c) => c.source === "abonnement-2")!;
    expect(c2.expireLe).toBe("2026-11-01");
    expect(c2.cycleSaisiSurTexte).toMatch(/compte 3/);
    expect(c2.cycleSaisiSurTexte).not.toMatch(/compte 1/);
  });
  it("relevé le plus récent du groupe, et deux textes distincts cycle / relevé", async () => {
    await cc.enregistrerCycleCredit("abonnement-1", cycle("2026-10-01"));
    await cc.enregistrerReleveCredit("abonnement-2", 5000);
    const c3 = (await cc.vueCreditClaude(ENV_GROUPE)).comptes.find((c) => c.source === "abonnement-3")!;
    expect(c3.cycleSaisiSurTexte).toBe("Le cycle est saisi sur le compte 1. Le relevé est saisi sur le compte 2.");
    expect(c3.releveLe).not.toBeNull();
  });
});

describe("3/4 — affichage du texte « saisi sur le compte » dans Réglages", () => {
  it("CreditClaude le montre sous le motif « hors total »", async () => {
    await cc.enregistrerCycleCredit("abonnement-1", cycle("2026-10-01"));
    const vue = await cc.vueCreditClaude(ENV_GROUPE);
    const html = renderToStaticMarkup(createElement(CreditClaude, { vue }));
    expect(html).toContain("Le cycle est saisi sur le compte 1.");
  });
});

describe("5 — écriture en attente, mode abonnements sans compte", () => {
  async function sujetEnAttente(attente: Record<string, unknown> | null) {
    const le = new Date().toISOString();
    const g = { id: "gen-r3", scriptMaitreId: "suj-r3", hachageContexte: "h", plafondUsd: 1.5, portee: "sujet", etapes: [], statut: "en-attente-credit", creeLe: le, modifieLe: le };
    await depots().generations.enregistrer(g as never);
    await depots().scriptsMaitres.enregistrer({ id: g.scriptMaitreId, brief: { idee: "PV" }, generationId: g.id } as never);
    if (attente) await ecrireParametre(`generateur.attenteCredit.${g.id}`, { depuis: le, estimationUsd: 1, lignes: [], ...attente });
    return g;
  }
  it("le message dit « Aucun compte Claude actif », jamais « renouvellement » ni « recharge »", async () => {
    vi.stubEnv("ANTHROPIC_API_KEY_PAYANTE", CLE_API);
    const g = await sujetEnAttente(null);
    const e = await (await import("@/services/boucle-generation")).etatEcriture(g.scriptMaitreId);
    expect(e?.aucunCompte).toBe(true);
    expect(e?.messageAttente).toContain("Aucun compte Claude actif");
    expect(e?.reprise?.raison).toContain("Aucun compte Claude actif");
    expect(e?.messageAttente).not.toMatch(/recharg|renouvel/i);
    expect(e?.reprise?.raison).not.toMatch(/recharg|renouvel/i);
  });
  it("un ancien message d'attente « rechargez… » (enregistré en mode API) ne reste pas affiché", async () => {
    vi.stubEnv("ANTHROPIC_API_KEY_PAYANTE", CLE_API);
    const g = await sujetEnAttente({ motif: "facturation", message: "Crédit Claude insuffisant : rechargez votre compte." });
    const e = await (await import("@/services/boucle-generation")).etatEcriture(g.scriptMaitreId);
    expect(e?.messageAttente).toContain("Aucun compte Claude actif");
    expect(e?.messageAttente).not.toMatch(/recharg/i);
  });
});

describe("5 bis — fiche sujet : aucunCompte parvient à EcritureEnCours", () => {
  it("la page passe aucunCompte vrai (donc pas de « Toujours bloquée : rechargez Claude »)", async () => {
    vi.stubEnv("ANTHROPIC_API_KEY_PAYANTE", CLE_API);
    const le = new Date().toISOString();
    await depots().generations.enregistrer({ id: "gen-p3", scriptMaitreId: "suj-p3", hachageContexte: "h", plafondUsd: 1.5, portee: "sujet", etapes: [], statut: "en-attente-credit", creeLe: le, modifieLe: le } as never);
    await depots().scriptsMaitres.enregistrer({ id: "suj-p3", brief: { idee: "PV" }, generationId: "gen-p3" } as never);
    const Page = (await import("@/app/(studio)/ecrire/sujets/[id]/page")).default;
    const arbre = (await Page({ params: Promise.resolve({ id: "suj-p3" }), searchParams: Promise.resolve({}) })) as { props: { children: { props?: { etat?: Record<string, unknown> } }[] } };
    const etat = arbre.props.children.find((c) => c?.props?.etat)?.props?.etat;
    expect(etat).toBeDefined();
    expect(etat!.aucunCompte).toBe(true);
    expect(JSON.stringify(etat!.message ?? "")).not.toMatch(/recharg/i);
  });
});

describe("5 ter — bandeau : clé refusée + abonnements sans compte", () => {
  it("le bandeau ne se tait pas quand cleRefusee est vrai", () => {
    const b = bandeauCredit([{ fournisseur: "anthropic", nom: "Claude", cleRefusee: true, videosRestantes: null, enAttente: 0, abonnements: true, aucunCompte: true }]);
    expect(b?.lignes.join(" ")).toContain("Aucun compte Claude actif");
  });
});

describe("5 quater — compte « clé payante » : pas de restant chiffré", () => {
  it("restantCentimes est null pour un compte exclu comme clé payante", async () => {
    vi.stubEnv("ANTHROPIC_API_KEY", CLE_API);
    vi.stubEnv("ANTHROPIC_API_KEY_PAYANTE", CLE_API);
    const vue = await cc.vueCreditClaude();
    const c = vue.comptes.find((x) => x.source === "abonnement-1")!;
    expect(c.restantTexte).toBe("Clé payante : pas de restant");
    expect(c.restantCentimes).toBeNull();
  });
});

describe("6 — suivi d'un travail en attente (versVue)", () => {
  it("mode abonnements sans clé : aucunCompteClaude, pas abonnementsClaude", async () => {
    await travailEnAttenteClaude();
    const [v] = await travaux.listerTravaux();
    expect(v!.aucunCompteClaude).toBe(true);
    expect(v!.abonnementsClaude).toBe(false);
  });
  it("une clé d'abonnement utilisable : abonnementsClaude, pas aucunCompte", async () => {
    vi.stubEnv("ANTHROPIC_API_KEY", CLE_1);
    await travailEnAttenteClaude();
    const [v] = await travaux.listerTravaux();
    expect(v!.abonnementsClaude).toBe(true);
    expect(v!.aucunCompteClaude).toBe(false);
  });
});

describe("7 — avertissement : relais seulement s'il existe", () => {
  const MAINT = "2026-10-19T10:00:00.000Z";
  const c = (n: number, centimes: number | null, extra: Record<string, unknown> = {}) => ({ source: `abonnement-${n}`, etat: centimes === null ? "a-renseigner" : "estime", restantCentimes: centimes, prochainLe: null, releveLe: null, horsTotalTexte: null, ...extra });
  const avert = (comptes: unknown[]) => avertissementCreditClaude({ mode: "abonnements", maintenant: MAINT, comptes: comptes as never });
  it("dernier compte presque vide : pas de relais", () => {
    expect(avert([c(1, 15000), c(2, 1500)])?.texte).toBe("Compte 2 presque vide");
  });
  it("suivant vide ou hors total : pas de relais", () => {
    expect(avert([c(1, 1500), c(2, 0)])?.texte).not.toMatch(/relais/);
    expect(avert([c(1, 1500), c(2, 9000, { horsTotalTexte: "Compte désactivé : hors total." })])?.texte).not.toMatch(/relais/);
  });
  it("suivant non vide : relais", () => {
    expect(avert([c(1, 1500), c(2, 9000)])?.texte).toBe("Compte 1 presque vide : le compte suivant prendra le relais");
  });
  it("un compte à 0 $ est « vide », pas « presque vide »", () => {
    const t = avert([c(1, 0), c(2, 9000)])?.texte;
    expect(t).toBe("Compte 1 vide : le compte suivant prendra le relais");
    expect(t).not.toMatch(/presque/);
  });
});

describe("8 — total partiel, dates invalides", () => {
  it("une partie « À renseigner » : « sur N compte(s) renseigné(s) »", async () => {
    await cc.enregistrerCycleCredit("abonnement-1", cycle("2026-10-01"));
    const v = await cc.vueCreditClaude({ ANTHROPIC_API_KEY: CLE_1, ANTHROPIC_API_KEY_2: "sk-ant-fausse-cle-deux-CCCC2222DDDD", ANTHROPIC_API_KEY_PAYANTE: CLE_API });
    expect(v.totalTexte).toMatch(/sur 1 compte renseigné$/);
  });
  it("tout renseigné ou rien : texte inchangé", async () => {
    expect((await cc.vueCreditClaude({ ANTHROPIC_API_KEY: CLE_1 })).totalTexte).toBe("À renseigner");
    await cc.enregistrerCycleCredit("abonnement-1", cycle("2026-10-01"));
    expect((await cc.vueCreditClaude({ ANTHROPIC_API_KEY: CLE_1 })).totalTexte).not.toMatch(/sur/);
  });
  it("dateCourte d'une date invalide : pas de RangeError", () => {
    expect(() => dateCourte("pas-une-date")).not.toThrow();
    expect(dateCourte("2026-10-19T10:00:00.000Z")).toMatch(/19/);
  });
});
