/** RES-1 : prise atomique (20 prises simultanées → une seule), rejeu, bail occupé, bail rendu même en cas d'exception. */
import { beforeEach, describe, expect, it, vi } from "vitest";

const magasin = new Map<string, unknown>();
let echecEcriture: string | null = null;
vi.mock("@/services/_commun", async (importOriginal) => {
  const reel = await importOriginal<typeof import("@/services/_commun")>();
  return {
    ...reel,
    lireParametre: async (id: string, defaut: unknown) => (magasin.has(id) ? structuredClone(magasin.get(id)) : defaut),
    ecrireParametre: async (id: string, v: unknown) => {
      if (echecEcriture && id.startsWith(echecEcriture)) throw new Error("écriture impossible");
      magasin.set(id, structuredClone(v));
    },
  };
});

import { CLE_BAIL_TIRAGE } from "@/domaine/tutoriel-reserve";
import { prendreBail, rendreBail } from "@/donnees/memoire";
import { ajouterElementReserve, historiqueTiragesReserve, lireElementReserve, lireTirageReserve, noterVideoDuTirage, prendreSuivantReserve } from "@/services/tutoriel-reserve";

const nouveau = (id: string) => ({ id, titre: id, source: { type: "idee", phrase: "p" } as const, fin: "aucune" as const, ajouteLe: "2026-11-01T00:00:00.000Z", ajoutePar: "fondateur" as const });

beforeEach(async () => {
  magasin.clear();
  echecEcriture = null;
  await rendreBail(CLE_BAIL_TIRAGE, "autre-titulaire");
});

describe("prendreSuivantReserve", () => {
  it("20 prises simultanées, clés différentes, un seul élément : 1 prise et 19 null", async () => {
    await ajouterElementReserve(nouveau("res-unique1"));
    const r = await Promise.all(Array.from({ length: 20 }, (_, i) => prendreSuivantReserve({ cle: `essai-${String(i).padStart(3, "0")}-xx`, declencheur: "usine" })));
    expect(r.filter((x) => x !== null && x !== "bail_occupe")).toHaveLength(1);
    expect(r.filter((x) => x === null)).toHaveLength(19);
    expect((await lireElementReserve("res-unique1"))?.etat).toBe("pris");
    expect(await historiqueTiragesReserve()).toHaveLength(1);
  });

  it("FIFO : le premier de l'index, puis le suivant ; élément demandé", async () => {
    for (const id of ["res-aaaaaa", "res-bbbbbb", "res-cccccc"]) await ajouterElementReserve(nouveau(id));
    const a = await prendreSuivantReserve({ cle: "cle-numero-1", declencheur: "rythme" });
    expect(a).toMatchObject({ deja: false, element: { id: "res-aaaaaa", etat: "pris", prise: { cle: "cle-numero-1", declencheur: "rythme" } } });
    const c = await prendreSuivantReserve({ cle: "cle-numero-2", declencheur: "usine", elementId: "res-cccccc" });
    expect(c).toMatchObject({ element: { id: "res-cccccc" } });
    expect(await prendreSuivantReserve({ cle: "cle-numero-3", declencheur: "usine", elementId: "res-aaaaaa" })).toBeNull(); // déjà pris
    expect(await prendreSuivantReserve({ cle: "cle-numero-4", declencheur: "usine" })).toMatchObject({ element: { id: "res-bbbbbb" } });
  });

  it("rejeu de la même clé : deja true, même prise, rien de plus retiré", async () => {
    await ajouterElementReserve(nouveau("res-aaaaaa"));
    await ajouterElementReserve(nouveau("res-bbbbbb"));
    const a = await prendreSuivantReserve({ cle: "cle-rejeu-01", declencheur: "essai" });
    const b = await prendreSuivantReserve({ cle: "cle-rejeu-01", declencheur: "essai" });
    expect(b).toMatchObject({ deja: true, element: { id: "res-aaaaaa" } });
    expect(a && a !== "bail_occupe" && b && b !== "bail_occupe" && b.element.prise).toEqual(a && a !== "bail_occupe" ? a.element.prise : null);
    expect((await lireElementReserve("res-bbbbbb"))?.etat).toBe("en_reserve");
    expect(await historiqueTiragesReserve()).toHaveLength(1);
  });

  it("bail tenu par un autre titulaire : bail_occupe, rien n'est écrit", async () => {
    await ajouterElementReserve(nouveau("res-aaaaaa"));
    const avant = new Map(magasin);
    expect(await prendreBail(CLE_BAIL_TIRAGE, "autre-titulaire", 60_000)).toBe(true);
    expect(await prendreSuivantReserve({ cle: "cle-bail-001", declencheur: "usine" })).toBe("bail_occupe");
    expect(magasin).toEqual(avant);
    await rendreBail(CLE_BAIL_TIRAGE, "autre-titulaire");
    expect(await prendreSuivantReserve({ cle: "cle-bail-001", declencheur: "usine" })).toMatchObject({ deja: false });
  });

  it("le bail est rendu même si l'écriture échoue (finally)", async () => {
    await ajouterElementReserve(nouveau("res-aaaaaa"));
    const rendre = vi.fn(rendreBail);
    echecEcriture = "tutoriel.reserve.element.";
    await expect(prendreSuivantReserve({ cle: "cle-echec-01", declencheur: "usine" }, { rendreBail: rendre })).rejects.toThrow("écriture impossible");
    expect(rendre).toHaveBeenCalledTimes(1);
    expect(await prendreBail(CLE_BAIL_TIRAGE, "autre-titulaire", 1000)).toBe(true);
  });

  it("réserve vide : null, rien d'écrit ; clé invalide : refus", async () => {
    expect(await prendreSuivantReserve({ cle: "cle-vide-001", declencheur: "usine" })).toBeNull();
    expect(magasin.size).toBe(0);
    await expect(prendreSuivantReserve({ cle: "x", declencheur: "usine" })).rejects.toMatchObject({ code: "RESERVE_CLE" });
  });

  it("noterVideoDuTirage écrit sur la fiche de tirage et sur element.prise", async () => {
    await ajouterElementReserve(nouveau("res-aaaaaa"));
    await prendreSuivantReserve({ cle: "cle-video-01", declencheur: "usine" });
    await noterVideoDuTirage("cle-video-01", "res-aaaaaa", "vid-1");
    expect((await lireTirageReserve("cle-video-01"))?.videoId).toBe("vid-1");
    expect((await lireElementReserve("res-aaaaaa"))?.prise?.videoId).toBe("vid-1");
  });
});
