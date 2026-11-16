/** C11-T12 : accents par rôle (marque, chiffre, validation), teintes de `MARQUEURS` seulement. Éteint par défaut. */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { PALETTE, autoriserTexte } from "@/briques/charte/axion-2026";
import { MARQUEURS } from "@/briques/sous-titres/marqueur";
import { ACCENTS_PAR_ROLE, ACCENTS_ROLE_ACTIFS, accentPourRole, type RoleAccent } from "@/briques/sous-titres/accents-role";

const ROLES: RoleAccent[] = ["marque", "chiffre", "validation"];

describe("accents par rôle (C11-T12)", () => {
  it("chaque rôle correspond à une teinte de MARQUEURS", () => {
    for (const role of ROLES) expect(Object.keys(MARQUEURS)).toContain(ACCENTS_PAR_ROLE[role]);
    expect(ACCENTS_PAR_ROLE).toEqual({ marque: "terracotta", chiffre: "ardoise", validation: "ivoire" });
  });

  it("le surlignage rendu est celui de MARQUEURS, sans couleur libre", () => {
    for (const role of ROLES) {
      const m = MARQUEURS[ACCENTS_PAR_ROLE[role]];
      expect(accentPourRole(role, "sombre")).toEqual({ fond: m.fond, texte: m.texte });
      expect(accentPourRole(role, "clair")).toEqual({ fond: m.fondClair ?? m.fond, texte: m.texteClair ?? m.texte });
    }
  });

  it("validation (ivoire) reste lisible : bloc noir sur écran clair, bloc ivoire sur écran sombre", () => {
    expect(accentPourRole("validation", "clair")).toEqual({ fond: PALETTE.noir, texte: PALETTE.ivoire });
    expect(accentPourRole("validation", "sombre")).toEqual({ fond: PALETTE.ivoire, texte: PALETTE.noir });
  });

  it("toute paire rendue passe autoriserTexte", () => {
    for (const role of ROLES)
      for (const fond of ["clair", "sombre"] as const) {
        const s = accentPourRole(role, fond);
        expect(s).not.toBeNull();
        expect(autoriserTexte(s!.texte, s!.fond)).toBe(true);
      }
  });

  it("rôle inconnu → null", () => {
    expect(accentPourRole("inconnu" as RoleAccent, "clair")).toBeNull();
    expect(accentPourRole("toString" as RoleAccent, "clair")).toBeNull();
    expect(accentPourRole(undefined as unknown as RoleAccent, "clair")).toBeNull();
  });

  it("éteint par défaut, et aucun fichier existant n'importe accents-role", () => {
    expect(ACCENTS_ROLE_ACTIFS).toBe(false);
    const visiter = (dossier: string): string[] =>
      readdirSync(dossier).flatMap((nom) => {
        if (nom === "node_modules" || nom === ".next" || nom === ".git") return [];
        const p = join(dossier, nom);
        return statSync(p).isDirectory() ? visiter(p) : /\.(ts|tsx)$/.test(nom) ? [p] : [];
      });
    const importeurs = [...visiter("src"), ...visiter("studio-rendu"), ...visiter("tests")].filter(
      (p) => !p.endsWith("accents-role.ts") && !p.endsWith("accents-role.test.ts") && /from\s+["'][^"']*accents-role["']/.test(readFileSync(p, "utf8")),
    );
    expect(importeurs).toEqual([]);
  });
});
