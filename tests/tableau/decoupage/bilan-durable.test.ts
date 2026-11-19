/**
 * FIX-DECOUPAGE-COMPTEUR-c (19/11/2026) : chaque découpage du tableau laisse un bilan durable (dépôt `evenements`), et
 * « Réglages → Refus du découpage » donne le chiffre. Tout passe par le chemin réel : vrais `decouperScriptTableau` et
 * `travaillerTachesTableau`, dépôts en mémoire, double de Claude seulement. Aucun appel réseau, rien de payé.
 */
import { hash } from "@node-rs/argon2";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { mockHeaders, mockNavigation, reinitialiserRequete } from "../../helpers/next-mocks";
import { chiffreRefusDecoupage, idBilan, pourcentage, TYPE_EVENEMENT_BILAN_DECOUPAGE, type EvenementBilanDecoupage } from "@/domaine/tableau-bilan-decoupage";
import { repereTexte } from "@/domaine/relecture-tableau";
import type { BilanDecoupage } from "@/moteurs/montage-tableau/bilan-refus";
import type { OutilsDecoupage } from "@/moteurs/montage-tableau/decoupage";
import type { EntreeRole } from "../../../src/generateur/roles/types";
import { auStyleDemande, AUJOURDHUI_EXEMPLES, contexteExemple, copie, ficheErreurCorrigee, texteScriptDe } from "../regles/exemples";

vi.mock("next/headers", () => mockHeaders);
vi.mock("next/navigation", () => ({ ...mockNavigation, useRouter: () => ({ push: () => undefined, replace: () => undefined, refresh: () => undefined }), usePathname: () => "/reglages/refus-decoupage" }));
vi.mock("next/cache", () => ({ revalidatePath: () => undefined, revalidateTag: () => undefined }));

const { reinitialiserDepots, depots } = await import("@/donnees/memoire");
const auth = await import("@/services/auth");
const { decouperScriptTableau, lireBrouillonTableau, travaillerTachesTableau } = await import("@/services/tableau-creation");
const { lireChiffreRefusDecoupage } = await import("@/services/tableau-bilan-decoupage");
const { default: PageRefusDecoupage } = await import("@/app/(studio)/reglages/refus-decoupage/page");

const MDP = "bilan-durable";
const fiche = ficheErreurCorrigee;
const balise = (variable: string, nom: string) => variable.match(new RegExp(`<${nom}>\\n([\\s\\S]*?)\\n</${nom}>`))?.[1] ?? "";

const donnees = { texte: texteScriptDe(fiche), serieCode: "formation", structure: fiche.structure, douleur: fiche.douleur, gesteMinute: fiche.gesteMinute, finId: "fin-if-abonnement", reseaux: ["verticaux", "linkedin"] };

/** Réponse de « Claude » : la fiche d'exemple, champs fixes recopiés de la demande. */
function reponseDe(entree: EntreeRole, abimer?: (f: Record<string, any>) => void): string { // eslint-disable-line @typescript-eslint/no-explicit-any
  const f = copie(fiche) as Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
  Object.assign(f, JSON.parse(balise(entree.variable, "fiche_fixe")), { serie: JSON.parse(balise(entree.variable, "serie")) });
  auStyleDemande(f as never);
  abimer?.(f);
  return JSON.stringify(f);
}

function double(abimer?: (f: Record<string, any>) => void) { // eslint-disable-line @typescript-eslint/no-explicit-any
  const appels: EntreeRole[] = [];
  const appeler: OutilsDecoupage["appeler"] = async (_role, entree) => {
    appels.push(entree);
    return { ok: true, simule: false, donnees: reponseDe(entree, abimer) };
  };
  return { appels, appeler };
}

