import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { describe, expect, it } from "vitest";
import type { MotHorodate } from "@/domaine/types";
import { appliquerZooms, cadrePour, controlerRealisation, realiser, ZOOM_TAILLE } from "@/briques/realisation";

/** Débit régulier ; un mot sur 7 est long (mot important). */
function parole(debut: number, fin: number): MotHorodate[] {
  const mots: MotHorodate[] = [];
  for (let t = debut, i = 0; t + 0.3 < fin; t += 0.385, i++) mots.push({ mot: i % 7 === 3 ? "transformation" : "et", debutSec: +t.toFixed(3), finSec: +(t + 0.3).toFixed(3) });
  return mots;
}
const SOURCE = { largeur: 3840, hauteur: 2160 };
const gardes = [{ debutSec: 0, finSec: 60 }];
const mots = parole(0.05, 59.95);

describe("ZOOM-PLAFOND-115-v21u : le rapproché de la face caméra classique plafonné à 115 %", () => {
  it("(a) plafond 115 : zoom et montée automatique, avec et sans grain fort", () => {
    expect(ZOOM_TAILLE).toBe(115);
    for (const grainFort of [false, true]) {
      const plan = realiser({ gardes, mots, source: SOURCE, grainFort });
      const tailles = plan.plans.map((p) => p.taille);
      expect(Math.max(...tailles)).toBe(115);
      expect(tailles).not.toContain(130);
    }
  });

  it("(b) zoom demandé visible : plan zoomé à 115 %, plan voisin à 100 %", () => {
    const p = realiser({ gardes: [{ debutSec: 0, finSec: 12 }], mots: [], source: SOURCE });
    const z = appliquerZooms(p.plans, [{ debutSec: 3.2, finSec: 4 }], SOURCE);
    const k = z.findIndex((x) => x.zoomDemande);
    expect(k).toBeGreaterThan(0);
    expect(z[k].taille).toBe(115);
    expect(z[k].cadre.largeur).toBe(cadrePour(115, { yeuxX: 0.5, yeuxY: 0.34 }, SOURCE, 9 / 16).cadre.largeur);
    expect(z[k].cadre.largeur).toBe(1056);
    expect(z[k - 1].taille).toBe(100);
    // le plan qui suit, s'il était déjà à 115 %, repasse à 100 % (le zoom se voit)
    if (z[k + 1]) expect(z[k + 1].taille).toBe(100);
  });

  it("(c) écart ≥ 12 % gardé entre deux plans", () => {
    const plan = realiser({ gardes, mots, source: SOURCE });
    expect(controlerRealisation(plan).ecartsInsuffisants).toEqual([]);
  });

  it("(d) monteur-facecam intact : aucune ligne changée, aucun plafond de zoom écrit dedans", () => {
    const chemin = "src/services/monteur-facecam.ts";
    let diff = "";
    try {
      diff = execFileSync("git", ["diff", "origin/master", "--", chemin], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
    } catch {
      /* origin/master absent (clone superficiel) : la garde de texte ci-dessous reste */
    }
    expect(diff).toBe("");
    const texte = readFileSync(chemin, "utf8");
    expect(texte).not.toMatch(/ZOOM_TAILLE\s*=|zoomPlafond/);
  });
});
