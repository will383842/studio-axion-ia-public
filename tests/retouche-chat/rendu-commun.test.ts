/**
 * S-11-b-v21q · ports réels de « refaire une seule partie » sur le serveur de rendu. Aucun appel réel : service, signature et
 * regard sont des doubles (0 €). Sans appelant : éteint.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { creerPortsRefaire } from "@/services/retouche-chat/rendu-commun";
import { refaireParties, type EntreeRefaire } from "@/briques/refaire-parties";
import type { DemandeRendu, EtatRendu, ServiceRendu } from "@/fournisseurs/types";
import type { DefautVu } from "@/briques/regardeur";
import type { PlanValide } from "@/briques/plan-scenes/schema";
import type { ParametresRecollage } from "@/briques/rendu-par-plages";

const RACINE = join(__dirname, "../..");
const SOURCE = join(RACINE, "src/services/retouche-chat/rendu-commun.ts");

/** Service double : note les demandes ; `etats` donne la suite des états rendus à chaque `etat()` (le dernier se répète). */
function service(etats: EtatRendu[] | ((d: DemandeRendu) => EtatRendu[]) = [{ statut: "en_file", rang: 0 }, { statut: "termine", sortieCle: "ok" }]) {
  const demandes: DemandeRendu[] = [];
  const compte = new Map<string, number>();
  const s: ServiceRendu = {
    soumettre: vi.fn(async (d: DemandeRendu) => {
      demandes.push(d);
      return { idRendu: d.idRendu };
    }),
    etat: vi.fn(async (id: string) => {
      const d = demandes.find((x) => x.idRendu === id)!;
      const suite = typeof etats === "function" ? etats(d) : etats;
      const n = compte.get(id) ?? 0;
      compte.set(id, n + 1);
      const e = suite[Math.min(n, suite.length - 1)]!;
      return e.statut === "termine" ? { ...e, sortieCle: d.sortie.cle } : e;
    }),
  };
  return { s, demandes };
}

const signer = vi.fn(async (lectures: Record<string, string>, depot: { cle: string; mime: string }) => ({
  lectures: Object.fromEntries(Object.entries(lectures).map(([n, c]) => [n, `signe:${c}`])),
  urlDepot: `depot:${depot.cle}`,
}));

function ports(s: ServiceRendu, extra: Partial<Parameters<typeof creerPortsRefaire>[0]> = {}) {
  return creerPortsRefaire({
    service: () => s,
    signer,
    cle: (nom) => `k/${nom}`,
    idBase: "t1",
    composition: "CompoX",
    proprietes: { a: 1, titre: "Bonjour" },
    lecturesPlage: { decor: "k/decor.png" },
    regarder: async () => ({ defauts: [] }),
    attendre: async () => {},
    ...extra,
  });
}

