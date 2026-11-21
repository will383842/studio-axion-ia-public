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
vi.setConfig({ testTimeout: 120_000 });

const { reinitialiserDepots } = await import("@/donnees/memoire");
const auth = await import("@/services/auth");
const { construireCommande } = await import("@/services/fabrication");
const { listerMoteurs } = await import("@/moteurs");
const { defautsDeSorties, testerGenerateur } = await import("@/moteurs/conformite");
const { creerMoteurTutorielOutil } = await import("@/moteurs/montage-tutoriel-outil");
const { creerMoteurMontageDemoFacecam } = await import("@/moteurs/montage-demo-facecam");
const { creerMoteurMontageImageVideo } = await import("@/moteurs/montage-image-video");
const { creerMoteurMontageFacecam } = await import("@/moteurs/montage-facecam");
const { creerMoteurMontageFacecamAnimee } = await import("@/moteurs/montage-facecam-animee");
const { creerMoteurVideoLongue } = await import("@/moteurs/montage-video-longue");
const { creerMoteurDonnees } = await import("@/moteurs/montage-donnees");
const { carteFixe, monde, outilsSimules } = await import("./../image-video/doubles-fabrication");
const { banc: bancCas } = await import("./../cas-concret/moteur/doubles");
const { banc: bancTableau } = await import("./../tableau/moteur/doubles");
const { ficheDemonstration } = await import("./../tableau/regles/exemples");
const { commandeTutoriel, outilsDoubles, une } = await import("./../tutoriel-outil/doubles");

import type { CommandeFabrication, Ratio } from "@/domaine/types";
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

/** Exceptions datées : (moteur, contrôle, 15/11/2026). Chaque motif dit le manque exact de l'EXISTANT (fichier:ligne), jamais un manque du test. */
const EXCEPTIONS: ExceptionConformite[] = [
  { moteur: "simulation", controle: "pause-sans-fournisseur", date: "15/11/2026", motif: "structurel : le moteur n'appelle aucun fournisseur (simulation.ts:112, fournisseurUtilise « simulation »), il n'a donc aucun état « sans fournisseur » à retirer" },
  { moteur: "montage-avocat", controle: "pause-sans-fournisseur", date: "15/11/2026", motif: "sans service injecté, voix, rendu et aligneur retombent sur le simulé (montage-avocat/index.ts:214-229, « Absent : … sinon simulé ») : aucun état « sans fournisseur » ; le refus de la voix d'essai est au lancement réel (MESSAGE_VOIX_ESSAI)" },
  { moteur: "montage-facecam", controle: "pause-sans-fournisseur", date: "15/11/2026", motif: "sans chaîne (chaine rend null) le squelette avance à l'horloge au lieu de rester en pause (montage-facecam/index.ts:33-44, 225-226) ; le refus est posé par refusAuLancement" },
  { moteur: "montage-facecam-animee", controle: "pause-sans-fournisseur", date: "15/11/2026", motif: "sans prise, le squelette avance à l'horloge au lieu de rester en pause ; avec prise et sans outils, le travail passe en échec FACECAM_ANIMEE_NON_RELIE (montage-facecam-animee/index.ts:380)" },
  { moteur: "montage-tableau", controle: "pause-sans-fournisseur", date: "15/11/2026", motif: "sans outils reliés, le travail passe en échec TABLEAU_NON_RELIE au lieu de rester en pause (montage-tableau/index.ts:715)" },
  { moteur: "montage-cas-concret", controle: "pause-sans-fournisseur", date: "15/11/2026", motif: "sans outils reliés, le travail passe en échec au lieu de rester en pause (montage-cas-concret/index.ts, même patron que le tableau)" },
  { moteur: "montage-image-video", controle: "pause-sans-fournisseur", date: "15/11/2026", motif: "sans outils reliés, le travail passe en échec réessayable IV_NON_RELIE au lieu de rester en pause (montage-image-video/index.ts:448-450)" },
  { moteur: "montage-facecam", controle: "sortie-conforme", date: "15/11/2026", motif: "moteur squelette : la sortie porte une clé /demo/ hors simulation" },
  { moteur: "montage-facecam-animee", controle: "sortie-conforme", date: "15/11/2026", motif: "moteur squelette : la sortie porte une clé /demo/ hors simulation" },
  { moteur: "montage-image-video", controle: "contrat-commun", date: "15/11/2026", motif: "manques du moteur face au contrat (contrat.ts:81, 95, 124) : la brique « son » coupée garde l'étape et la ligne « Voix » (la voix est obligatoire) ; estimerRetouche rend 0 € (montage-image-video/index.ts:414-416) ; un échec d'étape simulé (simulerEchecEtape) n'est pas pris en charge par la machine" },
  { moteur: "montage-demo-facecam", controle: "contrat-commun", date: "15/11/2026", motif: "les doubles de la chaîne (transcription, alignement, plan, rendu) sont définis DANS src/moteurs/montage-demo-facecam/demo-facecam.test.ts:25-117, non exportés ; sans chaîne le travail reste en_file (index.ts:155) : le contrat ne peut pas le mener à « termine »" },
  { moteur: "montage-demo-facecam", controle: "origine-usine", date: "15/11/2026", motif: "mêmes doubles de chaîne non exportés (demo-facecam.test.ts:25-117) : sans chaîne, le travail reste en_file" },
  { moteur: "montage-demo-facecam", controle: "sortie-conforme", date: "15/11/2026", motif: "mêmes doubles de chaîne non exportés (demo-facecam.test.ts:25-117) : sans chaîne, aucune sortie" },
]

