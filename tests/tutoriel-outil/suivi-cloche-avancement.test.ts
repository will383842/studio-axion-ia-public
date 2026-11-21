/**
 * AUD-8 · La cloche du suivi est posée par l'avancement (`ecrireAvancement`) quand le tutoriel entre en pause qui attend
 * Williams. Dépôt mémoire, aucun appel réel, 0 €.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Travail, Video } from "@/domaine/types";

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: () => undefined, revalidateTag: () => undefined }));

const { depots, reinitialiserDepots } = await import("@/donnees/memoire");
const travaux = await import("@/services/travaux");

const VIDEO = "vid_aud8";
const T = "2026-11-21T09:00:00.000Z";
const pause = (code: string) => ({ pause: { code, message: "x" } });

const travail = (sur: Partial<Travail> = {}): Travail =>
  ({ id: "trv_aud8", type: "fabrication", cibleId: VIDEO, titre: "Tutoriel", etapes: [], statut: "en_cours", progression: 10, tentatives: 1, cleIdempotence: "k", fournisseurUtilise: "studio", creeLe: T, modifieLe: T, ...sur }) as Travail;

const lu = (t: Travail, id = "montage-tutoriel-outil") => ({ travail: t, commande: {}, moteur: { id, lignesPayees: () => [], estimer: async () => ({}) } }) as unknown as Parameters<typeof travaux.ecrireAvancement>[0];
const cloches = () => depots().notifications.lister((n) => n.lien === `/tutoriel-outil/suivi/${VIDEO}`);
const allumer = (valeur: unknown) => depots().parametres.enregistrer({ id: "tutoriel.suiviCloche", valeur, creeLe: T, modifieLe: T });

async function avancer(avant: Travail, apres: Travail, id?: string) {
  await depots().travaux.enregistrer(avant);
  return travaux.ecrireAvancement(lu(avant, id), { travail: apres });
}

beforeEach(async () => {
  reinitialiserDepots();
  await depots().videos.enregistrer({ id: VIDEO, titre: "Mon tutoriel", creeLe: T, modifieLe: T } as Video);
});

describe("cloche posée par l'avancement", () => {
  it("entrée en pause qui attend Williams, réglage allumé : une cloche", async () => {
    await allumer(true);
    const avant = travail();
    const r = await avancer(avant, travail({ statut: "en_file", parametres: pause("TO_SCRIPT_A_VALIDER") }));
    expect(r.ecrit).toBe(true);
    expect(await cloches()).toHaveLength(1);
  });

  it("éteint par défaut : aucune cloche, avancement écrit", async () => {
    const r = await avancer(travail(), travail({ statut: "en_file", parametres: pause("TO_SCRIPT_A_VALIDER") }));
    expect(r.ecrit).toBe(true);
    expect(await cloches()).toHaveLength(0);
  });

  it("pas de doublon : la même pause relue ne repose rien", async () => {
    await allumer(true);
    await avancer(travail(), travail({ statut: "en_file", parametres: pause("TO_SCRIPT_A_VALIDER") }));
    const deja = travail({ statut: "en_file", parametres: pause("TO_SCRIPT_A_VALIDER") });
    await avancer(deja, { ...deja, progression: 11 });
    expect(await cloches()).toHaveLength(1);
  });

  it("un autre format que le tutoriel d'outil : aucune cloche", async () => {
    await allumer(true);
    await avancer(travail(), travail({ statut: "en_file", parametres: pause("TO_SCRIPT_A_VALIDER") }), "montage-tableau");
    expect(await cloches()).toHaveLength(0);
  });

  it("pause qui n'attend pas Williams (outils non reliés) : aucune cloche", async () => {
    await allumer(true);
    await avancer(travail(), travail({ statut: "en_file", parametres: pause("TO_OUTILS_NON_RELIES") }));
    expect(await cloches()).toHaveLength(0);
  });

  it("jamais bloquant : la cloche en erreur laisse l'avancement écrit", async () => {
    await allumer(true);
    const err = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const lister = vi.spyOn(depots().notifications, "lister").mockRejectedValue(new Error("panne"));
    const r = await avancer(travail(), travail({ statut: "en_file", progression: 40, parametres: pause("TO_SCRIPT_A_VALIDER") }));
    lister.mockRestore();
    err.mockRestore();
    expect(r.ecrit).toBe(true);
    expect((await depots().travaux.obtenir("trv_aud8"))?.progression).toBe(40);
  });
});
