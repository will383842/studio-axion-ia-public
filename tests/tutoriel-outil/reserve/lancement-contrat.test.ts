/** RES-3 : l'adaptateur de lancement sans session. Contrat avec `deposerTutoriel`, voix, origine usine, abandon. Aucun appel réel. */
import { describe, expect, it, vi } from "vitest";

// `deposerTutoriel` exige une session : simulée (c'est le seul but de ce mock).
vi.mock("@/services/auth", async (importOriginal) => ({ ...(await importOriginal<typeof import("@/services/auth")>()), exigerSession: async () => undefined }));

import type { ElementReserve } from "@/domaine/tutoriel-reserve";
import type { Distribution } from "@/domaine/types";
import { origineFournisseurCourante } from "@/services/plafond-fournisseur";
import { deposerTutoriel } from "@/services/tutoriel-depot";
import { entreesDepuisReserve, lancerDepuisReserve, type DependancesLancementReserve } from "@/services/tutoriel-reserve-lancement";

const base = { titre: "Mon tutoriel", fin: "aucune" as const, etat: "en_reserve" as const, ajouteLe: "2026-11-01T00:00:00.000Z", ajoutePar: "fondateur" as const, tentatives: 0, passages: [], version: 1 as const };
const dossier: ElementReserve = { ...base, id: "res-dossier1", source: { type: "dossier", fichierId: "f-1", nomFichier: "mon-dossier.zip", attestationImages: true } };
const idee: ElementReserve = { ...base, id: "res-idee0001", source: { type: "idee", phrase: "Un tableau de bord pour un atelier" }, fin: "prendre-rendez-vous" };
const demo: ElementReserve = { ...base, id: "demo-01-courriels", source: { type: "maquette-demo", dossier: "01-courriels" } };
const double: Distribution[] = [{ role: "Face caméra", personnageId: "p-1", source: "double" }];

/** Ce que `deposerTutoriel` range dans `video.entrees`, avec des doubles. */
async function entreesDuDepot(demande: Parameters<typeof deposerTutoriel>[0]): Promise<Record<string, unknown>> {
  let recu: Record<string, unknown> | undefined;
  await deposerTutoriel(demande, {
    interrupteurs: async () => ({ formulaire: true, dossier: true, phrase: true }),
    equipe: async () => true,
    fichier: async (id) => ({ id, nom: "mon-dossier.zip", taille: 10, cleStockage: "k" }),
    octets: async () => new Uint8Array(1),
    extraire: async () => ({ ok: true }) as never,
    distribution: async () => double,
    brouillon: async (e) => {
      recu = e.entrees;
      return { id: "v-x" };
    },
    ratios: async () => undefined,
    lancer: async () => ({ statut: "lancee", travailId: "t" }),
    abandonner: async () => undefined,
  });
  return recu ?? {};
}

describe("entreesDepuisReserve : contrat avec deposerTutoriel", () => {
  it("dossier (avec voix) : même forme", async () => {
    const attendu = await entreesDuDepot({ mode: "dossier", fichierId: "f-1", attestationImages: true, fin: "aucune" });
    expect(entreesDepuisReserve(dossier, { voix: true })).toEqual(attendu);
  });
  it("phrase (avec voix) : même forme", async () => {
    const attendu = await entreesDuDepot({ mode: "phrase", phrase: "Un tableau de bord pour un atelier", fin: "prendre-rendez-vous" });
    expect(entreesDepuisReserve(idee, { voix: true })).toEqual(attendu);
  });
  // À activer au rebase après AUD-2 (modeVoix « sans-voix » et script collé dans deposerTutoriel) : comparer `entreesDepuisReserve(e, { voix: false })`.
  it.todo("dossier et phrase sans voix : même forme que deposerTutoriel (AUD-2)");

  it("sans voix : modeVoix « sans-voix » ; avec voix : aucune clé modeVoix", () => {
    const sv = entreesDepuisReserve(dossier, { voix: false }).tutorielOutil as Record<string, unknown>;
    expect(sv.modeVoix).toBe("sans-voix");
    expect(sv.depot).toEqual({ mode: "dossier", fichierId: "f-1", attestationImages: true });
    expect("modeVoix" in (entreesDepuisReserve(dossier, { voix: true }).tutorielOutil as object)).toBe(false);
  });
  it("script collé : scriptColle true ; sinon absent", () => {
    expect((entreesDepuisReserve({ ...idee, script: "Texte." }, { voix: false }).tutorielOutil as Record<string, unknown>).scriptColle).toBe(true);
    expect("scriptColle" in (entreesDepuisReserve(idee, { voix: false }).tutorielOutil as object)).toBe(false);
  });
  it("démo : le fichier passé, attestation fausse", () => {
    const t = entreesDepuisReserve(demo, { voix: false, fichierId: "f-demo" }).tutorielOutil as Record<string, unknown>;
    expect(t.depot).toEqual({ mode: "dossier", fichierId: "f-demo", attestationImages: false });
  });
});

