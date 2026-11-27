/**
 * ALLUMER-LECTEUR-CHAT-v20k : le lecteur Claude du chat de retouche devient ALLUMÉ par défaut (absent = allumé, seul `false` éteint ;
 * toute autre valeur écrite et une lecture en échec restent éteintes), au plafond PAR VIDÉO confirmé de 0,25 $.
 * Décision de Williams du 20/11 23:55, mot pour mot : « ok pour ca » (Q2 : « Acceptez-vous que Claude lise chaque message du chat de
 * retouche, pour environ 1 à 9 centimes par message, avec un plafond par vidéo ? ») ; plafond 0,27 → 0,25 $ : pilote, 25/11 07:30.
 * Dépôts en mémoire, aucun appel à Claude, 0 €.
 */
import { readFileSync } from "node:fs";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const { reinitialiserDepots } = await import("@/donnees/memoire");
const commun = await import("@/services/_commun");
const { lecteurClaudeActif, CLES_REGLAGE_LECTEUR } = await import("@/services/retouche-chat/lecteur-generateurs");
const ls = await import("@/services/retouche-chat/lecteur-studio");
const { PLAFOND_LECTURE_CHAT_USD, plafondPropreChat } = await import("@/services/retouche-chat/appel-claude-chat");
const { sousPlafond, demandeCentimes } = await import("@/services/retouche-chat/plafond-lectures");
const { retoucheChatActif } = await import("@/services/retouche-chat/generateurs");
const { portsGenerateurStudio } = await import("@/services/retouche-chat/generateurs-studio");

const CLES = ["retoucheChat.facecamAnimeeLecteur", "retoucheChat.demoFacecamLecteur", "retoucheChat.tableauLecteur"];
const absent = async <T,>(_c: string, defaut: T) => defaut;

beforeEach(() => {
  reinitialiserDepots();
  vi.restoreAllMocks();
});

describe("ALLUMER-LECTEUR-CHAT-v20k · allumé par défaut", () => {
  it("(a) absent → allumé pour les 2 générateurs à clé ; générateurs sans clé → toujours faux", async () => {
    expect(Object.values(CLES_REGLAGE_LECTEUR).sort()).toEqual(CLES.slice(0, 2).sort());
    expect(await lecteurClaudeActif("facecam-animee", absent)).toBe(true);
    expect(await lecteurClaudeActif("demo-facecam", absent)).toBe(true);
    for (const g of ["avocat", "image-video", "tutoriel-outil", "video-longue", "inconnu"]) expect(await lecteurClaudeActif(g, absent), g).toBe(false);
  });

  it("(b) seul `false` éteint ; \"true\", 1, {}, \"false\" écrits restent éteints ; lecture qui lève → éteint", async () => {
    for (const v of [false, "true", 1, {}, "false", 0]) {
      expect(await lecteurClaudeActif("facecam-animee", async () => v), JSON.stringify(v)).toBe(false);
      expect(await lecteurClaudeActif("demo-facecam", async () => v), JSON.stringify(v)).toBe(false);
    }
    expect(await lecteurClaudeActif("facecam-animee", async () => { throw new Error("base en panne"); })).toBe(false);
  });

  it("(c) côté serveur (vraie lecture en base mémoire) : les 3 clés absentes → allumées ; `false` écrit → éteintes ; lecture qui lève → éteintes", async () => {
    const tableau = ls.portsLecteurTableauStudio("v-1");
    const fa = ls.portsLecteurStudio("retoucheChat.facecamAnimeeLecteur", "facecam-animee", "v-1");
    const demo = ls.portsLecteurStudio("retoucheChat.demoFacecamLecteur", "demo-facecam", "v-1");
    for (const p of [tableau, fa, demo]) expect(await p.claudeAllume()).toBe(true);
    for (const v of [false, "true", 1, null]) {
      for (const c of CLES) await commun.ecrireParametre(c, v);
      // `null` écrit = absent pour `lireParametre` (`??`) : allumé, comme le chat de la démo (ALLUMER-RETOUCHE-DEMO).
      for (const p of [tableau, fa, demo]) expect(await p.claudeAllume(), JSON.stringify(v)).toBe(v === null);
    }
    for (const c of CLES) await commun.ecrireParametre(c, true);
    vi.spyOn(commun, "lireParametre").mockRejectedValue(new Error("base en panne"));
    for (const p of [tableau, fa, demo]) expect(await p.claudeAllume()).toBe(false);
  });

  it("(d) la route reçoit le lecteur par défaut ; `false` écrit → les MÊMES ports (éteint = identique)", async () => {
    const ports = portsGenerateurStudio("facecam-animee");
    expect(await ls.avecLecteurStudio("facecam-animee", "v-1", ports)).not.toBe(ports);
    await commun.ecrireParametre("retoucheChat.facecamAnimeeLecteur", false);
    expect(await ls.avecLecteurStudio("facecam-animee", "v-1", ports)).toBe(ports);
  });

  it("(e) le chat de chaque générateur n'est PAS touché : absent → éteint (sauf la démo, déjà allumée par ALLUMER-RETOUCHE-DEMO)", async () => {
    for (const g of ["avocat", "image-video", "facecam-animee", "tutoriel-outil", "video-longue"] as const) expect(await retoucheChatActif(g, absent), g).toBe(false);
    expect(await retoucheChatActif("demo-facecam", absent)).toBe(true);
  });
});

