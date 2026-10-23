/**
 * G7b : IMPORT DES CHIFFRES (plan v5 B.5.5, B.8 §2). Statistiques Buffer par `idExterne` et visites / rendez-vous par lien
 * suivi. Réponses ENREGISTRÉES seulement (tests/fixtures/g7b-*) : aucun appel réseau, aucune écriture chez Buffer.
 * Données de TEST (codes et identifiants « TEST »), dans les tests seulement.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { mockHeaders, mockNavigation, reinitialiserRequete } from "./helpers/next-mocks";
import { matiere, preparerMotDePasse } from "./helpers/g1a";
import { creerLecteurBuffer, REQUETE_POST_BUFFER, statsDepuisReponseBuffer } from "@/fournisseurs/mesures/buffer";
import { creerLecteurPlausible, lignesDepuisReponses, questionsPlausible } from "@/fournisseurs/mesures/plausible";
import type { LecteurStatsBuffer } from "@/fournisseurs/mesures/buffer";
import type { LecteurVisites } from "@/fournisseurs/mesures/plausible";

vi.mock("next/headers", () => mockHeaders);
vi.mock("next/navigation", () => mockNavigation);

const { reinitialiserDepots, depots } = await import("@/donnees/memoire");
const auth = await import("@/services/auth");
const gen = await import("@/services/generateur");
const mc = await import("@/services/mesures-completes");

const FIX = join(__dirname, "fixtures");
const fixture = (f: string) => JSON.parse(readFileSync(join(FIX, f), "utf8"));
const BUFFER = fixture("g7b-buffer-post.json");
const PLAUSIBLE_REEL = fixture("g7b-plausible-reel.json");
const PLAUSIBLE_TEST = fixture("g7b-plausible-test.json");
const CLE_TEST = "TEST-cle-secrete-0123456789abcdef";

/** fetch enregistré : renvoie la réponse donnée et garde chaque demande (méthode, corps, en-têtes). */
function fetchEnregistre(reponses: unknown[], statut = 200) {
  const demandes: { url: string; init: RequestInit }[] = [];
  let i = 0;
  const f = (async (url: string, init: RequestInit) => {
    demandes.push({ url, init });
    const corps = reponses[Math.min(i++, reponses.length - 1)];
    return new Response(JSON.stringify(corps), { status: statut, headers: { "content-type": "application/json" } });
  }) as unknown as typeof fetch;
  return { f, demandes };
}

describe("Buffer : lecture par idExterne (réponses enregistrées)", () => {
  it("statistiques en liste {type, value} → vues, portée, réactions, commentaires, partages, partages ÷ portée", () => {
    const s = statsDepuisReponseBuffer(BUFFER.liste);
    expect(s.idExterne).toBe("66f1a2b3c4d5e6f708192a3b");
    expect(s.valeurs).toEqual({ vues: 1840, portee: 1500, likes: 96, commentaires: 11, partages: 18, partagesParPortee: 1.2 });
    expect(s.misesAJourLe).toBe("2026-10-02T03:10:00.000Z");
  });

  it("statistiques en objet, nombres en texte, durée moyenne gardée avec ses décimales", () => {
    const s = statsDepuisReponseBuffer(BUFFER.objet);
    expect(s.valeurs).toMatchObject({ vues: 920, portee: 800, likes: 40, commentaires: 3, partages: 4, dureeMoyenneVueSec: 11.4, partagesParPortee: 0.5 });
  });

  it("une erreur Buffer devient un message court, sans détail technique", () => {
    expect(() => statsDepuisReponseBuffer(BUFFER.erreur)).toThrow("Buffer n'a pas pu lire cette publication.");
  });

  it("LECTURE SEULE : une requête GraphQL « query », jamais « mutation » ; la clé ne part qu'en en-tête", async () => {
    const { f, demandes } = fetchEnregistre([BUFFER.liste]);
    const l = creerLecteurBuffer({ BUFFER_API_KEY: CLE_TEST }, f);
    expect(l.mode).toBe("reel");
    await l.lire("66f1a2b3c4d5e6f708192a3b");
    expect(demandes).toHaveLength(1);
    const corps = JSON.parse(String(demandes[0].init.body));
    expect(corps.query.trim().startsWith("query ")).toBe(true);
    expect(REQUETE_POST_BUFFER).not.toMatch(/mutation/i);
    expect(corps.variables).toEqual({ id: "66f1a2b3c4d5e6f708192a3b" });
    expect(String(demandes[0].init.body)).not.toContain(CLE_TEST);
  });

  it("clé refusée : message sans la clé", async () => {
    const { f } = fetchEnregistre([{}], 401);
    await expect(creerLecteurBuffer({ BUFFER_API_KEY: CLE_TEST }, f).lire("66f1a2b3c4d5e6f708192a3b")).rejects.toThrow("Buffer refuse la clé.");
  });

  it("réponse 429 / 503 / 404 : le message affiché ne porte AUCUN code HTTP (le code va au journal du serveur)", async () => {
    const avertir = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    try {
      for (const statut of [429, 503, 404]) {
        const lectures = [creerLecteurBuffer({ BUFFER_API_KEY: CLE_TEST }, fetchEnregistre([{}], statut).f).lire("66f1a2b3c4d5e6f708192a3b"), creerLecteurPlausible({ PLAUSIBLE_KEY: CLE_TEST }, fetchEnregistre([{}], statut).f).lire()];
        for (const lecture of lectures) {
          const e = await lecture.then(() => null, (x: unknown) => x as Error);
          expect(e).toBeInstanceOf(Error);
          expect(e!.message).not.toMatch(/\d/);
        }
        expect(avertir.mock.calls.some((c) => String(c[0]).includes(String(statut)))).toBe(true);
      }
    } finally {
      avertir.mockRestore();
    }
  });

  it("sans clé : lecteur d'essai qui ne lit rien et n'invente rien", async () => {
    const l = creerLecteurBuffer({});
    expect(l.mode).toBe("simulation");
    expect(await l.lire("66f1a2b3c4d5e6f708192a3b")).toBeNull();
  });
});

