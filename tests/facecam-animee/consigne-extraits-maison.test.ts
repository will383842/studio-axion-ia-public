/** C4-U4.6a : bloc de consigne `axion:` et lecture du réglage (purs, non branchés). */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { consigneRealisateur } from "@/moteurs/montage-facecam-animee/realisateur/consignes";
import { SEUILS } from "@/moteurs/montage-facecam-animee/realisateur/regles";
import { PREFIXE_AXION, lireRechercheAxion } from "@/moteurs/montage-facecam-animee/extraits-maison/recherche";
import { DUREE_MIN_EXTRAIT_V4_SEC } from "@/moteurs/montage-facecam-animee/extraits-maison/types";
import {
  PARAM_EXTRAITS_MAISON_FA,
  blocExtraitsMaison,
  extraitsMaisonActif,
} from "@/moteurs/montage-facecam-animee/realisateur/consigne-extraits-maison";

const FICHIER_NEUF = "src/moteurs/montage-facecam-animee/realisateur/consigne-extraits-maison.ts";

describe("blocExtraitsMaison", () => {
  it.each([undefined, null, false, "true", 1, {}])("éteint (%j) : chaîne vide", (v) => {
    expect(blocExtraitsMaison(v)).toBe("");
  });

  it("allumé : mentionne le préfixe, les seuils et la durée minimale", () => {
    const t = blocExtraitsMaison(true);
    expect(t).toContain(PREFIXE_AXION);
    expect(t).toContain(String(SEUILS.rechercheMotsMin));
    expect(t).toContain(String(DUREE_MIN_EXTRAIT_V4_SEC));
    expect(t.startsWith("EXTRAITS DES VIDÉOS DE WILL")).toBe(true);
  });

  it("l'exemple axion: du texte est lu par lireRechercheAxion", () => {
    const m = blocExtraitsMaison(true).match(/axion:[^\s»"]+(?: [^\s»"]+)*/);
    expect(m).not.toBeNull();
    expect(lireRechercheAxion(m![0])).not.toBeNull();
  });

  it("déterministe", () => {
    expect(blocExtraitsMaison(true)).toBe(blocExtraitsMaison(true));
  });

  it("ni argent ni visage", () => {
    expect(blocExtraitsMaison(true)).not.toMatch(/€|\$|prix|crédit|visage/i);
  });
});

describe("extraitsMaisonActif", () => {
  it("seul true allume", async () => {
    expect(await extraitsMaisonActif(async () => true)).toBe(true);
    for (const v of [false, "true", 1, undefined]) {
      expect(await extraitsMaisonActif(async () => v)).toBe(false);
    }
  });

  it("une lecture qui lève éteint", async () => {
    expect(await extraitsMaisonActif(async () => { throw new Error("panne"); })).toBe(false);
  });

  it("lit le bon réglage avec le défaut false", async () => {
    const lire = vi.fn(async () => false);
    await extraitsMaisonActif(lire);
    expect(lire).toHaveBeenCalledWith("facecamAnimee.extraitsMaison", false);
    expect(PARAM_EXTRAITS_MAISON_FA).toBe("facecamAnimee.extraitsMaison");
  });
});

describe("éteint = identique, rien n'est branché", () => {
  it("consigneRealisateur() ne contient pas axion:", () => {
    expect(consigneRealisateur()).not.toContain("axion:");
  });

  it("seul le réalisateur cite le fichier neuf", () => {
    const racine = join(process.cwd(), "src");
    const cites: string[] = [];
    const parcourir = (d: string) => {
      for (const n of readdirSync(d)) {
        const p = join(d, n);
        if (statSync(p).isDirectory()) parcourir(p);
        else if (/\.(ts|tsx)$/.test(n) && !p.endsWith("consigne-extraits-maison.ts") && readFileSync(p, "utf8").includes("consigne-extraits-maison")) cites.push(relative(process.cwd(), p).split(sep).join("/"));
      }
    };
    parcourir(racine);
    // MAJ 20/11 (FA-SERVICE-INV-v20h, voulue, à relire) : `src/services/facecam-animee.ts` cite le fichier SEULEMENT pour lire le nom du
    // réglage (constante, défaut éteint) : même garde qu'avant pour tout autre fichier de src/.
    expect(cites).toEqual(["src/moteurs/montage-facecam-animee/realisateur/index.ts", "src/services/facecam-animee.ts"]);
  });

  it("le service ne lit le réglage qu'avec le défaut false et ne cite que son nom (éteint = identique)", () => {
    const service = readFileSync(join(process.cwd(), "src/services/facecam-animee.ts"), "utf8");
    expect(service).toMatch(/import \{ PARAM_EXTRAITS_MAISON_FA \} from "@\/moteurs\/montage-facecam-animee\/realisateur\/consigne-extraits-maison"/);
    expect(service).toMatch(/lireParametre<unknown>\(PARAM_EXTRAITS_MAISON_FA, false\)\) === true/);
  });

  it("garde statique du fichier neuf", () => {
    const src = readFileSync(join(process.cwd(), FICHIER_NEUF), "utf8");
    for (const interdit of ["@/services/", "studio-rendu", "@/fournisseurs/", "Date.now", "Math.random"]) {
      expect(src).not.toContain(interdit);
    }
  });
});
