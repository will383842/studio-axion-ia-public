/**
 * APPRENTISSAGE, côté serveur (simulation, 0 €, aucun réseau) : éteint par défaut, `<gagnants>` figé pour la journée,
 * mémoire des corrections de Will à l'enregistrement d'une relecture.
 */
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { mockHeaders, mockNavigation, reinitialiserRequete } from "../helpers/next-mocks";
import { matiere, preparerMotDePasse } from "../helpers/g1a";

vi.mock("next/headers", () => mockHeaders);
vi.mock("next/navigation", () => mockNavigation);

const { reinitialiserDepots, depots } = await import("@/donnees/memoire");
const auth = await import("@/services/auth");
const gen = await import("@/services/generateur");
const ecran = await import("@/services/generateur-ecran");
const bg = await import("@/services/boucle-generation");
const app = await import("@/services/apprentissage");
const { ecrireParametre } = await import("@/services/_commun");
const { appliquerSaisie } = await import("@/domaine/relecture-script");
const { peutRefaire } = await import("@/components/generateur/CeQuiMarche");
const { PARAM_APPRENTISSAGE } = await import("@/domaine/apprentissage");

const MDP = "essai-apprentissage";
beforeAll(async () => {
  await preparerMotDePasse(MDP);
});
beforeEach(async () => {
  reinitialiserDepots();
  reinitialiserRequete();
  bg.suspendreBoucleGeneration(true);
  await auth.seConnecter(MDP, false);
});
afterEach(() => {
  bg.arreterBoucleGeneration();
  vi.useRealTimers();
});

const allumer = () => ecrireParametre(PARAM_APPRENTISSAGE, true);
const A = "2026-10-17T08:00:00.000Z";

/** Une version mesurée de TEST : script, version, publication avec ses chiffres (tauxAbandon3s plus bas = mieux). */
async function videoMesuree(n: number, abandon: number, formatId = "avocat") {
  const d = depots();
  const bloc = (id: string, texte: string) => ({ id: `b-${id}`, blocRecette: "x", segments: [{ id: `s-${id}`, texte }] });
  await d.scripts.enregistrer({ id: `sc-${n}`, blocs: [bloc(`c${n}`, "Le milieu du texte, assez long pour compter des mots.")], creeLe: A, modifieLe: A } as never);
  await d.variantes.enregistrer({
    id: `va-${n}`, code: `000${n}-AV-TT`, scriptMaitreId: `sm-${n}`, scriptId: `sc-${n}`, formatId, reseau: "tiktok", version: 1, segmentFacultatifRetenu: false,
    ouverture: [bloc(`o${n}`, "Pourquoi vos factures sont-elles perdues ?")], fin: [bloc(`f${n}`, "Réservez votre appel.")],
    caracteristiques: { structure: "S2", familleAccroche: "question" }, creeLe: A, modifieLe: A,
  } as never);
  await d.publications.enregistrer({ id: `pu-${n}`, videoId: `vi-${n}`, reseau: "tiktok", statut: "publiee", via: "buffer", date: `2026-10-0${n}T07:00:00.000Z`, texte: "", varianteId: `va-${n}`, stats: { vues: 100 + n, likes: 0, commentaires: 0, partages: 1, tauxAbandon3s: abandon }, creeLe: A, modifieLe: A } as never);
}

describe("éteint par défaut : rien ne change", () => {
  it("réglage absent ou faux : ni gagnants mesurés, ni poids, ni mémoire", async () => {
    for (let n = 1; n <= 4; n++) await videoMesuree(n, 10 * n);
    expect(await app.apprentissageActif()).toBe(false);
    expect(await app.gagnantsDuJour("avocat")).toBeUndefined();
    expect(await app.poidsApprentissage()).toBeUndefined();
    expect(await app.memoriserCorrectionsWill([{ id: "a", dit: "Avant." }], [{ id: "a", dit: "Après." }], { formatId: "avocat" })).toBe(0);
    expect(await depots().correctionsWill.compter()).toBe(0);
    await ecrireParametre(PARAM_APPRENTISSAGE, false);
    expect(await app.gagnantsDuJour("avocat")).toBeUndefined();
  });
});

describe("L1 : `<gagnants>` figé pour la journée", () => {
  it("moins de 3 vidéos mesurées dans le format : repli (rien), mais le repli aussi est figé pour la journée", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date(A));
    await allumer();
    await videoMesuree(1, 10);
    await videoMesuree(2, 20);
    expect(await app.gagnantsDuJour("avocat")).toBeUndefined();
  });

  it("3 vidéos et plus : bloc de forme ; une mesure qui arrive dans la journée ne le change pas ; le lendemain, il est recalculé", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date(A));
    await allumer();
    for (let n = 1; n <= 3; n++) await videoMesuree(n, 10 * n);
    const matin = await app.gagnantsDuJour("avocat");
    expect(matin).toContain("FORME");
    expect(matin).toContain("n° 1 sur 3");
    expect(matin).not.toMatch(/factures|Réservez|milieu du texte/);

    // Une 4e vidéo, nettement meilleure, arrive le même jour (soir) : le texte (donc le cache 1 h) ne bouge pas.
    await videoMesuree(4, 1);
    vi.setSystemTime(new Date("2026-10-17T21:30:00.000Z"));
    expect(await app.gagnantsDuJour("avocat")).toBe(matin);
    vi.setSystemTime(new Date("2026-10-17T23:59:59.000Z"));
    expect(await app.gagnantsDuJour("avocat")).toBe(matin);

    // Le lendemain : recalcul avec les 4 vidéos.
    vi.setSystemTime(new Date("2026-10-18T00:00:01.000Z"));
    const lendemain = await app.gagnantsDuJour("avocat");
    expect(lendemain).toContain("sur 4");
    expect(lendemain).not.toBe(matin);
    // Et il se fige à nouveau pour cette journée.
    await videoMesuree(5, 2);
    vi.setSystemTime(new Date("2026-10-18T12:00:00.000Z"));
    expect(await app.gagnantsDuJour("avocat")).toBe(lendemain);
  });

  it("un autre format n'est pas touché par les vidéos de celui-ci", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date(A));
    await allumer();
    for (let n = 1; n <= 3; n++) await videoMesuree(n, 10 * n);
    expect(await app.gagnantsDuJour("cas-concret")).toBeUndefined();
  });
});

