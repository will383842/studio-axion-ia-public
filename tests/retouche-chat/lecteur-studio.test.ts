/**
 * G8-OBS-v21r : l'assembleur serveur du lecteur Claude du chat de retouche, par le CHEMIN RÉEL : dépôts mémoire, vrai
 * `executerRolePourVideo`, client Claude simulé (faux `fetch`, aucun réseau), vrai `apercevoirRetouche` avec
 * `portsGenerateurStudio("facecam-animee")` passés par `avecLecteurStudio`. Modèle : tests/retouche-chat/appel-claude-chat.test.ts.
 */
import { execSync } from "node:child_process";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { mockHeaders, mockNavigation, reinitialiserRequete } from "../helpers/next-mocks";
import { exemplesCommeVraies } from "../helpers/videos-reelles";
import { preparerMotDePasse } from "../helpers/g1a";
import { CLE_ESSAI_CLAUDE, fluxReussi, reponseFlux } from "../helpers/g0";

vi.mock("next/headers", () => mockHeaders);
vi.mock("next/navigation", () => mockNavigation);
vi.mock("server-only", () => ({}));

const { reinitialiserDepots, depots } = await import("@/donnees/memoire");
const auth = await import("@/services/auth");
const credits = await import("@/services/credits");
const gc = await import("@/services/generation-claude");
const commun = await import("@/services/_commun");
const { creerLecteurAnthropic } = await import("@/fournisseurs/credits/suivis");
const { PLAN_DEMO } = await import("@/briques/plan-scenes/demo");
const { engageClaudeVideoCentimes } = await import("@/services/depense-claude-video");
const { apercevoirRetouche } = await import("@/services/retouche-chat/service");
const { portsGenerateurStudio } = await import("@/services/retouche-chat/generateurs-studio");
const { adaptateurRetouche } = await import("@/services/retouche-chat/generateurs");
const { PHRASE_LECTEUR_EPUISE } = await import("@/services/retouche-chat/lecteur-demande");
const { ETAPE_LECTURE_CHAT, PARAM_PLAFOND_LECTURE_CHAT, PREFIXE_APPEL_CHAT } = await import("@/services/retouche-chat/appel-claude-chat");
const ls = await import("@/services/retouche-chat/lecteur-studio");

const MDP = "essai-lecteur-studio";
const FA = "facecam-animee";
const CLE_FA = "retoucheChat.facecamAnimeeLecteur";
const COMPRISE = "remplace assistant par robot à l'écran";
const NON_COMPRISE = "fais quelque chose de joli pour moi";
const AUTRE = "bonjour";
const REPONSE = JSON.stringify({ operations: [{ type: "ajouter-dynamisme", intensite: "leger" }] });
const fetchInterdit = (async () => {
  throw new Error("réseau interdit");
}) as typeof fetch;

