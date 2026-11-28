import { createHash } from "node:crypto";
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { defauts, fichiers, relatif } from "./garde-charte";

/** Zones où AUCUNE couleur hors charte ni police autre que Manrope n'est tolérée. */
const STRICTES = ["src/moteurs", "src/briques/charte", "src/briques/motion", "src/briques/habillage", "src/briques/habillage-facecam", "src/briques/sous-titres"];
/**
 * Polices qui restent (cliquet) parce que les mises en page sont MESURÉES sur leurs fichiers : les passer à Manrope
 * demande de régénérer les tables de chasse (écrans du cas concret, tableau, encadré). Les couleurs, elles, sont strictes.
 */
const POLICES_RESTANTES: Record<string, number> = lirePolicesRestantes(join(process.cwd(), "tests/charte/polices-restantes"));

/** Compositions de la vidéo (hors carrousels `visuels/`, autre chaîne) : cliquet, la liste ne peut que rétrécir. */
const COMPOSITIONS = "studio-rendu/compositions";
const DOSSIER = join(process.cwd(), "tests/charte/compositions-restantes");
const ORIGINE = join(process.cwd(), "tests/charte/compositions-restantes-origine-6d1ce305.json");

/** Dossier de compositions d'un fichier : les deux premiers dossiers sous `studio-rendu/compositions/` joints par `--` ; à la racine : `racine`. */
export function cleDossier(chemin: string): string {
  const dossiers = chemin.slice(`${COMPOSITIONS}/`.length).split("/").slice(0, -1);
  return dossiers.slice(0, 2).join("--") || "racine";
}

/** Fichiers `*.json` d'un dossier, fusionnés (clé en double entre deux fichiers : erreur). */
function fusionner(dossier: string): Record<string, number> {
  const tout: Record<string, number> = {};
  for (const nom of readdirSync(dossier).filter((n) => n.endsWith(".json")).sort()) {
    for (const [f, n] of Object.entries(JSON.parse(readFileSync(join(dossier, nom), "utf8")) as Record<string, number>)) {
      if (f in tout) throw new Error(`${f} est dans deux fichiers de ${dossier}`);
      tout[f] = n;
    }
  }
  return tout;
}
export function lireRestantes(dossier: string): Record<string, number> {
  return fusionner(dossier);
}
/** Entrées de `base` absentes de `origine` ou au compteur plus haut (liste vide = inclusion, la baisse est permise). */
export function horsOrigine(base: Record<string, number>, origine: Record<string, number>): string[] {
  return Object.entries(base).filter(([f, n]) => !(f in origine) || n > origine[f]).map(([f]) => f);
}
export function lirePolicesRestantes(dossier: string): Record<string, number> {
  return fusionner(dossier);
}
/** Un fichier par clé constatée ; un fichier existant devenu vide reçoit `{}` ; jamais de suppression. */
export function ecrireRestantes(dossier: string, actuel: Record<string, number>): void {
  mkdirSync(dossier, { recursive: true });
  const parCle: Record<string, Record<string, number>> = {};
  for (const nom of readdirSync(dossier).filter((n) => n.endsWith(".json"))) parCle[nom.slice(0, -5)] = {};
  for (const [f, n] of Object.entries(actuel).sort()) (parCle[cleDossier(f)] ??= {})[f] = n;
  for (const [cle, e] of Object.entries(parCle)) writeFileSync(join(dossier, `${cle}.json`), JSON.stringify(e, null, 2) + "\n");
}

