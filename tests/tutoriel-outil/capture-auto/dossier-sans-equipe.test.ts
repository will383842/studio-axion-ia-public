/**
 * FILM D'UN DOSSIER SANS ÉQUIPE : dossier .zip, script collé, sans voix, équipe de rôles ÉTEINTE, capture automatique allumée. Le scenario.json du
 * dossier tient lieu de parcours : la chaîne attend le film (TO_FILM_A_CAPTURER), la capture écrit sa demande, le poste répond avec un VRAI petit MP4,
 * le film est rangé, la chaîne va au bout et le rendu porte la navigation filmée (pas de plan composé). 0 appel HeyGen / ElevenLabs / Claude (modules piégés).
 */
import { createHash } from "node:crypto";
import { mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mockHeaders, mockNavigation } from "../../helpers/next-mocks";

vi.mock("next/headers", () => mockHeaders);
vi.mock("next/navigation", () => mockNavigation);
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/services/auth", () => ({
  exigerSession: vi.fn(async () => {
    throw new Error("session exigée");
  }),
}));

const pieges = vi.hoisted(() => {
  const appels: string[] = [];
  const moduleEspion = (nom: string) => async (importOriginal: () => Promise<Record<string, unknown>>) => {
    const vrai = await importOriginal();
    return Object.fromEntries(
      Object.entries(vrai).map(([cle, v]) => [
        cle,
        typeof v === "function" && /^[a-z]/.test(cle)
          ? () => {
              appels.push(`${nom}.${cle}`);
              throw new Error(`${nom}.${cle} ne doit pas être appelé par la capture automatique`);
            }
          : v,
      ]),
    );
  };
  return { appels, moduleEspion };
});
vi.mock("@/fournisseurs/heygen/voix", (o) => pieges.moduleEspion("heygen/voix")(o as never));
vi.mock("@/fournisseurs/heygen/client", (o) => pieges.moduleEspion("heygen/client")(o as never));
vi.mock("@/fournisseurs/heygen/rendus", (o) => pieges.moduleEspion("heygen/rendus")(o as never));
vi.mock("@/fournisseurs/credits/heygen", (o) => pieges.moduleEspion("credits/heygen")(o as never));
vi.mock("@/fournisseurs/credits/elevenlabs", (o) => pieges.moduleEspion("credits/elevenlabs")(o as never));
// Claude : seul l'envoi (réseau, payant) est piégé ; `extraireJson` et les constantes sont des fonctions pures que la chaîne lit.
vi.mock("@/fournisseurs/claude/client", async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  envoyerMessage: () => {
    pieges.appels.push("claude/client.envoyerMessage");
    throw new Error("claude/client.envoyerMessage ne doit pas être appelé par la capture automatique");
  },
}));

import type { CommandeFabrication, Travail } from "@/domaine/types";
import { creerMoteurTutorielOutil } from "@/moteurs/montage-tutoriel-outil";
import type { EtatTutoriel, OutilsTutoriel } from "@/moteurs/montage-tutoriel-outil";
import { commandeTutoriel, outilsDoubles, une, type Journal } from "../doubles";

const { reinitialiserDepots, depots } = await import("@/donnees/memoire");
const { avancerCapturesTutoriel } = await import("@/services/tutoriel-capture-auto");
const { ecrireParametre } = await import("@/services/_commun");
const { dureeFilmAttendueMs } = await import("@/moteurs/montage-tutoriel-outil/capture-auto/contrat");

const T0 = Date.UTC(2026, 10, 19, 9);
const ZIP = Buffer.from("PK-zip-de-test");
const FILM = readFileSync(join(__dirname, "../fixtures/film-court.mp4"));
const DOSSIER_STOCKS = join(__dirname, "../../../outils/maquettes-tableaux-de-bord/05-stocks");
const SCENARIO = JSON.parse(readFileSync(join(DOSSIER_STOCKS, "scenario.json"), "utf8")) as { maquette: string; largeur: number; hauteur: number };
const SCRIPT_STOCKS = readFileSync(join(DOSSIER_STOCKS, "script-court.txt"), "utf8").trim();
const SCRIPT_QUELCONQUE = Array.from({ length: 90 }, (_, i) => `mot${i % 11}`).join(" ") + " fin.";
const LE = "2026-11-21T08:00:00.000Z";

