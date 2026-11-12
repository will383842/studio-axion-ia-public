/**
 * USINE-FORMAT-INCONNU : une idée de l'usine dont le format n'est pas disponible est refusée (FORMAT_NON_DISPONIBLE),
 * sans sujet, sans matière, sans rappel à l'usine ; le refus est journalisé avec la signature. Aucun réseau.
 */
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { mockHeaders, mockNavigation, reinitialiserRequete } from "./helpers/next-mocks";

vi.mock("next/headers", () => mockHeaders);
vi.mock("next/navigation", () => mockNavigation);
vi.mock("next/cache", () => ({ revalidatePath: () => undefined }));

const { reinitialiserDepots, depots } = await import("@/donnees/memoire");
const auth = await import("@/services/auth");
const { ErreurStudio } = await import("@/services/_commun");
const sujet = await import("@/services/usine-sujet");
const require_formats = await import("@/formats");
const { listerFormatsActifs } = require_formats;
import type { IdeeUsine } from "@/domaine/usine";

const idee = (format: string | undefined, signature = "sig-fi-1"): IdeeUsine => ({
  signature,
  parts: { metier: "plombier", douleur: "d12", actualite: null },
  metier: "Plombier",
  taille: "TPE",
  douleur: "Les devis traînent trois jours.",
  casUsage: "Un devis envoyé dans l'heure.",
  ...(format === undefined ? {} : { format }),
});
const OPTIONS = { reseaux: ["tiktok"], typeContenu: "video" as const };

async function etat() {
  const d = depots();
  return { sujets: (await d.scriptsMaitres.lister(() => true)).length, matieres: (await d.matieres.lister(() => true)).length };
}

describe("format non disponible", () => {
  beforeAll(async () => {
    const { hash } = await import("@node-rs/argon2");
    process.env.SESSION_SECRET = "a".repeat(48);
    process.env.STUDIO_PASSWORD_HASH_B64 = Buffer.from(await hash("essai-usine", { algorithm: 2, memoryCost: 19456, timeCost: 2, parallelism: 1 })).toString("base64");
  });
  beforeEach(async () => {
    reinitialiserDepots();
    reinitialiserRequete();
    await auth.seConnecter("essai-usine", false);
    delete process.env.USINE_URL;
    delete process.env.USINE_PORTE_SECRET;
  });

  it("le code est exporté", () => {
    expect(sujet.format_non_disponible).toBe("FORMAT_NON_DISPONIBLE");
  });

  it.each([["format inconnu", "format-qui-n-existe-pas"], ["format absent", undefined], ["format vide", ""], ["format d'espaces", "   "]])(
    "%s : formatPourIdeeUsine refuse",
    (_nom, format) => {
      expect(() => sujet.formatPourIdeeUsine(format)).toThrowError(ErreurStudio);
      try {
        sujet.formatPourIdeeUsine(format);
      } catch (e) {
        expect((e as InstanceType<typeof ErreurStudio>).code).toBe("FORMAT_NON_DISPONIBLE");
      }
    },
  );

  it("format inconnu : aucun sujet, aucune matière, aucun appel à l'usine", async () => {
    process.env.USINE_URL = "https://usine.test/";
    process.env.USINE_PORTE_SECRET = "secret-porte-xyz-0123456789-abcdefghij";
    const f = vi.fn(async () => new Response("{}", { status: 200 }));
    vi.stubGlobal("fetch", f);
    try {
      await expect(sujet.ecrireSujetDeLUsine(idee("format-qui-n-existe-pas"), OPTIONS)).rejects.toMatchObject({ code: "FORMAT_NON_DISPONIBLE" });
      expect(await etat()).toEqual({ sujets: 0, matieres: 0 });
      expect(f).not.toHaveBeenCalled();
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("idée sans aucun format : refusée de la même façon", async () => {
    await expect(sujet.ecrireSujetDeLUsine(idee(undefined), OPTIONS)).rejects.toMatchObject({ code: "FORMAT_NON_DISPONIBLE" });
    expect(await etat()).toEqual({ sujets: 0, matieres: 0 });
  });

  it("le refus est journalisé avec la signature de l'idée", async () => {
    await expect(sujet.ecrireSujetDeLUsine(idee("inconnu", "sig-journal-42"), OPTIONS)).rejects.toMatchObject({ code: "FORMAT_NON_DISPONIBLE" });
    const evs = await depots().evenements.lister((e) => e.message.includes("sig-journal-42"));
    expect(evs.length).toBe(1);
    expect(evs[0].type).toBe("usine");
    expect(evs[0].message).toContain("FORMAT_NON_DISPONIBLE");
  });

  it("un format connu est trouvé, avec ou sans accents, majuscules et espaces", () => {
    const f = listerFormatsActifs().find((x) => x.nom !== x.nom.normalize("NFD").replace(/\p{M}/gu, "")) ?? listerFormatsActifs()[0];
    const sansAccent = f.nom.normalize("NFD").replace(/\p{M}/gu, "");
    expect(sujet.formatPourIdeeUsine(f.nom)).toBe(f.id);
    expect(sujet.formatPourIdeeUsine(`  ${sansAccent.toUpperCase()} `)).toBe(f.id);
    expect(sujet.formatPourIdeeUsine(f.id)).toBe(f.id);
  });

  it("un format existant mais éteint (« bientôt ») n'est pas trouvé : refus, pas de repli", () => {
    const { trouverFormat } = require_formats;
    const eteint = ["createur-b", "ecran-partage", "motion", "ugc"].map((id) => trouverFormat(id)).find((f) => f && f.statut !== "actif");
    expect(eteint).toBeDefined();
    expect(() => sujet.formatPourIdeeUsine(eteint!.id)).toThrowError(ErreurStudio);
    expect(() => sujet.formatPourIdeeUsine(eteint!.nom)).toThrowError(ErreurStudio);
  });

  it("un format connu crée toujours le sujet", async () => {
    const f = listerFormatsActifs()[0];
    const r = await sujet.ecrireSujetDeLUsine(idee(f.nom, "sig-ok"), OPTIONS);
    expect(r.id).toBeTruthy();
    expect((await etat()).sujets).toBe(1);
  });
});
