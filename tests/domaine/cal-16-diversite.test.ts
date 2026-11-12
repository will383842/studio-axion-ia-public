import { describe, expect, it } from "vitest";
import { controlerDiversite, SEUILS_DIVERSITE, type ElementDiversite } from "@/domaine/calendrier/diversite";

const el = (id: string, jour: string, formatId: string, extra: Partial<ElementDiversite> = {}): ElementDiversite => ({
  id,
  reseau: "instagram",
  jour,
  formatId,
  ...extra,
});

describe("CAL-16 · contrôleur de diversité", () => {
  it("3 jours de suite avec le même format sur un réseau : alerte", () => {
    const r = controlerDiversite([el("a", "2026-12-07", "avocat"), el("b", "2026-12-08", "avocat"), el("c", "2026-12-09", "avocat")]);
    const f = r.alertes.filter((x) => x.type === "format-repete");
    expect(f).toHaveLength(1);
    expect(f[0].ids).toEqual(["a", "b", "c"]);
    expect(r.bloquant).toBe(false);
  });

  it("2 jours de suite : aucune alerte de format", () => {
    const r = controlerDiversite([el("a", "2026-12-07", "avocat"), el("b", "2026-12-08", "avocat")]);
    expect(r.alertes.filter((x) => x.type === "format-repete")).toEqual([]);
  });

  it("une série interrompue ou un autre réseau ne compte pas", () => {
    const r = controlerDiversite([
      el("a", "2026-12-07", "avocat"),
      el("b", "2026-12-08", "avocat"),
      el("c", "2026-12-10", "avocat"),
      { ...el("d", "2026-12-09", "avocat"), reseau: "linkedin" },
    ]);
    expect(r.alertes.filter((x) => x.type === "format-repete")).toEqual([]);
  });

  it("deux publications le même jour sur un réseau comptent pour un seul jour", () => {
    const r = controlerDiversite([el("a", "2026-12-07", "x"), el("a2", "2026-12-07", "x"), el("b", "2026-12-08", "x")]);
    expect(r.alertes.filter((x) => x.type === "format-repete")).toEqual([]);
  });

  it("le seuil de jours se change par paramètre", () => {
    const l = [el("a", "2026-12-07", "x"), el("b", "2026-12-08", "x")];
    expect(controlerDiversite(l, { joursMaxMemeFormat: 1 }).alertes.some((x) => x.type === "format-repete")).toBe(true);
    expect(SEUILS_DIVERSITE.joursMaxMemeFormat).toBe(2);
  });

  it("deux textes trop proches : alerte ; textes différents : aucune", () => {
    const proches = controlerDiversite([
      el("a", "2026-12-07", "f1", { sujet: "Avocat fiscaliste contrat client" }),
      el("b", "2026-12-12", "f2", { sujet: "avocats fiscalistes contrats clients" }),
    ]);
    expect(proches.alertes.filter((x) => x.type === "texte-proche")).toHaveLength(1);
    const loin = controlerDiversite([
      el("a", "2026-12-07", "f1", { sujet: "avocat fiscaliste" }),
      el("b", "2026-12-12", "f2", { sujet: "boulangerie artisanale" }),
    ]);
    expect(loin.alertes).toEqual([]);
  });

  it("le sujet se lit dans la signature de l'usine, sans calcul propre", () => {
    const r = controlerDiversite([
      el("a", "2026-12-07", "f1", { signatureUsine: "sig-42" }),
      el("b", "2026-12-12", "f2", { signatureUsine: "sig-42" }),
    ]);
    expect(r.alertes.filter((x) => x.type === "sujet-repete")).toHaveLength(1);
    expect(r.alertes.filter((x) => x.type === "texte-proche")).toEqual([]);
    const autre = controlerDiversite([
      el("a", "2026-12-07", "f1", { signatureUsine: "sig-1" }),
      el("b", "2026-12-12", "f2", { signatureUsine: "sig-2" }),
    ]);
    expect(autre.alertes).toEqual([]);
  });

  it("(a) même signature de l'usine, textes sans rapport : alerte de sujet, et seulement elle", () => {
    const r = controlerDiversite([
      el("a", "2026-12-07", "f1", { signatureUsine: "sig-42", sujet: "avocat fiscaliste contrat" }),
      el("b", "2026-12-09", "f2", { signatureUsine: "sig-42", sujet: "boulangerie artisanale pain" }),
    ]);
    expect(r.alertes.map((x) => x.type)).toEqual(["sujet-repete"]);
  });

  it("(b) signatures différentes, textes identiques : aucune alerte de sujet (l'usine dit « différents »), le texte reste jugé sur les mots seuls", () => {
    const r = controlerDiversite([
      el("a", "2026-12-07", "f1", { signatureUsine: "sig-1", sujet: "avocat contrat client" }),
      el("b", "2026-12-09", "f2", { signatureUsine: "sig-2", sujet: "avocat contrat client" }),
    ]);
    expect(r.alertes.filter((x) => x.type === "sujet-repete")).toEqual([]);
    expect(r.alertes.filter((x) => x.type === "texte-proche")).toHaveLength(1);
  });

  it("signature sur un seul des deux créneaux, ou au-delà de la fenêtre : pas d'alerte de sujet ; limite exacte (14 jours) : alerte", () => {
    const sig = (id: string, jour: string, signatureUsine?: string) => el(id, jour, id, { signatureUsine });
    expect(controlerDiversite([sig("a", "2026-12-01", "s"), sig("b", "2026-12-02")]).alertes).toEqual([]);
    expect(controlerDiversite([sig("a", "2026-12-01", "s"), sig("b", "2026-12-16", "s")]).alertes).toEqual([]);
    expect(controlerDiversite([sig("a", "2026-12-01", "s"), sig("b", "2026-12-15", "s")]).alertes).toHaveLength(1);
  });

  it("seuils invalides (0, NaN, négatif, texte) : retour aux valeurs par défaut, jamais d'alertes partout ni nulle part", () => {
    const deux = [el("a", "2026-12-07", "avocat"), el("b", "2026-12-08", "avocat")];
    for (const mauvais of [0, Number.NaN, -1, Number.POSITIVE_INFINITY, "2" as unknown as number]) expect(controlerDiversite(deux, { joursMaxMemeFormat: mauvais }).alertes).toEqual([]);
    const proches = [el("a", "2026-12-07", "f1", { sujet: "avocat contrat client" }), el("b", "2026-12-08", "f2", { sujet: "boulangerie pain farine" })];
    for (const mauvais of [-1, Number.NaN]) expect(controlerDiversite(proches, { seuilProximite: mauvais }).alertes).toEqual([]);
  });

  it("le seuil de proximité et la fenêtre en jours se règlent", () => {
    const l = [
      el("a", "2026-12-01", "f1", { sujet: "avocat contrat client" }),
      el("b", "2026-12-20", "f2", { sujet: "avocat contrat client" }),
    ];
    expect(controlerDiversite(l).alertes).toEqual([]);
    expect(controlerDiversite(l, { fenetreJoursTexte: 30 }).alertes).toHaveLength(1);
    const m = [
      el("a", "2026-12-07", "f1", { sujet: "avocat contrat client" }),
      el("b", "2026-12-08", "f2", { sujet: "avocat contrat fiscal" }),
    ];
    expect(controlerDiversite(m, { seuilProximite: 0.9 }).alertes).toEqual([]);
    expect(controlerDiversite(m, { seuilProximite: 0.3 }).alertes).toHaveLength(1);
  });

  it("une alerte ne bloque jamais, entrée non modifiée, jours invalides ignorés", () => {
    const l = [el("a", "2026-12-07", "x"), el("b", "2026-12-08", "x"), el("c", "2026-12-09", "x"), el("d", "pas-une-date", "x")];
    const copie = JSON.stringify(l);
    const r = controlerDiversite(l);
    expect(r.alertes.length).toBeGreaterThan(0);
    expect(r.bloquant).toBe(false);
    expect(JSON.stringify(l)).toBe(copie);
  });

  it("changement d'heure : les jours se comptent en dates civiles", () => {
    const r = controlerDiversite([el("a", "2026-10-24", "x"), el("b", "2026-10-25", "x"), el("c", "2026-10-26", "x")]);
    expect(r.alertes.filter((x) => x.type === "format-repete")).toHaveLength(1);
  });
});
