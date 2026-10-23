/**
 * Alertes de crédit claires : une seule notification « épuisé » par fournisseur jusqu'à la recharge, message avec
 * solde et ≈ N vidéos, alerte « ≈ 10 » avant les pourcentages, bandeau de l'Accueil.
 * Aucun appel réel : lecteurs « suivis » sans réseau. Claude n'a plus de solde deviné (18/10) : l'alerte de solde bas
 * (≈ N, pourcentages) est portée par fal.ai, seul solde suivi restant ; Claude n'alerte que sur le refus d'Anthropic.
 */
import { hash } from "@node-rs/argon2";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { mockHeaders, mockNavigation, reinitialiserRequete } from "./helpers/next-mocks";

vi.mock("next/headers", () => mockHeaders);
vi.mock("next/navigation", () => mockNavigation);

const { reinitialiserDepots, depots } = await import("@/donnees/memoire");
const auth = await import("@/services/auth");
const credits = await import("@/services/credits");
import * as dom from "@/domaine/credits";
import { creerLecteurAnthropic, creerLecteurFal } from "@/fournisseurs/credits/suivis";
import type { DepenseEnregistree, LigneCout } from "@/domaine/types";
import { centimes } from "@/lib/montants";

const MDP = "essai-alertes-claires";

beforeAll(async () => {
  process.env.SESSION_SECRET = "d".repeat(48);
  const empreinte = await hash(MDP, { algorithm: 2, memoryCost: 19456, timeCost: 2, parallelism: 1 });
  process.env.STUDIO_PASSWORD_HASH_B64 = Buffer.from(empreinte).toString("base64");
});

beforeEach(async () => {
  reinitialiserDepots();
  reinitialiserRequete();
  const sansReseau = (async () => { throw new Error("aucun appel attendu"); }) as unknown as typeof fetch;
  credits.injecterLecteursPourEssai([creerLecteurAnthropic({ ANTHROPIC_API_KEY: "sk-ant-ESSAI-cle-secrete-abcdefghijklmnop-K9x2" }, sansReseau), creerLecteurFal({ FAL_KEY: "fal_essai_0123456789abcdef" }, sansReseau)], ["anthropic", "fal"]);
  await auth.seConnecter(MDP, false);
  // Mode « api » (choix manuel de Will) : l'alerte Claude « Rechargez » d'avant. En mode « abonnements », l'alerte ne part
  // que si tous les comptes sont épuisés, avec une phrase sans « recharger » (tests/source-claude/corrections.test.ts).
  const { ecrireParametre } = await import("@/services/_commun");
  await ecrireParametre("claude.sources", { mode: "api", ordre: ["abonnement-1", "abonnement-2", "abonnement-3"], desactives: [], changeLe: null });
});

afterEach(() => credits.injecterLecteursPourEssai(null));

async function recharge(centimesUsd: number, date = new Date(Date.now() - 3600_000).toISOString(), fournisseur = "anthropic") {
  await depots().recharges.enregistrer({ id: `r-${Math.random()}`, fournisseur, centimes: centimesUsd, devise: "USD", date, creeLe: date, modifieLe: date });
}

async function depenseScript(scriptMaitreId: string, centimesEur: number, date: string) {
  const l: LigneCout = { etape: "Écriture", fournisseur: "anthropic", unite: "appel", quantite: 1, prixUnitaire: centimes(centimesEur), total: centimes(centimesEur), nature: "reel" };
  const dep: DepenseEnregistree = { id: `dep-${Math.random()}`, scriptMaitreId, lignes: [l], total: l.total, date, creeLe: date, modifieLe: date };
  await depots().depenses.enregistrer(dep);
}

/** Dépense réelle d'une vidéo chez fal.ai (le coût moyen d'une unité vient des vidéos payées). */
async function depenseVideo(videoId: string, centimesEur: number, date: string) {
  const l: LigneCout = { etape: "Images", fournisseur: "fal", unite: "forfait", quantite: 1, prixUnitaire: centimes(centimesEur), total: centimes(centimesEur), nature: "reel" };
  const dep: DepenseEnregistree = { id: `dep-${Math.random()}`, videoId, lignes: [l], total: l.total, date, creeLe: date, modifieLe: date };
  await depots().depenses.enregistrer(dep);
}

const alertes = () => depots().notifications.lister((n) => n.type === "credit");

