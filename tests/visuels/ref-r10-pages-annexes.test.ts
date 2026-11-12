import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const RACINE = join(__dirname, "..", "..");
const lire = (c: string) => readFileSync(join(RACINE, c), "utf-8");
const CSS = lire("src/app/globals.css");
const racine = CSS.slice(CSS.indexOf(":root {"), CSS.indexOf("}", CSS.indexOf(":root {")));
const jeton = (n: string) => new RegExp(`--${n}:\s*([^;]+);`).exec(racine)![1]!.trim().toLowerCase();

describe("REF-R10 : pages annexes", () => {
  it("global-error recopie les jetons clairs de globals.css (aucune couleur écrite à part)", () => {
    const src = lire("src/app/global-error.tsx");
    const bloc = /const JETONS_ERREUR = \{([\s\S]*?)\} as const/.exec(src)![1]!;
    const v = (k: string) => new RegExp(`${k}: "(#[0-9a-fA-F]+)"`).exec(bloc)![1]!.toLowerCase();
    expect(v("fond")).toBe(jeton("fond"));
    expect(v("texte")).toBe(jeton("texte"));
    expect(v("texteDoux")).toBe(jeton("texte-doux"));
    expect(v("accent")).toBe(jeton("accent"));
    expect(v("orange")).toBe(jeton("orange"));
    expect(v("surOrange")).toBe(jeton("sur-orange"));
    expect(src.replace(bloc, "")).not.toMatch(/#[0-9a-fA-F]{3,6}\b/);
  });
  it("la page publique prend la charte figée, pas les jetons bleus", () => {
    const bloc = /\.charte-publique \{([\s\S]*?)\n\}/.exec(CSS)![1]!;
    for (const [n, c] of [["fond", "ivoire"], ["texte", "noir"], ["orange", "orange"]] as const) expect(bloc).toContain(`--${n}: var(--charte-${c});`);
    expect(bloc).not.toMatch(/#[0-9a-f]{3,6}\b(?<!#ffffff)/i);
  });
  it("les pages /v utilisent le cadre public, le vrai logo et un seul bouton orange plein", () => {
    const page = lire("src/app/v/[code]/page.tsx");
    const exp = lire("src/app/v/[code]/not-found.tsx");
    expect(page + exp).toContain("CadrePublic");
    expect(lire("src/components/annexes/PagePublique.tsx")).toContain("/logo-axion-ia.png");
    expect(page.match(/bg-orange(?![-w])\b/g)).toHaveLength(1);
    expect(exp).not.toMatch(/bg-orange(?![-w])\b/);
    expect(lire("src/components/ui/LecteurVideo.tsx")).not.toMatch(/bg-orange(?![-w])\b/);
  });
  it("la 404 est en accent (bleu) et plus en orange", () => {
    const src = lire("src/components/annexes/Introuvable.tsx");
    expect(src).toMatch(/text-accent[^"]*">\s*404/);
    expect(src).not.toMatch(/text-orange/);
  });
  it("un format masqué porte « Masqué »", () => {
    expect(lire("src/app/(studio)/formats/[id]/page.tsx")).toContain("Masqué");
  });
});