let boite: string;
const puts = new Map<string, Buffer>();

const commande = (script: string, ratios: ("4:5" | "9:16" | "16:9")[] = ["4:5"], avecVoix = false): CommandeFabrication =>
  commandeTutoriel({
    ratios,
    ...(avecVoix ? {} : { distribution: [] }),
    script: { blocs: [], texteComplet: script },
    entrees: { tutorielOutil: { scriptColle: true, depot: { mode: "dossier", fichierId: "f-dossier1", attestationImages: true }, fin: "aucune", ...(avecVoix ? {} : { modeVoix: "sans-voix" }) } },
  } as never);

const stockage = {
  mode: "simulation",
  preparerDepot: async (d: { fichierId: string; entiteId: string }) => ({ cleStockage: `studio/dev/entree/${d.entiteId}/${d.fichierId}.mp4`, urlDepot: "" }),
  confirmerDepot: async (cle: string) => {
    const o = puts.get(`https://depot.test/${cle}`);
    return o ? { ok: true, sha256: createHash("sha256").update(o).digest("hex"), taille: o.length } : { ok: false };
  },
  urlLecture: async (c: string) => `https://stockage.test/${c}`,
  urlLectureDuree: async (c: string) => `https://stockage.test/${c}`,
  urlDepotDuree: async (c: string) => `https://depot.test/${c}`,
};

type Port = NonNullable<OutilsTutoriel["filmDossier"]>;

/** Mène le moteur (SANS équipe, SANS voix) jusqu'à la pause du film (ou jusqu'au bout), puis installe vidéo, version et travail dans les dépôts. */
async function lancer(script: string, filmDossier?: Port, options: { avecVoix?: boolean; style?: Record<string, unknown>; ratios?: ("4:5" | "9:16" | "16:9")[]; commande?: CommandeFabrication } = {}) {
  const j: Journal = { voix: [], claude: [], rendus: [] };
  const o = { ...outilsDoubles(j), ...(filmDossier ? { filmDossier } : {}), ...(options.style ? { sousTitres: { style: options.style } } : {}) } as OutilsTutoriel;
  expect(o.equipe).toBeUndefined();
  const moteur = creerMoteurTutorielOutil({ outils: une(o) });
  const c = options.commande ?? commande(script, options.ratios, options.avecVoix);
  let t: Travail = await moteur.lancer(c, { travailId: "t-to", versionId: "ver-1", titre: "Tuto", maintenant: T0 });
  const mener = async (version: CommandeFabrication, depart: number) => {
    for (let i = depart; i < depart + 400; i++) {
      t = (await moteur.avancer(t, version, T0 + i * 1000)).travail;
      if (["termine", "echec", "annule"].includes(t.statut) || t.parametres?.pause) break;
    }
  };
  await mener(c, 0);
  await depots().videos.enregistrer({ id: "v-to", titre: "Mon tutoriel", formatId: "tutoriel-outil", statut: "en_fabrication", entrees: c.entrees, creeLe: LE, modifieLe: LE } as never);
  await depots().versions.enregistrer({ id: "ver-1", videoId: "v-to", numero: 1, statut: "en_fabrication", commande: c, creeLe: LE, modifieLe: LE } as never);
  await depots().travaux.enregistrer({ ...t, id: "t-to", cibleId: "v-to", versionId: "ver-1", type: "fabrication", creeLe: LE, modifieLe: LE } as never);
  await depots().fichiers.enregistrer({ id: "f-dossier1", cleStockage: "studio/dev/entree/v-to/f-dossier1.zip", nom: "d.zip", mime: "application/zip", taille: ZIP.length, origine: "depot", statut: "pret", creeLe: LE, modifieLe: LE } as never);
  return { j, t: () => t, etat: () => t.parametres?.tutoriel as EtatTutoriel, suite: async () => {
    const apres = (await depots().travaux.obtenir("t-to"))!;
    t = { ...apres, statut: "en_cours" };
    await mener((await depots().versions.obtenir("ver-1"))!.commande, 300);
    return t;
  } };
}