const depuisV03 = (formatId: string, moteurId: string, ratios: Ratio[] = ["9:16"]) => async (): Promise<CommandeFabrication> => {
  const c = await construireCommande("v-03");
  return { ...c, formatId, moteurId, ratios };
};

/** Image → vidéo sur les doubles de `tests/image-video/doubles-fabrication.ts` (monde simulé), réglage « automatique » : aucune porte de Will. */
const carteIV = carteFixe("C");
const outilsIV = outilsSimules(carteIV, monde());
const moteurImageVideo = creerMoteurMontageImageVideo({ outils: async () => outilsIV, numeroVersion: async () => 42 });
async function commandeImageVideo(): Promise<CommandeFabrication> {
  const c = await depuisV03("image-video", "montage-image-video")();
  return {
    ...c,
    dureeCibleSec: 50,
    entrees: { imageVideo: { imageCle: carteIV.image.cle, empreinte: carteIV.image.empreinte, plafondCentimes: 5000, codeSuivi: "essai", accordEssaiReel: true } },
    reglages: { validationCarte: "automatique" },
    budgetMax: { centimes: 5000, devise: "EUR" },
  } as CommandeFabrication;
}

const casSans = bancCas({ relie: false });
const tableauSans = bancTableau(ficheDemonstration, null);
// 17/11 (Williams) : sans choix, aucune fin ; le contrat (retouche moins chère que la vidéo entière, sorties) suppose plusieurs fins : « Avec le mot » + mot branché les rétablissent.
const cas = bancCas({ avecMot: true, motSur: ["facebook", "instagram"] });
const tableau = bancTableau(ficheDemonstration);
const tutoriel = creerMoteurTutorielOutil({ outils: une(outilsDoubles({ voix: [], claude: [], rendus: [] })) });

/** Vidéo longue sur des doubles (voix et montage simulés : aucun appel réel, 0 €), script de 3 chapitres. */
const chapitreVL = (n: number) => ({ id: `c${n}`, titre: `Chapitre ${n}`, texte: Array.from({ length: 40 }, (_, i) => `mot${n}x${i}`).join(" ") + "." });
const doublesVL = {
  voix: {
    lire: async (m: { texte: string }) => {
      const mots = m.texte.split(/\s+/).filter(Boolean).map((mot, i) => ({ mot, debutSec: i * 0.4, finSec: i * 0.4 + 0.35 }));
      return { dureeSec: mots.length * 0.4, mots };
    },
  },
  monter: async (ratio: string) => ({ fichierCle: `essai/video-longue/${ratio.replace(":", "x")}.mp4` }),
};
const moteurVideoLongue = creerMoteurVideoLongue(() => doublesVL as never);
async function commandeVideoLongue(): Promise<CommandeFabrication> {
  const c = await depuisV03("video-longue", "montage-video-longue", ["16:9"])();
  return { ...c, entrees: { ...c.entrees, videoLongue: { chapitres: [chapitreVL(1), chapitreVL(2), chapitreVL(3)] } } };
}

