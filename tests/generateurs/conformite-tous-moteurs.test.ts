/**
 * G1-02 : conformité de TOUS les moteurs inscrits (`listerMoteurs()`), par `testerGenerateur` (src/moteurs/conformite.ts),
 * sur des doubles (aucun fournisseur, aucun appel à Claude, aucune dépense). Les manques de l'existant sont des
 * exceptions DATÉES, écrites en dur ci-dessous ; un moteur neuf n'en a aucune. Preuve de refus : moteur factice.
 */
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { mockHeaders, mockNavigation, reinitialiserRequete } from "../helpers/next-mocks";
import { preparerMotDePasse } from "../helpers/g1a";

vi.mock("next/headers", () => mockHeaders);
vi.mock("next/navigation", () => mockNavigation);

const { reinitialiserDepots } = await import("@/donnees/memoire");
const auth = await import("@/services/auth");
const { construireCommande } = await import("@/services/fabrication");
const { listerMoteurs } = await import("@/moteurs");
const { defautsDeSorties, testerGenerateur } = await import("@/moteurs/conformite");
const { creerMoteurMontageCasConcret } = await import("@/moteurs/montage-cas-concret");
const { creerMoteurMontageTableau } = await import("@/moteurs/montage-tableau");
const { creerMoteurTutorielOutil } = await import("@/moteurs/montage-tutoriel-outil");
const { creerMoteurMontageDemoFacecam } = await import("@/moteurs/montage-demo-facecam");
const { creerMoteurMontageImageVideo } = await import("@/moteurs/montage-image-video");
const { banc: bancCas } = await import("./../cas-concret/moteur/doubles");
const { banc: bancTableau } = await import("./../tableau/moteur/doubles");
const { ficheDemonstration } = await import("./../tableau/regles/exemples");
const { commandeTutoriel, outilsDoubles, une } = await import("./../tutoriel-outil/doubles");

import type { CommandeFabrication } from "@/domaine/types";
import type { MoteurVideo, SortieProduite } from "@/moteurs/types";
import type { ExceptionConformite } from "@/moteurs/conformite";

const MDP = "essai-g1-02-conformite";

beforeAll(async () => {
  await preparerMotDePasse(MDP);
});
beforeEach(async () => {
  reinitialiserDepots();
  reinitialiserRequete();
  await auth.seConnecter(MDP, false);
});

/** Exceptions datées : (moteur, contrôle, date). Remplies après le premier passage sur `master` ; vides = tout conforme. */
const EXCEPTIONS: ExceptionConformite[] = [];

const depuisV03 = (formatId: string, moteurId: string, ratios: ("9:16")[] = ["9:16"]) => async (): Promise<CommandeFabrication> => {
  const c = await construireCommande("v-03");
  return { ...c, formatId, moteurId, ratios };
};

const casSans = bancCas({ relie: false });
const tableauSans = bancTableau(ficheDemonstration, null);
const cas = bancCas();
const tableau = bancTableau(ficheDemonstration);
const tutoriel = creerMoteurTutorielOutil({ outils: une(outilsDoubles({ voix: [], claude: [], rendus: [] })) });

interface Cas {
  fabriquer: () => Promise<CommandeFabrication>;
  sansPrix?: boolean;
  sansFournisseur?: () => MoteurVideo;
}

const CAS: Record<string, Cas> = {
  simulation: { fabriquer: async () => construireCommande("v-03") },
  "montage-avocat": { fabriquer: async () => construireCommande("v-03") },
  "montage-facecam": { fabriquer: depuisV03("facecam", "montage-facecam"), sansPrix: true },
  "montage-facecam-animee": { fabriquer: depuisV03("facecam-animee", "montage-facecam-animee"), sansPrix: true },
  "montage-tableau": { fabriquer: async () => tableau.commande(ficheDemonstration), sansPrix: true, sansFournisseur: () => tableauSans.moteur },
  "montage-cas-concret": { fabriquer: async () => cas.commande(), sansFournisseur: () => casSans.moteur },
  "montage-tutoriel-outil": { fabriquer: async () => commandeTutoriel(), sansPrix: true, sansFournisseur: () => creerMoteurTutorielOutil({ outils: async () => null }) },
  "montage-demo-facecam": { fabriquer: async () => commandeTutoriel() },
  "montage-image-video": { fabriquer: async () => commandeTutoriel() },
};
void creerMoteurMontageCasConcret;
void creerMoteurMontageTableau;
void creerMoteurMontageDemoFacecam;
void creerMoteurMontageImageVideo;
void tutoriel;

for (const moteur of listerMoteurs()) {
  const c = CAS[moteur.id];
  if (!c) {
    describe(`conformité — ${moteur.id}`, () => it("moteur sans commande fabriquée par doubles : à ajouter ici", () => expect.fail(`aucun cas pour « ${moteur.id} »`)));
    continue;
  }
  testerGenerateur(moteur, c.fabriquer, { sansPrix: c.sansPrix, exceptions: EXCEPTIONS, moteurSansFournisseur: c.sansFournisseur });
}

describe("refus d'un moteur non conforme (preuve)", () => {
  const sortie = (plus: Partial<SortieProduite> = {}): SortieProduite =>
    ({ ratio: "9:16", fichierCle: "videos/v/9x16.mp4", vignetteCle: "videos/v/9x16.jpg", resolution: "1080x1920", dureeSec: 30, taille: 1, rapportQualite: {}, reseaux: ["tiktok"], ...plus }) as unknown as SortieProduite;

  it("une sortie conforme n'a aucun défaut", () => expect(defautsDeSorties([sortie()])).toEqual([]));
  it("une résolution fausse est refusée", () => {
    expect(defautsDeSorties([sortie({ resolution: "1920x1080" })]).join()).toMatch(/incohérente/);
    expect(defautsDeSorties([sortie({ resolution: "grande" })]).join()).toMatch(/LxH/);
  });
  it("une clé /demo/ est refusée hors simulation, permise en simulation", () => {
    expect(defautsDeSorties([sortie({ fichierCle: "videos/demo/x.mp4" })]).join()).toMatch(/démonstration/);
    expect(defautsDeSorties([sortie({ fichierCle: "videos/demo/x.mp4" })], { simulation: true })).toEqual([]);
  });
  it("durée nulle, doublon, réseau inconnu et durée au-dessus du maximum du réseau sont refusés", () => {
    expect(defautsDeSorties([sortie({ dureeSec: 0 })]).join()).toMatch(/> 0/);
    expect(defautsDeSorties([sortie(), sortie()]).join()).toMatch(/double/);
    expect(defautsDeSorties([sortie({ reseaux: ["inconnu" as never] })]).join()).toMatch(/inconnu/);
    expect(defautsDeSorties([sortie({ dureeSec: 99_999 })]).join()).toMatch(/maximum/);
  });
  it("l'accroche controlesEnPlus (N-07) s'ajoute aux contrôles", () => {
    expect(defautsDeSorties([sortie()], { controlesEnPlus: [() => ["zone sûre"]] })).toEqual(["zone sûre"]);
  });
});
