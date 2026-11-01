import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { estVideoTest, filtrerPostsAVenir, jourParis } from "../../src/services/import-buffer/exclusions";
import { normaliserPost } from "../../src/services/import-buffer/lire-buffer";
import type { PostBuffer } from "../../src/services/import-buffer/types";

const BRUTS = JSON.parse(readFileSync(new URL("./fixtures/buffer-a-venir-fictif.json", import.meta.url), "utf8")).data.posts.edges.map((e: { node: Record<string, unknown> }) => e.node);
const POSTS: PostBuffer[] = BRUTS.map(normaliserPost);
const MAINTENANT = new Date("2026-11-01T08:00:00Z");

describe("IMP-1 exclusions", () => {
  it("garde les posts à venir, exclut passé, envoyé et vidéo de test avec la raison", () => {
    const { retenus, exclus } = filtrerPostsAVenir(POSTS, MAINTENANT);
    expect(retenus.map((p) => p.id)).toEqual(["post-exemple-01", "post-exemple-02"]);
    expect(exclus).toEqual([
      { id: "post-exemple-03", raison: "video-test-31-10" },
      { id: "post-exemple-04", raison: "envoye" },
      { id: "post-exemple-05", raison: "passe" },
    ]);
  });

  it("la vidéo de test : brouillon + vidéo + 31/10, rien d'autre", () => {
    const test = POSTS[2];
    expect(estVideoTest(test)).toBe(true);
    expect(estVideoTest({ ...test, statut: "scheduled" })).toBe(false);
    expect(estVideoTest({ ...test, medias: [] })).toBe(false);
    expect(estVideoTest({ ...test, dateUtc: "2026-11-02T10:00:00Z" })).toBe(false);
  });

  it("la vidéo de test est exclue même datée dans le futur (31/10 d'une autre année)", () => {
    const futur = { ...POSTS[2], dateUtc: "2027-10-31T10:00:00Z" };
    expect(filtrerPostsAVenir([futur], MAINTENANT).exclus[0].raison).toBe("video-test-31-10");
  });

  it("jourParis lit le jour de Paris, undefined si illisible", () => {
    expect(jourParis("2026-10-30T23:30:00Z")).toBe("2026-10-31");
    expect(jourParis("pas une date")).toBeUndefined();
    expect(jourParis(undefined)).toBeUndefined();
  });

  it("ne modifie pas les posts d'entrée", () => {
    const copie = JSON.stringify(POSTS);
    filtrerPostsAVenir(POSTS, MAINTENANT);
    expect(JSON.stringify(POSTS)).toBe(copie);
  });
});
