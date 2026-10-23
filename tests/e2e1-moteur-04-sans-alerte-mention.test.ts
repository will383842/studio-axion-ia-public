/**
 * E2E-1 n° 4 (MAJEUR, 03/10) — aucune alerte ni message sur la mention IA dans le rapport qualité d'une vidéo, quel que
 * soit son réglage (facultative, coupée par défaut : décision de Will). Moteur avocat et moteur d'essai.
 */
import { hash } from "@node-rs/argon2";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { mockHeaders, mockNavigation, reinitialiserRequete } from "./helpers/next-mocks";
import type { ResultatFabrication } from "@/moteurs";
import type { MoteurVideo } from "@/moteurs";
import type { CommandeFabrication, Travail } from "@/domaine/types";

vi.mock("next/headers", () => mockHeaders);
vi.mock("next/navigation", () => mockNavigation);

const { reinitialiserDepots } = await import("@/donnees/memoire");
const auth = await import("@/services/auth");
const fabrication = await import("@/services/fabrication");
const { moteurMontageAvocat } = await import("@/moteurs/montage-avocat");
const { moteurSimulation } = await import("@/moteurs/simulation");
const briques = await import("@/briques");

const T0 = Date.UTC(2026, 9, 3, 9, 0, 0);
const MDP = "e2e1-moteur-mention";

beforeAll(async () => {
  process.env.SESSION_SECRET = "g".repeat(48);
  const e = await hash(MDP, { algorithm: 2, memoryCost: 19456, timeCost: 2, parallelism: 1 });
  process.env.STUDIO_PASSWORD_HASH_B64 = Buffer.from(e).toString("base64");
});

beforeEach(async () => {
  reinitialiserDepots();
  reinitialiserRequete();
  await auth.seConnecter(MDP, false);
});

async function resultatDe(m: MoteurVideo, c: CommandeFabrication): Promise<ResultatFabrication> {
  let t: Travail = await m.lancer(c, { travailId: "t", versionId: "v", titre: "T", maintenant: T0 });
  for (let ms = T0; ms < T0 + 10 * 60_000; ms += 500) {
    const r = await m.avancer(t, c, ms);
    t = r.travail;
    if (r.resultat) return r.resultat;
    if (t.statut === "echec") throw new Error("échec");
  }
  throw new Error("bloqué");
}

describe("E2E-1 n° 4 · plus d'alerte « mention IA »", () => {
  for (const [nom, moteur] of [["montage-avocat", moteurMontageAvocat], ["simulation", moteurSimulation]] as const) {
    it(`${nom} : mention coupée (défaut) ou cochée, aucune alerte ni message sur la mention`, async () => {
      const base = await fabrication.construireCommande("v-03");
      for (const coche of [false, true]) {
        const c = { ...base, briques: { ...base.briques, "mention-ia": coche } };
        const r = await resultatDe(moteur, c);
        const alertes = r.sorties.flatMap((s) => s.rapportQualite.alertes);
        expect(alertes.some((a) => a.code === "mention-ia")).toBe(false);
        expect(alertes.some((a) => /mention|AI Act|étiquettes? IA/i.test(a.message))).toBe(false);
      }
    });
  }

  it("la brique commune n'exporte plus de générateur d'alerte sur la mention", () => {
    expect("alertesMentionIA" in briques).toBe(false);
  });
});