describe("statistiques du site : visites et rendez-vous par lien suivi", () => {
  it("réponse RÉELLE du 03/10 (aucune vidéo encore publiée avec un lien suivi) : lue sans erreur, aucune ligne", () => {
    expect(lignesDepuisReponses(PLAUSIBLE_REEL.visites, PLAUSIBLE_REEL.rendezVous)).toEqual([]);
    // Témoin de la même lecture sans le filtre « video » : la mesure marche (18 visiteurs vers la prise de rendez-vous).
    expect(PLAUSIBLE_REEL.temoinRendezVousSansFiltreVideo.results[0].metrics[0]).toBeGreaterThan(0);
  });

  it("réponses de TEST : visites et rendez-vous par code et par réseau ; « (not set) » ignoré", () => {
    const l = lignesDepuisReponses(PLAUSIBLE_TEST.visites, PLAUSIBLE_TEST.rendezVous);
    expect(l).toContainEqual({ campagne: "0101-AV-TT", source: "tiktok", visites: 41, rendezVous: 2 });
    expect(l).toContainEqual({ campagne: "0102-AV-LI", source: "linkedin", visites: 12, rendezVous: 1 });
    expect(l.some((x) => x.campagne === "(not set)")).toBe(false);
  });

  it("questions posées : utm_medium=video, ventilées par utm_campaign ; rendez-vous = clic vers calendly.com", () => {
    const q = questionsPlausible("axion-ia.com");
    expect(q.visites.filters).toEqual([["is", "visit:utm_medium", ["video"]]]);
    expect(q.visites.dimensions[0]).toBe("visit:utm_campaign");
    expect(q.rendezVous.filters).toContainEqual(["contains", "event:props:url", ["calendly.com"]]);
  });

  it("la clé part en en-tête seulement ; jamais dans le corps ni dans un message d'erreur", async () => {
    const { f, demandes } = fetchEnregistre([PLAUSIBLE_TEST.visites, PLAUSIBLE_TEST.rendezVous]);
    const l = creerLecteurPlausible({ PLAUSIBLE_KEY: CLE_TEST }, f);
    expect((await l.lire())!.length).toBe(3);
    expect(demandes.every((d) => !String(d.init.body).includes(CLE_TEST))).toBe(true);
    const { f: f500 } = fetchEnregistre([{}], 404);
    await expect(creerLecteurPlausible({ PLAUSIBLE_KEY: CLE_TEST }, f500).lire()).rejects.toThrow(/^(?!.*TEST-cle).*$/);
  });

  it("sans clé : lecteur d'essai, rien n'est lu", async () => {
    expect(creerLecteurPlausible({}).mode).toBe("simulation");
    expect(await creerLecteurPlausible({}).lire()).toBeNull();
  });
});

/* ------------------------------------------------------------------ */
/* Service : relevés ajoutés, jamais effacés                           */
/* ------------------------------------------------------------------ */