describe("garde charte Axion 2026", () => {
  for (const zone of STRICTES) {
    it(`${zone} : aucune couleur hors charte, aucune police autre que Manrope`, () => {
      const fautes = fichiers(zone).flatMap((f) => {
        const d = defauts(readFileSync(f, "utf8"), relatif(f));
        const reste = POLICES_RESTANTES[relatif(f)];
        const polices = d.filter((x) => x.startsWith("police"));
        const autres = d.filter((x) => !x.startsWith("police"));
        const retenues = reste !== undefined && polices.length <= reste ? [] : polices;
        return [...autres, ...retenues].map((x) => `${relatif(f)} : ${x}`);
      });
      expect(fautes).toEqual([]);
    });
  }

  it("compositions : le nombre de défauts par fichier ne dépasse jamais la liste figée (et ne la laisse pas périmée)", () => {
    const actuel: Record<string, number> = {};
    for (const f of fichiers(COMPOSITIONS)) {
      const r = relatif(f);
      if (r.startsWith(`${COMPOSITIONS}/visuels/`)) continue;
      const n = defauts(readFileSync(f, "utf8"), r).length;
      if (n > 0) actuel[r] = n;
    }
    if (process.env.GARDE_CHARTE_ECRIRE === "1") {
      ecrireRestantes(DOSSIER, actuel);
    }
    const base = lireRestantes(DOSSIER);
    const plus = Object.entries(actuel).filter(([f, n]) => n > (base[f] ?? 0)).map(([f, n]) => `${f} : ${n} (liste : ${base[f] ?? 0})`);
    const moins = Object.entries(base).filter(([f, n]) => (actuel[f] ?? 0) < n).map(([f, n]) => `${f} : ${actuel[f] ?? 0} (liste : ${n}) → mettre à jour la liste`);
    expect({ plus, moins }).toEqual({ plus: [], moins: [] });
  });

  it("(b) un fichier par dossier", () => {
    const vus = new Set<string>();
    for (const nom of readdirSync(DOSSIER).filter((n) => n.endsWith(".json"))) {
      const e = JSON.parse(readFileSync(join(DOSSIER, nom), "utf8")) as Record<string, number>;
      for (const [f, n] of Object.entries(e)) {
        expect(cleDossier(f) + ".json", f).toBe(nom);
        expect(vus.has(f), `${f} en double`).toBe(false);
        vus.add(f);
        expect(Number.isInteger(n) && n > 0, f).toBe(true);
      }
    }
    expect(cleDossier("studio-rendu/compositions/Essai.tsx")).toBe("racine");
    expect(cleDossier("studio-rendu/compositions/commune/Miniature.tsx")).toBe("commune");
    expect(cleDossier("studio-rendu/compositions/commune/motion/spectaculaire/noyau.tsx")).toBe("commune--motion");
    expect(cleDossier("studio-rendu/compositions/interface-claire/motion-v4/lot1/commun-lot1.tsx")).toBe("interface-claire--motion-v4");
  });

  it("(c) aucune entrée perdue au découpage", () => {
    const texte = readFileSync(ORIGINE, "utf8");
    expect(createHash("sha256").update(texte).digest("hex")).toBe("40c6c4f88dc566f0d2b451fe2b53ea1f3d25491367e12b7e1fc9f1628a7e65cb");
    const origine = JSON.parse(texte) as Record<string, number>;
    expect(Object.keys(origine)).toHaveLength(140);
    for (const [f, n] of Object.entries(lireRestantes(DOSSIER))) expect(origine[f] !== undefined && n <= origine[f], f).toBe(true);
    const polices: Record<string, number> = { "src/briques/habillage/charte-duo.ts": 4, "src/briques/habillage/charte-video.ts": 4 };
    for (const [f, n] of Object.entries(lirePolicesRestantes(join(process.cwd(), "tests/charte/polices-restantes")))) expect(polices[f] !== undefined && n <= polices[f], f).toBe(true);
  });

  it("(d) l'écriture redonne les mêmes fichiers", () => {
    const origine = JSON.parse(readFileSync(ORIGINE, "utf8")) as Record<string, number>;
    const tmp = mkdtempSync(join(tmpdir(), "restantes-"));
    ecrireRestantes(tmp, origine);
    const noms = readdirSync(DOSSIER).filter((n) => n.endsWith(".json"));
    expect(readdirSync(tmp).sort()).toEqual(noms.sort());
    // La sortie de l'écrivain est contrôlée pour elle-même, indépendamment du dépôt : tout l'origine, rangé dans le bon fichier.
    expect(lireRestantes(tmp)).toEqual(origine);
    for (const nom of readdirSync(tmp).filter((n) => n.endsWith(".json"))) {
      const e = JSON.parse(readFileSync(join(tmp, nom), "utf8")) as Record<string, number>;
      for (const f of Object.keys(e)) expect(cleDossier(f) + ".json", `${f} rangé dans ${nom}`).toBe(nom);
    }
    // Inclusion et non égalité : une baisse de cliquet (POLICES-P7-*) est permise ; une entrée de plus ou un compteur plus haut ne l'est jamais.
    for (const nom of noms) expect(horsOrigine(JSON.parse(readFileSync(join(DOSSIER, nom), "utf8")) as Record<string, number>, origine), nom).toEqual([]);
    const [premier] = Object.keys(origine);
    const moins = Object.fromEntries(Object.entries(origine).filter(([f]) => f !== premier));
    ecrireRestantes(tmp, moins);
    expect(readFileSync(join(tmp, `${cleDossier(premier)}.json`), "utf8")).toMatch(/^(\{\}\n|\{\n)/);
    expect(readdirSync(tmp)).toHaveLength(noms.length);
    expect(lireRestantes(tmp)).toEqual(lireRestantes(tmp));
    expect(premier in lireRestantes(tmp)).toBe(false);
    // Une clé dont TOUTES les entrées partent : son fichier reste, vide, `{}\n` (jamais supprimé).
    const sansRacine = Object.fromEntries(Object.entries(origine).filter(([f]) => cleDossier(f) !== "racine"));
    expect(Object.keys(sansRacine).length).toBeLessThan(Object.keys(origine).length);
    ecrireRestantes(tmp, sansRacine);
    expect(readFileSync(join(tmp, "racine.json"), "utf8")).toBe("{}\n");
    expect(readdirSync(tmp)).toHaveLength(noms.length);
  });

  it("(d2) une hausse ou une entrée de plus rougit toujours, une baisse non", () => {
    const origine = { "a.ts": 3, "b.ts": 2 };
    expect(horsOrigine({ "a.ts": 3, "b.ts": 2 }, origine)).toEqual([]);
    expect(horsOrigine({ "a.ts": 1 }, origine)).toEqual([]);
    expect(horsOrigine({ "a.ts": 4, "b.ts": 2 }, origine)).toEqual(["a.ts"]);
    expect(horsOrigine({ "a.ts": 3, "c.ts": 1 }, origine)).toEqual(["c.ts"]);
  });

  it("(f) une clé en double entre deux fichiers : erreur", () => {
    const tmp = mkdtempSync(join(tmpdir(), "doubles-"));
    writeFileSync(join(tmp, "a.json"), '{ "x.ts": 1 }\n');
    writeFileSync(join(tmp, "b.json"), '{ "x.ts": 2 }\n');
    expect(() => lireRestantes(tmp)).toThrow(/deux fichiers/);
    expect(() => lirePolicesRestantes(tmp)).toThrow(/deux fichiers/);
  });

  it("(e) polices restantes : un fichier par source", () => {
    const dossier = join(process.cwd(), "tests/charte/polices-restantes");
    for (const nom of readdirSync(dossier).filter((n) => n.endsWith(".json"))) {
      const e = JSON.parse(readFileSync(join(dossier, nom), "utf8")) as Record<string, number>;
      for (const f of Object.keys(e)) expect(f.split("/").pop()!.replace(/\.ts$/, "") + ".json", f).toBe(nom);
    }
  });
});
