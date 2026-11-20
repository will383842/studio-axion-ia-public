/**
 * FA-SERVICE-INV-v20h : le service lit 3 réglages ÉTEINTS (extraits maison, zoom gratuit, master gardé).
 * Absent, `"true"` ou `1` : outils et demande de rendu identiques à ceux de master (empreintes du filet #1366).
 * Chacun à `true` : seul son effet apparaît. Aucun appel réel, aucun fournisseur.
 */
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";

const lire = vi.hoisted(() => vi.fn());
vi.mock("@/services/_commun", async (importOriginal) => ({ ...(await importOriginal<typeof import("@/services/_commun")>()), lireParametre: lire }));
vi.mock("@/services/auth", () => ({ exigerSession: vi.fn(async () => undefined) }));

import { demandeRenduV4, outilsFacecamAnimee } from "@/services/facecam-animee";

const CLES = { extraitsMaison: "facecamAnimee.extraitsMaison", zoomGratuit: "facecamAnimee.zoomGratuit", garderMaster: "facecamAnimee.garderMaster" } as const;
const EMPREINTE_DEMANDE_RENDRE = "63b9f4aa26ce7751f614f237b9287424c37523bc17e6fabc629953804415814c";
const EMPREINTE_DEMANDE_PURE = "47c1309caa502ff8d1aeac577885d510be0d823826c7375ffe53f1538e6b2f6d";
const PLAN = {
  version: 4, duree: 5, prise: { src: "prise.mp4", debutSec: 0, finSec: 5 }, sons: [{ src: "x.mp3" }],
  elementsV4: [{ id: "TitreV4", debutSec: 0, finSec: 2 }], sousTitres: [{ w: "bonjour", a: 0.2, f: 0.8 }],
} as never;
const GARDES = [{ debutSec: 0, finSec: 5 }];
const trie = (v: unknown): unknown => (Array.isArray(v) ? v.map(trie) : v && typeof v === "object" ? Object.fromEntries(Object.entries(v as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b)).map(([k, x]) => [k, trie(x)])) : v);
const empreinte = (v: unknown) => createHash("sha256").update(JSON.stringify(trie(v))).digest("hex");

const reglages = (valeurs: Record<string, unknown>) => lire.mockImplementation(async (id: string, defaut: unknown) => (id in valeurs ? valeurs[id] : defaut));
async function rendre(extra: Record<string, unknown> = {}) {
  const soumettre = vi.fn(async () => ({ statut: "en_cours" as const }));
  const outils = await outilsFacecamAnimee({ videoId: "v-1", travailId: "t-1", production: false, planScenes: null, signer: { lecture: async (c: string) => c, depot: async (c: string) => c }, rendu: { soumettre, etat: vi.fn(async () => ({ statut: "inconnu" as const })) } } as never);
  await outils.rendre({ idRendu: "r-1", priseCle: "p.mp4", plan: PLAN, gardes: GARDES, videos: [{ nom: "v4-1-0.mp4", cle: "c1" }], ...extra } as never).catch(() => undefined);
  const demande = (soumettre.mock.calls[0] as unknown as [{ parametres: Record<string, unknown> }])[0];
  return { outils, demande };
}
const ZOOMS = { fenetres: [{ debutSec: 1, finSec: 3, facteur: 1.05 }], largeur: 1080, hauteur: 1920 };