describe("rendrePlage", () => {
  it("a) une demande composition en mode plage, muette, mêmes propriétés, sortie …-plage0.mp4", async () => {
    const { s, demandes } = service();
    const r = await ports(s).rendrePlage({ debut: 50, fin: 100 }, 0);
    expect(demandes).toHaveLength(1);
    const d = demandes[0]!;
    expect(d.operation).toBe("composition");
    expect(d.file).toBe("longue");
    expect(d.parametres).toMatchObject({ composition: "CompoX", mode: "plage", debut: 50, fin: 100, recollable: true, proprietes: { a: 1, titre: "Bonjour" } });
    expect(Object.keys(d.entrees)).not.toContain("audio");
    expect(d.entrees).toEqual({ decor: "signe:k/decor.png" });
    expect(d.sortie).toEqual({ urlDepot: "depot:k/t1-plage0.mp4", cle: "k/t1-plage0.mp4" });
    expect(r).toEqual({ fichier: "k/t1-plage0.mp4" });
  });

  it("a) sans lecturesPlage : entrées vides, jamais d'audio ; l'indice se lit dans la sortie (2e appel : plage1)", async () => {
    const { s, demandes } = service();
    const p = ports(s, { lecturesPlage: undefined });
    await p.rendrePlage({ debut: 0, fin: 10 }, 0);
    await p.rendrePlage({ debut: 20, fin: 30 }, 1);
    expect(demandes.map((d) => d.sortie.cle)).toEqual(["k/t1-plage0.mp4", "k/t1-plage1.mp4"]);
    expect(demandes.every((d) => Object.keys(d.entrees).length === 0)).toBe(true);
    expect(new Set(demandes.map((d) => d.idRendu)).size).toBe(2);
  });

  it("a) une entrée « audio » donnée par l'appelant est retirée : le morceau reste muet, signer jamais appelé avec « audio »", async () => {
    const { s, demandes } = service();
    signer.mockClear();
    await ports(s, { lecturesPlage: { audio: "k/v.mp3", decor: "k/decor.png" } }).rendrePlage({ debut: 0, fin: 5 }, 0);
    expect(demandes[0]!.entrees).toEqual({ decor: "signe:k/decor.png" });
    expect(signer.mock.calls.length).toBeGreaterThan(0);
    for (const [lectures] of signer.mock.calls) expect(Object.keys(lectures)).not.toContain("audio");
  });

  it("a) les propriétés ne sont pas partagées : changer la demande ne change pas la source", async () => {
    const { s, demandes } = service();
    const props = { a: 1 };
    await ports(s, { proprietes: props }).rendrePlage({ debut: 0, fin: 5 }, 0);
    expect((demandes[0]!.parametres as { proprietes: unknown }).proprietes).toEqual(props);
  });

  it("b) échec du rendu → null, sans exception", async () => {
    const { s } = service([{ statut: "en_cours", progression: 0.5 }, { statut: "echec", erreur: { code: "refuse", reessayable: false, message: "non" } as never }]);
    await expect(ports(s).rendrePlage({ debut: 0, fin: 5 }, 0)).resolves.toBeNull();
    expect(s.etat).toHaveBeenCalledTimes(2); // l'échec arrête le suivi tout de suite
  });

  it("b) suivisMax atteint → null (borne : 3 suivis permis, jamais terminé)", async () => {
    const { s } = service([{ statut: "en_cours", progression: 0.1 }]);
    await expect(ports(s, { suivisMax: 3 }).rendrePlage({ debut: 0, fin: 5 }, 0)).resolves.toBeNull();
    expect(s.etat).toHaveBeenCalledTimes(3);
  });

  it("b) terminé au dernier suivi permis → rendu rendu (suivisMax − 1 en cours, puis terminé)", async () => {
    const { s } = service([{ statut: "en_cours", progression: 0.1 }, { statut: "en_cours", progression: 0.2 }, { statut: "termine", sortieCle: "x" }]);
    await expect(ports(s, { suivisMax: 3 }).rendrePlage({ debut: 0, fin: 5 }, 0)).resolves.toEqual({ fichier: "k/t1-plage0.mp4" });
  });

  it("b) l'attente est injectée : appelée entre deux suivis, jamais après le terminé", async () => {
    const { s } = service([{ statut: "en_file", rang: 0 }, { statut: "en_cours", progression: 0.5 }, { statut: "termine", sortieCle: "x" }]);
    const attendre = vi.fn(async () => {});
    await ports(s, { attendre }).rendrePlage({ debut: 0, fin: 5 }, 0);
    expect(attendre).toHaveBeenCalledTimes(2);
    expect(attendre).toHaveBeenCalledWith(2000);
  });

  it("b) soumettre qui lève → null ; signer qui lève → null ; état qui lève → null", async () => {
    const { s } = service();
    (s.soumettre as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error("réseau"));
    await expect(ports(s).rendrePlage({ debut: 0, fin: 5 }, 0)).resolves.toBeNull();
    const { s: s2 } = service();
    await expect(ports(s2, { signer: async () => { throw new Error("signature"); } }).rendrePlage({ debut: 0, fin: 5 }, 0)).resolves.toBeNull();
    const { s: s3 } = service();
    (s3.etat as ReturnType<typeof vi.fn>).mockRejectedValue(new Error("indisponible"));
    await expect(ports(s3).rendrePlage({ debut: 0, fin: 5 }, 0)).resolves.toBeNull();
  });

  it("b) le serveur a oublié le rendu (inconnu) : la même demande est soumise à nouveau, puis suivie", async () => {
    const { s, demandes } = service([{ statut: "inconnu" }, { statut: "termine", sortieCle: "x" }]);
    await expect(ports(s).rendrePlage({ debut: 0, fin: 5 }, 0)).resolves.toEqual({ fichier: "k/t1-plage0.mp4" });
    expect(demandes.length).toBeGreaterThanOrEqual(2);
    expect(new Set(demandes.map((d) => d.idRendu)).size).toBe(1);
  });
});

const PARAMS: ParametresRecollage = {
  segments: [
    { source: "avant", debutSec: 0, finSec: 2 },
    { source: "plage", entree: "plage-0", dureeSec: 2 },
    { source: "avant", debutSec: 4, finSec: 20 },
  ],
  avant: "avant",
  voix: "voix",
  dureeSec: 20,
};

