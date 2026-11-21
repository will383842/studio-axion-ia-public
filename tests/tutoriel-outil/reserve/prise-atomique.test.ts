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

// Simulation de la base partagée entre machines : quand `baseCommune` est actif, `sousVerrouCreditsPartage` relit la base
// (copie de la machine := base) avant `f`, et la republie après, comme le fait Postgres (relire(COLLECTIONS_ARGENT)).
let baseCommune: Map<string, unknown> | null = null;
let relectures = 0;
vi.mock("@/donnees/memoire", async (importOriginal) => {
  const reel = await importOriginal<typeof import("@/donnees/memoire")>();
  return {
    ...reel,
    sousVerrouCreditsPartage: async <T,>(f: () => Promise<T>): Promise<T> => {
      if (!baseCommune) return f();
      relectures += 1;
      magasin.clear();
      for (const [k, v] of baseCommune) magasin.set(k, structuredClone(v));
      try {
        return await f();
      } finally {
        baseCommune = new Map([...magasin].map(([k, v]) => [k, structuredClone(v)]));
      }
    },
  };
});

import { CLE_BAIL_TIRAGE } from "@/domaine/tutoriel-reserve";
import { prendreBail, rendreBail } from "@/donnees/memoire";
import { ajouterElementReserve, changerEtatReserve, historiqueTiragesReserve, lireElementReserve, lireTirageReserve, noterEchecDuTirage, noterFichierDemoReserve, noterVideoDuTirage, prendreSuivantReserve } from "@/services/tutoriel-reserve";

const nouveau = (id: string) => ({ id, titre: id, source: { type: "idee", phrase: "p" } as const, fin: "aucune" as const, ajouteLe: "2026-11-01T00:00:00.000Z", ajoutePar: "fondateur" as const });

beforeEach(async () => {
  magasin.clear();
  echecEcriture = null;
  baseCommune = null;
  relectures = 0;
  await rendreBail(CLE_BAIL_TIRAGE, "autre-titulaire");
});

