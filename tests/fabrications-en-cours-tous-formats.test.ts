/**
 * Mise en ligne, trou 3 (Will, 18/10) : `mettre-a-jour.sh` n'attend que les travaux au statut `en_cours`. Une fabrication
 * payante doit donc être `en_cours` en base du PREMIER appel payant à la fin, sans aucun creux : ni `en_file`, ni un
 * autre statut pendant une attente du fournisseur (rendu HeyGen, voix), une panne passagère, un crédit épuisé ou un
 * appel qui dépasse son délai.
 *
 * Le test PARCOURT LE REGISTRE (`listerFormats`, masqués et formats d'essai compris) : un générateur ajouté demain y passe
 * sans rien écrire ici. Pour chaque format, la VRAIE boucle de fond (`contenuDuTour`) mène une fabrication avec un moteur
 * DOUBLE (aucune dépense) qui rejoue tous les schémas vus chez les moteurs réels :
 *   1. premier appel payant (la voix, Claude) alors que le travail sortait de la file ;
 *   2. le moteur renvoie `en_file` tant que ses étapes n'ont pas commencé (simulation, avocat, facecam…) ;
 *   3. un appel qui dépasse son délai (lecture de voix longue) : il continue, son résultat est écrit plus tard ;
 *   4. une panne passagère du fournisseur (503) ; 5. un crédit épuisé (« en attente de crédit ») ;
 *   6. trois tours d'attente d'un rendu chez le fournisseur ; 7. la fin.
 * À CHAQUE appel du moteur (donc à chaque dépense possible) et après CHAQUE tour, le travail doit être `en_cours`.
 * Règle documentée : docs/formats/AJOUTER-UN-FORMAT.md, § « Mise en ligne ».
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
const { listerFormats } = await import("@/formats");
const { moteurExiste } = await import("@/moteurs/ids");
const { moteurSimulation } = await import("@/moteurs/simulation");

const MDP = "essai-en-cours-123";
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

/**
 * Moteur double : chaque appel à `avancer` est une dépense possible ; il note le statut EN BASE à ce moment-là. Appels
 * comptés pour LE travail suivi (la boucle avance aussi les travaux d'exemple, qui finissent aussitôt).
 */
function moteurDouble(id: () => string, vus: string[]): MoteurVideo {
  let appel = 0;
  const avec = (t: Travail, statut: Travail["statut"], etape: "en_attente" | "en_cours" | "terminee"): Travail => ({
    ...t,
    statut,
    etapes: t.etapes.map((e, i) => (i === 0 ? { ...e, statut: etape, progression: etape === "terminee" ? 100 : 50 } : e)),
  });
  return {
    ...moteurSimulation,
    id: "double-en-cours",
    async avancer(t: Travail) {
      if (t.id !== id()) return { travail: { ...t, statut: "termine", progression: 100, termineLe: new Date().toISOString() } };
      vus.push((await depots().travaux.obtenir(t.id))?.statut ?? "absent");
      appel++;
      switch (appel) {
        case 1: // voix demandée au fournisseur, rien de commencé de son point de vue : le moteur dit « en_file »
          return { travail: avec(t, "en_file", "en_attente") };
        case 2: // lecture longue : dépasse le délai du tour, finit plus tard (voix payée)
          await new Promise((ok) => setTimeout(ok, 60));
          return { travail: avec(t, "en_cours", "en_cours") };
        case 3:
          throw Object.assign(new Error("HeyGen 503"), { reessayable: true });
        case 4:
          throw Object.assign(new Error("Crédit insuffisant"), { code: "quota", reessayable: false });
        case 5:
        case 6:
        case 7: // rendu en cours chez le fournisseur
          return { travail: avec(t, "en_cours", "en_cours") };
        default:
          return { travail: { ...t, statut: "termine", progression: 100, termineLe: new Date().toISOString(), etapes: t.etapes.map((e) => ({ ...e, statut: "terminee" as const, progression: 100 })) } };
      }
    },
  };
}

/** Une fabrication réelle (pas un exemple) du format, en file, prête pour la boucle. */
async function fabricationEnFile(formatId: string, moteurId: string): Promise<string> {
  const d = depots();
  await d.videos.modifier("v-04", { estDemo: false });
  const { travailId } = await fabrication.lancerFabrication("v-04", { confirme: true });
  const t = (await d.travaux.obtenir(travailId))!;
  await d.travaux.enregistrer({ ...t, estDemo: false });
  const version = (await d.versions.obtenir(t.versionId!))!;
  const commande: CommandeFabrication = { ...version.commande, formatId, moteurId };
  await d.versions.modifier(version.id, { commande, estDemo: false });
  expect((await d.travaux.obtenir(travailId))!.statut).toBe("en_file");
  return travailId;
}

describe("Mise en ligne : toute fabrication payante reste `en_cours` du premier appel à la fin (registre parcouru)", () => {
  it("le registre n'est pas vide et chaque format fabrique par un moteur inscrit (donc par la boucle de fond)", () => {
    expect(FORMATS.length).toBeGreaterThan(5);
    for (const f of FORMATS) expect(moteurExiste(f.moteur), `${f.id} : moteur « ${f.moteur} » non inscrit (src/moteurs/ids.ts)`).toBe(true);
  });

  it.each(FORMATS.map((f) => [f.id, f.moteur]))("%s (moteur %s) : `en_cours` à chaque appel payant et après chaque tour", async (formatId, moteurId) => {
    vi.useFakeTimers({ toFake: ["Date"] });
    const id = await fabricationEnFile(formatId, moteurId);
    const vus: string[] = [];
    const apresTour: string[] = [];
    const moteur = moteurDouble(() => id, vus);
    const options = { choisirMoteur: () => moteur, delai: () => 20 };
    for (let i = 0; i < 20; i++) {
      await boucle.contenuDuTour(options);
      // Appel en vol (délai dépassé) : son résultat est écrit à son retour.
      await Promise.all([...boucle.avancementsEnVol().values()]);
      const t = (await depots().travaux.obtenir(id))!;
      if (t.statut === "termine") break;
      apresTour.push(t.statut);
      // Au-delà de la prochaine reprise programmée (panne : quelques minutes ; crédit : une heure), jamais 24 h.
      vi.setSystemTime(Date.now() + 61 * 60_000);
    }
    expect((await depots().travaux.obtenir(id))!.statut, `${formatId} : la fabrication n'est pas allée au bout`).toBe("termine");
    expect(vus.length).toBeGreaterThanOrEqual(8);
    expect(vus.filter((s) => s !== "en_cours"), `${formatId} : appels payants faits hors « en_cours » : ${vus.join(", ")}`).toEqual([]);
    expect(apresTour.filter((s) => s !== "en_cours"), `${formatId} : creux entre deux tours : ${apresTour.join(", ")}`).toEqual([]);
  });
});
