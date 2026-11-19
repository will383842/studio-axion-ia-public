/**
 * Une clé d'envoi par créneau quand la clé ancienne appartient déjà à un autre créneau (#1316).
 * Dépôts en mémoire, aucun appel réseau, ids fictifs.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const { reinitialiserDepots, depots } = await import("@/donnees/memoire");
const { ecrireParametre } = await import("@/services/_commun");
const { cleEnvoi, cleEnvoiCreneau } = await import("@/domaine/envoi-planifie");
const { creerEnvoi, resoudreCleEnvoi } = await import("@/services/envois-planifies");
const { envoyerDepuisCreneau } = await import("@/services/envoi-depuis-creneau");
const { etatEnvoiDuCreneau, PREFIXE_ETATS_ENVOI_CALENDRIER } = await import("@/services/branchement-envoi-calendrier");
const { deplacerProgrammation } = await import("@/services/deplacer-programmation");
const { programmerVisuel } = await import("@/services/plan-vers-publication");

const NOW = Date.parse("2026-11-20T08:00:00Z");
const ANCIENNE = cleEnvoi("vis_1", "linkedin", 0);
const T = "2026-11-19T10:00:00Z";
const entree = (extra: Record<string, unknown> = {}) => ({
  id: ANCIENNE, cle: ANCIENNE, videoId: "vis_1", nature: "visuel", creneauId: "cre_A", reseau: "linkedin", versionCreneau: 0, jour: "2026-11-21", heure: "12:00",
  statut: "annule", creeLe: T, modifieLe: T, ...extra,
}) as never;
const demande = (creneauId?: string) => ({ videoId: "vis_1", reseau: "linkedin" as const, versionCreneau: 0, jour: "2026-11-21", heure: "12:00", nature: "visuel" as const, ...(creneauId ? { creneauId } : {}) });

beforeEach(() => reinitialiserDepots());

describe("creerEnvoi : clé par créneau", () => {
  it("(a) ancienne entrée annulée de cre_A : cre_B reçoit sa propre entrée, celle de cre_A reste intacte", async () => {
    const d = depots().envoisPlanifies;
    await d.enregistrer(entree());
    const e = await creerEnvoi(d, demande("cre_B"), T);
    expect(e.statut).toBe("brouillon");
    expect(e.creneauId).toBe("cre_B");
    expect(e.cle).toBe(cleEnvoiCreneau("vis_1", "linkedin", 0, "cre_B"));
    expect(e.cle.endsWith(":cre_B")).toBe(true);
    expect(await d.obtenir(ANCIENNE)).toEqual(entree());
  });

  it("(b) même cas avec une entrée envoyée de cre_A", async () => {
    const d = depots().envoisPlanifies;
    await d.enregistrer(entree({ statut: "envoye", envoyeLe: T }));
    const e = await creerEnvoi(d, demande("cre_B"), T);
    expect(e.statut).toBe("brouillon");
    expect(e.cle.endsWith(":cre_B")).toBe(true);
    expect((await d.obtenir(ANCIENNE))?.statut).toBe("envoye");
  });

  it("stabilité : l'entrée de cre_B garde sa clé propre même si l'entrée ancienne de cre_A disparaît", async () => {
    const d = depots().envoisPlanifies;
    await d.enregistrer(entree());
    const e = await creerEnvoi(d, demande("cre_B"), T);
    const sansAncienne = { obtenir: async (id: string) => (id === ANCIENNE ? null : d.obtenir(id)) };
    expect(await resoudreCleEnvoi(sansAncienne, demande("cre_B"))).toBe(e.cle);
  });

  it("(c) même créneau rejoué : même entrée", async () => {
    const d = depots().envoisPlanifies;
    const a = await creerEnvoi(d, demande("cre_B"), T);
    const b = await creerEnvoi(d, demande("cre_B"), "2026-12-01T00:00:00Z");
    expect(b).toEqual(a);
    expect(await d.compter()).toBe(1);
  });

  it("(c) entrée ancienne du même créneau : clé ancienne ; aucune entrée : clé ancienne ; entrée sans créneau : clé ancienne", async () => {
    const d = depots().envoisPlanifies;
    expect(await resoudreCleEnvoi(d, { videoId: "vis_1", reseau: "linkedin", versionCreneau: 0, creneauId: "cre_A" })).toBe(ANCIENNE);
    await d.enregistrer(entree());
    expect(await resoudreCleEnvoi(d, { videoId: "vis_1", reseau: "linkedin", versionCreneau: 0, creneauId: "cre_A" })).toBe(ANCIENNE);
    expect((await creerEnvoi(d, demande("cre_A"), T)).cle).toBe(ANCIENNE);
    reinitialiserDepots();
    const d2 = depots().envoisPlanifies;
    await d2.enregistrer({ ...(entree() as object), creneauId: undefined } as never);
    expect(await resoudreCleEnvoi(d2, { videoId: "vis_1", reseau: "linkedin", versionCreneau: 0, creneauId: "cre_B" })).toBe(ANCIENNE);
    expect(await resoudreCleEnvoi(d2, { videoId: "vis_1", reseau: "linkedin", versionCreneau: 0 })).toBe(ANCIENNE);
  });
});

describe("envoyerDepuisCreneau : cre_B n'est pas bloqué par cre_A", () => {
  it("brouillon créé avec une clé en …:cre_B et une idempotence différente", async () => {
    const depot = depots().envoisPlanifies;
    await depot.enregistrer(entree());
    const table = new Map<string, string>([[`creation:${ANCIENNE}`, "refuse"], [`essais:${ANCIENNE}`, "2"]]);
    const envoyerReel = vi.fn(async () => undefined);
    const deps = {
      depot,
      creneaux: async () => [{ id: "cre_B", videoId: "vis_1", nature: "visuel", reseau: "linkedin", versionCreneau: 0, jour: "2026-11-21", heure: "12:00", statut: "valide", valideeLe: T, valideePar: "le fondateur", texte: "Texte d'exemple" }],
      client: { lectureExigee: () => false, listerPosts: async () => [] } as never,
      reglages: { envoiAutorise: async () => true, envoiCalendrierAutorise: async () => true, editorialeActive: async () => true },
      maintenant: () => NOW,
      etats: { async lire(c: string) { return table.get(c); }, async noter(c: string, v: string) { table.set(c, v); } },
      notifier: async () => undefined,
      envoyerReel,
    } as never;
    const l = await envoyerDepuisCreneau(deps, "cre_B");
    expect(l?.etat).toBe("brouillon-cree");
    expect(envoyerReel).toHaveBeenCalledTimes(1);
    const arg = (envoyerReel.mock.calls[0] as unknown as [string, { cleEnvoi: string; idempotence: string }])[1];
    expect(arg.cleEnvoi.endsWith(":cre_B")).toBe(true);
    expect(arg.cleEnvoi).not.toBe(ANCIENNE);
    expect(arg.idempotence).not.toBe(`studio-${"0".repeat(64)}`);
    expect(table.get(`creation:${arg.cleEnvoi}`)).toBe("cree");
    expect(table.get(`creation:${ANCIENNE}`)).toBe("refuse");
  });
});

describe("affichage et déplacement : même clé résolue", () => {
  it("un refus noté sur la clé de cre_A n'est pas montré pour cre_B", async () => {
    await depots().envoisPlanifies.enregistrer(entree());
    await ecrireParametre(`${PREFIXE_ETATS_ENVOI_CALENDRIER}dernier-refus-le:${ANCIENNE}`, "2026-11-19T10:00:00Z");
    await ecrireParametre(`${PREFIXE_ETATS_ENVOI_CALENDRIER}dernier-refus:${ANCIENNE}`, "Refus de cre_A");
    const base = { jourVise: "2026-11-21", heuresParReseau: { linkedin: "2026-11-21T11:00:00Z" }, compteCible: "c", visuelId: "vis_1", textes: { linkedin: { texte: "x", premierCommentaire: "" } }, statut: "programme", decalages: 0 };
    expect((await etatEnvoiDuCreneau({ id: "cre_B", ...base } as never, "linkedin")).dernierRefus).toBeUndefined();
    expect((await etatEnvoiDuCreneau({ id: "cre_A", ...base } as never, "linkedin")).dernierRefus?.raison).toBe("Refus de cre_A");
  });

  it("la clé rendue par le déplacement est celle que le tour crée ensuite", async () => {
    const dep = depots().envoisPlanifies;
    const v1 = cleEnvoi("vis_1", "linkedin", 1);
    await dep.enregistrer(entree({ id: v1, cle: v1, versionCreneau: 1 }));
    const vivant = entree({ id: "envoi:vis_1:linkedin:v0:cre_B", cle: "envoi:vis_1:linkedin:v0:cre_B", creneauId: "cre_B", statut: "valide" }) as never as { id: string };
    const heure = "2026-11-21T09:00:00.000Z";
    const creneau = { id: "cre_B", jourVise: "2026-11-21", heuresParReseau: { linkedin: heure }, compteCible: "c", visuelId: "vis_1", statut: "programme", decalages: 0, valideeLe: T, valideePar: "f", textes: { linkedin: { texte: "x", premierCommentaire: "" } } };
    const deps = {
      diffuseur: null,
      reglagesOuverts: async () => true,
      creneau: async () => creneau,
      envois: async () => [vivant],
      envoiParCle: (cle: string) => dep.obtenir(cle),
      visuel: async () => ({ id: "vis_1", statut: "programme" }),
      appliquer: async () => undefined,
      niveau: async () => ({ niveau: "libre" }),
      publicationsDeCles: async () => [],
      etats: { lire: async () => undefined, noter: async () => undefined },
      notifier: async () => undefined,
      maintenant: () => new Date(NOW),
    } as never;
    const r = await deplacerProgrammation(deps, { creneauId: "cre_B", nouveauJour: "2026-11-22", cle: "k1" });
    expect(r.ok).toBe(true);
    const attendu = await resoudreCleEnvoi(dep, { videoId: "vis_1", reseau: "linkedin", versionCreneau: 1, creneauId: "cre_B" });
    expect(attendu).toBe(cleEnvoiCreneau("vis_1", "linkedin", 1, "cre_B"));
    expect(r.ok && r.nouvellesCles).toEqual([attendu]);
  });
});

describe("Publication du créneau (programmerVisuel)", () => {
  async function monde(avecEnvoisPlanifies: boolean) {
    const d = depots();
    await d.visuels.enregistrer({ id: "vis_1", statut: "valide", titre: "Carrousel", reseaux: ["linkedin"] } as never);
    await d.creneauxEditoriaux.enregistrer({
      id: "cre_B", jourVise: "2026-11-21", heuresParReseau: { linkedin: "2026-11-21T11:00:00Z" }, compteCible: "compte-studio", visuelId: "vis_1",
      textes: { linkedin: { texte: "Légende", premierCommentaire: "" } }, statut: "valide", decalages: 0, valideeLe: T, valideePar: "le fondateur",
    } as never);
    return { creneaux: d.creneauxEditoriaux, journal: d.journalDecalages, publications: d.publications, visuels: d.visuels, ...(avecEnvoisPlanifies ? { envoisPlanifies: d.envoisPlanifies } : {}) } as never;
  }

  it("la Publication de cre_B porte la même clé résolue que l'envoi (pas celle de cre_A)", async () => {
    await depots().envoisPlanifies.enregistrer(entree());
    const pubs = await programmerVisuel(await monde(true), "cre_B", T);
    expect(pubs.map((p) => p.id)).toEqual([`pub_${cleEnvoiCreneau("vis_1", "linkedin", 0, "cre_B")}`]);
  });

  it("une Publication active déjà chez le diffuseur pour ce média n'est pas doublée", async () => {
    await depots().envoisPlanifies.enregistrer(entree());
    await depots().publications.enregistrer({ id: `pub_${ANCIENNE}`, visuelId: "vis_1", reseau: "linkedin", statut: "programmee", via: "manuel", date: "2026-11-21T11:00:00Z", texte: "t", creeLe: T, modifieLe: T } as never);
    const pubs = await programmerVisuel(await monde(true), "cre_B", T);
    expect(pubs).toHaveLength(1);
    expect(pubs[0].id).toBe(`pub_${ANCIENNE}`);
    expect(await depots().publications.compter((p) => p.visuelId === "vis_1")).toBe(1);
  });
});