beforeAll(async () => {
  await preparerMotDePasse(MDP);
});
beforeEach(async () => {
  reinitialiserDepots();
  await exemplesCommeVraies(depots());
  reinitialiserRequete();
  await auth.seConnecter(MDP, false);
  credits.injecterLecteursPourEssai([creerLecteurAnthropic({ ANTHROPIC_API_KEY: CLE_ESSAI_CLAUDE }, fetchInterdit)], ["anthropic"]);
  await commun.ecrireParametre("fournisseur.texte-reseaux", "claude");
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

const depensesChat = (videoId: string) => depots().depenses.lister((d) => d.videoId === videoId && d.lignes.some((l) => l.etape.startsWith(ETAPE_LECTURE_CHAT)));
const reservationsChat = (videoId: string) => depots().reservations.lister((r) => r.videoId === videoId && !!r.travailId?.startsWith(PREFIXE_APPEL_CHAT));
const portsFa = (videoId: string) => ls.avecLecteurStudio(FA, videoId, portsGenerateurStudio(FA));

describe("G8-OBS-v21r · lecteur du chat branché côté serveur", () => {
  it("a) éteint = identique (réglage absent, false, \"true\", 1) : aperçu égal à portsGenerateurStudio seul, 0 appel, 0 dépense, 0 réservation", async () => {
    const appels = brancherClaude();
    const temoin = [];
    for (const d of [COMPRISE, NON_COMPRISE, AUTRE]) temoin.push(await apercevoirRetouche("v-04", d, portsGenerateurStudio(FA)));
    for (const valeur of [undefined, false, "true", 1]) {
      if (valeur !== undefined) await commun.ecrireParametre(CLE_FA, valeur);
      const vus = [];
      const temoinPorts = portsGenerateurStudio(FA);
      expect(await ls.avecLecteurStudio(FA, "v-04", temoinPorts), String(valeur)).toBe(temoinPorts);
      for (const d of [COMPRISE, NON_COMPRISE, AUTRE]) vus.push(await apercevoirRetouche("v-04", d, await portsFa("v-04")));
      expect(vus, String(valeur)).toEqual(temoin);
    }
    expect(appels).toHaveLength(0);
    expect(await depensesChat("v-04")).toHaveLength(0);
    expect(await reservationsChat("v-04")).toHaveLength(0);
  });

  it("b) allumé (true), demande comprise par les règles → 0 appel, 0 dépense", async () => {
    await commun.ecrireParametre(CLE_FA, true);
    const appels = brancherClaude();
    const ap = await apercevoirRetouche("v-04", COMPRISE, await portsFa("v-04"));
    expect(ap.operations.length).toBeGreaterThan(0);
    expect(appels).toHaveLength(0);
    expect(await depensesChat("v-04")).toHaveLength(0);
  });

  it("c) allumé, demande non comprise → 1 appel, 1 dépense anthropic à l'étape du chat, coût réel écrit, réservation consommée", async () => {
    await commun.ecrireParametre(CLE_FA, true);
    const appels = brancherClaude();
    const ap = await apercevoirRetouche("v-04", NON_COMPRISE, await portsFa("v-04"));
    expect(appels).toHaveLength(1);
    // La requête PAYANTE part avec la consigne du générateur (portsLecteurGenerateur), pas sans elle.
    expect(appels[0]).toContain(JSON.stringify(adaptateurRetouche(FA).consigne).slice(1, -1));
    expect(ap.operations.map((o) => o.type)).toEqual(["ajouter-dynamisme"]);
    const dep = await depensesChat("v-04");
    expect(dep).toHaveLength(1);
    const ligne = dep[0].lignes.find((l) => l.fournisseur === "anthropic")!;
    expect(ligne.etape).toBe(ETAPE_LECTURE_CHAT);
    expect(ligne.nature).toBe("reel");
    expect(ligne.total.centimes).toBeGreaterThan(0);
    const res = await reservationsChat("v-04");
    expect(res.length).toBeGreaterThan(0);
    expect(res.every((r) => r.statut === "consommee")).toBe(true);
  });

  it("d) borne « 3 lectures » : la 4e lecture de la même vidéo → PHRASE_LECTEUR_EPUISE, 0 appel de plus (3 dépenses en tout)", async () => {
    await commun.ecrireParametre(CLE_FA, true);
    const appels = brancherClaude();
    for (let i = 0; i < 3; i++) await apercevoirRetouche("v-04", NON_COMPRISE, await portsFa("v-04"));
    expect(appels).toHaveLength(3);
    const ap = await apercevoirRetouche("v-04", NON_COMPRISE, await portsFa("v-04"));
    expect(ap.remarques).toEqual([PHRASE_LECTEUR_EPUISE]);
    expect(appels).toHaveLength(3);
    expect(await depensesChat("v-04")).toHaveLength(3);
  });

  it("e) borne « plafond par vidéo » : budget indicatif (défaut) + plafond 0,01 $ → refus avant appel, 0 appel, 0 dépense, 0 réservation", async () => {
    await commun.ecrireParametre(CLE_FA, true);
    await commun.ecrireParametre(PARAM_PLAFOND_LECTURE_CHAT, 0.01);
    const appels = brancherClaude();
    const ap = await apercevoirRetouche("v-04", NON_COMPRISE, await portsFa("v-04"));
    expect(ap.operations).toEqual([]);
    expect(appels).toHaveLength(0);
    expect(await depensesChat("v-04")).toHaveLength(0);
    expect(await reservationsChat("v-04")).toHaveLength(0);
  });

  it("e bis) borne du plafond, égal / +1 / −1 : la barrière laisse passer à l'égalité exacte et refuse 1 centime au-dessus", async () => {
    await commun.ecrireParametre(CLE_FA, true);
    brancherClaude();
    const { construireRequeteRetouche } = await import("@/services/retouche-chat/comprendre");
    const { pireCasLectureUsd } = await import("@/services/retouche-chat/appel-claude-chat");
    const { demandeCentimes } = await import("@/services/retouche-chat/plafond-lectures");
    const { MAX_JETONS_LECTEUR } = await import("@/services/retouche-chat/lecteur-demande");
    const base = construireRequeteRetouche(NON_COMPRISE, (await portsGenerateurStudio(FA).lireVersionChoisie("v-04"))!.plan);
    const requete = { ...base, maxTokens: MAX_JETONS_LECTEUR };
    const demande = demandeCentimes(pireCasLectureUsd(requete));
    for (const [ecart, passe] of [[0, true], [1, true], [-1, false]] as const) {
      reinitialiserDepots();
      await exemplesCommeVraies(depots());
      await commun.ecrireParametre("fournisseur.texte-reseaux", "claude");
      await commun.ecrireParametre(CLE_FA, true);
      const appels = brancherClaude();
      await commun.ecrireParametre(PARAM_PLAFOND_LECTURE_CHAT, (demande + ecart) / 100);
      const p = ls.portsLecteurStudio(CLE_FA, FA, "v-04");
      const err = await p.appeler(requete).then(() => null, (e: Error) => e);
      expect(err === null, `écart ${ecart}`).toBe(passe);
      expect(appels, `écart ${ecart}`).toHaveLength(passe ? 1 : 0);
    }
  });

  it("e ter) compteur illisible (dépôt en panne) → 0 lecture permise, 0 appel ; plafond illisible (lecture qui lève) → refus, 0 appel", async () => {
    await commun.ecrireParametre(CLE_FA, true);
    const appels = brancherClaude();
    const p = ls.portsLecteurStudio(CLE_FA, FA, "v-04");
    const spy = vi.spyOn(depots().depenses, "lister").mockRejectedValue(new Error("base en panne"));
    expect(await p.lecturesRestantes!()).toBe(0);
    const ap = await apercevoirRetouche("v-04", NON_COMPRISE, await portsFa("v-04"));
    expect(ap.remarques).toEqual([PHRASE_LECTEUR_EPUISE]);
    spy.mockRestore();
    vi.spyOn(depots().reservations, "lister").mockRejectedValue(new Error("base en panne"));
    const { construireRequeteRetouche } = await import("@/services/retouche-chat/comprendre");
    const plan = (await portsGenerateurStudio(FA).lireVersionChoisie("v-04"))!.plan;
    await expect(p.appeler({ ...construireRequeteRetouche(NON_COMPRISE, plan), maxTokens: 1500 })).rejects.toThrow();
    expect(appels).toHaveLength(0);
  });

  it("d bis) une lecture EN COURS (réservation active au préfixe du chat) compte ; une réservation active d'un autre préfixe ne compte pas", async () => {
    const quand = new Date().toISOString();
    const res = (id: string, travailId: string) => ({ id, fournisseur: "anthropic", videoId: "v-04", travailId, centimes: 5, devise: "USD" as const, statut: "active" as const, creeLe: quand, modifieLe: quand });
    await depots().reservations.enregistrer(res("r-autre", "txtpub-tbreg-1") as never);
    const p = ls.portsLecteurStudio(CLE_FA, FA, "v-04");
    expect(await p.lecturesRestantes!()).toBe(3);
    await depots().reservations.enregistrer(res("r-chat", `${PREFIXE_APPEL_CHAT}1`) as never);
    expect(await p.lecturesRestantes!()).toBe(2);
  });

  it("e quater) l'engagé du chat compte dans la barrière : après 1 lecture payée, plafond = engagé + demande passe, 1 centime de moins refuse (0 appel)", async () => {
    const { construireRequeteRetouche } = await import("@/services/retouche-chat/comprendre");
    const { pireCasLectureUsd, plafondPropreChat } = await import("@/services/retouche-chat/appel-claude-chat");
    const { demandeCentimes } = await import("@/services/retouche-chat/plafond-lectures");
    const { engagePlafondPropreCentimes } = await import("@/services/depense-claude-video");
    const plan = (await portsGenerateurStudio(FA).lireVersionChoisie("v-04"))!.plan;
    const requete = { ...construireRequeteRetouche(NON_COMPRISE, plan), maxTokens: 1500 };
    const appels = brancherClaude();
    const p = ls.portsLecteurStudio(CLE_FA, FA, "v-04");
    await p.appeler(requete);
    const engage = await engagePlafondPropreCentimes("v-04", plafondPropreChat() as never);
    expect(engage).toBeGreaterThan(0);
    const demande = demandeCentimes(pireCasLectureUsd(requete));
    await commun.ecrireParametre(PARAM_PLAFOND_LECTURE_CHAT, (engage + demande - 1) / 100);
    await expect(p.appeler(requete)).rejects.toThrow();
    expect(appels).toHaveLength(1);
    await commun.ecrireParametre(PARAM_PLAFOND_LECTURE_CHAT, (engage + demande) / 100);
    await p.appeler(requete);
    expect(appels).toHaveLength(2);
  });

  it("f) après 3 lectures payées, engageClaudeVideoCentimes (plafond des textes de publication) est inchangé", async () => {
    await commun.ecrireParametre(CLE_FA, true);
    const appels = brancherClaude();
    const avant = await engageClaudeVideoCentimes("v-04");
    for (let i = 0; i < 3; i++) await apercevoirRetouche("v-04", NON_COMPRISE, await portsFa("v-04"));
    expect(appels).toHaveLength(3);
    expect(await depensesChat("v-04")).toHaveLength(3);
    expect(await engageClaudeVideoCentimes("v-04")).toBe(avant);
  });

  it("g) générateur sans clé (avocat, image-video, tutoriel-outil, video-longue) : le MÊME objet ports, aucun réglage ni dépôt lu", async () => {
    const lire = vi.spyOn(commun, "lireParametre");
    for (const g of ["avocat", "image-video", "tutoriel-outil", "video-longue"] as const) {
      const ports = portsGenerateurStudio(g);
      expect(await ls.avecLecteurStudio(g, "v-04", ports)).toBe(ports);
    }
    expect(lire).not.toHaveBeenCalled();
  });

  it("h) tableau : éteint → claudeAllume faux ; allumé → même compteur et même plafond que le chat (1 du tableau + 2 du chat = 3, la 4e refusée)", async () => {
    const t = ls.portsLecteurTableauStudio("v-04");
    expect(ls.CLE_REGLAGE_LECTEUR_TABLEAU).toBe("retoucheChat.tableauLecteur");
    expect(await t.claudeAllume()).toBe(false);
    for (const v of [false, "true", 1]) {
      await commun.ecrireParametre(ls.CLE_REGLAGE_LECTEUR_TABLEAU, v);
      expect(await t.claudeAllume()).toBe(false);
    }
    // Le tableau n'obéit qu'à SA clé : tableau seul → vrai ; chat face caméra seul → faux.
    await commun.ecrireParametre(ls.CLE_REGLAGE_LECTEUR_TABLEAU, true);
    expect(await t.claudeAllume()).toBe(true);
    await commun.ecrireParametre(ls.CLE_REGLAGE_LECTEUR_TABLEAU, false);
    await commun.ecrireParametre(CLE_FA, true);
    expect(await t.claudeAllume()).toBe(false);
    await commun.ecrireParametre(ls.CLE_REGLAGE_LECTEUR_TABLEAU, true);
    expect(await t.claudeAllume()).toBe(true);
    const appels = brancherClaude();
    const { construireRequeteRetouche } = await import("@/services/retouche-chat/comprendre");
    const plan = (await portsGenerateurStudio(FA).lireVersionChoisie("v-04"))!.plan;
    await t.appeler({ ...construireRequeteRetouche(NON_COMPRISE, plan), maxTokens: 1500 });
    expect(await t.lecturesRestantes!()).toBe(2);
    for (let i = 0; i < 2; i++) await apercevoirRetouche("v-04", NON_COMPRISE, await portsFa("v-04"));
    expect(appels).toHaveLength(3);
    expect(await t.lecturesRestantes!()).toBe(0);
    const ap = await apercevoirRetouche("v-04", NON_COMPRISE, await portsFa("v-04"));
    expect(ap.remarques).toEqual([PHRASE_LECTEUR_EPUISE]);
    expect(appels).toHaveLength(3);
  });

  it("i) 2e vidéo : son compteur part de 3 (aucune fuite entre vidéos) ; lecture du réglage qui lève → éteint", async () => {
    await commun.ecrireParametre(CLE_FA, true);
    const appels = brancherClaude();
    for (let i = 0; i < 3; i++) await apercevoirRetouche("v-04", NON_COMPRISE, await portsFa("v-04"));
    expect(await ls.portsLecteurStudio(CLE_FA, FA, "v-04").lecturesRestantes!()).toBe(0);
    expect(await ls.portsLecteurStudio(CLE_FA, FA, "v-03").lecturesRestantes!()).toBe(3);
    await apercevoirRetouche("v-03", NON_COMPRISE, await portsFa("v-03"));
    expect(appels).toHaveLength(4);
    vi.spyOn(commun, "lireParametre").mockRejectedValue(new Error("base en panne"));
    expect(await ls.portsLecteurStudio(CLE_FA, FA, "v-03").claudeAllume()).toBe(false);
    expect(await ls.portsLecteurTableauStudio("v-03").claudeAllume()).toBe(false);
  });

  it("j) gardes de texte : aucun importeur dans src/**, une seule lecture de réglage, clés de lecteur aux seuls endroits connus", () => {
    const src = readFileSync("src/services/retouche-chat/lecteur-studio.ts", "utf8");
    expect(src.match(/lireParametre</g)).toHaveLength(1);
    expect(src).toContain("lireParametre<unknown>(cle, false)) === true");
    expect(src).not.toMatch(/ecrireParametre|executerRolePourVideo\(|envoyerMessage\(|\.\/tableau"|tutoriel-claude|credits|generation-claude|VideoAnimeeV4|briques-v4|motion-v4\//);
    expect(src).not.toMatch(/\d+(,\d+)? ?(€|\$)/);
    const fichiers = (d: string): string[] =>
      readdirSync(d).flatMap((n) => {
        if (n === "node_modules") return [];
        const p = join(d, n);
        return statSync(p).isDirectory() ? fichiers(p) : /\.(ts|tsx)$/.test(n) ? [p] : [];
      });
    expect(fichiers("src").filter((f) => !f.endsWith("lecteur-studio.ts") && /lecteur-studio/.test(readFileSync(f, "utf8")))).toEqual([]);
    const trouves = execSync(`git grep -l -E "retoucheChat\\..*Lecteur" -- src`, { encoding: "utf8" }).split("\n").filter(Boolean).sort();
    expect(trouves).toEqual(["src/services/retouche-chat/lecteur-generateurs.ts", "src/services/retouche-chat/lecteur-studio.ts", "src/services/tutoriel-claude.ts"]);
  });
});
