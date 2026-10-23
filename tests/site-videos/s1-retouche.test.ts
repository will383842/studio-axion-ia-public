/** S1.6 — retouche du passeport : sa retouche gagne (origine « will »), la version monte, écriture sous le verrou du kit. */
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { mockHeaders, mockNavigation, reinitialiserRequete } from "../helpers/next-mocks";
import { preparerBase, preparerMotDePasse, MDP_SITE } from "./helpers";

vi.mock("next/headers", () => mockHeaders);
vi.mock("next/navigation", () => mockNavigation);

const { depots } = await import("@/donnees/memoire");
const pub = await import("@/services/publications");
const site = await import("@/services/site-videos");
const { ErreurStudio } = await import("@/services/_commun");

beforeAll(async () => {
  await preparerMotDePasse(MDP_SITE);
});

let videoId = "";
beforeEach(async () => {
  await preparerBase();
  videoId = (await depots().videos.lister((x) => x.statut === "prete" && !!x.scriptId))[0].id;
  await pub.obtenirKit(videoId);
});

const lire = async () => (await depots().kits.trouver((k) => k.videoId === videoId))!.passeportWeb!;

describe("S1.6 modifierPasseport", () => {
  it("une retouche : origine « will », version +1", async () => {
    const avant = await lire();
    const p = await site.modifierPasseport(videoId, { resume: "Un résumé écrit à la main, clair et court." });
    expect(p.resume).toBe("Un résumé écrit à la main, clair et court.");
    expect(p.origines.resume).toBe("will");
    expect(p.origines.titreWeb).toBe("essai");
    expect(p.version).toBe(avant.version + 1);
    expect((await lire()).version).toBe(avant.version + 1);
  });

  it("une retouche identique laisse la version inchangée", async () => {
    await site.modifierPasseport(videoId, { rubrique: "Automatisation" });
    const v = (await lire()).version;
    const p = await site.modifierPasseport(videoId, { rubrique: "Automatisation" });
    expect(p.version).toBe(v);
    expect((await lire()).modifieLe).toBe(p.modifieLe);
  });

  it("un titre de plus de 60 caractères est refusé (ErreurStudio), rien n'est écrit", async () => {
    const avant = await lire();
    await expect(site.modifierPasseport(videoId, { titreWeb: "x".repeat(61) })).rejects.toBeInstanceOf(ErreurStudio);
    expect(await lire()).toEqual(avant);
  });

  it("deux retouches simultanées : les deux champs sont gardés", async () => {
    await Promise.all([site.modifierPasseport(videoId, { titreWeb: "Mon titre" }), site.modifierPasseport(videoId, { rubrique: "Gestion" })]);
    const p = await lire();
    expect(p.titreWeb).toBe("Mon titre");
    expect(p.rubrique).toBe("Gestion");
    expect(p.origines.titreWeb).toBe("will");
    expect(p.origines.rubrique).toBe("will");
  });

  it("exige la session", async () => {
    reinitialiserRequete();
    await expect(site.modifierPasseport(videoId, { rubrique: "X" })).rejects.toThrow();
  });
});
