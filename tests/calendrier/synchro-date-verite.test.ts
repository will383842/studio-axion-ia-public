/**
 * L0-11 · la synchronisation n'écrase plus la date du Studio : au-delà de 1 minute d'écart, la date du Studio reste,
 * celle du diffuseur va dans `dateExterne`, un avertissement s'affiche dans le Studio (cloche seulement, jamais de push).
 * Faux client uniquement : aucun appel réel, données fictives.
 */
import { hash } from "@node-rs/argon2";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { mockHeaders, mockNavigation, reinitialiserRequete } from "../helpers/next-mocks";

vi.mock("next/headers", () => mockHeaders);
vi.mock("next/navigation", () => mockNavigation);
vi.mock("next/cache", () => ({ revalidatePath: () => undefined, revalidateTag: () => undefined }));

const { reinitialiserDepots, depots } = await import("@/donnees/memoire");
const auth = await import("@/services/auth");
const MDP = "essai-l0-11-123";

beforeAll(async () => {
  process.env.SESSION_SECRET = "s".repeat(48);
  const empreinte = await hash(MDP, { algorithm: 2, memoryCost: 19456, timeCost: 2, parallelism: 1 });
  process.env.STUDIO_PASSWORD_HASH_B64 = Buffer.from(empreinte).toString("base64");
});

const { injecterClientZernio, synchroniserEtatsZernio, PARAM_ENVOI_CALENDRIER, envoiCalendrierAutorise } = await import("@/services/zernio");
const { ecrireParametre } = await import("@/services/_commun");
const { creerFauxClientZernio, postExemple } = await import("../zernio/aides/faux-zernio");

/** Heure de Paris en hiver = UTC + 1 : 08:00Z s'affiche 09:00 au Studio, 09:00Z s'affiche 10:00. */
const STUDIO = "2026-11-12T08:00:00.000Z";
const T0 = Date.parse("2026-11-11T08:00:00Z");
const reponse = (corps: unknown) => ({ statut: 200, corps }) as never;
const iso = (ms: number) => new Date(ms).toISOString();

async function publication(extra: Record<string, unknown> = {}) {
  await depots().publications.enregistrer({ id: "p1", videoId: "v-03", reseau: "instagram", statut: "programmee", via: "zernio", date: STUDIO, texte: "Texte d'exemple", idExterne: "exemple-p1", canalId: "exemple-compte-1", etatEnvoi: "envoye", envoiCommenceLe: iso(T0 - 3600_000), creeLe: iso(T0), modifieLe: iso(T0), ...extra } as never);
}

/** Une synchro avec un post « scheduled » chez le diffuseur à la date donnée. */
async function synchroAvec(scheduledFor: unknown, instant = T0) {
  const { client } = creerFauxClientZernio(() => reponse({ post: postExemple({ status: "scheduled", scheduledFor: scheduledFor as string }) }));
  injecterClientZernio(client);
  return synchroniserEtatsZernio({ force: true, instant });
}

const lire = async () => (await depots().publications.obtenir("p1"))!;
const avertissements = async () => (await depots().notifications.lister()).filter((n) => /date/i.test(`${n.titre} ${n.message ?? ""}`));

beforeEach(async () => {
  reinitialiserDepots();
  reinitialiserRequete();
  injecterClientZernio(null);
  vi.stubGlobal("fetch", () => Promise.reject(new Error("fetch interdit")));
  await auth.seConnecter(MDP, false);
  for (const p of await depots().publications.lister()) await depots().publications.supprimer(p.id);
});

describe("L0-11 · 09:00 au Studio, 10:00 chez le diffuseur", () => {
  it("la date du Studio reste, celle du diffuseur va dans dateExterne, un avertissement s'affiche (cloche, jamais de push)", async () => {
    await publication();
    await synchroAvec("2026-11-12T09:00:00.000Z");
    const p = await lire();
    expect(p.date).toBe(STUDIO);
    expect(p.dateExterne).toBe("2026-11-12T09:00:00.000Z");
    expect(p.statut).toBe("programmee");
    const av = await avertissements();
    expect(av).toHaveLength(1);
    expect(av[0].message).toContain("09:00");
    expect(av[0].message).toContain("10:00");
    expect(av[0].envoi).toBeUndefined();
  });

  it("l'écart dans l'autre sens (diffuseur plus tôt) garde aussi la date du Studio", async () => {
    await publication();
    await synchroAvec("2026-11-12T07:00:00.000Z");
    expect((await lire()).date).toBe(STUDIO);
    expect((await lire()).dateExterne).toBe("2026-11-12T07:00:00.000Z");
    expect(await avertissements()).toHaveLength(1);
  });
});

