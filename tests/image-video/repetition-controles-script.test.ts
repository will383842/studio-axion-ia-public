/**
 * Script de répétition des contrôles : lecture des arguments, aiguillage de l'état (travail ou fichier), mode --fichier.
 */
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { describe, expect, it } from "vitest";
import { ErreurArgumentsRepetition, etatDe, lireArgumentsRepetition } from "../../scripts/image-video/repetition-controles-args";

const lire = (...a: string[]) => lireArgumentsRepetition(a);

describe("arguments du script de répétition", () => {
  it("un travail, --tous (avec --depuis, --limite) ou --fichier, et les drapeaux", () => {
    expect(lire("trav-abc", "--json")).toMatchObject({ id: "trav-abc", tous: false, json: true, images: false });
    expect(lire("--tous", "--depuis", "2026-10-20", "--limite", "5", "--images")).toMatchObject({ tous: true, depuis: "2026-10-20", limite: 5, images: true });
    expect(lire("--fichier", "etat.json")).toMatchObject({ fichier: "etat.json", tous: false });
  });

  it("refuse une valeur d'option qui commence par deux tirets", () => {
    expect(() => lire("--fichier", "--json")).toThrow(/valeur de --fichier/);
    expect(() => lire("--tous", "--depuis", "--json")).toThrow(/valeur de --depuis/);
    expect(() => lire("--tous", "--limite", "--images")).toThrow(/valeur de --limite/);
    expect(() => lire("--fichier")).toThrow(ErreurArgumentsRepetition);
  });

  it("refuse les combinaisons et valeurs incohérentes", () => {
    expect(() => lire()).toThrow(/un seul mode/);
    expect(() => lire("trav-a", "--tous")).toThrow(/un seul mode/);
    expect(() => lire("trav-a", "trav-b")).toThrow(/Un seul travail/);
    expect(() => lire("--bidon")).toThrow(/Option inconnue/);
    expect(() => lire("trav-a", "--depuis", "2026-10-20")).toThrow(/--depuis/);
    expect(() => lire("--tous", "--depuis", "pas-une-date")).toThrow(/--depuis/);
    expect(() => lire("--tous", "--limite", "0")).toThrow(/--limite/);
    expect(() => lire("--tous", "--limite", "2.5")).toThrow(/--limite/);
    expect(() => lire("trav-a", "--limite", "3")).toThrow(/--limite/);
  });
});

describe("aiguillage de l'état", () => {
  const etat = { version: "fabrication-iv/1", demande: { videoId: "v1" } };
  it("l'état lui-même, ou celui d'un travail (parametres.imageVideo)", () => {
    expect(etatDe(etat)).toBe(etat);
    expect(etatDe({ parametres: { imageVideo: etat } })).toBe(etat);
  });
  it("autre chose : null", () => {
    expect(etatDe(null)).toBeNull();
    expect(etatDe({ parametres: {} })).toBeNull();
    expect(etatDe({ parametres: { imageVideo: { version: "autre" } } })).toBeNull();
    expect(etatDe({ version: "autre" })).toBeNull();
  });
});

describe("mode --fichier (script lancé pour de vrai, sans base ni stockage)", () => {
  const lancer = async (...a: string[]) => {
    try {
      const r = await promisify(execFile)("npx", ["tsx", "scripts/image-video/repetition-controles.mts", ...a], { env: { ...process.env, DATABASE_URL: "" }, timeout: 100_000 });
      return { code: 0, out: r.stdout, err: r.stderr };
    } catch (e) {
      const x = e as { code: number; stdout: string; stderr: string };
      return { code: x.code, out: x.stdout, err: x.stderr };
    }
  };

  it("un fichier sans état « image → vidéo » : code 2", async () => {
    const f = join(await mkdtemp(join(tmpdir(), "rep-")), "vide.json");
    await writeFile(f, JSON.stringify({ parametres: {} }));
    expect((await lancer("--fichier", f)).code).toBe(2);
  }, 120_000);

  it("un état incomplet : non rejouable, dit sans écart sur l'écoute", async () => {
    const f = join(await mkdtemp(join(tmpdir(), "rep-")), "etat.json");
    await writeFile(f, JSON.stringify({ version: "fabrication-iv/1", demande: { videoId: "v1" } }));
    const r = await lancer("--fichier", f);
    expect(r.code).toBe(0);
    expect(r.out).toMatch(/non rejouable/);
    expect(r.err).toMatch(/écoute .* pas rejouée/);
  }, 120_000);

  it("--fichier --json : code 1 (la valeur ne peut pas être une option)", async () => {
    expect((await lancer("--fichier", "--json")).code).toBe(1);
  }, 120_000);
});
