import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { ID } from "@/briques/bibliotheque-video/noms";
import { PROFILS_DU_CODE, profilNeutre } from "@/briques/bibliotheque-video/profils";
import type { EntreeBibliotheque, ProfilVideo, RegleProfilCapacite } from "@/briques/bibliotheque-video/types";
import { VERSION_BIBLIOTHEQUE } from "@/briques/bibliotheque-video/version";
import { piecesPermisesDesEntrees } from "@/briques/plan-scenes-objets/pieces-permises";
import { OBJETS_INSCRITS } from "@/briques/plan-scenes-objets/registre";

function entrees(capacites: Partial<Record<string, RegleProfilCapacite>> = {}, verrous: string[] = []) {
  const base = profilNeutre("format-essai");
  const profil: ProfilVideo = { ...base, capacites: capacites as ProfilVideo["capacites"], verrous };
  const e: EntreeBibliotheque = { version: VERSION_BIBLIOTHEQUE, profil, recents: [], graine: "G", figeeLe: "2026-11-17" };
  return { bibliothequeVideo: e };
}

describe("piecesPermisesDesEntrees (N-03b)", () => {
  it.each([[{}], [null], ["x"], [42], [undefined]])("entrée %j → [] gelé, sans exception", (e) => {
    const r = piecesPermisesDesEntrees(e);
    expect(r).toEqual([]);
    expect(Object.isFrozen(r)).toBe(true);
  });

  it("entrée figée du profil demo-facecam → []", () => {
    const e: EntreeBibliotheque = { version: VERSION_BIBLIOTHEQUE, profil: PROFILS_DU_CODE["demo-facecam"], recents: [], graine: "G", figeeLe: "2026-11-17" };
    expect(piecesPermisesDesEntrees({ bibliothequeVideo: e })).toEqual([]);
  });

  it("objet.chiffre permis → contient objet-gros-chiffre, aucune pièce d'une autre capacité", () => {
    const r = piecesPermisesDesEntrees(entrees({ [ID.objetChiffre]: { permis: true } }));
    expect(r).toContain("objet-gros-chiffre");
    const autres = OBJETS_INSCRITS.filter((d) => d.capacite !== "objet.chiffre").map((d) => d.id);
    for (const id of autres) expect(r).not.toContain(id);
    expect(Object.isFrozen(r)).toBe(true);
  });

  it("famille objet verrouillée → []", () => {
    expect(piecesPermisesDesEntrees(entrees({ [ID.objetChiffre]: { permis: true } }, ["objet"]))).toEqual([]);
  });

  it("ordre du registre, sans doublon", () => {
    const r = piecesPermisesDesEntrees(entrees({ [ID.objetChiffre]: { permis: true }, [ID.objetTrait]: { permis: true }, [ID.objetEmoji]: { permis: true } }));
    const ordre = OBJETS_INSCRITS.map((d) => d.id as string).filter((id) => r.includes(id as never));
    expect([...r]).toEqual(ordre);
    expect(new Set(r).size).toBe(r.length);
    expect(r.length).toBeGreaterThan(1);
  });

  it("garde statique : aucun import de @/services, studio-rendu, facade, reglages", () => {
    const src = readFileSync(join(process.cwd(), "src/briques/plan-scenes-objets/pieces-permises.ts"), "utf8");
    const imports = src.split("\n").filter((l) => /^\s*import\b/.test(l)).join("\n");
    for (const interdit of ["@/services", "studio-rendu", "facade", "reglages"]) expect(imports).not.toContain(interdit);
  });
});