describe("ALLUMER-LECTEUR-CHAT-v20k · argent (plafond par vidéo 0,25 $)", () => {
  it("(f) plafond confirmé : 0,25 $ exactement, passé au chemin facturé", () => {
    expect(PLAFOND_LECTURE_CHAT_USD).toBe(0.25);
    expect((plafondPropreChat() as unknown as { defautUsd: number }).defautUsd).toBe(0.25);
  });

  it("(g) barrière dure à 0,25 $ : égal, −1, +1, plafond atteint, compteur illisible", () => {
    const pire = 0.045; // pire cas d'une lecture : 6 centimes arrondis
    expect(demandeCentimes(pire)).toBe(6);
    const plafondUsd = PLAFOND_LECTURE_CHAT_USD;
    expect(sousPlafond({ engageCentimes: 25 - 6, plafondUsd, pireUsd: pire })).toBe(true); // égal
    expect(sousPlafond({ engageCentimes: 25 - 6 - 1, plafondUsd, pireUsd: pire })).toBe(true); // −1
    expect(sousPlafond({ engageCentimes: 25 - 6 + 1, plafondUsd, pireUsd: pire })).toBe(false); // +1
    expect(sousPlafond({ engageCentimes: 25, plafondUsd, pireUsd: pire })).toBe(false); // plafond atteint
    expect(sousPlafond({ engageCentimes: Number.NaN, plafondUsd, pireUsd: pire })).toBe(false); // compteur illisible
  });

  it("(h) inventaire : les 3 clés de lecteur sont « allume », déjà en table (règle R-9 : aucun interrupteur NEUF allumé)", () => {
    const inv = readFileSync("tests/usine/inventaire/retouche-chat.test.ts", "utf8");
    for (const c of CLES) expect(inv, c).toMatch(new RegExp(`\\{ cle: "${c.replace(".", "\\.")}", etat: "allume"`));
  });

  it("(i) gardes de texte : une seule lecture de réglage par fichier, défaut `true` ; aucune écriture de réglage ; aucun montant dans une phrase", () => {
    const studio = readFileSync("src/services/retouche-chat/lecteur-studio.ts", "utf8");
    const gen = readFileSync("src/services/retouche-chat/lecteur-generateurs.ts", "utf8");
    expect(studio.match(/lireParametre</g)).toHaveLength(1);
    expect(studio).toContain("lireParametre<unknown>(cle, true)) === true");
    expect(gen).toContain("(await lire(cle, true)) === true");
    for (const t of [studio, gen]) expect(t).not.toMatch(/ecrireParametre|"[^"]*\d+(,\d+)? ?(€|\$)[^"]*"/);
  });
});