/** « Découper en scènes » puis un passage de la boucle de fond. `estDemo` : la vidéo du brouillon est un exemple. */
async function decouper(appeler: OutilsDecoupage["appeler"], opts: { demo?: boolean } = {}) {
  const relu = repereTexte(donnees.texte);
  const prix = await decouperScriptTableau(donnees, { relu }, { aujourdhui: AUJOURDHUI_EXEMPLES });
  if (prix.statut !== "accord-requis") throw new Error(`prix attendu : ${JSON.stringify(prix)}`);
  const r = await decouperScriptTableau(donnees, { accord: prix.centimes, relu }, { aujourdhui: AUJOURDHUI_EXEMPLES });
  if (r.statut !== "en-cours") throw new Error(`découpage non enregistré : ${JSON.stringify(r)}`);
  if (opts.demo) await depots().videos.modifier(r.videoId, { estDemo: true });
  await travaillerTachesTableau({ appeler, aujourdhui: AUJOURDHUI_EXEMPLES });
  return { videoId: r.videoId, tacheId: r.tacheId, tache: lireBrouillonTableau(await depots().videos.obtenir(r.videoId))!.tache! };
}

const bilans = async () => (await depots().evenements.lister((e) => e.type === TYPE_EVENEMENT_BILAN_DECOUPAGE)) as EvenementBilanDecoupage[];

beforeAll(async () => {
  process.env.SESSION_SECRET = "t".repeat(48);
  const e = await hash(MDP, { algorithm: 2, memoryCost: 19456, timeCost: 2, parallelism: 1 });
  process.env.STUDIO_PASSWORD_HASH_B64 = Buffer.from(e).toString("base64");
});

beforeEach(async () => {
  reinitialiserDepots();
  reinitialiserRequete();
  await auth.seConnecter(MDP, false);
  const { texteScript: _s, ...regles } = contexteExemple(fiche);
  void _s;
  for (const p of regles.preuves) await depots().preuves.enregistrer(p as never);
  for (const m of regles.matieres) await depots().matieres.enregistrer(m as never);
});

describe("a) accepté du premier coup", () => {
  it("1 événement, issue « accepte-1er-essai », lié à la vidéo et à la tâche", async () => {
    const claude = double();
    const r = await decouper(claude.appeler);
    expect(r.tache.statut).toBe("terminee");
    const evs = await bilans();
    expect(evs).toHaveLength(1);
    expect(evs[0].bilan.issue).toBe("accepte-1er-essai");
    expect(evs[0].id).toBe(idBilan(r.videoId, r.tacheId, evs[0].bilan.versionId));
    expect(evs[0]).toMatchObject({ entite: "video", entiteId: r.videoId });
  });
});

describe("b) liste sur une page « douleur » : réparée sans IA", () => {
  /** La page « douleur » de la fiche d'exemple porte une liste à pastilles (refus de forme que le Studio répare seul). */
  const avecListe = (f: Record<string, any>) => { // eslint-disable-line @typescript-eslint/no-explicit-any
    const s = f.scenes[1];
    s.gabarit = { role: "douleur" };
    s.elements = [
      { id: "e02", type: "ligne", texte: "Une question courte", niveau: "texte", role: "alerte", bloc: "phrase-cle", ancre: 0 },
      ...["Une question", "L'IA répond", "À côté"].map((t, k) => ({ id: `e0${3 + k}`, type: "ligne", texte: t, niveau: "texte", role: "alerte", bloc: "liste", ancre: [2, 6, 8][k] })),
    ];
  };
  it("1 appel, issue « accepte-par-reparation », la clé « bloc-hors-partie » est comptée en réparés sans IA", async () => {
    const claude = double(avecListe);
    const r = await decouper(claude.appeler);
    expect(r.tache.statut).toBe("terminee");
    expect(claude.appels).toHaveLength(1);
    const evs = await bilans();
    expect(evs).toHaveLength(1);
    expect(evs[0].bilan.issue).toBe("accepte-par-reparation");
    const c = await lireChiffreRefusDecoupage();
    expect(c.parReparation).toBe(1);
    const l = c.parRegle.find((x) => x.cle.endsWith("/bloc-hors-partie"));
    expect(l?.reparesSansIA).toBeGreaterThan(0);
  });
});

