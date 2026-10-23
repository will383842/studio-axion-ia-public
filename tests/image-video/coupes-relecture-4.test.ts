/**
 * 17/10 (relecture #283, 4e passage, À CORRIGER) : une voyelle isolée très courte (45 à 59 ms), entière et bien audible
 * (bruit + 18 dB), n'a que DEUX fenêtres de parole (40 ms). Horodatée avec 0,18 s de retard, isolée par deux pauses (une
 * respiration dans la pause qui la précède : la fin précédente ne peut pas avancer jusqu'à elle), elle tombait dans
 * l'écart retiré : le placement la laissait (« ≤ 40 ms ») et le filet ne refusait pas (« > 40 ms ») : mot perdu sans
 * refus. Premier mot : le masque n'en voit parfois qu'UNE fenêtre avant le début du plan, et `premierSon` en exigeait
 * deux (graines 1058 et 100158 du relecteur). Le dernier mot (`derniereParole`, même règle) est déjà rattrapé ici par
 * l'avance de la fin jusqu'au silence suivant ; aucun cas rouge ne l'isole.
 * Chaque version est vérifiée contre la vérité du générateur (`verdictR3`) : refusée, ou acceptée sans aucun son de mot
 * retiré (le mot gardé) ; jamais perdue. Grille : 4 bruits, durée et position du mot sur la grille des fenêtres.
 */
import { describe, expect, it } from "vitest";
import { couperVoixIV, paroleDans, type MesureSonIV } from "@/moteurs/montage-image-video/assemblage";
import { TYPES_BRUIT_R3, couperR3, verdictR3, voixScenarioR3, type MotScenarioR3 } from "./voix-relecture-3";

const BRUIT_DB = -45;
const VOIX_DB = BRUIT_DB + 18;
const RETARD_SEC = 0.18;

const mot = (debutSec: number, voyelles: [string, number][], decalageSec = 0): MotScenarioR3 => ({ debutSec, voyelles, decalageSec });
const long = (t: number, decalageSec = 0) => mot(t, [["e", 0.12], ["o", 0.12], ["a", 0.1]], decalageSec);

type Cas = "milieu" | "fin";

/** Voix (et corps, pour une fin) d'un point de la grille : mot court de `d` secondes, décalé de `dx` sur la grille. */
function scenario(cas: Cas, type: (typeof TYPES_BRUIT_R3)[number], d: number, dx: number) {
  const g = 7 + Math.round(d * 1e4) + Math.round(dx * 1e4) * 100;
  const base = { bruitDb: BRUIT_DB, typeBruit: type, voixDb: VOIX_DB };
  if (cas === "milieu") {
    const v = voixScenarioR3(g, { ...base, dureeSec: 3.6, mots: [long(0.3), mot(1.3 + dx, [["a", d]], RETARD_SEC), long(2.0, RETARD_SEC), long(2.7, RETARD_SEC)], respirations: [[0.85, 1.05, -36], [1.55, 1.75, -36]] });
    return { v, debut: 1.3 + dx };
  }
  const v = voixScenarioR3(g, { ...base, dureeSec: 2.7, mots: [long(0.3), long(1.0), mot(2.0 + dx, [["a", d]], RETARD_SEC)], respirations: [[1.6, 1.8, -36], [2.25, 2.45, -36]] });
  const c = voixScenarioR3(g + 1, { ...base, dureeSec: 1.4, mots: [long(0.3), long(0.8)] });
  return { v, c, debut: 2.0 + dx };
}

function grille(cas: Cas, durees: number[]) {
  const perdus: string[] = [];
  let [voix, refus, deuxFenetresAuPlus] = [0, 0, 0];
  for (const type of TYPES_BRUIT_R3) {
    for (const d of durees) {
      for (const dx of [0, 0.005, 0.01, 0.015]) {
        const { v, c, debut } = scenario(cas, type, d, dx);
        const r = c ? verdictR3(c, v) : verdictR3(v);
        const m = c ? couperR3(c, v).mesures.fin! : couperR3(v).mesures.corps;
        if (paroleDans(m, debut - 0.02, debut + d + 0.02) <= 0.04 + 1e-9) deuxFenetresAuPlus++;
        voix++;
        if (r.refusee) refus++;
        else if (r.defauts.length) perdus.push(`${type}, ${(d * 1000).toFixed(0)} ms, +${(dx * 1000).toFixed(0)} ms : ${r.defauts.join(" ; ")}`);
      }
    }
  }
  console.log(`[relecture 4] ${cas} : ${refus}/${voix} refus, ${perdus.length} perdus, ${deuxFenetresAuPlus} mots à deux fenêtres de parole au plus`);
  return { perdus, deuxFenetresAuPlus };
}

describe("relecture #283, 4e passage : voyelle très courte isolée, horodatée en retard", () => {
  it("(a) au milieu : voyelle de 45 à 59 ms (55 ms comprise) à bruit + 18 dB, isolée par deux pauses, 0,18 s de retard → refus ou mot gardé, jamais perdu", () => {
    const { perdus, deuxFenetresAuPlus } = grille("milieu", [0.045, 0.049, 0.051, 0.055, 0.059]);
    expect(deuxFenetresAuPlus).toBeGreaterThan(0);
    expect(perdus).toEqual([]);
  }, 60_000);

  it("(b) PREMIER mot de 46 ms (une seule fenêtre de parole avant le début du plan), horodaté 0,18 s en retard → gardé", () => {
    // Mesure du relecteur (graines 1058 et 100158) : fenêtres de 20 ms, bruit à −44 dB, seuil à −38 dB ; la voyelle de
    // 0,40 à 0,446 s est au-dessus du seuil sur trois fenêtres, mais le masque de parole n'en retient qu'une (0,42–0,44).
    const f = 0.02;
    const niveaux = Array.from({ length: 100 }, (_, w) => (w === 21 ? -22 : w === 20 || w === 22 ? -30 : w >= 41 && w < 61 ? -20 : -44));
    const paroles = niveaux.map((_, w) => w === 21 || (w >= 41 && w < 61));
    const m: MesureSonIV = { silences: [{ debutSec: 0, finSec: 0.4 }, { debutSec: 0.46, finSec: 0.82 }, { debutSec: 1.22, finSec: 2 }], seuilDb: -38, niveaux, fenetreSec: f, niveauParoleDb: -24, paroles };
    const mots = [
      { mot: "m1", debutSec: 0.58, finSec: 0.626 },
      { mot: "m2.", debutSec: 1.0, finSec: 1.4 },
    ];
    const r = couperVoixIV({ mots, dureeSec: 2 }, undefined, { corps: m });
    expect([r.hors, r.paroleRetiree]).toEqual([[], []]);
    expect(r.plan.morceaux[0].debutSec).toBeLessThanOrEqual(0.4);
  });

  it("(c) fin de phrase (voix de fin) : voyelle de 45 à 49 ms (47 ms comprise) → refus ou mot gardé, jamais perdu", () => {
    const { perdus, deuxFenetresAuPlus } = grille("fin", [0.045, 0.047, 0.049]);
    expect(deuxFenetresAuPlus).toBeGreaterThan(0);
    expect(perdus).toEqual([]);
  }, 60_000);
});
