/**
 * T-EXT-33 · dépôt du tutoriel d'outil (un dossier ou une phrase). Dépendances injectées (doubles comptés), dépôts en
 * mémoire, aucun appel réel, aucun appel payant, 0 €. Tout éteint par défaut : seul `true` exact allume.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { mockHeaders, mockNavigation } from "../helpers/next-mocks";

vi.mock("next/headers", () => mockHeaders);
vi.mock("next/navigation", () => mockNavigation);
const session = vi.hoisted(() => ({ ouverte: true }));
vi.mock("@/services/auth", () => ({
  exigerSession: vi.fn(async () => {
    if (!session.ouverte) throw new Error("session exigée");
    return {};
  }),
}));

import { lireEntreesTutoriel, PHRASE_DEPOT_MAX, PHRASE_DEPOT_MIN } from "@/moteurs/montage-tutoriel-outil/entrees";
import { PHRASE_MAX, PHRASE_MIN } from "@/moteurs/montage-tutoriel-outil/equipe/chef-de-projet";
import { TAILLE_ZIP_MAX } from "@/moteurs/montage-tutoriel-outil/securite-entrees";
import { ErreurStudio } from "@/services/_commun";
import type { RapportEntree, ResultatZip } from "@/services/zip-tutoriel";
import { extraireZipSur, PARAM_ENTREE_ZIP } from "@/services/zip-tutoriel";

const d = await import("@/services/tutoriel-depot");

const INTERDIT = /€|euros?\b|\bprix\b|\bco[ûu]ts?\b/i;
const TOUT: Awaited<ReturnType<typeof d.lireInterrupteursTutoriel>> = { formulaire: true, dossier: true, phrase: true };
const RAPPORT_VIDE: RapportEntree = { refus: [], ignores: [], masques: [], imagesEcartees: [] };

function banc(options: { interrupteurs?: typeof TOUT; extraire?: ResultatZip; lancer?: "lancee" | "accord-requis" | "refus"; taille?: number } = {}) {
  const compte = { brouillons: [] as { entrees: Record<string, unknown>; titre: string }[], extraire: [] as { attestationImages: boolean }[], octets: 0, lancements: [] as string[], abandons: [] as string[], ratios: [] as string[][] };
  const dep: import("@/services/tutoriel-depot").DependancesDepotTutoriel = {
    interrupteurs: async () => options.interrupteurs ?? TOUT,
    fichier: async (id) => ({ id, nom: "Mon-dossier_ventes.zip", taille: options.taille ?? 1000, cleStockage: `studio/dev/entree/e1/${id}.zip` }),
    octets: async () => {
      compte.octets++;
      return new Uint8Array([1, 2, 3]);
    },
    extraire: async (_o, opts) => {
      compte.extraire.push(opts);
      return options.extraire ?? { ok: true, fichiers: new Map(), rapport: RAPPORT_VIDE };
    },
    brouillon: async (e) => {
      compte.brouillons.push({ entrees: e.entrees, titre: e.titre });
      return { id: `v${compte.brouillons.length}` };
    },
    ratios: async (_id, r) => void compte.ratios.push(r),
    lancer: async (id) => {
      compte.lancements.push(id);
      if (options.lancer === "refus") throw new ErreurStudio("X", "Le lancement est refusé.");
      return options.lancer === "accord-requis" ? { statut: "accord-requis", centimes: 5, phrase: "x" } : { statut: "lancee", travailId: "t1" };
    },
    abandonner: async (id) => void compte.abandons.push(id),
  };
  return { compte, dep };
}
const dossier = { mode: "dossier" as const, fichierId: "f-abc", attestationImages: true };
const phrase = { mode: "phrase" as const, phrase: "Un tableau de bord pour un atelier" };

beforeEach(() => {
  session.ouverte = true;
});

describe("interrupteurs : seul `true` exact allume", () => {
  it("clés absentes, \"true\", 1, null, lecture qui lève : tout éteint", async () => {
    for (const valeur of [undefined, "true", 1, null, "oui"]) {
      const r = await d.lireInterrupteursTutoriel(async (_id, defaut) => (valeur === undefined ? defaut : valeur));
      expect(r).toEqual({ formulaire: false, dossier: false, phrase: false });
    }
    expect(await d.lireInterrupteursTutoriel(async () => { throw new Error("panne"); })).toEqual({ formulaire: false, dossier: false, phrase: false });
  });
  it("true exact : allumé, clé par clé ; les clés sont celles de la fiche", async () => {
    const r = await d.lireInterrupteursTutoriel(async (id) => id === "tutoriel.entreeZip");
    expect(r).toEqual({ formulaire: false, dossier: true, phrase: false });
    expect(d.PARAM_FORMULAIRE).toBe("tutoriel.formulaire");
    expect(d.PARAM_ENTREE_PHRASE).toBe("tutoriel.entreePhrase");
    expect(PARAM_ENTREE_ZIP).toBe("tutoriel.entreeZip");
  });
  it("exigerTutorielAllume : éteint → refus avec la phrase, allumé → rien", async () => {
    await expect(d.exigerTutorielAllume(async () => false)).rejects.toThrow("Le tutoriel n'est pas encore ouvert : votre demande n'est pas envoyée.");
    await expect(d.exigerTutorielAllume(async () => "true")).rejects.toThrow(d.PHRASE_TUTORIEL_FERME);
    await expect(d.exigerTutorielAllume(async () => true)).resolves.toBeUndefined();
  });
});

describe("éteint : rien n'est créé", () => {
  it("formulaire éteint : refus, aucun brouillon, aucune lecture, aucun lancement", async () => {
    const b = banc({ interrupteurs: { formulaire: false, dossier: true, phrase: true } });
    const r = await d.deposerTutoriel(dossier, b.dep);
    expect(r).toEqual({ statut: "refusee", phrase: "Le tutoriel n'est pas encore ouvert : votre demande n'est pas envoyée." });
    expect(b.compte).toMatchObject({ brouillons: [], octets: 0, extraire: [], lancements: [] });
  });
  it("sans session : refus (exception), rien n'est créé", async () => {
    session.ouverte = false;
    const b = banc();
    await expect(d.deposerTutoriel(phrase, b.dep)).rejects.toThrow("session exigée");
    expect(b.compte.brouillons).toEqual([]);
  });
  it("tutoriel.entreeZip éteint : le choix du dossier est refusé", async () => {
    const b = banc({ interrupteurs: { formulaire: true, dossier: false, phrase: true } });
    const r = await d.deposerTutoriel(dossier, b.dep);
    expect(r).toMatchObject({ statut: "refusee", phrase: "L'envoi d'un dossier n'est pas ouvert pour le moment." });
    expect(b.compte.brouillons).toEqual([]);
    expect(b.compte.octets).toBe(0);
  });
  it("phrase sans l'interrupteur phrase : refusée", async () => {
    const b = banc({ interrupteurs: { formulaire: true, dossier: true, phrase: false } });
    const r = await d.deposerTutoriel(phrase, b.dep);
    expect(r.statut).toBe("refusee");
    expect(b.compte.brouillons).toEqual([]);
  });
});

describe("dossier", () => {
  it("accepté : brouillon avec depot.mode « dossier » et l'attestation ; seule la référence du fichier est gardée", async () => {
    const b = banc();
    const r = await d.deposerTutoriel(dossier, b.dep);
    expect(r).toEqual({ statut: "lancee", videoId: "v1" });
    const e = b.compte.brouillons[0].entrees.tutorielOutil as Record<string, unknown>;
    expect(e.depot).toEqual({ mode: "dossier", fichierId: "f-abc", attestationImages: true });
    expect(e.fin).toBe("aucune");
    expect(JSON.stringify(b.compte.brouillons[0])).not.toContain("fichiers");
    expect(b.compte.brouillons[0].titre).toBe("Mon dossier ventes");
    expect(b.compte.lancements).toEqual(["v1"]);
    expect(b.compte.ratios).toEqual([["4:5", "9:16", "1:1"]]);
    expect(lireEntreesTutoriel(b.compte.brouillons[0].entrees).depot).toEqual({ mode: "dossier", fichierId: "f-abc", attestationImages: true });
  });
  it("refusé par le dossier : les messages du rapport sont rendus tels quels, aucun brouillon", async () => {
    const rapport: RapportEntree = { ...RAPPORT_VIDE, refus: ["Un fichier du dossier n'est pas permis.", "Le dossier est trop gros."] };
    const b = banc({ extraire: { ok: false, rapport } });
    const r = await d.deposerTutoriel(dossier, b.dep);
    expect(r).toMatchObject({ statut: "refusee", rapport: { refus: rapport.refus } });
    expect(b.compte.brouillons).toEqual([]);
    expect(b.compte.lancements).toEqual([]);
  });
  it("case non cochée (ou autre chose que true) : attestationImages false transmis et gardé", async () => {
    for (const attestationImages of [false, undefined, "true" as unknown as boolean]) {
      const b = banc();
      await d.deposerTutoriel({ mode: "dossier", fichierId: "f-abc", attestationImages }, b.dep);
      expect(b.compte.extraire).toEqual([{ attestationImages: false }]);
      expect((b.compte.brouillons[0].entrees.tutorielOutil as { depot: { attestationImages: boolean } }).depot.attestationImages).toBe(false);
    }
  });
  it("trop gros : refusé AVANT toute lecture des octets", async () => {
    const b = banc({ taille: TAILLE_ZIP_MAX + 1 });
    const r = await d.deposerTutoriel(dossier, b.dep);
    expect(r.statut).toBe("refusee");
    expect(b.compte.octets).toBe(0);
    expect(b.compte.brouillons).toEqual([]);
  });
  it("sans fichier : refus ; fichier inconnu : refus lisible", async () => {
    const b = banc();
    expect((await d.deposerTutoriel({ mode: "dossier" }, b.dep)).statut).toBe("refusee");
    b.dep.fichier = async () => {
      throw new ErreurStudio("FICHIER_INCONNU", "Ce fichier n'est pas arrivé. Envoyez-le à nouveau.");
    };
    expect(await d.deposerTutoriel(dossier, b.dep)).toMatchObject({ statut: "refusee", phrase: "Ce fichier n'est pas arrivé. Envoyez-le à nouveau." });
  });
  it("la VRAIE extraction (T-EXT-41, réglage allumé par un double) refuse des octets qui ne sont pas un zip", async () => {
    const b = banc();
    b.dep.extraire = (o, opts) => extraireZipSur(o, opts, { lireParametre: async () => true, inflate: () => new Uint8Array(), journaliser: async () => undefined });
    const r = await d.deposerTutoriel(dossier, b.dep);
    expect(r.statut).toBe("refusee");
    expect((r as { rapport?: RapportEntree }).rapport?.refus.length).toBeGreaterThan(0);
    expect(b.compte.brouillons).toEqual([]);
  });
  it("la VRAIE extraction éteinte (réglage absent) : « pas ouvert », rien décompressé", async () => {
    const b = banc();
    b.dep.extraire = (o, opts) => extraireZipSur(o, opts, { lireParametre: async (_i, defaut) => defaut, inflate: () => { throw new Error("jamais"); }, journaliser: async () => undefined });
    expect(await d.deposerTutoriel(dossier, b.dep)).toMatchObject({ statut: "refusee", rapport: { refus: ["L'envoi d'un dossier n'est pas ouvert pour le moment."] } });
  });
});

describe("phrase", () => {
  it("9 caractères ou 301 : refus ; 10 et 300 : acceptés ; espaces autour retirés", async () => {
    for (const n of [9, 301]) {
      const b = banc();
      expect((await d.deposerTutoriel({ mode: "phrase", phrase: "a".repeat(n) }, b.dep)).statut).toBe("refusee");
      expect(b.compte.brouillons).toEqual([]);
    }
    for (const n of [10, 300]) {
      const b = banc();
      expect((await d.deposerTutoriel({ mode: "phrase", phrase: `  ${"a".repeat(n)}  ` }, b.dep)).statut).toBe("lancee");
      expect((b.compte.brouillons[0].entrees.tutorielOutil as { depot: { phrase: string } }).depot.phrase).toBe("a".repeat(n));
    }
  });
  it("la phrase est celle de Williams, mot pour mot, et aucun dossier n'est ouvert", async () => {
    const b = banc();
    await d.deposerTutoriel(phrase, b.dep);
    expect((b.compte.brouillons[0].entrees.tutorielOutil as { depot: unknown }).depot).toEqual({ mode: "phrase", phrase: "Un tableau de bord pour un atelier" });
    expect(b.compte.octets).toBe(0);
    expect(b.compte.extraire).toEqual([]);
  });
  it("les limites sont celles du chef de projet", () => {
    expect([PHRASE_DEPOT_MIN, PHRASE_DEPOT_MAX]).toEqual([PHRASE_MIN, PHRASE_MAX]);
  });
});

describe("fin, parcours, formats", () => {
  it("fin absente : « aucune » ; « prendre-rendez-vous » gardée ; « commentez » refusée", async () => {
    const a = banc();
    await d.deposerTutoriel(phrase, a.dep);
    expect((a.compte.brouillons[0].entrees.tutorielOutil as { fin: string }).fin).toBe("aucune");
    const p = banc();
    await d.deposerTutoriel({ ...phrase, fin: "prendre-rendez-vous" }, p.dep);
    expect((p.compte.brouillons[0].entrees.tutorielOutil as { fin: string }).fin).toBe("prendre-rendez-vous");
    const c = banc();
    expect((await d.deposerTutoriel({ ...phrase, fin: "commentez" }, c.dep)).statut).toBe("refusee");
    expect(c.compte.brouillons).toEqual([]);
  });
  it("gabarit inconnu : ignoré (aucune clé) ; connu : gardé", async () => {
    const i = banc();
    await d.deposerTutoriel({ ...phrase, gabarit: "G-Inconnu" }, i.dep);
    expect(i.compte.brouillons[0].entrees.tutorielOutil).not.toHaveProperty("gabarit");
    const k = banc();
    await d.deposerTutoriel({ ...phrase, gabarit: "G-Flux" }, k.dep);
    expect((k.compte.brouillons[0].entrees.tutorielOutil as { gabarit: string }).gabarit).toBe("G-Flux");
    expect(lireEntreesTutoriel(k.compte.brouillons[0].entrees).gabarit).toBe("G-Flux");
  });
  it("formats : le principal 4:5 est exigé, un format inconnu refusé", async () => {
    const b = banc();
    expect((await d.deposerTutoriel({ ...phrase, ratios: ["9:16", "1:1"] }, b.dep)).statut).toBe("refusee");
    expect((await d.deposerTutoriel({ ...phrase, ratios: ["4:5", "16:9"] }, b.dep)).statut).toBe("refusee");
    expect((await d.deposerTutoriel({ ...phrase, ratios: "4:5" }, b.dep)).statut).toBe("refusee");
    expect(b.compte.brouillons).toEqual([]);
    expect((await d.deposerTutoriel({ ...phrase, ratios: ["1:1", "4:5"] }, b.dep)).statut).toBe("lancee");
    expect(b.compte.ratios).toEqual([["4:5", "1:1"]]);
  });
  it("mode inconnu : refus", async () => {
    const b = banc();
    expect((await d.deposerTutoriel({ mode: "autre" as never }, b.dep)).statut).toBe("refusee");
    expect(b.compte.brouillons).toEqual([]);
  });
});

describe("lancement", () => {
  it("lancement refusé (accord requis) : brouillon abandonné, refus", async () => {
    const b = banc({ lancer: "accord-requis" });
    expect((await d.deposerTutoriel(phrase, b.dep)).statut).toBe("refusee");
    expect(b.compte.abandons).toEqual(["v1"]);
  });
  it("lancement qui lève une erreur du Studio : brouillon abandonné, phrase rendue", async () => {
    const b = banc({ lancer: "refus" });
    expect(await d.deposerTutoriel(phrase, b.dep)).toEqual({ statut: "refusee", phrase: "Le lancement est refusé." });
    expect(b.compte.abandons).toEqual(["v1"]);
  });
  it("lancement réussi : aucun abandon, un seul lancement", async () => {
    const b = banc();
    await d.deposerTutoriel(phrase, b.dep);
    expect(b.compte.abandons).toEqual([]);
    expect(b.compte.lancements).toHaveLength(1);
  });
  it("le lancement par défaut est celui du format sans prix : montant nul (lancerAvecAccord(id, 0, 0))", async () => {
    const { readFileSync } = await import("node:fs");
    const src = readFileSync("src/services/tutoriel-depot.ts", "utf8");
    expect(src).toContain("lancerAvecAccord(videoId, 0, 0)");
    expect(src).not.toMatch(/creerBrouillon\(/);
    expect(src).not.toMatch(/lireZip|from "@\/lib\/zip"/);
  });
});

describe("0 € : aucun appel payant, aucun montant", () => {
  it("aucun fetch, aucune sortie ne contient de montant ni de mot de prix", async () => {
    const fetchRefuse = vi.fn(() => {
      throw new Error("fetch interdit dans ce test");
    });
    vi.stubGlobal("fetch", fetchRefuse);
    try {
      const sorties: unknown[] = [];
      const cas: [Partial<Parameters<typeof banc>[0]>, Parameters<typeof d.deposerTutoriel>[0]][] = [
        [{}, phrase],
        [{}, dossier],
        [{ interrupteurs: { formulaire: false, dossier: false, phrase: false } }, phrase],
        [{ interrupteurs: { formulaire: true, dossier: false, phrase: true } }, dossier],
        [{ extraire: { ok: false, rapport: { ...RAPPORT_VIDE, refus: ["Le dossier est trop gros."] } } }, dossier],
        [{ lancer: "accord-requis" }, phrase],
        [{}, { ...phrase, fin: "commentez" }],
        [{}, { ...phrase, ratios: [] }],
        [{}, { mode: "phrase", phrase: "court" }],
      ];
      for (const [options, demande] of cas) {
        const b = banc(options);
        sorties.push(await d.deposerTutoriel(demande, b.dep), b.compte.brouillons);
      }
      sorties.push(d.PHRASE_TUTORIEL_FERME, d.PHRASE_PHRASE_FERMEE, d.PHRASE_AUCUNE_ENTREE);
      expect(JSON.stringify(sorties)).not.toMatch(INTERDIT);
      expect(fetchRefuse).not.toHaveBeenCalled();
    } finally {
      vi.unstubAllGlobals();
    }
  });
});

describe("entrees.ts : lecture tolérante", () => {
  it("dépôt mal formé ou valeur inconnue : ignorés, jamais une erreur ; clé absente : comme avant", () => {
    expect(lireEntreesTutoriel({ tutorielOutil: { idee: "x" } })).toEqual({ idee: "x" });
    for (const depot of [null, 3, "x", {}, { mode: "zip" }, { mode: "dossier" }, { mode: "dossier", fichierId: "" }, { mode: "phrase", phrase: "court" }, { mode: "phrase", phrase: "a".repeat(301) }, { mode: "phrase", phrase: 4 }]) {
      expect(lireEntreesTutoriel({ tutorielOutil: { depot, gabarit: "G-Inconnu" } })).toEqual({});
    }
    expect(lireEntreesTutoriel({ tutorielOutil: { depot: { mode: "dossier", fichierId: "f-1", attestationImages: "true" } } })).toEqual({ depot: { mode: "dossier", fichierId: "f-1", attestationImages: false } });
    expect(lireEntreesTutoriel({ tutorielOutil: { depot: { mode: "phrase", phrase: "Un tri d'e-mails pour moi" }, gabarit: "G-Decision" } })).toEqual({ depot: { mode: "phrase", phrase: "Un tri d'e-mails pour moi" }, gabarit: "G-Decision" });
  });
});
