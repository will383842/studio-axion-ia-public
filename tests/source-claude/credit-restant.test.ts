/** Crédit Claude RESTANT ESTIMÉ (affichage seulement) : calculs purs, aucun réseau. */
import { describe, expect, it } from "vitest";
import {
  consommeDepuis,
  paramCycleCredit,
  paramReleveCredit,
  restantEstime,
  totalRestant,
  type CycleCredit,
} from "@/domaine/credit-claude";
import type { SourceClaude } from "@/domaine/source-claude";

const TAUX = 1; // 1 € = 1 $ : les centimes d'euro valent les centimes de dollar
type Dep = Parameters<typeof consommeDepuis>[0][number];

function dep(centimes: number, date: string, extra: Partial<Dep> & { fournisseur?: string; nature?: string } = {}): Dep {
  const { fournisseur = "anthropic", nature = "reel", ...reste } = extra;
  return { date, lignes: [{ fournisseur, nature, total: { centimes } }], ...reste } as unknown as Dep;
}

const CYCLE: CycleCredit = { montantCentimes: 20000, debut: "2026-10-01T00:00:00.000Z", expireLe: "2026-12-31T00:00:00.000Z", prochainLe: null };
const MAINT = "2026-10-19T12:00:00.000Z";

describe("clés de paramètres", () => {
  it("une clé par source", () => {
    expect(paramCycleCredit("abonnement-2")).toBe("claude.credit.cycle.abonnement-2");
    expect(paramReleveCredit("abonnement-3")).toBe("claude.credit.releve.abonnement-3");
  });
});

describe("consommeDepuis", () => {
  const deps = [dep(3750, "2026-10-10T00:00:00.000Z"), dep(100, "2026-09-01T00:00:00.000Z")];
  it("ne compte que depuis la date", () => expect(consommeDepuis(deps, "abonnement-1", CYCLE.debut, TAUX)).toBe(3750));
  it("ignore les dépenses de démonstration", () => {
    expect(consommeDepuis([dep(500, "2026-10-10T00:00:00.000Z", { estDemo: true })], "abonnement-1", CYCLE.debut, TAUX)).toBe(0);
  });
  it("ne compte que les lignes réelles du fournisseur anthropic", () => {
    const d = [dep(500, "2026-10-10T00:00:00.000Z", { fournisseur: "heygen" }), dep(700, "2026-10-10T00:00:00.000Z", { nature: "estime" })];
    expect(consommeDepuis(d, "abonnement-1", CYCLE.debut, TAUX)).toBe(0);
  });
  it("une dépense sans source compte pour le compte 1, pas pour le 2", () => {
    const d = [dep(900, "2026-10-10T00:00:00.000Z")];
    expect(consommeDepuis(d, "abonnement-1", CYCLE.debut, TAUX)).toBe(900);
    expect(consommeDepuis(d, "abonnement-2", CYCLE.debut, TAUX)).toBe(0);
  });
  it("une dépense `api` n'est JAMAIS déduite d'un compte d'abonnement", () => {
    const d = [dep(900, "2026-10-10T00:00:00.000Z", { sourceClaude: "api" })];
    for (const s of ["abonnement-1", "abonnement-2", "abonnement-3"] as SourceClaude[]) expect(consommeDepuis(d, s, CYCLE.debut, TAUX)).toBe(0);
    expect(consommeDepuis(d, "api", CYCLE.debut, TAUX)).toBe(900);
  });
});

