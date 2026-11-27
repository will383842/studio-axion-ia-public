/** PR 3 Pinterest · le corps valide le schéma PinterestPlatformData de l'extrait OpenAPI. */
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { corpsPostZernio } from "@/fournisseurs/publication/zernio-corps";

const chemin = resolve(process.cwd(), "docs/zernio/openapi-extrait-1.418.1.json");
const spec = existsSync(chemin) ? JSON.parse(readFileSync(chemin, "utf8")) : null;

describe.skipIf(!spec)("Pinterest · contrat", () => {
  it("platformSpecificData : champs connus du schéma, longueurs respectées", () => {
    const c = corpsPostZernio(
      { reseau: "pinterest", texte: "Description", date: "2026-11-05T10:00:00Z", fichierCle: "x", cible: "acc:pin:111", cleEnvoi: "d".repeat(64), contenuIA: true, images: [{ url: "https://exemple.test/a.png", texteAlternatif: "Alt" }], epingle: { titre: "Titre", lien: "https://exemple.fr/p" } },
      { maintenant: Date.parse("2026-11-01T08:00:00Z"), domaineSite: "exemple.fr" },
    );
    const sch = spec.components.schemas.PinterestPlatformData.properties;
    const s = c.platforms[0].platformSpecificData as Record<string, unknown>;
    for (const k of Object.keys(s)) expect(Object.keys(sch), k).toContain(k);
    expect(sch.title.maxLength).toBe(100);
    expect(String(s.boardId)).toMatch(/^\d+$/);
    expect(typeof s.link).toBe("string");
  });
});
