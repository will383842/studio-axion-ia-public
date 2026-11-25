/**
 * POSTE-4 · ORCHESTRATEUR de la capture automatique : boîte dans un dossier temporaire, stockage simulé, `fetch` piégé qui rend un petit zip.
 * Demande `film-zip`, un tour = une demande, réponse rangée par le chemin du dépôt manuel, réponses forgées refusées, pannes en phrases claires.
 * Aucun appel HeyGen / ElevenLabs / Claude (modules piégés). 0 €.
 */
import { createHash } from "node:crypto";
import { cpSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, symlinkSync, utimesSync, writeFileSync } from "node:fs";
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

const { lienSuivi } = await import("@/services/tutoriel-suivi");
const { deposerFilmNavigation } = await import("@/services/tutoriel-film");
const { lireEntreesTutoriel } = await import("@/moteurs/montage-tutoriel-outil/entrees");
const { PHRASES_CODE, PHRASE_POSTE_ETEINT, PHRASE_BOITE_NON_PRETE, PHRASE_SANS_REPONSE } = await import("@/moteurs/montage-tutoriel-outil/capture-auto/contrat");
const { lienCapture, DELAI_PRISE_MS, DELAI_REPONSE_MS } = await import("@/services/tutoriel-capture-auto");

const tour = (extra: Record<string, unknown> = {}) => avancerCapturesTutoriel(dep(extra));
const demandes = () => readdirSync(join(boite, "demandes"));
const reponses = () => readdirSync(join(boite, "reponses"));
const tentativesNotees = () => readdirSync(join(boite, "echecs"));
const etatReponse = (statut: string, code: string) => {
  const [nom] = demandes();
  rmSync(join(boite, "demandes", nom!), { recursive: true });
  mkdirSync(join(boite, "reponses", nom!));
  writeFileSync(join(boite, "reponses", nom!, "etat.txt"), `${statut}\n${code}\n`);
  return nom!;
};
const journal = async () => (await depots().evenements.lister((e) => e.entiteId === "v-to")).map((e) => e.message);

describe("demande", () => {
  it("écrit UNE demande film-zip avec les bons noms ; deux tours = une seule demande (même id)", async () => {
    await installerPauseFilm();
    await tour();
    const [nom] = demandes();
    expect(nom).toMatch(/^film-zip--v-to-[a-f0-9]{12}$/);
    expect(readdirSync(join(boite, "demandes", nom!)).sort()).toEqual(["calage.json", "dossier.zip", "scenario.json"]);
    expect(readFileSync(join(boite, "demandes", nom!, "dossier.zip"))).toEqual(ZIP);
    await tour();
    await tour();
    expect(demandes()).toEqual([nom]);
    expect(pieges.appels).toEqual([]);
  });

  it("une demande d'une autre vidéo en vol bloque la seconde", async () => {
    await installerPauseFilm();
    mkdirSync(join(boite, "demandes", "film-zip--autre-0123456789ab"));
    await tour();
    expect(demandes()).toEqual(["film-zip--autre-0123456789ab"]);
  });

  it("POSTE-1b : une vidéo partie d'une phrase, ou en pause TO_PIECE_A_CONSTRUIRE, ne reçoit AUCUNE demande", async () => {
    await installerPauseFilm();
    const v = (await depots().versions.obtenir("ver-1"))!;
    await depots().versions.modifier("ver-1", { commande: { ...v.commande, entrees: { tutorielOutil: { depot: { mode: "phrase", phrase: "Un tableau de bord pour un atelier" } } } } } as never);
    await tour();
    expect(demandes()).toEqual([]);
    await depots().versions.modifier("ver-1", { commande: v.commande } as never);
    const t = (await depots().travaux.obtenir("t-to"))!;
    await depots().travaux.modifier("t-to", { parametres: { ...t.parametres, pause: { code: "TO_PIECE_A_CONSTRUIRE", message: "x" } } });
    await tour();
    expect(demandes()).toEqual([]);
    expect(cloches).toEqual([]);
  });

  it("sans voix mesurée (aucun audio dans l'état) : pas de demande, une cloche et un journal, une seule fois", async () => {
    await installerPauseFilm();
    const t = (await depots().travaux.obtenir("t-to"))!;
    const { audio: _a, ...etat } = t.parametres!.tutoriel as EtatTutoriel;
    void _a;
    await depots().travaux.modifier("t-to", { parametres: { ...t.parametres, tutoriel: etat } });
    await tour();
    await tour();
    expect(demandes()).toEqual([]);
    expect(cloches).toHaveLength(1);
    expect(cloches[0]!.message).toMatch(/impossible sans voix mesurée/);
  });

  it.each([["boîte non prête", () => rmSync(join(boite, "PRET")), PHRASE_BOITE_NON_PRETE], ["poste éteint (pouls ancien)", () => writeFileSync(join(boite, "pouls"), "2020-01-01T00:00:00.000Z\n"), PHRASE_POSTE_ETEINT]])("%s : une cloche une seule fois, aucune écriture dans la boîte", async (_n, casser, phrase) => {
    await installerPauseFilm();
    casser();
    const avant = JSON.stringify(readdirSync(boite, { recursive: true }));
    await tour();
    await tour();
    expect(cloches.map((c) => c.message)).toEqual([phrase]);
    expect(JSON.stringify(readdirSync(boite, { recursive: true }))).toBe(avant);
    expect(await journal()).toContain(phrase);
  });

  it("le lien de la cloche est celui du suivi", () => {
    expect(lienCapture("v-to")).toBe(lienSuivi("v-to"));
  });
});

