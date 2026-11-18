/** ATR-02b : « faitLe » (date déjà enregistrée) fourni par la lecture des cartes déjà traitées. Données fictives, rien d'envoyé. */
import { describe, expect, it, vi } from "vitest";

vi.mock("@/services/auth", () => ({ exigerSession: vi.fn(async () => ({})) }));
const G = await import("@/services/a-traiter-gestes");
type Carte = import("@/services/a-traiter-types").CarteATraiter;

const base = (n: number, sur: { statut: Carte["statut"]; faitLe?: string }): Carte => ({
  idEvenement: `evt-fictif-${n}`,
  reseau: "facebook",
  post: `post_fictif_${n}`,
  lienPost: null,
  mot: "GUIDE",
  kit: "Merci pour votre intérêt !",
  motif: "mot_manuel",
  extrait: `Extrait fictif ${n}`,
  creeLe: `2026-11-1${n}T10:00:00.000Z`,
  ...sur,
});
const depotDe = (cartes: Carte[]) => ({ lire: async () => cartes, ecrire: vi.fn(async () => undefined) });
const env = { A_TRAITER_ENABLED: "1" };

describe("ATR-02b · faitLe dans les cartes déjà traitées", () => {
  it("fait avec date : faitLe fourni tel quel ; fait sans date : champ absent ; ignorée : champ absent", async () => {
    const depot = depotDe([
      base(1, { statut: "fait", faitLe: "2026-11-11T13:05:00.000Z" }),
      base(2, { statut: "fait" }),
      base(3, { statut: "ignore", faitLe: "2026-11-13T09:00:00.000Z" }),
    ]);
    const l = await G.gesteLireDejaTraitees({ env, depot });
    const par = Object.fromEntries(l.map((c) => [c.idEvenement, c]));
    expect(par["evt-fictif-1"]?.faitLe).toBe("2026-11-11T13:05:00.000Z");
    expect("faitLe" in (par["evt-fictif-2"] ?? {})).toBe(false);
    expect("faitLe" in (par["evt-fictif-3"] ?? {})).toBe(false);
    expect(depot.ecrire).not.toHaveBeenCalled();
  });
});
