/**
 * Relecture « À CORRIGER » (7a, 18/10) : entre la dernière lecture « 0 vidéo en cours » et `compose up -d`, la copie de
 * la base peut durer des minutes ; un travail `en_file` qui démarrait alors était coupé. `mettre-a-jour.sh` pose un BAIL
 * « mise-en-ligne » dans la base (expire seul, 30 min) : tant qu'il est tenu, la boucle ne sort AUCUN travail de la file.
 * Les travaux déjà `en_cours` continuent d'avancer. Même clé des deux côtés (vérifié ici).
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { mockHeaders, mockNavigation, reinitialiserRequete } from "./helpers/next-mocks";
import { preparerMotDePasse } from "./helpers/g1a";

vi.mock("next/headers", () => mockHeaders);
vi.mock("next/navigation", () => mockNavigation);

const { reinitialiserDepots, depots, prendreBail, rendreBail } = await import("@/donnees/memoire");
const auth = await import("@/services/auth");
const fabrication = await import("@/services/fabrication");
const travaux = await import("@/services/travaux");
const boucle = await import("@/services/boucle");
const { moteurSimulation } = await import("@/moteurs/simulation");

const MDP = "essai-pause-mise-en-ligne-123";
beforeAll(() => preparerMotDePasse(MDP));
beforeEach(async () => {
  reinitialiserDepots();
  reinitialiserRequete();
  await auth.seConnecter(MDP, false);
});
afterEach(async () => {
  await rendreBail(travaux.CLE_PAUSE_MISE_EN_LIGNE, "mettre-a-jour.sh");
  boucle.arreterBoucle();
});

async function enFile(videoId: string): Promise<string> {
  const d = depots();
  await d.videos.modifier(videoId, { estDemo: false });
  const { travailId } = await fabrication.lancerFabrication(videoId, { confirme: true });
  const t = (await d.travaux.obtenir(travailId))!;
  await d.travaux.enregistrer({ ...t, estDemo: false });
  return travailId;
}

describe("Pause de la boucle pendant une mise en ligne (bail « mise-en-ligne »)", () => {
  it("bail tenu : aucun travail ne sort de la file ; bail rendu : il sort au tour suivant", async () => {
    const id = await enFile("v-04");
    await prendreBail(travaux.CLE_PAUSE_MISE_EN_LIGNE, "mettre-a-jour.sh", 60_000);
    const pendant = await travaux.lireTravauxAAvancer(Date.now(), () => moteurSimulation);
    expect(pendant.some((l) => l.travail.id === id)).toBe(false);
    expect((await depots().travaux.obtenir(id))!.statut).toBe("en_file");
    await rendreBail(travaux.CLE_PAUSE_MISE_EN_LIGNE, "mettre-a-jour.sh");
    const apres = await travaux.lireTravauxAAvancer(Date.now(), () => moteurSimulation);
    expect(apres.some((l) => l.travail.id === id)).toBe(true);
    expect((await depots().travaux.obtenir(id))!.statut).toBe("en_cours");
  });

  it("bail tenu : un travail déjà `en_cours` continue d'avancer (jamais figé par la pause)", async () => {
    const id = await enFile("v-04");
    await travaux.lireTravauxAAvancer(Date.now(), () => moteurSimulation);
    expect((await depots().travaux.obtenir(id))!.statut).toBe("en_cours");
    await prendreBail(travaux.CLE_PAUSE_MISE_EN_LIGNE, "mettre-a-jour.sh", 60_000);
    const pendant = await travaux.lireTravauxAAvancer(Date.now(), () => moteurSimulation);
    expect(pendant.some((l) => l.travail.id === id)).toBe(true);
  });

  it("même clé que celle posée par deploiement/commun.sh", () => {
    const sh = readFileSync(join(__dirname, "../deploiement/commun.sh"), "utf8");
    expect(travaux.CLE_PAUSE_MISE_EN_LIGNE).toBe("mise-en-ligne");
    expect(sh).toContain(`CLE_PAUSE_FABRICATIONS="${travaux.CLE_PAUSE_MISE_EN_LIGNE}"`);
  });
});
