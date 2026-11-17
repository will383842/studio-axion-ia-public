import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { ID } from "@/briques/bibliotheque-video/noms";
import { profilNeutre } from "@/briques/bibliotheque-video/profils";
import type { EntreeBibliotheque, ProfilVideo, RegleProfilCapacite } from "@/briques/bibliotheque-video/types";
import { VERSION_BIBLIOTHEQUE } from "@/briques/bibliotheque-video/version";
import { definitionsPermises, maxObjetsParVideo, objetsPermisDesEntrees } from "@/briques/plan-scenes-generateurs/objets-permis";
import type { DefinitionObjet } from "@/briques/motion/petits-objets/contrat";

function entrees(capacites: Partial<Record<string, RegleProfilCapacite>> = {}, verrous: string[] = []) {
  const base = profilNeutre("format-essai");
  const profil: ProfilVideo = { ...base, capacites: capacites as ProfilVideo["capacites"], verrous };
  const e: EntreeBibliotheque = { version: VERSION_BIBLIOTHEQUE, profil, recents: [], graine: "G", figeeLe: "2026-11-16" };
  return { bibliothequeVideo: e };
}

describe("objetsPermisDesEntrees (C9-35a)", () => {
  it.each([[{}], [null], ["texte"], [undefined], [42]])("entrée %j → []", (e) => {
    expect(objetsPermisDesEntrees(e)).toEqual([]);
    expect(maxObjetsParVideo(e)).toBe(0);
  });
  it("profil figé sans objet permis → []", () => {
    expect(objetsPermisDesEntrees(entrees())).toEqual([]);
    expect(maxObjetsParVideo(entrees())).toBe(0);
  });
  it("objet.chiffre permis mais famille objet verrouillée → []", () => {
    expect(objetsPermisDesEntrees(entrees({ [ID.objetChiffre]: { permis: true } }, ["objet"]))).toEqual([]);
  });
  it("objet.chiffre seul → [objet.chiffre]", () => {
    expect(objetsPermisDesEntrees(entrees({ [ID.objetChiffre]: { permis: true } }))).toEqual(["objet.chiffre"]);
  });
  it("ordre de noms.ts, permis seulement, sans capacité hors objet", () => {
    const r = objetsPermisDesEntrees(entrees({ [ID.objetEmoji]: { permis: true }, [ID.objetTrait]: { permis: true }, [ID.texteSousTitres]: { permis: true }, [ID.objetMarque]: { permis: false } }));
    expect(r).toEqual(["objet.trait", "objet.emoji"]);
  });
  it("tableau gelé", () => {
    expect(Object.isFrozen(objetsPermisDesEntrees(entrees({ [ID.objetChiffre]: { permis: true } })))).toBe(true);
    expect(Object.isFrozen(objetsPermisDesEntrees({}))).toBe(true);
  });
  it("jamais d'exception", () => {
    const piege = { get bibliothequeVideo(): unknown { throw new Error("piège"); } };
    expect(objetsPermisDesEntrees(piege)).toEqual([]);
  });
});

describe("maxObjetsParVideo (C9-35a)", () => {
  it("plus petit maxParVideo des permis", () => {
    const e = entrees({ [ID.objetChiffre]: { permis: true, maxParVideo: 3 }, [ID.objetTrait]: { permis: true, maxParVideo: 2 } });
    expect(maxObjetsParVideo(e)).toBe(2);
  });
  it("plafond 4", () => {
    expect(maxObjetsParVideo(entrees({ [ID.objetChiffre]: { permis: true, maxParVideo: 9 } }))).toBe(4);
    expect(maxObjetsParVideo(entrees({ [ID.objetChiffre]: { permis: true } }))).toBe(4);
  });
  it("un maxParVideo négatif ou illisible est ramené à 0", () => {
    expect(maxObjetsParVideo(entrees({ [ID.objetChiffre]: { permis: true, maxParVideo: -1 } }))).toBe(0);
  });
});

describe("definitionsPermises (C9-35a)", () => {
  const def = (capacite: `objet.${string}`) => ({ id: `objet-${capacite.slice(6)}`, capacite }) as unknown as DefinitionObjet<unknown>;
  it("filtre par capacité, ordre conservé", () => {
    const defs = [def("objet.trait"), def("objet.chiffre"), def("objet.emoji")];
    expect(definitionsPermises(defs, ["objet.emoji", "objet.trait"]).map((d) => d.capacite)).toEqual(["objet.trait", "objet.emoji"]);
    expect(definitionsPermises(defs, [])).toEqual([]);
  });
});

describe("garde statique (C9-35a)", () => {
  it("aucun import de services, studio-rendu ou facade", () => {
    const src = readFileSync(join(process.cwd(), "src/briques/plan-scenes-generateurs/objets-permis.ts"), "utf8");
    expect(src).not.toMatch(/@\/services|studio-rendu|facade/);
  });
});
