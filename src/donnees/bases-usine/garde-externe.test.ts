import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { empreinteDe, sha256, type SourceBases } from "./empreintes";
import { gardeExterne, MANIFESTE_URL } from "./garde-externe";

const source = JSON.parse(readFileSync(join(__dirname, "donnees", "source.json"), "utf8")) as SourceBases;
const manifeste = { version: 1, commit: "b".repeat(40), fichiers: source.fichiers, empreinte: source.empreinte };
const repond = (status: number, texte: string) => async () => ({ status, texte });

describe("garde externe", () => {
  it("manifeste identique : vert, et le jeton part dans l'en-tête seulement", async () => {
    let vu: { url: string; entetes: Record<string, string> } | undefined;
    const r = await gardeExterne(source, { jeton: "jeton-secret", sauteParFork: false, lire: async (url, entetes) => ((vu = { url, entetes }), { status: 200, texte: JSON.stringify(manifeste) }) });
    expect(r).toEqual({ statut: "vert" });
    expect(vu?.url).toBe(MANIFESTE_URL);
    expect(vu?.entetes.Authorization).toBe("Bearer jeton-secret");
  });

  it("source depot-prive avancée : rouge avec le fichier en cause", async () => {
    const fichiers = { ...source.fichiers, "7-appels.md": sha256("v2") };
    const r = await gardeExterne(source, { jeton: "j", sauteParFork: false, lire: repond(200, JSON.stringify({ ...manifeste, fichiers, empreinte: empreinteDe(fichiers) })) });
    expect(r.statut).toBe("rouge");
    expect(r.statut === "rouge" && r.raisons.join("\n")).toContain("7-appels.md");
  });

  it("jeton absent ou vide : rouge, jamais vert", async () => {
    for (const jeton of [undefined, ""]) {
      const r = await gardeExterne(source, { jeton: jeton || undefined, sauteParFork: false, lire: repond(200, JSON.stringify(manifeste)) });
      expect(r.statut).toBe("rouge");
    }
  });

  it("404, 401, réseau coupé, JSON illisible, champs manquants : rouge", async () => {
    const cas = [repond(404, "Not Found"), repond(401, "Bad credentials"), repond(200, "pas du json"), repond(200, "{}"), async () => Promise.reject(new Error("ECONNRESET"))];
    for (const lire of cas) expect((await gardeExterne(source, { jeton: "j", sauteParFork: false, lire })).statut).toBe("rouge");
  });

  it("PR d'un fork : saut explicite, qui n'est pas « vert »", async () => {
    const r = await gardeExterne(source, { jeton: undefined, sauteParFork: true, lire: repond(500, "") });
    expect(r.statut).toBe("saute");
    expect(r.statut).not.toBe("vert");
  });
});