const cloches: { titre: string; message: string }[] = [];
const dep = () => ({
  racine: boite,
  allumee: async () => true,
  stockage: async () => stockage as never,
  cloche: async (n: { titre: string; message: string }) => {
    cloches.push(n);
    await depots().notifications.enregistrer({ id: `not-${cloches.length}`, lue: false, creeLe: LE, modifieLe: LE, ...n } as never);
  },
});

beforeEach(async () => {
  delete (globalThis as Record<symbol, unknown>)[Symbol.for("studio-axion-ia.capture-auto")];
  reinitialiserDepots();
  await ecrireParametre("tutoriel.claude", false); // règle du pilote : jamais supposer « absent = éteint »
  puts.clear();
  cloches.length = 0;
  pieges.appels.length = 0;
  boite = mkdtempSync(join(tmpdir(), "film-dossier-"));
  for (const d of ["demandes", "reponses", "echecs"]) mkdirSync(join(boite, d));
  writeFileSync(join(boite, "PRET"), "");
  writeFileSync(join(boite, "pouls"), new Date().toISOString() + "\n");
  vi.stubGlobal("fetch", async (url: string, init?: RequestInit) => {
    if (init?.method === "PUT") {
      puts.set(url, Buffer.from(init.body as Uint8Array));
      return new Response(null, { status: 200 });
    }
    return new Response(ZIP);
  });
});
afterEach(() => {
  vi.unstubAllGlobals();
  rmSync(boite, { recursive: true, force: true });
});

/** Joue le rôle du veilleur : prend la demande et rend un VRAI petit MP4 avec navigation.json et ffprobe.json cohérents. */
function repondre(): { maquette: string; largeur: number; hauteur: number } {
  const [nom] = readdirSync(join(boite, "demandes"));
  const calage = JSON.parse(readFileSync(join(boite, "demandes", nom!, "calage.json"), "utf8")) as { dureeVoixMs: number; etapes: { id: string; debutMs: number; finMs: number }[] };
  const scenario = JSON.parse(readFileSync(join(boite, "demandes", nom!, "scenario.json"), "utf8")) as { maquette: string; largeur: number; hauteur: number };
  rmSync(join(boite, "demandes", nom!), { recursive: true });
  const cible = join(boite, "reponses", nom!);
  mkdirSync(cible);
  writeFileSync(join(cible, "etat.txt"), "ok\nOK\n");
  writeFileSync(join(cible, "navigation.mp4"), FILM);
  writeFileSync(
    join(cible, "navigation.json"),
    JSON.stringify({
      version: "navigation-filmee.v1", maquette: scenario.maquette, largeur: scenario.largeur, hauteur: scenario.hauteur, debutFilmMs: 0, dureeVoixMs: calage.dureeVoixMs,
      cibles: calage.etapes.map((e) => ({ etapeId: e.id, instantMs: e.debutMs + 600, finMs: e.finMs, zonePct: { x: 10, y: 10, largeur: 30, hauteur: 10 } })),
    }),
  );
  writeFileSync(
    join(cible, "ffprobe.json"),
    JSON.stringify({ streams: [{ codec_type: "video", codec_name: "h264", width: scenario.largeur * 2, height: scenario.hauteur * 2 }], format: { duration: String(dureeFilmAttendueMs(calage.dureeVoixMs) / 1000) } }),
  );
  return scenario;
}

