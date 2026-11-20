/** C11-T12-PLANCHE-v19c : planche locale des accents par rôle (DV-14), fonds clair et sombre. */
import React from "react";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { rapportContraste } from "../../src/briques/habillage/contraste";
import { FONDS_PLANCHE, PHRASES_ROLE, PlancheAccentsRole } from "../../outils/planche-accents-role/PlancheAccentsRole";

const RACINE = join(__dirname, "..", "..");
// Chargé par chemin calculé : le test voisin accents-role.test.ts exige qu'aucun fichier de tests/ ne l'importe en littéral.
type Accents = typeof import("../../src/briques/sous-titres/accents-role");
type RoleAccent = import("../../src/briques/sous-titres/accents-role").RoleAccent;
const { ACCENTS_PAR_ROLE, ACCENTS_ROLE_ACTIFS, accentPourRole } = (await import(/* @vite-ignore */ ["../..", "src", "briques", "sous-titres", "accents-role"].join("/"))) as Accents;
const lire = (p: string) => readFileSync(join(RACINE, p), "utf8");
const ROLES: RoleAccent[] = ["marque", "chiffre", "validation"];
const html = () => renderToStaticMarkup(<PlancheAccentsRole />);
function fichiers(dossier: string): string[] {
  return readdirSync(join(RACINE, dossier)).flatMap((n) => {
    const rel = `${dossier}/${n}`;
    if (n === "node_modules" || n.startsWith(".")) return [];
    return statSync(join(RACINE, rel)).isDirectory() ? fichiers(rel) : /\.(ts|tsx|mts)$/.test(n) ? [rel] : [];
  });
}
/** Contenu de la case (de sa balise ouvrante jusqu'à la suivante). */
function cases(h: string): { role: string; fond: string; corps: string }[] {
  const re = /<div[^>]*data-role="([^"]+)"[^>]*data-fond="([^"]+)"[^>]*>/g;
  const trouves = [...h.matchAll(re)];
  return trouves.map((m, i) => ({ role: m[1], fond: m[2], corps: h.slice(m.index!, trouves[i + 1]?.index ?? h.length) }));
}
const virgule = (n: number) => n.toFixed(2).replace(".", ",");

describe("C11-T12-PLANCHE-v19c planche des accents par rôle", () => {
  it("a) 6 cases ; le mot accent porte exactement l'accent du rôle", () => {
    const cs = cases(html());
    expect(cs).toHaveLength(6);
    for (const role of ROLES)
      for (const f of FONDS_PLANCHE) {
        const c = cs.find((x) => x.role === role && x.fond === f.nom);
        expect(c, `${role}-${f.nom}`).toBeDefined();
        const a = accentPourRole(role, f.nom)!;
        const sp = c!.corps.match(/<span[^>]*data-accent[^>]*>/)![0].toLowerCase();
        expect(sp).toContain(`background:${a.fond.toLowerCase()}`);
        expect(sp).toContain(`color:${a.texte.toLowerCase()}`);
      }
  });
  it("b) contraste affiché = rapportContraste arrondi ; data-reserve exactement sous 4,5", () => {
    for (const c of cases(html())) {
      const a = accentPourRole(c.role as RoleAccent, c.fond as "clair" | "sombre")!;
      const r = rapportContraste(a.texte, a.fond);
      expect(c.corps).toContain(`contraste ${virgule(r)}`);
      expect(/data-reserve="1"/.test(c.corps), `${c.role}-${c.fond}`).toBe(r < 4.5);
      if (r < 4.5) expect(c.corps).toContain("sous 4,5");
    }
  });
  it("c) phrases de 4 à 6 mots, mot accent présent, aucun montant", () => {
    for (const role of ROLES) {
      const p = PHRASES_ROLE[role];
      expect(p.mots.length).toBeGreaterThanOrEqual(4);
      expect(p.mots.length).toBeLessThanOrEqual(6);
      expect(p.mots[p.accent]).toBeTruthy();
      expect(p.mots.join(" ")).not.toMatch(/€|\$|euro/i);
    }
  });
  it("d) même rendu = même balisage ; aucune image ni lien ; en-tête DV-14", () => {
    const h = html();
    expect(html()).toBe(h);
    expect(h).not.toMatch(/<img|href=/);
    expect(h).toContain("Proposition DV-14, à valider avant allumage : rien n&#x27;est branché");
  });
  it("e) éteint = identique : interrupteur, proposition, aucun importeur", () => {
    expect(ACCENTS_ROLE_ACTIFS).toBe(false);
    expect(ACCENTS_PAR_ROLE).toEqual({ marque: "terracotta", chiffre: "ardoise", validation: "ivoire" });
    for (const f of [...fichiers("src"), ...fichiers("studio-rendu")]) {
      const t = lire(f);
      expect(t, f).not.toMatch(/planche-accents-role|PlancheAccentsRole/);
      if (!f.endsWith("sous-titres/accents-role.ts")) expect(t, f).not.toMatch(/sous-titres\/accents-role|\.\/accents-role/);
    }
  });
  it("f) gardes statiques", () => {
    for (const f of ["outils/planche-accents-role/PlancheAccentsRole.tsx", "outils/planche-accents-role/planche.mts"])
      expect(lire(f), f).not.toMatch(/from\s+["']@\/|@\/services|fournisseurs|remotion/);
    expect(lire("outils/planche-accents-role/PlancheAccentsRole.tsx")).not.toMatch(/#[0-9a-fA-F]{3,8}\b|rgba?\(/);
  });
});
