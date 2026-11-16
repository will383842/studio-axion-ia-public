import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { DROITS } from "../../../src/briques/droits";
import type { EntreeDroit } from "../../../src/briques/droits";
import { SPDX_ADMIS, admissibleEnAutomatique } from "../../../src/briques/droits/licences";

const RACINE = new URL("../../../", import.meta.url);
const CHAMPS = ["famille", "versionFigee", "spdx", "fichierLicence", "adresseSource", "adresseLicence"] as const;

/** Retourne les défauts d'une entrée icône/animation (liste vide = conforme). */
function defauts(d: EntreeDroit): string[] {
  const r: string[] = [];
  for (const c of CHAMPS) if (typeof d[c] !== "string" || (d[c] as string).trim() === "") r.push(`${d.id}.${c} vide`);
  if (d.creditRequis !== false) r.push(`${d.id}.creditRequis`);
  if (!d.spdx || !(SPDX_ADMIS as readonly string[]).includes(d.spdx)) r.push(`${d.id}.spdx non admis`);
  if (!d.fichierLicence || !existsSync(new URL(d.fichierLicence, RACINE))) r.push(`${d.id}.fichierLicence absent`);
  else if (!readFileSync(new URL(d.fichierLicence, RACINE), "utf8").toLowerCase().includes((d.licence.split(" ")[0] ?? "").toLowerCase()))
    r.push(`${d.id}.fichierLicence sans nom de licence`);
  return r;
}

const faux = (extra: Partial<EntreeDroit>): EntreeDroit => ({
  id: "faux", type: "icone", licence: "MIT", auteur: "x", preuve: "x", date: "2026-11-15",
  famille: "f", versionFigee: "1", spdx: "MIT", fichierLicence: "NOTICE.md", adresseSource: "a", adresseLicence: "b", creditRequis: false, ...extra,
});

describe("familles d'icônes et d'animations", () => {
  it("toute entrée icone/animation du registre est conforme", () => {
    for (const d of DROITS.filter((e) => e.type === "icone" || e.type === "animation")) {
      expect(defauts(d), d.id).toEqual([]);
      expect(admissibleEnAutomatique(d), d.id).toBe(true);
    }
  });

  it("faux jeu CC-BY refusé", () => {
    expect(defauts(faux({ spdx: "CC-BY-4.0", licence: "CC-BY-4.0" })).length).toBeGreaterThan(0);
    expect(admissibleEnAutomatique(faux({ spdx: "CC-BY-4.0", licence: "CC-BY-4.0" }))).toBe(false);
  });

  it("champ vide, crédit requis ou fichier absent refusés", () => {
    expect(defauts(faux({ famille: "" }))).not.toEqual([]);
    expect(defauts(faux({ creditRequis: undefined }))).not.toEqual([]);
    expect(defauts(faux({ fichierLicence: "nexiste/pas.txt" }))).not.toEqual([]);
  });
});
