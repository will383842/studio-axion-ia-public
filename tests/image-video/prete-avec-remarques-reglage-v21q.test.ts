/**
 * S-13-g-v21q : le réglage `imageVideo.preteAvecRemarques` (ÉTEINT) passe l'option de S-13-f à la fabrication image vers
 * vidéo. Doubles seulement, 0 € : `avancerIV` est remplacé par un double qui capture les outils reçus.
 */
import { readFileSync } from "node:fs";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { mockHeaders, mockNavigation, reinitialiserRequete } from "../helpers/next-mocks";
import { preparerMotDePasse } from "../helpers/g1a";

vi.mock("next/headers", () => mockHeaders);
vi.mock("next/navigation", () => mockNavigation);
vi.mock("server-only", () => ({}));
const recus: unknown[] = [];
vi.mock("@/moteurs/montage-image-video/fabrication", async (original) => ({
  ...(await original<typeof import("@/moteurs/montage-image-video/fabrication")>()),
  avancerIV: async (etat: unknown, outils: unknown) => {
    recus.push(outils);
    return etat;
  },
}));

const { reinitialiserDepots } = await import("@/donnees/memoire");
const auth = await import("@/services/auth");
const commun = await import("@/services/_commun");
const { construireCommande } = await import("@/services/fabrication");
const reglage = await import("@/services/prete-avec-remarques-iv");
const { CLE_LANCEUR_IV, creerMoteurMontageImageVideo } = await import("@/moteurs/montage-image-video");
const { carteFixe } = await import("./doubles-fabrication");
type CommandeFabrication = import("@/domaine/types").CommandeFabrication;
type Travail = import("@/domaine/types").Travail;

const MDP = "essai-prete-avec-remarques-reglage";
const CLE = "imageVideo.preteAvecRemarques";
const carte = carteFixe("C");
/** Outils de la fabrique : un objet témoin (le double d'`avancerIV` ne s'en sert pas). */
const OUTILS = Object.freeze({ temoin: true }) as never;

beforeAll(async () => {
  await preparerMotDePasse(MDP);
});
beforeEach(async () => {
  reinitialiserDepots();
  reinitialiserRequete();
  await auth.seConnecter(MDP, false);
  recus.length = 0;
});
afterEach(() => {
  vi.restoreAllMocks();
});

async function commande(): Promise<CommandeFabrication> {
  const c = await construireCommande("v-03");
  return {
    ...c,
    formatId: "image-video",
    moteurId: "montage-image-video",
    ratios: ["9:16"],
    dureeCibleSec: 50,
    entrees: { imageVideo: { imageCle: carte.image.cle, empreinte: carte.image.empreinte, plafondCentimes: 5000, codeSuivi: "essai", accordEssaiReel: true } },
    reglages: { validationCarte: "automatique" },
    budgetMax: { centimes: 5000, devise: "EUR" },
  } as CommandeFabrication;
}

async function avancerUneFois(modifier: (t: Travail) => Travail = (t) => t) {
  const moteur = creerMoteurMontageImageVideo({ outils: async () => OUTILS, numeroVersion: async () => 42 });
  const cmd = await commande();
  const lance = await moteur.lancer(cmd, { travailId: "t-s13g", versionId: "ver-s13g", titre: "S-13-g" });
  expect(lance.statut).not.toBe("echec");
  const travail = modifier(lance);
  return moteur.avancer(travail, cmd);
}

describe("S-13-g-v21q · réglage « prête, avec remarques » de l'image vers vidéo", () => {
  it("a) preteAvecRemarquesIVActive : absent, false, \"true\", 1, {} → faux ; lecture qui lève → faux ; true → vrai", async () => {
    expect(reglage.PARAM_PRETE_AVEC_REMARQUES_IV).toBe(CLE);
    expect(await reglage.preteAvecRemarquesIVActive()).toBe(false);
    for (const v of [false, "true", 1, {}]) {
      await commun.ecrireParametre(CLE, v);
      expect(await reglage.preteAvecRemarquesIVActive(), JSON.stringify(v)).toBe(false);
    }
    await commun.ecrireParametre(CLE, true);
    expect(await reglage.preteAvecRemarquesIVActive()).toBe(true);
    vi.spyOn(commun, "lireParametre").mockRejectedValue(new Error("base en panne"));
    expect(await reglage.preteAvecRemarquesIVActive()).toBe(false);
  });

  it("b) moteur `avancer` : réglage absent (et false, \"true\", 1) → les outils passés à avancerIV sont le MÊME objet ; true → mêmes outils + preteAvecRemarques: true, rien d'autre", async () => {
    await avancerUneFois();
    expect(recus).toHaveLength(1);
    expect(recus[0]).toBe(OUTILS);
    for (const v of [false, "true", 1]) {
      await commun.ecrireParametre(CLE, v);
      await avancerUneFois();
      expect(recus.at(-1), JSON.stringify(v)).toBe(OUTILS);
    }
    await commun.ecrireParametre(CLE, true);
    await avancerUneFois();
    expect(recus.at(-1)).not.toBe(OUTILS);
    expect(recus.at(-1)).toEqual({ temoin: true, preteAvecRemarques: true });
  });

  it("c) lecture du réglage qui lève (base en panne) → comme absent : le MÊME objet d'outils", async () => {
    await commun.ecrireParametre(CLE, true);
    // La panne commence après le lancement (le lancement lit d'autres réglages) : seule la lecture du réglage tombe.
    await avancerUneFois((t) => {
      vi.spyOn(commun, "lireParametre").mockRejectedValue(new Error("base en panne"));
      return t;
    });
    expect(recus.at(-1)).toBe(OUTILS);
  });

  it("c bis) lecteur du réglage qui lève lui-même → comme absent : le MÊME objet d'outils, aucune exception", async () => {
    vi.spyOn(reglage, "preteAvecRemarquesIVActive").mockRejectedValue(new Error("lecteur en panne"));
    await expect(avancerUneFois()).resolves.toBeDefined();
    expect(recus.at(-1)).toBe(OUTILS);
  });

  it("d) travail mené par le lanceur → avancer sort avant : aucun appel du lecteur, avancerIV jamais appelé", async () => {
    await commun.ecrireParametre(CLE, true);
    const lecteur = vi.spyOn(reglage, "preteAvecRemarquesIVActive");
    await avancerUneFois((t) => ({ ...t, parametres: { ...t.parametres, [CLE_LANCEUR_IV]: true } }));
    expect(lecteur).not.toHaveBeenCalled();
    expect(recus).toHaveLength(0);
  });

  it("e) le TEXTE des fichiers 1 et 2 ne contient pas « remarques-livraison » (garde « un seul importeur » de S-13-f)", () => {
    for (const f of ["src/services/prete-avec-remarques-iv.ts", "src/moteurs/montage-image-video/index.ts"]) {
      const t = readFileSync(f, "utf8");
      expect(t, f).not.toContain("remarques-livraison");
    }
    expect(readFileSync("src/services/prete-avec-remarques-iv.ts", "utf8")).not.toContain("livraison-avec-remarques");
  });
});
