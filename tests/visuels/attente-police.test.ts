import { afterEach, describe, expect, it, vi } from "vitest";
import { avecDelai, DELAI_POLICE_MS, etatPolices } from "../../studio-rendu/compositions/visuels/commun/attente-police";

afterEach(() => vi.useRealTimers());

describe("attente des polices : course contre un délai", () => {
  it("se résout si la promesse se résout avant le délai", async () => {
    vi.useFakeTimers();
    const p = avecDelai(new Promise<string>((r) => setTimeout(() => r("ok"), 1_000)), DELAI_POLICE_MS, () => "trop tard");
    await vi.advanceTimersByTimeAsync(1_000);
    await expect(p).resolves.toBe("ok");
    expect(vi.getTimerCount()).toBe(0);
  });

  it("reste en attente à 19 999 ms, rejette à 20 000 ms avec le message fourni", async () => {
    vi.useFakeTimers();
    let etat = "attente";
    const p = avecDelai(new Promise<void>(() => undefined), 20_000, () => "Police absente");
    p.then(() => (etat = "résolu"), (e: Error) => (etat = e.message));
    await vi.advanceTimersByTimeAsync(19_999);
    expect(etat).toBe("attente");
    await vi.advanceTimersByTimeAsync(1);
    expect(etat).toBe("Police absente");
  });

  it("un rejet de la promesse se propage tout de suite avec son message", async () => {
    vi.useFakeTimers();
    const p = avecDelai(Promise.reject(new Error("illisible")), DELAI_POLICE_MS, () => "délai");
    await expect(p).rejects.toThrow("illisible");
    expect(vi.getTimerCount()).toBe(0);
  });

  it("le délai ne dépasse pas 25 s", () => {
    expect(DELAI_POLICE_MS).toBeLessThanOrEqual(25_000);
  });
});

describe("état des polices pour le message d'échec", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("donne la famille BRUTE (avec ou sans guillemets, en JSON) et le statut de chaque police", () => {
    vi.stubGlobal("document", { fonts: [{ family: '"Axion Archivo Black"', status: "loaded" }, { family: "Axion JetBrains Mono", status: "loading" }] });
    expect(etatPolices()).toBe('[{"family":"\\"Axion Archivo Black\\"","status":"loaded"},{"family":"Axion JetBrains Mono","status":"loading"}]');
  });

  it("signale l'absence de document et une liste vide", () => {
    expect(etatPolices()).toBe("document absent");
    vi.stubGlobal("document", { fonts: [] });
    expect(etatPolices()).toBe("aucune police dans document.fonts");
  });
});
