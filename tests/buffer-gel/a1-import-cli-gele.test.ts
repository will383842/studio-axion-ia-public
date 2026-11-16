/**
 * LOT A1 — outils d'import : `clientDepuisEnv` refuse sauf `STUDIO_BUFFER_DEGELE=oui` (geste manuel explicite).
 */
import { describe, expect, it } from "vitest";
import { clientDepuisEnv } from "@/services/import-buffer/lire-buffer";
import { ErreurLectureBuffer } from "@/services/import-buffer/types";

const CLE = "cle-exemple-secrete-a1";

describe("A1 · import en ligne de commande gelé", () => {
  it("clé posée, sans déblocage → code `gele`", () => {
    expect(() => clientDepuisEnv({ BUFFER_API_KEY: CLE })).toThrow(ErreurLectureBuffer);
    try {
      clientDepuisEnv({ BUFFER_API_KEY: CLE });
    } catch (e) {
      expect(e).toMatchObject({ code: "gele" });
      expect(String((e as Error).message)).not.toContain(CLE);
    }
  });

  it("`STUDIO_BUFFER_DEGELE=oui` + clé → client rendu", () => {
    const c = clientDepuisEnv({ BUFFER_API_KEY: CLE, STUDIO_BUFFER_DEGELE: "oui" });
    expect(typeof c.lire).toBe("function");
  });

  it("déblocage seul, sans clé → `cle-absente`", () => {
    expect(() => clientDepuisEnv({ STUDIO_BUFFER_DEGELE: "oui" })).toThrow(expect.objectContaining({ code: "cle-absente" }));
  });

  it.each([["OUI"], ["1"], ["true"], [" oui"], [""]])("déblocage « %s » → toujours `gele`", (v) => {
    expect(() => clientDepuisEnv({ BUFFER_API_KEY: CLE, STUDIO_BUFFER_DEGELE: v })).toThrow(expect.objectContaining({ code: "gele" }));
  });

  it("sans clé ni déblocage → `gele` (jamais le détail de la clé)", () => {
    expect(() => clientDepuisEnv({})).toThrow(expect.objectContaining({ code: "gele" }));
  });
});