describe("L0-11 · limite de 1 minute", () => {
  it("écart d'exactement 60 s : toléré, ni avertissement ni dateExterne, date du Studio inchangée", async () => {
    await publication();
    await synchroAvec("2026-11-12T08:01:00.000Z");
    const p = await lire();
    expect(p.date).toBe(STUDIO);
    expect(p.dateExterne).toBeUndefined();
    expect(await avertissements()).toHaveLength(0);
  });

  it("écart de 60,001 s : avertissement et dateExterne", async () => {
    await publication();
    await synchroAvec("2026-11-12T08:01:00.001Z");
    expect((await lire()).dateExterne).toBe("2026-11-12T08:01:00.001Z");
    expect(await avertissements()).toHaveLength(1);
  });

  it("écart résorbé : dateExterne retiré, pas de nouvel avertissement", async () => {
    await publication({ dateExterne: "2026-11-12T09:00:00.000Z" });
    await synchroAvec(STUDIO);
    expect((await lire()).dateExterne).toBeUndefined();
    expect(await avertissements()).toHaveLength(0);
  });
});

describe("L0-11 · rejeu et entrées douteuses", () => {
  it("rejeu de la même synchro : un seul avertissement", async () => {
    await publication();
    await synchroAvec("2026-11-12T09:00:00.000Z", T0);
    await synchroAvec("2026-11-12T09:00:00.000Z", T0 + 16 * 60_000);
    expect(await avertissements()).toHaveLength(1);
    expect((await lire()).date).toBe(STUDIO);
  });

  it("le diffuseur change encore la date : nouvel avertissement, dateExterne à jour, Studio inchangé", async () => {
    await publication();
    await synchroAvec("2026-11-12T09:00:00.000Z", T0);
    await synchroAvec("2026-11-12T11:00:00.000Z", T0 + 16 * 60_000);
    expect(await avertissements()).toHaveLength(2);
    expect((await lire()).dateExterne).toBe("2026-11-12T11:00:00.000Z");
    expect((await lire()).date).toBe(STUDIO);
  });

  it.each([[undefined], [""], ["pas une date"], [null]])("date du diffuseur illisible ou vide (%j) : rien n'est écrit, aucun avertissement", async (v) => {
    await publication();
    await synchroAvec(v);
    const p = await lire();
    expect(p.date).toBe(STUDIO);
    expect(p.dateExterne).toBeUndefined();
    expect(await avertissements()).toHaveLength(0);
  });

  it("date du Studio illisible : elle n'est jamais remplacée, aucun avertissement", async () => {
    await publication({ date: "illisible" });
    await synchroAvec("2026-11-12T09:00:00.000Z");
    expect((await lire()).date).toBe("illisible");
    expect(await avertissements()).toHaveLength(0);
  });

  it("post déjà publié chez le diffuseur : la date du Studio n'est pas touchée, pas d'avertissement de date", async () => {
    await publication();
    const { client } = creerFauxClientZernio(() => reponse({ post: postExemple({ status: "published", scheduledFor: "2026-11-12T09:00:00.000Z", platforms: [{ platform: "instagram", accountId: "exemple-compte-1", status: "published", platformPostUrl: "https://exemple.invalid/p/1" }] }) }));
    injecterClientZernio(client);
    await synchroniserEtatsZernio({ force: true, instant: T0 });
    expect((await lire()).date).toBe(STUDIO);
    expect((await lire()).statut).toBe("publiee");
    expect(await avertissements()).toHaveLength(0);
  });

  it("la synchro ne fait toujours que lire chez le diffuseur", async () => {
    await publication();
    const { client, faux } = creerFauxClientZernio(() => reponse({ post: postExemple({ status: "scheduled", scheduledFor: "2026-11-12T09:00:00.000Z" }) }));
    injecterClientZernio(client);
    await synchroniserEtatsZernio({ force: true, instant: T0 });
    expect(faux.appels.length).toBeGreaterThan(0);
    expect(faux.appels.every((a: { methode: string }) => a.methode === "GET")).toBe(true);
  });
});

describe("L0-11 · nom du réglage d'envoi du calendrier (recopié de L7-08)", () => {
  it("la constante est celle de L7-08", () => {
    expect(PARAM_ENVOI_CALENDRIER).toBe("zernio.envoi_calendrier_autorise");
  });

  it("fermé par défaut ; seul « true » écrit sous ce nom ouvre", async () => {
    expect(await envoiCalendrierAutorise()).toBe(false);
    await ecrireParametre("zernio.envoi_calendrier_autorise", true);
    expect(await envoiCalendrierAutorise()).toBe(true);
  });
});
