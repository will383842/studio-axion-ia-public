/**
 * Pinterest, PR 8 : décaler et retirer une entrée Pinterest du calendrier, comme LinkedIn, Instagram et Facebook.
 * Faux diffuseur : aucun appel réel, aucun envoi. Données fictives.
 */
import { describe, expect, it } from "vitest";
import type { LotEcritures } from "@/domaine/depots";
import { cleEnvoi, type EnvoiPlanifie } from "@/domaine/envoi-planifie";
import { instantParis } from "@/lib/horloge-paris";
import { deplacerProgrammation, type DepsDeplacement } from "@/services/deplacer-programmation";
import { retirerProgrammation, type DepsRetrait } from "@/services/retirer-programmation";

const CLE = "c".repeat(64);
const MAINTENANT = new Date("2026-12-10T10:00:00.000Z");
const DEMAIN = "2026-12-11T07:30:00.000Z"; // 08:30 à Paris
const BASE_ENVOI = { videoId: "vis_ep", nature: "visuel", creneauId: "cre_ep", reseau: "pinterest", versionCreneau: 0, jour: "2026-12-11", heure: "08:30", creeLe: "2026-12-01T00:00:00Z", modifieLe: "2026-12-01T00:00:00Z" } as const;
const envoi = (sur: Partial<EnvoiPlanifie> = {}): EnvoiPlanifie => ({ ...BASE_ENVOI, id: "envoi:vis_ep:pinterest:v0", cle: "envoi:vis_ep:pinterest:v0", cleDiffuseur: CLE, statut: "programme", valideeLe: "2026-12-01T00:00:00Z", valideePar: "fondateur", ...sur }) as EnvoiPlanifie;

function monde(statutEnvoi: "programme" | "valide" = "programme") {
  const creneaux = new Map<string, Record<string, unknown>>([["cre_ep", {
    id: "cre_ep", jourVise: "2026-12-11", heuresParReseau: { pinterest: DEMAIN }, compteCible: "cpt:pin:tab1", visuelId: "vis_ep", statut: "programme", decalages: 0,
    valideeLe: "2026-12-01T00:00:00Z", valideePar: "fondateur", textes: { pinterest: { texte: "Une description", premierCommentaire: "" } },
  }]]);
  const envois = new Map([envoi(statutEnvoi === "valide" ? { statut: "valide", cleDiffuseur: undefined } : {})].map((e) => [e.id, e]));
  const visuels = new Map<string, Record<string, unknown>>([["vis_ep", { id: "vis_ep", famille: "epingle", statut: "programme", titre: "Épingle", modifieLe: "x" }]]);
  const retraitsDiffuseur: string[] = [];
  const marques = new Map<string, string>();
  const appliquer = async (lot: LotEcritures) => {
    for (const { collection, entite } of lot.enregistrer) {
      if (collection === "creneauxEditoriaux") creneaux.set(entite.id, entite as never);
      if (collection === "envoisPlanifies") envois.set(entite.id, entite as EnvoiPlanifie);
      if (collection === "visuels") visuels.set(entite.id, entite as never);
    }
  };
  return { creneaux, envois, visuels, retraitsDiffuseur, marques, appliquer, creneau: () => creneaux.get("cre_ep") as Record<string, never> & { heuresParReseau: Record<string, string>; jourVise: string; statut: string; decalages: number } };
}

