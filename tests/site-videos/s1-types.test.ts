/** S1.1 — un kit sans passeport reste valable : les nouveaux champs sont facultatifs. */
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { mockHeaders, mockNavigation } from "../helpers/next-mocks";
import { preparerBase, preparerMotDePasse, MDP_SITE } from "./helpers";
import type { KitPublication } from "@/domaine/types";

vi.mock("next/headers", () => mockHeaders);
vi.mock("next/navigation", () => mockNavigation);

const { depots } = await import("@/donnees/memoire");
const pub = await import("@/services/publications");
const site = await import("@/domaine/site-videos");

beforeAll(async () => {
  await preparerMotDePasse(MDP_SITE);
});
beforeEach(preparerBase);

describe("S1.1 types du passeport", () => {
  it("le module pur expose la version du passeport", () => {
    expect(site.VERSION_PASSEPORT_INITIALE).toBe(1);
  });

  it("un kit sans passeport reste valable : obtenirKit le rend", async () => {
    const prete = (await depots().videos.lister((v) => v.statut === "prete"))[0];
    expect(prete).toBeTruthy();
    const kit = await pub.obtenirKit(prete.id);
    expect(kit).not.toBeNull();
    // Un kit écrit sans les nouveaux champs (anciens kits en base) est un KitPublication valable.
    const ancien: KitPublication = { id: "k", videoId: prete.id, textes: {}, credits: [], avantDePublier: { image: false, son: false, sousTitres: false, mentionIA: false, droits: false }, creeLe: "2026-01-01T00:00:00.000Z", modifieLe: "2026-01-01T00:00:00.000Z" };
    expect(ancien.passeportWeb).toBeUndefined();
    expect(ancien.site).toBeUndefined();
  });
});