describe("« épuisé » : une seule notification", () => {
  it("9 écritures bloquées = 1 notification ; une recharge déclarée en autorise une nouvelle", async () => {
    await recharge(500);
    for (let i = 0; i < 9; i++) await credits.signalerAttenteCredit(null, "anthropic");
    const liste = await alertes();
    expect(liste).toHaveLength(1);
    expect(liste[0].titre).toBe("Crédit Claude épuisé");
    expect(liste[0].message).toContain("Rechargez votre compte Claude");
    await credits.declarerRecharge("anthropic", 2000);
    await credits.signalerAttenteCredit(null, "anthropic");
    await credits.signalerAttenteCredit(null, "anthropic");
    expect(await alertes()).toHaveLength(2);
  });

  it("un autre fournisseur a sa propre notification", async () => {
    await credits.signalerAttenteCredit(null, "anthropic");
    await credits.signalerAttenteCredit(null, "heygen");
    await credits.signalerAttenteCredit(null, "heygen");
    expect((await alertes()).map((n) => n.titre).sort()).toEqual(["Crédit Claude épuisé", "Crédit HeyGen épuisé"]);
  });

  it("repart après 24 h", async () => {
    vi.useFakeTimers();
    try {
      await credits.signalerAttenteCredit(null, "anthropic");
      vi.setSystemTime(Date.now() + 25 * 3600_000);
      await credits.signalerAttenteCredit(null, "anthropic");
      expect(await alertes()).toHaveLength(2);
    } finally {
      vi.useRealTimers();
    }
  });
});

describe("alerte « ≈ 10 vidéos » (fal.ai, solde suivi)", () => {
  it("part une seule fois, avant tout pourcentage, avec solde et ≈ N vidéos ; la recharge la ré-arme", async () => {
    await recharge(60000, undefined, "fal");
    const t = new Date(Date.now() - 1800_000).toISOString();
    await depenseVideo("v1", 5000, t);
    await depenseVideo("v2", 5000, t);
    await credits.surveillerCredits({ force: true });
    await credits.surveillerCredits({ force: true });
    const liste = await alertes();
    expect(liste).toHaveLength(1);
    expect(liste[0].titre).toMatch(/^fal\.ai : ≈ \d+ vidéos? restantes?$/);
    expect(liste[0].message).toMatch(/Il reste .*\$ \(≈ \d+ vidéos? restantes?\)\. Rechargez votre compte fal\.ai\./);
    await credits.declarerRecharge("fal", 60000);
    await credits.surveillerCredits({ force: true });
    expect(await alertes()).toHaveLength(1);
  });

  it("une-video part seule : pas de 2e alerte « ≈ 0 » au passage suivant", async () => {
    await recharge(60000, undefined, "fal");
    const t = new Date(Date.now() - 1800_000).toISOString();
    await depenseVideo("v1", 5000, t);
    await depenseVideo("v2", 5000, t);
    await depenseVideo("v3", 49000, t); // le reste tombe sous une vidéo
    await credits.surveillerCredits({ force: true });
    await credits.surveillerCredits({ force: true });
    expect((await alertes()).map((n) => n.titre)).toEqual(["fal.ai : plus qu'une vidéo"]);
  });

  it("Claude : aucune alerte de solde bas (solde inconnu), même avec une recharge déclarée et de grosses dépenses", async () => {
    await recharge(60000);
    const t = new Date(Date.now() - 1800_000).toISOString();
    await depenseScript("s1", 5000, t);
    await depenseScript("s2", 49000, t);
    await credits.surveillerCredits({ force: true });
    await credits.surveillerCredits({ force: true });
    expect(await alertes()).toHaveLength(0);
  });

  it("domaine : clé « 10-videos » seulement si ≤ 10 restantes et pas déjà signalée", () => {
    expect(dom.alerteAEnvoyer(80, 1000, 100, [])).toEqual({ cle: "10-videos", email: true });
    expect(dom.alerteAEnvoyer(80, 1000, 100, ["10-videos"])).toBeNull();
    expect(dom.alerteAEnvoyer(80, 1100, 100, [])).toBeNull();
  });
});

