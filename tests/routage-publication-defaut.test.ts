/** L7-06 · Zernio est l'outil d'envoi par défaut : aucun envoi réel, faux client seulement. */
import { readFileSync } from "node:fs";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { mockHeaders, mockNavigation, reinitialiserRequete } from "./helpers/next-mocks";

vi.mock("next/headers", () => mockHeaders);
vi.mock("next/navigation", () => mockNavigation);
vi.mock("next/cache", () => ({ revalidatePath: () => undefined, revalidateTag: () => undefined }));

const { reinitialiserDepots } = await import("@/donnees/memoire");
const D = await import("@/domaine/outil-publication");
const { outilDeEnvoi } = await import("@/services/routage-publication");
const { injecterClientZernio, PARAM_EDITORIALE_ACTIVE } = await import("@/services/zernio");
const { creerFauxClientZernio } = await import("./zernio/aides/faux-zernio");

const lire = (chemin: string) => readFileSync(chemin, "utf8");

beforeEach(() => {
  reinitialiserDepots();
  reinitialiserRequete();
  delete process.env.ZERNIO_API_KEY;
  injecterClientZernio(null);
});

describe("L7-06 · défaut Zernio", () => {
  it("outilPour() ne renvoie jamais buffer par défaut", () => {
    expect(D.outilPour(undefined, "instagram")).toBe("zernio");
    expect(D.outilPour({}, "instagram", "compte")).toBe("zernio");
    expect(D.outilPour({ instagram: "inconnu" }, "instagram")).toBe("zernio");
  });

  it("un choix explicite déjà enregistré (données Buffer existantes) reste lisible", () => {
    expect(D.outilPour({ instagram: "buffer" }, "instagram")).toBe("buffer");
    expect(D.outilDe({ via: "buffer" })).toBe("buffer");
  });

  it("sans réglage, une vidéo Instagram part vers Zernio (faux client)", async () => {
    injecterClientZernio(creerFauxClientZernio().client);
    expect(await outilDeEnvoi("instagram")).toBe("zernio");
  });

  it("sans clé Zernio : refus clair, jamais de repli vers l'autre outil", async () => {
    await expect(outilDeEnvoi("instagram")).rejects.toMatchObject({ code: "ZERNIO_NON_RELIE" });
  });

  it("la date de fin de Buffer n'est plus lue ni affichée", () => {
    for (const f of ["src/services/a-publier-zernio.ts", "src/components/publication/finitions-envoi.ts", "src/components/publication/LignesAPublier.tsx", "src/components/reglages/BlocZernio.tsx"]) {
      const s = lire(f);
      expect(s, f).not.toMatch(/FIN_BUFFER/);
      expect(s, f).not.toMatch(/20\/11/);
    }
  });

  it("plus d'option Buffer dans Réglages ni dans À publier", () => {
    expect(lire("src/components/reglages/BlocZernio.tsx")).not.toMatch(/valeur: "buffer"/);
    expect(lire("src/components/publication/LignesAPublier.tsx")).not.toMatch(/"zernio", "buffer"/);
    expect(lire("src/components/publication/LignesAPublier.tsx")).not.toMatch(/outil \?\? "buffer"|outil: [^,]*\?\? "buffer"/);
  });

  it("le nom du réglage d'envoi du calendrier est celui de L7-08", () => {
    expect(D.REGLAGE_ENVOI_CALENDRIER).toBe(PARAM_EDITORIALE_ACTIVE);
    expect(D.REGLAGE_ENVOI_CALENDRIER).toBe("publication.editoriale_active");
  });
});
