/**
 * L7-30 — restaurer-depuis-r2.sh : le script est EXÉCUTÉ (bash), sans réseau, sans docker, sans clé réelle.
 * Aucun test n'atteint restaurer-base.sh : on ne teste que la simulation et les refus.
 */
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { gzipSync } from "node:zlib";
import { describe, expect, it } from "vitest";

const SCRIPT = resolve(__dirname, "..", "deploiement/restaurer-depuis-r2.sh");
const DUMP = "-- PostgreSQL database dump\nSELECT 1;\n-- PostgreSQL database dump complete\n";

function banc(env: Record<string, string> = {}) {
  const d = mkdtempSync(join(tmpdir(), "l7-30-"));
  const racine = join(d, "opt");
  mkdirSync(racine, { recursive: true });
  const ecrire = (nom: string, contenu: Buffer | string) => {
    const f = join(d, nom);
    writeFileSync(f, contenu);
    return f;
  };
  const lancer = (args: string[]) => {
    const r = spawnSync("bash", [SCRIPT, ...args], {
      env: {
        NODE_ENV: "test", // requis par le type ProcessEnv ; le reste de l'environnement reste réduit (hermétique)
        PATH: process.env.PATH ?? "",
        STUDIO_RACINE: racine,
        STUDIO_ENV_FICHIER: join(d, "absent.env"),
        STUDIO_DOSSIER_REPRISE: join(d, "reprise"),
        ...env,
      },
      encoding: "utf8",
      timeout: 30000,
      stdio: ["ignore", "pipe", "pipe"], // pas de terminal
    });
    return { status: r.status, sortie: `${r.stdout}${r.stderr}` };
  };
  return { d, ecrire, lancer };
}

const R2 = { R2_BUCKET: "b", R2_ACCOUNT_ID: "c", R2_ACCESS_KEY_ID: "k", R2_SECRET_ACCESS_KEY: "s" };

describe("L7-30 : restaurer-depuis-r2.sh", () => {
  it("simulation sur une copie valide : sortie 0, rien de créé", () => {
    const b = banc();
    const f = b.ecrire("ok.sql.gz", gzipSync(DUMP));
    const avant = readdirSync(b.d).sort();
    const r = b.lancer(["--fichier", f]);
    expect(r.status).toBe(0);
    expect(r.sortie).toContain("SIMULATION");
    expect(readdirSync(b.d).sort()).toEqual(avant);
    expect(existsSync(join(b.d, "reprise"))).toBe(false);
  });

  it("copie tronquée refusée", () => {
    const b = banc();
    const complet = gzipSync(DUMP);
    const r = b.lancer(["--fichier", b.ecrire("coupe.sql.gz", complet.subarray(0, complet.length - 8))]);
    expect(r.status).toBe(1);
    expect(r.sortie).toContain("pas une sauvegarde complète");
  });

  it("copie non gzip refusée", () => {
    const b = banc();
    const r = b.lancer(["--fichier", b.ecrire("texte.sql.gz", DUMP)]);
    expect(r.status).toBe(1);
  });

  it("gzip valide mais sans fin de dump refusé", () => {
    const b = banc();
    const r = b.lancer(["--fichier", b.ecrire("sans-fin.sql.gz", gzipSync("SELECT 1;\n"))]);
    expect(r.status).toBe(1);
  });

  it("--executer sans terminal : refusé, sortie 2", () => {
    const b = banc();
    const r = b.lancer(["--fichier", b.ecrire("ok.sql.gz", gzipSync(DUMP)), "--executer"]);
    expect(r.status).toBe(2);
    expect(r.sortie).toContain("terminal interactif");
  });

  it.each([
    ["hors du préfixe", "autre/sauvegardes/x.sql.gz"],
    ["avec ..", "studio/sauvegardes/../x.sql.gz"],
    ["avec une espace", "studio/sauvegardes/a b.sql.gz"],
    ["sans extension .sql.gz", "studio/sauvegardes/x.txt"],
  ])("clé %s refusée", (_n, cle) => {
    const r = banc(R2).lancer(["--cle", cle]);
    expect(r.status).toBe(2);
    expect(r.sortie).toContain("REFUSÉ");
  });

  it("variables R2 absentes refusées", () => {
    const r = banc().lancer(["--cle", "studio/sauvegardes/x.sql.gz"]);
    expect(r.status).toBe(1);
    expect(r.sortie).toContain("R2_*");
  });

  it("--cle valide en simulation : aucun téléchargement, rien de créé", () => {
    const b = banc(R2);
    const r = b.lancer(["--cle", "studio/sauvegardes/x.sql.gz"]);
    expect(r.status).toBe(0);
    expect(existsSync(join(b.d, "reprise"))).toBe(false);
  });

  it("--fichier et --cle ensemble refusés", () => {
    const b = banc(R2);
    const r = b.lancer(["--fichier", b.ecrire("ok.sql.gz", gzipSync(DUMP)), "--cle", "studio/sauvegardes/x.sql.gz"]);
    expect(r.status).toBe(2);
    expect(r.sortie).toContain("Usage");
  });

  it.each(["--fichier", "--cle"])("%s sans valeur en dernier argument : message clair", (opt) => {
    const r = banc(R2).lancer([opt]);
    expect(r.status).toBe(2);
    expect(r.sortie).toContain("une valeur est attendue");
  });

  it("--fichier suivi d'une autre option : message clair", () => {
    const r = banc(R2).lancer(["--fichier", "--executer"]);
    expect(r.status).toBe(2);
    expect(r.sortie).toContain("une valeur est attendue");
  });

  it("option inconnue : sortie 2", () => {
    expect(banc().lancer(["--bidon"]).status).toBe(2);
  });
});
