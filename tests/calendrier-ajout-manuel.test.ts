/**
 * L7-11 : ajout manuel à une date précise. Dépôts en mémoire, aucun appel réel, données fictives.
 */
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/services/auth", () => ({ exigerSession: vi.fn(async () => ({ id: "s1" })) }));
import { reinitialiserDepots } from "@/donnees/memoire";
import { ajouterEntree, validerEntree } from "@/app/(studio)/calendrier/actions";
import { AjouterEntree } from "@/components/calendrier/AjouterEntree";

const base = { jour: "2026-12-03", compteCible: "compte-fictif-1", reseau: "linkedin" as const, videoId: "v1" };
let d: ReturnType<typeof reinitialiserDepots>;
beforeEach(() => { d = reinitialiserDepots(); vi.useFakeTimers({ now: new Date("2026-11-20T10:00:00Z") }); });

describe("ajouter une entrée à la main", () => {
  it("le 03/12 à 9 h : créneau créé « propose », sans appel au diffuseur", async () => {
    const fetchEspion = vi.spyOn(globalThis, "fetch");
    const r = await ajouterEntree({ ...base, heure: "09:00", cle: "k1" });
    expect(r.ok).toBe(true);
    const l = await d.creneauxEditoriaux.lister();
    expect(l).toHaveLength(1);
    expect(l[0]).toMatchObject({ jourVise: "2026-12-03", statut: "propose", decalages: 0 });
    expect(l[0].heuresParReseau.linkedin).toBe("2026-12-03T08:00:00.000Z");
    expect(fetchEspion).not.toHaveBeenCalled();
  });
  it("heure par défaut 09:00 de Paris", async () => {
    await ajouterEntree({ ...base, cle: "k2" });
    expect((await d.creneauxEditoriaux.lister())[0].heuresParReseau.linkedin).toBe("2026-12-03T08:00:00.000Z");
  });
  it("un double envoi (même clé) ne crée qu'un créneau", async () => {
    const [a, b] = await Promise.all([ajouterEntree({ ...base, cle: "k3" }), ajouterEntree({ ...base, cle: "k3" })]);
    expect(a.ok && b.ok).toBe(true);
    expect(await d.creneauxEditoriaux.lister()).toHaveLength(1);
  });
  it("le passé avertit sans écrire, puis se confirme d'un clic", async () => {
    const r = await ajouterEntree({ ...base, jour: "2026-11-01", cle: "k4" });
    expect(r).toMatchObject({ ok: false, aConfirmer: "passe" });
    expect(await d.creneauxEditoriaux.lister()).toHaveLength(0);
    const c = await ajouterEntree({ ...base, jour: "2026-11-01", cle: "k4", confirmerPasse: true });
    expect(c.ok).toBe(true);
    expect(await d.creneauxEditoriaux.lister()).toHaveLength(1);
  });
  it("seule une erreur de format bloque", async () => {
    expect(await ajouterEntree({ ...base, jour: "03/12/2026", cle: "k5" })).toMatchObject({ ok: false });
    expect(await ajouterEntree({ ...base, heure: "9h", cle: "k6" })).toMatchObject({ ok: false });
    expect(await d.creneauxEditoriaux.lister()).toHaveLength(0);
  });
  it("heure d'été / d'hiver : heure inexistante décalée avec avertissement, heure répétée = 1re occurrence", async () => {
    const r = await ajouterEntree({ ...base, jour: "2027-03-28", heure: "02:30", cle: "k7" });
    expect(r).toMatchObject({ ok: true });
    expect(r.ok && r.avertissement).toMatch(/n'existe pas/);
    const l = await d.creneauxEditoriaux.lister((c) => c.id.endsWith("k7"));
    expect(l[0].heuresParReseau.linkedin).toBe("2027-03-28T01:30:00.000Z");
  });
  it("heure d'hiver : 02:30 le 25/10/2026 existe deux fois, la 1re occurrence (heure d'été) est retenue", async () => {
    const h = await ajouterEntree({ ...base, jour: "2026-10-25", heure: "02:30", cle: "k8", confirmerPasse: true });
    expect(h.ok).toBe(true);
    const l = await d.creneauxEditoriaux.lister((c) => c.id.endsWith("k8"));
    expect(l[0].heuresParReseau.linkedin).toBe("2026-10-25T00:30:00.000Z");
  });
  it("même clé mais autre heure, autre jour, autre réseau ou autre vidéo : erreur, pas un faux succès", async () => {
    expect((await ajouterEntree({ ...base, heure: "09:00", cle: "k10" })).ok).toBe(true);
    expect(await ajouterEntree({ ...base, heure: "10:00", cle: "k10" })).toMatchObject({ ok: false });
    expect(await ajouterEntree({ ...base, jour: "2026-12-04", cle: "k10" })).toMatchObject({ ok: false });
    expect(await ajouterEntree({ ...base, reseau: "tiktok", cle: "k10" })).toMatchObject({ ok: false });
    expect(await ajouterEntree({ ...base, videoId: "v2", cle: "k10" })).toMatchObject({ ok: false });
    expect(await ajouterEntree({ ...base, heure: "09:00", cle: "k10" })).toMatchObject({ ok: true });
    expect(await d.creneauxEditoriaux.lister()).toHaveLength(1);
  });
  it("un jour impossible dans le passé est refusé sur le format, sans demande de confirmation", async () => {
    expect(await ajouterEntree({ ...base, jour: "2026-02-30", cle: "k11" })).toEqual({ ok: false, message: "Jour invalide (AAAA-MM-JJ attendu)." });
    expect(await ajouterEntree({ ...base, jour: "2026-02-30", cle: "k11", confirmerPasse: true })).toMatchObject({ ok: false });
  });
});

describe("rien ne part avant validerEntree", () => {
  it("l'ajout laisse « propose » ; validerEntree passe à « valide » sans programmer ni publier", async () => {
    const r = await ajouterEntree({ ...base, cle: "k9" });
    const id = r.ok ? r.donnees.id : "";
    expect((await d.creneauxEditoriaux.obtenir(id))!.statut).toBe("propose");
    const v = await validerEntree(id);
    expect(v.ok).toBe(true);
    expect((await d.creneauxEditoriaux.obtenir(id))!.statut).toBe("valide");
  });
  it("validerEntree d'un créneau inconnu échoue proprement", async () => {
    expect(await validerEntree("absent")).toMatchObject({ ok: false });
  });
});

describe("bouton AjouterEntree", () => {
  it("affiche le jour, propose « Ajouter » et ne parle jamais de publier directement", () => {
    const html = renderToStaticMarkup(createElement(AjouterEntree, { jour: "2026-12-03", compteCible: "compte-fictif-1" }));
    expect(html).toContain("2026-12-03");
    expect(html).toMatch(/Ajouter/);
    expect(html).not.toMatch(/Publier/);
  });
});
