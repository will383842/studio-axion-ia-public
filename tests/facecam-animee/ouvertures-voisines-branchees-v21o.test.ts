/**
 * X2-14b-b-v21o : le réalisateur v4 sait comment ont ouvert les dernières vidéos du même réseau (variété commune, ÉTEINTE).
 * Doubles seulement : faux client Claude qui capte la requête, dépôts mémoire, `voisinesDuReseau` doublé ; aucun appel réel.
 * Les empreintes sha256 du message et du système « sans voisines » ont été calculées sur master AVANT le changement.
 * N'importe RIEN de `studio-rendu/**`.
 */
import { createHash } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";

const lire = vi.hoisted(() => vi.fn());
const voisinesDouble = vi.hoisted(() => vi.fn());
vi.mock("@/services/_commun", async (importOriginal) => ({ ...(await importOriginal<typeof import("@/services/_commun")>()), lireParametre: lire }));
vi.mock("@/services/auth", () => ({ exigerSession: vi.fn(async () => undefined) }));
vi.mock("@/services/variete-commune/voisines", () => ({ voisinesDuReseau: voisinesDouble }));

import { depots, reinitialiserDepots } from "@/donnees/memoire";
import { avancerChaineV4, entreeRealisateurV4, etatInitialV4, type EtatChaineV4 } from "@/moteurs/montage-facecam-animee/chaine-v4";
import { realiser, type EntreeRealisateur, type RequeteRealisateur } from "@/moteurs/montage-facecam-animee/realisateur";
import { outilsFacecamAnimee } from "@/services/facecam-animee";

const SHA_MESSAGE_MASTER = "c562a10715c5fab38bb22f402dceba0c23321215eba6204f8b696f650fece680";
const SHA_SYSTEME_MASTER = "4a0af6d2fb1a8c7da1fe6a7c88cf0873a3a81021f9f9e9e8017aae8091cc712c";
const LIGNE = "ouvrez autrement";
const sha = (s: string) => createHash("sha256").update(s).digest("hex");
const MOTS = [
  { w: "bonjour", a: 0.2, f: 0.8 },
  { w: "voici", a: 1.0, f: 1.4 },
  { w: "mon", a: 2.0, f: 2.5 },
  { w: "devis", a: 3.0, f: 3.5 },
];
const occurrences = (t: string, x: string) => t.split(x).length - 1;

/** Vraie chaîne, pas « mise-en-scene » ; compte aussi les appels de `plafondClaudeAtteint` et du réalisateur. */
async function jouer(supplement: Record<string, unknown>) {
  const vues: RequeteRealisateur[] = [];
  const compte = { plafond: 0 };
  const outils = {
    plafondClaudeAtteint: async () => (compte.plafond++, false),
    historique: async () => [],
    appelerRealisateur: async (r: RequeteRealisateur) => {
      vues.push(r);
      return { ok: false as const, message: "faux client" };
    },
    ...supplement,
  };
  const etat: EtatChaineV4 = { ...etatInitialV4({ videoId: "v-1", versionId: "x", priseCle: "p", texteValide: "t" } as never), etape: "mise-en-scene", coupes: { mots: MOTS, dureeSec: 6 } as never };
  await avancerChaineV4(etat, outils as never);
  return { vues, compte };
}

const outilsDuService = () =>
  outilsFacecamAnimee({ videoId: "v-1", travailId: "t-1", production: false, planScenes: null, signer: { lecture: async (c: string) => c, depot: async (c: string) => c }, rendu: { soumettre: vi.fn(), etat: vi.fn(), annuler: vi.fn() } as never } as never);

const reglages = (valeurs: Record<string, unknown>) =>
  lire.mockImplementation(async (id: string, defaut: unknown) => {
    if (id in valeurs) {
      const v = valeurs[id];
      if (v instanceof Error) throw v;
      return v;
    }
    return defaut;
  });

const LISTE_MASTER = ["appelerRealisateur", "finDouce", "historique", "plafondClaudeAtteint", "rendre", "reperer", "transcrire", "videos"];

beforeEach(() => {
  lire.mockReset();
  voisinesDouble.mockReset();
  reinitialiserDepots();
  vi.spyOn(console, "warn").mockImplementation(() => {});
});

