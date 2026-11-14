/**
 * L4-06 : décaler une entrée depuis le calendrier. Dépôts en mémoire, aucun appel réel, données fictives.
 */
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/services/auth", () => ({ exigerSession: vi.fn(async () => ({ id: "s1" })) }));
import { reinitialiserDepots } from "@/donnees/memoire";
import { decalerEntree } from "@/app/(studio)/calendrier/actions/decaler";
import { AReprogrammer } from "@/components/migration/AReprogrammer";
import { DecalerEntree, enPost } from "@/components/calendrier/DecalerEntree";
import type { CreneauPlan } from "@/services/plan-editorial";

let d: ReturnType<typeof reinitialiserDepots>;
const creneau = (o: Partial<CreneauPlan> & { id: string }): CreneauPlan => ({
  jourVise: "2026-12-03", heuresParReseau: { linkedin: "2026-12-03T08:00:00.000Z" }, compteCible: "compte-fictif-1",
  videoId: "v1", statut: "valide", decalages: 0, ...o,
});
const lire = async (id: string) => (await d.creneauxEditoriaux.obtenir(id)) as CreneauPlan;
beforeEach(() => { d = reinitialiserDepots(); vi.useFakeTimers({ now: new Date("2026-11-20T10:00:00Z") }); });

describe("décaler une entrée du calendrier", () => {
  it("une entrée future est décalée et garde la trace (journal, compteur, heure de Paris conservée)", async () => {
    await d.creneauxEditoriaux.enregistrer(creneau({ id: "c1" }));
    const fetchEspion = vi.spyOn(globalThis, "fetch");
    const r = await decalerEntree({ id: "c1", nouveauJour: "2026-12-10", raison: "Report demandé", cle: "k1" });
    expect(r.ok).toBe(true);
    const c = await lire("c1");
    expect(c).toMatchObject({ jourVise: "2026-12-10", decalages: 1 });
    expect(c.heuresParReseau.linkedin).toBe("2026-12-10T08:00:00.000Z");
    expect(await d.journalDecalages.lister()).toMatchObject([{ creneauId: "c1", ancienJour: "2026-12-03", nouveauJour: "2026-12-10", raison: "Report demandé" }]);
    expect(fetchEspion).not.toHaveBeenCalled();
  });
  it("un rejeu de la même clé ne décale qu'une fois", async () => {
    await d.creneauxEditoriaux.enregistrer(creneau({ id: "c1" }));
    await decalerEntree({ id: "c1", nouveauJour: "2026-12-10", raison: "r", cle: "k1" });
    await decalerEntree({ id: "c1", nouveauJour: "2026-12-10", raison: "r", cle: "k1" });
    expect((await lire("c1")).decalages).toBe(1);
    expect(await d.journalDecalages.lister()).toHaveLength(1);
  });
  it("une entrée passée est refusée, rien ne change", async () => {
    await d.creneauxEditoriaux.enregistrer(creneau({ id: "c2", jourVise: "2026-11-10", heuresParReseau: { linkedin: "2026-11-10T08:00:00.000Z" } }));
    const r = await decalerEntree({ id: "c2", nouveauJour: "2026-12-10", raison: "r", cle: "k2" });
    expect(r).toMatchObject({ ok: false });
    expect(r.ok === false && r.message).toMatch(/pass/i);
    expect(await lire("c2")).toMatchObject({ jourVise: "2026-11-10", decalages: 0 });
    expect(await d.journalDecalages.lister()).toHaveLength(0);
  });
  it("décaler vers un jour passé est refusé ; la limite exacte (maintenant) est refusée, une minute après est acceptée", async () => {
    await d.creneauxEditoriaux.enregistrer(creneau({ id: "c3", jourVise: "2026-11-25", heuresParReseau: { linkedin: "2026-11-25T08:00:00.000Z" } }));
    const passe = await decalerEntree({ id: "c3", nouveauJour: "2026-11-19", raison: "r", cle: "k3" });
    expect(passe).toMatchObject({ ok: false });
    expect(await lire("c3")).toMatchObject({ jourVise: "2026-11-25", decalages: 0 });
    // 2026-11-20 à 10:00Z = 11:00 Paris : une entrée à 11:00 Paris le jour même est à la limite exacte.
    await d.creneauxEditoriaux.enregistrer(creneau({ id: "c3b", jourVise: "2026-11-25", heuresParReseau: { linkedin: "2026-11-25T10:00:00.000Z" } }));
    // L'heure conservée (11:00 Paris) tombe pile sur maintenant : refus (pas dans le futur).
    expect(await decalerEntree({ id: "c3b", nouveauJour: "2026-11-20", raison: "r", cle: "k3b" })).toMatchObject({ ok: false });
    await d.creneauxEditoriaux.enregistrer(creneau({ id: "c3c", jourVise: "2026-11-25", heuresParReseau: { linkedin: "2026-11-25T10:01:00.000Z" } }));
    expect(await decalerEntree({ id: "c3c", nouveauJour: "2026-11-20", raison: "r", cle: "k3c" })).toMatchObject({ ok: true });
  });
  it("une entrée publiée est refusée", async () => {
    await d.creneauxEditoriaux.enregistrer(creneau({ id: "c4", statut: "publie" }));
    expect(await decalerEntree({ id: "c4", nouveauJour: "2026-12-10", raison: "r", cle: "k4" })).toMatchObject({ ok: false });
    expect(await lire("c4")).toMatchObject({ jourVise: "2026-12-03", decalages: 0 });
  });
  it("une entrée archivée ou introuvable est refusée", async () => {
    await d.creneauxEditoriaux.enregistrer(creneau({ id: "c5", statut: "archive" }));
    expect(await decalerEntree({ id: "c5", nouveauJour: "2026-12-10", raison: "r", cle: "k5" })).toMatchObject({ ok: false });
    expect(await decalerEntree({ id: "absent", nouveauJour: "2026-12-10", raison: "r", cle: "k5b" })).toMatchObject({ ok: false });
  });
  it("une entrée confiée à l'usine passe à aRenvoyer, sans appel au fournisseur", async () => {
    await d.creneauxEditoriaux.enregistrer(creneau({ id: "c6", repereUsine: "rep-fictif" }));
    const fetchEspion = vi.spyOn(globalThis, "fetch");
    const r = await decalerEntree({ id: "c6", nouveauJour: "2026-12-10", raison: "r", cle: "k6" });
    expect(r.ok).toBe(true);
    expect(await lire("c6")).toMatchObject({ jourVise: "2026-12-10", aRenvoyer: true });
    expect(fetchEspion).not.toHaveBeenCalled();
  });
  it("une entrée confiée au diffuseur (programmée) est REFUSÉE : « Retirez-la d'abord », zéro changement de date", async () => {
    for (const statut of ["programme", "echec"] as const) {
      await d.creneauxEditoriaux.enregistrer(creneau({ id: `c7-${statut}`, statut, signatureUsine: "sig-fictive" }));
      const r = await decalerEntree({ id: `c7-${statut}`, nouveauJour: "2026-12-10", raison: "r", cle: `k7-${statut}` });
      expect(r.ok).toBe(false);
      expect(r.ok === false && r.message).toContain("Retirez-la d'abord");
      expect(await lire(`c7-${statut}`)).toMatchObject({ jourVise: "2026-12-03", decalages: 0 });
      expect(await d.journalDecalages.lister()).toHaveLength(0);
    }
  });
  it("jour illisible ou clé vide : refus sans écriture", async () => {
    await d.creneauxEditoriaux.enregistrer(creneau({ id: "c8" }));
    expect(await decalerEntree({ id: "c8", nouveauJour: "10/12/2026", raison: "r", cle: "k8" })).toMatchObject({ ok: false });
    expect(await decalerEntree({ id: "c8", nouveauJour: "2026-02-30", raison: "r", cle: "k8" })).toMatchObject({ ok: false });
    expect(await decalerEntree({ id: "c8", nouveauJour: "2026-12-10", raison: "r", cle: "" })).toMatchObject({ ok: false });
    expect(await lire("c8")).toMatchObject({ decalages: 0 });
  });
  it("le composant affiche le formulaire et un bouton désactivable", () => {
    const html = renderToStaticMarkup(createElement(DecalerEntree, { id: "c1", jourActuel: "2026-12-03" }));
    expect(html).toContain("Décaler");
    expect(html).toContain('type="date"');
  });
  it("renvoi d'une entrée sur 2 réseaux : identifiants distincts, aucune clé React en double", () => {
    const posts = enPost(creneau({ id: "c9", heuresParReseau: { linkedin: "2026-12-03T08:00:00.000Z", instagram: "2026-12-03T09:00:00.000Z" } }));
    expect(posts).toHaveLength(2);
    expect(new Set(posts.map((p) => p.id)).size).toBe(2);
    const erreur = vi.spyOn(console, "error").mockImplementation(() => {});
    renderToStaticMarkup(createElement(AReprogrammer, { posts }));
    expect(erreur.mock.calls.filter((a) => String(a[0]).includes("same key"))).toHaveLength(0);
    erreur.mockRestore();
  });
});

