/** C4 : le motif d'un refus n'est calculé que sur une réponse en erreur, jamais sur un succès 2xx. Données FICTIVES. */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { motifRefusInbox } from "@/fournisseurs/publication/zernio-motifs-refus";
import { rendreTexteMp } from "@/domaine/guide-reseau/textes-mp";
import { creerFauxClientZernio } from "./aides/faux-zernio";

vi.mock("@/fournisseurs/publication/zernio-motifs-refus", async (original) => {
  const m = await original<typeof import("@/fournisseurs/publication/zernio-motifs-refus")>();
  return { ...m, motifRefusInbox: vi.fn(m.motifRefusInbox) };
});

const TEXTE = rendreTexteMp("mp-recu-v2", { titre: "Guide d'exemple" })!;
const PRIVE = { methode: "POST", chemin: "/v1/inbox/comments/exemple-post-1/exemple-com-1/private-reply", corps: { accountId: "exemple-compte-1", message: TEXTE }, comptesPermis: ["exemple-compte-1"], titresGuidesPermis: ["Guide d'exemple"] } as const;
const brut = (corps: unknown, status: number) => creerFauxClientZernio([], { fetch: async () => new Response(JSON.stringify(corps), { status }) });

describe("C4 motif calculé seulement hors 2xx", () => {
  beforeEach(() => vi.mocked(motifRefusInbox).mockClear());
  it("une réponse 200 ne calcule aucun motif", async () => {
    await brut({ success: true }, 200).client.requete(PRIVE).catch(() => undefined);
    expect(motifRefusInbox).not.toHaveBeenCalled();
  });
  it("une réponse 400 calcule le motif", async () => {
    await brut({ error: "x" }, 400).client.requete(PRIVE).catch(() => undefined);
    expect(motifRefusInbox).toHaveBeenCalledTimes(1);
  });
});
