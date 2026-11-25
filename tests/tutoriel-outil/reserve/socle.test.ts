/** RES-1 : modèle pur (réglages en échec fermé, transitions, FIFO, rythme) et stockage (sans base : `parametres` simulé). */
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

import {
  REGLAGES_RESERVE_DEFAUT,
  cleTirageRythme,
  controlerReglagesReserve,
  lireReglagesReserveBrut,
  suivantFifo,
  tirageDu,
  transition,
  type ElementReserve,
  type EtatElementReserve,
  type LigneHistorique,
} from "@/domaine/tutoriel-reserve";
import { ajouterElementReserve, changerEtatReserve, ecrireReglagesReserve, lireReglagesReserve, listerReserve } from "@/services/tutoriel-reserve";

const el = (id: string, etat: EtatElementReserve = "en_reserve"): ElementReserve => ({
  id,
  titre: id,
  source: { type: "idee", phrase: "Une idée" },
  fin: "aucune",
  etat,
  ajouteLe: "2026-11-01T00:00:00.000Z",
  ajoutePar: "fondateur",
  tentatives: 0,
  passages: [],
  version: 1,
});

beforeEach(() => magasin.clear());

describe("réglages en échec fermé", () => {
  it.each([
    ["null", null],
    ["texte", "true"],
    ["actif texte", { ...REGLAGES_RESERVE_DEFAUT, actif: "true" }],
    ["actif seul", { actif: true }],
    ["rythme négatif", { ...REGLAGES_RESERVE_DEFAUT, actif: true, parSemaine: -1 }],
    ["rythme 8", { ...REGLAGES_RESERVE_DEFAUT, actif: true, parSemaine: 8 }],
    ["plafond 0", { ...REGLAGES_RESERVE_DEFAUT, actif: true, plafondVideoCentimes: 0 }],
    ["plafond 1001", { ...REGLAGES_RESERVE_DEFAUT, actif: true, plafondVideoCentimes: 1001 }],
  ])("%s → défaut éteint", (_n, brut) => {
    expect(lireReglagesReserveBrut(brut)).toEqual(REGLAGES_RESERVE_DEFAUT);
    expect(lireReglagesReserveBrut(brut).actif).toBe(false);
  });
  it("une forme valide allume, et le défaut est éteint", () => {
    expect(REGLAGES_RESERVE_DEFAUT.actif).toBe(false);
    expect(REGLAGES_RESERVE_DEFAUT.voix).toBe(false);
    expect(lireReglagesReserveBrut({ actif: true, parSemaine: 3, voix: false, plafondVideoCentimes: 200, version: 1 }).actif).toBe(true);
  });
  it("écriture refusée si invalide, lecture éteinte par défaut", async () => {
    await expect(ecrireReglagesReserve({ ...REGLAGES_RESERVE_DEFAUT, parSemaine: 9 })).rejects.toMatchObject({ code: "RESERVE_REGLAGE" });
    expect(magasin.size).toBe(0);
    expect(controlerReglagesReserve({ ...REGLAGES_RESERVE_DEFAUT, parSemaine: 9 })?.champ).toBe("parSemaine");
    expect(await lireReglagesReserve()).toEqual(REGLAGES_RESERVE_DEFAUT);
    await ecrireReglagesReserve({ ...REGLAGES_RESERVE_DEFAUT, actif: true });
    expect((await lireReglagesReserve()).actif).toBe(true);
  });
});

describe("transitions", () => {
  const etats: EtatElementReserve[] = ["en_reserve", "pris", "fait", "a_revoir", "retire"];
  const permis = new Set(["en_reserve>pris", "en_reserve>retire", "pris>fait", "pris>en_reserve", "pris>a_revoir", "a_revoir>en_reserve", "a_revoir>retire", "retire>en_reserve"]);
  for (const de of etats)
    for (const vers of etats)
      it(`${de} → ${vers} ${permis.has(`${de}>${vers}`) ? "permis" : "interdit"}`, () => {
        const t = transition(el("res-abcdef", de), vers, "2026-11-02T00:00:00.000Z", "m");
        if (permis.has(`${de}>${vers}`)) {
          expect(t?.etat).toBe(vers);
          expect(t?.passages.at(-1)).toMatchObject({ de, vers, motif: "m" });
        } else expect(t).toBeNull();
      });
  it("remise en réserve : tentatives à 0 ; retour d'un échec : conservées", () => {
    expect(transition({ ...el("res-abcdef", "a_revoir"), tentatives: 2 }, "en_reserve", "x")?.tentatives).toBe(0);
    expect(transition({ ...el("res-abcdef", "retire"), tentatives: 1 }, "en_reserve", "x")?.tentatives).toBe(0);
    expect(transition({ ...el("res-abcdef", "pris"), tentatives: 1 }, "en_reserve", "x")?.tentatives).toBe(1);
  });
  it("20 passages au plus", () => {
    let e = el("res-abcdef");
    for (let i = 0; i < 30; i++) e = transition(transition(e, "pris", "x")!, "en_reserve", "x")!;
    expect(e.passages).toHaveLength(20);
  });
});

describe("suivantFifo", () => {
  it("ordre de l'index, ignore les absents et les autres états", () => {
    const m = new Map([["res-bbbbbb", el("res-bbbbbb")], ["res-cccccc", el("res-cccccc")], ["res-aaaaaa", el("res-aaaaaa", "pris")]]);
    expect(suivantFifo(["res-zzzzzz", "res-aaaaaa", "res-cccccc", "res-bbbbbb"], m)?.id).toBe("res-cccccc");
    expect(suivantFifo([], m)).toBeNull();
  });
});

