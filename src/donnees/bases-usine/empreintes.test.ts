/**
 * GARDES DES BASES (ADR 0001). Interne : la copie JSON correspond à son `source.json` (un JSON modifié à la main,
 * un fichier en trop ou manquant, une empreinte falsifiée → échec). Externe : `source.json` = manifeste de depot-prive
 * (ici avec un manifeste simulé ; la vraie lecture est dans `scripts/bases/controler-ecart-externe.mts`).
 */
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { ecartsExternes, ecartsInternes, empreinteDe, sha256, type ManifesteBases, type SourceBases } from "./empreintes";

const DOSSIER = join(__dirname, "donnees");

function lireCopie(): { source: SourceBases; copie: Record<string, string> } {
  const source = JSON.parse(readFileSync(join(DOSSIER, "source.json"), "utf8")) as SourceBases;
  const copie: Record<string, string> = {};
  for (const f of readdirSync(DOSSIER).filter((n) => n.endsWith(".json") && n !== "source.json").sort()) copie[f] = readFileSync(join(DOSSIER, f), "utf8");
  return { source, copie };
}

describe("garde interne", () => {
  it("la copie enregistrée est conforme à source.json", () => {
    const { source, copie } = lireCopie();
    expect(ecartsInternes(source, copie), "resynchroniser avec scripts/bases/synchroniser-bases.mts, jamais à la main").toEqual([]);
  });

  it("un JSON modifié à la main fait échouer", () => {
    const { source, copie } = lireCopie();
    copie["2-tailles.json"] = copie["2-tailles.json"].replace("TPE", "TPX");
    expect(ecartsInternes(source, copie).join("\n")).toContain("2-tailles.json : modifié depuis la synchro");
  });

  it("un JSON en trop ou manquant fait échouer", () => {
    const { source, copie } = lireCopie();
    const moins = Object.fromEntries(Object.entries(copie).filter(([n]) => n !== "1-cibles.json"));
    expect(ecartsInternes(source, moins).join("\n")).toContain("1-cibles.json : déclaré dans source.json, absent de la copie");
    expect(ecartsInternes(source, { ...copie, "10-extra.json": "{}" }).join("\n")).toContain("10-extra.json : présent dans la copie, non déclaré");
  });

  it("une empreinte falsifiée fait échouer", () => {
    const { source, copie } = lireCopie();
    expect(ecartsInternes({ ...source, empreinte: sha256("autre") }, copie).join("\n")).toContain("empreinte déclarée");
    expect(ecartsInternes({ ...source, fichiers: { ...source.fichiers, "2-tailles.md": sha256("x") } }, copie).join("\n")).toContain("empreinte déclarée");
  });

  it("l'empreinte ne dépend pas de l'ordre des fichiers", () => {
    expect(empreinteDe({ "b.md": "2", "a.md": "1" })).toBe(sha256("a.md:1\nb.md:2\n"));
  });
});

describe("garde externe (manifeste simulé)", () => {
  function manifesteDe(source: SourceBases): ManifesteBases {
    return { version: 1, commit: "a".repeat(40), fichiers: { ...source.fichiers }, empreinte: source.empreinte };
  }

  it("à jour : aucun écart", () => {
    const { source } = lireCopie();
    expect(ecartsExternes(source, manifesteDe(source))).toEqual([]);
  });

  it("la source a avancé : écart nommant le fichier", () => {
    const { source } = lireCopie();
    const m = manifesteDe(source);
    m.fichiers["2-tailles.md"] = sha256("nouvelle version");
    m.empreinte = empreinteDe(m.fichiers);
    const ecarts = ecartsExternes(source, m).join("\n");
    expect(ecarts).toContain("empreinte : studio");
    expect(ecarts).toContain("2-tailles.md : sha256 différent de depot-prive");
  });

  it("un fichier ajouté côté source est signalé", () => {
    const { source } = lireCopie();
    const m = manifesteDe(source);
    m.fichiers["10-nouvelle.md"] = sha256("n");
    m.empreinte = empreinteDe(m.fichiers);
    expect(ecartsExternes(source, m).join("\n")).toContain("10-nouvelle.md : dans depot-prive, absent du studio");
  });
});
