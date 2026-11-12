import { describe, expect, it } from "vitest";
import { verifierEspacement, REGLES_PAR_DEFAUT } from "@/domaine/cadence/verifier";
import { normaliserReglagesCadence } from "@/domaine/cadence/reglages";
import { planifierStock, type CreneauLibre, type EntreeStock, type SujetUsine } from "@/services/planificateur-stock";

const msg = (id: string, o: Partial<EntreeStock> = {}): EntreeStock => ({ id, texte: `Texte ${id}`, reseaux: ["linkedin"], creeLe: "2026-12-01T08:00:00.000Z", ...o });
const sujet = (id: string, reseaux: SujetUsine["reseaux"] = ["linkedin"]): SujetUsine => ({ id, reseaux });
const cren = (id: string, jour: string, reseau: CreneauLibre["reseau"] = "linkedin", heure = "09:00"): CreneauLibre => ({ id, jour, reseau, heure });
/** Le plan relu par le noyau de cadence (L3-16) : aucune violation, aucun avertissement. */
const constatsDuPlan = (r: ReturnType<typeof planifierStock>) =>
  verifierEspacement(
    r.affectations.map((a) => ({ id: a.id, reseau: a.reseau, jour: a.jour, heure: a.heure ?? "09:00", pilier: a.id, cible: "x" })),
    { ...REGLES_PAR_DEFAUT, ecartMinH: 3, quotaParJour: 2 },
  );
const QUATRE = [cren("c1", "2026-12-07"), cren("c2", "2026-12-08"), cren("c3", "2026-12-09"), cren("c4", "2026-12-10")];

const source = (r: ReturnType<typeof planifierStock>, id: string) => r.affectations.find((a) => a.id === id);

