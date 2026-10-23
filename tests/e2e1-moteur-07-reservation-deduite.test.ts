/**
 * E2E-1 n° 7 (MINEUR, 03/10) — pendant la fabrication, la réservation HeyGen diminue de ce qui est DÉJÀ payé (la voix
 * lue a fait baisser le solde réel : elle ne compte plus deux fois dans le « disponible »). Idempotent ; un solde
 * SUIVI (fal.ai) garde sa réservation entière jusqu'à la dépense enregistrée.
 */
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { LecteurCredit } from "@/fournisseurs/types";
import type { LigneCout } from "@/domaine/types";

const { reinitialiserDepots, depots } = await import("@/donnees/memoire");
const credits = await import("@/services/credits");
const { centimes } = await import("@/lib/montants");
const { CENTIMES_USD_PAR_CARACTERE_HEYGEN } = await import("@/fournisseurs/heygen/voix");

const lecteur = (fournisseur: string, mode: "reel" | "suivi"): LecteurCredit =>
  ({
    fournisseur,
    nom: fournisseur,
    mode,
    urlRecharge: "",
    variableCle: "X",
    lireSolde: mode === "reel" ? async () => ({ fournisseur, centimes: 100_000, devise: "USD", luLe: new Date().toISOString() }) : undefined,
    testerConnexion: async () => ({ ok: true, finCle: "…", message: "", testeLe: new Date().toISOString() }),
  }) as LecteurCredit;

const voix = (caracteres: number): LigneCout => ({ etape: "Voix", fournisseur: "heygen", unite: "caractere", quantite: caracteres, prixUnitaire: centimes(1), total: centimes(caracteres), nature: "reel" });

beforeEach(() => {
  reinitialiserDepots();
  credits.injecterLecteursPourEssai([lecteur("heygen", "reel"), lecteur("fal", "suivi")], ["heygen", "fal"]);
});
afterEach(() => credits.injecterLecteursPourEssai(null));

describe("E2E-1 n° 7 · réservation diminuée de ce qui est payé", () => {
  it("voix payée : la réservation HeyGen baisse de son coût, une seule fois ; fal.ai (suivi) ne bouge pas", async () => {
    await depots().reservations.enregistrer({ id: "r-h", fournisseur: "heygen", travailId: "t", videoId: "v", centimes: 1000, devise: "USD", statut: "active", creeLe: "", modifieLe: "" });
    await depots().reservations.enregistrer({ id: "r-f", fournisseur: "fal", travailId: "t", videoId: "v", centimes: 500, devise: "USD", statut: "active", creeLe: "", modifieLe: "" });
    const paye = Math.round(600 * CENTIMES_USD_PAR_CARACTERE_HEYGEN);
    const illus: LigneCout = { etape: "Illustrations fabriquées", fournisseur: "fal.ai", unite: "image", quantite: 1, prixUnitaire: centimes(100), total: centimes(100), nature: "reel" };
    await credits.deduireDejaPaye("t", [voix(600), illus]);
    expect((await depots().reservations.obtenir("r-h"))!.centimes).toBe(1000 - paye);
    expect((await depots().reservations.obtenir("r-f"))!.centimes).toBe(500);
    // Tour suivant, rien de plus payé : rien ne bouge (idempotent).
    await credits.deduireDejaPaye("t", [voix(600), illus]);
    expect((await depots().reservations.obtenir("r-h"))!.centimes).toBe(1000 - paye);
  });
});
