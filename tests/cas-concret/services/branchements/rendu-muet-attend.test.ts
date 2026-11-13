/**
 * GV2-07 · Un serveur de rendu muet fait ATTENDRE (RenduEnCours), il ne fait pas échouer tout de suite.
 *  - une exception « indisponible » (transport) devient une attente, pendant 10 min de silence de suite ;
 *  - au-delà, l'erreur d'avant est rendue ;
 *  - un ÉTAT « échec » rendu par la garde « sans nouvelle » reste un échec (ce n'est pas une exception).
 */
import { describe, expect, it } from "vitest";
import { mockHeaders, mockNavigation } from "../../../helpers/next-mocks";
import { vi } from "vitest";

vi.mock("next/headers", () => mockHeaders);
vi.mock("next/navigation", () => mockNavigation);
vi.mock("next/cache", () => ({ revalidatePath: () => undefined, revalidateTag: () => undefined }));

const { ErreurRendu } = await import("@/fournisseurs/rendu/client");
const { RenduEnCours, estRenduEnCours } = await import("@/moteurs/montage-cas-concret");
const b = await import("@/services/cas-concret-branchements");

import type { DemandeRendu, EtatRendu, ServiceRendu } from "@/fournisseurs/types";

const MIN = 60_000;
const demande = { idRendu: "r-1" } as unknown as DemandeRendu;
const muet = () => new ErreurRendu({ code: "indisponible", reessayable: true, message: "Le service de rendu ne répond pas." });

function serviceQui(etat: () => Promise<EtatRendu>, soumettre: () => Promise<{ idRendu: string }> = async () => ({ idRendu: "r-1" })): ServiceRendu {
  return { soumettre, etat } as unknown as ServiceRendu;
}

describe("GV2-07 · rendu muet : on attend", () => {
  it("lève « indisponible » trois fois puis répond : RenduEnCours trois fois, puis le résultat", async () => {
    let appels = 0;
    const s = b.serviceRenduCasConcret(
      serviceQui(async () => {
        if (++appels <= 3) throw muet();
        return { statut: "termine", sorties: [] } as unknown as EtatRendu;
      }),
      { garde: { delaiMs: 30 * MIN, maintenant: () => 0 }, veilles: new Map() },
    );
    for (let i = 0; i < 3; i++) {
      const err = await s.etat("r-1").catch((e: unknown) => e);
      expect(estRenduEnCours(err)).toBe(true);
      expect(err).toBeInstanceOf(RenduEnCours);
    }
    expect((await s.etat("r-1")).statut).toBe("termine");
  });

  it("la soumission muette attend aussi", async () => {
    const s = b.serviceRenduCasConcret(serviceQui(async () => ({ statut: "inconnu" }), async () => { throw muet(); }), { garde: { delaiMs: 30 * MIN, maintenant: () => 0 }, veilles: new Map() });
    expect(estRenduEnCours(await s.soumettre(demande).catch((e: unknown) => e))).toBe(true);
  });

  it("muet plus de 10 minutes de suite : l'erreur d'avant", async () => {
    let t = 0;
    const s = b.serviceRenduCasConcret(serviceQui(async () => { throw muet(); }), { garde: { delaiMs: 30 * MIN, maintenant: () => t }, veilles: new Map() });
    expect(estRenduEnCours(await s.etat("r-1").catch((e: unknown) => e))).toBe(true);
    t = 9 * MIN;
    expect(estRenduEnCours(await s.etat("r-1").catch((e: unknown) => e))).toBe(true);
    t = 10 * MIN;
    const err = await s.etat("r-1").catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ErreurRendu);
    expect((err as InstanceType<typeof ErreurRendu>).erreur.code).toBe("indisponible");
  });

  it("une réponse remet le compte du silence à zéro", async () => {
    let t = 0;
    let muetEncore = true;
    const s = b.serviceRenduCasConcret(
      serviceQui(async () => {
        if (muetEncore) throw muet();
        return { statut: "en_cours", progression: 0.1 } as unknown as EtatRendu;
      }),
      { garde: { delaiMs: 30 * MIN, maintenant: () => t }, veilles: new Map() },
    );
    await s.etat("r-1").catch(() => undefined);
    t = 8 * MIN;
    muetEncore = false;
    await s.etat("r-1");
    muetEncore = true;
    t = 12 * MIN;
    expect(estRenduEnCours(await s.etat("r-1").catch((e: unknown) => e))).toBe(true);
  });

  it("une erreur NON passagère (refus) reste une erreur", async () => {
    const s = b.serviceRenduCasConcret(serviceQui(async () => { throw new ErreurRendu({ code: "refuse", reessayable: false, message: "non" }); }), { garde: { delaiMs: 30 * MIN, maintenant: () => 0 }, veilles: new Map() });
    expect(await s.etat("r-1").catch((e: unknown) => e)).toBeInstanceOf(ErreurRendu);
  });

  it("un ÉTAT « échec » sans nouvelle (garde) reste un échec rendu, pas une attente", async () => {
    let t = 0;
    const s = b.serviceRenduCasConcret(serviceQui(async () => ({ statut: "en_cours", progression: 0.2 }) as unknown as EtatRendu), { garde: { delaiMs: 5 * MIN, maintenant: () => t }, veilles: new Map() });
    await s.etat("r-1");
    t = 6 * MIN;
    const e = await s.etat("r-1");
    expect(e.statut).toBe("echec");
  });
});
