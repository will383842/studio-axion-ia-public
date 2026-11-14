/**
 * CAL-14B : le plan du jour montre « Décaler » pour les créneaux à venir encore décalables.
 * Dépôts en mémoire, aucun appel réel, données fictives.
 */
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/services/auth", () => ({ exigerSession: vi.fn(async () => ({ id: "s1" })) }));
import { reinitialiserDepots } from "@/donnees/memoire";
import { chargerPlanDuJour } from "@/app/(studio)/calendrier/charger-plan";
import { decalerEntree } from "@/app/(studio)/calendrier/actions/decaler";
import { PlanDuJour } from "@/components/calendrier/PlanDuJour";
import { revalidatePath } from "next/cache";
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
    await ajouter({ id: "c1" });
    expect(await chargerPlanDuJour(JOUR, "2026-11-20")).toHaveLength(1); // le dépôt n'est pas vide : la panne seule vide la liste
    vi.spyOn(d.creneauxEditoriaux, "lister").mockRejectedValue(new Error("panne"));
    expect(await chargerPlanDuJour(JOUR, "2026-11-20")).toEqual([]);
  });
  it("à minuit : le 20 à 23h30 UTC il est déjà le 21 à Paris, un créneau du 20 est absent", async () => {
    vi.setSystemTime(new Date("2026-11-20T23:30:00Z"));
    await ajouter({ id: "m1", jourVise: "2026-11-20", heuresParReseau: { linkedin: "2026-11-20T23:45:00.000Z" } });
    await ajouter({ id: "m2", jourVise: "2026-11-21", heuresParReseau: { linkedin: "2026-11-21T09:00:00.000Z" } });
    expect(await chargerPlanDuJour("2026-11-20", "2026-11-20")).toEqual([]);
    expect((await chargerPlanDuJour("2026-11-21", "2026-11-20")).map((c) => c.id)).toEqual(["m2"]);
  });
  it("un créneau du jour dont l'heure de Paris est passée est absent, celui d'après est montré", async () => {
    // Il est 11h à Paris (10h UTC) le 20/11 : 08h UTC est passé, 15h UTC non.
    await ajouter({ id: "t1", jourVise: "2026-11-20", heuresParReseau: { linkedin: "2026-11-20T08:00:00.000Z" } });
    await ajouter({ id: "t2", jourVise: "2026-11-20", heuresParReseau: { linkedin: "2026-11-20T15:00:00.000Z" } });
    expect((await chargerPlanDuJour("2026-11-20", "2026-11-20")).map((c) => c.id)).toEqual(["t2"]);
    // L'action refuse bien ce que le chargeur écarte, et accepte ce qu'il garde.
    expect(await decalerEntree({ id: "t1", nouveauJour: "2026-12-10", raison: "test", cle: "ka" })).toMatchObject({ ok: false, message: expect.stringContaining("passée") });
    expect(await decalerEntree({ id: "t2", nouveauJour: "2026-12-10", raison: "test", cle: "kb" })).toMatchObject({ ok: true });
  });
  it("sans heure, le créneau reste décalable jusqu'à la fin du jour visé (23h59 de Paris)", async () => {
    await ajouter({ id: "s1", jourVise: "2026-11-20", heuresParReseau: {} });
    expect((await chargerPlanDuJour("2026-11-20", "2026-11-20")).map((c) => c.id)).toEqual(["s1"]);
  });
  it("le jour de Paris est calculé dans le chargeur, pas par le paramètre", async () => {
    await ajouter({ id: "c1", jourVise: "2026-11-10" });
    expect(await chargerPlanDuJour("2026-11-10", "2026-11-01")).toEqual([]);
  });
});

describe("plan du jour : accessibilité", () => {
  it("la section est nommée par son titre (aria-labelledby), sans répéter le titre, et le titre est un h2 sous le h1 de la page", async () => {
    await ajouter({ id: "c1" });
    const html = await rendre();
    const id = html.match(/<section aria-labelledby="([^"]+)"/)?.[1];
    expect(id).toBeTruthy();
    expect(html).toContain(`<h2 id="${id}"`);
    expect(html).not.toContain("aria-label=\"Plan du jour\"");
    expect(html).not.toContain("<h3");
  });
});

describe("décaler : rafraîchissement de la page", () => {
  beforeEach(() => vi.mocked(revalidatePath).mockClear());
  it("revalidatePath(\"/calendrier\") est appelé une fois après une réussite", async () => {
    await ajouter({ id: "c1" });
    expect(await decalerEntree({ id: "c1", nouveauJour: "2026-12-10", raison: "test", cle: "k1" })).toMatchObject({ ok: true });
    expect(revalidatePath).toHaveBeenCalledTimes(1);
    expect(revalidatePath).toHaveBeenCalledWith("/calendrier");
  });
  it("jamais après un refus (raison vide, jour passé, créneau confié au diffuseur, introuvable)", async () => {
    await ajouter({ id: "c1" });
    await ajouter({ id: "c2", statut: "programme" });
    expect(await decalerEntree({ id: "c1", nouveauJour: "2026-12-10", raison: " ", cle: "k1" })).toMatchObject({ ok: false });
    expect(await decalerEntree({ id: "c1", nouveauJour: "2026-11-01", raison: "test", cle: "k2" })).toMatchObject({ ok: false });
    expect(await decalerEntree({ id: "c2", nouveauJour: "2026-12-10", raison: "test", cle: "k3" })).toMatchObject({ ok: false });
    expect(await decalerEntree({ id: "nul", nouveauJour: "2026-12-10", raison: "test", cle: "k4" })).toMatchObject({ ok: false });
    expect(revalidatePath).not.toHaveBeenCalled();
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
