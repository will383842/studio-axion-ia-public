/** F4b · une carte reconnue opposée À LA LECTURE (registre) remonte en tête : le recalcul de `opposee` précède le tri. Identifiants fictifs. */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/services/auth", () => ({ exigerSession: vi.fn(async () => ({})) }));
const { reinitialiserDepots } = await import("@/donnees/memoire");
const A = await import("@/services/a-traiter");
const Opp = await import("@/services/oppositions-mots");

const CLE = "cle-fictive-tri-opposee-0123456789-abcdefghij";
const ORIGINE = process.env.STUDIO_EMPREINTE_SECRET;
const env = { A_TRAITER_ENABLED: "1" };
const base = { reseau: "instagram", post: "post-1", commentaire: "X", reponse: "Merci !" };

beforeEach(() => {
  reinitialiserDepots();
  process.env.STUDIO_EMPREINTE_SECRET = CLE;
  for (const m of ["log", "error", "warn", "info"] as const) vi.spyOn(console, m).mockImplementation(() => undefined);
});
afterEach(() => {
  vi.restoreAllMocks();
  if (ORIGINE === undefined) delete process.env.STUDIO_EMPREINTE_SECRET;
  else process.env.STUDIO_EMPREINTE_SECRET = ORIGINE;
});

describe("lireVueATraiter : tri après le recalcul de « opposee »", () => {
  it("une carte moins prioritaire, opposée selon le registre à la lecture, passe devant une carte normale plus prioritaire", async () => {
    const depot = A.creerDepotMemoire();
    await A.enregistrerATraiter({ ...base, idEvenement: "ev-tri-1", motif: "mot_inconnu", mot: "AUTRE", idContact: "ct_tri_normal" }, { env, depot });
    await A.enregistrerATraiter({ ...base, idEvenement: "ev-tri-2", motif: "mot_manuel", mot: "MANUEL", idContact: "ct_tri_opposee" }, { env, depot });
    const avant = await A.lireVueATraiter({ env, depot });
    expect(avant.cartes.map((c) => c.idEvenement)).toEqual(["ev-tri-1", "ev-tri-2"]);
    await Opp.enregistrerOpposition("ct_tri_opposee", "facebook"); // inscrite APRÈS la création de la carte
    const apres = await A.lireVueATraiter({ env, depot });
    expect(apres.cartes.map((c) => c.idEvenement)).toEqual(["ev-tri-2", "ev-tri-1"]);
    expect(apres.cartes[0]).toMatchObject({ opposee: true, kit: null });
    expect(apres.cartes[1].opposee).not.toBe(true);
  });
});
