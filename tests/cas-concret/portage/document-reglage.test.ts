/**
 * Portage phase 2 · P7 : le document promis est derrière `casConcret.documentPromis` (éteint par défaut) : ni lecture, ni
 * validation, ni correction, ni page (404) ; les actions refusent. Allumé : « valider » pose une date et rien d'autre
 * (aucune publication, aucun message). Base en mémoire, aucun appel réel.
 */
import { hash } from "@node-rs/argon2";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { mockHeaders, mockNavigation, reinitialiserRequete } from "../../helpers/next-mocks";

vi.mock("next/headers", () => mockHeaders);
vi.mock("next/navigation", () => mockNavigation);
vi.mock("next/cache", () => ({ revalidatePath: () => undefined, revalidateTag: () => undefined }));

const { reinitialiserDepots, depots } = await import("@/donnees/memoire");
const { ecrireParametre } = await import("@/services/_commun");
const auth = await import("@/services/auth");
const service = await import("@/services/cas-concret-document");
const actions = await import("@/components/formats/cas-concret/document/actions");
const page = (await import("@/app/(studio)/cas-concret/document/[videoId]/page")).default;
const { BlocDocument } = await import("@/components/formats/cas-concret/document/BlocDocument");

const MDP = "cas-concret-document-reglage";
const VIDEO = "v-03";
const lire = (chemin: string) => readFileSync(join(process.cwd(), chemin), "utf8");

beforeAll(async () => {
  process.env.SESSION_SECRET = "t".repeat(48);
  const e = await hash(MDP, { algorithm: 2, memoryCost: 19456, timeCost: 2, parallelism: 1 });
  process.env.STUDIO_PASSWORD_HASH_B64 = Buffer.from(e).toString("base64");
});

beforeEach(async () => {
  reinitialiserDepots();
  reinitialiserRequete();
  await auth.seConnecter(MDP, false);
  await depots().videos.modifier(VIDEO, { formatId: "cas-concret", entrees: { casConcret: { casId: "recrutement-apporteurs", codeSuivi: "cc-abc123" } } });
});

describe("P7 · réglage `casConcret.documentPromis` éteint (défaut)", () => {
  it("le service refuse de lire, de valider et de corriger : rien n'est écrit", async () => {
    const avant = JSON.stringify((await depots().videos.obtenir(VIDEO))!.entrees);
    await expect(service.lireDocument(VIDEO)).rejects.toMatchObject({ code: "FONCTION_FERMEE" });
    await expect(service.validerDocument(VIDEO)).rejects.toMatchObject({ code: "FONCTION_FERMEE" });
    await expect(service.corrigerDocument(VIDEO, "# Texte")).rejects.toMatchObject({ code: "FONCTION_FERMEE" });
    expect(JSON.stringify((await depots().videos.obtenir(VIDEO))!.entrees)).toBe(avant);
  });

  it("les actions renvoient le refus, sans rien écrire", async () => {
    const v = await actions.validerDocumentAction(VIDEO);
    expect(v.ok).toBe(false);
    const c = await actions.corrigerDocumentAction(VIDEO, "# Texte");
    expect(c.ok).toBe(false);
    expect(JSON.stringify((await depots().videos.obtenir(VIDEO))!.entrees)).not.toContain("valideLe");
  });

  it("la page répond 404 et le bloc de la fiche ne rend rien", async () => {
    await expect(page({ params: Promise.resolve({ videoId: VIDEO }) })).rejects.toThrow("NOT_FOUND");
    expect(await BlocDocument({ videoId: VIDEO })).toBeNull();
  });
});

describe("P7 · allumé (dans le double seulement) : « valider » pose une date, rien d'autre", () => {
  beforeEach(async () => {
    await ecrireParametre("casConcret.documentPromis", true);
  });

  it("la page et le bloc se rendent ; la validation ne crée ni publication ni notification", async () => {
    await expect(page({ params: Promise.resolve({ videoId: VIDEO }) })).resolves.toBeTruthy();
    expect(await BlocDocument({ videoId: VIDEO })).not.toBeNull();
    const d = depots();
    const avant = { publications: (await d.publications.lister()).length, notifications: (await d.notifications.lister()).length };
    const r = await actions.validerDocumentAction(VIDEO);
    expect(r.ok).toBe(true);
    expect({ publications: (await d.publications.lister()).length, notifications: (await d.notifications.lister()).length }).toEqual(avant);
  });

  it("les sources du document lisent le réglage (service et page) et n'ont aucun bouton d'envoi", () => {
    expect(lire("src/services/cas-concret-document.ts")).toContain("REGLAGES_CAS_CONCRET.documentPromis");
    expect(lire("src/app/(studio)/cas-concret/document/[videoId]/page.tsx")).toContain("REGLAGES_CAS_CONCRET.documentPromis");
  });
});

describe("P7 · relecture Opus : entrées non sûres et erreurs de la page", () => {
  beforeEach(async () => {
    await ecrireParametre("casConcret.documentPromis", true);
  });

  it("un texte qui n'est pas une chaîne, ou beaucoup trop long, est refusé en clair avant tout traitement", async () => {
    await expect(service.corrigerDocument(VIDEO, 42 as never)).rejects.toMatchObject({ code: "DOCUMENT_REFUSE" });
    await expect(service.corrigerDocument(VIDEO, null as never)).rejects.toMatchObject({ code: "DOCUMENT_REFUSE" });
    await expect(service.corrigerDocument(VIDEO, "a".repeat(100_000))).rejects.toMatchObject({ code: "DOCUMENT_REFUSE", message: expect.stringContaining("trop long") });
    expect(JSON.stringify((await depots().videos.obtenir(VIDEO))!.entrees)).not.toContain('"texte"');
  });

  it("la page ne répond 404 que pour une erreur du studio (vidéo inconnue) ; une panne de la base remonte", async () => {
    await expect(page({ params: Promise.resolve({ videoId: "v-inconnue" }) })).rejects.toThrow("NOT_FOUND");
    const d = depots();
    const panne = new Error("base injoignable");
    vi.spyOn(d.videos, "obtenir").mockRejectedValue(panne);
    await expect(page({ params: Promise.resolve({ videoId: VIDEO }) })).rejects.toBe(panne);
  });
});
