/**
 * P2C · Raccord du lot A (#156) : le document promis d'une vidéo de la porte B se lit, se corrige et se valide avec le
 * cas GARDÉ AVEC LA VIDÉO (`entrees.casConcret.cas`), qui n'est jamais au catalogue. Base en mémoire, aucun `fetch`.
 */
import { hash } from "@node-rs/argon2";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { mockHeaders, mockNavigation, reinitialiserRequete } from "../../helpers/next-mocks";

vi.mock("next/headers", () => mockHeaders);
vi.mock("next/navigation", () => mockNavigation);
vi.mock("next/cache", () => ({ revalidatePath: () => undefined, revalidateTag: () => undefined }));

const { reinitialiserDepots, depots } = await import("@/donnees/memoire");
const { ecrireParametre } = await import("@/services/_commun");
const auth = await import("@/services/auth");
const service = await import("@/services/cas-concret-document");
const { trouverCas } = await import("@/formats/cas-concret/catalogue");
const { codeDocument, documentDuCas, texteSource } = await import("@/formats/cas-concret/document");

const MDP = "cas-concret-p2c-document";
const VIDEO = "v-03";
const base = trouverCas("recrutement-apporteurs")!;
/** Un cas né de la porte B : un identifiant et un document que le catalogue ne connaît pas. */
const casB = { ...structuredClone(base), id: "porte-b-p2c-relances", titre: "Relancer les candidats sans y passer la soirée", documentPromis: { ...base.documentPromis, nom: "La structure des relances" } };

beforeAll(async () => {
  process.env.SESSION_SECRET = "t".repeat(48);
  const e = await hash(MDP, { algorithm: 2, memoryCost: 19456, timeCost: 2, parallelism: 1 });
  process.env.STUDIO_PASSWORD_HASH_B64 = Buffer.from(e).toString("base64");
});

beforeEach(async () => {
  reinitialiserDepots();
  reinitialiserRequete();
  await auth.seConnecter(MDP, false);
  // Réglage `casConcret.documentPromis` allumé DANS LE DOUBLE seulement (éteint par défaut dans le studio).
  await ecrireParametre("casConcret.documentPromis", true);
  await depots().videos.modifier(VIDEO, { formatId: "cas-concret", entrees: { casConcret: { casId: casB.id, porte: "porte-b", cas: casB, description: "Je relance mes candidats à la main.", codeSuivi: "cc-b12345" } } });
});

describe("P2C · document promis d'une vidéo de la porte B", () => {
  it("le cas n'est pas au catalogue, le document est pourtant lu depuis le cas gardé avec la vidéo", async () => {
    expect(trouverCas(casB.id)).toBeUndefined();
    const vue = await service.lireDocument(VIDEO);
    expect(vue.document.titre).toBe("La structure des relances");
    expect(vue.code).toBe(codeDocument(casB));
    expect(vue.etat).toBe("brouillon");
    expect(vue.texte).toBe(texteSource(documentDuCas(casB, { codeSuivi: "cc-b12345" })));
  });

  it("corriger puis valider : même chemin que la porte A", async () => {
    const premier = (await service.lireDocument(VIDEO)).texte;
    await service.corrigerDocument(VIDEO, premier.replace("## Le principe", "## Le principe en bref"));
    expect((await service.lireDocument(VIDEO)).corrige).toBe(true);
    const { valideLe } = await service.validerDocument(VIDEO, { maintenant: Date.parse("2026-10-13T09:00:00Z") });
    const vue = await service.lireDocument(VIDEO);
    expect(vue.valideLe).toBe(valideLe);
    expect(vue.etat).toBe("valide");
  });

  it("un cas de la porte B illisible : la phrase claire, jamais une erreur technique", async () => {
    await depots().videos.modifier(VIDEO, { entrees: { casConcret: { casId: casB.id, porte: "porte-b", cas: { id: casB.id } } } });
    await expect(service.lireDocument(VIDEO)).rejects.toThrow("Le cas de cette vidéo n'existe plus.");
  });

  it("porte A inchangée : le cas du catalogue", async () => {
    await depots().videos.modifier(VIDEO, { entrees: { casConcret: { casId: base.id, codeSuivi: "cc-abc123" } } });
    expect((await service.lireDocument(VIDEO)).code).toBe(codeDocument(base));
  });
});
