/**
 * RELECTURE PAQUET 4 — exactitude, petit défaut 2 : le lot de décors est écrit en base AVANT les soumissions fal.ai,
 * puis après chacune. Un arrêt du serveur pendant les soumissions ne perd plus les demandes payées : à la reprise, une
 * demande restée « à soumettre » compte comme payée (jamais refaite), la dépense est écrite, la réservation soldée.
 * ROUGE sur 81d1bba (le lot n'existait qu'en mémoire). Fabrication doublée, aucun réseau, aucune clé.
 */
import { hash } from "@node-rs/argon2";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { mockHeaders, mockNavigation, reinitialiserRequete } from "./helpers/next-mocks";

const doublure = vi.hoisted(() => ({ soumissions: 0, bloquerApres: Infinity }));

vi.mock("next/headers", () => mockHeaders);
vi.mock("next/navigation", () => mockNavigation);
vi.mock("@/fournisseurs/illustration/inscription", async () => {
  const { fournisseurIllustrationSimulation } = await import("@/fournisseurs/simulation/autres");
  const reel = {
    ...fournisseurIllustrationSimulation,
    id: "reel",
    mode: "reel",
    fabrication: {
      async soumettre(d: { cleIdempotence: string }) {
        doublure.soumissions++;
        // Le serveur « s'arrête » pendant les soumissions suivantes : elles ne reviennent jamais.
        if (doublure.soumissions > doublure.bloquerApres) await new Promise(() => undefined);
        return { idDemande: d.cleIdempotence };
      },
      async suivre() {
        return { statut: "en_cours" };
      },
    },
  };
  return { illustrationsReelles: () => ({ reel }) };
});

process.env.FOURNISSEUR_ILLUSTRATION = "reel";
const { reinitialiserDepots, depots } = await import("@/donnees/memoire");
const auth = await import("@/services/auth");
const decors = await import("@/services/decors");
const { lireParametre } = await import("@/services/_commun");

const MDP = "paquet4-relecture-decors";
beforeAll(async () => {
  process.env.SESSION_SECRET = "f".repeat(48);
  process.env.STUDIO_PASSWORD_HASH_B64 = Buffer.from(await hash(MDP, { algorithm: 2, memoryCost: 19456, timeCost: 2, parallelism: 1 })).toString("base64");
});
beforeEach(async () => {
  reinitialiserDepots();
  reinitialiserRequete();
  doublure.soumissions = 0;
  doublure.bloquerApres = Infinity;
  await auth.seConnecter(MDP, false);
});

type Lot = { id: string; statut: string; demandes: { statut: string; idDemande?: string }[] };
const lotsEnBase = async () => {
  const ids = await lireParametre<string[]>("decors.lots", []);
  return (await Promise.all(ids.map((id) => lireParametre<Lot | null>(`decors.lot.${id}`, null)))).filter((l): l is Lot => !!l);
};
const depensesDecor = async () => (await depots().depenses.lister()).filter((d) => d.lignes.some((l) => l.etape === "Décor demandé"));

describe("Petit défaut 2 · décors : lot écrit avant les soumissions, arrêt du serveur soldé à la reprise", () => {
  it("le lot est en base pendant les soumissions, avec chaque demande partie", async () => {
    doublure.bloquerApres = 1;
    void decors.demanderDecor("un bureau de direction avec une baie vitrée", { confirme: true }).catch(() => undefined);
    await vi.waitFor(() => expect(doublure.soumissions).toBe(3));
    await vi.waitFor(async () => {
      const lots = await lotsEnBase();
      expect(lots).toHaveLength(1);
      expect(lots[0].demandes.filter((x) => x.statut === "soumise")).toHaveLength(1);
      expect(lots[0].demandes.filter((x) => x.statut === "a-soumettre")).toHaveLength(2);
    });
  });

  it("redémarrage pendant les soumissions : la reprise compte les 3 photos payées, ne resoumet rien et solde la réservation", async () => {
    doublure.bloquerApres = 1;
    void decors.demanderDecor("une salle de réunion lumineuse", { confirme: true }).catch(() => undefined);
    await vi.waitFor(() => expect(doublure.soumissions).toBe(3));
    await vi.waitFor(async () => expect(await lotsEnBase()).toHaveLength(1));
    expect(await depensesDecor()).toHaveLength(0);
    // Nouveau processus : plus rien n'est « en cours de soumission » ici.
    (globalThis as unknown as Record<symbol, Set<string> | undefined>)[Symbol.for("studio-axion-ia.decors-en-soumission")]?.clear();
    await decors.reprendreLotsDecors();
    const deps = await depensesDecor();
    expect(deps).toHaveLength(1);
    expect(deps[0].lignes[0].quantite).toBe(3);
    const [lot] = await lotsEnBase();
    expect(lot.demandes.filter((x) => x.statut === "a-soumettre")).toHaveLength(0);
    expect(await depots().reservations.compter((r) => r.travailId === lot.id && r.statut === "active")).toBe(0);
    // Une deuxième reprise ne recompte rien et ne soumet rien.
    await decors.reprendreLotsDecors();
    expect(await depensesDecor()).toHaveLength(1);
    expect(doublure.soumissions).toBe(3);
  });
});
