/** NEW-ARG-05 · limite technique d'appels par jour (heure de Paris) : horloge simulée, aucun appel réel. */
import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { mockHeaders, mockNavigation, reinitialiserRequete } from "./helpers/next-mocks";
import { preparerMotDePasse } from "./helpers/g1a";

vi.mock("next/headers", () => mockHeaders);
vi.mock("next/navigation", () => mockNavigation);
vi.mock("next/cache", () => ({ revalidatePath: () => undefined, revalidateTag: () => undefined }));

const { DEMANDE_MODELE } = await import("./tableau-scripts/modele-valide");
const auth = await import("@/services/auth");
const creation = await import("@/services/tableau-creation");
const taches = await import("@/services/tableau-taches");
const boucle = await import("@/services/boucle");
const { etatBoucle } = await import("@/services/_boucle-etat");
const { reinitialiserDepots, depots } = await import("@/donnees/memoire");
const { ecrireParametre, lireParametre } = await import("@/services/_commun");
const L = await import("@/services/limite-appels");
const { BandeauLimiteAppels } = await import("@/app/(studio)/_accueil/BandeauLimiteAppels");

const T0 = Date.parse("2027-03-10T10:00:00Z");
const JOUR = 24 * 3_600_000;

const MDP = "limite-appels";
beforeAll(async () => {
  await preparerMotDePasse(MDP);
});
beforeEach(() => {
  reinitialiserDepots();
  reinitialiserRequete();
  taches.tachesEnCours().clear();
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

async function allumer(limite: number) {
  await ecrireParametre(L.PARAM_LIMITE_ACTIVE, true);
  await ecrireParametre(L.PARAM_LIMITE_PAR_JOUR, limite);
}

const COMITE = "comité éditorial";
const MOT = "parcours mot → guide";
const envoye = { etat: "envoye", lotId: "l", idees: 3, pireUsd: 0 };
const compte = async () => ((await lireParametre<{ n: number } | null>(L.PARAM_COMPTE_APPELS, null))?.n ?? 0);
/** Lance comme la boucle (même chemin que `lancerAnnexe`) et rend ce que la tâche a fait. */
async function viaBoucle(nom: string, resultat: unknown, instant = T0) {
  const f = vi.fn(async () => resultat);
  await L.lancerSousLimite(nom, f, instant);
  return f.mock.calls.length;
}

describe("NEW-ARG-05 · limite d'appels", () => {
  it("éteinte par défaut : tout part, rien n'est écrit", async () => {
    for (let i = 0; i < 50; i++) expect(await viaBoucle(COMITE, envoye)).toBe(1);
    expect(await lireParametre(L.PARAM_COMPTE_APPELS, null)).toBeNull();
    expect((await L.etatLimiteAppels(T0)).atteinte).toBe(false);
  });
  it("allumée : l'automatique s'arrête une fois la limite atteinte (vrais appels comptés)", async () => {
    await allumer(3);
    const r: number[] = [];
    for (let i = 0; i < 5; i++) r.push(await viaBoucle(COMITE, envoye));
    expect(r).toEqual([1, 1, 1, 0, 0]);
    expect(await compte()).toBe(3);
    expect((await L.etatLimiteAppels(T0)).atteinte).toBe(true);
  });
  it("tours à vide : 1 000 passages sans travail ne bougent pas le compte et n'écrivent rien", async () => {
    await allumer(3);
    for (let i = 0; i < 1000; i++) {
      await viaBoucle(COMITE, { etat: "rien-a-juger" });
      await viaBoucle(MOT, { actif: true, traites: 0, envoyes: 0, definitifs: 0, aReessayer: 0, ecartes: 0 });
    }
    expect(await lireParametre(L.PARAM_COMPTE_APPELS, null)).toBeNull();
    expect(await viaBoucle(COMITE, envoye)).toBe(1); // la limite n'est pas entamée
    expect(await compte()).toBe(1);
  });
  it("parcours mot : on compte les envois réels", async () => {
    await allumer(5);
    await viaBoucle(MOT, { actif: true, traites: 4, envoyes: 4, definitifs: 0, aReessayer: 0, ecartes: 0 });
    expect(await compte()).toBe(4);
  });
  it("jamais le manuel : limite atteinte, « Reprendre » une tâche du tableau la fait quand même tourner (vrai chemin `reveillerTaches`)", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    vi.useFakeTimers({ toFake: ["Date"] }); // le vrai chemin lit l'heure du jour : on la fixe sur le jour du compte
    vi.setSystemTime(T0);
    vi.stubGlobal("fetch", (async () => { throw new Error("réseau interdit"); }) as typeof fetch);
    await auth.seConnecter(MDP, false);
    // Une écriture du tableau arrêtée sur erreur, à reprendre à la main.
    const prix = (await creation.ecranCreationTableau()).ecriture.coutCentimes;
    const r = await creation.ecrireScriptTableau({ ...DEMANDE_MODELE, vraiCas: null }, { accord: prix }, { client: { simule: true, appeler: async () => { throw new Error("panne"); } } });
    if (r.statut !== "en-cours") throw new Error(JSON.stringify(r));
    await taches.modifierTache(r.videoId, null, (t) => t && { ...t, statut: "erreur", enVol: undefined, message: "arrêt" });
    // Limite allumée et atteinte : l'automatique est freiné.
    await allumer(1);
    expect(await viaBoucle(COMITE, envoye)).toBe(1);
    expect(await viaBoucle(COMITE, envoye)).toBe(0);
    expect((await L.etatLimiteAppels(T0)).atteinte).toBe(true);
    // La boucle tourne dans ce processus et tient son verrou : « Reprendre » la réveille tout de suite.
    const etat = etatBoucle();
    const avant = { active: etat.active, verrouTenu: etat.verrouTenu };
    etat.active = true;
    etat.verrouTenu = true;
    try {
      expect(await creation.reprendreTacheTableau(r.videoId, prix)).toMatchObject({ statut: "en-cours" });
      const annexe = boucle.annexesEnVol().get(taches.NOM_ANNEXE_TABLEAU);
      expect(annexe, "l'annexe du tableau n'a pas été lancée").toBeDefined();
      await annexe;
    } finally {
      etat.active = avant.active;
      etat.verrouTenu = avant.verrouTenu;
    }
    // La tâche a été travaillée (Claude n'est pas relié : elle s'arrête sur une réponse claire, elle n'attend plus).
    const t = creation.lireBrouillonTableau((await depots().videos.obtenir(r.videoId))!)!.tache!;
    expect(t.statut).not.toBe("en-attente");
    // Le compte n'a pas bougé : le manuel n'est ni freiné ni compté.
    expect(await compte()).toBe(1);
    for (const nom of ["tâches du tableau animé", "lots d'images", "parcours de conversation"]) expect(L.ANNEXES_AUTOMATIQUES).not.toContain(nom);
  }, 60_000);
  it("le compte repart à zéro au changement de jour à Paris (pas à minuit UTC)", async () => {
    await allumer(1);
    const soir = Date.parse("2027-03-10T22:30:00Z"); // 23 h 30 à Paris
    expect(await viaBoucle(COMITE, envoye, soir)).toBe(1);
    expect(await viaBoucle(COMITE, envoye, Date.parse("2027-03-10T23:30:00Z"))).toBe(1); // 00 h 30 le 11 : nouveau jour
    expect(await viaBoucle(COMITE, envoye, Date.parse("2027-03-11T00:30:00Z"))).toBe(0);
    expect(await viaBoucle(COMITE, envoye, soir + 2 * JOUR)).toBe(1);
  });
  it("une lecture en erreur n'arrête jamais rien", async () => {
    await allumer(1);
    const f = vi.fn(async () => envoye);
    await L.lancerSousLimite(COMITE, f, T0, { lire: async () => { throw new Error("x"); } });
    expect(f).toHaveBeenCalledTimes(1);
  });
  it("bandeau : rien tant que la limite n'est pas atteinte ; sinon un message qui vouvoie, sans montant", () => {
    expect(renderToStaticMarkup(createElement(BandeauLimiteAppels, { atteinte: false }))).toBe("");
    const html = renderToStaticMarkup(createElement(BandeauLimiteAppels, { atteinte: true }));
    expect(html).toMatch(/vous/i);
    const texte = html.replace(/<svg[\s\S]*?<\/svg>/, "").replace(/<[^>]+>/g, "").replace(/&#x27;/g, "");
    expect(texte).not.toMatch(/[€$]|euro|dollar|\d/i);
  });
  it("boucle.ts : un import et un appel seulement, aucune logique", () => {
    const src = readFileSync("src/services/boucle.ts", "utf8");
    expect(src.match(/limite-appels/g)).toHaveLength(1);
    expect(src.match(/lancerSousLimite/g)).toHaveLength(2);
    expect(L.PARAM_LIMITE_ACTIVE).toBe("limite_appels.active");
  });
});
