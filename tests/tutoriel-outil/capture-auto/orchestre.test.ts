/**
 * POSTE-4 · ORCHESTRATEUR de la capture automatique : boîte dans un dossier temporaire, stockage simulé, `fetch` piégé qui rend un petit zip.
 * Demande `film-zip`, un tour = une demande, réponse rangée par le chemin du dépôt manuel, réponses forgées refusées, pannes en phrases claires.
 * Aucun appel HeyGen / ElevenLabs / Claude (modules piégés). 0 €.
 */
import { createHash } from "node:crypto";
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, symlinkSync, truncateSync, utimesSync, writeFileSync } from "node:fs";
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

const supprimes: string[] = [];
/** Appelé à la confirmation du dépôt (avant `deposerFilmNavigation`) : simule un changement d'état survenu pendant le dépôt. */
let pendantLeDepot: (() => Promise<void>) | null = null;
const stockage = {
  mode: "simulation",
  supprimer: async (cle: string) => {
    supprimes.push(cle);
  },
  preparerDepot: async (d: { fichierId: string; entiteId: string }) => ({ cleStockage: `studio/dev/entree/${d.entiteId}/${d.fichierId}.mp4`, urlDepot: "" }),
  confirmerDepot: async (cle: string) => {
    await pendantLeDepot?.();
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

/** Vide la mémoire du processus de l'orchestrateur : simule un redémarrage du Studio (seul le journal et la boîte survivent). */
const viderMemoire = () => {
  delete (globalThis as Record<symbol, unknown>)[Symbol.for("studio-axion-ia.capture-auto")];
};
/** Avance l'horloge (journal compris : `maintenant()` du Studio lit `Date`) et rafraîchit le pouls du poste. */
const avancer = (ms: number) => {
  vi.setSystemTime(Date.now() + ms);
  writeFileSync(join(boite, "pouls"), new Date().toISOString() + "\n");
};

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  viderMemoire(); // les tests ne dépendent pas de leur ordre : même scénario = même id partout
  pendantLeDepot = null;
  supprimes.length = 0;
  reinitialiserDepots();
  puts.clear();
  cloches.length = 0;
  pieges.appels.length = 0;
  boite = mkdtempSync(join(tmpdir(), "poste4-reprise-"));
  for (const d of ["demandes", "reponses", "echecs"]) mkdirSync(join(boite, d));
  writeFileSync(join(boite, "PRET"), "");
  writeFileSync(join(boite, "pouls"), new Date().toISOString() + "\n");
  vi.stubGlobal("fetch", async (url: string, init?: RequestInit) => {
    if (init?.signal?.aborted) throw init.signal.reason; // un délai dépassé coupe l'appel
    if (init?.method === "PUT") {
      puts.set(url, Buffer.from(init.body as Uint8Array));
      return new Response(null, { status: 200 });
    }
    return new Response(ZIP);
  });
});
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
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
    JSON.stringify({ streams: [{ codec_type: "video", codec_name: "h264", width: scenario.largeur * 2, height: scenario.hauteur * 2 }], format: { duration: String((calage.dureeVoixMs + MARGE_FIN_FILM_MS) / 1000) } }),
  );
  return { dureeVoixMs: calage.dureeVoixMs };
}

