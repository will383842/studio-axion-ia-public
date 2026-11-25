/**
 * POSTE-4 · REPRISE DE LA CHAÎNE : une vidéo en pause TO_FILM_A_CAPTURER (dossier .zip, sans voix) reçoit la réponse de la boîte, le film est
 * rangé par le chemin du dépôt manuel, puis la chaîne avance jusqu'au plan de scènes (et au bout). 0 appel HeyGen / ElevenLabs / Claude (modules piégés).
 * `ESSAI_REPONSE_CAPTURE=<dossier réponse>` : la partie « réelle » range le VRAI film de l'essai du chef ; sans elle, elle est sautée et un faux film sert.
 */
import { createHash } from "node:crypto";
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
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
import { creerMoteurTutorielOutil, validerScriptTutoriel } from "@/moteurs/montage-tutoriel-outil";
import type { EtatTutoriel, OutilsTutoriel } from "@/moteurs/montage-tutoriel-outil";
import { commandeTutoriel, outilsDoubles, une, type Journal } from "../doubles";
import { avecRegistreFige, fauxPort } from "../equipe-doubles";

const { reinitialiserDepots, depots } = await import("@/donnees/memoire");
const { avancerCapturesTutoriel } = await import("@/services/tutoriel-capture-auto");

const T0 = Date.UTC(2026, 10, 19, 9);
const ZIP = Buffer.from("PK-zip-de-test");
const MP4 = Buffer.concat([Buffer.from([0, 0, 0, 24, 0x66, 0x74, 0x79, 0x70, 0x69, 0x73, 0x6f, 0x6d]), Buffer.alloc(200)]);
const REEL = process.env.ESSAI_REPONSE_CAPTURE;

let boite: string;
const puts = new Map<string, Buffer>();

