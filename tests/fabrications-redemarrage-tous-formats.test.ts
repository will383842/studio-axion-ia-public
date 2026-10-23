/**
 * Mise en ligne, trou 4 (Will, 18/10) : après le redémarrage d'une mise en ligne, les fabrications repartent-elles
 * SEULES, pour tous les générateurs ? Le test PARCOURT LE REGISTRE et simule un redémarrage du studio (mémoire du
 * processus perdue : appels en vol, premier tour ; la base, elle, reste) à trois moments :
 *   A. le travail attend dans la file (`en_file`, une autre vidéo tient la seule place) ;
 *   B. le travail est `en_cours` avec un appel au fournisseur EN VOL (délai dépassé) : le processus meurt avec lui ;
 *   C. le travail est `en_cours`, « en attente de crédit » (reprise programmée).
 * Après le redémarrage, seuls des tours de la boucle de fond (aucun geste de Will) doivent le mener à « termine ».
 * Moteur DOUBLE (aucune dépense). Ce qui repart et ce qui ne repart pas : docs/formats/AJOUTER-UN-FORMAT.md, § 5.
 */
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { CommandeFabrication, Travail } from "@/domaine/types";
import type { MoteurVideo } from "@/moteurs";
import { mockHeaders, mockNavigation, reinitialiserRequete } from "./helpers/next-mocks";
import { preparerMotDePasse } from "./helpers/g1a";

vi.mock("next/headers", () => mockHeaders);
vi.mock("next/navigation", () => mockNavigation);

const { reinitialiserDepots, depots } = await import("@/donnees/memoire");
const auth = await import("@/services/auth");
const fabrication = await import("@/services/fabrication");
const boucle = await import("@/services/boucle");
const { ecrireParametre } = await import("@/services/_commun");
const { listerFormats } = await import("@/formats");
const { moteurSimulation } = await import("@/moteurs/simulation");

const MDP = "essai-redemarrage-123";
beforeAll(() => preparerMotDePasse(MDP));
beforeEach(async () => {
  reinitialiserDepots();
  reinitialiserRequete();
  await auth.seConnecter(MDP, false);
});
afterEach(() => {
  boucle.arreterBoucle();
  vi.useRealTimers();
});

const FORMATS = listerFormats({ inclureMasques: true, inclureReservesAWill: true });

type Panne = "aucune" | "en-vol" | "credit";

/**
 * Moteur double, appels comptés PAR TRAVAIL (la boucle avance aussi les travaux d'exemple) : au 2e appel, `panne` (appel
 * qui ne revient jamais / crédit épuisé), puis des appels jusqu'au 4e, qui termine.
 */
function moteurDouble(panne: Panne, appels = new Map<string, number>()): MoteurVideo {
  return {
    ...moteurSimulation,
    id: "double-redemarrage",
    async avancer(t: Travail) {
      const n = (appels.get(t.id) ?? 0) + 1;
      appels.set(t.id, n);
      if (n === 2 && panne === "en-vol") return new Promise(() => undefined); // le processus mourra avec lui
      if (n === 2 && panne === "credit") throw Object.assign(new Error("Crédit insuffisant"), { code: "quota", reessayable: false });
      if (n < 4) return { travail: { ...t, statut: "en_cours", etapes: t.etapes.map((e, i) => (i === 0 ? { ...e, statut: "en_cours" as const, progression: 40 } : e)) } };
      return { travail: { ...t, statut: "termine", progression: 100, termineLe: new Date().toISOString(), etapes: t.etapes.map((e) => ({ ...e, statut: "terminee" as const, progression: 100 })) } };
    },
  };
}

async function fabricationEnFile(videoId: string, formatId: string, moteurId: string): Promise<string> {
  const d = depots();
  await d.videos.modifier(videoId, { estDemo: false });
  const { travailId } = await fabrication.lancerFabrication(videoId, { confirme: true });
  const t = (await d.travaux.obtenir(travailId))!;
  await d.travaux.enregistrer({ ...t, estDemo: false });
  const version = (await d.versions.obtenir(t.versionId!))!;
  const commande: CommandeFabrication = { ...version.commande, formatId, moteurId };
  await d.versions.modifier(version.id, { commande, estDemo: false });
  return travailId;
}

/** Le processus du studio meurt et redémarre : sa mémoire est perdue, la base reste. */
function redemarrer() {
  boucle.avancementsEnVol().clear();
  boucle.simulerRedemarragePourEssai();
}

async function tours(n: number, moteur: MoteurVideo) {
  for (let i = 0; i < n; i++) {
    await boucle.contenuDuTour({ choisirMoteur: () => moteur, delai: () => 20 });
    vi.setSystemTime(Date.now() + 61 * 60_000);
  }
}

const statut = async (id: string) => (await depots().travaux.obtenir(id))!.statut;

describe("Redémarrage d'une mise en ligne : les fabrications repartent seules (registre parcouru)", () => {
  it.each(FORMATS.map((f) => [f.id, f.moteur]))("%s (moteur %s) : en file avant le redémarrage → repart seule et finit", async (formatId, moteurId) => {
    vi.useFakeTimers({ toFake: ["Date"] });
    await ecrireParametre("fabrication.concurrence", 1);
    // Une autre vidéo tient la seule place ; la nôtre, lancée une seconde après, attend dans la file.
    const devant = await fabricationEnFile("v-03", formatId, moteurId);
    vi.setSystemTime(Date.now() + 1_000);
    const id = await fabricationEnFile("v-04", formatId, moteurId);
    const appels = new Map<string, number>();
    await tours(2, moteurDouble("aucune", appels));
    expect(await statut(devant)).toBe("en_cours");
    expect(await statut(id)).toBe("en_file");
    redemarrer();
    for (let i = 0; i < 12 && (await statut(id)) !== "termine"; i++) await tours(1, moteurDouble("aucune", appels));
    expect(await statut(devant)).toBe("termine");
    expect(await statut(id)).toBe("termine");
  });

  it.each(FORMATS.map((f) => [f.id, f.moteur]))("%s (moteur %s) : appel en vol perdu au redémarrage → repris, finit", async (formatId, moteurId) => {
    vi.useFakeTimers({ toFake: ["Date"] });
    const id = await fabricationEnFile("v-04", formatId, moteurId);
    const appels = new Map<string, number>();
    const moteur = moteurDouble("en-vol", appels);
    await tours(2, moteur);
    expect(boucle.avancementsEnVol().has(id)).toBe(true);
    expect(await statut(id)).toBe("en_cours");
    redemarrer();
    await tours(4, moteur);
    expect(appels.get(id)).toBeGreaterThanOrEqual(4);
    expect(await statut(id)).toBe("termine");
  });

  it.each(FORMATS.map((f) => [f.id, f.moteur]))("%s (moteur %s) : en attente de crédit au redémarrage → reprend seule à l'essai suivant", async (formatId, moteurId) => {
    vi.useFakeTimers({ toFake: ["Date"] });
    const id = await fabricationEnFile("v-04", formatId, moteurId);
    const moteur = moteurDouble("credit");
    await boucle.contenuDuTour({ choisirMoteur: () => moteur, delai: () => 20 });
    await boucle.contenuDuTour({ choisirMoteur: () => moteur, delai: () => 20 });
    const t = (await depots().travaux.obtenir(id))!;
    expect(t.statut).toBe("en_cours");
    expect(t.reprise?.motif).toBe("credit");
    redemarrer();
    await tours(4, moteur);
    expect(await statut(id)).toBe("termine");
  });
});