describe("restantEstime", () => {
  const conso = (v: number) => () => v;
  it("200 $ − 37,50 $ = 162,50 $", () => {
    const r = restantEstime({ cycle: CYCLE, releve: null, consomme: conso(3750), maintenant: MAINT });
    expect(r).toMatchObject({ etat: "estime", restantCentimes: 16250, base: "cycle", depuis: CYCLE.debut, depasse: false });
  });
  it("le relevé manuel du cycle est prioritaire (relevé − consommation depuis le relevé)", () => {
    const depuis: string[] = [];
    const r = restantEstime({ cycle: CYCLE, releve: { centimes: 15000, le: "2026-10-15T08:00:00.000Z" }, consomme: (d) => (depuis.push(d), 1000), maintenant: MAINT });
    expect(depuis).toEqual(["2026-10-15T08:00:00.000Z"]);
    expect(r).toMatchObject({ etat: "estime", restantCentimes: 14000, base: "releve", depuis: "2026-10-15T08:00:00.000Z" });
  });
  it("un relevé antérieur au cycle est ignoré", () => {
    const r = restantEstime({ cycle: CYCLE, releve: { centimes: 5, le: "2026-09-20T00:00:00.000Z" }, consomme: conso(3750), maintenant: MAINT });
    expect(r).toMatchObject({ base: "cycle", restantCentimes: 16250 });
  });
  it("après l'expiration : « expire », 0", () => {
    const r = restantEstime({ cycle: { ...CYCLE, expireLe: "2026-10-18T00:00:00.000Z" }, releve: null, consomme: conso(0), maintenant: MAINT });
    expect(r).toMatchObject({ etat: "expire", restantCentimes: 0 });
  });
  it("cycle pas encore commencé : « a-venir »", () => {
    const r = restantEstime({ cycle: { ...CYCLE, debut: "2026-11-01T00:00:00.000Z" }, releve: null, consomme: conso(0), maintenant: MAINT });
    expect(r.etat).toBe("a-venir");
  });
  it("ni cycle ni relevé : « a-renseigner », jamais un chiffre inventé", () => {
    const r = restantEstime({ cycle: null, releve: null, consomme: conso(999), maintenant: MAINT });
    expect(r).toMatchObject({ etat: "a-renseigner", restantCentimes: null, base: null });
  });
  it("jamais sous 0 : drapeau « depasse »", () => {
    const r = restantEstime({ cycle: CYCLE, releve: null, consomme: conso(25000), maintenant: MAINT });
    expect(r).toMatchObject({ etat: "estime", restantCentimes: 0, depasse: true });
  });
  it("fuseau : expiration du 21/10 (date seule) = jusqu'à minuit Paris, pas minuit UTC", () => {
    const cycle = { ...CYCLE, debut: "2026-09-21", expireLe: "2026-10-21" };
    const a = (maintenant: string) => restantEstime({ cycle, releve: null, consomme: conso(0), maintenant }).etat;
    expect(a("2026-10-21T00:30:00.000Z")).toBe("estime"); // 02:30 Paris le 21
    expect(a("2026-10-21T21:59:00.000Z")).toBe("estime"); // 23:59 Paris le 21
    expect(a("2026-10-21T22:00:00.000Z")).toBe("expire"); // 00:00 Paris le 22
  });
  it("fuseau : début en date seule = minuit Paris", () => {
    const cycle = { ...CYCLE, debut: "2026-10-19", expireLe: null };
    expect(restantEstime({ cycle, releve: null, consomme: conso(0), maintenant: "2026-10-18T21:59:00.000Z" }).etat).toBe("a-venir");
    expect(restantEstime({ cycle, releve: null, consomme: conso(0), maintenant: "2026-10-18T22:00:00.000Z" }).etat).toBe("estime");
  });
});

describe("totalRestant", () => {
  const ok = (source: SourceClaude, restant: number | null, etat: "estime" | "expire" | "a-renseigner" = "estime") => ({ source, cle: `cle-${source}-xxxxxxxx`, desactive: false, etat, restantCentimes: restant });
  it("additionne les comptes estimés avec clé", () => {
    expect(totalRestant([ok("abonnement-1", 16250), ok("abonnement-2", 5000), ok("abonnement-3", 100)]).centimes).toBe(21350);
  });
  it("un compte expiré (0) ou à renseigner est exclu", () => {
    expect(totalRestant([ok("abonnement-1", 16250), ok("abonnement-2", 0, "expire"), ok("abonnement-3", null, "a-renseigner")]).centimes).toBe(16250);
  });
  it("sans clé ou désactivé : exclu", () => {
    expect(totalRestant([ok("abonnement-1", 100), { ...ok("abonnement-2", 700), cle: null }, { ...ok("abonnement-3", 900), desactive: true }]).centimes).toBe(100);
  });
  it("une clé en doublon n'est comptée qu'une fois (premier compte retenu)", () => {
    const a = ok("abonnement-1", 1000);
    expect(totalRestant([a, { ...ok("abonnement-2", 1000), cle: a.cle }]).centimes).toBe(1000);
  });
  it("l'API payante n'entre jamais dans le total", () => {
    expect(totalRestant([ok("abonnement-1", 100), ok("api", 99999)]).centimes).toBe(100);
  });
});