function banc(surcharge: Partial<DependancesLancementReserve> = {}) {
  const j = { brouillons: [] as unknown[], scripts: [] as string[], ratios: [] as string[][], lancements: [] as { options: unknown; origine: string }[], abandons: [] as string[] };
  const dep: DependancesLancementReserve = {
    distribution: async () => double,
    brouillon: async (e) => {
      j.brouillons.push(e);
      return { id: "v-1" };
    },
    script: async (_id, texte) => void j.scripts.push(texte),
    ratios: async (_id, r) => void j.ratios.push(r),
    lancer: async (_id, options) => void j.lancements.push({ options, origine: origineFournisseurCourante() }),
    abandonner: async (id) => void j.abandons.push(id),
    ...surcharge,
  };
  return { j, dep };
}

describe("lancerDepuisReserve", () => {
  it("lance en origine usine, confirmé à 0, trois formats, script collé, tutoriel-outil, sans publication", async () => {
    const { j, dep } = banc();
    const r = await lancerDepuisReserve({ ...idee, script: "Mon texte." }, { voix: false }, dep);
    expect(r).toEqual({ statut: "lancee", videoId: "v-1" });
    expect(j.lancements).toEqual([{ options: { confirme: 0, origine: "usine" }, origine: "usine" }]);
    expect(j.ratios).toEqual([["4:5", "9:16", "1:1"]]);
    expect(j.scripts).toEqual(["Mon texte."]);
    expect(j.brouillons[0]).toMatchObject({ formatId: "tutoriel-outil", distribution: double });
  });
  it("sans script : bloc vide", async () => {
    const { j, dep } = banc();
    await lancerDepuisReserve(idee, { voix: false }, dep);
    expect(j.scripts).toEqual([""]);
  });
  it("sans voix : distribution vide admise", async () => {
    const { j, dep } = banc({ distribution: async () => [] });
    expect((await lancerDepuisReserve(idee, { voix: false }, dep)).statut).toBe("lancee");
    expect(j.brouillons[0]).toMatchObject({ distribution: [] });
  });
  it("sans voix : distribution lue en échec, le lancement continue sans personne", async () => {
    const { dep } = banc({ distribution: async () => { throw new Error("base"); } });
    expect((await lancerDepuisReserve(idee, { voix: false }, dep)).statut).toBe("lancee");
  });
  it("avec voix : sans double, refus définitif et rien n'est créé", async () => {
    const { j, dep } = banc({ distribution: async () => [] });
    expect(await lancerDepuisReserve(idee, { voix: true }, dep)).toMatchObject({ statut: "refusee", definitif: true });
    expect(j.brouillons).toHaveLength(0);
    expect(j.lancements).toHaveLength(0);
  });
  it("échec du lancement : brouillon abandonné ; panne = non définitif ; erreur d'entrée = définitif ; refus d'argent = non définitif", async () => {
    const { ErreurStudio } = await import("@/services/_commun");
    for (const [erreur, definitif] of [
      [new Error("réseau"), false],
      [new ErreurStudio("SCRIPT_MANQUANT", "Script manquant."), true],
      [new ErreurStudio("USINE_PLAFOND_ATTEINT", "Plafond."), false],
    ] as const) {
      const { j, dep } = banc({ lancer: async () => { throw erreur; } });
      expect(await lancerDepuisReserve(idee, { voix: false }, dep)).toMatchObject({ statut: "refusee", definitif });
      expect(j.abandons).toEqual(["v-1"]);
    }
  });
  it("échec avant le brouillon : rien à abandonner", async () => {
    const { j, dep } = banc({ brouillon: async () => { throw new Error("base"); } });
    expect(await lancerDepuisReserve(idee, { voix: false }, dep)).toMatchObject({ statut: "refusee", definitif: false });
    expect(j.abandons).toHaveLength(0);
  });
});
