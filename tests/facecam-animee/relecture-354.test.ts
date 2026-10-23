/**
 * RELECTURE « EXACTITUDE » DE LA PR #354 (envoi qui reprend, partagé par tous les formats). Défauts corrigés :
 *  1. un envoi inconnu du seau (déjà terminé avant un redémarrage, ou expiré) répondait 502 au « recus » de la reprise : le navigateur
 *     le prenait pour une coupure passagère et réessayait sans fin, « Reprendre l'envoi » n'aboutissait jamais. Le studio répond
 *     désormais un refus net (`ENVOI_EXPIRE`) et le navigateur recommence l'envoi, comme avant la PR.
 * AUCUN appel réseau.
 */
import { describe, expect, it, vi } from "vitest";
import { creerStockageR2 } from "@/fournisseurs/r2/stockage";
import type { StockageFichiers } from "@/fournisseurs/types";
import { cleReprise, envoyerFichier, MO, RefusEnvoi } from "@/lib/envoi-multipart";

const stockageFaux: { courant?: StockageFichiers } = {};
vi.mock("@/services/_commun", async (original) => ({
  ...(await original<typeof import("@/services/_commun")>()),
  fournisseur: async () => stockageFaux.courant,
}));
const envois = await import("@/services/envois");

const CONFIG_R2 = { compte: "c", cleAcces: "CLE", secret: "SECRET", seau: "seau", hote: "c.r2.cloudflarestorage.com", env: "dev" as const };
const CLE = "studio/dev/entree/facecam-animee/f-1.mov";

function stockageMemoire(): Storage {
  const m = new Map<string, string>();
  return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => void m.set(k, v), removeItem: (k) => void m.delete(k), clear: () => m.clear(), key: () => null, get length() { return m.size; } } as Storage;
}

describe("Relecture #354 · 1. reprise d'un envoi que le seau ne connaît plus", () => {
  it("R2 répond 404 à ListParts : le studio refuse net (ENVOI_EXPIRE), jamais une erreur 502 réessayée", async () => {
    const fetchFaux = (async () => new Response("<Error><Code>NoSuchUpload</Code></Error>", { status: 404 })) as typeof fetch;
    stockageFaux.courant = creerStockageR2(CONFIG_R2, { fetch: fetchFaux });
    await expect(envois.morceauxRecus(CLE, "envoi-perdu")).rejects.toMatchObject({ code: "ENVOI_EXPIRE" });
  });

  it("une autre panne de R2 (500) reste une erreur passagère (502 côté route, réessayée par le navigateur)", async () => {
    const fetchFaux = (async () => new Response("", { status: 500 })) as typeof fetch;
    stockageFaux.courant = creerStockageR2(CONFIG_R2, { fetch: fetchFaux });
    const e = await envois.morceauxRecus(CLE, "envoi-x").catch((x: unknown) => x);
    expect(e).toBeInstanceOf(Error);
    expect((e as { code?: string }).code).toBeUndefined();
  });

  it("navigateur : refus « envoi expiré » au « recus » → l'envoi recommence (un nouvel envoi ouvert), il ne boucle pas", async () => {
    const appels: string[] = [];
    let ouverts = 0;
    const api = async (corps: Record<string, unknown>) => {
      appels.push(String(corps.action));
      switch (corps.action) {
        case "recus":
          throw new RefusEnvoi("Cet envoi n'existe plus : il repart du début.");
        case "commencer":
          ouverts++;
          return { fichierId: `f-${ouverts + 1}`, cle: `studio/dev/entree/facecam-animee/f-${ouverts + 1}.mov`, idEnvoi: `e-${ouverts + 1}`, tailleMorceau: 10 * MO };
        case "signer":
          return { adresses: Object.fromEntries((corps.numeros as number[]).map((n) => [n, `https://r2/morceau/${n}`])) };
        case "terminer":
          return { fichierId: corps.fichierId };
      }
      return {};
    };
    const fichier = new File([new Uint8Array(20 * MO)], "IMG_7747.MOV", { type: "video/quicktime", lastModified: 7 });
    const cible = { typeEntite: "entree", entiteId: "facecam-animee" };
    const stockage = stockageMemoire();
    // État laissé par un envoi dont la fin a réussi mais dont la réponse s'est perdue (redémarrage du studio).
    stockage.setItem(cleReprise(fichier, cible), JSON.stringify({ fichierId: "f-1", cle: CLE, idEnvoi: "e-1", simulation: false, tailleMorceau: 10 * MO, morceaux: [{ numero: 1, etag: '"a"' }, { numero: 2, etag: '"b"' }] }));
    const r = await envoyerFichier(fichier, cible, { api, envoyerMorceau: async (url) => `"${url}"`, stockage, attendre: async () => undefined });
    expect(r).toEqual({ fichierId: "f-2", simulation: false });
    expect(appels.filter((a) => a === "recus")).toHaveLength(1);
    expect(appels.filter((a) => a === "commencer")).toHaveLength(1);
    expect(stockage.getItem(cleReprise(fichier, cible))).toBeNull();
  });
});
