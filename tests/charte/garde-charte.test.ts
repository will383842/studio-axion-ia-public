import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { defauts, fichiers, relatif } from "./garde-charte";

/** Zones où AUCUNE couleur hors charte ni police autre que Manrope n'est tolérée. */
const STRICTES = ["src/moteurs", "src/briques/charte", "src/briques/motion", "src/briques/habillage", "src/briques/habillage-facecam", "src/briques/sous-titres"];
/** Compositions de la vidéo (hors carrousels `visuels/`, autre chaîne) : cliquet, la liste ne peut que rétrécir. */
const COMPOSITIONS = "studio-rendu/compositions";
const BASE = join(process.cwd(), "tests/charte/compositions-restantes.json");

describe("garde charte Axion 2026", () => {
  for (const zone of STRICTES) {
    it(`${zone} : aucune couleur hors charte, aucune police autre que Manrope`, () => {
      const fautes = fichiers(zone).flatMap((f) => defauts(readFileSync(f, "utf8"), relatif(f)).map((d) => `${relatif(f)} : ${d}`));
      expect(fautes).toEqual([]);
    });
  }

  it("compositions : le nombre de défauts par fichier ne dépasse jamais la liste figée (et ne la laisse pas périmée)", () => {
    const actuel: Record<string, number> = {};
    for (const f of fichiers(COMPOSITIONS)) {
      const r = relatif(f);
      if (r.startsWith(`${COMPOSITIONS}/visuels/`)) continue;
      const n = defauts(readFileSync(f, "utf8"), r).length;
      if (n > 0) actuel[r] = n;
    }
    if (process.env.GARDE_CHARTE_ECRIRE === "1") {
      writeFileSync(BASE, JSON.stringify(Object.fromEntries(Object.entries(actuel).sort()), null, 2) + "\n");
    }
    const base: Record<string, number> = existsSync(BASE) ? JSON.parse(readFileSync(BASE, "utf8")) : {};
    const plus = Object.entries(actuel).filter(([f, n]) => n > (base[f] ?? 0)).map(([f, n]) => `${f} : ${n} (liste : ${base[f] ?? 0})`);
    const moins = Object.entries(base).filter(([f, n]) => (actuel[f] ?? 0) < n).map(([f, n]) => `${f} : ${actuel[f] ?? 0} (liste : ${n}) → mettre à jour la liste`);
    expect({ plus, moins }).toEqual({ plus: [], moins: [] });
  });
});