describe("PR 8 · décaler une entrée Pinterest", () => {
  it("retire chez le diffuseur, pose la nouvelle date à l'heure de la cadence Pinterest et une NOUVELLE clé d'envoi", async () => {
    const m = monde();
    const deps: DepsDeplacement = {
      diffuseur: { retirer: async (e) => { m.retraitsDiffuseur.push(e.cle); return "retire"; } },
      reglagesOuverts: async () => true,
      creneau: async (id) => (m.creneaux.get(id) as never) ?? null,
      envois: async (id) => [...m.envois.values()].filter((e) => e.creneauId === id),
      visuel: async (id) => (m.visuels.get(id) as never) ?? null,
      appliquer: m.appliquer,
      niveau: async () => ({ niveau: "programme" as const }),
      publicationsDeCles: async () => [],
      etats: { lire: async (c) => m.marques.get(c), noter: async (c, v) => void m.marques.set(c, v) },
      notifier: async () => undefined,
      maintenant: () => MAINTENANT,
    };
    const r = await deplacerProgrammation(deps, { creneauId: "cre_ep", nouveauJour: "2026-12-14", cle: "form-pin" });
    expect(r.ok).toBe(true);
    expect(m.retraitsDiffuseur).toEqual(["envoi:vis_ep:pinterest:v0"]);
    expect(m.creneau().jourVise).toBe("2026-12-14");
    expect(m.creneau().heuresParReseau.pinterest).toBe(instantParis("2026-12-14", "08:30"));
    expect(cleEnvoi("vis_ep", "pinterest", m.creneau().decalages)).toBe("envoi:vis_ep:pinterest:v1");
    expect(m.envois.get("envoi:vis_ep:pinterest:v0")!.statut).toBe("annule");
  });
});

describe("PR 8 · retirer une entrée Pinterest", () => {
  const client = (appels: string[]): DepsRetrait["client"] => ({
    lirePost: async () => { throw new Error("non utilisé"); },
    listerPosts: async (q: { status: string }) => (q.status === "scheduled" ? [{ _id: "post_pin", status: "scheduled", scheduledFor: "2026-12-11T07:30:00.000Z", platforms: [{ platform: "pinterest", status: "scheduled" }], metadata: { origine: "studio", studioCle: CLE } }] : []) as never,
    retirer: async (d: { postId: string; cleJournal: string }) => { appels.push(`${d.postId}:${d.cleJournal}`); return { etat: "retire" } as never; },
  });
  it("une épingle programmée se retire chez le diffuseur avec sa clé, puis le créneau est archivé et le visuel redevient « valide »", async () => {
    const m = monde();
    const appels: string[] = [];
    const deps: DepsRetrait = {
      client: client(appels),
      reglages: { envoiAutorise: async () => true, envoiCalendrierAutorise: async () => true, editorialeActive: async () => true },
      creneau: async (id) => (m.creneaux.get(id) as never) ?? null,
      envois: async (id) => [...m.envois.values()].filter((e) => e.creneauId === id),
      visuel: async (id) => (m.visuels.get(id) as never) ?? null,
      appliquer: m.appliquer,
      etats: { lire: async (c) => m.marques.get(c), noter: async (c, v) => { m.marques.set(c, v); } },
      maintenant: () => MAINTENANT,
    };
    const r = await retirerProgrammation(deps, "cre_ep");
    expect(r.ok && r.etat).toBe("retire");
    expect(appels).toEqual([`post_pin:${CLE}`]);
    expect(m.creneau().statut).toBe("archive");
    expect(m.visuels.get("vis_ep")!.statut).toBe("valide");
    expect(m.envois.get("envoi:vis_ep:pinterest:v0")!.statut).toBe("annule");
  });
  it("un envoi pas encore parti chez le diffuseur se retire sans aucun appel", async () => {
    const m = monde("valide");
    const appels: string[] = [];
    const deps: DepsRetrait = {
      client: client(appels),
      reglages: { envoiAutorise: async () => false, envoiCalendrierAutorise: async () => false },
      creneau: async (id) => (m.creneaux.get(id) as never) ?? null,
      envois: async (id) => [...m.envois.values()].filter((e) => e.creneauId === id),
      visuel: async (id) => (m.visuels.get(id) as never) ?? null,
      appliquer: m.appliquer,
      etats: { lire: async () => undefined, noter: async () => undefined },
      maintenant: () => MAINTENANT,
    };
    const r = await retirerProgrammation(deps, "cre_ep");
    expect(r.ok && r.etat).toBe("retire");
    expect(appels).toEqual([]);
    expect(m.creneau().statut).toBe("archive");
  });
});