describe("c) le texte dit change à chaque réponse : refusé", () => {
  it("issue « refuse-sans-progres », la règle « mot pour mot » reste à corriger", async () => {
    const claude = double((f) => (f.scenes[0].texteDit = f.scenes[0].texteDit.replace("vagues", "floues")));
    const r = await decouper(claude.appeler);
    expect(r.tache.statut).toBe("refusee");
    const evs = await bilans();
    expect(evs).toHaveLength(1);
    expect(evs[0].bilan.issue).toBe("refuse-sans-progres");
    const c = await lireChiffreRefusDecoupage();
    expect(c.refuses).toBe(1);
    expect(c.parRegle.find((x) => /mot pour mot/.test(x.cle))?.restes).toBeGreaterThan(0);
  });
});

describe("d) rejouer la même tâche", () => {
  it("toujours 1 seul événement (identifiant stable)", async () => {
    const { consignerBilanDecoupage } = await import("@/services/tableau-bilan-decoupage");
    const r = await decouper(double().appeler);
    const [ev] = await bilans();
    await consignerBilanDecoupage(ev.bilan, { tacheId: r.tacheId, estDemo: false });
    await consignerBilanDecoupage(ev.bilan, { tacheId: r.tacheId, estDemo: false });
    expect(await bilans()).toHaveLength(1);
  });
});

describe("d bis) vidéo supprimée, issues sans jugement, version neuve", () => {
  it("vidéo supprimée : rien n'est écrit", async () => {
    const { consignerBilanDecoupage } = await import("@/services/tableau-bilan-decoupage");
    const r = await decouper(double().appeler);
    const [ev] = await bilans();
    await depots().evenements.supprimer(ev.id);
    await depots().videos.supprimer(r.videoId);
    await consignerBilanDecoupage(ev.bilan, { tacheId: r.tacheId, estDemo: false });
    expect(await bilans()).toHaveLength(0);
  });
  it("issues budget / appel / simulation : jamais consignées", async () => {
    const { consignerBilanDecoupage } = await import("@/services/tableau-bilan-decoupage");
    const r = await decouper(double().appeler);
    const [ev] = await bilans();
    await depots().evenements.supprimer(ev.id);
    for (const issue of ["budget", "appel", "simulation"] as const) await consignerBilanDecoupage({ ...ev.bilan, issue }, { tacheId: r.tacheId, estDemo: false });
    expect(await bilans()).toHaveLength(0);
  });
  it("même tâche, version neuve : un 2e bilan est consigné", async () => {
    const { consignerBilanDecoupage } = await import("@/services/tableau-bilan-decoupage");
    const r = await decouper(double().appeler);
    const [ev] = await bilans();
    await consignerBilanDecoupage({ ...ev.bilan, versionId: `${ev.bilan.versionId}-neuve` }, { tacheId: r.tacheId, estDemo: false });
    expect(await bilans()).toHaveLength(2);
  });
});

describe("e) le dépôt qui lève à l'écriture", () => {
  it("le découpage aboutit quand même, rien ne remonte", async () => {
    const espion = vi.spyOn(depots().evenements, "enregistrer").mockImplementation(async (e) => {
      if (e.type === TYPE_EVENEMENT_BILAN_DECOUPAGE) throw new Error("dépôt en panne");
      return e;
    });
    try {
      const r = await decouper(double().appeler);
      expect(r.tache).toMatchObject({ statut: "terminee", message: "Scènes prêtes." });
      expect(await bilans()).toHaveLength(0);
    } finally {
      espion.mockRestore();
    }
  });
});

