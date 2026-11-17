/**
 * Borne des réponses Instagram (accusé + adresse mal tapée) : hors plafond de 3, 2 par personne et par 24 h. Parties PURES, données 100 % fictives.
 */
import { describe, expect, it } from "vitest";
import type { Conversation } from "@/domaine/guide-reseau/machine-conversation";
import { limitePersonneIg, limiteReponsesIg, PLAFOND_IG_PERSONNE, PLAFOND_IG_REPONSES } from "@/domaine/guide-reseau/suivi-instagram";

const H = 3600_000;
const T0 = Date.parse("2026-03-01T10:00:00.000Z");
const iso = (ms: number) => new Date(ms).toISOString();
const conv = (extra: Record<string, unknown> = {}): Conversation =>
  ({ etat: "attente_email", reseau: "instagram", idCompte: "c", idCommentaire: "x", creeLe: iso(T0 - 5 * H), m2Envoye: false, ...extra }) as unknown as Conversation;

describe("B1 · limitePersonneIg ne compte plus les deux réponses", () => {
  it("accuseLe seul → 0 ; adresseRefuseeLe seul → 0", () => {
    expect(limitePersonneIg([conv({ accuseLe: iso(T0 - H) })], T0).nombre).toBe(0);
    expect(limitePersonneIg([conv({ adresseRefuseeLe: iso(T0 - H) })], T0).nombre).toBe(0);
  });
  it("m1Le + adresseIgLe + accuseLe + adresseRefuseeLe récents → 2, non atteint", () => {
    const r = limitePersonneIg([conv({ m1Le: iso(T0 - 4 * H), adresseIgLe: iso(T0 - 3 * H), accuseLe: iso(T0 - 2 * H), adresseRefuseeLe: iso(T0 - H) })], T0);
    expect(r.nombre).toBe(2);
    expect(r.atteint).toBe(false);
  });
});

describe("B2 · limiteReponsesIg", () => {
  it("accuseLe -1 h → 1, non atteint", () => {
    const r = limiteReponsesIg([conv({ accuseLe: iso(T0 - H) })], T0);
    expect(r.nombre).toBe(1);
    expect(r.atteint).toBe(false);
    expect(r.repriseMs).toBeNull();
  });
  it("adresseRefuseeLe -3 h + autre parcours accuseLe -1 h → 2, atteint, reprise à -3 h + 24 h", () => {
    const r = limiteReponsesIg([conv({ adresseRefuseeLe: iso(T0 - 3 * H) }), conv({ accuseLe: iso(T0 - H) })], T0);
    expect(r.nombre).toBe(2);
    expect(r.atteint).toBe(true);
    expect(r.repriseMs).toBe(T0 - 3 * H + 24 * H);
  });
  it("24 h pile → 0", () => {
    expect(limiteReponsesIg([conv({ accuseLe: iso(T0 - 24 * H), adresseRefuseeLe: iso(T0 - 24 * H) })], T0).nombre).toBe(0);
  });
  it("date illisible → compte à l'instant (échec fermé)", () => {
    expect(limiteReponsesIg([conv({ accuseLe: "illisible" })], T0).nombre).toBe(1);
  });
  it("un parcours Facebook n'est jamais compté", () => {
    expect(limiteReponsesIg([conv({ reseau: "facebook", accuseLe: iso(T0 - H), adresseRefuseeLe: iso(T0 - H) })], T0).nombre).toBe(0);
  });
  it("m1Le, m2Le, lienIgLe, merciEssaiLe ne comptent pas → 0", () => {
    expect(limiteReponsesIg([conv({ m1Le: iso(T0 - H), m2Le: iso(T0 - H), lienIgLe: iso(T0 - H), merciEssaiLe: iso(T0 - H) })], T0).nombre).toBe(0);
  });
});

describe("B3 · valeurs", () => {
  it("le plafond reste à 3 ; la borne des réponses est à 2", () => {
    expect(PLAFOND_IG_PERSONNE).toBe(3);
    expect(PLAFOND_IG_REPONSES).toBe(2);
  });
});