const rendusComposition = (j: Journal) => j.rendus.filter((d) => d.operation === "composition");
const proprietes = (d: { parametres: Record<string, unknown> }) => d.parametres.proprietes as Record<string, unknown> & { navigation?: Record<string, unknown> };

async function deDossierAuBout(script: string, ratios?: ("4:5" | "9:16" | "16:9")[], style?: Record<string, unknown>) {
  const lireScenario = vi.fn(async () => SCENARIO as unknown);
  const m = await lancer(script, { captureAuto: true, lireScenario }, { ratios, ...(style ? { style } : {}) });
  expect(m.t().parametres?.pause).toMatchObject({ code: "TO_FILM_A_CAPTURER" });
  expect(m.etat().scenarioDossier?.maquette).toBe("05-stocks");
  expect(m.etat().audio?.fournisseur).toBe("aucune");
  expect(lireScenario).toHaveBeenCalledTimes(1);
  expect(rendusComposition(m.j)).toHaveLength(0);

  await avancerCapturesTutoriel(dep()); // écrit la demande
  const demandes = readdirSync(join(boite, "demandes"));
  expect(demandes).toHaveLength(1);
  const scenarioDemande = JSON.parse(readFileSync(join(boite, "demandes", demandes[0]!, "scenario.json"), "utf8")) as { maquette: string; largeur: number; hauteur: number };
  expect(scenarioDemande).toMatchObject({ maquette: "05-stocks", largeur: 1080, hauteur: 1350 });
  repondre();
  await avancerCapturesTutoriel(dep()); // relit, range, efface
  expect(readdirSync(join(boite, "reponses"))).toEqual([]);
  expect((await depots().travaux.obtenir("t-to"))!.parametres?.pause).toBeUndefined();
  const t = await m.suite();
  return { m, t, lireScenario };
}