describe("rythme", () => {
  const r = { ...REGLAGES_RESERVE_DEFAUT, actif: true, parSemaine: 2 };
  const l = (le: string, declencheur: LigneHistorique["declencheur"] = "rythme"): LigneHistorique => ({ le, declencheur, elementId: "res-abcdef" });
  it("éteint ou N = 0 : jamais", () => {
    expect(tirageDu({ ...r, actif: false }, [], "2026-11-18T10:00:00Z")).toBe(false);
    expect(tirageDu({ ...r, parSemaine: 0 }, [], "2026-11-18T10:00:00Z")).toBe(false);
  });
  it("historique vide : dû ; espacement 7 j / N", () => {
    expect(tirageDu(r, [], "2026-11-18T10:00:00Z")).toBe(true);
    const h = [l("2026-11-16T09:00:00Z")]; // lundi
    expect(tirageDu(r, h, "2026-11-19T20:00:00Z")).toBe(false); // 3,46 j < 3,5 j
    expect(tirageDu(r, h, "2026-11-19T22:00:00Z")).toBe(true);
    expect(tirageDu(r, [...h, l("2026-11-19T22:00:00Z")], "2026-11-22T00:00:00Z")).toBe(false); // quota atteint
  });
  it("dimanche → lundi à Paris (heure d'hiver)", () => {
    // dimanche 22/11 23:30 UTC = lundi 23/11 00:30 Paris : nouvelle semaine.
    const h = [l("2026-11-16T09:00:00Z"), l("2026-11-17T09:00:00Z")];
    expect(tirageDu(r, h, "2026-11-22T22:00:00Z")).toBe(false); // dimanche 23:00 Paris : quota plein
    expect(tirageDu(r, h, "2026-11-22T23:30:00Z")).toBe(true); // lundi 00:30 Paris
    expect(cleTirageRythme(h, "2026-11-22T22:00:00Z")).toBe("rythme-2026-11-16-3");
    expect(cleTirageRythme(h, "2026-11-22T23:30:00Z")).toBe("rythme-2026-11-23-1");
  });
  it("heure d'été : dimanche 22:30 UTC = lundi 00:30 Paris", () => {
    expect(cleTirageRythme([], "2026-06-28T21:30:00Z")).toBe("rythme-2026-06-22-1"); // dimanche 23:30 Paris
    expect(cleTirageRythme([], "2026-06-28T22:30:00Z")).toBe("rythme-2026-06-29-1"); // lundi 00:30 Paris
  });
  it("les tirages usine et essai ne comptent pas dans le quota, la clé est stable", () => {
    const h = [l("2026-11-16T09:00:00Z", "usine"), l("2026-11-16T10:00:00Z", "essai")];
    expect(cleTirageRythme(h, "2026-11-18T10:00:00Z")).toBe("rythme-2026-11-16-1");
    expect(cleTirageRythme(h, "2026-11-18T10:00:00Z")).toBe(cleTirageRythme(h, "2026-11-18T10:00:00Z"));
  });
});

describe("stockage", () => {
  const base = { id: "res-abcdef", titre: "T".repeat(100), source: { type: "idee", phrase: "p" } as const, fin: "aucune" as const, ajouteLe: "2026-11-01T00:00:00.000Z", ajoutePar: "fondateur" as const };
  it("ajouterElementReserve est idempotent, ajoute en fin d'index, titre borné", async () => {
    const a = await ajouterElementReserve(base);
    expect(a.etat).toBe("en_reserve");
    expect(a.titre).toHaveLength(80);
    await ajouterElementReserve({ ...base, titre: "autre" });
    await ajouterElementReserve({ ...base, id: "res-ghijkl" });
    expect((await listerReserve()).map((e) => [e.id, e.titre.length])).toEqual([["res-abcdef", 80], ["res-ghijkl", 80]]);
    expect(magasin.get("tutoriel.reserve.index")).toEqual(["res-abcdef", "res-ghijkl"]);
  });
  it("identifiant invalide refusé", async () => {
    await expect(ajouterElementReserve({ ...base, id: "../x" })).rejects.toMatchObject({ code: "RESERVE_ELEMENT" });
  });
  it("changerEtatReserve : transition interdite → RESERVE_TRANSITION ; patch limité", async () => {
    await ajouterElementReserve(base);
    await expect(changerEtatReserve("res-abcdef", "fait")).rejects.toMatchObject({ code: "RESERVE_TRANSITION" });
    const e = await changerEtatReserve("res-abcdef", "pris", { motif: "ok", patch: { tentatives: 1 } });
    expect(e).toMatchObject({ etat: "pris", motif: "ok", tentatives: 1 });
    await expect(changerEtatReserve("res-inconnu1", "pris")).rejects.toMatchObject({ code: "RESERVE_INTROUVABLE" });
  });
  it("n'écrit que sous le préfixe tutoriel.reserve.", async () => {
    await ajouterElementReserve(base);
    await ecrireReglagesReserve(REGLAGES_RESERVE_DEFAUT);
    for (const k of magasin.keys()) expect(k.startsWith("tutoriel.reserve.")).toBe(true);
  });
});