describe("prendreSuivantReserve", () => {
  it("20 prises simultanées, clés différentes, un seul élément : 1 prise et 19 deja_en_cours", async () => {
    await ajouterElementReserve(nouveau("res-unique1"));
    const r = await Promise.all(Array.from({ length: 20 }, (_, i) => prendreSuivantReserve({ cle: `essai-${String(i).padStart(3, "0")}-xx`, declencheur: "usine" })));
    expect(r.filter((x) => x !== null && typeof x === "object")).toHaveLength(1);
    expect(r.filter((x) => x === "deja_en_cours")).toHaveLength(19);
    expect((await lireElementReserve("res-unique1"))?.etat).toBe("pris");
    expect(await historiqueTiragesReserve()).toHaveLength(1);
  });

  it("FIFO : le premier de l'index, puis le suivant ; élément demandé", async () => {
    for (const id of ["res-aaaaaa", "res-bbbbbb", "res-cccccc"]) await ajouterElementReserve(nouveau(id));
    const a = await prendreSuivantReserve({ cle: "cle-numero-1", declencheur: "rythme" });
    expect(a).toMatchObject({ deja: false, element: { id: "res-aaaaaa", etat: "pris", prise: { cle: "cle-numero-1", declencheur: "rythme" } } });
    await changerEtatReserve("res-aaaaaa", "fait"); // un seul « pris » à la fois (MAX_EN_COURS)
    const c = await prendreSuivantReserve({ cle: "cle-numero-2", declencheur: "usine", elementId: "res-cccccc" });
    expect(c).toMatchObject({ element: { id: "res-cccccc" } });
    await changerEtatReserve("res-cccccc", "fait");
    expect(await prendreSuivantReserve({ cle: "cle-numero-3", declencheur: "usine", elementId: "res-aaaaaa" })).toBeNull(); // déjà fait
    expect(await prendreSuivantReserve({ cle: "cle-numero-4", declencheur: "usine" })).toMatchObject({ element: { id: "res-bbbbbb" } });
  });

  it("rejeu de la même clé : deja true, même prise, rien de plus retiré", async () => {
    await ajouterElementReserve(nouveau("res-aaaaaa"));
    await ajouterElementReserve(nouveau("res-bbbbbb"));
    const a = await prendreSuivantReserve({ cle: "cle-rejeu-01", declencheur: "essai" });
    const b = await prendreSuivantReserve({ cle: "cle-rejeu-01", declencheur: "essai" });
    expect(b).toMatchObject({ deja: true, element: { id: "res-aaaaaa" } });
    const prise = (x: unknown) => (x && typeof x === "object" ? (x as { element: { prise?: unknown } }).element.prise : null);
    expect(prise(b)).toEqual(prise(a));
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

  it("noterEchecDuTirage marque la fiche (sans toucher au reste) ; fiche absente : rien", async () => {
    await ajouterElementReserve(nouveau("res-aaaaaa"));
    await prendreSuivantReserve({ cle: "cle-echec-001", declencheur: "usine" });
    await noterVideoDuTirage("cle-echec-001", "res-aaaaaa", "vid-1");
    await noterEchecDuTirage("cle-echec-001");
    expect(await lireTirageReserve("cle-echec-001")).toMatchObject({ videoId: "vid-1", echec: true });
    await noterEchecDuTirage("cle-inconnue-1");
    expect(await lireTirageReserve("cle-inconnue-1")).toBeNull();
  });

  it("un élément déjà pris + prise avec une autre clé : deja_en_cours, rien d'écrit", async () => {
    await ajouterElementReserve(nouveau("res-aaaaaa"));
    await ajouterElementReserve(nouveau("res-bbbbbb"));
    await prendreSuivantReserve({ cle: "cle-premiere-1", declencheur: "usine" });
    const avant = structuredClone([...magasin]);
    expect(await prendreSuivantReserve({ cle: "cle-seconde-02", declencheur: "usine" })).toBe("deja_en_cours");
    expect(await prendreSuivantReserve({ cle: "cle-seconde-03", declencheur: "usine", elementId: "res-bbbbbb" })).toBe("deja_en_cours");
    expect([...magasin]).toEqual(avant);
    expect(await lireTirageReserve("cle-seconde-02")).toBeNull();
    // le rejeu de la première clé reste servi
    expect(await prendreSuivantReserve({ cle: "cle-premiere-1", declencheur: "usine" })).toMatchObject({ deja: true });
  });

  it("deux éléments, deux clés en parallèle : une seule prise", async () => {
    await ajouterElementReserve(nouveau("res-aaaaaa"));
    await ajouterElementReserve(nouveau("res-bbbbbb"));
    const r = await Promise.all([prendreSuivantReserve({ cle: "cle-parallele-a", declencheur: "usine" }), prendreSuivantReserve({ cle: "cle-parallele-b", declencheur: "rythme" })]);
    expect(r.filter((x) => x !== null && typeof x === "object")).toHaveLength(1);
    expect(r.filter((x) => x === "deja_en_cours")).toHaveLength(1);
    expect((await lireElementReserve("res-bbbbbb"))?.etat).toBe("en_reserve");
    expect(await historiqueTiragesReserve()).toHaveLength(1);
  });

  it("seconde machine à copie périmée : la base est relue sous verrou, ni l'élément ni la clé ne sont repris", async () => {
    await ajouterElementReserve(nouveau("res-aaaaaa"));
    await ajouterElementReserve(nouveau("res-bbbbbb"));
    const copiePerimee = structuredClone([...magasin]); // ce que la machine B a chargé au démarrage
    baseCommune = new Map(structuredClone([...magasin]));
    // Machine A prend l'élément (la base partagée est mise à jour).
    expect(await prendreSuivantReserve({ cle: "cle-machine-a1", declencheur: "usine" })).toMatchObject({ deja: false, element: { id: "res-aaaaaa" } });
    // Machine B : sa copie mémoire est celle d'avant (élément encore « en_reserve », pas de fiche de tirage).
    magasin.clear();
    for (const [k, v] of copiePerimee) magasin.set(k, v);
    expect(magasin.has("tutoriel.reserve.tirage.cle-machine-a1")).toBe(false);
    const avantRelectures = relectures;
    // Autre clé : sans relecture, B reprendrait res-aaaaaa ; avec, elle voit l'élément pris et s'arrête.
    expect(await prendreSuivantReserve({ cle: "cle-machine-b1", declencheur: "rythme" })).toBe("deja_en_cours");
    expect(relectures).toBe(avantRelectures + 1);
    // Même clé que A : rejeu, sans nouvelle prise.
    magasin.clear();
    for (const [k, v] of copiePerimee) magasin.set(k, v);
    expect(await prendreSuivantReserve({ cle: "cle-machine-a1", declencheur: "usine" })).toMatchObject({ deja: true, element: { id: "res-aaaaaa" } });
    expect(await historiqueTiragesReserve()).toHaveLength(1);
    expect((await lireElementReserve("res-bbbbbb"))?.etat).toBe("en_reserve");
  });

  it("changerEtatReserve sur copie périmée : le « pris » d'une autre machine n'est pas écrasé (transition refusée après relecture)", async () => {
    await ajouterElementReserve(nouveau("res-aaaaaa"));
    const copiePerimee = structuredClone([...magasin]);
    baseCommune = new Map(structuredClone([...magasin]));
    await prendreSuivantReserve({ cle: "cle-machine-a1", declencheur: "usine" }); // machine A
    magasin.clear();
    for (const [k, v] of copiePerimee) magasin.set(k, v); // machine B : élément encore « en_reserve »
    await expect(changerEtatReserve("res-aaaaaa", "pris")).rejects.toMatchObject({ code: "RESERVE_TRANSITION" });
    expect((await lireElementReserve("res-aaaaaa"))?.prise?.cle).toBe("cle-machine-a1");
    expect((await lireElementReserve("res-aaaaaa"))?.etat).toBe("pris");
  });

  it("10 ajouts simultanés : l'index les contient tous, sans doublon", async () => {
    const ids = Array.from({ length: 10 }, (_, i) => `res-ajout${i}`);
    await Promise.all(ids.map((id) => ajouterElementReserve(nouveau(id))));
    const index = magasin.get("tutoriel.reserve.index") as string[];
    expect([...index].sort()).toEqual([...ids].sort());
  });

  it("appel réentrant depuis l'intérieur de la réserve : erreur claire au lieu d'un interblocage", async () => {
    await ajouterElementReserve(nouveau("res-aaaaaa"));
    // Un appel de la réserve lancé depuis l'intérieur d'un de ses verrous : refusé, sans bloquer.
    const interne = prendreSuivantReserve(
      { cle: "cle-reentrante", declencheur: "usine" },
      {
        prendreBail: async (...a) => {
          await expect(ajouterElementReserve(nouveau("res-bbbbbb"))).rejects.toMatchObject({ code: "RESERVE_REENTRANT" });
          return prendreBail(...a);
        },
      },
    );
    await expect(interne).resolves.toMatchObject({ deja: false });
  });

  it("un échec de rendreBail après des écritures réussies ne fait pas lever la prise", async () => {
    await ajouterElementReserve(nouveau("res-aaaaaa"));
    const rendre = vi.fn(async (cle: string, titulaire: string) => {
      await rendreBail(cle, titulaire); // le bail est bien libéré, mais l'appel échoue côté réponse
      throw new Error("base injoignable");
    });
    expect(await prendreSuivantReserve({ cle: "cle-rendu-001", declencheur: "usine" }, { rendreBail: rendre })).toMatchObject({ deja: false });
    expect(rendre).toHaveBeenCalledTimes(1);
  });

  it("noterVideoDuTirage n'écrit pas sur l'élément si sa prise est d'une autre clé", async () => {
    await ajouterElementReserve(nouveau("res-aaaaaa"));
    await prendreSuivantReserve({ cle: "cle-prise-vraie", declencheur: "usine" });
    await noterVideoDuTirage("cle-autre-prise", "res-aaaaaa", "vid-intrus");
    expect((await lireElementReserve("res-aaaaaa"))?.prise?.videoId).toBeUndefined();
    expect(await lireTirageReserve("cle-autre-prise")).toBeNull();
  });

  it("rejeu d'une clé dont l'élément a été repris sous une autre clé : pas deja true", async () => {
    await ajouterElementReserve(nouveau("res-aaaaaa"));
    await prendreSuivantReserve({ cle: "cle-ancienne-1", declencheur: "usine" });
    await changerEtatReserve("res-aaaaaa", "en_reserve", { patch: { prise: undefined } }); // rendu à la réserve
    expect(await prendreSuivantReserve({ cle: "cle-ancienne-1", declencheur: "usine" })).toBeNull();
    expect((await lireElementReserve("res-aaaaaa"))?.etat).toBe("en_reserve");
    await prendreSuivantReserve({ cle: "cle-nouvelle-2", declencheur: "rythme" }); // repris sous une autre clé
    expect(await prendreSuivantReserve({ cle: "cle-ancienne-1", declencheur: "usine" })).toBe("deja_en_cours");
  });

  it("historique : les lignes corrompues sont écartées", async () => {
    magasin.set("tutoriel.reserve.historique", [
      { le: "2026-11-01T00:00:00.000Z", declencheur: "usine", elementId: "res-aaaaaa" },
      { le: "pas une date", declencheur: "usine", elementId: "res-aaaaaa" },
      { le: 12, declencheur: "usine", elementId: "res-aaaaaa" },
      { le: "2026-11-02T00:00:00.000Z", declencheur: "inconnu", elementId: "res-aaaaaa" },
      null,
    ]);
    expect(await historiqueTiragesReserve()).toEqual([{ le: "2026-11-01T00:00:00.000Z", declencheur: "usine", elementId: "res-aaaaaa" }]);
  });
});

describe("noterFichierDemoReserve", () => {
  const demo = (id: string) => ({ id, titre: id, source: { type: "maquette-demo", dossier: "01-courriels" } as const, fin: "aucune" as const, ajouteLe: "2026-11-01T00:00:00.000Z", ajoutePar: "fondateur" as const });

  it("écrit uniquement source.fichierId d'une démo prise", async () => {
    await ajouterElementReserve(demo("res-demo01"));
    await changerEtatReserve("res-demo01", "pris");
    const avant = await lireElementReserve("res-demo01");
    const r = await noterFichierDemoReserve("res-demo01", "fic-1");
    expect(r).toEqual({ ...avant, source: { type: "maquette-demo", dossier: "01-courriels", fichierId: "fic-1" } });
    expect(await lireElementReserve("res-demo01")).toEqual(r);
  });

  it("refuse un élément absent, non démo, ou à l'état ≠ pris", async () => {
    await expect(noterFichierDemoReserve("res-absent", "f")).rejects.toMatchObject({ code: "RESERVE_INTROUVABLE" });
    await ajouterElementReserve(nouveau("res-idee01"));
    await changerEtatReserve("res-idee01", "pris");
    await expect(noterFichierDemoReserve("res-idee01", "f")).rejects.toMatchObject({ code: "RESERVE_ELEMENT" });
    await ajouterElementReserve(demo("res-demo02"));
    await expect(noterFichierDemoReserve("res-demo02", "f")).rejects.toMatchObject({ code: "RESERVE_ELEMENT" });
    expect((await lireElementReserve("res-demo02"))?.source).toEqual({ type: "maquette-demo", dossier: "01-courriels" });
  });

  it("idempotent : même fichierId, aucune écriture", async () => {
    await ajouterElementReserve(demo("res-demo03"));
    await changerEtatReserve("res-demo03", "pris");
    await noterFichierDemoReserve("res-demo03", "fic-1");
    echecEcriture = "tutoriel";
    const r = await noterFichierDemoReserve("res-demo03", "fic-1");
    expect(r.source).toMatchObject({ fichierId: "fic-1" });
  });
});
