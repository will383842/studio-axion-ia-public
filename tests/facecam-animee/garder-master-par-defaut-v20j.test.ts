/**
 * ALLUMER-MASTER-G11-09-v20j : `facecamAnimee.garderMaster` ALLUMÉ par défaut (absent = allumé ; `false` écrit l'éteint).
 * Le master n'est qu'un dépôt de stockage : aucun appel payant, aucune réservation, estimation inchangée. Aucun réseau.
 */
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
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
import { estimerFacecamAnimee, outilsFacecamAnimee } from "@/services/facecam-animee";


const CLE = "facecamAnimee.garderMaster";
const EMPREINTE_DEMANDE_RENDRE = "63b9f4aa26ce7751f614f237b9287424c37523bc17e6fabc629953804415814c";
const PLAN = {
  version: 4, duree: 5, prise: { src: "prise.mp4", debutSec: 0, finSec: 5 }, sons: [{ src: "x.mp3" }],
  elementsV4: [{ id: "TitreV4", debutSec: 0, finSec: 2 }], sousTitres: [{ w: "bonjour", a: 0.2, f: 0.8 }],
} as never;
const GARDES = [{ debutSec: 0, finSec: 5 }];
const trie = (v: unknown): unknown => (Array.isArray(v) ? v.map(trie) : v && typeof v === "object" ? Object.fromEntries(Object.entries(v as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b)).map(([k, x]) => [k, trie(x)])) : v);
const empreinte = (v: unknown) => createHash("sha256").update(JSON.stringify(trie(v))).digest("hex");

/** `valeur` absent de l'objet = rien en base (le défaut du code s'applique) ; "LEVE" : la lecture échoue. */
const reglage = (valeur: unknown, absent = false) =>
  lire.mockImplementation(async (id: string, defaut: unknown) => {
    if (id !== CLE || absent) return defaut;
    if (valeur === "LEVE") throw new Error("lecture");
    return valeur;
  });
async function outilsEtRendu(demanderMaster: boolean) {
  const soumettre = vi.fn(async () => ({ statut: "en_cours" as const }));
  const outils = await outilsFacecamAnimee({ videoId: "v-1", travailId: "t-1", production: false, planScenes: null, signer: { lecture: async (c: string) => c, depot: async (c: string) => c }, rendu: { soumettre, etat: vi.fn(async () => ({ statut: "inconnu" as const })) } } as never);
  await outils.rendre({ idRendu: "r-1", priseCle: "p.mp4", plan: PLAN, gardes: GARDES, videos: [{ nom: "v4-1-0.mp4", cle: "c1" }], ...(outils.garderMaster || demanderMaster ? { garderMaster: true } : {}) } as never).catch(() => undefined);
  return { outils, demande: (soumettre.mock.calls[0] as unknown as [{ parametres: Record<string, unknown> }])[0] };
}

describe("ALLUMER-MASTER-G11-09-v20j : le master est gardé par défaut", () => {
  beforeEach(() => lire.mockReset());

  it("a) rien en base : l'outil garderMaster est posé et la demande de rendu porte le dépôt -master.mp4", async () => {
    reglage(undefined, true);
    const { outils, demande } = await outilsEtRendu(false);
    expect(outils.garderMaster).toBe(true);
    const m = demande.parametres.master as { urlDepot: string; cle: string };
    expect(m.cle).toMatch(/\/r-1-master\.mp4$/);
    expect(m.urlDepot).toBe(m.cle);
    expect(Object.keys(demande.parametres).sort()).toEqual(["gardes", "master", "mode", "plan", "vignette"]);
  });

  it("a bis) masterCle et tailleMaster rendus quand le serveur mesure le master", async () => {
    reglage(undefined, true);
    const etat = vi.fn(async () => ({ statut: "termine" as const, sortieCle: "s.mp4", mesures: { taille: 10, dureeSec: 5, tailleMaster: 123_456 } }));
    const outils = await outilsFacecamAnimee({ videoId: "v-1", travailId: "t-1", production: false, planScenes: null, signer: { lecture: async (c: string) => c, depot: async (c: string) => c }, rendu: { soumettre: vi.fn(async () => ({ statut: "en_cours" as const })), etat } } as never);
    const r = await outils.rendre({ idRendu: "r-1", priseCle: "p.mp4", plan: PLAN, gardes: GARDES, garderMaster: true } as never);
    expect(r.masterCle).toMatch(/\/r-1-master\.mp4$/);
    expect(r.tailleMaster).toBe(123_456);
  });

  it("b) `false` écrit, `\"true\"`, 1, null ou lecture qui lève : aucune clé garderMaster, demande identique à l'empreinte du filet #1366", async () => {
    for (const valeur of [false, "true", 1, null, "LEVE"]) {
      reglage(valeur);
      const { outils, demande } = await outilsEtRendu(false);
      expect("garderMaster" in outils, String(valeur)).toBe(false);
      expect(Object.keys(demande.parametres).sort(), String(valeur)).toEqual(["gardes", "mode", "plan", "vignette"]);
      expect(empreinte(demande), String(valeur)).toBe(EMPREINTE_DEMANDE_RENDRE);
    }
  });

  it("b bis) `true` écrit : même effet que le défaut", async () => {
    reglage(true);
    const { outils, demande } = await outilsEtRendu(false);
    expect(outils.garderMaster).toBe(true);
    expect("master" in demande.parametres).toBe(true);
  });

  it("c) garde-fou : 400 000 001 octets alerte (« prévenir Williams »), 400 000 000 non ; jamais d'échec à cause de la taille", () => {
    const etat = (tailleMaster: number) => ({ rendu: { cle: "r.mp4", vignetteCle: "r.jpg", dureeSec: 5, taille: 10, tailleMaster }, coupes: { dureeSec: 5 } }) as never;
    const alertes = (t: number) => resultatV4(etat(t)).noteQualite.alertes ?? [];
    expect(alertes(400_000_001).map((a) => a.code)).toContain("montant");
    expect(alertes(400_000_000)).toEqual([]);
    expect(alertes(400_000_001).every((a) => a.gravite === "info")).toBe(true);
  });

  it("d) AUDIT ARGENT : l'estimation affichée est identique rien en base / false écrit ; aucune ligne de coût dans le branchement", async () => {
    const prises = [{ dureeSec: 30, motsTexte: 80 }];
    reglage(undefined, true);
    const rien = await estimerFacecamAnimee(prises);
    reglage(false);
    const faux = await estimerFacecamAnimee(prises);
    expect(faux).toEqual(rien);
    expect(rien.renduCentimesEur).toBe(0);
    const src = readFileSync(join(__dirname, "..", "..", "src", "services", "facecam-animee.ts"), "utf8");
    const i = src.indexOf("garderMaster = (await lireParametre");
    expect(src.slice(i - 80, i + 160)).not.toMatch(/credits|budget|plafond|reserver|centimes|Usd/);
  });
});