describe("L2 : poids tirés de ce qui marche", () => {
  it("jamais au-delà de ×1,5 ; vide quand rien n'est lisible", async () => {
    await allumer();
    expect(await app.poidsApprentissage()).toBeUndefined();
    for (let n = 1; n <= 4; n++) await videoMesuree(n, 10 * n);
    const p = await app.poidsApprentissage();
    for (const x of [...Object.values(p?.structure ?? {}), ...Object.values(p?.famille ?? {})]) {
      expect(x).toBeGreaterThanOrEqual(1);
      expect(x).toBeLessThanOrEqual(1.5);
    }
  });
});

describe("Mémoire de la voix : enregistrer une relecture modifiée", () => {
  async function sujet() {
    await depots().matieres.enregistrer(matiere("La première fois que j'ai vu ses tableaux, j'ai compté 47 onglets."));
    const s = await gen.creerSujet({ idee: "ChatGPT peut-il lire vos factures ?", reseaux: ["tiktok"], formatId: "avocat", motCle: "factures ChatGPT" });
    const r = await gen.ecrireSujetSimule(s.id);
    if (!r.ok) throw new Error(r.message);
    const [v] = await depots().variantes.lister((x) => x.scriptMaitreId === s.id);
    return { cible: { sujetId: s.id, varianteId: v.id }, v };
  }

  it("allumé : la phrase avant et après, le format et la date sont gardés ; un second enregistrement identique n'ajoute rien", async () => {
    await allumer();
    const { cible, v } = await sujet();
    const { lignes } = await ecran.lotARelire(cible);
    const avant = lignes[0].dit;
    const relues = appliquerSaisie(lignes, lignes[0].id, { dit: "Vos factures, ChatGPT sait les lire." });
    const r = await ecran.enregistrerRelecture(cible, relues);
    expect(r.modifiees).toBe(1);
    const c = await depots().correctionsWill.lister();
    expect(c).toHaveLength(1);
    expect(c[0]).toMatchObject({ phraseAvant: avant.replace(/\s+/g, " ").trim(), phraseApres: "Vos factures, ChatGPT sait les lire.", formatId: "avocat", code: v.code });
    expect(c[0].date).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    // Même texte renvoyé : plus de différence, rien de nouveau.
    const { lignes: l2 } = await ecran.lotARelire(cible);
    await ecran.enregistrerRelecture(cible, l2);
    expect(await depots().correctionsWill.compter()).toBe(1);
  });

  it("un nom de client dit dans une phrase est masqué (comme le socle) avant d'être gardé", async () => {
    await allumer();
    await depots().matieres.enregistrer(matiere("Dupont Frères m'a confié ses factures.", "anecdote-will", { nomsSensibles: ["Dupont Frères"] }));
    const n = await app.memoriserCorrectionsWill([{ id: "a", dit: "Chez Dupont Frères, tout est perdu." }], [{ id: "a", dit: "Chez Dupont Frères, plus rien ne se perd." }], { formatId: "avocat" });
    expect(n).toBe(1);
    const [c] = await depots().correctionsWill.lister();
    expect(c.phraseAvant).toBe("Chez un client, tout est perdu.");
    expect(c.phraseApres).toBe("Chez un client, plus rien ne se perd.");
    expect(JSON.stringify(c)).not.toContain("Dupont");
  });

  it("éteint : la relecture s'enregistre comme avant, rien n'est gardé", async () => {
    const { cible } = await sujet();
    const { lignes } = await ecran.lotARelire(cible);
    const r = await ecran.enregistrerRelecture(cible, appliquerSaisie(lignes, lignes[0].id, { dit: "Vos factures, ChatGPT sait les lire." }));
    expect(r.modifiees).toBe(1);
    expect(await depots().correctionsWill.compter()).toBe(0);
  });
});

describe("« Refaire cette structure sur un autre sujet »", () => {
  it("n'apparaît que réglage allumé (et si la vidéo a une structure)", async () => {
    expect(peutRefaire(await app.apprentissageActif(), "S2")).toBe(false);
    await allumer();
    expect(peutRefaire(await app.apprentissageActif(), "S2")).toBe(true);
    expect(peutRefaire(true, undefined)).toBe(false);
  });
  it("le serveur refuse la structure imposée quand le réglage est éteint (le bouton masqué ne suffit pas), l'accepte une fois allumé", async () => {
    const brief = { idee: "Remplacer Excel par un tableau de bord", reseaux: ["tiktok" as const], formatId: "avocat", structureImposee: "S2", familleAccroche: "question" };
    const eteint = await gen.creerSujet(brief);
    expect(eteint.brief.structureImposee).toBeUndefined();
    expect(eteint.brief.familleAccroche).toBeUndefined();
    await allumer();
    const allume = await gen.creerSujet(brief);
    expect(allume.brief.structureImposee).toBe("S2");
    expect(allume.brief.familleAccroche).toBe("question");
  });
});
