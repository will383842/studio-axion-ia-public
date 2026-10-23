/**
 * CORRECTEUR 1 (argent) — B4 : décors fal.ai. Une photo payée n'est plus abandonnée puis repayée : l'identifiant de
 * chaque demande est gardé dans le lot de décors, la dépense est comptée DÈS la soumission, le suivi reprend (au lieu
 * de relancer une nouvelle demande payante), et la demande passe par le contrôle du budget avec réservation (deux
 * demandes en même temps ne passent pas sur le même restant). Fabrication doublée, aucun réseau, aucune clé.
 */
import { hash } from "@node-rs/argon2";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { mockHeaders, mockNavigation, reinitialiserRequete } from "./helpers/next-mocks";

const doublure = vi.hoisted(() => ({ soumissions: 0, suiviEnPanne: true, lentMs: 0 }));

vi.mock("next/headers", () => mockHeaders);
vi.mock("next/navigation", () => mockNavigation);
vi.mock("@/fournisseurs/illustration/inscription", async () => {
  const { fournisseurIllustrationSimulation } = await import("@/fournisseurs/simulation/autres");
  const { centimes } = await import("@/lib/montants");
  const reel = {
    ...fournisseurIllustrationSimulation,
    id: "reel",
    mode: "reel",
    fabrication: {
      async soumettre(d: { cleIdempotence: string }) {
        doublure.soumissions++;
        if (doublure.lentMs) await new Promise((r) => setTimeout(r, doublure.lentMs));
        return { idDemande: d.cleIdempotence };
      },
      async suivre(id: string) {
        if (doublure.suiviEnPanne) throw new Error("fal.ai ne répond pas.");
        return { statut: "fait", fichierCle: `/essais/decors/${id}.jpg`, mime: "image/jpeg", urlSource: `https://fal.media/${id}`, cout: centimes(4), coutUsdCentimes: 3.9, modele: "fal-ai/nano-banana" };
      },
    },
  };
  return { illustrationsReelles: () => ({ reel }) };
});

process.env.FOURNISSEUR_ILLUSTRATION = "reel";
const { reinitialiserDepots, depots } = await import("@/donnees/memoire");
const auth = await import("@/services/auth");
const decors = await import("@/services/decors");
const couts = await import("@/services/couts");
const { ecrireParametre } = await import("@/services/_commun");

const MDP = "c1-argent-b4";
beforeAll(async () => {
  process.env.SESSION_SECRET = "e".repeat(48);
  process.env.STUDIO_PASSWORD_HASH_B64 = Buffer.from(await hash(MDP, { algorithm: 2, memoryCost: 19456, timeCost: 2, parallelism: 1 })).toString("base64");
});
beforeEach(async () => {
  reinitialiserDepots();
  reinitialiserRequete();
  doublure.soumissions = 0;
  doublure.suiviEnPanne = true;
  doublure.lentMs = 0;
  await auth.seConnecter(MDP, false);
});

const depensesDecor = async () => (await depots().depenses.lister()).filter((d) => d.lignes.some((l) => l.etape === "Décor demandé"));

describe("B4 · décor payé jamais abandonné puis repayé", () => {
  it("suivi en panne : la dépense est comptée dès la soumission, les demandes sont gardées ; la reprise ne repaie rien", async () => {
    const phrase = "un bureau de direction avec une baie vitrée";
    const err = await decors.demanderDecor(phrase, { confirme: true }).catch((e) => e);
    expect(doublure.soumissions).toBe(3);
    expect(err).toMatchObject({ code: "EN_PREPARATION" });
    // Payé : compté tout de suite.
    const deps = await depensesDecor();
    expect(deps).toHaveLength(1);
    expect(deps[0].lignes[0].quantite).toBe(3);
    // Plus tard, fal.ai répond : la même demande (même phrase) reprend le suivi au lieu de repayer.
    doublure.suiviEnPanne = false;
    const r = await decors.demanderDecor(phrase, { confirme: true });
    expect(doublure.soumissions).toBe(3);
    expect(r.propositionIds).toHaveLength(3);
    expect(await depensesDecor()).toHaveLength(1);
  });

  it("l'écran « Mes décors » reprend aussi le suivi : les photos arrivent sans nouvelle demande", async () => {
    await decors.demanderDecor("une salle de réunion lumineuse", { confirme: true }).catch(() => undefined);
    doublure.suiviEnPanne = false;
    const ecran = await decors.ecranDecors();
    expect(ecran.demandes.length).toBeGreaterThanOrEqual(3);
    expect(doublure.soumissions).toBe(3);
  });

  it("contrôle du budget avec réservation : deux demandes en même temps ne passent pas sur le même restant", async () => {
    doublure.suiviEnPanne = false;
    // fal.ai prend un instant à répondre : les deux demandes se chevauchent.
    doublure.lentMs = 50;
    const est = await decors.estimerDemandeDecor("un bureau de direction avec une baie vitrée");
    const deja = (await couts.resumeBudget()).depense.centimes;
    // Assez pour UNE demande, pas pour deux.
    await ecrireParametre("budget.mensuel", { centimes: deja + Math.round(est.cout.centimes * 1.5), devise: "EUR" });
    const r = await Promise.allSettled([decors.demanderDecor("un bureau de direction avec une baie vitrée", { confirme: true }), decors.demanderDecor("une bibliothèque ancienne en bois", { confirme: true })]);
    expect(r.filter((x) => x.status === "fulfilled")).toHaveLength(1);
    expect(r.find((x) => x.status === "rejected")).toMatchObject({ reason: { code: "BUDGET_DEPASSE" } });
    expect(doublure.soumissions).toBe(3);
  });
});