const commande = (): CommandeFabrication =>
  commandeTutoriel({
    ratios: ["4:5"],
    script: { blocs: [], texteComplet: "" },
    entrees: { tutorielOutil: { depot: { mode: "dossier", fichierId: "f-dossier1", attestationImages: true }, fin: "aucune", modeVoix: "sans-voix" } },
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

/** Mène le moteur (équipe simulée, SANS voix) jusqu'à la pause du film, puis installe vidéo, version et travail dans les dépôts. */
async function installerPauseFilm(dims?: { largeur: number; hauteur: number }) {
  const j: Journal = { voix: [], claude: [], rendus: [] };
  const eq = fauxPort();
  const moteur = creerMoteurTutorielOutil({ outils: une({ ...outilsDoubles(j), equipe: eq.port } as OutilsTutoriel) });
  const c = commande();
  let t: Travail = await moteur.lancer(c, { travailId: "t-to", versionId: "ver-1", titre: "Tuto", maintenant: T0 });
  const mener = async (depart: number) => {
    for (let i = depart; i < depart + 400; i++) {
      t = (await moteur.avancer(t, c, T0 + i * 1000)).travail;
      if (["termine", "echec", "annule"].includes(t.statut) || t.parametres?.pause) break;
    }
  };
  await mener(0);
  expect(t.parametres?.pause).toMatchObject({ code: "TO_SCRIPT_A_VALIDER" });
  t = validerScriptTutoriel(avecRegistreFige(t), undefined, { version: "A" });
  await mener(100);
  expect(t.parametres?.pause).toMatchObject({ code: "TO_FILM_A_CAPTURER" });
  const etat = t.parametres!.tutoriel as EtatTutoriel;
  expect(etat.audio?.fournisseur).toBe("aucune");
  // Essai réel : le film du chef est celui de la maquette 05-stocks (1080 × 1350) ; le scénario de la chaîne en prend les dimensions.
  if (dims) Object.assign(etat.equipe!.parcours!.scenario, dims);
  const le = "2026-11-21T08:00:00.000Z";
  await depots().videos.enregistrer({ id: "v-to", titre: "Mon tutoriel", formatId: "tutoriel-outil", statut: "en_fabrication", entrees: c.entrees, creeLe: le, modifieLe: le } as never);
  await depots().versions.enregistrer({ id: "ver-1", videoId: "v-to", numero: 1, statut: "en_fabrication", commande: c, creeLe: le, modifieLe: le } as never);
  await depots().travaux.enregistrer({ ...t, id: "t-to", cibleId: "v-to", versionId: "ver-1", type: "fabrication", creeLe: le, modifieLe: le } as never);
  await depots().fichiers.enregistrer({ id: "f-dossier1", cleStockage: "studio/dev/entree/v-to/f-dossier1.zip", nom: "d.zip", mime: "application/zip", taille: ZIP.length, origine: "depot", statut: "pret", creeLe: le, modifieLe: le } as never);
  return { j, moteur, c };
}

const cloches: { titre: string; message: string }[] = [];
const dep = (extra: Record<string, unknown> = {}) => ({
  racine: boite,
  allumee: async () => true,
  stockage: async () => stockage as never,
  cloche: async (n: { titre: string; message: string }) => {
    cloches.push(n); // comme la vraie cloche : la notification est enregistrée (le dédoublonnage la relit)
    await depots().notifications.enregistrer({ id: `not-${cloches.length}`, lue: false, creeLe: "2026-11-21T08:00:00.000Z", modifieLe: "2026-11-21T08:00:00.000Z", ...n } as never);
  },
  ...extra,
});

beforeEach(() => {
  reinitialiserDepots();
  puts.clear();
  cloches.length = 0;
  pieges.appels.length = 0;
  boite = mkdtempSync(join(tmpdir(), "poste4-reprise-"));
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

/** Joue le rôle du veilleur : prend la demande et rend une réponse (faux film conforme, ou le vrai dossier de l'essai). */
function repondre(reel?: string, corrigerZones = false): { dureeVoixMs: number } {
  const [nom] = readdirSync(join(boite, "demandes"));
  const calage = JSON.parse(readFileSync(join(boite, "demandes", nom!, "calage.json"), "utf8")) as { dureeVoixMs: number; etapes: { id: string; debutMs: number; finMs: number }[] };
  const scenario = JSON.parse(readFileSync(join(boite, "demandes", nom!, "scenario.json"), "utf8")) as { maquette: string; largeur: number; hauteur: number };
  rmSync(join(boite, "demandes", nom!), { recursive: true });
  const cible = join(boite, "reponses", nom!);
  if (reel) {
    cpSync(reel, cible, { recursive: true });
    if (corrigerZones) {
      // CONSTAT de l'essai réel : `capturer.mts` rend des zones qui dépassent 100 % (ex. x 27,96 + largeur 81,8) et `lireNavigationFilmee` les refuse.
      // Ici, les zones sont ramenées dans l'image pour montrer la chaîne ; le correctif appartient à la capture, pas à ce lot.
      const nav = JSON.parse(readFileSync(join(cible, "navigation.json"), "utf8")) as { cibles: { zonePct?: { x: number; largeur: number; y: number; hauteur: number } }[] };
      for (const c of nav.cibles) if (c.zonePct) {
        c.zonePct.largeur = Math.min(c.zonePct.largeur, 100 - c.zonePct.x);
        c.zonePct.hauteur = Math.min(c.zonePct.hauteur, 100 - c.zonePct.y);
      }
      writeFileSync(join(cible, "navigation.json"), JSON.stringify(nav));
    }
    return { dureeVoixMs: JSON.parse(readFileSync(join(cible, "navigation.json"), "utf8")).dureeVoixMs };
  }
  mkdirSync(cible);
  writeFileSync(join(cible, "etat.txt"), "ok\nOK\n");
  writeFileSync(join(cible, "navigation.mp4"), MP4);
  writeFileSync(
    join(cible, "navigation.json"),
    JSON.stringify({
      version: "navigation-filmee.v1", maquette: scenario.maquette, largeur: scenario.largeur, hauteur: scenario.hauteur, debutFilmMs: 0, dureeVoixMs: calage.dureeVoixMs,
      cibles: calage.etapes.map((e) => ({ etapeId: e.id, instantMs: e.debutMs + 600, finMs: e.finMs, zonePct: { x: 10, y: 10, largeur: 30, hauteur: 10 } })),
    }),
  );
  writeFileSync(
    join(cible, "ffprobe.json"),
    JSON.stringify({ streams: [{ codec_type: "video", codec_name: "h264", width: scenario.largeur * 2, height: scenario.hauteur * 2 }], format: { duration: String((calage.dureeVoixMs + 500) / 1000) } }),
  );
  return { dureeVoixMs: calage.dureeVoixMs };
}

async function reprendre(options: { reel?: string; corrigerZones?: boolean; refuse?: boolean } = {}) {
  const { moteur } = await installerPauseFilm(options.reel ? { largeur: 1080, hauteur: 1350 } : undefined);
  await avancerCapturesTutoriel(dep()); // écrit la demande
  expect(readdirSync(join(boite, "demandes"))).toHaveLength(1);
  const { dureeVoixMs } = repondre(options.reel, options.corrigerZones);
  const attendu = options.reel ? { attendu: (a: { dureeMs: number }) => ({ ...a, dureeMs: dureeVoixMs + 500 }) } : {};
  await avancerCapturesTutoriel(dep(attendu)); // relit, range, efface
  expect(readdirSync(join(boite, "reponses"))).toEqual([]);
  if (options.refuse) return { t: (await depots().travaux.obtenir("t-to"))!, plan: false, puts: [...puts.values()] };
  const apres = (await depots().travaux.obtenir("t-to"))!;
  expect(apres.parametres?.pause).toBeUndefined();
  const version = (await depots().versions.obtenir("ver-1"))!;
  let t: Travail = { ...apres, statut: "en_cours" };
  let plan = false;
  for (let i = 300; i < 700; i++) {
    t = (await moteur.avancer(t, version.commande, T0 + i * 1000)).travail;
    plan ||= (t.parametres?.tutoriel as EtatTutoriel | undefined)?.plan !== undefined;
    if (["termine", "echec", "annule"].includes(t.statut) || t.parametres?.pause) break;
  }
  return { t, plan, puts: [...puts.values()] };
}

describe("reprise de la chaîne après la capture automatique", () => {
  it("faux film : de TO_FILM_A_CAPTURER au plan de scènes, puis à la fin ; 0 appel HeyGen / ElevenLabs / Claude", async () => {
    const r = await reprendre();
    expect(r.plan).toBe(true);
    expect(r.t.erreur).toBeUndefined();
    expect(r.t.statut).toBe("termine");
    expect(r.puts.some((o) => o.equals(MP4))).toBe(true);
    expect(pieges.appels).toEqual([]);
  });

  it.skipIf(!REEL || !existsSync(REEL ?? ""))("RÉEL (ESSAI_REPONSE_CAPTURE) : le vrai film de l'essai du chef est rangé, la chaîne arrive au plan de scènes", async () => {
    const r = await reprendre({ reel: REEL, corrigerZones: true });
    expect(r.plan).toBe(true);
    expect(r.t.erreur).toBeUndefined();
    expect(r.puts.some((o) => o.equals(readFileSync(join(REEL!, "navigation.mp4"))))).toBe(true);
    expect(pieges.appels).toEqual([]);
  });

  it.skipIf(!REEL || !existsSync(REEL ?? ""))("RÉEL tel quel : zones au-delà de 100 % refusées par la lecture stricte → rien rangé, panne en phrase claire, la pause reste", async () => {
    const r = await reprendre({ reel: REEL, refuse: true });
    expect(r.puts).toEqual([]);
    expect((r.t.parametres?.pause as { code: string; message: string }).code).toBe("TO_FILM_A_CAPTURER");
    expect(cloches.map((c) => c.message)).toEqual(["Le film rendu par le poste de capture n'a pas passé les contrôles : déposez le film à la main."]);
  });
});