describe("découpage des actions du calendrier (CORRECTIF du 12/11)", () => {
  it("l'action de cette fiche vit dans actions/decaler.ts ; actions.ts ne garde que celles de la fiche d'entrée", async () => {
    const decaler = await import("@/app/(studio)/calendrier/actions/decaler");
    expect(Object.keys(decaler)).toEqual(["decalerEntree"]);
    const racine = await import("@/app/(studio)/calendrier/actions");
    expect(Object.keys(racine).sort()).toEqual(["enregistrerFicheEntreeAction", "lireFicheEntreeAction"]);
  });

  it("sans session, rien n'est décalé ; avec session, la même demande passe", async () => {
    const { exigerSession } = await import("@/services/auth");
    await d.creneauxEditoriaux.enregistrer(creneau({ id: "c9" }));
    const refus = new Error("NEXT_REDIRECT");
    vi.mocked(exigerSession).mockRejectedValueOnce(refus);
    await expect(decalerEntree({ id: "c9", nouveauJour: "2026-12-10", raison: "Report", cle: "sans-session" })).rejects.toBe(refus);
    expect(await lire("c9")).toMatchObject({ jourVise: "2026-12-03", decalages: 0 });
    expect((await decalerEntree({ id: "c9", nouveauJour: "2026-12-10", raison: "Report", cle: "avec-session" })).ok).toBe(true);
  });
});
