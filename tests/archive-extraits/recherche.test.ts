/**
 * C3-UT-3.10b-c : la recherche globale et les fiches « source-extraits » (test seul, aucun fichier de `src/`).
 * Fige le comportement attendu avant la page de 3.10b-d. Données en mémoire, aucun appel payant.
 */
import { hash } from "@node-rs/argon2";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { ElementBibliotheque } from "@/domaine/types";
import { mockHeaders, mockNavigation, reinitialiserRequete } from "../helpers/next-mocks";

vi.mock("next/headers", () => mockHeaders);
vi.mock("next/navigation", () => mockNavigation);

const { reinitialiserDepots, depots } = await import("@/donnees/memoire");
const auth = await import("@/services/auth");
const { rechercher, ficheExiste } = await import("@/services/recherche");
const { idElementArchive } = await import("@/services/archive-extraits");

const MDP = "essai-recherche-extraits";
const MAINTENANT = "2026-11-17T08:00:00.000Z";

function elementArchive(videoId: string, extra: Partial<ElementBibliotheque> = {}): ElementBibliotheque {
  return {
    id: idElementArchive(videoId),
    type: "source-extraits",
    nom: `Extraits de ${videoId}`,
    motsCles: ["expatriation", "visa"],
    valeur: {
      type: "source-extraits",
      fiche: {
        videoId,
        versionId: "version-0123456789abcdef",
        sortieId: "sortie-0123456789abcdef",
        ratio: "9:16",
        licence: { type: "propriete", usageCommercial: true, reseaux: [] },
        famille: [videoId],
        plages: [],
        rangee: false,
        sourcePreferee: false,
      },
    },
    licence: { type: "propriete", usageCommercial: true, reseaux: [] },
    formatsParDefaut: [],
    marqueId: "marque-test",
    creeLe: MAINTENANT,
    modifieLe: MAINTENANT,
    ...extra,
  } as ElementBibliotheque;
}

beforeAll(async () => {
  process.env.SESSION_SECRET = "e".repeat(48);
  const empreinte = await hash(MDP, { algorithm: 2, memoryCost: 19456, timeCost: 2, parallelism: 1 });
  process.env.STUDIO_PASSWORD_HASH_B64 = Buffer.from(empreinte).toString("base64");
});

beforeEach(async () => {
  reinitialiserDepots();
  reinitialiserRequete();
  await auth.seConnecter(MDP, false);
});

describe("recherche globale × fiche source-extraits", () => {
  it("un mot-clé qui contient la requête → l'élément apparaît dans « bibliotheque », lien exact /bibliotheque/source-extraits", async () => {
    await depots().elements.enregistrer(elementArchive("video-aaaa"));
    const r = await rechercher("visa");
    const trouve = r.bibliotheque.find((b) => b.id === idElementArchive("video-aaaa"));
    expect(trouve).toBeDefined();
    expect(trouve?.lien).toBe("/bibliotheque/source-extraits");
  });

  it("le même élément rangé (archiveLe posé) → absent", async () => {
    await depots().elements.enregistrer(elementArchive("video-bbbb", { archiveLe: MAINTENANT }));
    const r = await rechercher("visa");
    expect(r.bibliotheque.some((b) => b.id === idElementArchive("video-bbbb"))).toBe(false);
  });

  it("une requête d'un seul caractère non chiffre → résultat vide", async () => {
    await depots().elements.enregistrer(elementArchive("video-cccc", { motsCles: ["visa", "x"] }));
    const r = await rechercher("x");
    expect(r).toEqual({ sujets: [], videos: [], scripts: [], idees: [], personnages: [], bibliotheque: [] });
  });

  it("ficheExiste(\"bibliotheque\", \"source-extraits\") : constat de la valeur actuelle", async () => {
    // À revoir par 3.10b-d : tant qu'il n'y a ni tuile ni page, la fiche n'existe pas (recherche.ts, cas « bibliotheque »).
    expect(await ficheExiste("bibliotheque", "source-extraits")).toBe(false);
  });
});
