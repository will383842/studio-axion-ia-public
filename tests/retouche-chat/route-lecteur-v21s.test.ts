/**
 * S-05-b-v21s : la VRAIE route `POST /api/retouche-chat` pose le lecteur commun (G8-OBS, `avecLecteurStudio`) sur l'aperçu
 * des seuls générateurs à clé de lecteur (face caméra animée, démo face caméra). Dépôts mémoire, vrais `credits`,
 * `generation-claude` et `executerRolePourVideo`, client Claude simulé (faux `fetch`, aucun réseau), 0 €.
 * `lecteur-studio` est enveloppé (vrai module) pour compter son chargement et ses appels. Modèle : lecteur-studio.test.ts.
 */
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { mockHeaders, mockNavigation, reinitialiserRequete } from "../helpers/next-mocks";
import { exemplesCommeVraies } from "../helpers/videos-reelles";
import { preparerMotDePasse } from "../helpers/g1a";
import { CLE_ESSAI_CLAUDE, fluxReussi, reponseFlux } from "../helpers/g0";

const etat = vi.hoisted(() => ({ charge: false, lecteur: [] as string[] }));
vi.mock("next/headers", () => mockHeaders);
vi.mock("next/navigation", () => mockNavigation);
vi.mock("server-only", () => ({}));
vi.mock("@/services/retouche-chat/lecteur-studio", async (importer) => {
  etat.charge = true;
  const reel = await importer<typeof import("@/services/retouche-chat/lecteur-studio")>();
  return { ...reel, avecLecteurStudio: (...a: Parameters<typeof reel.avecLecteurStudio>) => (etat.lecteur.push(a[0]), reel.avecLecteurStudio(...a)) };
});

const { reinitialiserDepots, depots } = await import("@/donnees/memoire");
const auth = await import("@/services/auth");
const credits = await import("@/services/credits");
const gc = await import("@/services/generation-claude");
const commun = await import("@/services/_commun");
const { creerLecteurAnthropic } = await import("@/fournisseurs/credits/suivis");
const { PLAN_DEMO } = await import("@/briques/plan-scenes/demo");
const { apercevoirRetouche } = await import("@/services/retouche-chat/service");
const { portsGenerateurStudio } = await import("@/services/retouche-chat/generateurs-studio");
const { PHRASE_LECTEUR_EPUISE } = await import("@/services/retouche-chat/lecteur-demande");
const { ETAPE_LECTURE_CHAT, PREFIXE_APPEL_CHAT } = await import("@/services/retouche-chat/appel-claude-chat");
const { POST } = await import("@/app/api/retouche-chat/route");

vi.setConfig({ testTimeout: 60_000 }); // premier import à froid de la route

const MDP = "essai-route-lecteur-v21s";
const FA = "facecam-animee";
const DEMO = "demo-facecam";
const CLE_FA = "retoucheChat.facecamAnimeeLecteur";
const CLE_DEMO = "retoucheChat.demoFacecamLecteur";
const COMPRISE = "remplace assistant par robot à l'écran";
const NON_COMPRISE = "fais quelque chose de joli pour moi";
const VIDE = "";
const REPONSE = JSON.stringify({ operations: [{ type: "ajouter-dynamisme", intensite: "leger" }] });
const fetchInterdit = (async () => {
  throw new Error("réseau interdit");
}) as typeof fetch;

beforeAll(async () => {
  await preparerMotDePasse(MDP);
});
beforeEach(async () => {
  etat.lecteur = [];
  reinitialiserDepots();
  await exemplesCommeVraies(depots());
  reinitialiserRequete();
  await auth.seConnecter(MDP, false);
  credits.injecterLecteursPourEssai([creerLecteurAnthropic({ ANTHROPIC_API_KEY: CLE_ESSAI_CLAUDE }, fetchInterdit)], ["anthropic"]);
  await commun.ecrireParametre("fournisseur.texte-reseaux", "claude");
  // Chat de chaque générateur allumé (la clé de LECTEUR reste à régler par chaque test).
  for (const cle of ["retoucheChat.facecamAnimee", "retoucheChat.demoFacecam", "retoucheChat.imageVideo", "retoucheChat.avocat", "retoucheChat.tutorielOutil"]) await commun.ecrireParametre(cle, true);
  for (const v of ["v-04", "v-03"]) await donnerPlan(v);
});
afterEach(() => {
  credits.injecterLecteursPourEssai(null);
  gc.injecterClaudePourEssai(null);
  vi.restoreAllMocks();
});