describe("messages et bandeau (purs)", () => {
  it("Claude parle en scripts, les autres en vidéos", () => {
    expect(dom.texteRestant("anthropic", 1)).toBe("≈ 1 script");
    expect(dom.texteRestant("heygen", 8)).toBe("≈ 8 vidéos");
    const m = dom.messageAlerteCredit({ nom: "HeyGen", fournisseur: "heygen", cle: "25", disponibleTexte: "12,00 $", restantes: 8 });
    expect(m.titre).toBe("HeyGen : crédit sous 25 % · ≈ 8 vidéos restantes");
    expect(m.message).toBe("Il reste 12,00 $ (≈ 8 vidéos restantes). Rechargez votre compte HeyGen.");
  });

  it("bandeau : rien si > 10 ; épuisé ou ≤ 10 sinon", () => {
    const base = { fournisseur: "heygen", nom: "HeyGen", cleRefusee: false, enAttente: 0 };
    expect(dom.bandeauCredit([{ ...base, videosRestantes: 11 }, { ...base, videosRestantes: null }])).toBeNull();
    expect(dom.bandeauCredit([{ ...base, videosRestantes: 7 }])).toEqual({ epuise: false, lignes: ["HeyGen : ≈ 7 vidéos restantes. Rechargez bientôt."] });
    expect(dom.bandeauCredit([{ ...base, videosRestantes: 5, enAttente: 2 }])?.epuise).toBe(true);
    expect(dom.bandeauCredit([{ ...base, videosRestantes: null, epuise: true }])?.epuise).toBe(true);
  });
});

describe("correctif après relecture", () => {
  it("chute de 15 à moins de 1 entre deux passages = UNE seule alerte (« une-video » couvre « 10-videos »), sur fal.ai", async () => {
    expect(dom.alerteAEnvoyer(50, 50, 100, ["une-video"])).toBeNull();
    await recharge(1500, undefined, "fal");
    const t = new Date(Date.now() - 1800_000).toISOString();
    await depenseVideo("v1", 1, t);
    await credits.surveillerCredits({ force: true });
    // le solde tombe sous une vidéo entre deux passages
    await depenseVideo("v2", 1500, t);
    await credits.surveillerCredits({ force: true });
    await credits.surveillerCredits({ force: true });
    const titres = (await alertes()).map((n) => n.titre);
    expect(titres.filter((x) => /plus qu'un/.test(x))).toHaveLength(1);
    expect(titres.filter((x) => /≈ 0/.test(x))).toHaveLength(0);
  });

  it("« épuisé » couvre aussi « 10-videos » et « une-video » au passage suivant", async () => {
    await recharge(500);
    await depenseScript("s1", 100, new Date(Date.now() - 1800_000).toISOString());
    await credits.signalerAttenteCredit(null, "anthropic");
    await credits.surveillerCredits({ force: true });
    const liste = await alertes();
    expect(liste.filter((n) => /épuisé/.test(n.titre))).toHaveLength(1);
    expect(liste.filter((n) => !/épuisé/.test(n.titre))).toHaveLength(0);
  });

  it("l'horodatage « épuisé » n'est écrit qu'après la création de la notification", async () => {
    await recharge(500);
    const notifs = await import("@/services/notifications");
    const original = notifs.creerNotification;
    const espion = vi.spyOn(notifs, "creerNotification").mockRejectedValueOnce(new Error("panne"));
    await expect(credits.signalerAttenteCredit(null, "anthropic")).rejects.toThrow();
    espion.mockRestore();
    expect(original).toBeTypeOf("function");
    await credits.signalerAttenteCredit(null, "anthropic");
    expect(await alertes()).toHaveLength(1);
  });

  it("titre « plus qu'un script » pour Claude, « une vidéo » pour les autres", () => {
    expect(dom.messageAlerteCredit({ nom: "Claude", fournisseur: "anthropic", cle: "une-video", disponibleTexte: "0,40 $", restantes: 0 }).titre).toBe("Claude : plus qu'un script");
    expect(dom.messageAlerteCredit({ nom: "HeyGen", fournisseur: "heygen", cle: "une-video", disponibleTexte: "0,40 $", restantes: 0 }).titre).toBe("HeyGen : plus qu'une vidéo");
  });

  it("épuisé : Claude demande « Reprendre », les vidéos reprennent seules", () => {
    const c = dom.messageEpuise({ nom: "Claude", fournisseur: "anthropic", disponibleTexte: null, restantes: null }).message;
    expect(c).toContain("Après la recharge, touchez « Reprendre » sur l'écriture.");
    expect(c).not.toContain("reprendra toute seule");
    for (const f of ["heygen", "elevenlabs", "fal"]) {
      expect(dom.messageEpuise({ nom: "X", fournisseur: f, disponibleTexte: null, restantes: null }).message).toContain("la fabrication reprendra toute seule, rien n'est repayé.");
    }
  });
});