describe("réponse « ok »", () => {
  it("crée le Fichier « depot » « pret », range navigationFilmee dans la vidéo ET la version, retire la pause, efface la réponse", async () => {
    await installerPauseFilm();
    await tour();
    repondre();
    await tour();
    expect(reponses()).toEqual([]);
    const fichiers = await depots().fichiers.lister((f) => f.nom === "navigation.mp4");
    expect(fichiers).toHaveLength(1);
    expect(fichiers[0]).toMatchObject({ origine: "depot", statut: "pret", mime: "video/mp4", taille: MP4.length });
    expect(fichiers[0]!.sha256).toBe(createHash("sha256").update(MP4).digest("hex"));
    for (const entrees of [(await depots().videos.obtenir("v-to"))!.entrees, (await depots().versions.obtenir("ver-1"))!.commande.entrees]) {
      expect(lireEntreesTutoriel(entrees as Record<string, unknown>).navigationFilmee?.videoCle).toBe(fichiers[0]!.cleStockage);
    }
    expect((await depots().travaux.obtenir("t-to"))!.parametres?.pause).toBeUndefined();
    expect(cloches).toEqual([]);
  });
});

describe("réponses forgées : rien n'est rangé, panne lisible", () => {
  const FILM_INVALIDE = PHRASES_CODE.FILM_INVALIDE;
  async function attendreRefus(forger: (dossier: string) => void) {
    await installerPauseFilm();
    await tour();
    repondre();
    const [nom] = reponses();
    forger(join(boite, "reponses", nom!));
    await tour();
    expect(await depots().fichiers.lister((f) => f.nom === "navigation.mp4")).toEqual([]);
    expect(puts.size).toBe(0);
    const t = (await depots().travaux.obtenir("t-to"))!;
    expect((t.parametres?.pause as { code: string }).code).toBe("TO_FILM_A_CAPTURER");
    expect(lireEntreesTutoriel((await depots().videos.obtenir("v-to"))!.entrees as Record<string, unknown>).navigationFilmee).toBeUndefined();
    expect(cloches.map((c) => c.message)).toEqual([FILM_INVALIDE]);
    expect(reponses()).toEqual([]);
  }
  const reecrire = (d: string, nom: string, f: (o: { streams: Record<string, unknown>[]; dureeVoixMs: number }) => unknown) => writeFileSync(join(d, nom), JSON.stringify(f(JSON.parse(readFileSync(join(d, nom), "utf8")))));

  it("un lien symbolique à la place du film", () => attendreRefus((d) => {
    rmSync(join(d, "navigation.mp4"));
    symlinkSync("/etc/hostname", join(d, "navigation.mp4"));
  }));
  it("un film trop gros", () => attendreRefus((d) => writeFileSync(join(d, "navigation.mp4"), Buffer.concat([MP4, Buffer.alloc(500 * 1024 * 1024)]))));
  it("une signature qui n'est pas celle d'un MP4", () => attendreRefus((d) => writeFileSync(join(d, "navigation.mp4"), Buffer.alloc(300, 1))));
  it("un relevé ffprobe faux (durée)", () => attendreRefus((d) => reecrire(d, "ffprobe.json", (o) => ({ ...o, format: { duration: "99" } }))));
  it("un relevé ffprobe faux (dimensions)", () => attendreRefus((d) => reecrire(d, "ffprobe.json", (o) => ({ ...o, streams: [{ ...o.streams[0], width: 10 }] }))));
  it("un navigation.json invalide", () => attendreRefus((d) => writeFileSync(join(d, "navigation.json"), "{ pas du json")));
  it("un navigation.json d'une autre demande (durée de voix)", () => attendreRefus((d) => reecrire(d, "navigation.json", (o) => ({ ...o, dureeVoixMs: o.dureeVoixMs + 5000 }))));
  it("un nom inattendu dans la réponse", () => attendreRefus((d) => writeFileSync(join(d, "surprise.sh"), "x")));
});

