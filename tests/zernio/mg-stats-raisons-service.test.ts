/** Service des chiffres par mot : seule la raison fermée sort de `refusPrive`. Valeurs fictives. */
import { beforeEach, describe, expect, it, vi } from "vitest";

const recu: { conversations: unknown[] } = { conversations: [] };
vi.mock("@/domaine/guide-reseau/stats-mots", async (o) => {
  const vrai = await o<typeof import("@/domaine/guide-reseau/stats-mots")>();
  return {
    ...vrai,
    agregerStatsMots: (ev: never, convs: unknown[], t: number) => {
      recu.conversations = convs;
      return vrai.agregerStatsMots(ev, convs as never, t);
    },
  };
});
import {
  lireStatsMots,
  reinitialiserCacheStatsMots,
} from "@/services/stats-mots";

const MAINTENANT = Date.parse("2026-06-30T12:00:00.000Z");
const iso = new Date(MAINTENANT - 86_400_000).toISOString();
const refusPrive = {
  motif: "droits-manquants",
  statut: 403,
  codeClient: "acces",
  meta: { code: 200, sousCode: 2018028 },
  codeZernio: "INBOX_REQUIRED",
  source: "phrase",
  le: iso,
};
const conv = (sur: object) => ({
  etat: "m1_refuse",
  creeLe: iso,
  m1Le: null,
  ...sur,
});
const lecture = (tout: Record<string, object>) => ({
  evenements: async () => [],
  conversations: async () =>
    Object.entries(tout).map(([cle, c]) => ({
      cle,
      etat: "m1_refuse",
      creeLe: iso,
      m1Le: null,
      // même lecture que le service réel : on passe par lui via les dépôts ci-dessous
      ...(c as object),
    })),
});

describe("service des raisons de refus", () => {
  beforeEach(() => reinitialiserCacheStatsMots());
  it("refusPrive invalide ignoré ; valide réduit au motif et à l'origine ; rien d'autre ne sort", async () => {
    const { reinitialiserDepots } = await import("@/donnees/memoire");
    reinitialiserDepots();
    const { ecrireParametre } = await import("@/services/_commun");
    await ecrireParametre("parcours.conversations", {
      "cle-secrete-fictive-1": conv({ refusPrive }),
      "cle-secrete-fictive-2": conv({
        refusPrive: { ...refusPrive, motif: "inconnu" },
      }),
      "cle-secrete-fictive-3": conv({
        refusPrive: { ...refusPrive, le: "illisible" },
      }),
      "cle-secrete-fictive-4": conv({ refusPrive: "texte" }),
    });
    const r = await lireStatsMots({ maintenantMs: MAINTENANT });
    const s = r.find((x) => x.mot === "GUIDE")!;
    expect(s.raisonsRefus).toEqual([
      {
        motif: "droits-manquants",
        dApresMessage: true,
        f: { j7: 1, j30: 1, total: 1 },
      },
    ]);
    expect(s.refusSansRaison.total).toBe(3);
    const texte = JSON.stringify(r);
    for (const interdit of [
      "cle-secrete-fictive",
      "idCompte",
      "statut",
      "meta",
      "codeClient",
      "codeZernio",
      "INBOX_REQUIRED",
      "403",
      "acces",
      '"le"',
      iso,
    ])
      expect(texte).not.toContain(interdit);
  });
  it("le service passe au domaine une raison aux clés EXACTES motif et dApresMessage ; une lecture injectée sans raison reste comptée", async () => {
    const { reinitialiserDepots } = await import("@/donnees/memoire");
    reinitialiserDepots();
    const { ecrireParametre } = await import("@/services/_commun");
    await ecrireParametre("parcours.conversations", {
      "cle-fictive-a": conv({ refusPrive }),
      "cle-fictive-b": conv({ refusPrive: { ...refusPrive, source: "nombres" } }),
      "cle-fictive-c": conv({}),
    });
    await lireStatsMots({ maintenantMs: MAINTENANT });
    const convs = recu.conversations as { cle: string; raison: unknown }[];
    expect(convs).toHaveLength(3);
    const par = Object.fromEntries(convs.map((c) => [c.cle, c.raison]));
    expect(par["cle-fictive-a"]).toEqual({ motif: "droits-manquants", dApresMessage: true });
    expect(Object.keys(par["cle-fictive-a"] as object).sort()).toEqual(["dApresMessage", "motif"]);
    expect(par["cle-fictive-b"]).toEqual({ motif: "droits-manquants", dApresMessage: false });
    expect(Object.keys(par["cle-fictive-b"] as object).sort()).toEqual(["dApresMessage", "motif"]);
    expect(par["cle-fictive-c"]).toBeNull();
    reinitialiserCacheStatsMots();
    const r = await lireStatsMots({
      maintenantMs: MAINTENANT,
      lecture: lecture({ a: {} }),
    });
    expect(r[0].refusSansRaison.total).toBe(1);
  });
});
