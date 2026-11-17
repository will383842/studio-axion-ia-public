/** Service des chiffres par mot : seule la raison fermée sort de `refusPrive`. Valeurs fictives. */
import { beforeEach, describe, expect, it } from "vitest";
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
  it("une lecture injectée fonctionne sans raison", async () => {
    const r = await lireStatsMots({
      maintenantMs: MAINTENANT,
      lecture: lecture({ a: {} }),
    });
    expect(r[0].refusSansRaison.total).toBe(1);
  });
});
