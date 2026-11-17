// X3-09c : la page de création remplit `donnees.dosageMotion` seulement quand le réglage est allumé (lecture seule).
import { describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

vi.mock("server-only", () => ({}));

import { dosagePourEcran } from "@/services/dosage-motion-ecran";

const RACINE = join(__dirname, "..", "..");
const lireSource = (rel: string) => readFileSync(join(RACINE, rel), "utf8");

type LireSimule = ReturnType<typeof vi.fn<(id: string, defaut: unknown) => Promise<unknown>>>;

function lecteur(valeurs: Record<string, unknown>): LireSimule {
  return vi.fn<(id: string, defaut: unknown) => Promise<unknown>>(async (id: string, defaut: unknown) => (id in valeurs ? valeurs[id] : defaut));
}

describe("X3-09c : dosagePourEcran éteint", () => {
  const cas: Array<[string, () => LireSimule]> = [
    ["absent", () => lecteur({})],
    ["false", () => lecteur({ "dosageMotion.actif": false })],
    ['"true" (texte)', () => lecteur({ "dosageMotion.actif": "true" })],
    ["lecture qui lève", () => vi.fn<(id: string, defaut: unknown) => Promise<unknown>>(async () => { throw new Error("base indisponible"); })],
  ];
  for (const [nom, fabrique] of cas) {
    it(`${nom} : undefined, une seule lecture (dosageMotion.actif)`, async () => {
      const lire = fabrique();
      const r = await dosagePourEcran({ id: "facecam", moteur: "montage-facecam" }, { lire });
      expect(r).toBeUndefined();
      expect(lire).toHaveBeenCalledTimes(1);
      expect(lire.mock.calls[0][0]).toBe("dosageMotion.actif");
    });
  }
});

describe("X3-09c : dosagePourEcran allumé", () => {
  const actif = { "dosageMotion.actif": true };

  it("avocat déclaré simulation : moteur de prises filmées", async () => {
    const r = await dosagePourEcran({ id: "avocat", moteur: "simulation" }, { lire: lecteur(actif) });
    expect(r).toEqual({ actif: true, generateur: "avocat", defaut: "equilibre" });
  });
  it("face caméra : générateur facecam", async () => {
    const r = await dosagePourEcran({ id: "facecam", moteur: "montage-facecam" }, { lire: lecteur(actif) });
    expect(r?.generateur).toBe("facecam");
  });
  it("défaut réglé sobre", async () => {
    const lire = lecteur({ ...actif, "dosageMotion.defauts": { facecam: "sobre" } });
    const r = await dosagePourEcran({ id: "facecam", moteur: "montage-facecam" }, { lire });
    expect(r?.defaut).toBe("sobre");
  });
  it("défaut non permis (aucun pour montage-tableau) : défaut du code", async () => {
    const lire = lecteur({ ...actif, "dosageMotion.defauts": { tableau: "aucun" } });
    const r = await dosagePourEcran({ id: "t", moteur: "montage-tableau" }, { lire });
    const { DOSAGE_DEFAUT_CODE } = await import("@/briques/dosage-motion/crans");
    expect(r).toEqual({ actif: true, generateur: "tableau", defaut: DOSAGE_DEFAUT_CODE.tableau });
  });
  it("simulation sans prises filmées, moteur inconnu, moteur absent : undefined", async () => {
    const lire = lecteur(actif);
    expect(await dosagePourEcran({ id: "x", moteur: "simulation" }, { lire })).toBeUndefined();
    expect(await dosagePourEcran({ id: "x", moteur: "inconnu" }, { lire })).toBeUndefined();
    expect(await dosagePourEcran({ id: "x" }, { lire })).toBeUndefined();
  });
  it("ne lève jamais : lecture des défauts en échec = défaut du code", async () => {
    const lire = vi.fn(async (id: string) => {
      if (id === "dosageMotion.actif") return true;
      throw new Error("panne");
    });
    const r = await dosagePourEcran({ id: "facecam", moteur: "montage-facecam" }, { lire });
    expect(r?.generateur).toBe("facecam");
  });
});

describe("X3-09c : tables et gardes statiques", () => {
  const table = (src: string) =>
    [...(/GENERATEUR_DU_MOTEUR[^=]*=\s*\{([\s\S]*?)\};/.exec(src)?.[1] ?? "").matchAll(/"([^"]+)":\s*"([^"]+)"/g)].map((m) => `${m[1]}=${m[2]}`).sort();

  it("table moteur → générateur égale à celle de dosage-motion.ts", () => {
    const a = table(lireSource("src/services/dosage-motion.ts"));
    const b = table(lireSource("src/services/dosage-motion-ecran.ts"));
    expect(a.length).toBe(8);
    expect(b).toEqual(a);
  });
  it("la page appelle dosagePourEcran une fois et n'ajoute la clé que si définie", () => {
    const page = lireSource("src/app/(studio)/nouvelle/[format]/page.tsx");
    expect(page.match(/dosagePourEcran\(/g)).toHaveLength(1);
    expect(page).toContain("...(dosageMotion ? { dosageMotion } : {})");
  });
  it("le service n'importe ni fabrication, ni reglages, ni travaux, ni publications, ni image-video", () => {
    const src = lireSource("src/services/dosage-motion-ecran.ts");
    for (const interdit of ["fabrication", "reglages", "travaux", "publications", "image-video"]) {
      expect(src).not.toMatch(new RegExp(`from\\s+["'][^"']*${interdit}[^"']*["']`));
    }
    expect(src).toContain('import "server-only"');
  });
});