describe("pannes", () => {
  it("panne ZIP_REFUSE : journal + cloche avec la phrase, echecs à 1, redemande au tour suivant ; à 2 plus de demande", async () => {
    await installerPauseFilm();
    await tour();
    etatReponse("refus", "ZIP_REFUSE");
    await tour();
    expect(tentativesNotees()).toHaveLength(1);
    expect(cloches).toHaveLength(1);
    expect(cloches[0]!.message).toBe(PHRASES_CODE.ZIP_REFUSE);
    expect(await journal()).toContain(PHRASES_CODE.ZIP_REFUSE);
    expect(demandes()).toEqual([]); // pas de redemande dans le tour de l'échec
    await tour();
    expect(demandes()).toHaveLength(1);
    etatReponse("panne", "CAPTURE_ECHEC");
    await tour();
    expect(cloches).toHaveLength(2);
    expect(cloches[1]!.message).toContain(PHRASES_CODE.CAPTURE_ECHEC);
    expect(cloches[1]!.message).toMatch(/Plus aucun nouvel essai automatique/);
    await tour();
    await tour();
    expect(demandes()).toEqual([]);
    expect(cloches).toHaveLength(2);
    // Le dépôt manuel reste possible : la pause est toujours là.
    expect(((await depots().travaux.obtenir("t-to"))!.parametres?.pause as { code: string }).code).toBe("TO_FILM_A_CAPTURER");
  });

  it("demande jamais prise depuis 60 minutes : panne « ne répond plus », demande retirée", async () => {
    await installerPauseFilm();
    await tour();
    const [nom] = demandes();
    const vieux = new Date(Date.now() - DELAI_PRISE_MS - 60_000);
    utimesSync(join(boite, "demandes", nom!), vieux, vieux);
    await tour();
    expect(cloches.map((c) => c.message)).toEqual([PHRASE_SANS_REPONSE]);
    expect(demandes()).toEqual([]);
  });

  it("demande prise mais sans réponse 45 minutes après : panne « ne répond plus » (redémarrage du studio compris)", async () => {
    await installerPauseFilm();
    let maintenant = Date.now();
    await tour({ maintenant: () => maintenant });
    rmSync(join(boite, "demandes", demandes()[0]!), { recursive: true }); // le veilleur l'a prise
    await tour({ maintenant: () => maintenant });
    expect(cloches).toEqual([]);
    maintenant += DELAI_REPONSE_MS + 60_000;
    writeFileSync(join(boite, "pouls"), new Date(maintenant).toISOString() + "\n");
    await tour({ maintenant: () => maintenant });
    expect(cloches.map((c) => c.message)).toEqual([PHRASE_SANS_REPONSE]);
  });
});

describe("tutoriel-film sans session injectée", () => {
  it("exige toujours la session de l'utilisateur", async () => {
    await installerPauseFilm();
    await expect(deposerFilmNavigation("v-to", { fichierId: "f-x", navigation: "{}" })).rejects.toThrow(/session exigée/);
  });
});
