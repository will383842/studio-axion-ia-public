/** S1.5 — le passeport naît avec le kit (gratuit), un ancien kit le reçoit à l'affichage, jamais d'appel payant. */
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { mockHeaders, mockNavigation } from "../helpers/next-mocks";
import { preparerBase, preparerMotDePasse, MDP_SITE } from "./helpers";

vi.mock("next/headers", () => mockHeaders);
vi.mock("next/navigation", () => mockNavigation);

/** Types de fournisseur demandés pendant le test (le passeport d'essai n'en demande aucun payant). */
const demandes: string[] = [];
vi.mock("@/fournisseurs", async (original) => {
  const m = await original<typeof import("@/fournisseurs")>();
  return {
    ...m,
    resoudreFournisseur: (type: string, valeur?: string | null) => {
      demandes.push(type);
      return (m.resoudreFournisseur as (t: string, v?: string | null) => unknown)(type, valeur);
    },
  };
});

const { depots } = await import("@/donnees/memoire");
const pub = await import("@/services/publications");
const site = await import("@/services/site-videos");

beforeAll(async () => {
  await preparerMotDePasse(MDP_SITE);
});
beforeEach(async () => {
  await preparerBase();
  demandes.length = 0;
  vi.stubGlobal("fetch", async () => {
    throw new Error("réseau interdit");
  });
});
afterEach(() => vi.unstubAllGlobals());

async function videoPrete() {
  const v = (await depots().videos.lister((x) => x.statut === "prete" && !!x.scriptId))[0];
  expect(v).toBeTruthy();
  return v;
}

describe("S1.5 passeport dans le kit", () => {
  it("à la création du kit, le passeport existe : version 1, origines « essai »", async () => {
    const v = await videoPrete();
    // Les vidéos de démonstration ont déjà un kit (ancien, sans passeport) : on repart sans kit.
    for (const k of await depots().kits.lister((x) => x.videoId === v.id)) await depots().kits.supprimer(k.id);
    await pub.genererKit(v.id);
    const kit = (await depots().kits.trouver((k) => k.videoId === v.id))!;
    expect(kit.passeportWeb).toBeDefined();
    expect(kit.passeportWeb!.version).toBe(1);
    expect(Object.values(kit.passeportWeb!.origines).every((o) => o === "essai")).toBe(true);
    expect(kit.passeportWeb!.transcription.length).toBeGreaterThan(10);
    expect(kit.passeportWeb!.titreWeb.length).toBeGreaterThan(0);
  });

  it("un ancien kit sans passeport le reçoit à l'affichage", async () => {
    const v = await videoPrete();
    await pub.genererKit(v.id);
    const kit = (await depots().kits.trouver((k) => k.videoId === v.id))!;
    const ancien = { ...kit };
    delete ancien.passeportWeb;
    await depots().kits.enregistrer(ancien);
    expect((await depots().kits.obtenir(kit.id))!.passeportWeb).toBeUndefined();
    const vue = await pub.obtenirKit(v.id);
    expect(vue).not.toBeNull();
    expect((await depots().kits.obtenir(kit.id))!.passeportWeb?.version).toBe(1);
  });

  it("aucun fournisseur payant (script, texte des réseaux) n'est demandé pour fabriquer le passeport", async () => {
    const v = await videoPrete();
    await pub.genererKit(v.id);
    const kit = (await depots().kits.trouver((k) => k.videoId === v.id))!;
    const ancien = { ...kit };
    delete ancien.passeportWeb;
    await depots().kits.enregistrer(ancien);
    demandes.length = 0;
    const p = await site.passeportDeLaVideo(v.id);
    expect(p?.version).toBe(1);
    expect(demandes).not.toContain("texte-reseaux");
    expect(demandes).not.toContain("script");
  });

  it("une vidéo non prête n'en reçoit pas", async () => {
    const v = await videoPrete();
    await depots().videos.modifier(v.id, { statut: "en_fabrication" });
    for (const k of await depots().kits.lister((x) => x.videoId === v.id)) await depots().kits.supprimer(k.id);
    await pub.genererKit(v.id);
    const kit = (await depots().kits.trouver((k) => k.videoId === v.id))!;
    expect(kit.passeportWeb).toBeUndefined();
    expect(await site.passeportDeLaVideo(v.id)).toBeNull();
  });
});
