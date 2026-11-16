/**
 * T4a · champ `adresseIgLe` (demande d'adresse envoyée après le OK, cible d'essai Instagram) : compté dans le plafond par personne, sans double compte
 * avec `essaiEnvoiLe`. Parties PURES, données 100 % fictives.
 */
import { describe, expect, it } from "vitest";
import type { Conversation } from "@/domaine/guide-reseau/machine-conversation";
import { limitePersonneIg, PLAFOND_IG_PERSONNE } from "@/domaine/guide-reseau/suivi-instagram";

const H = 3600_000;
const T0 = Date.parse("2026-03-01T10:00:00.000Z");
const iso = (ms: number) => new Date(ms).toISOString();
const conv = (extra: Record<string, unknown> = {}): Conversation =>
  ({ etat: "attente_email", reseau: "instagram", idCompte: "c", idCommentaire: "x", creeLe: iso(T0 - 5 * H), m2Envoye: false, ...extra }) as unknown as Conversation;

describe("T4a · adresseIgLe dans le plafond par personne", () => {
  it("le plafond reste à 3", () => {
    expect(PLAFOND_IG_PERSONNE).toBe(3);
  });
  it("m1Le + adresseIgLe + adresseRefuseeLe = 3 : plafond atteint", () => {
    const r = limitePersonneIg([conv({ m1Le: iso(T0 - 3 * H), adresseIgLe: iso(T0 - 2 * H), adresseRefuseeLe: iso(T0 - H) })], T0);
    expect(r.nombre).toBe(3);
    expect(r.atteint).toBe(true);
  });
  it("adresseIgLe seul compte pour 1 ; au-delà de 24 h il ne compte plus", () => {
    expect(limitePersonneIg([conv({ adresseIgLe: iso(T0 - H) })], T0).nombre).toBe(1);
    expect(limitePersonneIg([conv({ adresseIgLe: iso(T0 - 25 * H) })], T0).nombre).toBe(0);
  });
  it("adresseIgLe illisible compte à l'instant (échec fermé)", () => {
    const r = limitePersonneIg([conv({ adresseIgLe: "pas-une-date" })], T0);
    expect(r.nombre).toBe(1);
    expect(r.repriseMs).toBeNull();
  });
  it("un parcours Facebook n'est jamais compté", () => {
    expect(limitePersonneIg([conv({ reseau: "facebook", adresseIgLe: iso(T0 - H) })], T0).nombre).toBe(0);
  });
  it("essaiEnvoiLe n'est pas compté en plus quand adresseIgLe est posé (état non incertain)", () => {
    const r = limitePersonneIg([conv({ adresseIgLe: iso(T0 - H), essaiEnvoiLe: iso(T0 - H) })], T0);
    expect(r.nombre).toBe(1);
  });
  it("essaiEnvoiLe reste compté quand l'état est incertain (issue inconnue)", () => {
    const r = limitePersonneIg([conv({ etat: "ig_a_verifier", adresseIgLe: iso(T0 - 2 * H), essaiEnvoiLe: iso(T0 - H) })], T0);
    expect(r.nombre).toBe(2);
  });
});