const MDP = "essai-g7b-import";
beforeAll(async () => {
  await preparerMotDePasse(MDP);
});

async function versionTikTok() {
  await depots().matieres.enregistrer(matiere("Un client m'a envoyé 47 factures en photo un vendredi soir."));
  const s = await gen.creerSujet({ idee: "ChatGPT peut-il lire vos factures ?", reseaux: ["tiktok", "linkedin"], formatId: "avocat" });
  const e = await gen.ecrireSujetSimule(s.id);
  if (!e.ok) throw new Error("écriture refusée");
  const vue = (await gen.obtenirSujet(s.id))!;
  const tt = vue.versions.find((v) => v.variante.reseau === "tiktok")!.variante;
  await gen.validerVersions([tt.id]);
  await gen.rangerVideo("v-02", tt.id);
  return (await depots().variantes.obtenir(tt.id))!;
}

const bufferFixe = (rep: unknown): LecteurStatsBuffer => ({ mode: "reel", lire: async () => statsDepuisReponseBuffer(rep) });
const visitesFixes = (code: string, visites: number, rendezVous: number): LecteurVisites => ({ mode: "reel", lire: async () => [{ campagne: code, source: "tiktok", visites, rendezVous }] });
const rien: LecteurVisites = { mode: "simulation", lire: async () => null };

describe("importerMesures (dépôts en mémoire, lecteurs enregistrés)", () => {
  beforeEach(async () => {
    reinitialiserDepots();
    reinitialiserRequete();
    await auth.seConnecter(MDP, false);
  });

  async function publicationBuffer() {
    const v = await versionTikTok();
    await depots().publications.enregistrer({ id: "TEST-pub", videoId: "v-02", reseau: "tiktok", statut: "publiee", via: "buffer", date: "2026-09-28T07:00:00.000Z", texte: "", idExterne: "66f1a2b3c4d5e6f708192a3b", varianteId: v.id, creeLe: "2026-09-28T00:00:00Z", modifieLe: "2026-09-28T00:00:00Z" });
    return v;
  }

  it("Buffer : un relevé « buffer » daté avec ses définitions ; stats fusionnées", async () => {
    await publicationBuffer();
    const b = await mc.importerMesures({ buffer: bufferFixe(BUFFER.liste), visites: rien, instant: new Date("2026-10-02T10:00:00Z") });
    expect(b.buffer).toMatchObject({ essai: false, lues: 1, ajoutees: 1, erreurs: 0 });
    const p = (await depots().publications.obtenir("TEST-pub"))!;
    expect(p.releves).toHaveLength(1);
    expect(p.releves![0]).toMatchObject({ source: "buffer", jour: 4, le: "2026-10-02T10:00:00.000Z" });
    expect(Object.keys(p.releves![0].definitions)).toEqual(expect.arrayContaining(["vues", "portee", "partages"]));
    expect(p.stats).toMatchObject({ vues: 1840, portee: 1500, partages: 18 });
  });

  it("rien n'est effacé : un 2e import différent AJOUTE ; identique, il n'est pas répété ; une saisie à la main reste", async () => {
    const v = await publicationBuffer();
    await depots().publications.modifier("TEST-pub", { releves: [{ le: "2026-10-01T08:00:00.000Z", jour: 3, source: "saisie", valeurs: { vues: 0, likes: 0, commentaires: 0, partages: 5, tauxAbandon3s: 40, dureeMoyenneVueSec: 12 }, definitions: {} }], stats: { vues: 0, likes: 0, commentaires: 0, partages: 5, tauxAbandon3s: 40, dureeMoyenneVueSec: 12 } });
    await mc.importerMesures({ buffer: bufferFixe(BUFFER.liste), visites: rien, instant: new Date("2026-10-02T10:00:00Z") });
    await mc.importerMesures({ buffer: bufferFixe(BUFFER.liste), visites: rien, instant: new Date("2026-10-02T11:00:00Z") });
    const plus = { data: { post: { ...BUFFER.liste.data.post, metrics: [{ type: "views", value: 2100 }] } } };
    await mc.importerMesures({ buffer: bufferFixe(plus), visites: visitesFixes(v.code, 9, 1), instant: new Date("2026-10-03T10:00:00Z") });
    const p = (await depots().publications.obtenir("TEST-pub"))!;
    expect(p.releves!.map((r) => r.source)).toEqual(["saisie", "buffer", "buffer", "api"]);
    expect(p.releves![0].valeurs.tauxAbandon3s).toBe(40);
    expect(p.stats).toMatchObject({ vues: 2100, tauxAbandon3s: 40, dureeMoyenneVueSec: 12, visites: 9, rendezVous: 1 });
    expect(Object.keys(p.releves![3].definitions).sort()).toEqual(["rendezVous", "visites"]);
  });

  it("jamais une publication d'essai ni une publication sans version ; une erreur Buffer n'arrête pas l'import", async () => {
    const v = await versionTikTok();
    await depots().publications.enregistrer({ id: "TEST-essai", videoId: "v-02", reseau: "tiktok", statut: "programmee", via: "simulation", date: "2026-09-28T07:00:00.000Z", texte: "", idExterne: "x", varianteId: v.id, creeLe: "", modifieLe: "" });
    await depots().publications.enregistrer({ id: "TEST-libre", videoId: "v-02", reseau: "tiktok", statut: "publiee", via: "buffer", date: "2026-09-28T07:00:00.000Z", texte: "", idExterne: "y", creeLe: "", modifieLe: "" });
    await depots().publications.enregistrer({ id: "TEST-ok", videoId: "v-02", reseau: "tiktok", statut: "publiee", via: "buffer", date: "2026-09-28T07:00:00.000Z", texte: "", idExterne: "z", varianteId: v.id, creeLe: "", modifieLe: "" });
    const lus: string[] = [];
    const lecteur: LecteurStatsBuffer = { mode: "reel", lire: async (id) => (lus.push(id), statsDepuisReponseBuffer(BUFFER.erreur)) };
    const b = await mc.importerMesures({ buffer: lecteur, visites: rien });
    expect(lus).toEqual(["z"]);
    expect(b.buffer).toMatchObject({ erreurs: 1, ajoutees: 0, message: "Buffer n'a pas pu lire cette publication." });
  });

  it("sans clé : bilan « essai », aucun relevé écrit", async () => {
    await publicationBuffer();
    const b = await mc.importerMesures({ buffer: creerLecteurBuffer({}), visites: creerLecteurPlausible({}) });
    expect(b.buffer.essai && b.visites.essai).toBe(true);
    expect((await depots().publications.obtenir("TEST-pub"))!.releves ?? []).toEqual([]);
  });

  it("« Ce qui marche » range la vidéo importée ; une version prête reçoit ses 5 plus proches (rangs passés seulement)", async () => {
    const v = await publicationBuffer();
    await mc.importerMesures({ buffer: bufferFixe(BUFFER.liste), visites: visitesFixes(v.code, 4, 1) });
    const c = await mc.ceQuiMarche();
    expect(c.exemples).toBe(false);
    expect(c.nombre).toBe(1);
    expect(c.rangs.tiktok![0]).toMatchObject({ rang: 1, sur: 1 });
    expect(c.rangs.tiktok![0].video.resultats).toMatchObject({ vues: 1840, visites: 4, rendezVous: 1 });
    const avis = await mc.avisPlusProches(v.id);
    expect(avis!.proches).toEqual([]); // la version elle-même n'est pas sa voisine
  });
});