describe("X2-14b-b-v21o · service : la méthode `voisinesCommunes` n'existe que si la variété commune est allumée ET que la vidéo a un réseau", () => {
  beforeEach(async () => {
    await depots().videos.enregistrer({ id: "v-1", reseau: "linkedin", titre: "t", creeLe: "x", modifieLe: "x" } as never);
  });

  it("a) varieteCommune false, \"true\", {}, 1 ou lecture qui lève : aucune clé neuve, liste des clés = celle de master", async () => {
    for (const v of [false, "true", {}, 1, new Error("lecture")]) {
      reglages({ varieteCommune: v });
      const o = await outilsDuService();
      expect("voisinesCommunes" in o, `valeur ${String(v)}`).toBe(false);
      expect(Object.keys(o).sort()).toEqual(LISTE_MASTER);
    }
  });

  it("a bis) allumée + vidéo avec réseau : la méthode existe ; allumée + vidéo sans réseau ou absente des dépôts : absente", async () => {
    reglages({ varieteCommune: true });
    expect(typeof (await outilsDuService()).voisinesCommunes).toBe("function");
    reinitialiserDepots();
    await depots().videos.enregistrer({ id: "v-1", titre: "t", creeLe: "x", modifieLe: "x" } as never);
    expect("voisinesCommunes" in (await outilsDuService())).toBe(false);
    reinitialiserDepots();
    expect("voisinesCommunes" in (await outilsDuService())).toBe(false);
  });

  it("e) allumée : la méthode rend les ouvertures des voisines (en mots) ; `undefined` quand leur lecture lève", async () => {
    reglages({ varieteCommune: true });
    voisinesDouble.mockResolvedValue([{ version: "1", videoId: "autre", formatId: "f", le: "2026-11-10", axes: { ouverture: ["question", "horloge"] } }]);
    const o = await outilsDuService();
    expect(await o.voisinesCommunes!()).toEqual(["une question", "une horloge"]);
    expect(voisinesDouble).toHaveBeenCalledWith(expect.objectContaining({ reseau: "linkedin", videoIdEnCours: "v-1" }));
    voisinesDouble.mockRejectedValue(new Error("illisible"));
    expect(await o.voisinesCommunes!()).toBeUndefined();
  });
});

describe("X2-14b-b-v21o · chaîne v4 : une ligne de plus dans le MESSAGE (jamais le système), aucun appel de plus", () => {
  it("b) avec voisinesCommunes : le message contient UNE fois « ouvrez autrement » et les 2 ouvertures ; le système est identique", async () => {
    const { vues } = await jouer({ voisinesCommunes: async () => ["Chrono", "CarteChecklist"] });
    expect(vues.length).toBeGreaterThanOrEqual(1);
    for (const r of vues) {
      expect(occurrences(r.message, LIGNE)).toBe(1);
      expect(r.message).toContain("Chrono, CarteChecklist");
      expect(sha(r.systeme)).toBe(SHA_SYSTEME_MASTER);
    }
  });

  it("c) sans voisinesCommunes, ou qui rejette, ou qui rend undefined / [] : message = empreinte de master, la mise en scène continue", async () => {
    const cas: Record<string, unknown>[] = [{}, { voisinesCommunes: async () => { throw new Error("boum"); } }, { voisinesCommunes: async () => undefined }, { voisinesCommunes: async () => [] }];
    for (const supplement of cas) {
      const { vues } = await jouer(supplement);
      expect(vues).toHaveLength(1);
      expect(sha(vues[0].message)).toBe(SHA_MESSAGE_MASTER);
      expect(sha(vues[0].systeme)).toBe(SHA_SYSTEME_MASTER);
    }
  });

  it("d) audit argent : même nombre d'appels au réalisateur et à plafondClaudeAtteint ; écart de longueur ≤ 200 caractères et UNE ligne de plus", async () => {
    const sans = await jouer({});
    const avec = await jouer({ voisinesCommunes: async () => ["Chrono", "CarteChecklist", "Jauge"] });
    expect(avec.vues.length).toBe(sans.vues.length);
    expect(avec.compte.plafond).toBe(sans.compte.plafond);
    const ecart = avec.vues[0].message.length - sans.vues[0].message.length;
    expect(ecart).toBeGreaterThan(0);
    expect(ecart).toBeLessThanOrEqual(200);
    const lignes = (t: string) => t.split("\n").length;
    expect(lignes(avec.vues[0].message) - lignes(sans.vues[0].message)).toBeLessThanOrEqual(2);
    const [identique] = (await jouer({ voisinesCommunes: async () => undefined })).vues;
    expect(identique.message.length - sans.vues[0].message.length).toBe(0);
  });
});

describe("X2-14b-b-v21o · entrée et réalisateur", () => {
  const etat = { demande: { texteValide: "t" }, coupes: { mots: MOTS, dureeSec: 6 }, cadrage: undefined } as never;

  it("entreeRealisateurV4 : option absente ou vide = objet de master ; présente = champ posé", () => {
    const base = entreeRealisateurV4(etat, {});
    expect("voisinesCommunes" in base).toBe(false);
    expect("voisinesCommunes" in entreeRealisateurV4(etat, { voisinesCommunes: [] })).toBe(false);
    expect(entreeRealisateurV4(etat, { voisinesCommunes: ["Chrono"] }).voisinesCommunes).toEqual(["Chrono"]);
  });

  it("f) realiser direct : `entree.voisinesCommunes` absent ou [] → message identique ; présent → la ligne est là", async () => {
    const message = async (extra: Partial<EntreeRealisateur>) => {
      const vues: RequeteRealisateur[] = [];
      await realiser({ ...entreeRealisateurV4(etat, {}), ...extra }, { appeler: async (r: RequeteRealisateur) => (vues.push(r), { ok: false as const, message: "faux" }) } as never);
      return vues[0].message;
    };
    const ref = await message({});
    expect(await message({ voisinesCommunes: [] })).toBe(ref);
    expect(ref).not.toContain(LIGNE);
    expect(occurrences(await message({ voisinesCommunes: ["Chrono"] }), LIGNE)).toBe(1);
  });
});
