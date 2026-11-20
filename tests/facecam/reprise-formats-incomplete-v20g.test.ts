/**
 * FIX-REPRISE-FORMATS-v20g : `etatRepriseFormats` répond `null` (rien à reprendre) quand la reprise gardée n'a pas de
 * `travaux`, au lieu de lever un TypeError. Les cas déjà corrects sont figés pour ne pas bouger.
 */
import { describe, expect, it } from "vitest";
import { etatRepriseFormats } from "@/moteurs/montage-facecam/declinaisons";
import type { PlanCamera } from "@/briques/realisation";

const plan = (debutSec: number, finSec: number): PlanCamera => ({
  debutSec,
  finSec,
  priseDebutSec: debutSec + 10,
  priseFinSec: finSec + 10,
  taille: 100,
  cadre: { x: 1500, y: 0, largeur: 1214, hauteur: 2160 },
  ouverture: debutSec === 0 ? "debut" : "coupe",
  yeuxHauteur: 0.34,
});

const plans = [plan(0, 4), plan(4, 9)];
const son = { id: "son", statut: "termine", essais: 0 };
const projet = (reprise: unknown) => ({ repriseFormats: reprise }) as Record<string, unknown>;

describe("etatRepriseFormats : reprise incomplète", () => {
  it("travaux absent : null, sans lever", () => {
    const appel = () => etatRepriseFormats(projet({ plans: [plan(0, 4)] }), ["1:1"]);
    expect(appel).not.toThrow();
    expect(appel()).toBeNull();
  });

  it("travaux vide : null", () => {
    expect(etatRepriseFormats(projet({ travaux: {}, plans }), ["1:1"])).toBeNull();
  });

  it("travaux nul : null, sans lever", () => {
    expect(etatRepriseFormats(projet({ travaux: null, plans }), ["1:1"])).toBeNull();
  });
});

describe("etatRepriseFormats : cas inchangés", () => {
  it("projet absent, plans vides, son non terminé : null", () => {
    expect(etatRepriseFormats(undefined, ["1:1"])).toBeNull();
    expect(etatRepriseFormats(projet({ travaux: { son }, plans: [] }), ["1:1"])).toBeNull();
    expect(etatRepriseFormats(projet({ travaux: { son: { ...son, statut: "soumis" } }, plans }), ["1:1"])).toBeNull();
  });

  it("reprise complète : état de reprise identique à avant", () => {
    const e = etatRepriseFormats(projet({ travaux: { son }, plans, faits: [] }), ["9:16", "1:1"])!;
    expect(e.version).toBe("reprise-formats-1");
    expect(e.plans).toBe(plans);
    expect(e.sauts).toEqual([]);
    expect(e.mots).toEqual({ statut: "fait", essais: 0 });
    expect(e.travaux).toEqual({ son });
    expect(e.declinaisons!.ratios).toEqual(["1:1"]);
    expect(e.declinaisons!.imposes).toEqual(["1:1"]);
    expect(e.declinaisons!.source).toEqual({ largeur: 3840, hauteur: 2160 });
  });
});