describe("f) vidéo d'exemple", () => {
  it("le bilan est écrit mais non compté", async () => {
    await decouper(double().appeler, { demo: true });
    expect(await bilans()).toHaveLength(1);
    expect((await lireChiffreRefusDecoupage()).decoupages).toBe(0);
  });
});

function bilan(issue: BilanDecoupage["issue"], essais: BilanDecoupage["essais"]): BilanDecoupage {
  return { videoId: "v", versionId: "b1", issue, appels: essais.length, essais };
}

describe("g) chiffre pur", () => {
  it("3 bilans faits main : pourcentages, comptes et tri exacts", () => {
    const c = chiffreRefusDecoupage([
      bilan("accepte-1er-essai", [{ essai: 1, refusAvant: {}, reparesSansIA: {}, restes: {} }]),
      bilan("accepte-apres-relance-1", [
        { essai: 1, refusAvant: { a: 2, b: 1 }, reparesSansIA: { b: 1 }, restes: { a: 2 } },
        { essai: 2, refusAvant: {}, reparesSansIA: {}, restes: {} },
      ]),
      bilan("refuse-sans-progres", [
        { essai: 1, refusAvant: { a: 1, c: 3 }, reparesSansIA: {}, restes: { a: 1, c: 3 } },
        { essai: 2, refusAvant: { a: 1, c: 3 }, reparesSansIA: {}, restes: { a: 1, c: 3 } },
      ]),
    ]);
    expect(c).toMatchObject({ decoupages: 3, premierCoup: 1, parReparation: 0, apresRelance: 1, refuses: 1 });
    expect(pourcentage(c.premierCoup, c.decoupages)).toBe(33);
    expect(pourcentage(0, 0)).toBe(0);
    expect(c.parRegle).toEqual([
      { cle: "c", refus: 6, reparesSansIA: 0, levesParRelance: 0, restes: 3 },
      { cle: "a", refus: 4, reparesSansIA: 0, levesParRelance: 2, restes: 1 },
      { cle: "b", refus: 1, reparesSansIA: 1, levesParRelance: 0, restes: 0 },
    ]);
  });
});

describe("h) page « Refus du découpage »", () => {
  const html = async () => renderToStaticMarkup(createElement("div", null, await PageRefusDecoupage()));
  const poser = async (id: string, b: BilanDecoupage) => {
    const date = new Date().toISOString();
    await depots().evenements.enregistrer({ id, type: TYPE_EVENEMENT_BILAN_DECOUPAGE, message: "x", entite: "video", entiteId: b.videoId, date, creeLe: date, modifieLe: date, bilan: b } as never);
  };
  it("sans événement : « Aucun découpage sur 30 jours. »", async () => {
    expect(await html()).toContain("Aucun découpage sur 30 jours.");
  });
  it("avec 2 événements : la phrase du chiffre, la 1re ligne du tableau, aucun symbole d'argent", async () => {
    await poser("ev-1", bilan("accepte-1er-essai", [{ essai: 1, refusAvant: {}, reparesSansIA: {}, restes: {} }]));
    await poser("ev-2", bilan("refuse-sans-progres", [{ essai: 1, refusAvant: { "texte dit mot pour mot": 2 }, reparesSansIA: {}, restes: { "texte dit mot pour mot": 2 } }]));
    const h = await html();
    expect(h).toContain("30 jours : 2 découpages · 50 % acceptés du premier coup · 0 réparé sans IA · 0 accepté après relance · 1 refusé");
    expect(h).toMatch(/Le texte dit n(?:'|&#x27;)est pas celui du script, mot pour mot<\/td><td[^>]*>2<\/td>/);
    expect(h).not.toMatch(/€|\$/);
  });
  it("le code de la page ne contient ni montant ni import de montants", () => {
    const src = readFileSync(join(__dirname, "../../../src/app/(studio)/reglages/refus-decoupage/page.tsx"), "utf8");
    expect(src).not.toMatch(/€|EUR|lib\/montants/);
  });
});
