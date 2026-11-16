/**
 * Opposition + politesses anglaises : « stop please », « thanks, stop », « stop sil vous plait » sont des OPPOSITIONS (comme « stop merci »).
 * Invariant : toute politesse acceptée autour de GUIDE est acceptée autour de « stop ». Données fictives, aucun réseau.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { lireEnveloppe, lireEvenementCommentaire, lireEvenementRun, motSeulDe } from "@/domaine/guide-reseau/crochet-zernio";
import { lireCommentaireManuel } from "@/domaine/guide-reseau/commentaire-manuel";
import { MOTS_NEUTRES_POLITESSE } from "@/domaine/guide-reseau/mot-normalise";
import { classerOpposition, estMotOpposition } from "@/domaine/guide-reseau/opposition";
import { deposerCommentaire, evenement } from "./aides/conversation";
import { banc, Com, depots, envoisSortants, nettoyer, Opp, passer, preparer, T0 } from "./filet-guide/_amorce";

vi.mock("@/services/auth", () => ({ exigerSession: vi.fn(async () => ({})) }));

const REG = ["GUIDE", "ESSAIGPT7"];
const corps = (text: string, extra: Record<string, unknown> = {}, plateforme = "facebook") =>
  lireEnveloppe(JSON.stringify({ id: "e1", event: "comment.received", timestamp: 1_800_000_000, account: { accountId: "cpt", platform: plateforme }, comment: { id: "c1", text, author: { id: "a1" }, ...extra } }))!;
const run = (text: string) =>
  lireEnveloppe(JSON.stringify({ id: "evt_r1", event: "workflow.run.completed", timestamp: 1_800_000_000, execution: { id: "exec_1", status: "completed" }, contact: { id: "ct_1" }, trigger: { type: "keyword", text } }))!;

describe("1 · stop + politesse anglaise ou « sil vous plait » = opposition", () => {
  it.each([
    "stop please", "please stop", "STOP PLEASE!", "stop thanks", "thanks, stop", "stop thank you", "stop, thank you!", "hello stop", "hi stop", "Hi, stop please", "stop sil vous plait",
  ])("« %s » → opposition / STOP", (t) => {
    expect(classerOpposition(t)).toBe("opposition");
    expect(motSeulDe(t, REG)).toBe("STOP");
  });
});

describe("2 · mélange politesses françaises et anglaises", () => {
  it.each([
    ["stop merci please", "STOP"], ["bonjour stop please", "STOP"], ["arrêtez please", "ARRETEZ"], ["désinscrire thanks", "DESINSCRIRE"],
  ])("« %s » → %s", (t, mot) => {
    expect(classerOpposition(t)).toBe("opposition");
    expect(motSeulDe(t, REG)).toBe(mot);
  });
});

describe("3 · lecteurs d'événements", () => {
  it.each(["facebook", "instagram"])("commentaire %s : motSeul STOP", (reseau) => {
    expect(lireEvenementCommentaire(corps("stop please", {}, reseau))!.motSeul).toBe("STOP");
  });
  it("commentaire LinkedIn : motSeul STOP", () => {
    expect(lireCommentaireManuel(corps("stop please", {}, "linkedin"))!.motSeul).toBe("STOP");
  });
  it("run de workflow : motDeclencheur STOP", () => {
    expect(lireEvenementRun(run("stop please"))!.motDeclencheur).toBe("STOP");
  });
});

describe("4 · service : le commentaire « stop please » est une opposition inscrite", () => {
  beforeEach(preparer);
  afterEach(nettoyer);
  const lignes = () => Com.lireParametre<Array<{ id: string }>>(Opp.PARAM_OPPOSITIONS_MOTS, []);

  it("clos « oppose », 0 envoi, 1 ligne d'opposition", async () => {
    const id = await deposerCommentaire(depots, { reseau: "facebook", motSeul: lireEvenementCommentaire(corps("stop please"))!.motSeul });
    await passer();
    expect(envoisSortants()).toBe(0);
    expect(banc.site.vus).toHaveLength(0);
    expect((await evenement(depots, id)).charge.etat).toBe("oppose");
    expect(await lignes()).toHaveLength(1);
  });
  it("GUIDE d'abord, puis « stop thanks » de la même personne : plus aucun envoi après l'arrêt", async () => {
    await deposerCommentaire(depots, { reseau: "facebook", motSeul: "GUIDE" });
    await passer();
    const avant = envoisSortants();
    const stop = await deposerCommentaire(depots, { reseau: "facebook", motSeul: lireEvenementCommentaire(corps("stop thanks"))!.motSeul });
    await passer(T0 + 1000);
    expect((await evenement(depots, stop)).charge.etat).toBe("oppose");
    await passer(T0 + 7 * 24 * 3600 * 1000);
    expect(envoisSortants()).toBe(avant);
    expect(await lignes()).toHaveLength(1);
  });
});

describe("5 · invariant : toute politesse acceptée autour de GUIDE l'est autour de stop", () => {
  it("la liste importée n'est pas vide", () => expect(MOTS_NEUTRES_POLITESSE.length).toBeGreaterThan(0));
  it.each([...MOTS_NEUTRES_POLITESSE])("politesse %s des deux côtés de stop", (p) => {
    expect(estMotOpposition(`stop ${p}`)).toBe(true);
    expect(estMotOpposition(`${p} stop`)).toBe(true);
  });
  it.each(["stop s'il vous plaît", "stop sil vous plait", "stop s il vous plait"])("« %s »", (t) => expect(estMotOpposition(t)).toBe(true));
});

describe("6 · inchangés (verts avant et après)", () => {
  it("« stop » seul → opposition / STOP", () => {
    expect(classerOpposition("stop")).toBe("opposition");
    expect(motSeulDe("stop", REG)).toBe("STOP");
  });
  it.each(["GUIDE stop", "stop GUIDE", "stop please GUIDE", "GUIDE please stop"])("« %s » → doute, motSeul null", (t) => {
    expect(classerOpposition(t)).toBe("doute");
    expect(motSeulDe(t, REG)).toBeNull();
  });
  it.each(["please do not stop", "please don't stop", "thanks for stopping by"])("« %s » → doute", (t) => expect(classerOpposition(t)).toBe("doute"));
  it.each(["please", "thanks", "hello", "hi", "thank you", "you", "sil"])("« %s » seul : aucun nouveau déclencheur", (t) => {
    expect(classerOpposition(t)).toBe("non");
    expect(motSeulDe(t, REG)).toBeNull();
  });
  it("« GUIDE you » → null (YOU n'est pas une politesse de déclenchement)", () => expect(motSeulDe("GUIDE you", REG)).toBeNull());
  it("« GUIDE please » → GUIDE", () => expect(motSeulDe("GUIDE please", REG)).toBe("GUIDE"));
});
