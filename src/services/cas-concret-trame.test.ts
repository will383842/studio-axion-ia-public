import { describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { CATALOGUE } from "@/formats/cas-concret/catalogue";
import { blocsTrame } from "./cas-concret";

describe("blocsTrame (lot E)", () => {
  it("sans fait chiffré, aucun texte n'est répété dans la trame", () => {
    const cas = { ...CATALOGUE[0], faits: [] } as typeof CATALOGUE[number];
    const textes = blocsTrame(cas, "V1").flatMap((b) => b.segments.map((s) => s.texte));
    expect(textes.length).toBeGreaterThan(0);
    expect(new Set(textes.map((t) => t.toLowerCase())).size).toBe(textes.length);
  });
});
