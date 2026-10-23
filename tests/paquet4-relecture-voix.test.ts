/**
 * RELECTURE PAQUET 4 — exactitude, petit défaut 4 : la marque « lecture de voix en vol » ne tombe qu'APRÈS l'écriture
 * de l'avancement (la voix payée est alors gardée). Avant (81d1bba), elle tombait dès le retour de HeyGen : un arrêt du
 * serveur entre ce retour et l'écriture laissait une voix payée ni gardée ni comptée, puis relue et repayée.
 * Moteur doublé (la voix est notée payante), aucun réseau, aucune clé.
 */
import { hash } from "@node-rs/argon2";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { mockHeaders, mockNavigation, reinitialiserRequete } from "./helpers/next-mocks";

const vu = vi.hoisted(() => ({ marques: [] as unknown[] }));

vi.mock("next/headers", () => mockHeaders);
vi.mock("next/navigation", () => mockNavigation);
vi.mock("@/services/travaux", async (original) => {
  const vrai = await original<typeof import("@/services/travaux")>();
  const { lireParametre } = await import("@/services/_commun");
  return {
    ...vrai,
    // Ce que verrait un redémarrage juste avant l'écriture de l'avancement.
    ecrireAvancement: async (...args: Parameters<typeof vrai.ecrireAvancement>) => {
      vu.marques.push(await lireParametre(`fabrication.lectureVoixEnVol.${args[0].travail.id}`, null));
      return vrai.ecrireAvancement(...args);
    },
  };
});

const { reinitialiserDepots, depots } = await import("@/donnees/memoire");
const auth = await import("@/services/auth");
const fabrication = await import("@/services/fabrication");
const boucle = await import("@/services/boucle");
const { moteurDeCommande } = await import("@/moteurs");
const { lireParametre, ecrireParametre } = await import("@/services/_commun");
const { centimes } = await import("@/lib/montants");

const MDP = "paquet4-relecture-voix";
beforeAll(async () => {
  process.env.SESSION_SECRET = "v".repeat(48);
  process.env.STUDIO_PASSWORD_HASH_B64 = Buffer.from(await hash(MDP, { algorithm: 2, memoryCost: 19456, timeCost: 2, parallelism: 1 })).toString("base64");
});
beforeEach(async () => {
  reinitialiserDepots();
  reinitialiserRequete();
  vu.marques.length = 0;
  await auth.seConnecter(MDP, false);
  for (const x of await depots().travaux.lister((t) => t.statut === "en_cours" || t.statut === "en_file")) await depots().travaux.enregistrer({ ...x, statut: "termine" });
  await ecrireParametre("budget.seuilConfirmation", { centimes: 1_000_000, devise: "EUR" });
});

describe("Petit défaut 4 · voix « en vol » : la marque reste jusqu'à l'écriture de l'avancement", () => {
  it("au moment d'écrire l'avancement, la lecture payée est encore marquée ; elle tombe juste après", async () => {
    const { travailId } = await fabrication.lancerFabrication("v-03", { confirme: true });
    const voixPayee = { etape: "Voix", fournisseur: "heygen", unite: "caractere" as const, quantite: 100, prixUnitaire: centimes(1), total: centimes(100), nature: "estime" as const };
    type Commande = Parameters<NonNullable<Parameters<typeof boucle.contenuDuTour>[0]>["choisirMoteur"] & {}>[0];
    const choisirMoteur = (c: Commande) => {
      const m = moteurDeCommande(c);
      return { ...m, lignesPayees: () => [], estimer: async (cmd: Commande) => ({ ...(await m.estimer(cmd)), lignes: [voixPayee] }) } as unknown as ReturnType<typeof moteurDeCommande>;
    };
    await boucle.contenuDuTour({ choisirMoteur, synchroBuffer: async () => undefined });
    expect(vu.marques.length).toBeGreaterThan(0);
    expect(vu.marques[0]).toMatchObject({ lignes: [expect.objectContaining({ fournisseur: "heygen" })] });
    expect(await lireParametre(`fabrication.lectureVoixEnVol.${travailId}`, null)).toBeNull();
  });
});
