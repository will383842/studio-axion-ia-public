/**
 * SÉRIE « CHIFFRES » (audit de bout en bout, non bloquants 4.4 et 4.10) — ce que l'écran dit des chiffres.
 *  - 4.4 : la note du script /100 (fiche script, Atelier) est calculée par règles fixes : elle est libellée « estimée » ;
 *  - 4.10 : un crédit au solde inconnu n'a pas une jauge verte (ton neutre).
 * Aucun appel réseau, aucune clé.
 */
import { hash } from "@node-rs/argon2";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { mockHeaders, mockNavigation, reinitialiserRequete } from "./helpers/next-mocks";

vi.mock("next/headers", () => mockHeaders);
vi.mock("next/navigation", () => mockNavigation);
vi.mock("@/app/(studio)/reglages/actions", () => new Proxy({}, { get: (_c, nom) => (nom === "then" ? undefined : async () => ({ ok: true, donnees: null })) }));

const { reinitialiserDepots } = await import("@/donnees/memoire");
const auth = await import("@/services/auth");
const credits = await import("@/services/credits");
const { ResumeTexte } = await import("@/components/ecrire/ResumeTexte");
const { JaugeCredit } = await import("@/components/reglages/Credits");

import type { LecteurCredit } from "@/fournisseurs/types";

const MDP = "chiffres-ecrans";

beforeAll(async () => {
  process.env.SESSION_SECRET = "e".repeat(48);
  const e = await hash(MDP, { algorithm: 2, memoryCost: 19456, timeCost: 2, parallelism: 1 });
  process.env.STUDIO_PASSWORD_HASH_B64 = Buffer.from(e).toString("base64");
});

beforeEach(async () => {
  reinitialiserDepots();
  reinitialiserRequete();
  credits.injecterLecteursPourEssai(null);
  await auth.seConnecter(MDP, false);
});

afterEach(() => {
  credits.injecterLecteursPourEssai(null);
});

describe("4.4 · note du script : libellée « estimée »", () => {
  it("fiche script et Atelier (même bloc de chiffres) : « Note estimée », jamais « Note » seule", () => {
    const html = renderToStaticMarkup(
      createElement(ResumeTexte, { dureeSec: 40, cibleSec: 45, notes: { globale: 81, criteres: { accroche: 90 } } as never, criteres: [{ id: "accroche", nom: "Accroche" }] }),
    );
    expect(html).toContain("Note estimée");
    expect(html).toContain("81");
    expect(html).not.toMatch(/>Note</);
  });
});

describe("4.10 · crédit au solde inconnu : jauge neutre, jamais verte", () => {
  /** Lecteur HeyGen qui ne répond pas (solde inconnu) ; aucune requête réelle. */
  const muet: LecteurCredit = {
    fournisseur: "heygen",
    nom: "HeyGen",
    mode: "reel",
    urlRecharge: "",
    variableCle: "HEYGEN_API_KEY",
    async lireSolde() {
      throw new Error("indisponible");
    },
    async testerConnexion() {
      return { ok: false, finCle: "…x", message: "indisponible", testeLe: new Date().toISOString() };
    },
  };

  it("Réglages › Crédits : solde inconnu → ton « neutre »", async () => {
    credits.injecterLecteursPourEssai([muet], []);
    const cartes = await credits.vueCredits({ relire: false });
    const inconnues = cartes.filter((c) => c.disponibleTexte === null && !c.cleRefusee);
    expect(inconnues.length).toBeGreaterThan(0);
    for (const c of inconnues) expect(c.ton).toBe("neutre");
  });

  it("la jauge neutre n'est pas colorée en vert", () => {
    const html = renderToStaticMarkup(createElement(JaugeCredit, { pourcentage: null, ton: "neutre" as never }));
    expect(html).not.toContain("bg-sauge");
  });
});
