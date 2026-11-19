/**
 * FIX-TABLEAU-CASE-PREMIERE-PAGE : la case « première page d'une recherche » ne bloque plus une commande de l'USINE
 * (réglage éteint par défaut) ; elle reste obligatoire pour la création à la main.
 */
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { controlerVideoTableau, type EntreeControleTableau, type OutilsControleTableau } from "../../../src/moteurs/montage-tableau/controles";
import { lireDejaVu } from "../../../src/moteurs/montage-tableau/etapes";
import { dejaVuUsine, REGLAGE_DEJA_VU_USINE } from "../../../src/services/tableau-deja-vu-usine";
import { contexteExemple, copie, ficheErreurCorrigee } from "../regles/exemples";

const MESURES_BONNES = { lufs: -14, creteVraieDbtp: -2, imageNoireTete: 0, imagesNoiresHorsFin: 0, imagesFigeesHorsFin: 0, dureeSec: 60, vmaf: 95, vmafSeuil: 90 };
const RELECTURE_RAS: OutilsControleTableau = { relireImagesCles: () => ({ imagesLues: 6, remarques: [] }) };

const entree = (extra: Partial<EntreeControleTableau> = {}): EntreeControleTableau => {
  const fiche = copie(ficheErreurCorrigee);
  return { fiche, contexte: contexteExemple(fiche), historique: [], dejaVu: { coche: true, le: "2026-10-10" }, mesures: MESURES_BONNES, ...extra };
};
const echouees = (r: Awaited<ReturnType<typeof controlerVideoTableau>>) => [...new Set(r.bloquants.map((l) => l.famille))];
const ligneDejaVu = (r: Awaited<ReturnType<typeof controlerVideoTableau>>) => r.lignes.find((l) => l.famille === "deja-vu")!;

describe("contrôle déjà-vu (a)", () => {
  it("case par l'usine : passe, raison écrite en clair", async () => {
    const r = await controlerVideoTableau(entree({ dejaVu: { coche: true, le: "2026-10-10", par: "usine" } }), RELECTURE_RAS);
    expect(echouees(r)).toEqual([]);
    expect(ligneDejaVu(r).etat).toBe("reussi");
    expect(ligneDejaVu(r).raison).toContain("Commande de l'usine");
  });
  it("sans date ou datée du futur : bloque encore", async () => {
    for (const dejaVu of [{ coche: true, par: "usine" as const }, { coche: true, le: "2027-01-01", par: "usine" as const }]) {
      const r = await controlerVideoTableau(entree({ dejaVu }), RELECTURE_RAS);
      expect(echouees(r)).toEqual(["deja-vu"]);
    }
  });
});

describe("dejaVuUsine (b)", () => {
  const lireVrai = async () => true;
  const dep = (lire: (id: string) => Promise<unknown>) => ({ lire, aujourdhui: "2026-11-20" });
  it("usine + true : case datée de la création de la version", async () => {
    expect(await dejaVuUsine({ origine: "usine" }, "2026-11-18T10:00:00.000Z", dep(lireVrai))).toEqual({ coche: true, le: "2026-11-18", par: "usine" });
  });
  it("lit le bon réglage", async () => {
    const lire = vi.fn(async () => true);
    await dejaVuUsine({ origine: "usine" }, "2026-11-18", dep(lire));
    expect(lire).toHaveBeenCalledWith(REGLAGE_DEJA_VU_USINE);
    expect(REGLAGE_DEJA_VU_USINE).toBe("tableau.deja_vu_usine.actif");
  });
  it("usine + valeur autre que true ou lecture qui lève : rien", async () => {
    for (const v of [false, "true", 1, undefined, null]) expect(await dejaVuUsine({ origine: "usine" }, "2026-11-18", dep(async () => v))).toBeUndefined();
    expect(await dejaVuUsine({ origine: "usine" }, "2026-11-18", dep(async () => { throw new Error("panne"); }))).toBeUndefined();
  });
  it("studio ou sans origine, même réglage allumé : rien", async () => {
    expect(await dejaVuUsine({ origine: "studio" }, "2026-11-18", dep(lireVrai))).toBeUndefined();
    expect(await dejaVuUsine({}, "2026-11-18", dep(lireVrai))).toBeUndefined();
  });
  it("création vide ou illisible : date d'aujourd'hui ; stable d'un jour à l'autre sinon", async () => {
    expect(await dejaVuUsine({ origine: "usine" }, "", dep(lireVrai))).toEqual({ coche: true, le: "2026-11-20", par: "usine" });
    expect(await dejaVuUsine({ origine: "usine" }, "hier", dep(lireVrai))).toEqual({ coche: true, le: "2026-11-20", par: "usine" });
    const a = await dejaVuUsine({ origine: "usine" }, "2026-11-18T10:00:00Z", { lire: lireVrai, aujourdhui: "2026-11-19" });
    const b = await dejaVuUsine({ origine: "usine" }, "2026-11-18T10:00:00Z", { lire: lireVrai, aujourdhui: "2026-11-25" });
    expect(a).toEqual(b);
  });
});

describe("aucun passe-droit par les entrées (c)", () => {
  it("lireDejaVu ne recopie jamais `par`", async () => {
    expect(lireDejaVu({ coche: true, le: "2026-10-10", par: "usine" })).toEqual({ coche: true, le: "2026-10-10" });
    const r = await controlerVideoTableau(entree({ dejaVu: lireDejaVu({ coche: true, le: "2026-10-10", par: "usine" }) }), RELECTURE_RAS);
    expect(ligneDejaVu(r).raison).toContain("Case cochée le 2026-10-10");
  });
});

describe("éteint = identique (d)", () => {
  it("absente ou sans `par` : comportement de master", async () => {
    const absente = await controlerVideoTableau(entree({ dejaVu: undefined }), RELECTURE_RAS);
    expect(echouees(absente)).toEqual(["deja-vu"]);
    expect(ligneDejaVu(absente).raison).toContain("n'est pas cochée");
    const will = await controlerVideoTableau(entree({ dejaVu: { coche: true, le: "2026-10-10" } }), RELECTURE_RAS);
    expect(echouees(will)).toEqual([]);
    expect(ligneDejaVu(will)).toMatchObject({ etat: "reussi", raison: "Case cochée le 2026-10-10." });
  });
});