describe("film d'un dossier sans équipe", () => {
  it("script de la maquette : pause film, capture, film rangé, rendu AVEC navigation filmée, 0 appel piégé", async () => {
    const { m, t } = await deDossierAuBout(SCRIPT_STOCKS, ["4:5", "9:16", "16:9"]);
    expect(t.erreur).toBeUndefined();
    expect(t.statut).toBe("termine");
    expect(m.etat().reserves.filter((r) => /Film de l'outil/.test(r))).toEqual([]);
    const cleFilm = [...puts.entries()].find(([, o]) => o.equals(FILM))?.[0];
    expect(cleFilm).toBeDefined();
    const cleRangee = cleFilm!.replace("https://depot.test/", "");
    const rendus = rendusComposition(m.j);
    expect(rendus.length).toBeGreaterThanOrEqual(3);
    for (const d of rendus) {
      const p = proprietes(d);
      // Plan nu au format maître ET aux autres formats : aucun panneau de repli par-dessus le film.
      expect((p.plan as { scenes: unknown[] }).scenes).toEqual([]);
      expect(p.navigation).toBeDefined();
      expect(p.navigation).toMatchObject({ maquette: "05-stocks" });
      // Sous-titres dans la bande du bas, jamais au milieu (48 %) sur la zone visée du film ; la zone visée reste au-dessus de la bande.
      const pos = (p.sousTitres as { positions: { milieuPct: number; basPct: number } }).positions;
      expect(pos.milieuPct).toBe(pos.basPct);
      expect(pos.milieuPct).not.toBe(48);
      expect(p.navigation!.hautSousTitresPct).toBeLessThan(pos.basPct);
      expect(p.navigation!.hautSousTitresPct).toBeTypeOf("number");
      expect(p.compositionSansVoix).toBeUndefined();
      expect(d.entrees.filmNavigation).toBe(`https://stockage.test/${cleRangee}`);
    }
    expect(m.etat().compose).toBeUndefined();
    expect(m.etat().plan?.source).not.toBe("compose");
    expect(m.j.claude).toEqual([]); // le double Claude des outils n'est pas vu par le piège : on le vérifie ici (0 appel payant)
    expect(m.etat().reserves.filter((r) => /Composition|plan simple/i.test(r))).toEqual([]);
    expect(pieges.appels).toEqual([]);
  });

  it("style de la Bibliothèque en position « centre » (Axion pop) : les sous-titres descendent aussi dans la bande du bas ; « haut » reste un choix explicite", async () => {
    const base = { type: "style-sous-titres", police: "Archivo Black", tailleRelative: 1, motsParLigne: 3, casse: "majuscules", animation: "pop", couleurAccent: "orange" };
    const centre = await deDossierAuBout(SCRIPT_STOCKS, ["4:5"], { ...base, position: "centre" });
    for (const d of rendusComposition(centre.m.j)) {
      const pos = (proprietes(d).sousTitres as { positions: { milieuPct: number; basPct: number } }).positions;
      expect(pos.milieuPct).toBe(pos.basPct);
    }
    reinitialiserDepots();
    puts.clear();
    const haut = await deDossierAuBout(SCRIPT_STOCKS, ["4:5"], { ...base, position: "haut" });
    for (const d of rendusComposition(haut.m.j)) {
      const pos = (proprietes(d).sousTitres as { positions: { milieuPct: number; hautPct: number } }).positions;
      expect(pos.milieuPct).toBe(pos.hautPct);
    }
  });

  it("mots d'ancrage absents du script collé : ancres réparties, la pause film arrive quand même et la chaîne va au bout", async () => {
    const { m, t } = await deDossierAuBout(SCRIPT_QUELCONQUE);
    expect(m.etat().scenarioDossier?.etapes.every((e) => "surMot" in e.ancre)).toBe(true);
    expect(t.statut).toBe("termine");
    for (const d of rendusComposition(m.j)) expect(proprietes(d).navigation).toBeDefined();
    expect(m.j.claude).toEqual([]);
    expect(pieges.appels).toEqual([]);
  });

  it("capture automatique éteinte : aucune pause film, zip jamais lu, réserve claire une seule fois, rendu sans navigation", async () => {
    const lireScenario = vi.fn(async () => SCENARIO as unknown);
    const m = await lancer(SCRIPT_STOCKS, { captureAuto: false, lireScenario });
    expect(lireScenario).not.toHaveBeenCalled();
    expect(m.t().parametres?.pause).toBeUndefined();
    expect(m.t().statut).toBe("termine");
    expect(m.etat().scenarioDossier).toBeUndefined();
    expect(m.etat().reserves.filter((r) => r.includes("la capture automatique est éteinte"))).toEqual(["À vérifier · Film de l'outil : la capture automatique est éteinte, la vidéo montre des scènes dessinées, pas votre tableau de bord."]);
    const rendus = rendusComposition(m.j);
    expect(rendus.length).toBeGreaterThan(0);
    for (const d of rendus) {
      expect(proprietes(d).navigation).toBeUndefined();
      expect(proprietes(d).compositionSansVoix).toBeDefined();
    }
  });

  it("capture allumée mais scénario introuvable ou refusé par le schéma : chemin d'avant avec la réserve « ne contient pas de parcours de démonstration lisible »", async () => {
    for (const lireScenario of [async () => null, async () => ({ version: "autre" })]) {
      reinitialiserDepots();
      const m = await lancer(SCRIPT_STOCKS, { captureAuto: true, lireScenario });
      expect(m.t().parametres?.pause).toBeUndefined();
      expect(m.t().statut).toBe("termine");
      expect(m.etat().reserves.filter((r) => r.includes("ne contient pas de parcours de démonstration lisible"))).toHaveLength(1);
    }
  });

  it("lireScenario LÈVE (panne passagère) : pause TO_DOSSIER_INCOMPLET sans figer la décision ; au tour suivant la vidéo passe en pause film", async () => {
    let panne = true;
    const lireScenario = vi.fn(async () => {
      if (panne) throw new Error("stockage indisponible");
      return SCENARIO as unknown;
    });
    const m = await lancer(SCRIPT_STOCKS, { captureAuto: true, lireScenario });
    expect(m.t().parametres?.pause).toMatchObject({ code: "TO_DOSSIER_INCOMPLET", message: "Votre dossier n'a pas pu être lu pour l'instant : la vidéo reprend dès qu'il est lisible. Rien n'a échoué." });
    expect(m.etat().filmDossierLu).toBeUndefined();
    expect(m.etat().reserves.filter((r) => /Film de l'outil/.test(r))).toEqual([]);
    panne = false;
    const t = await m.suite();
    expect(t.parametres?.pause).toMatchObject({ code: "TO_FILM_A_CAPTURER" });
    expect((t.parametres?.tutoriel as EtatTutoriel).scenarioDossier?.maquette).toBe("05-stocks");
    expect(lireScenario).toHaveBeenCalledTimes(2);
  });

  it("retouche (nouvelle version) : film du dossier déjà dans les entrées, sans scénario retenu : plan nu, 0 appel Claude", async () => {
    await deDossierAuBout(SCRIPT_STOCKS);
    const version = (await depots().versions.obtenir("ver-1"))!;
    expect((version.commande.entrees as { tutorielOutil: Record<string, unknown> }).tutorielOutil.navigationFilmee).toBeDefined();
    reinitialiserDepots();
    const m = await lancer(SCRIPT_STOCKS, undefined, { commande: version.commande });
    expect(m.etat().scenarioDossier).toBeUndefined();
    expect(m.t().statut).toBe("termine");
    expect(m.j.claude).toEqual([]);
    expect(m.etat().reserves.filter((r) => /Composition|plan simple/i.test(r))).toEqual([]);
    const rendus = rendusComposition(m.j);
    expect(rendus.length).toBeGreaterThan(0);
    for (const d of rendus) expect((proprietes(d).plan as { scenes: unknown[] }).scenes).toEqual([]);
  });

  it("vidéo AVEC voix partie d'un dossier, équipe éteinte, port présent et captureAuto allumée : le lot n'agit pas (aucune pause film, zip jamais lu, aucune réserve, rendu identique)", async () => {
    const lireScenario = vi.fn(async () => SCENARIO as unknown);
    const avec = await lancer(SCRIPT_STOCKS, { captureAuto: true, lireScenario }, { avecVoix: true });
    expect(lireScenario).not.toHaveBeenCalled();
    expect(avec.t().parametres?.pause).toBeUndefined();
    expect(avec.t().statut).toBe("termine");
    expect(avec.etat().scenarioDossier).toBeUndefined();
    expect(avec.etat().filmDossierLu).toBeUndefined();
    expect(avec.etat().reserves.filter((r) => /Film de l'outil/.test(r))).toEqual([]);
    reinitialiserDepots();
    const sans = await lancer(SCRIPT_STOCKS, undefined, { avecVoix: true });
    expect(avec.etat().reserves).toEqual(sans.etat().reserves);
    expect(avec.j.voix.length).toBeGreaterThan(0);
    expect(JSON.parse(JSON.stringify(rendusComposition(avec.j).map((d) => d.parametres)))).toEqual(JSON.parse(JSON.stringify(rendusComposition(sans.j).map((d) => d.parametres))));
  });

  it("sans le port filmDossier : comportement d'avant, aucune réserve neuve", async () => {
    const m = await lancer(SCRIPT_STOCKS);
    expect(m.t().parametres?.pause).toBeUndefined();
    expect(m.t().statut).toBe("termine");
    expect(m.etat().reserves.filter((r) => /Film de l'outil/.test(r))).toEqual([]);
    expect(m.etat().filmDossierLu).toBeUndefined();
    for (const d of rendusComposition(m.j)) expect(proprietes(d).navigation).toBeUndefined();
  });
});
