/**
 * LOT B1 — « Demander un décor » avec une fabrication de photos RÉELLE doublée (sans réseau) : le coût affiché avant
 * est le coût relevé, la dépense est enregistrée, une photo refusée n'empêche pas les autres, aucune personne demandée.
 */
import { hash } from "@node-rs/argon2";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { mockHeaders, mockNavigation, reinitialiserRequete } from "./helpers/next-mocks";

const doublure = vi.hoisted(() => ({ requetes: [] as string[], refuserLaSeconde: false }));

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
      async soumettre(d: { requete: string; cleIdempotence: string }) {
        doublure.requetes.push(d.requete);
        if (doublure.refuserLaSeconde && doublure.requetes.length === 2) throw new Error("refus du filtre");
        return { idDemande: d.cleIdempotence };
      },
      async suivre(id: string) {
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
const { contientInterdit } = await import("@/domaine/illustrations");

const MDP = "essai-b1-reel";
beforeAll(async () => {
  process.env.SESSION_SECRET = "a".repeat(48);
  process.env.STUDIO_PASSWORD_HASH_B64 = Buffer.from(await hash(MDP, { algorithm: 2, memoryCost: 19456, timeCost: 2, parallelism: 1 })).toString("base64");
});
beforeEach(async () => {
  reinitialiserDepots();
  reinitialiserRequete();
  doublure.requetes = [];
  doublure.refuserLaSeconde = false;
  await auth.seConnecter(MDP, false);
});

describe("demande de décor, fabrication réelle doublée", () => {
  it("coût affiché avant = 3 × 0,039 $ converti ; dépense enregistrée au même montant ; photos sans personne", async () => {
    const est = await decors.estimerDemandeDecor("un bureau de direction avec une baie vitrée");
    expect(est.essai).toBe(false);
    expect(est.cout.centimes).toBe(Math.round(3 * 3.9 * 0.9));
    const avant = await depots().depenses.compter();
    const r = await decors.demanderDecor("un bureau de direction avec une baie vitrée", { confirme: true });
    expect(r.propositionIds).toHaveLength(3);
    expect(r.cout.centimes).toBe(est.cout.centimes);
    expect(await depots().depenses.compter()).toBe(avant + 1);
    for (const q of doublure.requetes) expect(contientInterdit(q.replace(/no people|no hands|no faces|no logo|no uniform/gi, ""))).toBe(false);
    const e = await depots().elements.obtenir(r.propositionIds[0]);
    expect(e?.licence).toMatchObject({ type: "generee-ia", usageCommercial: true, source: "fal.ai (Nano Banana)" });
    // Pas de studio-rendu relié : la vignette sur le double n'est pas calculée, l'écran pose le double simulé.
    expect((await decors.ecranDecors()).demandes.every((d) => d.surDouble === null)).toBe(true);
  });
  it("une photo refusée n'empêche pas les deux autres", async () => {
    doublure.refuserLaSeconde = true;
    const r = await decors.demanderDecor("une salle de réunion lumineuse", { confirme: true });
    expect(r.propositionIds).toHaveLength(2);
  });
});
