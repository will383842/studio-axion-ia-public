/**
 * Filet écrit sur 951a108 avant BR-EXTRAITS-MAISON-c, C8-Z09b-c et G11-09d. Une pièce qui l'ouvre « éteinte » le laisse vert.
 * Seul un ALLUMAGE peut changer ces attentes, dans sa PR, avec seconde lecture du pilote.
 *
 * Réglages absents (`lireParametre` rend toujours le défaut demandé) : les outils fournis à la fabrication et la demande de rendu
 * envoyée au serveur de montage sont ceux d'aujourd'hui. Aucun réglage n'est jamais mis à `true` ici. Aucun appel réel.
 */
import { createHash } from "node:crypto";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/services/_commun", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/services/_commun")>()),
  lireParametre: vi.fn(async (_cle: string, defaut: unknown) => defaut),
}));
vi.mock("@/services/auth", () => ({ exigerSession: vi.fn(async () => undefined) }));

import { demandeRenduV4, outilsFacecamAnimee } from "@/services/facecam-animee";

const CLES_OUTILS = ["appelerRealisateur", "finDouce", "historique", "plafondClaudeAtteint", "rendre", "reperer", "transcrire", "videos"];
const EMPREINTE_DEMANDE_RENDRE = "63b9f4aa26ce7751f614f237b9287424c37523bc17e6fabc629953804415814c";
const EMPREINTE_DEMANDE_PURE = "47c1309caa502ff8d1aeac577885d510be0d823826c7375ffe53f1538e6b2f6d";

const PLAN_FIXE = {
  version: 4, duree: 5, prise: { src: "prise.mp4", debutSec: 0, finSec: 5 }, sons: [{ src: "x.mp3" }],
  elementsV4: [{ id: "TitreV4", debutSec: 0, finSec: 2 }], sousTitres: [{ w: "bonjour", a: 0.2, f: 0.8 }],
} as never;
const GARDES = [{ debutSec: 0, finSec: 5 }];

/** JSON à clés triées, pour une empreinte qui ne dépend pas de l'ordre d'écriture. */
const trie = (v: unknown): unknown =>
  Array.isArray(v) ? v.map(trie)
  : v && typeof v === "object" ? Object.fromEntries(Object.entries(v as Record<string, unknown>).sort(([a], [b]) => (a < b ? -1 : 1)).map(([k, x]) => [k, trie(x)]))
  : v;
const empreinte = (v: unknown) => createHash("sha256").update(JSON.stringify(trie(v))).digest("hex");

describe("filet du chef · étape 14 · réglages absents", () => {
  it("1) les outils fournis à la fabrication ont exactement ces clés", async () => {
    const rendu = { soumettre: vi.fn(), etat: vi.fn() };
    const outils = await outilsFacecamAnimee({ videoId: "v-1", travailId: "t-1", production: false, planScenes: null, signer: { lecture: async (c: string) => c, depot: async (c: string) => c }, rendu } as never);
    expect(Object.keys(outils).sort()).toEqual(CLES_OUTILS);
  });

  it("2) `rendre` envoie au serveur une demande aux clés et à l'empreinte figées", async () => {
    const soumettre = vi.fn(async () => ({ statut: "en_cours" as const }));
    const etat = vi.fn(async () => ({ statut: "inconnu" as const }));
    const outils = await outilsFacecamAnimee({ videoId: "v-1", travailId: "t-1", production: false, planScenes: null, signer: { lecture: async (c: string) => c, depot: async (c: string) => c }, rendu: { soumettre, etat } } as never);
    await outils.rendre({ idRendu: "r-1", priseCle: "p.mp4", plan: PLAN_FIXE, gardes: GARDES, videos: [{ nom: "v4-1-0.mp4", cle: "c1" }] } as never).catch(() => undefined);
    expect(soumettre).toHaveBeenCalledTimes(1);
    const demande = (soumettre.mock.calls[0] as unknown as [{ parametres: object; entrees: object }])[0];
    expect(Object.keys(demande.parametres).sort()).toEqual(["gardes", "mode", "plan", "vignette"]);
    expect(Object.keys(demande.entrees).sort()).toEqual(["broll:v4-1-0.mp4", "prise"]);
    expect(empreinte(demande)).toBe(EMPREINTE_DEMANDE_RENDRE);
  });

  it("3) `demandeRenduV4` sans finDouce, recadrage ni vidéos : mêmes clés, sans broll, empreinte figée", () => {
    const demande = demandeRenduV4({
      idRendu: "r-1", prise: "p.mp4", plan: PLAN_FIXE, gardes: GARDES,
      sortie: { urlDepot: "d", cle: "s.mp4" }, vignette: { urlDepot: "dv", cle: "v.jpg" },
    });
    expect(Object.keys(demande.parametres).sort()).toEqual(["gardes", "mode", "plan", "vignette"]);
    expect(Object.keys(demande.entrees).sort()).toEqual(["prise"]);
    expect(empreinte(demande)).toBe(EMPREINTE_DEMANDE_PURE);
  });
});
