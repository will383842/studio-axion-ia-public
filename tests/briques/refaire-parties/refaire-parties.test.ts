/**
 * S-11-a-v21m · « refaire une seule partie » : pièce commune PURE. Aucun appel réel : tous les ports sont des doubles.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi, type Mock } from "vitest";
import { refaireParties, type PortsRefaire, type EntreeRefaire } from "@/briques/refaire-parties";
import type { DefautVu } from "@/briques/regardeur";
import type { PlanValide } from "@/briques/plan-scenes/schema";

const scene = (id: string, debutMs: number, finMs: number, texte?: string) => ({ id, debutMs, finMs, ...(texte ? { texte } : {}) });
const plan = (scenes: ReturnType<typeof scene>[], mots = [{ texte: "bonjour", debutMs: 0, finMs: 400 }]) => ({ mots, scenes }) as unknown as PlanValide;

// 20 s à 25 i/s = 500 images ; 5 scènes de 4 s.
const SCENES = [scene("s1", 0, 4000, "Un"), scene("s2", 4000, 8000, "Deux"), scene("s3", 8000, 12000, "Trois"), scene("s4", 12000, 16000, "Quatre"), scene("s5", 16000, 20000, "Cinq")];
const defaut = (partieId: string, code: DefautVu["code"] = "texte-coupe"): DefautVu => ({ code, nom: "i01", instantSec: 5, partieId, detail: "Le texte est coupé.", bloquantSiSur: true });

const base = (surcharge: Partial<EntreeRefaire> = {}): EntreeRefaire => ({
  planAvant: plan(SCENES),
  planApres: plan(SCENES),
  defauts: [defaut("s2")],
  fichierAvant: "avant.mp4",
  voixAvant: "voix.mp3",
  dureeTotaleImages: 500,
  transitionMaxMs: 0,
  ...surcharge,
});

function ports(surcharge: Partial<PortsRefaire> = {}) {
  const p = {
    rendrePlage: vi.fn(async (_plage: unknown, index: number) => ({ entree: `plage-${index}`, fichier: `p${index}.mp4` })),
    recoller: vi.fn(async () => ({ fichier: "apres.mp4" })),
    regarder: vi.fn(async () => ({ defauts: [] as DefautVu[] })),
    ...surcharge,
  };
  return p as unknown as PortsRefaire & { rendrePlage: Mock; recoller: Mock; regarder: Mock };
}

describe("refaireParties : le chemin heureux", () => {
  it("une scène fautive : 1 rendu de plage, 1 recollage, 1 regard ; la vidéo refaite est rendue", async () => {
    const p = ports();
    const r = await refaireParties(base(), p);
    expect(r.etat).toBe("refaite");
    expect(r.fichier).toBe("apres.mp4");
    expect(r.reste).toEqual([]);
    expect(p.rendrePlage).toHaveBeenCalledTimes(1);
    expect(p.recoller).toHaveBeenCalledTimes(1);
    expect(p.regarder).toHaveBeenCalledTimes(1);
  });

  it("les segments recollés couvrent la durée sans trou ni recouvrement (règles de lireParametresRecollage)", async () => {
    const p = ports();
    await refaireParties(base(), p);
    const params = p.recoller.mock.calls[0]![0] as { segments: Array<{ source: string; debutSec?: number; finSec?: number; entree?: string; dureeSec?: number }>; avant: string; voix?: string; dureeSec: number };
    expect(params.dureeSec).toBe(20);
    expect(params.voix).toBe("voix");
    let t = 0;
    for (const s of params.segments) {
      if (s.source === "avant") {
        expect(s.debutSec).toBeCloseTo(t, 6);
        t = s.finSec!;
      } else {
        expect(s.entree).toMatch(/^plage-\d+$/);
        expect(s.dureeSec).toBeGreaterThan(0);
        t += s.dureeSec!;
      }
    }
    expect(t).toBeCloseTo(20, 6);
    const entrees = params.segments.filter((s) => s.source === "plage").map((s) => s.entree);
    expect(new Set(entrees).size).toBe(entrees.length);
  });

  it("le regard est limité aux plages refaites", async () => {
    const p = ports();
    await refaireParties(base(), p);
    const arg = p.regarder.mock.calls[0]![0] as { plages: Array<{ debut: number; fin: number }>; fichier: string };
    expect(arg.fichier).toBe("apres.mp4");
    expect(arg.plages).toEqual([{ debut: 100, fin: 200 }]);
  });

  it("la scène à refaire peut être donnée par la demande (sans défaut)", async () => {
    const p = ports();
    const r = await refaireParties(base({ defauts: [], scenesTouchees: ["s3"] }), p);
    expect(r.etat).toBe("refaite");
    expect(p.rendrePlage).toHaveBeenCalledTimes(1);
  });

  it("sans voix d'avant : aucune voix nommée au recollage", async () => {
    const p = ports();
    await refaireParties(base({ voixAvant: undefined }), p);
    expect((p.recoller.mock.calls[0]![0] as { voix?: string }).voix).toBeUndefined();
  });
});

describe("refaireParties : les cas d'arrêt", () => {
  it("aucune scène touchée : 0 appel, la vidéo d'avant", async () => {
    const p = ports();
    const r = await refaireParties(base({ defauts: [] }), p);
    expect(r.etat).toBe("rien");
    expect(r.fichier).toBe("avant.mp4");
    expect(p.rendrePlage).not.toHaveBeenCalled();
    expect(p.recoller).not.toHaveBeenCalled();
    expect(p.regarder).not.toHaveBeenCalled();
  });

  it("défaut sur une partie inconnue du plan : rien à refaire", async () => {
    const p = ports();
    const r = await refaireParties(base({ defauts: [defaut("zzz")] }), p);
    expect(r.etat).toBe("rien");
    expect(p.rendrePlage).not.toHaveBeenCalled();
  });

  it("trop de scènes (mode entier) : refus lisible, aucun appel ; l'appelant garde son rendu entier", async () => {
    const p = ports();
    const r = await refaireParties(base({ scenesTouchees: ["s1", "s2", "s3", "s4"] }), p);
    expect(r.etat).toBe("entier");
    expect(r.fichier).toBe("avant.mp4");
    expect(r.motif).toMatch(/entier/i);
    expect(p.rendrePlage).not.toHaveBeenCalled();
  });

  it("même défaut au second regard : la vidéo d'avant + la liste exacte, un seul tour", async () => {
    const encore = defaut("s2");
    const p = ports({ regarder: vi.fn(async () => ({ defauts: [encore] })) });
    const r = await refaireParties(base(), p);
    expect(r.etat).toBe("sans-progres");
    expect(r.fichier).toBe("avant.mp4");
    expect(r.reste).toEqual([encore]);
    expect(p.rendrePlage).toHaveBeenCalledTimes(1);
    expect(p.regarder).toHaveBeenCalledTimes(1);
  });

  it("un autre défaut au second regard : la vidéo refaite est gardée, la liste est rendue", async () => {
    const autre = defaut("s2", "illisible");
    const p = ports({ regarder: vi.fn(async () => ({ defauts: [autre] })) });
    const r = await refaireParties(base(), p);
    expect(r.etat).toBe("refaite");
    expect(r.fichier).toBe("apres.mp4");
    expect(r.reste).toEqual([autre]);
  });

  it("regard indisponible : la vidéo refaite est rendue, marquée non relue", async () => {
    const p = ports({ regarder: vi.fn(async () => null) });
    const r = await refaireParties(base(), p);
    expect(r.etat).toBe("refaite");
    expect(r.relue).toBe(false);
  });

  it("le rendu d'une plage échoue : la vidéo d'avant, pas de recollage", async () => {
    const p = ports({ rendrePlage: vi.fn(async () => null) });
    const r = await refaireParties(base(), p);
    expect(r.etat).toBe("echec");
    expect(r.fichier).toBe("avant.mp4");
    expect(p.recoller).not.toHaveBeenCalled();
  });

  it("le recollage échoue : la vidéo d'avant, pas de regard", async () => {
    const p = ports({ recoller: vi.fn(async () => null) });
    const r = await refaireParties(base(), p);
    expect(r.etat).toBe("echec");
    expect(r.fichier).toBe("avant.mp4");
    expect(p.regarder).not.toHaveBeenCalled();
  });

  it("ne lève jamais : un port qui lève donne la vidéo d'avant", async () => {
    for (const nom of ["rendrePlage", "recoller", "regarder"] as const) {
      const p = ports({ [nom]: vi.fn(async () => { throw new Error("panne"); }) });
      const r = await refaireParties(base(), p);
      expect(r.fichier === "avant.mp4" || nom === "regarder").toBe(true);
      expect(["echec", "refaite"]).toContain(r.etat);
    }
  });
});

describe("refaireParties : jamais un mot changé, jamais une voix", () => {
  it("un mot dit différent dans le plan refait : refus avant tout appel", async () => {
    const p = ports();
    const r = await refaireParties(base({ planApres: plan(SCENES, [{ texte: "salut", debutMs: 0, finMs: 400 }]) }), p);
    expect(r.etat).toBe("mot-change");
    expect(r.fichier).toBe("avant.mp4");
    expect(p.rendrePlage).not.toHaveBeenCalled();
  });

  it("un texte à l'écran différent : refus avant tout appel", async () => {
    const p = ports();
    const change = SCENES.map((s) => (s.id === "s2" ? { ...s, texte: "Autre" } : s));
    const r = await refaireParties(base({ planApres: plan(change) }), p);
    expect(r.etat).toBe("mot-change");
    expect(p.rendrePlage).not.toHaveBeenCalled();
  });

  it("aucun port de voix n'existe", () => {
    const p = ports();
    expect(Object.keys(p).sort()).toEqual(["recoller", "regarder", "rendrePlage"]);
  });
});

describe("refaireParties : pureté de la pièce", () => {
  const source = readFileSync(join(process.cwd(), "src/briques/refaire-parties/index.ts"), "utf8");
  it("n'importe ni moteur, ni service, ni montage-", () => {
    const imports = [...source.matchAll(/from\s+["']([^"']+)["']/g)].map((m) => m[1]!);
    for (const i of imports) {
      expect(i).not.toMatch(/montage-|@\/services|@\/moteurs|@\/fournisseurs|studio-rendu/);
    }
  });
  it("même entrée, même sortie", async () => {
    const a = await refaireParties(base(), ports());
    const b = await refaireParties(base(), ports());
    expect(a).toEqual(b);
  });
});