describe("recoller", () => {
  it("c) une demande recollage-plages, file longue, trois entrées signées depuis SA clé, paramètres égaux", async () => {
    const { s, demandes } = service();
    const r = await ports(s).recoller(PARAMS, { avant: "k/avant.mp4", voix: "k/voix.mp3", "plage-0": "k/p0.mp4" });
    expect(demandes).toHaveLength(1);
    const d = demandes[0]!;
    expect(d.operation).toBe("recollage-plages");
    expect(d.file).toBe("longue");
    expect(d.entrees).toEqual({ avant: "signe:k/avant.mp4", voix: "signe:k/voix.mp3", "plage-0": "signe:k/p0.mp4" });
    expect(d.parametres).toEqual(PARAMS);
    expect(d.parametres).not.toBe(PARAMS);
    expect(d.sortie).toEqual({ urlDepot: "depot:k/t1-recolle.mp4", cle: "k/t1-recolle.mp4" });
    expect(d.idRendu).toBe("t1-recollage-0");
    expect(r).toEqual({ fichier: "k/t1-recolle.mp4" });
  });

  it("c) sans voix : exactement les entrées reçues, aucune voix inventée", async () => {
    const { s, demandes } = service();
    await ports(s).recoller({ ...PARAMS, voix: undefined }, { avant: "k/avant.mp4", "plage-0": "k/p0.mp4" });
    expect(Object.keys(demandes[0]!.entrees).sort()).toEqual(["avant", "plage-0"]);
  });

  it("b) échec, suivisMax, refus à l'envoi, signature qui lève → null sans exception", async () => {
    const e = { avant: "k/a" };
    const { s } = service([{ statut: "echec", erreur: { code: "refuse", reessayable: false, message: "non" } as never }]);
    await expect(ports(s).recoller(PARAMS, e)).resolves.toBeNull();
    const { s: s2 } = service([{ statut: "en_cours", progression: 0 }]);
    await expect(ports(s2, { suivisMax: 2 }).recoller(PARAMS, e)).resolves.toBeNull();
    const { s: s3 } = service();
    (s3.soumettre as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error("refusé"));
    await expect(ports(s3).recoller(PARAMS, e)).resolves.toBeNull();
    const { s: s4 } = service();
    await expect(ports(s4, { signer: async () => { throw new Error("x"); } }).recoller(PARAMS, e)).resolves.toBeNull();
  });
});

describe("regarder", () => {
  it("le regard reçu est appelé tel quel (même objet, même argument, même réponse)", async () => {
    const { s } = service();
    const regarder = vi.fn(async () => ({ defauts: [] as DefautVu[] }));
    const p = ports(s, { regarder });
    expect(p.regarder).toBe(regarder);
    const arg = { fichier: "f.mp4", plages: [{ debut: 0, fin: 9 }], scenes: ["s1"] };
    await expect(p.regarder(arg)).resolves.toEqual({ defauts: [] });
    expect(regarder).toHaveBeenCalledWith(arg);
  });
});

const scene = (id: string, debutMs: number, finMs: number, texte: string) => ({ id, debutMs, finMs, texte });
const SCENES = [scene("s1", 0, 4000, "Un"), scene("s2", 4000, 8000, "Deux"), scene("s3", 8000, 12000, "Trois"), scene("s4", 12000, 16000, "Quatre"), scene("s5", 16000, 20000, "Cinq")];
const plan = { mots: [{ texte: "bonjour", debutMs: 0, finMs: 400 }], scenes: SCENES } as unknown as PlanValide;
const defaut: DefautVu = { code: "texte-coupe", nom: "i01", instantSec: 5, partieId: "s2", detail: "Le texte est coupé.", bloquantSiSur: true } as DefautVu;
const entree: EntreeRefaire = { planAvant: plan, planApres: plan, defauts: [defaut], fichierAvant: "k/avant.mp4", voixAvant: "k/voix.mp3", dureeTotaleImages: 500, transitionMaxMs: 0 };

/** Copie figée des règles de `lireParametresRecollage` (`studio-rendu/src/operations/recollage-plages.ts:43-70`), sans l'importer. */
function accepte(p: Record<string, unknown>): string | null {
  const num = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);
  const nom = (v: unknown): v is string => typeof v === "string" && v.trim() !== "";
  if (!nom(p.avant)) return "avant";
  if (p.voix !== undefined && !nom(p.voix)) return "voix";
  if (!num(p.dureeSec) || p.dureeSec <= 0) return "duree";
  if (!Array.isArray(p.segments) || !p.segments.length) return "segments";
  let fin: number | undefined;
  const noms = new Set<string>();
  for (const brut of p.segments as Record<string, unknown>[]) {
    if (brut.source === "avant") {
      if (!num(brut.debutSec) || !num(brut.finSec) || brut.debutSec < 0 || (brut.finSec as number) - brut.debutSec <= 1e-6) return "avant-bornes";
      if (fin !== undefined && Math.abs(brut.debutSec - fin) > 1e-6) return "trou-ou-recouvrement";
      fin = brut.finSec as number;
    } else if (brut.source === "plage") {
      if (!nom(brut.entree) || !num(brut.dureeSec) || brut.dureeSec <= 0) return "plage";
      if (brut.entree === p.avant || brut.entree === p.voix || noms.has(brut.entree)) return "doublon";
      noms.add(brut.entree);
      fin = undefined;
    } else return "source";
  }
  return null;
}

