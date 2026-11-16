import { describe, expect, it, vi } from "vitest";
import { libererPlace, scenesALiberer, type PortsLiberer } from "@/services/retouche-segments/liberer";

const lireParametre = vi.hoisted(() => vi.fn(async (): Promise<unknown> => undefined));
vi.mock("@/services/_commun", () => ({ lireParametre }));

const P = "studio/dev/scenes/vid1/";
const cle = (n: string) => `${P}${n}.mp4`;

function ports(sur: Partial<PortsLiberer> = {}): PortsLiberer & { effaces: string[] } {
  const effaces: string[] = [];
  return {
    env: "dev",
    lireVersions: async () => [],
    lireTravaux: async () => [],
    listerPrefixe: async () => [cle("a"), cle("b"), cle("c"), cle("d")],
    tailleObjet: async () => 1_000_000,
    supprimer: async (k) => void effaces.push(k),
    journaliser: () => undefined,
    ...sur,
    effaces,
  };
}

describe("scenesALiberer", () => {
  it("une scène citée par retoucheChat n'est jamais proposée", async () => {
    const p = ports({ lireVersions: async () => [{ id: "v1", projetMontage: { retoucheChat: { rendu: { fichierCle: cle("a") } } } }] });
    const r = await scenesALiberer("vid1", p);
    expect(r).toMatchObject({ refus: null });
    if (r.refus !== null) return;
    expect(r.cles).not.toContain(cle("a"));
    expect(r.cles).toEqual([cle("b"), cle("c"), cle("d")]);
    expect(r.octets).toBe(3_000_000);
  });
  it("citée par casConcret / tableau d'une vieille version : gardée", async () => {
    const p = ports({
      lireVersions: async () => [
        { id: "v0", projetMontage: { casConcret: { scenes: [{ video: cle("b") }] } } },
        { id: "v1", projetMontage: { tableau: { blocs: [`lien https://x/${cle("c")}?s=1`] } } },
      ],
    });
    const r = await scenesALiberer("vid1", p);
    if (r.refus !== null) throw new Error("refus");
    expect(r.cles).toEqual([cle("a"), cle("d")]);
  });
  it("citée par les paramètres d'un travail : gardée", async () => {
    const p = ports({ lireTravaux: async () => [{ statut: "termine", parametres: { scenes: [cle("d")] } }] });
    const r = await scenesALiberer("vid1", p);
    if (r.refus !== null) throw new Error("refus");
    expect(r.cles).not.toContain(cle("d"));
  });
  it("travail en cours → refus", async () => {
    for (const statut of ["en_file", "en_cours"]) {
      const r = await scenesALiberer("vid1", ports({ lireTravaux: async () => [{ statut }] }));
      expect(r).toEqual({ refus: "Une fabrication est en cours" });
    }
  });
  it("ignore les clés hors du dossier de la vidéo, et un id hors convention", async () => {
    const p = ports({ listerPrefixe: async () => [cle("a"), "studio/dev/scenes/autre/x.mp4", "studio/dev/videos/vid1/y.mp4"] });
    const r = await scenesALiberer("vid1", p);
    if (r.refus !== null) throw new Error("refus");
    expect(r.cles).toEqual([cle("a")]);
    expect(await scenesALiberer("../x", ports())).toMatchObject({ refus: expect.any(String) });
  });
  it("lecture impossible → refus, jamais d'exception", async () => {
    const r = await scenesALiberer("vid1", ports({ lireVersions: async () => { throw new Error("panne"); } }));
    expect(r.refus).toBeTruthy();
  });
});

describe("libererPlace", () => {
  it("sans confirmation (absente, false, \"true\") : rien n'est effacé", async () => {
    for (const c of [undefined, false, "true", 1]) {
      const p = ports();
      const r = await libererPlace("vid1", p, c as never);
      expect(r.efface).toBe(0);
      expect(p.effaces).toEqual([]);
    }
  });
  it("avec confirmation : efface seulement les non référencées", async () => {
    const p = ports({ lireVersions: async () => [{ id: "v1", projetMontage: { retoucheChat: { rendu: { fichierCle: cle("a") } } } }] });
    const r = await libererPlace("vid1", p, true);
    expect(p.effaces.sort()).toEqual([cle("b"), cle("c"), cle("d")]);
    expect(p.effaces).not.toContain(cle("a"));
    expect(r.efface).toBe(3);
  });
  it("recalcule à l'instant : une scène devenue référencée entre-temps reste", async () => {
    let appels = 0;
    const p = ports({
      lireVersions: async () => (appels++ === 0 ? [] : [{ id: "v2", projetMontage: { retoucheChat: { x: { fichierCle: cle("b") } } } }]),
    });
    await scenesALiberer("vid1", p);
    await libererPlace("vid1", p, true);
    expect(p.effaces).not.toContain(cle("b"));
  });
  it("travail en cours → refus, rien effacé", async () => {
    const p = ports({ lireTravaux: async () => [{ statut: "en_cours" }] });
    const r = await libererPlace("vid1", p, true);
    expect(r.refus).toBe("Une fabrication est en cours");
    expect(p.effaces).toEqual([]);
  });
  it("une suppression en échec n'arrête pas les autres, et est journalisée", async () => {
    const journal = vi.fn();
    const effaces: string[] = [];
    const p = ports({
      journaliser: journal,
      supprimer: async (k) => {
        if (k === cle("b")) throw new Error("R2 KO");
        effaces.push(k);
      },
    });
    const r = await libererPlace("vid1", p, true);
    expect(effaces).toEqual([cle("a"), cle("c"), cle("d")]);
    expect(r.efface).toBe(3);
    expect(r.echecs).toBe(1);
    expect(journal).toHaveBeenCalled();
  });
  it("stockage sans supprimer/listerPrefixe → refus, rien", async () => {
    const r = await libererPlace("vid1", ports({ supprimer: undefined as never }), true);
    expect(r.refus).toBeTruthy();
  });
});

describe("LibererPlace (interrupteur retoucheSegments.liberer)", () => {
  it("absent, false ou « true » (texte) → rend null ; lecture en échec → null", async () => {
    const { LibererPlace } = await import("@/components/videos/fiche/LibererPlace");
    for (const v of [undefined, false, "true", 1]) {
      lireParametre.mockResolvedValueOnce(v);
      expect(await LibererPlace({ videoId: "vid1" })).toBeNull();
    }
    lireParametre.mockRejectedValueOnce(new Error("base KO"));
    expect(await LibererPlace({ videoId: "vid1" })).toBeNull();
  });
  it("true exact → rend le bouton", async () => {
    const { LibererPlace } = await import("@/components/videos/fiche/LibererPlace");
    lireParametre.mockResolvedValueOnce(true);
    expect(await LibererPlace({ videoId: "vid1" })).not.toBeNull();
    expect(lireParametre).toHaveBeenCalledWith("retoucheSegments.liberer", false);
  });
});