const { lienSuivi } = await import("@/services/tutoriel-suivi");
const { deposerFilmNavigation } = await import("@/services/tutoriel-film");
const { lireEntreesTutoriel } = await import("@/moteurs/montage-tutoriel-outil/entrees");
const { PHRASES_CODE, PHRASE_POSTE_ETEINT, PHRASE_BOITE_NON_PRETE, PHRASE_SANS_REPONSE } = await import("@/moteurs/montage-tutoriel-outil/capture-auto/contrat");
const { lienCapture, DELAI_PRISE_MS, DELAI_REPONSE_MS, DELAI_LECTURE_ZIP_MS, DELAI_DEPOT_FILM_MS } = await import("@/services/tutoriel-capture-auto");
const { BORNES, MARGE_FIN_FILM_MS, idFilm } = await import("@/moteurs/montage-tutoriel-outil/capture-auto/contrat");
const sha256 = (o: Uint8Array) => createHash("sha256").update(o).digest("hex");

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

  it("l'id de la demande = `idFilm` des octets EXACTS de scenario.json et calage.json relus dans la boîte (formule unique, celle du script d'essai)", async () => {
    await installerPauseFilm();
    await tour();
    const [nom] = demandes();
    const scenario = readFileSync(join(boite, "demandes", nom!, "scenario.json"));
    const calage = readFileSync(join(boite, "demandes", nom!, "calage.json"));
    expect(nom).toBe(`film-zip--${idFilm("v-to", scenario, calage, sha256)}`);
    // l'ancienne formule (chaînes collées, sans l'octet 0x0A) donnerait un autre id
    expect(nom).not.toBe(`film-zip--v-to-${sha256(Buffer.concat([scenario, calage])).slice(0, 12)}`);
    // le script d'essai du poste relié et l'orchestrateur appellent la MÊME fonction du contrat
    const script = readFileSync("outils/maquettes-tableaux-de-bord/essai-reel/essai-poste-relie.mts", "utf8");
    const source = readFileSync("src/services/tutoriel-capture-auto.ts", "utf8");
    expect(script).toMatch(/\bidFilm\(/);
    expect(source).toMatch(/\bidFilm\(/);
    expect(source).not.toMatch(/\bidDemande\(|MARGE_FILM_MS|\+ 500/);
  });

  it("le film attendu dure `dureeFilmAttendueMs` (voix + MARGE_FIN_FILM_MS du contrat) : une durée hors de la tolérance de 1 s autour de cette valeur est refusée", async () => {
    await installerPauseFilm();
    await tour();
    const { dureeVoixMs } = repondre();
    const nom = reponses()[0]!;
    const ffprobe = JSON.parse(readFileSync(join(boite, "reponses", nom, "ffprobe.json"), "utf8"));
    ffprobe.format.duration = String((dureeVoixMs + MARGE_FIN_FILM_MS + 1500) / 1000);
    writeFileSync(join(boite, "reponses", nom, "ffprobe.json"), JSON.stringify(ffprobe));
    await tour();
    expect(cloches.map((c) => c.message)).toEqual([PHRASES_CODE.FILM_INVALIDE]);
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
    expect(cloches[0]!.message).toMatch(/n.a pas de scénario de maquette/);
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
  // Fichier CREUX : `truncate` allonge sans écrire 500 Mio sur le disque.
  it("un film trop gros", () => attendreRefus((d) => truncateSync(join(d, "navigation.mp4"), BORNES.film + 1)));
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

  it("le délai « en cours » dépasse TimeoutStartSec=3300 s du veilleur (70 min), celui de « non prise » vaut 60 min", () => {
    expect(DELAI_PRISE_MS).toBe(60 * 60 * 1000);
    expect(DELAI_REPONSE_MS).toBe(70 * 60 * 1000);
    expect(DELAI_REPONSE_MS).toBeGreaterThan(3300 * 1000);
  });

  it("demande prise mais sans réponse : pas de panne à +69 min, panne « ne répond plus » à +71 min (mémoire du processus)", async () => {
    await installerPauseFilm();
    await tour();
    rmSync(join(boite, "demandes", demandes()[0]!), { recursive: true }); // le veilleur l'a prise
    await tour(); // la prise est vue : la mémoire note l'instant
    avancer(69 * 60_000);
    await tour();
    expect(cloches).toEqual([]);
    avancer(2 * 60_000);
    await tour();
    expect(cloches.map((c) => c.message)).toEqual([PHRASE_SANS_REPONSE]);
  });

  it("REDÉMARRAGE (mémoire vidée entre la prise et l'échéance) : l'attente est relue dans le journal ; +69 min rien, +71 min panne", async () => {
    await installerPauseFilm();
    await tour();
    rmSync(join(boite, "demandes", demandes()[0]!), { recursive: true });
    viderMemoire(); // le Studio redémarre : il n'a pas vu la prise
    avancer(69 * 60_000);
    await tour();
    expect(cloches).toEqual([]);
    expect(demandes()).toEqual([]); // et aucune seconde demande pendant l'attente
    viderMemoire();
    avancer(2 * 60_000);
    await tour();
    expect(cloches.map((c) => c.message)).toEqual([PHRASE_SANS_REPONSE]);
  });

  it("REDÉMARRAGE avec la demande encore dans demandes/ (mtime ancien) : panne « ne répond plus » après 60 min", async () => {
    await installerPauseFilm();
    await tour();
    viderMemoire();
    avancer(DELAI_PRISE_MS + 60_000);
    const [nom] = demandes();
    const vieux = new Date(Date.now() - DELAI_PRISE_MS - 60_000);
    utimesSync(join(boite, "demandes", nom!), vieux, vieux);
    await tour();
    expect(cloches.map((c) => c.message)).toEqual([PHRASE_SANS_REPONSE]);
    expect(demandes()).toEqual([]);
  });

  it("la panne est close au journal : plus comptée comme envoyée", async () => {
    await installerPauseFilm();
    await tour();
    etatReponse("refus", "ZIP_REFUSE");
    await tour();
    const messages = await journal();
    expect(messages.filter((m) => /demande terminée/.test(m))).toHaveLength(1);
  });

  describe("délais sur les appels au stockage", () => {
    const espionner = (couper: (ms: number) => boolean) => {
      const reel = AbortSignal.timeout.bind(AbortSignal);
      const vus: number[] = [];
      vi.spyOn(AbortSignal, "timeout").mockImplementation((ms: number) => {
        vus.push(ms);
        return couper(ms) ? AbortSignal.abort(new DOMException("délai dépassé", "TimeoutError")) : reel(ms);
      });
      return vus;
    };

    it("la lecture du zip et le dépôt du film portent un AbortSignal.timeout (120 s et 600 s)", async () => {
      const vus = espionner(() => false);
      await installerPauseFilm();
      await tour();
      repondre();
      await tour();
      expect(vus).toContain(DELAI_LECTURE_ZIP_MS);
      expect(vus).toContain(DELAI_DEPOT_FILM_MS);
      expect([DELAI_LECTURE_ZIP_MS, DELAI_DEPOT_FILM_MS]).toEqual([120_000, 600_000]);
      expect(cloches).toEqual([]);
    });

    it("lecture du zip qui cale : panne lisible, aucune demande écrite, un essai noté, l'annexe n'est pas bloquée", async () => {
      espionner((ms) => ms === DELAI_LECTURE_ZIP_MS);
      await installerPauseFilm();
      await tour();
      expect(demandes()).toEqual([]);
      expect(cloches).toHaveLength(1);
      expect(cloches[0]!.message).toMatch(/Le stockage n'a pas répondu à temps/);
      expect(tentativesNotees()).toHaveLength(1);
    });

    it("dépôt du film qui cale : panne lisible, film non gardé (objet supprimé, aucun Fichier, pause gardée), réponse effacée", async () => {
      espionner((ms) => ms === DELAI_DEPOT_FILM_MS);
      await installerPauseFilm();
      await tour();
      repondre();
      await tour();
      expect(cloches).toHaveLength(1);
      expect(cloches[0]!.message).toMatch(/Le stockage n'a pas répondu à temps/);
      expect(supprimes).toHaveLength(1);
      expect(await depots().fichiers.lister((f) => f.nom === "navigation.mp4")).toEqual([]);
      expect(reponses()).toEqual([]);
      expect(((await depots().travaux.obtenir("t-to"))!.parametres?.pause as { code: string }).code).toBe("TO_FILM_A_CAPTURER");
    });
  });
});

describe("refus de deposerFilmNavigation après le dépôt au stockage", () => {
  it.each([
    ["vidéo arrêtée entre-temps", async () => void (await depots().travaux.modifier("t-to", { statut: "annule" })), /Cette vidéo est arrêtée/],
    [
      "film déposé à la main entre-temps",
      async () => {
        const t = (await depots().travaux.obtenir("t-to"))!;
        const { pause: _p, ...parametres } = t.parametres ?? {};
        void _p;
        await depots().travaux.modifier("t-to", { parametres });
      },
      /n'attend pas de film/,
    ],
  ])("%s : la phrase du refus est reprise (pas « n'a pas passé les contrôles »), Fichier « refuse », objet supprimé", async (_n, changer, phrase) => {
    await installerPauseFilm();
    await tour();
    repondre();
    pendantLeDepot = changer;
    await tour();
    expect(cloches).toHaveLength(1);
    expect(cloches[0]!.message).toMatch(phrase);
    expect(cloches[0]!.message).not.toContain(PHRASES_CODE.FILM_INVALIDE);
    expect(await journal()).toContainEqual(expect.stringMatching(phrase));
    const fichiers = await depots().fichiers.lister((f) => f.nom === "navigation.mp4");
    expect(fichiers).toHaveLength(1);
    expect(fichiers[0]!.statut).toBe("refuse");
    expect(supprimes).toEqual([fichiers[0]!.cleStockage]);
    expect(lireEntreesTutoriel((await depots().videos.obtenir("v-to"))!.entrees as Record<string, unknown>).navigationFilmee).toBeUndefined();
    expect(lireEntreesTutoriel((await depots().versions.obtenir("ver-1"))!.commande.entrees as Record<string, unknown>).navigationFilmee).toBeUndefined();
    expect(reponses()).toEqual([]);
  });

  it("une phrase qui citerait les erreurs de navigation.json (donnée variable) n'est jamais reprise telle quelle", async () => {
    const source = readFileSync("src/services/tutoriel-capture-auto.ts", "utf8");
    expect(source).toMatch(/startsWith\("Le fichier navigation\.json n'est pas valable"\)/);
  });
});

describe("clôture après un rangement réussi", () => {
  it("la demande est close au journal ; la MÊME vidéo remise en pause avec le même état reçoit une NOUVELLE demande, sans cloche", async () => {
    await installerPauseFilm();
    await tour();
    const [nom] = demandes();
    repondre();
    await tour();
    expect(reponses()).toEqual([]);
    expect((await journal()).filter((m) => /demande terminée/.test(m))).toHaveLength(1);
    // remise en pause identique, bien après le délai de l'ancienne demande
    const t = (await depots().travaux.obtenir("t-to"))!;
    await depots().travaux.modifier("t-to", { parametres: { ...t.parametres, pause: { code: "TO_FILM_A_CAPTURER", message: "x" } } });
    avancer(DELAI_REPONSE_MS + 10 * 60_000);
    await tour();
    expect(demandes()).toEqual([nom]);
    expect(cloches).toEqual([]);
    expect(tentativesNotees()).toEqual([]);
  });
});

describe("une seule demande en vol AU TOTAL côté Studio", () => {
  async function ajouterSecondeVideo() {
    const t = (await depots().travaux.obtenir("t-to"))!;
    const v = (await depots().videos.obtenir("v-to"))!;
    const ver = (await depots().versions.obtenir("ver-1"))!;
    await depots().videos.enregistrer({ ...v, id: "v-to2", titre: "Second tutoriel", creeLe: "2026-11-21T09:00:00.000Z" } as never);
    await depots().versions.enregistrer({ ...ver, id: "ver-2", videoId: "v-to2" } as never);
    await depots().travaux.enregistrer({ ...t, id: "t-to2", cibleId: "v-to2", versionId: "ver-2", creeLe: "2026-11-21T09:00:00.000Z" } as never);
  }

  it("la demande de A PRISE par le veilleur (retirée de demandes/, sans réponse) bloque B : aucune demande pour B, aucune cloche, tant que A n'est pas rangée", async () => {
    await installerPauseFilm();
    await ajouterSecondeVideo();
    await tour();
    const [nomA] = demandes();
    expect(nomA).toMatch(/^film-zip--v-to-/);
    const copie = mkdtempSync(join(tmpdir(), "poste4-copie-"));
    cpSync(join(boite, "demandes", nomA!), join(copie, nomA!), { recursive: true });
    rmSync(join(boite, "demandes", nomA!), { recursive: true }); // prise : `.veilleur/` est invisible du studio
    await tour();
    await tour();
    expect(demandes()).toEqual([]);
    expect(cloches).toEqual([]);
    // le veilleur répond pour A : A est rangée, la clôture libère B (dans le même tour)
    cpSync(join(copie, nomA!), join(boite, "demandes", nomA!), { recursive: true });
    rmSync(copie, { recursive: true, force: true });
    repondre();
    await tour();
    expect(reponses()).toEqual([]);
    expect(demandes()).toHaveLength(1);
    expect(demandes()[0]).toMatch(/^film-zip--v-to2-/);
    expect(cloches).toEqual([]);
  });

  it("après un redémarrage (mémoire vidée), la demande de A reste comptée au journal : B n'écrit rien", async () => {
    await installerPauseFilm();
    await ajouterSecondeVideo();
    await tour();
    rmSync(join(boite, "demandes", demandes()[0]!), { recursive: true });
    viderMemoire();
    await tour();
    expect(demandes()).toEqual([]);
  });
});

describe("deux vidéos : une panne ne laisse partir aucune autre demande dans le même tour", () => {
  it("A refusée : B ne reçoit aucune demande dans CE tour (garde `aEchoue`) ; au tour suivant une demande part", async () => {
    await installerPauseFilm();
    const t = (await depots().travaux.obtenir("t-to"))!;
    const v = (await depots().videos.obtenir("v-to"))!;
    const ver = (await depots().versions.obtenir("ver-1"))!;
    await depots().videos.enregistrer({ ...v, id: "v-to2", titre: "Second tutoriel", creeLe: "2026-11-21T09:00:00.000Z" } as never);
    await depots().versions.enregistrer({ ...ver, id: "ver-2", videoId: "v-to2" } as never);
    await depots().travaux.enregistrer({ ...t, id: "t-to2", cibleId: "v-to2", versionId: "ver-2", creeLe: "2026-11-21T09:00:00.000Z" } as never);
    await tour();
    expect(demandes()[0]).toMatch(/^film-zip--v-to-/);
    etatReponse("refus", "ZIP_REFUSE");
    await tour();
    expect(cloches).toHaveLength(1);
    expect(demandes()).toEqual([]); // ni B, ni la redemande de A, dans le tour de l'échec
    await tour();
    expect(demandes()).toHaveLength(1); // le tour suivant : une seule demande
  });
});

describe("chaque panne est journalisée ; la cloche seule est dédoublonnée", () => {
  const idEnVol = () => demandes()[0]!.replace("film-zip--", "");

  it("un 2e épisode de panne sur la même vidéo avec un AUTRE id (nouvelle voix) : une nouvelle cloche ET une nouvelle ligne de journal", async () => {
    await installerPauseFilm();
    await tour();
    const id1 = idEnVol();
    etatReponse("refus", "ZIP_REFUSE");
    await tour();
    // la voix change : nouveau calage, donc nouvel id
    const t = (await depots().travaux.obtenir("t-to"))!;
    const etat = t.parametres!.tutoriel as EtatTutoriel;
    await depots().travaux.modifier("t-to", { parametres: { ...t.parametres, tutoriel: { ...etat, audio: { ...etat.audio!, dureeSec: etat.audio!.dureeSec + 1 } } } } as never);
    await tour();
    const id2 = idEnVol();
    expect(id2).not.toBe(id1);
    etatReponse("refus", "ZIP_REFUSE");
    await tour();
    expect(cloches).toHaveLength(2);
    expect((await journal()).filter((m) => m === PHRASES_CODE.ZIP_REFUSE)).toHaveLength(2);
    const liens = (await depots().notifications.lister((n) => n.lien?.startsWith(lienCapture("v-to")) ?? false)).map((n) => n.lien);
    expect(new Set(liens).size).toBe(2); // un épisode = une cloche
  });

  it("une cloche déjà posée pour CET épisode n'est pas reposée, mais la panne est quand même écrite au journal", async () => {
    await installerPauseFilm();
    await tour();
    const id = idEnVol();
    await depots().notifications.enregistrer({ id: "not-deja", lue: false, type: "echec", titre: "La capture automatique du film s'est arrêtée (essai 1) · Mon tutoriel", message: "x", lien: `${lienCapture("v-to")}?capture=${id}`, creeLe: "2026-11-21T08:00:00.000Z", modifieLe: "2026-11-21T08:00:00.000Z" } as never);
    etatReponse("refus", "ZIP_REFUSE");
    await tour();
    expect(cloches).toEqual([]);
    expect(await journal()).toContain(PHRASES_CODE.ZIP_REFUSE);
  });
});

describe("nettoyage de la boîte (sans suivre un seul lien)", () => {
  const vieillir = (chemin: string, ms: number) => {
    const d = new Date(Date.now() - ms);
    utimesSync(chemin, d, d);
  };
  const marquerEnvoyee = (videoId: string, id: string) => depots().evenements.enregistrer({ id: `ev-${id}`, type: "fabrication", message: `Capture automatique : demande envoyée au poste de capture (${id}).`, entite: "video", entiteId: videoId, date: new Date().toISOString(), creeLe: "x", modifieLe: "x" } as never);

  it("une réponse qu'aucun candidat ne réclame (film déposé à la main, vidéo arrêtée) est effacée, et sa demande close au journal", async () => {
    await installerPauseFilm();
    await tour();
    repondre(); // réponse de la demande en vol
    // Williams dépose le film à la main : la vidéo n'est plus candidate
    const t = (await depots().travaux.obtenir("t-to"))!;
    const { pause: _p, ...parametres } = t.parametres ?? {};
    void _p;
    await depots().travaux.modifier("t-to", { parametres });
    expect(reponses()).toHaveLength(1);
    await tour();
    expect(reponses()).toEqual([]);
    expect((await journal()).filter((m) => /demande terminée/.test(m))).toHaveLength(1);
    expect(puts.size).toBe(0);
    expect(cloches).toEqual([]);
  });

  it("une réponse orpheline qui est un LIEN : le lien est retiré, jamais sa cible", async () => {
    await installerPauseFilm();
    const cible = mkdtempSync(join(tmpdir(), "poste4-cible-"));
    writeFileSync(join(cible, "precieux.txt"), "ne pas toucher");
    try {
      symlinkSync(cible, join(boite, "reponses", "film-zip--orphelin-0123456789ab"));
      await tour();
      expect(reponses()).toEqual([]);
      expect(existsSync(join(cible, "precieux.txt"))).toBe(true);
    } finally {
      rmSync(cible, { recursive: true, force: true });
    }
  });

  it("une réponse orpheline sans candidat du tout (liste vide) est aussi effacée", async () => {
    mkdirSync(join(boite, "reponses", "film-zip--orphelin-0123456789ab"));
    writeFileSync(join(boite, "reponses", "film-zip--orphelin-0123456789ab", "etat.txt"), "ok\nOK\n");
    await tour();
    expect(reponses()).toEqual([]);
  });

  it("une demande orpheline de plus de 60 min est retirée et libère la vidéo suivante ; une jeune continue de bloquer", async () => {
    await installerPauseFilm();
    mkdirSync(join(boite, "demandes", "film-zip--orphelin-0123456789ab"));
    await tour();
    expect(demandes()).toEqual(["film-zip--orphelin-0123456789ab"]);
    vieillir(join(boite, "demandes", "film-zip--orphelin-0123456789ab"), DELAI_PRISE_MS + 60_000);
    await tour();
    expect(demandes()).toHaveLength(1);
    expect(demandes()[0]).toMatch(/^film-zip--v-to-/);
    expect(cloches).toEqual([]);
  });

  it("un `.prep-*` laissé par un Studio tué, de plus de 60 min, est retiré ; jeune, il bloque", async () => {
    await installerPauseFilm();
    mkdirSync(join(boite, "demandes", ".prep-v-to-0123456789ab"));
    writeFileSync(join(boite, "demandes", ".prep-v-to-0123456789ab", "dossier.zip"), "x");
    await tour();
    expect(demandes()).toEqual([".prep-v-to-0123456789ab"]);
    vieillir(join(boite, "demandes", ".prep-v-to-0123456789ab"), DELAI_PRISE_MS + 60_000);
    await tour();
    expect(demandes()).toHaveLength(1);
    expect(demandes()[0]).toMatch(/^film-zip--v-to-/);
  });

  it("une demande close par le nettoyage ne compte plus comme envoyée (journal)", async () => {
    await installerPauseFilm();
    await marquerEnvoyee("v-autre", "orphelin-0123456789ab");
    mkdirSync(join(boite, "demandes", "film-zip--orphelin-0123456789ab"));
    avancer(DELAI_PRISE_MS + 60_000);
    vieillir(join(boite, "demandes", "film-zip--orphelin-0123456789ab"), DELAI_PRISE_MS + 120_000);
    await tour();
    expect((await depots().evenements.lister((e) => e.entiteId === "v-autre")).map((e) => e.message)).toContain("Capture automatique : demande terminée (orphelin-0123456789ab).");
    expect(demandes()).toHaveLength(1);
    expect(demandes()[0]).toMatch(/^film-zip--v-to-/);
  });

  it("une demande envoyée dont la boîte n'a plus rien (veilleur arrêté) et qu'aucune vidéo ne réclame : cloche unique « ne répond plus » après 60 min, libérée après 130 min", async () => {
    await installerPauseFilm();
    await marquerEnvoyee("v-autre", "orphelin-0123456789ab");
    await tour();
    expect(demandes()).toEqual([]); // en vol : la vidéo attend
    expect(cloches).toEqual([]);
    avancer(DELAI_PRISE_MS + 60_000);
    await tour();
    await tour();
    expect(cloches.map((c) => c.message)).toEqual([PHRASE_SANS_REPONSE]); // UNE cloche dédoublonnée
    expect(demandes()).toEqual([]);
    // à +61 min la trace orpheline n'est PAS close (borne 60 + 70, pas 60) : aucune demande envoyée pour v-to, aucun essai noté
    expect(tentativesNotees()).toEqual([]);
    expect((await journal()).filter((m) => /demande envoyée/.test(m))).toEqual([]);
    expect((await depots().evenements.lister((e) => e.entiteId === "v-autre")).map((e) => e.message)).not.toContain("Capture automatique : demande terminée (orphelin-0123456789ab).");
    // à +100 min : toujours en vol (borne 60 + 70 = 130, pas 70) : aucune demande, aucun essai, trace non close
    avancer(39 * 60_000);
    await tour();
    expect(demandes()).toEqual([]);
    expect(tentativesNotees()).toEqual([]);
    expect((await journal()).filter((m) => /demande envoyée/.test(m))).toEqual([]);
    avancer(31 * 60_000); // 61 + 39 + 31 = 131 min depuis l'envoi
    await tour();
    expect(demandes()).toHaveLength(1);
    expect(demandes()[0]).toMatch(/^film-zip--v-to-/);
    // le mtime réel de la demande est aligné sur l'horloge simulée : elle est neuve, pas vieille de 131 min
    const maintenant = new Date(Date.now());
    utimesSync(join(boite, "demandes", demandes()[0]!), maintenant, maintenant);
    await tour();
    expect(demandes()).toHaveLength(1);
    expect(tentativesNotees()).toEqual([]);
    expect(cloches).toHaveLength(1);
  });
});

describe("tutoriel-film sans session injectée", () => {
  it("exige toujours la session de l'utilisateur", async () => {
    await installerPauseFilm();
    await expect(deposerFilmNavigation("v-to", { fichierId: "f-x", navigation: "{}" })).rejects.toThrow(/session exigée/);
  });
});
