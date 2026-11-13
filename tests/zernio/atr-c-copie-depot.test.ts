/** ATR-C : noter la date de copie ne doit jamais faire disparaître les autres cartes (dépôt mémoire = remplacement de liste). Données fictives. */
import { describe, expect, it } from "vitest";
import type { CarteATraiter } from "@/services/a-traiter-types";

const { creerDepotMemoire, noterCopieCarte } = await import("@/services/a-traiter");

const carte = (id: string): CarteATraiter =>
  ({ idEvenement: id, reseau: "linkedin", post: "p", lienPost: null, mot: "GUIDE", motif: "mot_manuel", extrait: "x", creeLe: "2026-01-01T00:00:00.000Z", statut: "a_traiter", kit: null, empreintes: [], message: "indisponible" }) as unknown as CarteATraiter;

describe("noterCopieCarte sur le dépôt mémoire", () => {
  it("garde les autres cartes et ne date que la bonne", async () => {
    const depot = creerDepotMemoire();
    await depot.ecrire([carte("a"), carte("b")]);
    expect(await noterCopieCarte("a", "2026-02-02T00:00:00.000Z", { depot })).toBe(true);
    const l = await depot.lire();
    expect(l.map((c) => c.idEvenement)).toEqual(["a", "b"]);
    expect(l[0].copieLe).toBe("2026-02-02T00:00:00.000Z");
    expect(l[1].copieLe).toBeUndefined();
  });
});