describe("FA-SERVICE-INV-v20h : 3 réglages éteints", () => {
  beforeEach(() => lire.mockReset());

  it("a) absents, `\"true\"` ou 1 : aucune clé d'outil neuve, demande de rendu identique à l'empreinte figée", async () => {
    for (const valeur of [undefined, "true", 1, false, null]) {
      reglages(valeur === undefined ? {} : { [CLES.extraitsMaison]: valeur, [CLES.zoomGratuit]: valeur, [CLES.garderMaster]: valeur });
      const { outils, demande } = await rendre();
      for (const k of ["extraitsMaison", "zoomGratuit", "garderMaster"]) expect(k in outils, `${String(valeur)} : ${k}`).toBe(false);
      expect(Object.keys(demande.parametres).sort()).toEqual(["gardes", "mode", "plan", "vignette"]);
      expect(empreinte(demande)).toBe(EMPREINTE_DEMANDE_RENDRE);
    }
  });

  it("a bis) lecture en échec = éteint", async () => {
    lire.mockImplementation(async (id: string, defaut: unknown) => { if (id in { [CLES.extraitsMaison]: 1, [CLES.zoomGratuit]: 1, [CLES.garderMaster]: 1 }) throw new Error("lecture"); return defaut; });
    const { outils } = await rendre();
    expect(["extraitsMaison", "zoomGratuit", "garderMaster"].some((k) => k in outils)).toBe(false);
  });

  it("a ter) demandeRenduV4 sans zoom ni master : empreinte figée", () => {
    const d = demandeRenduV4({ idRendu: "r-1", prise: "p.mp4", plan: PLAN, gardes: GARDES, sortie: { urlDepot: "d", cle: "s.mp4" }, vignette: { urlDepot: "dv", cle: "v.jpg" } });
    expect(empreinte(d)).toBe(EMPREINTE_DEMANDE_PURE);
  });

  it("b) extraits maison à true : l'outil le dit, la demande de rendu ne change pas", async () => {
    reglages({ [CLES.extraitsMaison]: true });
    const { outils, demande } = await rendre();
    expect(outils.extraitsMaison).toBe(true);
    expect("zoomGratuit" in outils || "garderMaster" in outils).toBe(false);
    expect(empreinte(demande)).toBe(EMPREINTE_DEMANDE_RENDRE);
  });

  it("b) zoom gratuit à true : l'outil le dit ; les fenêtres données au rendu partent dans la demande, sinon rien", async () => {
    reglages({ [CLES.zoomGratuit]: true });
    const sans = await rendre();
    expect(sans.outils.zoomGratuit).toBe(true);
    expect(empreinte(sans.demande)).toBe(EMPREINTE_DEMANDE_RENDRE);
    const avec = await rendre({ zoomsPrise: ZOOMS });
    expect(avec.demande.parametres.zoomsPrise).toEqual(ZOOMS);
    expect(Object.keys(avec.demande.parametres).sort()).toEqual(["gardes", "mode", "plan", "vignette", "zoomsPrise"]);
  });

  it("b) master gardé à true : l'outil le dit ; le rendu reçoit un dépôt `-master.mp4` signé", async () => {
    reglages({ [CLES.garderMaster]: true });
    const { outils, demande } = await rendre({ garderMaster: true });
    expect(outils.garderMaster).toBe(true);
    const m = demande.parametres.master as { urlDepot: string; cle: string };
    expect(m.cle).toMatch(/\/r-1-master\.mp4$/);
    expect(m.urlDepot).toBe(m.cle);
    expect(Object.keys(demande.parametres).sort()).toEqual(["gardes", "master", "mode", "plan", "vignette"]);
    // Réglage allumé mais la chaîne ne demande pas de master : rien de plus.
    expect("master" in (await rendre()).demande.parametres).toBe(false);
  });

  it("c) garde texte : aucun fournisseur ni crédit neuf dans les branchements", () => {
    const src = readFileSync(join(__dirname, "..", "..", "src", "services", "facecam-animee.ts"), "utf8");
    const bloc = src.slice(src.indexOf("BR-EXTRAITS-MAISON-c, C8-Z09b-c"), src.indexOf("async transcrire"));
    expect(bloc).not.toMatch(/fournisseurs\/|credits|budget|plafond/i);
    // Les trois imports neufs viennent du moteur de la face caméra animée, jamais d'un fournisseur.
    for (const m of ["consigne-extraits-maison", "zoom-gratuit-v4", "master-v4"]) expect(src).toMatch(new RegExp(`from "@/moteurs/montage-facecam-animee/[a-z/-]*${m}"`));
  });
});
