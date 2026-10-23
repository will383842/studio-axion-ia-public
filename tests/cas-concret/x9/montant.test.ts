/**
 * X9 · point 7 (a) : la feuille a fait confirmer « au plus 0,89 € », la fiche vidéo affichait « Coût ≈ 0,94 € ». L'écart
 * est la ligne « Textes des réseaux » que le lancement commun ajoute à l'estimation du moteur. Le montant à confirmer
 * est désormais tiré de la MÊME estimation que celle du lancement (ligne comprise). Base en mémoire, lancement par un
 * double : aucun service réel, rien de payé. Depuis X11 la ligne ne s'ajoute plus à ce format (il écrit lui-même ses
 * textes) : le double la force ici pour garder le contrôle du mécanisme d'accord.
 */
import { hash } from "@node-rs/argon2";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { mockHeaders, mockNavigation, reinitialiserRequete } from "../../helpers/next-mocks";
import { RELU_RECRUTEMENT } from "../../helpers/script-relu";

vi.mock("next/headers", () => mockHeaders);
vi.mock("next/navigation", () => mockNavigation);
vi.mock("next/cache", () => ({ revalidatePath: () => undefined, revalidateTag: () => undefined }));

/** La ligne « Textes des réseaux » du lancement commun : 5 centimes, comme au premier essai réel. */
const TEXTES = 5;
vi.mock("@/services/publications", async (original) => ({
  ...(await original<typeof import("@/services/publications")>()),
  avecTextesDesReseaux: async <E extends { lignes: unknown[]; total: { centimes: number; devise: "EUR" } }>(_videoId: string, e: E) => ({ ...e, total: { ...e.total, centimes: e.total.centimes + TEXTES }, textesReseaux: { centimes: TEXTES, devise: "EUR" } }),
}));

const { reinitialiserDepots } = await import("@/donnees/memoire");
const auth = await import("@/services/auth");
const service = await import("@/services/cas-concret");

const MDP = "cas-concret-x9";
const RESEAUX = ["facebook", "instagram", "tiktok", "linkedin"];

beforeAll(async () => {
  process.env.SESSION_SECRET = "t".repeat(48);
  const e = await hash(MDP, { algorithm: 2, memoryCost: 19456, timeCost: 2, parallelism: 1 });
  process.env.STUDIO_PASSWORD_HASH_B64 = Buffer.from(e).toString("base64");
});

beforeEach(async () => {
  reinitialiserDepots();
  reinitialiserRequete();
  await auth.seConnecter(MDP, false);
});

describe("X9 · le montant confirmé est celui que la fiche affichera", () => {
  it("un accord au montant de la feuille sans les textes est redemandé au montant du lancement, puis lancé", async () => {
    const feuille = (await service.estimerCas("recrutement-apporteurs", RESEAUX, false)).centimes;
    const lancer = vi.fn(async () => ({ travailId: "t-x9" }));
    const demande = { casId: "recrutement-apporteurs", reseaux: RESEAUX, mot: "IA", avecMot: false, empreinteScriptRelu: RELU_RECRUTEMENT };

    const premier = await service.preparerEtLancer({ ...demande, accordCentimes: feuille }, { lancer });
    expect(premier).toMatchObject({ statut: "accord-requis", centimes: feuille + TEXTES });
    expect(lancer).not.toHaveBeenCalled();

    const second = await service.preparerEtLancer({ ...demande, accordCentimes: feuille + TEXTES }, { lancer });
    expect(second.statut).toBe("lancee");
    // Même vidéo (le brouillon est repris), lancée avec l'accord du montant exact.
    expect(premier.statut === "accord-requis" && second.statut === "lancee" && second.videoId).toBe(premier.statut === "accord-requis" ? premier.videoId : "");
    expect(lancer).toHaveBeenCalledWith(expect.any(String), feuille + TEXTES);
  });
});