/** La version choisie de la vidéo porte le plan de démonstration (plan déjà retouché par chat). */
async function donnerPlan(videoId: string) {
  const v = (await depots().videos.obtenir(videoId))!;
  const ver = (await depots().versions.obtenir(v.versionChoisieId!))!;
  await depots().versions.enregistrer({ ...ver, projetMontage: { ...(ver.projetMontage ?? {}), retoucheChat: { plan: PLAN_DEMO } } } as never);
}

function brancherClaude() {
  void credits.declarerRecharge("anthropic", 500);
  const appels: string[] = [];
  const f = (async (_u: string | URL | Request, init?: RequestInit) => {
    appels.push(String(init?.body));
    return reponseFlux(fluxReussi({ texte: REPONSE, modele: "claude-opus-5-5" }));
  }) as typeof fetch;
  gc.injecterClaudePourEssai({ cle: CLE_ESSAI_CLAUDE, fetch: f, attenteMs: () => 0 });
  return appels;
}

const requete = (corps: unknown) => new Request("http://x/api/retouche-chat", { method: "POST", body: JSON.stringify(corps) }) as never;
const apercu = async (generateur: string | undefined, demande: string, videoId = "v-04") => {
  const r = await POST(requete({ action: "apercu", videoId, demande, ...(generateur !== undefined ? { generateur } : {}) }));
  return { status: r.status, corps: (await r.json()) as Record<string, unknown> };
};
/** Réponse d'AVANT la fiche : `apercevoirRetouche(…, portsGenerateurStudio(g))`, passée par JSON comme la route. */
const avant = async (g: Parameters<typeof portsGenerateurStudio>[0], demande: string, videoId = "v-04") => JSON.parse(JSON.stringify(await apercevoirRetouche(videoId, demande, portsGenerateurStudio(g))));
const depensesChat = (videoId: string) => depots().depenses.lister((d) => d.videoId === videoId && d.lignes.some((l) => l.etape.startsWith(ETAPE_LECTURE_CHAT)));
const reservationsChat = (videoId: string) => depots().reservations.lister((r) => r.videoId === videoId && !!r.travailId?.startsWith(PREFIXE_APPEL_CHAT));

