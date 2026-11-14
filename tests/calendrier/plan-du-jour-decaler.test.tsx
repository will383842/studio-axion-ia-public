/**
 * CAL-14B : le plan du jour montre « Décaler » pour les créneaux à venir encore décalables.
 * Dépôts en mémoire, aucun appel réel, données fictives.
 */
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/services/auth", () => ({ exigerSession: vi.fn(async () => ({ id: "s1" })) }));
import { reinitialiserDepots } from "@/donnees/memoire";
import { chargerPlanDuJour } from "@/app/(studio)/calendrier/charger-plan";
import { decalerEntree } from "@/app/(studio)/calendrier/actions/decaler";
import { PlanDuJour } from "@/components/calendrier/PlanDuJour";
import type { CreneauPlan } from "@/services/plan-editorial";

let d: ReturnType<typeof reinitialiserDepots>;
const JOUR = "2026-12-03";
const creneau = (o: Partial<CreneauPlan> & { id: string }): CreneauPlan => ({
  jourVise: JOUR, heuresParReseau: { linkedin: "2026-12-03T08:00:00.000Z" }, compteCible: "compte-fictif-1",
  videoId: "v1", statut: "propose", decalages: 0, ...o,
});
const ajouter = (o: Partial<CreneauPlan> & { id: string }) => d.creneauxEditoriaux.enregistrer(creneau(o));
const rendre = async (jour = JOUR) => renderToStaticMarkup(createElement(PlanDuJour, { creneaux: await chargerPlanDuJour(jour, "2026-11-20"), aujourdhui: "2026-11-20" }));

beforeEach(() => {
  d = reinitialiserDepots();
  vi.useFakeTimers({ now: new Date("2026-11-20T10:00:00Z") });
});

describe("plan du jour : décaler", () => {
  it("un créneau « propose » à venir affiche « Décaler » et son titre", async () => {
    await ajouter({ id: "c1" });
    const html = await rendre();
    expect(html).toContain("Plan du jour");
    expect(html).toContain("Décaler");
    expect(html).toContain("v1");
  });
  it("à valider et validé sont aussi montrés ; le titre retombe sur le visuel puis sur l'id", async () => {
    await ajouter({ id: "c2", statut: "a_valider", videoId: undefined, visuelId: "vis9" });
    await ajouter({ id: "c3", statut: "valide", videoId: undefined });
    const html = await rendre();
    expect(html).toContain("vis9");
    expect(html).toContain("c3");
    expect(html.match(/Décaler l&#x27;entrée/g)).toHaveLength(2);
  });
  it.each(["publie", "archive", "programme", "echec"] as const)("un créneau « %s » est absent", async (statut) => {
    await ajouter({ id: `x-${statut}`, statut, videoId: "vx" });
    expect(await chargerPlanDuJour(JOUR, "2026-11-20")).toEqual([]);
    expect(await rendre()).toBe("");
  });
  it("un jour passé est absent", async () => {
    await ajouter({ id: "p1", jourVise: "2026-11-10" });
    expect(await chargerPlanDuJour("2026-11-10", "2026-11-20")).toEqual([]);
  });
  it("liste vide : rien n'est rendu", async () => {
    expect(await rendre()).toBe("");
  });
  it("dépôt en panne : liste vide, la page ne casse pas", async () => {
    vi.spyOn(d.creneauxEditoriaux, "lister").mockRejectedValue(new Error("panne"));
    expect(await chargerPlanDuJour(JOUR, "2026-11-20")).toEqual([]);
  });
  it("le jour de Paris est calculé dans le chargeur, pas par le paramètre", async () => {
    await ajouter({ id: "c1", jourVise: "2026-11-10" });
    expect(await chargerPlanDuJour("2026-11-10", "2026-11-01")).toEqual([]);
  });
});

describe("décaler : raison bornée", () => {
  it("201 caractères sont refusés, 200 acceptés, vide refusé", async () => {
    await ajouter({ id: "c1" });
    expect(await decalerEntree({ id: "c1", nouveauJour: "2026-12-10", raison: "a".repeat(201), cle: "k1" })).toMatchObject({ ok: false });
    expect(await decalerEntree({ id: "c1", nouveauJour: "2026-12-10", raison: "   ", cle: "k2" })).toMatchObject({ ok: false });
    expect((await d.creneauxEditoriaux.obtenir("c1"))?.decalages).toBe(0);
    expect(await decalerEntree({ id: "c1", nouveauJour: "2026-12-10", raison: ` ${"a".repeat(200)} `, cle: "k3" })).toMatchObject({ ok: true });
    expect(await d.journalDecalages.lister()).toMatchObject([{ raison: "a".repeat(200) }]);
  });
});
