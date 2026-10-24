/** V3-E : garde d'accès par LECTURE DES SOURCES. Aucune session = aucune donnée ; aucun fournisseur payant dans les écrans. */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const RACINE = "src/app/(studio)/carrousels";
const PRODUCTION = "src/visuels/services/production.ts";

function fichiers(dossier: string): string[] {
  return readdirSync(dossier).flatMap((nom) => {
    const chemin = join(dossier, nom);
    return statSync(chemin).isDirectory() ? fichiers(chemin) : [chemin];
  });
}

const TOUS = fichiers(RACINE);
const ACTIONS = TOUS.filter((f) => /\.tsx?$/.test(f) && readFileSync(f, "utf8").trimStart().startsWith('"use server"'));
const PAGES = TOUS.filter((f) => f.endsWith("page.tsx"));

describe("garde d'accès des carrousels", () => {
  it("les fichiers attendus existent", () => {
    for (const f of ["actions.ts", "page.tsx", "nouveau/actions.ts", "nouveau/page.tsx", "[id]/actions.ts", "[id]/page.tsx"]) expect(TOUS).toContain(join(RACINE, f));
    expect(ACTIONS).toHaveLength(3);
    expect(PAGES).toHaveLength(3);
  });

  it.each(ACTIONS)("%s : chaque action serveur commence par exigerSession", (f) => {
    const source = readFileSync(f, "utf8");
    const exportees = [...source.matchAll(/export\s+async\s+function\s+(\w+)/g)];
    expect(exportees.length).toBeGreaterThan(0);
    for (const m of exportees) {
      const corps = source.slice(m.index!).match(/export\s+async\s+function\s+\w+\s*\([^)]*\)[^{]*\{\s*(await exigerSession\()?/);
      expect(corps?.[1], `${m[1]} doit commencer par await exigerSession(`).toBeTruthy();
    }
  });

  it.each(PAGES)("%s : la page appelle exigerSession", (f) => {
    expect(readFileSync(f, "utf8")).toContain("exigerSession(");
  });

  it.each([...TOUS.filter((f) => /\.tsx?$/.test(f)), PRODUCTION])("%s : aucun fournisseur payant", (f) => {
    const source = readFileSync(f, "utf8");
    expect(source).not.toMatch(/fournisseurs\/claude/);
    expect(source).not.toMatch(/creerFournisseurApi/);
  });

  it("production.ts est réservé au serveur", () => {
    expect(readFileSync(PRODUCTION, "utf8")).toContain('import "server-only"');
  });

  it("la fiche ne se recharge pas toutes les 5 s quand le rendu est périmé (relancer_rendu permis)", () => {
    // UI-1 : l'actualisation suit `renduEnCours` (récent), calculé par le service ; périmé = relance proposée, pas de rechargement.
    const source = readFileSync(join(RACINE, "../../../components/visuels/MessagesFiche.tsx"), "utf8");
    expect(source).toMatch(/fiche\.renduEnCours\s*&&\s*!aCorbeille\s*&&\s*<meta httpEquiv="refresh"/);
  });
});