describe("écran « Ce qui marche »", () => {
  const racine = join(__dirname, "..");
  const lire = (f: string) => readFileSync(join(racine, f), "utf8");

  it("vocabulaire : aucun mot interdit à l'écran ; « Aucune prévision » affiché", () => {
    const ecran = [lire("src/components/generateur/CeQuiMarche.tsx"), lire("src/app/(studio)/mesures/ce-qui-marche/page.tsx")].join("\n");
    const textes = [...ecran.matchAll(/>([^<>{}]+)</g), ...ecran.matchAll(/(?:libelle|titre|sousTitre|description|message)[=:] ?"([^"]+)"/g), ...ecran.matchAll(/`([^`]+)`/g)].map((m) => m[1]).join(" ");
    expect(textes).not.toMatch(/\b(job|render|prompt|token|API|upload|pipeline|workflow|mock|fictif|dashboard|avatar)\b/i);
    expect(ecran).toMatch(/Aucune prévision/);
    expect(ecran).not.toMatch(/vues attendues|vues prévues|estimation de vues|probabilit/i);
  });

  it("exemples de démonstration : jamais en production", () => {
    expect(mc.exemplesActifs({ NODE_ENV: "production", STUDIO_APERCU_MESURES: "1" })).toBe(false);
    expect(mc.exemplesActifs({ NODE_ENV: "development" })).toBe(false);
    expect(mc.exemplesActifs({ NODE_ENV: "development", STUDIO_APERCU_MESURES: "1" })).toBe(true);
  });
});
