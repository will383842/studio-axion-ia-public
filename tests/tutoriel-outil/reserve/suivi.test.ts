/** RES-3 : suivi des éléments pris (fait, échec, pris sans vidéo depuis plus de 15 min). Aucun appel réel. */
import { beforeEach, describe, expect, it, vi } from "vitest";

const magasin = new Map<string, unknown>();
vi.mock("@/services/_commun", async (importOriginal) => {
  const reel = await importOriginal<typeof import("@/services/_commun")>();
  return {
    ...reel,
    lireParametre: async (id: string, defaut: unknown) => (magasin.has(id) ? structuredClone(magasin.get(id)) : defaut),
    ecrireParametre: async (id: string, v: unknown) => void magasin.set(id, structuredClone(v)),
  };
});

import { CLE_BAIL_TIRAGE, REGLAGES_RESERVE_DEFAUT } from "@/domaine/tutoriel-reserve";
import type { StatutVideo } from "@/domaine/types";
import { rendreBail } from "@/donnees/memoire";
import { ajouterElementReserve, lireElementReserve, prendreSuivantReserve } from "@/services/tutoriel-reserve";
import { suivreElementsPris, tirerSuivantReserve, type NotificationReserve } from "@/services/tutoriel-reserve-tirage";

const nouveau = (id: string) => ({ id, titre: id, source: { type: "idee", phrase: "Un tableau de bord pour un atelier" } as const, fin: "aucune" as const, ajouteLe: "2026-11-01T00:00:00.000Z", ajoutePar: "fondateur" as const });
const MAINTENANT = "2026-11-21T10:00:00.000Z";

beforeEach(async () => {
  magasin.clear();
  await rendreBail(CLE_BAIL_TIRAGE, "autre-titulaire");
});

async function pris(id: string, cle: string, le: string, videoId?: string) {
  await ajouterElementReserve(nouveau(id));
  await prendreSuivantReserve({ cle, declencheur: "usine", elementId: id, maintenant: le });
  if (videoId) {
    const { noterVideoDuTirage } = await import("@/services/tutoriel-reserve");
    await noterVideoDuTirage(cle, id, videoId);
  }
}

function dep(statut: StatutVideo | null) {
  const cloches: NotificationReserve[] = [];
  return { cloches, dep: { maintenant: () => MAINTENANT, statutVideo: async () => statut, notifier: async (n: NotificationReserve) => void cloches.push(n) } };
}

