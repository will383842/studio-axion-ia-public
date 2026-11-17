import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { briquesDuMoteur } from "@/briques/bibliotheque-video/facade";
import { ID } from "@/briques/bibliotheque-video/noms";
import { profilNeutre } from "@/briques/bibliotheque-video/profils";
import type { EntreeBibliotheque, ProfilVideo, RegleProfilCapacite } from "@/briques/bibliotheque-video/types";
import { VERSION_BIBLIOTHEQUE } from "@/briques/bibliotheque-video/version";
import { DECLARATIONS } from "@/generateurs/declaration";

function entree(capacites: Partial<Record<string, RegleProfilCapacite>> = {}, verrous: string[] = []): EntreeBibliotheque {
  const base = profilNeutre("format-essai");
  const profil: ProfilVideo = { ...base, capacites: capacites as ProfilVideo["capacites"], verrous };
  return { version: VERSION_BIBLIOTHEQUE, profil, recents: [{ capacite: ID.texteStyleVarie, cle: "k0", videoId: "v0" }], graine: "G", figeeLe: "2026-11-16" };
}
const entrees = (e: EntreeBibliotheque) => ({ bibliothequeVideo: e });

describe("briquesDuMoteur (G2-03)", () => {
  it("format inconnu ou sans consomme : sans exception, listes vides", () => {
    const e = entrees(entree({ [ID.planScenesCasConcret]: { permis: true } }));
    for (const f of ["xyz", "podcast", "constructor", "__proto__"]) {
      const r = briquesDuMoteur(f, e);
      expect(r.formatId).toBe(f);
      if (r.bibliotheque) {
        expect(r.permises).toEqual([]);
        expect(r.fermees).toEqual([]);
      }
    }
  });

  it.each([
    ["undefined", undefined],
    ["objet vide", {}],
    ["illisible", { bibliothequeVideo: "x" }],
    ["null", null],
  ])("sans entrée (%s) : bibliotheque false pour chaque format déclaré", (_n, e) => {
    for (const formatId of Object.keys(DECLARATIONS)) {
      expect(briquesDuMoteur(formatId, e)).toEqual({ formatId, bibliotheque: false });
    }
  });

  it("cas-concret : permises et fermees dans l'ordre de la déclaration", () => {
    const r = briquesDuMoteur("cas-concret", entrees(entree({ [ID.planScenesCasConcret]: { permis: true } })));
    expect(r).toMatchObject({
      formatId: "cas-concret",
      bibliotheque: true,
      permises: [ID.planScenesCasConcret],
      fermees: [ID.transitionCasConcret, ID.cadrageCameraCasConcret],
    });
  });

  it("verrou de famille transition : l'id passe en fermees", () => {
    const r = briquesDuMoteur(
      "cas-concret",
      entrees(entree({ [ID.planScenesCasConcret]: { permis: true }, [ID.transitionCasConcret]: { permis: true } }, ["transition"])),
    );
    if (!r.bibliotheque) throw new Error("attendu : bibliotheque true");
    expect(r.permises).toEqual([ID.planScenesCasConcret]);
    expect(r.fermees).toContain(ID.transitionCasConcret);
  });

  it("capacité permise hors déclaration : absente", () => {
    const r = briquesDuMoteur("cas-concret", entrees(entree({ [ID.sonV4]: { permis: true }, [ID.planScenesCasConcret]: { permis: true } })));
    if (!r.bibliotheque) throw new Error("attendu : bibliotheque true");
    expect(r.permises).not.toContain(ID.sonV4);
    expect(r.fermees).not.toContain(ID.sonV4);
    expect(JSON.stringify(r)).not.toContain(ID.sonV4);
  });

  it("maxParVideo recopié, parFamille groupé", () => {
    const r = briquesDuMoteur(
      "cas-concret",
      entrees(entree({ [ID.planScenesCasConcret]: { permis: true, maxParVideo: 2 }, [ID.transitionCasConcret]: { permis: true } })),
    );
    if (!r.bibliotheque) throw new Error("attendu : bibliotheque true");
    expect(r.maxParVideo).toEqual({ [ID.planScenesCasConcret]: 2 });
    expect(r.parFamille["plan-scenes"]).toEqual([ID.planScenesCasConcret]);
    expect(r.parFamille.transition).toEqual([ID.transitionCasConcret]);
  });

  it("sorties gelées", () => {
    const r = briquesDuMoteur("cas-concret", entrees(entree()));
    expect(Object.isFrozen(r)).toBe(true);
    if (r.bibliotheque) {
      expect(Object.isFrozen(r.permises)).toBe(true);
      expect(Object.isFrozen(r.fermees)).toBe(true);
      expect(Object.isFrozen(r.maxParVideo)).toBe(true);
      expect(Object.isFrozen(r.parFamille)).toBe(true);
    }
  });
});

describe("garde de la façade (G2-03)", () => {
  const racine = process.cwd();
  function lister(dossier: string): string[] {
    const abs = join(racine, dossier);
    if (!existsSync(abs)) return [];
    return readdirSync(abs).flatMap((n) => {
      if (n === "node_modules") return [];
      const p = join(dossier, n);
      return statSync(join(racine, p)).isDirectory() ? lister(p) : /\.(ts|tsx|mjs)$/.test(n) ? [p] : [];
    });
  }

  it("aucun fichier de src/ ni studio-rendu/ n'importe la façade", () => {
    for (const f of [...lister("src"), ...lister("studio-rendu")]) {
      if (f.endsWith("bibliotheque-video/facade.ts")) continue;
      expect(readFileSync(join(racine, f), "utf8"), f).not.toMatch(/bibliotheque-video\/facade/);
    }
  });

  it("facade.ts n'importe ni server-only, ni react, ni services, ni fournisseurs", () => {
    const src = readFileSync(join(racine, "src/briques/bibliotheque-video/facade.ts"), "utf8");
    const imports = [...src.matchAll(/(?:from|import)\s*\(?\s*["']([^"']+)["']/g)].map((m) => m[1]);
    for (const i of imports) {
      expect(i).not.toMatch(/server-only|^react|@\/services|@\/fournisseurs|studio-rendu/);
    }
  });
});
