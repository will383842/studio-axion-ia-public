/**
 * L3-01 — même essai que `l3-01-verrou-credits-postgres`, sur un VRAI Postgres jetable (verrou consultatif réel).
 * Sauté sans `STUDIO_ESSAI_PG_URL` (ex. `postgres://essai@127.0.0.1:55432/postgres`) : jamais la base du studio, une
 * base vide d'essai seulement (la table `documents` y est créée et remplie des données de démonstration). 0 €.
 */
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { mockHeaders, mockNavigation } from "./helpers/next-mocks";
import type { Depots } from "@/domaine/depots";
import type { LigneCout, ReservationCredit } from "@/domaine/types";

vi.mock("next/headers", () => mockHeaders);
vi.mock("next/navigation", () => mockNavigation);

const URL_ESSAI = process.env.STUDIO_ESSAI_PG_URL;

describe.skipIf(!URL_ESSAI)("L3-01 · verrou des crédits sur un vrai Postgres (deux processus)", () => {
  const CLE_DEPOTS = Symbol.for("studio-axion-ia.depots");
  const avant = (globalThis as Record<symbol, unknown>)[CLE_DEPOTS];
  const eur = (c: number) => ({ centimes: c, devise: "EUR" as const });
  const ligne = (c: number): LigneCout => ({ etape: "Voix", fournisseur: "simulation", unite: "forfait", quantite: 1, prixUnitaire: eur(c), total: eur(c), nature: "estime" });
  const parametre = (id: string, valeur: unknown) => ({ id, valeur, creeLe: "", modifieLe: "" });
  const suffixe = Date.now().toString(36);
  let pg: typeof import("@/donnees/postgres");
  let credits: typeof import("@/services/credits");

  beforeAll(async () => {
    pg = await import("@/donnees/postgres");
    credits = await import("@/services/credits");
    credits.injecterLecteursPourEssai([], []);
  });
  afterAll(() => {
    (globalThis as Record<symbol, unknown>)[CLE_DEPOTS] = avant;
    credits.injecterLecteursPourEssai(null);
  });

  const processus = async (): Promise<Depots> => {
    const d = pg.creerDepotsPostgres(URL_ESSAI!);
    await d.parametres.lister();
    return d;
  };

  it("deux processus, deux demandes de 80 sur 100 lancées ensemble : une seule réservation", async () => {
    const a = await processus();
    const b = await processus();
    const reserver = (d: Depots, id: string) =>
      pg.verrouCreditsPostgres(d)!(async () => {
        const pris = (await d.reservations.lister((r) => r.statut === "active" && (r.travailId ?? "").startsWith(`trv-${suffixe}`))).reduce((s, r) => s + r.centimes, 0);
        if (pris + 80 > 100) return false;
        await new Promise((r) => setTimeout(r, 30));
        const r: ReservationCredit = { id: `res-${suffixe}-${id}`, fournisseur: "heygen", travailId: `trv-${suffixe}-${id}`, centimes: 80, devise: "USD", statut: "active", creeLe: "", modifieLe: "" };
        await d.reservations.enregistrer(r);
        return true;
      });
    const issues = await Promise.all([reserver(a, "a"), reserver(b, "b")]);
    expect(issues.filter(Boolean)).toHaveLength(1);
  });

  it("`verifierEtReserver` attend le verrou tenu par l'autre processus et voit son engagement : BUDGET_DEPASSE", async () => {
    const a = await processus();
    (globalThis as Record<symbol, unknown>)[CLE_DEPOTS] = a;
    await a.parametres.enregistrer(parametre("budget.mensuel", eur(10_000)));
    await a.parametres.enregistrer(parametre("budget.seuilConfirmation", eur(1_000_000)));
    await a.parametres.enregistrer(parametre("budget.engages", []));
    const b = await processus();
    let lacher!: () => void;
    const tenu = new Promise<void>((r) => (lacher = r));
    let pris!: () => void;
    const verrouPris = new Promise<void>((r) => (pris = r));
    const cote = pg.verrouCreditsPostgres(b)!(async () => {
      pris();
      await tenu;
      await b.parametres.enregistrer(parametre(`budget.engage.trv-b-${suffixe}`, { centimes: 9_000, le: new Date().toISOString(), statut: "active" }));
      await b.parametres.enregistrer(parametre("budget.engages", [`trv-b-${suffixe}`]));
    });
    await verrouPris;
    const depense = credits.verifierEtReserver({ lignes: [ligne(2_000)], total: eur(2_000) }, true, "Cette vidéo", { videoId: "v-a", travailId: `trv-a-${suffixe}` });
    await new Promise((r) => setTimeout(r, 100));
    lacher();
    await cote;
    await expect(depense).rejects.toMatchObject({ code: "BUDGET_DEPASSE" });
    expect(await a.reservations.lister((r) => r.travailId === `trv-a-${suffixe}`)).toEqual([]);
    await a.parametres.enregistrer(parametre("budget.engages", []));
  });
});
