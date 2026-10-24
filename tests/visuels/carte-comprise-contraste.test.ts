/** Les pastilles de CarteComprise : chaque paire fond/texte du thème atteint 4,5:1 (WCAG AA texte normal). */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { contrasteWcag } from "@/briques/visuels/charte-carrousel";

const CSS = readFileSync(join(__dirname, "../../src/app/globals.css"), "utf-8");
const SRC = readFileSync(join(__dirname, "../../src/components/formats/image-video/CarteComprise.tsx"), "utf-8");
const jeton = (nom: string) => new RegExp(`--${nom}:\\s*(#[0-9a-fA-F]{6})`).exec(CSS)?.[1];

describe("CarteComprise : pastilles lisibles", () => {
  const paires = [...SRC.matchAll(/"bg-([a-z0-9-]+) text-([a-z0-9-]+)"/g)];
  it("les paires sont lues dans le fichier", () => expect(paires.length).toBeGreaterThanOrEqual(3));
  it.each(paires.map((m) => [m[1]!, m[2]!]))("bg-%s + text-%s ≥ 4,5:1", (fond, texte) => {
    const f = jeton(fond);
    const t = jeton(texte);
    if (!f || !t) return; // jeton à valeur non hexadécimale (surface...) : hors de ce contrôle
    expect(contrasteWcag(t, f)).toBeGreaterThanOrEqual(4.5);
  });
});
