/** G14-04 : historique des versions et « rétablir » (fonctions pures). */
import { describe, expect, it } from "vitest";
import { historiqueVersions, versionARetablir } from "@/services/retouche-chat/historique";

const t = "2026-11-16T10:00:00.000Z";
const v = (id: string, numero: number, parent: string | undefined, choisie = false, extra: Record<string, unknown> = {}) =>
  ({ id, videoId: "A", numero, parentVersionId: parent, choisie, statut: "prete", creeLe: t, modifieLe: t, commande: { secret: 1 }, projetMontage: { prive: 1 }, ...extra }) as never;

describe("versionARetablir", () => {
  const chaine = [v("V1", 1, undefined), v("V2", 2, "V1", true), v("V3", 3, "V2")];
  it("V1 → V2 → V3, choisie V2 : cible V3", () => expect(versionARetablir(chaine, "V2")).toBe("V3"));
  it("branche V2 → V4 : cible la plus récente (V4)", () => expect(versionARetablir([...chaine, v("V4", 4, "V2")], "V2")).toBe("V4"));
  it("choisie V3 (sans enfant) : null", () => expect(versionARetablir(chaine, "V3")).toBeNull());
  it("choisie inconnue ou absente : null", () => {
    expect(versionARetablir(chaine, "nope")).toBeNull();
    expect(versionARetablir([], "V1")).toBeNull();
  });
});

describe("historiqueVersions", () => {
  it("trie par numéro, ne garde que la vidéo demandée, signale les retouches du chat", () => {
    const liste = [v("V3", 3, "V2"), v("B1", 1, undefined, false, { videoId: "B" }), v("V1", 1, undefined), v("V2", 2, "V1", true, { projetMontage: { retoucheChat: {} }, noteRetouche: "zoom" })];
    const h = historiqueVersions(liste, "A");
    expect(h.map((x) => x.id)).toEqual(["V1", "V2", "V3"]);
    expect(h[1]).toMatchObject({ id: "V2", numero: 2, parentVersionId: "V1", choisie: true, noteRetouche: "zoom", retoucheChat: true });
    expect(h[0]?.retoucheChat).toBe(false);
  });
  it("jamais commande ni projetMontage", () => {
    const s = JSON.stringify(historiqueVersions([v("V1", 1, undefined, false, { projetMontage: { retoucheChat: {} } })], "A"));
    expect(s).not.toContain("commande");
    expect(s).not.toContain("projetMontage");
    expect(s).not.toContain("secret");
  });
});