describe("chaîne complète avec refaireParties", () => {
  it("d) état refaite, 1 rendu de plage, 1 recollage, 1 regard ; les noms cités ⊆ clés des entrées signées", async () => {
    const { s, demandes } = service();
    const regarder = vi.fn(async () => ({ defauts: [] as DefautVu[] }));
    const r = await refaireParties(entree, ports(s, { regarder }));
    expect(r.etat).toBe("refaite");
    expect(r.fichier).toBe("k/t1-recolle.mp4");
    expect(demandes.filter((d) => d.operation === "composition")).toHaveLength(1);
    const rec = demandes.filter((d) => d.operation === "recollage-plages");
    expect(rec).toHaveLength(1);
    expect(regarder).toHaveBeenCalledTimes(1);
    const p = rec[0]!.parametres as unknown as ParametresRecollage;
    const cites = [p.avant, ...(p.voix ? [p.voix] : []), ...p.segments.filter((x) => x.source === "plage").map((x) => (x as { entree: string }).entree)];
    for (const c of cites) expect(Object.keys(rec[0]!.entrees)).toContain(c);
    expect(rec[0]!.entrees.avant).toBe("signe:k/avant.mp4");
    expect(rec[0]!.entrees["plage-0"]).toBe("signe:k/t1-plage0.mp4");
  });

  it("d) un morceau qui échoue : la vidéo d'avant est gardée, aucun recollage", async () => {
    const { s, demandes } = service([{ statut: "echec", erreur: { code: "refuse", reessayable: false, message: "non" } as never }]);
    const r = await refaireParties(entree, ports(s));
    expect(r.etat).toBe("echec");
    expect(r.fichier).toBe("k/avant.mp4");
    expect(demandes.some((d) => d.operation === "recollage-plages")).toBe(false);
  });

  it("d) liste vide : aucune scène à refaire → aucune demande de rendu", async () => {
    const { s, demandes } = service();
    const r = await refaireParties({ ...entree, defauts: [] }, ports(s));
    expect(r.etat).toBe("rien");
    expect(demandes).toHaveLength(0);
  });

  it("e) les paramètres produits sont acceptés par les règles de lireParametresRecollage (copie figée)", async () => {
    const { s, demandes } = service();
    await refaireParties(entree, ports(s));
    const rec = demandes.find((d) => d.operation === "recollage-plages")!;
    expect(accepte(rec.parametres)).toBeNull();
    expect(accepte({ ...rec.parametres, avant: "" })).toBe("avant");
  });
});

describe("garde de texte et absence d'appelant", () => {
  const texte = () => readFileSync(SOURCE, "utf8");
  it("f) le fichier n'importe ni montage-, ni tutoriel-, ni dépense, ni crédits, ni réglage, ni le serveur de rendu", () => {
    const imports = [...texte().matchAll(/(?:from|import)\s*\(?\s*["']([^"']+)["']/g)].map((m) => m[1]!);
    expect(imports.length).toBeGreaterThan(0);
    for (const i of imports) expect(i).not.toMatch(/montage-|services\/tutoriel-|depense-claude-video|credits|reglages|studio-rendu/);
    expect(texte()).not.toMatch(/lireParametre/);
    expect(imports.sort()).toEqual(["@/briques/refaire-parties", "@/briques/rendu-par-plages", "@/fournisseurs/rendu/client", "@/fournisseurs/types", "server-only"].sort());
  });

  it("g) aucun fichier de src/** n'importe rendu-commun (éteint)", () => {
    const trouves: string[] = [];
    const parcourir = (d: string) => {
      for (const n of readdirSync(d)) {
        const c = join(d, n);
        if (statSync(c).isDirectory()) parcourir(c);
        else if (/\.(ts|tsx)$/.test(n) && c !== SOURCE && /retouche-chat\/rendu-commun|\.\/rendu-commun/.test(readFileSync(c, "utf8"))) trouves.push(c);
      }
    };
    parcourir(join(RACINE, "src"));
    expect(trouves).toEqual([]);
  });

  it("le fichier tient en 120 lignes au plus", () => {
    expect(texte().split("\n").length).toBeLessThanOrEqual(120);
  });
});
