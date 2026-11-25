/**
 * P7 (25/11) : TO_PIECE_A_CONSTRUIRE et TO_PIECE_A_REVOIR sont des pauses légitimes du tutoriel : elles ne finissent plus
 * en PANNE_SANS_NOUVELLE. TO_DOSSIER_INCOMPLET reste NON exemptée (audit sécurité + décision du chef : aucune issue, place
 * de fabrication gardée, zip retéléchargé à chaque tour) et tombe toujours en panne réessayable. Les cinq pauses déjà
 * exemptées le restent ; un code inconnu tombe toujours.
 * Jeu de données : aucune vidéo de format tutoriel-outil dans la démo (src/donnees/memoire/demo.ts) ; on garde v-04 (avocat),
 * la garde ne regardant pas le format.
 * Aucun appel payant : moteur de simulation immobile, dépôts en mémoire, horloge simulée.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { hash } from "@node-rs/argon2";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { MoteurVideo } from "@/moteurs";
import type { Travail } from "@/domaine/types";
import { mockHeaders, mockNavigation, reinitialiserRequete } from "../helpers/next-mocks";

vi.mock("next/headers", () => mockHeaders);
vi.mock("next/navigation", () => mockNavigation);

const { reinitialiserDepots, depots } = await import("@/donnees/memoire");
const auth = await import("@/services/auth");
const fabrication = await import("@/services/fabrication");
const boucle = await import("@/services/boucle");
const { moteurSimulation } = await import("@/moteurs/simulation");

const MDP = "p7-pauses-exemptees";
const MIN = 60_000;
const ANCIENNES = ["TO_DEVIS_A_ACCEPTER", "TO_SCRIPT_A_VALIDER", "TO_FILM_A_CAPTURER", "TO_PIECE_A_VALIDER", "TO_CAS_V2"];
const NOUVELLES = ["TO_PIECE_A_CONSTRUIRE", "TO_PIECE_A_REVOIR"];

beforeAll(async () => {
  process.env.SESSION_SECRET = "s".repeat(48);
  const e = await hash(MDP, { algorithm: 2, memoryCost: 19456, timeCost: 2, parallelism: 1 });
  process.env.STUDIO_PASSWORD_HASH_B64 = Buffer.from(e).toString("base64");
});

beforeEach(async () => {
  reinitialiserDepots();
  reinitialiserRequete();
  boucle.avancementsEnVol().clear();
  vi.useFakeTimers({ toFake: ["Date"] });
  await auth.seConnecter(MDP, false);
  for (const x of await depots().travaux.lister((x) => x.statut === "en_cours" || x.statut === "en_file")) await depots().travaux.enregistrer({ ...x, statut: "termine" });
});

afterEach(() => {
  boucle.arreterBoucle();
  vi.useRealTimers();
});

const lire = async (id: string): Promise<Travail> => (await depots().travaux.obtenir(id))!;
const immobile: MoteurVideo = { ...moteurSimulation, avancer: async (t) => ({ travail: { ...t, statut: "en_cours" } }) };
const tour = () => boucle.contenuDuTour({ choisirMoteur: () => immobile });

/** Un travail « en_cours » immobile, en pause `code` (ou sans pause), observé pendant 2 h par tours de 5 min (délai du moteur : 60 min). */
async function observerDeuxHeures(code: string | null): Promise<Travail> {
  const { travailId } = await fabrication.lancerFabrication("v-04", { confirme: true });
  if (code !== null) {
    const t = await lire(travailId);
    await depots().travaux.enregistrer({ ...t, parametres: { ...(t.parametres ?? {}), pause: { code } } });
  }
  await tour();
  for (let fait = 0; fait < 120; fait += 5) {
    vi.setSystemTime(Date.now() + 5 * MIN);
    await tour();
  }
  return lire(travailId);
}

describe("P7 · pauses exemptées de la panne sans nouvelle", () => {
  it.each(NOUVELLES)("%s : immobile plus que le délai, le travail reste en cours, sans garde ni panne", async (code) => {
    const t = await observerDeuxHeures(code);
    expect(t.statut).toBe("en_cours");
    expect(t.erreur?.code).not.toBe("PANNE_SANS_NOUVELLE");
    expect(t.garde).toBeUndefined();
  });

  it.each(ANCIENNES)("%s (déjà exemptée) le reste", async (code) => {
    const t = await observerDeuxHeures(code);
    expect(t.statut).toBe("en_cours");
    expect(t.erreur?.code).not.toBe("PANNE_SANS_NOUVELLE");
    expect(t.garde).toBeUndefined();
  });

  it("un code inconnu (TO_AUTRE) tombe toujours en PANNE_SANS_NOUVELLE", async () => {
    const t = await observerDeuxHeures("TO_AUTRE");
    expect(t.statut).toBe("echec");
    expect(t.erreur).toMatchObject({ code: "PANNE_SANS_NOUVELLE", reessayable: true });
  });

  it("TO_DOSSIER_INCOMPLET (non exemptée) tombe toujours en PANNE_SANS_NOUVELLE, réessayable", async () => {
    const t = await observerDeuxHeures("TO_DOSSIER_INCOMPLET");
    expect(t.statut).toBe("echec");
    expect(t.erreur).toMatchObject({ code: "PANNE_SANS_NOUVELLE", reessayable: true });
  });

  it("sans pause, la garde tombe toujours (non-régression)", async () => {
    const t = await observerDeuxHeures(null);
    expect(t.statut).toBe("echec");
    expect(t.erreur?.code).toBe("PANNE_SANS_NOUVELLE");
  });

  it("lecture du texte : la liste contient exactement les 7 codes attendus", () => {
    const src = readFileSync(join(process.cwd(), "src/services/travaux.ts"), "utf8");
    const m = /const PAUSES_ATTENTE_WILLIAMS_TUTORIEL: readonly string\[\] = \[([^\]]*)\]/.exec(src);
    expect(m).not.toBeNull();
    const codes = [...m![1].matchAll(/"([^"]+)"/g)].map((x) => x[1]);
    expect(codes).toEqual([...ANCIENNES, ...NOUVELLES]);
  });
});