describe("suivreElementsPris", () => {
  it("vidéo prête : fait, plus une cloche « à valider » sans « € » et avec le lien du suivi", async () => {
    await pris("res-premier1", "cle-suivi-001", MAINTENANT, "v-1");
    const s = dep("prete");
    expect(await suivreElementsPris(s.dep)).toEqual({ faits: 1, echecs: 0 });
    expect((await lireElementReserve("res-premier1"))?.etat).toBe("fait");
    expect(s.cloches).toHaveLength(1);
    expect(s.cloches[0]?.lien).toBe("/tutoriel-outil/suivi/v-1");
    expect(JSON.stringify(s.cloches)).not.toMatch(/€|euro/i);
  });

  it("vidéo en cours : rien ne change", async () => {
    await pris("res-premier1", "cle-suivi-001", MAINTENANT, "v-1");
    for (const st of ["en_file", "en_fabrication"] as const) expect(await suivreElementsPris(dep(st).dep)).toEqual({ faits: 0, echecs: 0 });
    expect((await lireElementReserve("res-premier1"))?.etat).toBe("pris");
  });

  it.each(["echec", "annulee", "archivee", null] as const)("vidéo %s : échec (retour en réserve, tentative 1)", async (statut) => {
    await pris("res-premier1", "cle-suivi-001", MAINTENANT, "v-1");
    expect(await suivreElementsPris(dep(statut).dep)).toEqual({ faits: 0, echecs: 1 });
    expect(await lireElementReserve("res-premier1")).toMatchObject({ etat: "en_reserve", tentatives: 1 });
  });

  it("deuxième échec : à revoir", async () => {
    await pris("res-premier1", "cle-suivi-001", MAINTENANT, "v-1");
    await suivreElementsPris(dep("echec").dep);
    await prendreSuivantReserve({ cle: "cle-suivi-002", declencheur: "usine", maintenant: MAINTENANT });
    const { noterVideoDuTirage } = await import("@/services/tutoriel-reserve");
    await noterVideoDuTirage("cle-suivi-002", "res-premier1", "v-2");
    await suivreElementsPris(dep(null).dep);
    expect(await lireElementReserve("res-premier1")).toMatchObject({ etat: "a_revoir", tentatives: 2 });
  });

  it("pris sans vidéo depuis plus de 15 min : retour en réserve, tentative + 1", async () => {
    await pris("res-premier1", "cle-suivi-001", "2026-11-21T09:40:00.000Z");
    expect(await suivreElementsPris(dep(null).dep)).toEqual({ faits: 0, echecs: 1 });
    expect(await lireElementReserve("res-premier1")).toMatchObject({ etat: "en_reserve", tentatives: 1 });
  });

  it("pris sans vidéo depuis moins de 15 min : on attend (le lancement est peut-être en cours)", async () => {
    await pris("res-premier1", "cle-suivi-001", "2026-11-21T09:50:00.000Z");
    expect(await suivreElementsPris(dep(null).dep)).toEqual({ faits: 0, echecs: 0 });
    expect((await lireElementReserve("res-premier1"))?.etat).toBe("pris");
  });

  it("vidéo restée brouillon depuis plus de 15 min : brouillon archivé, élément en échec (jamais relancé ici)", async () => {
    await pris("res-premier1", "cle-suivi-001", "2026-11-21T09:40:00.000Z", "v-1");
    const archives: string[] = [];
    const s = dep("brouillon");
    expect(await suivreElementsPris({ ...s.dep, abandonner: async (id) => void archives.push(id) })).toEqual({ faits: 0, echecs: 1 });
    expect(archives).toEqual(["v-1"]);
    expect(await lireElementReserve("res-premier1")).toMatchObject({ etat: "en_reserve", tentatives: 1 });
  });

  it("vidéo brouillon depuis moins de 15 min : on attend ; archivage en échec : l'élément reste pris", async () => {
    await pris("res-premier1", "cle-suivi-001", "2026-11-21T09:50:00.000Z", "v-1");
    expect(await suivreElementsPris({ ...dep("brouillon").dep, abandonner: async () => undefined })).toEqual({ faits: 0, echecs: 0 });
    magasin.clear();
    await pris("res-second01", "cle-suivi-002", "2026-11-21T09:30:00.000Z", "v-2");
    expect(await suivreElementsPris({ ...dep("brouillon").dep, abandonner: async () => { throw new Error("base"); } })).toEqual({ faits: 0, echecs: 0 });
    expect((await lireElementReserve("res-second01"))?.etat).toBe("pris");
  });

  it("un tirage réussi puis le suivi : le même élément passe de pris à fait", async () => {
    await ajouterElementReserve(nouveau("res-premier1"));
    const r = await tirerSuivantReserve(
      { declencheur: "usine", cle: "cle-usine-01" },
      {
        maintenant: () => MAINTENANT,
        reglages: async () => ({ ...REGLAGES_RESERVE_DEFAUT, actif: true }),
        interrupteurs: async () => ({ formulaire: true, dossier: true, phrase: true }),
        interrupteur: async () => true,
        equipe: async () => true,
        tauxUsdEur: async () => 0.9,
        plafondVideoUsd: async () => 1,
        plafondMoisAtteint: async () => false,
        accordSansClic: async () => true,
        sousPlafondUsine: async () => true,
        lancer: async (_e, o) => {
          await o.noterBrouillon("v-9");
          return { statut: "lancee", videoId: "v-9" };
        },
        notifier: async () => undefined,
      },
    );
    expect(r).toMatchObject({ etat: "pris", videoId: "v-9" });
    expect(await suivreElementsPris(dep("prete").dep)).toEqual({ faits: 1, echecs: 0 });
  });
});