/** Tableau de bord (G4-09b) sur des doubles : donnée fictive, variante muette, montage simulé (aucun appel réel, 0 €). */
const donneeTB = {
  version: "tableau-de-bord.v1",
  titre: "Tableau exemple",
  periode: { debut: "2026-01-01", fin: "2026-03-31", libelle: "premier trimestre exemple" },
  source: "Outil exemple",
  indicateurs: [
    { id: "ca-fevrier", libelle: "Chiffre d'affaires de février", valeur: 10200, unite: "€", precision: 0, sens: "hausse-bonne" },
    { id: "ca-mars", libelle: "Chiffre d'affaires de mars", valeur: 12480, unite: "€", precision: 0, sens: "hausse-bonne" },
    { id: "visites", libelle: "Visites du site", valeur: 3450, unite: "visites", precision: 0, sens: "hausse-bonne" },
  ],
  series: [],
  comparaisons: [{ avant: "ca-fevrier", apres: "ca-mars" }],
  alertes: [],
  calculs: [],
};
const moteurDonnees = creerMoteurDonnees(() => ({ monter: async (ratio: string) => ({ fichierCle: `essai/donnees/${ratio.replace(":", "x")}.mp4` }) }));
async function commandeDonnees(): Promise<CommandeFabrication> {
  const c = await depuisV03("tableau-de-bord", "montage-donnees", ["4:5", "9:16", "1:1", "16:9"])();
  return { ...c, entrees: { ...c.entrees, montageDonnees: { donnee: donneeTB, muette: true } } };
}

interface Cas {
  /** Le moteur câblé sur les doubles (celui du registre n'a pas d'outils dans un test). Absent : celui du registre. */
  moteur?: MoteurVideo;
  fabriquer: () => Promise<CommandeFabrication>;
  sansPrix?: boolean;
  sansFournisseur?: () => MoteurVideo;
}

const CAS: Record<string, Cas> = {
  simulation: { fabriquer: async () => construireCommande("v-03") },
  "montage-avocat": { fabriquer: async () => construireCommande("v-03") },
  "montage-facecam": { fabriquer: depuisV03("facecam", "montage-facecam"), sansPrix: true, sansFournisseur: () => creerMoteurMontageFacecam({ chaine: () => null }) },
  "montage-facecam-animee": { fabriquer: depuisV03("facecam-animee", "montage-facecam-animee"), sansPrix: true, sansFournisseur: () => creerMoteurMontageFacecamAnimee({ outils: async () => undefined as never }) },
  "montage-tableau": { moteur: tableau.moteur, fabriquer: async () => tableau.commande(ficheDemonstration), sansPrix: true, sansFournisseur: () => tableauSans.moteur },
  "montage-cas-concret": { moteur: cas.moteur, fabriquer: async () => cas.commande(), sansFournisseur: () => casSans.moteur },
  "montage-tutoriel-outil": { moteur: tutoriel, fabriquer: async () => commandeTutoriel(), sansPrix: true, sansFournisseur: () => creerMoteurTutorielOutil({ outils: async () => null }) },
  "montage-demo-facecam": { fabriquer: depuisV03("demo-facecam", "montage-demo-facecam", ["4:5", "9:16", "1:1", "16:9"]), sansPrix: true, sansFournisseur: () => creerMoteurMontageDemoFacecam({ chaine: () => null }) },
  "montage-video-longue": { moteur: moteurVideoLongue, fabriquer: commandeVideoLongue, sansPrix: true, sansFournisseur: () => creerMoteurVideoLongue(() => null) },
  "montage-donnees": { moteur: moteurDonnees, fabriquer: commandeDonnees, sansPrix: true, sansFournisseur: () => creerMoteurDonnees(() => null) },
  "montage-image-video": { moteur: moteurImageVideo, fabriquer: async () => commandeImageVideo(), sansFournisseur: () => creerMoteurMontageImageVideo({ outils: async () => undefined as never }) },
};

for (const moteur of listerMoteurs()) {
  const c = CAS[moteur.id];
  if (!c) {
    describe(`conformité — ${moteur.id}`, () => it("moteur sans commande fabriquée par doubles : à ajouter ici", () => expect.fail(`aucun cas pour « ${moteur.id} »`)));
    continue;
  }
  testerGenerateur(c.moteur ?? moteur, c.fabriquer, { sansPrix: c.sansPrix, exceptions: EXCEPTIONS, moteurSansFournisseur: c.sansFournisseur });
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
