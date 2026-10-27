/** « 1 rappel » : le nombre 1 sans unité est affiché seulement (le script dit « un rappel », article), les autres chiffres restent à dire. */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import type { CarteImage } from "@/domaine/image-video/carte";
import { chiffresDeLaCarte } from "@/domaine/image-video/carte";

const carteC: CarteImage = JSON.parse(readFileSync(join(process.cwd(), "tests/image-video/fixtures/cartes/C.json"), "utf8"));

describe("chiffre 1 sans unité", () => {
  it("« 1 rappel » n'est pas à dire ; « 3 rappels » et « 1 jour » le restent", () => {
    const c = structuredClone(carteC);
    c.chiffres = [];
    c.noeuds[0].detail = "1 rappel la veille, 3 relances, 1 jour";
    const ch = chiffresDeLaCarte(c).filter((x) => x.dansNoeud === c.noeuds[0].id);
    expect(ch.find((x) => x.brut.startsWith("1 rappel"))?.aDire).toBe(false);
    expect(ch.find((x) => x.brut.startsWith("3"))?.aDire).toBe(true);
    expect(ch.find((x) => x.brut.startsWith("1 jour"))?.aDire).toBe(true);
  });
});
