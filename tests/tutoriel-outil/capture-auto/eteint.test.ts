/**
 * POSTE-4 · INTERRUPTEUR ÉTEINT : `tutoriel.captureAuto` absent, `false`, `"true"`, `1` ou lecture qui lève = strictement rien.
 * Le module de la boîte n'est jamais importé (piégé), aucune écriture, aucun fetch, aucun appel HeyGen / ElevenLabs / Claude.
 */
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";

const etat = vi.hoisted(() => ({ importsBoite: 0, appelsPayants: [] as string[], fetchs: 0 }));
vi.mock("@/services/tutoriel-capture-boite", () => {
  etat.importsBoite++;
  throw new Error("le module de la boîte ne doit pas être importé quand l'interrupteur est éteint");
});
// Les autres modules du Studio importent ces fournisseurs : on piège leurs FONCTIONS (elles lèvent et notent l'appel), pas leur import.
const espion = (nom: string) => async (importOriginal: () => Promise<Record<string, unknown>>) => {
  const vrai = await importOriginal();
  return Object.fromEntries(
    Object.entries(vrai).map(([cle, v]) => [
      cle,
      typeof v === "function" && /^[a-z]/.test(cle)
        ? () => {
            etat.appelsPayants.push(`${nom}.${cle}`);
            throw new Error(`${nom}.${cle} ne doit pas être appelé`);
          }
        : v,
    ]),
  );
};
vi.mock("@/fournisseurs/heygen/voix", (o) => espion("heygen/voix")(o as never));
vi.mock("@/fournisseurs/heygen/client", (o) => espion("heygen/client")(o as never));
vi.mock("@/fournisseurs/heygen/rendus", (o) => espion("heygen/rendus")(o as never));
vi.mock("@/fournisseurs/credits/heygen", (o) => espion("credits/heygen")(o as never));
vi.mock("@/fournisseurs/credits/elevenlabs", (o) => espion("credits/elevenlabs")(o as never));
vi.mock("@/fournisseurs/claude/client", async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  envoyerMessage: () => {
    etat.appelsPayants.push("claude/client.envoyerMessage");
    throw new Error("claude/client.envoyerMessage ne doit pas être appelé");
  },
}));

const { reinitialiserDepots, depots } = await import("@/donnees/memoire");
const { ecrireParametre } = await import("@/services/_commun");
const { avancerCapturesTutoriel, PARAM_CAPTURE_AUTO } = await import("@/services/tutoriel-capture-auto");

const le = "2026-11-21T08:00:00.000Z";
const instantane = async () => JSON.stringify([await depots().travaux.lister(), await depots().videos.lister(), await depots().versions.lister(), await depots().fichiers.lister(), await depots().notifications.lister(), await depots().evenements.lister()]);

beforeEach(async () => {
  reinitialiserDepots();
  etat.fetchs = 0;
  vi.stubGlobal("fetch", async () => {
    etat.fetchs++;
    throw new Error("fetch interdit");
  });
  await depots().videos.enregistrer({ id: "v1", titre: "T", formatId: "tutoriel-outil", statut: "en_fabrication", entrees: {}, creeLe: le, modifieLe: le } as never);
  await depots().travaux.enregistrer({ id: "t1", type: "fabrication", cibleId: "v1", versionId: "ver1", titre: "T", statut: "en_file", progression: 0, tentatives: 1, cleIdempotence: "k", fournisseurUtilise: "studio", etapes: [], parametres: { pause: { code: "TO_FILM_A_CAPTURER", message: "x" } }, creeLe: le, modifieLe: le } as never);
});

describe("interrupteur éteint : rien", () => {
  it.each([["absent", undefined], ["false", false], ['"true"', "true"], ["1", 1], ["null", null]])("valeur %s : aucun import de la boîte, aucune écriture, aucun fetch", async (_n, v) => {
    if (v !== undefined) await ecrireParametre(PARAM_CAPTURE_AUTO, v);
    const avant = await instantane();
    await avancerCapturesTutoriel({ racine: "/nulle/part" });
    expect(await instantane()).toBe(avant);
    expect(etat.importsBoite).toBe(0);
    expect(etat.fetchs).toBe(0);
    expect(etat.appelsPayants).toEqual([]);
  });

  it("lecture de l'interrupteur qui lève : éteint (l'erreur n'arrive pas à la boucle)", async () => {
    const lire = vi.spyOn(depots().parametres, "obtenir").mockRejectedValue(new Error("base"));
    const avant = await instantane();
    await expect(avancerCapturesTutoriel({ racine: "/nulle/part" })).resolves.toBeUndefined();
    lire.mockRestore();
    expect(await instantane()).toBe(avant);
    expect(etat.importsBoite).toBe(0);
  });

  it("seul `true` exact allume (et alors le module de la boîte est bien demandé)", async () => {
    await ecrireParametre(PARAM_CAPTURE_AUTO, true);
    await expect(avancerCapturesTutoriel({ racine: "/nulle/part" })).rejects.toThrow();
    expect(etat.importsBoite).toBe(1);
  });
});

describe("gardes d'import", () => {
  const racine = join(__dirname, "../../..");
  const fichiers = (dossier: string): string[] =>
    readdirSync(join(racine, dossier), { recursive: true, withFileTypes: true })
      .filter((e) => e.isFile() && /\.(ts|tsx)$/.test(e.name))
      .map((e) => join(e.parentPath, e.name));

  it("seuls boucle.ts et tutoriel-branchements.ts (imports dynamiques) et les tests importent tutoriel-capture-auto ; ni src/app ni src/components", () => {
    const importeurs = fichiers("src").filter((f) => /(from|import\()\s*"[^"]*tutoriel-capture-auto"/.test(readFileSync(f, "utf8")) && !f.endsWith("tutoriel-capture-auto.ts"));
    expect(importeurs.map((f) => f.slice(racine.length + 1))).toEqual(["src/services/boucle.ts", "src/services/tutoriel-branchements.ts"]);
    // Le branchement du film d'un dossier ne lit que l'interrupteur, et seulement par import dynamique.
    expect(readFileSync(join(racine, "src/services/tutoriel-branchements.ts"), "utf8")).toContain('const { captureAutoAllumee } = await import("./tutoriel-capture-auto");');
    expect(readFileSync(join(racine, "src/services/boucle.ts"), "utf8")).toContain('(await import("./tutoriel-capture-auto")).avancerCapturesTutoriel()');
  });

  it('le module n\'est pas une action serveur ("use server") et importe la boîte dynamiquement seulement', () => {
    const src = readFileSync(join(racine, "src/services/tutoriel-capture-auto.ts"), "utf8");
    expect(src).not.toMatch(/["']use server["']/);
    expect(src).not.toMatch(/^import (?!type)[^\n]*tutoriel-capture-boite/m);
    expect(src).toMatch(/await import\("\.\/tutoriel-capture-boite"\)/);
  });
});
