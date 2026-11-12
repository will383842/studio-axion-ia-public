/**
 * GV-N2 : une retouche de face caméra garde les mots colorés validés à l'origine (ils ne sont pas recalculés
 * depuis le script). PUR : aucun réseau.
 */
import { describe, expect, it } from "vitest";
import { etatPourRetouche, lireReprise, repriseDeLaChaine, signatureMontage, VERSION_REPRISE, type RepriseChaine } from "@/moteurs/montage-facecam/retouche";
import type { EtatChaine } from "@/moteurs/montage-facecam/chaine";

const e = { facecam: { coupes: { auto: [], retablies: [] }, passages: [] } };
const signature = signatureMontage(e);

function etatAvecHabillage(emphase?: string[], abandonne = false): EtatChaine {
  return { version: "chaine-facecam-1", travaux: {}, habillage: { abandonne, cartes: [], motsImportants: { source: "script", ...(emphase ? { emphase } : {}) } } } as unknown as EtatChaine;
}

function reprise(extra: Partial<RepriseChaine> = {}): RepriseChaine {
  return { version: VERSION_REPRISE, signature, travaux: {}, cartes: [], dureeSec: 30, ...extra };
}

describe("GV-N2 · mots colorés validés gardés en retouche", () => {
  it("repriseDeLaChaine copie motsImportants", () => {
    const r = repriseDeLaChaine(etatAvecHabillage(["gagner", "temps"]), signature, 30);
    expect(r.motsImportants).toEqual({ source: "script", emphase: ["gagner", "temps"] });
  });

  it("repriseDeLaChaine ne copie rien si l'habillage est abandonné ou absent", () => {
    expect(repriseDeLaChaine(etatAvecHabillage(["a"], true), signature, 30).motsImportants).toBeUndefined();
    expect(repriseDeLaChaine({ version: "chaine-facecam-1", travaux: {} } as EtatChaine, signature, 30).motsImportants).toBeUndefined();
  });

  it("etatPourRetouche donne emphaseValidee (copie)", () => {
    const r = reprise({ motsImportants: { source: "script", emphase: ["gagner"] } });
    const etat = etatPourRetouche(r, { entrees: e }, new Set(["habillage"]), []);
    expect(etat.emphaseValidee).toEqual(["gagner"]);
    expect(etat.emphaseValidee).not.toBe(r.motsImportants!.emphase);
  });

  it("sans motsImportants : emphaseValidee est absent", () => {
    const etat = etatPourRetouche(reprise(), { entrees: e }, new Set(["habillage"]), []);
    expect("emphaseValidee" in etat).toBe(false);
  });

  it("une liste vide est gardée vide, pas remplacée par le script", () => {
    const etat = etatPourRetouche(reprise({ motsImportants: { source: "script", emphase: [] } }), { entrees: e }, new Set(["habillage"]), []);
    expect(etat.emphaseValidee).toEqual([]);
  });

  it("lireReprise complète une ancienne reprise depuis repriseFormats", () => {
    const projet = { moteur: "montage-facecam", reprise: reprise(), repriseFormats: { habillage: { emphase: ["vite", "simple"] } } };
    expect(lireReprise(projet)?.motsImportants).toEqual({ source: "script", emphase: ["vite", "simple"] });
  });

  it("lireReprise ne complète rien si repriseFormats n'a pas d'emphase, et respecte un champ déjà présent", () => {
    expect(lireReprise({ moteur: "montage-facecam", reprise: reprise(), repriseFormats: { habillage: { emphase: [] } } })?.motsImportants).toBeUndefined();
    expect(lireReprise({ moteur: "montage-facecam", reprise: reprise() })?.motsImportants).toBeUndefined();
    const deja = reprise({ motsImportants: { source: "script", emphase: ["a"] } });
    expect(lireReprise({ moteur: "montage-facecam", reprise: deja, repriseFormats: { habillage: { emphase: ["b"] } } })?.motsImportants?.emphase).toEqual(["a"]);
  });
});
