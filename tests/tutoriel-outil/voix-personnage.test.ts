/**
 * T-EXT-39 · Voix du tutoriel : un personnage (rôle « voix »), le double de Williams. Doubles seulement : aucune voix
 * lue, aucun appel HeyGen, 0 €. Le format reste masqué. Le refus d'une voix non épinglée est déjà couvert par
 * `bout-en-bout.test.ts` (« une autre voix que la voix épinglée est refusée avant toute lecture »).
 */
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { mockHeaders, mockNavigation, reinitialiserRequete } from "../helpers/next-mocks";
import type { CommandeFabrication, Travail } from "@/domaine/types";
import { creerMoteurTutorielOutil } from "@/moteurs/montage-tutoriel-outil";
import { commandeTutoriel, outilsDoubles, une, type Journal } from "./doubles";

vi.mock("next/headers", () => mockHeaders);
vi.mock("next/navigation", () => mockNavigation);

const { reinitialiserDepots, depots } = await import("@/donnees/memoire");
const auth = await import("@/services/auth");
const videos = await import("@/services/videos");
const { obtenirFormat, listerFormatsActifs } = await import("@/formats");
const { hash } = await import("@node-rs/argon2");

const MDP_TEST = "essai-t-ext-39";
const T0 = Date.UTC(2026, 10, 18, 9);
const journalVide = (): Journal => ({ voix: [], claude: [], rendus: [] });

beforeAll(async () => {
  process.env.SESSION_SECRET = "c".repeat(48);
  const empreinte = await hash(MDP_TEST, { algorithm: 2, memoryCost: 19456, timeCost: 2, parallelism: 1 });
  process.env.STUDIO_PASSWORD_HASH_B64 = Buffer.from(empreinte).toString("base64");
});

beforeEach(async () => {
  reinitialiserDepots();
  reinitialiserRequete();
  await auth.seConnecter(MDP_TEST, false);
});

async function mener(moteur: ReturnType<typeof creerMoteurTutorielOutil>, c: CommandeFabrication, travail: Travail) {
  let t = travail;
  for (let i = 0; i < 400; i++) {
    t = (await moteur.avancer(t, c, T0 + i * 1000)).travail;
    if (["termine", "echec", "annule"].includes(t.statut) || t.parametres?.pause) break;
  }
  return t;
}

describe("T-EXT-39 : voix du tutoriel d'outil", () => {
  it("le format déclare un seul personnage « voix », source « double », et reste masqué", () => {
    const f = obtenirFormat("tutoriel-outil");
    expect(f.personnages).toEqual({ min: 1, max: 1, roles: ["voix"], sources: ["double"] });
    expect(f.statut).toBe("masque");
  });

  it("distribution par défaut : un rôle « voix », Williams, son double", async () => {
    // `creerBrouillon` refuse un format masqué : on l'« ouvre » le temps du test seulement (jamais dans le code).
    const format = obtenirFormat("tutoriel-outil") as { statut: string };
    const avant = format.statut;
    format.statut = "actif";
    let id: string;
    try {
      id = await videos.creerBrouillon("tutoriel-outil");
    } finally {
      format.statut = avant;
    }
    expect(obtenirFormat("tutoriel-outil").statut).toBe("masque");
    const video = (await depots().videos.obtenir(id))!;
    expect(video.distribution).toHaveLength(1);
    expect(video.distribution[0]).toMatchObject({ role: "voix", source: "double", personnageId: "p-will" });
  });

  it("sans distribution : vidéo muette, aucune voix lue", async () => {
    const j = journalVide();
    const moteur = creerMoteurTutorielOutil({ outils: une(outilsDoubles(j)) });
    const c = commandeTutoriel({ distribution: [], ratios: ["4:5"] });
    const t = await mener(moteur, c, await moteur.lancer(c, { travailId: "t-muet", versionId: "ver-1", titre: "Tuto", maintenant: T0 }));
    expect(t.statut).toBe("termine");
    expect(j.voix).toEqual([]);
  });

  it("avec la distribution par défaut : la voix est demandée une fois, le budget (avantLecture) passe avant la lecture", async () => {
    const j = journalVide();
    const ordre: string[] = [];
    const outils = outilsDoubles(j);
    const lire = outils.voix!.voix().lire.bind(outils.voix!.voix());
    (outils.voix!.voix() as unknown as { lire: unknown }).lire = async (d: Parameters<typeof lire>[0]) => {
      ordre.push("lecture");
      return lire(d);
    };
    outils.voix!.avantLecture = async () => {
      ordre.push("budget");
    };
    const moteur = creerMoteurTutorielOutil({ outils: une(outils) });
    const c = commandeTutoriel({ ratios: ["4:5"] });
    const t = await mener(moteur, c, await moteur.lancer(c, { travailId: "t-voix39", versionId: "ver-1", titre: "Tuto", maintenant: T0 }));
    expect(t.statut).toBe("termine");
    expect(j.voix).toHaveLength(1);
    expect(ordre.indexOf("budget")).toBeGreaterThanOrEqual(0);
    expect(ordre.indexOf("budget")).toBeLessThan(ordre.indexOf("lecture"));
  });

  it("l'estimation contient la ligne « Voix » (caractères du script, montants nuls)", async () => {
    const moteur = creerMoteurTutorielOutil({ outils: une(outilsDoubles(journalVide())) });
    const c = commandeTutoriel();
    const e = await moteur.estimer(c);
    const ligneVoix = e.lignes.find((l) => l.etape === "Voix");
    expect(ligneVoix).toBeDefined();
    expect(ligneVoix!.quantite).toBe(c.script.texteComplet!.length);
    expect(ligneVoix!.total.centimes).toBe(0);
    expect(e.total.centimes).toBe(0);
    const sans = await moteur.estimer(commandeTutoriel({ distribution: [] }));
    expect(sans.lignes.some((l) => l.etape === "Voix")).toBe(false);
  });

  it("le format reste absent des formats actifs (masqué)", () => {
    expect(listerFormatsActifs().some((f) => f.id === "tutoriel-outil")).toBe(false);
  });
});
