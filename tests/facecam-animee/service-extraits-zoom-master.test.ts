/**
 * FA-SERVICE-INV-v20h : le service lit 3 réglages ÉTEINTS (extraits maison, zoom gratuit, master gardé).
 * Absent, `"true"` ou `1` : outils et demande de rendu identiques à ceux de master (empreintes du filet #1366).
 * Chacun à `true` : seul son effet apparaît. Aucun appel réel, aucun fournisseur.
 */
import { createHash } from "node:crypto";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";

const lire = vi.hoisted(() => vi.fn());
vi.mock("@/services/_commun", async (importOriginal) => ({ ...(await importOriginal<typeof import("@/services/_commun")>()), lireParametre: lire }));
vi.mock("@/services/auth", () => ({ exigerSession: vi.fn(async () => undefined) }));

const fournir = vi.hoisted(() => vi.fn<(...args: unknown[]) => Promise<unknown>>(async () => ({ plan: {}, fichiers: [], manques: [], depenseUsd: 0 })));
vi.mock("@/moteurs/montage-facecam-animee/videos-v4-studio", async (importOriginal) => ({ ...(await importOriginal<typeof import("@/moteurs/montage-facecam-animee/videos-v4-studio")>()), fournirVideosV4: fournir }));
vi.mock("@/services/depense-claude-video", async (importOriginal) => ({ ...(await importOriginal<typeof import("@/services/depense-claude-video")>()), plafondRestantVideosFa: vi.fn(async () => 1) }));

const portsDonnes = vi.hoisted(() => ({ params: [] as Array<{ outils: { deposer(fichier: string, cle: string): Promise<string> } }> }));
vi.mock("@/services/ports-axion-v4", () => ({ portsAxionV4: (p: (typeof portsDonnes.params)[number]) => (portsDonnes.params.push(p), { trouver: async () => null, preparer: async () => null }) }));

import { resultatV4 } from "@/moteurs/montage-facecam-animee";
import { approvisionnerFenetresStudio } from "@/moteurs/montage-facecam-animee/images/production";
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

  it("d) extraits maison : à true l'enveloppe des extraits remplace le défaut ; absent ou éteint, le défaut (approvisionnerFenetresStudio) reste", async () => {
    vi.stubEnv("PEXELS_API_KEY", "cle-factice");
    try {
      const approvisionnerDonne = async (valeurs: Record<string, unknown>) => {
        reglages(valeurs);
        fournir.mockClear();
        const outils = await outilsFacecamAnimee({ videoId: "v-1", travailId: "t-1", production: false, planScenes: null, signer: { lecture: async (c: string) => c, depot: async (c: string) => c }, rendu: { soumettre: vi.fn(), etat: vi.fn() } } as never);
        await outils.videos({ plan: PLAN, mots: [] } as never);
        expect(fournir).toHaveBeenCalledTimes(1);
        return (fournir.mock.calls[0]![1] as { approvisionner?: unknown }).approvisionner;
      };
      expect(await approvisionnerDonne({})).toBeUndefined();
      expect(await approvisionnerDonne({ [CLES.extraitsMaison]: "true" })).toBeUndefined();
      const enveloppe = await approvisionnerDonne({ [CLES.extraitsMaison]: true });
      expect(typeof enveloppe).toBe("function");
      expect(enveloppe).not.toBe(approvisionnerFenetresStudio);
    } finally {
      vi.unstubAllEnvs();
    }
  });

  it("d bis) extraits maison : le clip est déposé sous le préfixe de la vidéo (cleFA) et la clé rendue est celle que la chaîne compare", async () => {
    vi.stubEnv("PEXELS_API_KEY", "cle-factice");
    const dossier = mkdtempSync(join(tmpdir(), "fa-extrait-"));
    try {
      reglages({ [CLES.extraitsMaison]: true });
      portsDonnes.params.length = 0;
      const deposes: string[] = [];
      const outils = await outilsFacecamAnimee({ videoId: "v-1", travailId: "t-1", production: false, planScenes: null, signer: { lecture: async (c: string) => c, depot: async (c: string) => (deposes.push(c), `https://depot.test/${c}`) }, rendu: { soumettre: vi.fn(), etat: vi.fn() } } as never);
      await outils.videos({ plan: PLAN, mots: [] } as never);
      expect(portsDonnes.params).toHaveLength(1);
      const fichier = join(dossier, "extrait.mp4");
      writeFileSync(fichier, "x");
      vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, status: 200 })));
      const cle = await portsDonnes.params[0]!.outils.deposer(fichier, "v4-0-0.mp4");
      const attendue = deposes.find((c) => c.endsWith("/v-1/videos/v4-0-0.mp4"));
      expect(attendue, `déposé sous ${deposes.join(",")}`).toMatch(/^studio\/.+\/facecam-animee\/v-1\/videos\/v4-0-0\.mp4$/);
      expect(cle).toBe(attendue);
      expect(deposes).not.toContain("v4-0-0.mp4");
    } finally {
      vi.unstubAllGlobals();
      vi.unstubAllEnvs();
      rmSync(dossier, { recursive: true, force: true });
    }
  });

  it("e) alerte de taille du master : au-delà de 0,4 Go seulement ; absente ou en dessous, mesures identiques", () => {
    const etat = (tailleMaster?: number) => ({ rendu: { cle: "r.mp4", vignetteCle: "r.jpg", dureeSec: 5, taille: 10, ...(tailleMaster !== undefined ? { tailleMaster } : {}) }, coupes: { dureeSec: 5 } }) as never;
    const codes = (tailleMaster?: number) => (resultatV4(etat(tailleMaster)).noteQualite.alertes ?? []).map((a) => a.code);
    expect(codes(500_000_000)).toContain("montant");
    expect(codes(300_000_000)).toEqual(codes(undefined));
    expect(codes(300_000_000)).not.toContain("montant");
  });

  it("f) rendre() : masterCle et tailleMaster rendus seulement si master demandé ET mesure finie", async () => {
    const rendreAvec = async (reglage: boolean, master: boolean, tailleMaster: unknown) => {
      reglages({ [CLES.garderMaster]: reglage });
      const etat = vi.fn(async () => ({ statut: "termine" as const, sortieCle: "s.mp4", mesures: { taille: 10, dureeSec: 5, ...(tailleMaster !== undefined ? { tailleMaster } : {}) } }));
      const outils = await outilsFacecamAnimee({ videoId: "v-1", travailId: "t-1", production: false, planScenes: null, signer: { lecture: async (c: string) => c, depot: async (c: string) => c }, rendu: { soumettre: vi.fn(async () => ({ statut: "en_cours" as const })), etat } } as never);
      return outils.rendre({ idRendu: "r-1", priseCle: "p.mp4", plan: PLAN, gardes: GARDES, ...(master ? { garderMaster: true } : {}) } as never);
    };
    const avec = await rendreAvec(true, true, 123_456);
    expect(avec.masterCle).toMatch(/\/r-1-master\.mp4$/);
    expect(avec.tailleMaster).toBe(123_456);
    for (const r of [await rendreAvec(true, false, 123_456), await rendreAvec(true, true, undefined), await rendreAvec(true, true, "gros"), await rendreAvec(true, true, Number.NaN)]) {
      expect("masterCle" in r).toBe(false);
      expect("tailleMaster" in r).toBe(false);
    }
  });
});
