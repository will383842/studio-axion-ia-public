/**
 * BR-TELEPHONE-a : le réglage `facecamAnimee.telephoneVideo` est relié à la fabrication, par le chemin réel :
 * lecture du réglage (`outilsFacecamAnimee`) → outils de la chaîne v4 → pas « mise-en-scene » de `avancerChaineV4` → message envoyé au réalisateur.
 * Éteint (défaut) : le message et la consigne système sont identiques au caractère près à ceux d'avant (empreinte figée). Aucun appel réel.
 */
import { createHash } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";

const lire = vi.hoisted(() => vi.fn());
vi.mock("@/services/_commun", async (importOriginal) => ({ ...(await importOriginal<typeof import("@/services/_commun")>()), lireParametre: lire }));
vi.mock("@/services/auth", () => ({ exigerSession: vi.fn(async () => undefined) }));

import { outilsFacecamAnimee } from "@/services/facecam-animee";
import { PARAM_TELEPHONE_VIDEO_FA } from "@/moteurs/montage-facecam-animee/realisateur/consigne-telephone-video";
import { avancerChaineV4, etatInitialV4, type EtatChaineV4 } from "@/moteurs/montage-facecam-animee/chaine-v4";
import { realiser, type EntreeRealisateur, type RequeteRealisateur } from "@/moteurs/montage-facecam-animee/realisateur";

const MARQUE = "TÉLÉPHONE QUI JOUE UN EXTRAIT";
// Empreintes calculées AVANT le changement (master 93c9d42) : message et consigne système du réalisateur, réglage absent.
const EMPREINTE_MESSAGE_ETEINT = "c562a10715c5fab38bb22f402dceba0c23321215eba6204f8b696f650fece680";
const EMPREINTE_SYSTEME = "4a0af6d2fb1a8c7da1fe6a7c88cf0873a3a81021f9f9e9e8017aae8091cc712c";
const sha = (s: string) => createHash("sha256").update(s).digest("hex");

const MOTS = [
  { w: "bonjour", a: 0.2, f: 0.8 },
  { w: "voici", a: 1.0, f: 1.4 },
  { w: "mon", a: 2.0, f: 2.5 },
  { w: "devis", a: 3.0, f: 3.5 },
];

const outilsAvec = () =>
  outilsFacecamAnimee({ videoId: "v-1", travailId: "t-1", production: false, planScenes: null, signer: { lecture: async (c: string) => c, depot: async (c: string) => c }, rendu: { soumettre: vi.fn(), etat: vi.fn() } } as never);

/** Fait faire à la VRAIE chaîne son pas « mise-en-scene » avec les vrais outils, sauf l'appel à Claude (faux, gratuit, qui capte la requête). */
async function requeteDeLaChaine(): Promise<RequeteRealisateur> {
  const reels = await outilsAvec();
  const requetes: RequeteRealisateur[] = [];
  const outils = {
    ...reels,
    plafondClaudeAtteint: async () => false,
    historique: async () => [],
    appelerRealisateur: async (r: RequeteRealisateur) => {
      requetes.push(r);
      return { ok: false as const, message: "faux client" };
    },
  };
  const etat: EtatChaineV4 = { ...etatInitialV4({ videoId: "v-1", versionId: "x", priseCle: "p", texteValide: "t" } as never), etape: "mise-en-scene", coupes: { mots: MOTS, dureeSec: 6 } as never };
  await avancerChaineV4(etat, outils as never);
  expect(requetes).toHaveLength(1);
  return requetes[0];
}
const reglage = (valeur: unknown | "leve") =>
  lire.mockImplementation(async (id: string, defaut: unknown) => {
    if (id !== PARAM_TELEPHONE_VIDEO_FA) return defaut;
    if (valeur === "leve") throw new Error("lecture");
    return valeur;
  });
const occurrences = (t: string, x: string) => t.split(x).length - 1;

describe("BR-TELEPHONE-a : réglage → outils → message du réalisateur", () => {
  beforeEach(() => lire.mockReset());

  it("(a) réglage absent : outils sans telephoneVideo, message et consigne système identiques à ceux d'avant", async () => {
    lire.mockImplementation(async (_id: string, defaut: unknown) => defaut);
    expect("telephoneVideo" in (await outilsAvec())).toBe(false);
    const r = await requeteDeLaChaine();
    expect(r.message).not.toContain(MARQUE);
    expect(sha(r.message)).toBe(EMPREINTE_MESSAGE_ETEINT);
    expect(sha(r.systeme)).toBe(EMPREINTE_SYSTEME);
  });

  it("(b) réglage à true : les outils le portent et le message contient le bloc une seule fois ; consigne système inchangée", async () => {
    reglage(true);
    expect((await outilsAvec()).telephoneVideo).toBe(true);
    const r = await requeteDeLaChaine();
    expect(occurrences(r.message, MARQUE)).toBe(1);
    expect(sha(r.systeme)).toBe(EMPREINTE_SYSTEME);
    expect(r.systeme).not.toContain(MARQUE);
  });

  it("(c) « true », 1, null ou lecture qui lève : éteint, message identique à celui d'avant", async () => {
    for (const valeur of ["true", 1, null, "leve"] as const) {
      reglage(valeur);
      expect("telephoneVideo" in (await outilsAvec())).toBe(false);
      const r = await requeteDeLaChaine();
      expect(sha(r.message)).toBe(EMPREINTE_MESSAGE_ETEINT);
    }
  });

  it("(d) le repli (entree.repli) garde son texte d'aujourd'hui, allumé ou non ; le bloc est ajouté avant lui", async () => {
    const appeler = async () => ({ ok: false as const, message: "faux" });
    const entree: EntreeRealisateur = {
      mots: MOTS, dureeSec: 6, prise: { src: "prise-montee.mp4", finSec: 6 },
      fin: { debut: 6, marque: "Axion-IA", adresse: "axion-ia.com", motCle: "DIAGNOSTIC", tuiles: [] },
      repli: { interdites: ["telephone-video"], elementsPrecedents: [], erreurs: ["E1"], essaisMax: 1 },
    };
    const capter = async (e: EntreeRealisateur) => {
      const vus: string[] = [];
      await realiser(e, { appeler: async (r) => (vus.push(r.message), appeler()) });
      return vus[0];
    };
    const eteint = await capter(entree);
    const allume = await capter({ ...entree, telephoneVideo: true });
    expect(eteint).toContain("Plaquettes INTERDITES dans ce plan (aucune vidéo fidèle n'a été trouvée) : telephone-video.");
    expect(eteint).not.toContain(MARQUE);
    expect(occurrences(allume, MARQUE)).toBe(1);
    expect(allume.endsWith(eteint.slice(eteint.indexOf("Plaquettes INTERDITES")))).toBe(true);
  });
});
