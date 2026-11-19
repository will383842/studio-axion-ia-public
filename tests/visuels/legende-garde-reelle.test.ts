/** Lot C (corrections du refus) : la VRAIE garde de `modifierTexteProgramme` est jouée ; jamais de retrait chez le diffuseur depuis la fiche carrousel. */
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { EnvoiPlanifie } from "@/domaine/envoi-planifie";
import * as service from "@/services/deplacer-programmation";
import { PHRASES_DEPLACEMENT, type DepsDeplacement } from "@/services/deplacer-programmation";
import { modifierTexteSansRetrait } from "@/services/legende-vers-creneau";

const etat = vi.hoisted(() => ({ fabrique: undefined as undefined | ((diffuseur: unknown) => unknown) }));
vi.mock("server-only", () => ({}));
vi.mock("@/services/deplacer-programmation", async (orig) => {
  const m = await orig<typeof import("@/services/deplacer-programmation")>();
  return { ...m, depsDeplacementServeur: vi.fn(async (diffuseur?: unknown) => etat.fabrique!(diffuseur)) };
});

const MAINTENANT = new Date("2026-12-10T10:00:00.000Z");
const envoi: EnvoiPlanifie = {
  id: "envoi:vis_1:linkedin:v0", cle: "envoi:vis_1:linkedin:v0", videoId: "vis_1", nature: "visuel", creneauId: "cre_1",
  reseau: "linkedin", versionCreneau: 0, jour: "2026-12-11", heure: "09:30", statut: "valide", valideeLe: "2026-12-01T00:00:00Z", valideePar: "fondateur",
  creeLe: "2026-12-01T00:00:00Z", modifieLe: "2026-12-01T00:00:00Z",
} as EnvoiPlanifie;

function monde() {
  const creneau = { id: "cre_1", jourVise: "2026-12-11", heuresParReseau: { linkedin: "2026-12-11T08:30:00.000Z" }, compteCible: "c1", visuelId: "vis_1", statut: "programme", decalages: 0, valideeLe: "2026-12-01T00:00:00Z", valideePar: "fondateur" };
  const avant = structuredClone(creneau);
  const etats = new Map<string, string>([[`creation:${envoi.cle}`, "cree"]]);
  const retirer = vi.fn(async () => "retire" as const);
  const ecritures: unknown[] = [];
  const fabrique = (diffuseur: unknown): DepsDeplacement => ({
    // Même règle que le câblage serveur : sans argument, un port de retrait réel ; `null` explicite, aucun retrait.
    diffuseur: diffuseur === undefined ? { retirer } : (diffuseur as null),
    reglagesOuverts: async () => true,
    creneau: async () => creneau as never,
    envois: async () => [envoi],
    visuel: async () => ({ id: "vis_1", statut: "programme" }),
    appliquer: async (lot) => void ecritures.push(lot),
    niveau: async () => ({ niveau: "libre" as const }),
    publicationsDeCles: async () => [],
    etats: { lire: async (c) => etats.get(c), noter: async (c, v) => void etats.set(c, v) },
    notifier: async () => undefined,
    maintenant: () => MAINTENANT,
  });
  return { creneau, avant, retirer, ecritures, fabrique };
}

beforeEach(() => { etat.fabrique = undefined; });

describe("report de la légende : la vraie garde, sans retrait possible", () => {
  it("envoi `creation:<clé>=cree` : créneau inchangé, `retirer` jamais appelé, phrase de la garde rendue", async () => {
    const m = monde();
    etat.fabrique = m.fabrique;
    const r = await modifierTexteSansRetrait({ creneauId: "cre_1", reseau: "linkedin", texte: "Ma légende.", auteur: "will", cle: "lgabc" });
    expect(r).toMatchObject({ ok: false, message: PHRASES_DEPLACEMENT.sansRetrait });
    expect(m.retirer).not.toHaveBeenCalled();
    expect(m.ecritures).toEqual([]);
    expect(m.creneau).toEqual(m.avant);
    expect(service.depsDeplacementServeur).toHaveBeenCalledWith(null);
  });
});