describe("RC-33 planificateur du stock", () => {
  it("2 messages du stock et 3 sujets de l'usine pour 4 créneaux : les messages d'abord, quotas tenus", () => {
    const r = planifierStock({ stock: [msg("m1"), msg("m2")], sujets: [sujet("s1"), sujet("s2"), sujet("s3")], creneaux: QUATRE });
    expect(r.affectations.map((a) => [a.id, a.origine, a.creneauId])).toEqual([
      ["m1", "stock", "c1"],
      ["m2", "stock", "c2"],
      ["s1", "usine", "c3"],
      ["s2", "usine", "c4"],
    ]);
    expect(r.sujetsSansCreneau).toEqual(["s3"]);
    const parJour = new Map<string, number>();
    for (const a of r.affectations) parJour.set(`${a.reseau}|${a.jour}`, (parJour.get(`${a.reseau}|${a.jour}`) ?? 0) + 1);
    expect(Math.max(...parJour.values())).toBeLessThanOrEqual(1);
  });

  it("un message ne dépasse jamais le quota par jour et par réseau (existants compris)", () => {
    const r = planifierStock({
      stock: [msg("m1"), msg("m2")],
      sujets: [],
      creneaux: [cren("c1", "2026-12-07", "linkedin", "14:00"), cren("c2", "2026-12-07", "linkedin", "20:00"), cren("c3", "2026-12-08")],
      existants: [{ reseau: "linkedin", jour: "2026-12-07", heure: "08:00" }],
      reglages: normaliserReglagesCadence({ reseaux: { linkedin: { quotaParJour: 2, ecartMinMinutes: 240 } } }),
    });
    expect(source(r, "m1")?.creneauId).toBe("c1");
    expect(source(r, "m2")?.creneauId).toBe("c3");
  });

  it("quota propre à un réseau (réglages L7-10)", () => {
    const r = planifierStock({
      stock: [msg("m1", { reseaux: ["tiktok"] }), msg("m2", { reseaux: ["tiktok"] })],
      sujets: [],
      creneaux: [cren("c1", "2026-12-07", "tiktok", "09:00"), cren("c2", "2026-12-07", "tiktok", "20:00"), cren("c3", "2026-12-08", "tiktok")],
      reglages: normaliserReglagesCadence({ reseaux: { tiktok: { quotaParJour: 1 }, linkedin: { quotaParJour: 5 } } }),
    });
    expect(source(r, "m2")?.creneauId).toBe("c3");
  });

  it("noyau : deux créneaux du même réseau à 30 minutes ne sont jamais tous deux placés (écart en heures)", () => {
    const r = planifierStock({
      stock: [msg("m1"), msg("m2")],
      sujets: [],
      creneaux: [cren("c1", "2026-12-07", "linkedin", "09:00"), cren("c2", "2026-12-07", "linkedin", "09:30"), cren("c3", "2026-12-08")],
      reglages: normaliserReglagesCadence({ reseaux: { linkedin: { quotaParJour: 2 } } }),
    });
    expect(source(r, "m1")?.creneauId).toBe("c1");
    expect(source(r, "m2")?.creneauId).toBe("c3");
    expect(verifierEspacement(r.affectations.map((a) => ({ id: a.id, reseau: a.reseau, jour: a.jour, heure: a.heure ?? "09:00", pilier: a.id, cible: "x" })), { ...REGLES_PAR_DEFAUT, ecartMinH: 4, quotaParJour: 2 })).toEqual([]);
  });

  it("noyau : un créneau LinkedIn le week-end n'est pas utilisé ; le message reste en stock, signalé", () => {
    const r = planifierStock({ stock: [msg("m1")], sujets: [], creneaux: [cren("c1", "2026-12-12")] });
    expect(r.affectations).toEqual([]);
    expect(r.nonPlaces).toEqual([{ id: "m1", raison: "aucun-creneau" }]);
  });

  it("noyau : le week-end ne concerne pas les autres réseaux", () => {
    const r = planifierStock({ stock: [msg("m1", { reseaux: ["tiktok"] })], sujets: [], creneaux: [cren("c1", "2026-12-12", "tiktok")] });
    expect(source(r, "m1")?.creneauId).toBe("c1");
  });

  it("réglages L7-10 : Instagram accepte 2 posts par jour par défaut, espacés d'au moins 3 h", () => {
    const r = planifierStock({
      stock: [msg("m1", { reseaux: ["instagram"] }), msg("m2", { reseaux: ["instagram"] }), msg("m3", { reseaux: ["instagram"] })],
      sujets: [],
      creneaux: [cren("c1", "2026-12-07", "instagram", "08:00"), cren("c2", "2026-12-07", "instagram", "12:30"), cren("c3", "2026-12-07", "instagram", "18:00"), cren("c4", "2026-12-08", "instagram", "08:00")],
    });
    expect([source(r, "m1")?.creneauId, source(r, "m2")?.creneauId, source(r, "m3")?.creneauId]).toEqual(["c1", "c2", "c4"]);
    expect(constatsDuPlan(r)).toEqual([]);
  });

  it("réglages illisibles : valeurs de départ (1 par jour)", () => {
    const r = planifierStock({
      stock: [msg("m1"), msg("m2")],
      sujets: [],
      creneaux: [cren("c1", "2026-12-07", "linkedin", "08:00"), cren("c2", "2026-12-07", "linkedin", "18:00"), cren("c3", "2026-12-08")],
      reglages: "n'importe quoi" as never,
    });
    expect(source(r, "m2")?.creneauId).toBe("c3");
  });

  it("ordre : échéance d'abord, puis priorité, puis les sans-échéance", () => {
    const r = planifierStock({
      stock: [
        msg("basse", { priorite: "basse" }),
        msg("haute", { priorite: "haute" }),
        msg("tard", { echeance: "2026-12-10" }),
        msg("tot", { echeance: "2026-12-08" }),
      ],
      sujets: [],
      creneaux: QUATRE,
    });
    expect(r.affectations.map((a) => a.id)).toEqual(["tot", "tard", "haute", "basse"]);
  });

  it("une échéance impossible à tenir est signalée ; le message est gardé", () => {
    const r = planifierStock({ stock: [msg("m1", { echeance: "2026-12-06" })], sujets: [], creneaux: QUATRE });
    expect(r.alertes).toEqual([expect.objectContaining({ id: "m1", code: "echeance-impossible" })]);
    expect(source(r, "m1")?.creneauId).toBe("c1");
    expect(r.nonPlaces).toEqual([]);
  });

  it("échéance tenue à la limite exacte : pas d'alerte", () => {
    const r = planifierStock({ stock: [msg("m1", { echeance: "2026-12-07" })], sujets: [], creneaux: QUATRE });
    expect(r.alertes).toEqual([]);
  });

  it("aucun créneau pour le réseau : le message reste en stock, signalé, jamais supprimé", () => {
    const r = planifierStock({ stock: [msg("m1", { reseaux: ["facebook"], echeance: "2026-12-09" })], sujets: [], creneaux: QUATRE });
    expect(r.affectations).toEqual([]);
    expect(r.nonPlaces).toEqual([{ id: "m1", raison: "aucun-creneau" }]);
    expect(r.alertes.map((a) => a.code)).toContain("echeance-impossible");
  });

  it("un message du fondateur n'est jamais remplacé par un sujet de l'usine", () => {
    const r = planifierStock({ stock: [msg("m1"), msg("m2"), msg("m3")], sujets: [sujet("s1")], creneaux: QUATRE.slice(0, 3) });
    expect(r.affectations.map((a) => a.origine)).toEqual(["stock", "stock", "stock"]);
    expect(r.sujetsSansCreneau).toEqual(["s1"]);
  });

  it("une date choisie par le fondateur n'est jamais déplacée, même hors quota (alerte)", () => {
    const r = planifierStock({
      stock: [msg("fixe", { dateChoisie: "2026-12-08" }), msg("m2", { priorite: "haute" })],
      sujets: [],
      creneaux: QUATRE,
      existants: [{ reseau: "linkedin", jour: "2026-12-08" }],
    });
    expect(source(r, "fixe")).toMatchObject({ jour: "2026-12-08", epingle: true });
    expect(r.alertes).toContainEqual(expect.objectContaining({ id: "fixe", code: "quota-depasse" }));
    expect(source(r, "m2")?.jour).not.toBe("2026-12-08");
  });

  it("une date choisie occupe son créneau et pèse sur le quota des autres", () => {
    const r = planifierStock({ stock: [msg("fixe", { dateChoisie: "2026-12-07" }), msg("m2")], sujets: [], creneaux: QUATRE });
    expect(source(r, "fixe")).toMatchObject({ creneauId: "c1", jour: "2026-12-07" });
    expect(source(r, "m2")?.creneauId).toBe("c2");
  });

  it("une date choisie sans créneau libre ce jour-là est quand même gardée à son jour", () => {
    const r = planifierStock({ stock: [msg("fixe", { dateChoisie: "2026-12-23" })], sujets: [], creneaux: QUATRE });
    expect(source(r, "fixe")).toEqual({ id: "fixe", origine: "stock", reseau: "linkedin", jour: "2026-12-23", epingle: true });
  });

  it("une date choisie illisible n'est pas une date : alerte, le message est placé normalement", () => {
    const r = planifierStock({ stock: [msg("m1", { dateChoisie: "31/02/2026" })], sujets: [], creneaux: QUATRE });
    expect(r.alertes).toContainEqual(expect.objectContaining({ id: "m1", code: "date-illisible" }));
    expect(source(r, "m1")).toMatchObject({ creneauId: "c1", epingle: false });
  });

  it("date choisie bloquée par l'écart (et non par le quota) : alerte « écart non respecté », pas « quota »", () => {
    const r = planifierStock({
      stock: [msg("fixe", { dateChoisie: "2026-12-08" })],
      sujets: [],
      creneaux: [cren("c1", "2026-12-08", "linkedin", "10:00")],
      existants: [{ reseau: "linkedin", jour: "2026-12-08", heure: "09:00" }],
      reglages: normaliserReglagesCadence({ reseaux: { linkedin: { quotaParJour: 5, ecartMinMinutes: 240 } } }),
    });
    expect(source(r, "fixe")).toMatchObject({ jour: "2026-12-08", epingle: true });
    expect(r.alertes.map((a) => a.code)).toEqual(["ecart-non-respecte"]);
    expect(r.alertes[0].message).not.toMatch(/quota/);
  });

  it("date choisie un samedi LinkedIn : gardée, avec une alerte de week-end", () => {
    const r = planifierStock({ stock: [msg("fixe", { dateChoisie: "2026-12-12" })], sujets: [], creneaux: [cren("c1", "2026-12-12")] });
    expect(source(r, "fixe")).toMatchObject({ jour: "2026-12-12", epingle: true });
    expect(r.alertes.map((a) => a.code)).toEqual(["weekend-interdit"]);
  });

  it("date choisie valide mais sans réseau ni créneau ce jour-là : alerte dédiée, message gardé en stock", () => {
    const r = planifierStock({ stock: [msg("fixe", { reseaux: [], dateChoisie: "2026-12-20" })], sujets: [], creneaux: QUATRE });
    expect(r.alertes).toContainEqual(expect.objectContaining({ id: "fixe", code: "date-sans-reseau" }));
    expect(r.nonPlaces).toEqual([{ id: "fixe", raison: "aucun-creneau" }]);
  });

  it("ignore archivés, déjà planifiés et publiés ; ne modifie jamais ses entrées", () => {
    const stock = [msg("a", { archiveLe: "2026-12-02T00:00:00.000Z" }), msg("p", { etat: "planifie", creneauId: "x" }), msg("u", { etat: "publie" }), msg("ok")];
    const copie = JSON.stringify(stock);
    const creneaux = JSON.stringify(QUATRE);
    const r = planifierStock({ stock, sujets: [], creneaux: QUATRE });
    expect(r.affectations.map((a) => a.id)).toEqual(["ok"]);
    expect(JSON.stringify(stock)).toBe(copie);
    expect(JSON.stringify(QUATRE)).toBe(creneaux);
  });

  it("entrées vides : aucun plan, aucune erreur", () => {
    expect(planifierStock({ stock: [], sujets: [], creneaux: [] })).toEqual({ affectations: [], alertes: [], nonPlaces: [], sujetsSansCreneau: [] });
  });

  it("créneau illisible ou en double ignoré ; relance identique donne le même plan", () => {
    const creneaux = [cren("c1", "pas-un-jour"), cren("c2", "2026-12-07"), cren("c2", "2026-12-09"), ...QUATRE.slice(2)];
    const a = planifierStock({ stock: [msg("m1"), msg("m2")], sujets: [sujet("s1")], creneaux });
    const b = planifierStock({ stock: [msg("m2"), msg("m1")], sujets: [sujet("s1")], creneaux });
    expect(a.affectations.every((x) => x.creneauId !== "c1")).toBe(true);
    expect(a).toEqual(b);
  });

  it("un message sans réseau accepte tous les réseaux", () => {
    const r = planifierStock({ stock: [msg("m1", { reseaux: [] })], sujets: [], creneaux: [cren("c1", "2026-12-07", "tiktok")] });
    expect(source(r, "m1")?.reseau).toBe("tiktok");
  });
});