describe("S-05-b-v21s · la route du chat pose le lecteur commun sur l'aperçu (éteint)", () => {
  // Placé EN PREMIER : le module `lecteur-studio` n'a encore été chargé par personne dans ce fichier.
  it("(e) sans clé de lecteur (image-video, avocat) : réponse identique, `lecteur-studio` jamais chargé ni appelé", async () => {
    await commun.ecrireParametre(CLE_FA, true); // même une clé de lecteur allumée ailleurs ne change rien ici
    const appels = brancherClaude();
    for (const g of ["image-video", "avocat"] as const) {
      for (const d of [COMPRISE, NON_COMPRISE]) {
        const r = await apercu(g, d);
        expect(r.status, `${g} ${d}`).toBe(200);
        expect(r.corps, `${g} ${d}`).toEqual(await avant(g, d));
      }
    }
    expect(etat.charge).toBe(false);
    expect(etat.lecteur).toEqual([]);
    expect(appels).toHaveLength(0);
  });

  it("(f) gardes inchangées : chat du générateur éteint → 403 avant tout lecteur ; sans générateur → 403 ; tutoriel : sa voie, sans lecteur", async () => {
    await commun.ecrireParametre(CLE_FA, true);
    await commun.ecrireParametre("retoucheChat.facecamAnimee", false);
    const appels = brancherClaude();
    expect((await apercu(FA, NON_COMPRISE)).status).toBe(403);
    expect((await apercu(undefined, NON_COMPRISE)).status).toBe(403);
    expect((await apercu("tableau-anime", NON_COMPRISE)).status).toBe(400);
    const tuto = await apercu("tutoriel-outil", COMPRISE);
    expect(tuto.status).toBe(200);
    await commun.ecrireParametre(CLE_FA, false);
    expect(await apercu("tutoriel-outil", COMPRISE)).toEqual(tuto);
    expect(etat.lecteur).toEqual([]);
    expect(appels).toHaveLength(0);
  });

  it("(a) éteint = identique : clé absente, \"true\", 1, lecture qui lève → même réponse qu'avant la fiche, 0 appel, 0 dépense", async () => {
    const appels = brancherClaude();
    const temoin: unknown[] = [];
    for (const d of [COMPRISE, NON_COMPRISE, VIDE]) temoin.push(await avant(FA, d));
    for (const valeur of [undefined, "true", 1, "lève"] as const) {
      if (valeur === "lève") {
        const lire = commun.lireParametre;
        vi.spyOn(commun, "lireParametre").mockImplementation(((id: string, defaut: unknown) => (id === CLE_FA ? Promise.reject(new Error("base en panne")) : lire(id, defaut))) as typeof lire);
      } else if (valeur !== undefined) await commun.ecrireParametre(CLE_FA, valeur);
      const vus: unknown[] = [];
      for (const d of [COMPRISE, NON_COMPRISE, VIDE]) {
        const r = await apercu(FA, d);
        expect(r.status, String(valeur)).toBe(200);
        vus.push(r.corps);
      }
      expect(vus, String(valeur)).toEqual(temoin);
    }
    expect(etat.lecteur.length).toBe(12); // la route passe bien par le lecteur… qui rend les MÊMES ports
    expect(appels).toHaveLength(0);
    expect(await depensesChat("v-04")).toHaveLength(0);
    expect(await reservationsChat("v-04")).toHaveLength(0);
  });

  it("(b) allumé (true) : non comprise → 1 lecture, 1 dépense à l'étape du chat ; comprise par les règles → 0 appel", async () => {
    await commun.ecrireParametre(CLE_FA, true);
    const appels = brancherClaude();
    const comprise = await apercu(FA, COMPRISE);
    expect(comprise.status).toBe(200);
    expect((comprise.corps.operations as unknown[]).length).toBeGreaterThan(0);
    expect(appels).toHaveLength(0);
    const r = await apercu(FA, NON_COMPRISE);
    expect(r.status).toBe(200);
    expect(appels).toHaveLength(1);
    expect((r.corps.operations as { type: string }[]).map((o) => o.type)).toEqual(["ajouter-dynamisme"]);
    const dep = await depensesChat("v-04");
    expect(dep).toHaveLength(1);
    expect(dep[0].lignes.find((l) => l.fournisseur === "anthropic")!.etape).toBe(ETAPE_LECTURE_CHAT);
    expect(etat.lecteur).toEqual([FA, FA]);
  });

  it("(c) plafond : 4e aperçu non compris sur la même vidéo → 0 appel de plus, PHRASE_LECTEUR_EPUISE vue par la route", async () => {
    await commun.ecrireParametre(CLE_FA, true);
    const appels = brancherClaude();
    for (let i = 0; i < 3; i++) await apercu(FA, NON_COMPRISE);
    expect(appels).toHaveLength(3);
    const r = await apercu(FA, NON_COMPRISE);
    expect(r.status).toBe(200);
    expect(r.corps.remarques).toEqual([PHRASE_LECTEUR_EPUISE]);
    expect(appels).toHaveLength(3);
    expect(await depensesChat("v-04")).toHaveLength(3);
    // Une autre vidéo garde ses 3 lectures.
    await apercu(FA, NON_COMPRISE, "v-03");
    expect(appels).toHaveLength(4);
  });

  it("(d) appliquer ne lit pas : clé true, `appliquer` → 0 appel, 0 dépense, lecteur non posé", async () => {
    await commun.ecrireParametre(CLE_FA, true);
    const appels = brancherClaude();
    const operations = (await apercu(FA, COMPRISE)).corps.operations as unknown[]; // règles seules, 0 appel (b)
    expect(operations.length).toBeGreaterThan(0);
    etat.lecteur = [];
    for (const ops of [operations, []]) {
      const r = await POST(requete({ action: "appliquer", generateur: FA, videoId: "v-04", demande: NON_COMPRISE, operations: ops }));
      expect(r.status).toBe(200);
    }
    expect(etat.lecteur).toEqual([]);
    expect(appels).toHaveLength(0);
    expect(await depensesChat("v-04")).toHaveLength(0);
    expect(await reservationsChat("v-04")).toHaveLength(0);
  });

  it("(g) démo face caméra : clé de lecteur éteinte → identique ; allumée + double → 1 appel", async () => {
    const appels = brancherClaude();
    for (const d of [COMPRISE, NON_COMPRISE]) expect((await apercu(DEMO, d)).corps, d).toEqual(await avant(DEMO, d));
    await commun.ecrireParametre(CLE_FA, true); // la clé d'un AUTRE générateur n'allume pas la démo
    expect((await apercu(DEMO, NON_COMPRISE)).corps).toEqual(await avant(DEMO, NON_COMPRISE));
    expect(appels).toHaveLength(0);
    await commun.ecrireParametre(CLE_DEMO, true);
    const r = await apercu(DEMO, NON_COMPRISE);
    expect(r.status).toBe(200);
    expect(appels).toHaveLength(1);
    expect((r.corps.operations as { type: string }[]).map((o) => o.type)).toEqual(["ajouter-dynamisme"]);
    expect(etat.lecteur).toEqual([DEMO, DEMO, DEMO, DEMO]);
  });
});
