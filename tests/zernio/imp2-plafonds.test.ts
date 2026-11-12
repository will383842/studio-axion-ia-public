import { describe, expect, it } from "vitest";
import { controlerGrille, dateUtilisable, SuiviDebitImport, OPERATIONS_PAR_JOUR } from "../../src/services/import-buffer/plafonds";

const T0 = Date.parse("2026-11-01T08:00:00Z");
const H = 3_600_000;

describe("IMP-2 plafonds", () => {
  it("création ≥ 3 h, promotion ≥ 30 min, date passée ou illisible refusée", () => {
    expect(dateUtilisable("2026-11-01T10:59:00Z", T0).ok).toBe(false);
    expect(dateUtilisable("2026-11-01T11:00:00Z", T0).ok).toBe(true);
    expect(dateUtilisable("2026-11-01T08:29:00Z", T0, "promotion").ok).toBe(false);
    expect(dateUtilisable("2026-11-01T08:30:00Z", T0, "promotion").ok).toBe(true);
    expect(dateUtilisable("2026-10-01T08:00:00Z", T0).ok).toBe(false);
    expect(dateUtilisable("n'importe quoi", T0).ok).toBe(false);
  });

  it("plafonds du jour : 90 / 90 / 45", () => {
    expect(OPERATIONS_PAR_JOUR).toEqual({ instagram: 90, facebook: 90, linkedin: 45 });
  });

  it("grille : 20 dans l'heure passe, 21 est refusé", () => {
    const mk = (n: number) => Array.from({ length: n }, (_, i) => ({ id: `p${i}`, compte: "exemple-compte-1", reseau: "instagram", dateIso: new Date(T0 + 5 * H + i * 60_000).toISOString() }));
    expect(controlerGrille(mk(20))).toEqual([]);
    const v = controlerGrille(mk(21));
    expect(v).toHaveLength(1);
    expect(v[0].type).toBe("heure");
  });

  it("grille : deux comptes ne s'additionnent pas ; plafond du jour LinkedIn 45", () => {
    const deux = [0, 1].flatMap((c) => Array.from({ length: 15 }, (_, i) => ({ id: `c${c}-${i}`, compte: `exemple-compte-${c}`, reseau: "instagram", dateIso: new Date(T0 + 5 * H + i * 60_000).toISOString() })));
    expect(controlerGrille(deux)).toEqual([]);
    const li = Array.from({ length: 46 }, (_, i) => ({ id: `l${i}`, compte: "exemple-compte-9", reseau: "linkedin", dateIso: new Date(T0 + 24 * H + i * 10 * 60_000).toISOString() }));
    expect(controlerGrille(li).some((x) => x.type === "jour")).toBe(true);
  });

  it("débit : 25 requêtes par minute puis attente, jamais de boucle sur Retry-After trop long", () => {
    const s = new SuiviDebitImport();
    for (let i = 0; i < 25; i++) s.noterRequete(T0 + i * 1000);
    expect(s.delaiAvant(T0 + 26_000)).toBe(34_000);
    expect(s.delaiAvant(T0 + 61_000)).toBeLessThan(1000);
    expect(s.pauseRetryAfter(10, T0)).toEqual({ ok: true, attenteMs: 10_000 });
    expect(s.delaiAvant(T0)).toBe(10_000);
    expect(s.pauseRetryAfter(3600, T0).ok).toBe(false);
  });

  it("20 opérations par heure et par compte", () => {
    const s = new SuiviDebitImport();
    for (let i = 0; i < 20; i++) s.noterOperation("exemple-compte-1", T0 + i * 1000);
    expect(s.peutOperer("exemple-compte-1", "instagram", T0 + 30_000).ok).toBe(false);
    expect(s.peutOperer("exemple-compte-2", "instagram", T0 + 30_000).ok).toBe(true);
    expect(s.peutOperer("exemple-compte-1", "instagram", T0 + H + 30_000).ok).toBe(true);
  });
});
