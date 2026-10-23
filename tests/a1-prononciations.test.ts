/**
 * Lot A1 — PRONONCIATIONS (`PRONONCIATIONS-SYSTEME.md`, 10 fonctions) : une règle = un test.
 * Fonctions pures (`domaine/prononciations.ts`), report avec variantes et écriture (`moteurs/montage-avocat/report.ts`),
 * migration étape 12 (idempotente), service (ajout, doublons, modification archivée, lot, écoute, contrôle d'une vidéo).
 * Aucun réseau, aucune clé : la voix est la simulation.
 */
import { hash } from "@node-rs/argon2";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { mockHeaders, mockNavigation, reinitialiserRequete } from "./helpers/next-mocks";

vi.mock("next/headers", () => mockHeaders);
vi.mock("next/navigation", () => mockNavigation);
vi.mock("next/cache", () => ({ revalidatePath: () => undefined }));

const { reinitialiserDepots, depots } = await import("@/donnees/memoire");
const auth = await import("@/services/auth");
const pr = await import("@/domaine/prononciations");
const { preparerTexteVoix, reporterHorodatages } = await import("@/moteurs/montage-avocat/report");
const { horodaterTexte } = await import("@/domaine/derivations");
const { etape12Prononciations, CHOIX_VOIX_WILL } = await import("@/services/migrations/etape-12-prononciations");
const service = await import("@/services/prononciations");
const { fabriquerSousTitres } = await import("@/briques/sous-titres");

import type { Prononciation } from "@/domaine/types";

const MDP_TEST = "essai-lot-a1-prononciations";
const t0 = "2026-10-01T10:00:00.000Z";
const entree = (mot: string, prononciation: string, extra: Partial<Prononciation> = {}): Prononciation => ({ id: `pr-${mot}`, mot, prononciation, creeLe: t0, modifieLe: t0, ...extra });

beforeAll(async () => {
  process.env.SESSION_SECRET = "a".repeat(48);
  const empreinte = await hash(MDP_TEST, { algorithm: 2, memoryCost: 19456, timeCost: 2, parallelism: 1 });
  process.env.STUDIO_PASSWORD_HASH_B64 = Buffer.from(empreinte).toString("base64");
});

beforeEach(async () => {
  reinitialiserDepots();
  reinitialiserRequete();
  await auth.seConnecter(MDP_TEST, false);
});

/* ------------------------------------------------------------------ */
describe("n° 6 — variantes : casse, tiret / espace, pluriel simple", () => {
  it("un mot couvre sa casse et ses formes avec ou sans tiret / espace", () => {
    for (const forme of ["Axion-IA", "AXION-IA", "axion ia", "AxionIA", "Axion IA"]) expect(pr.contientMot(`Chez ${forme}, on avance.`, "Axion-IA")).toBe(true);
  });
  it("pluriel simple accepté, mais pas un autre mot qui commence pareil", () => {
    expect(pr.contientMot("trois PVs reçus", "PV")).toBe(true);
    expect(pr.contientMot("un tube en PVC", "PV")).toBe(false);
  });
  it("la feuille montre les variantes reconnues", () => {
    expect(pr.variantesMot("Axion-IA")).toEqual(expect.arrayContaining(["AXION-IA", "Axion IA", "AxionIA", "Axion-IAs"]));
  });
  it("le report de la voix reconnaît les variantes et garde l'élision (« l'IA » → « l'i-a »)", () => {
    const t = preparerTexteVoix([{ id: "s", texte: "L'IA d'AXION IA et les PVs de AxionIA, d'accord ?" }], [
      { mot: "Axion-IA", prononciation: "axion i-a" },
      { mot: "PV", prononciation: "pé vé" },
      { mot: "IA", prononciation: "i-a" },
    ]);
    expect(t.texte.replace(/\u00a0/g, " ")).toBe("L'i-a d'axion i-a et les pé vé de axion i-a, d'accord ?");
    // Le texte de Will n'est pas touché : chaque mot affiché garde son temps.
    const r = reporterHorodatages(t, horodaterTexte(t.texte, 4.4));
    expect(r.map((m) => m.mot).join(" ").replace(/\u00a0/g, " ")).toBe("L'IA d'AXION IA et les PVs de AxionIA, d'accord ?");
  });
});

describe("n° 7 — façon de dire ≠ façon d'écrire", () => {
  it("l'entrée appliquée porte la graphie des sous-titres ; la voix reconnaît toujours la forme saisie", () => {
    const actives = pr.prononciationsActives([entree("35h", "trente-cinq heures", { ecriture: "35 h" })]);
    expect(actives).toEqual([{ mot: "35 h", prononciation: "trente-cinq heures", ecriture: "35 h" }]);
    // La voix dit « trente-cinq heures » pour « 35h » comme pour « 35 h ».
    expect(preparerTexteVoix([{ id: "s", texte: "En 35h chrono." }], actives).texte).toBe("En trente-cinq heures chrono.");
  });
  it("les sous-titres affichent l'écriture (« 35h » → « 35 h », « Teleos » → « TELEOS »)", () => {
    const actives = pr.prononciationsActives([entree("35h", "trente-cinq heures", { ecriture: "35 h" }), entree("Teleos", "té-lé-osse", { ecriture: "TELEOS" })]);
    const segments = fabriquerSousTitres({ texte: "Teleos en 35h.", dureeSec: 3, motsParLigne: 6, prononciations: actives, emphase: [] });
    expect(segments.flatMap((s) => s.mots.map((m) => m.mot)).join(" ")).toBe("TELEOS en 35 h.");
  });
  it("une écriture que la brique ne sait pas retrouver : la forme saisie reste, la voix la reconnaît", () => {
    const actives = pr.prononciationsActives([entree("trente-cinq heures", "trente-cinq heures", { ecriture: "35 h" })]);
    expect(actives[0]).toEqual({ mot: "trente-cinq heures", prononciation: "trente-cinq heures", ecriture: "35 h" });
    expect(actives).toHaveLength(2);
  });
});

describe("n° 8 — portée", () => {
  const liste = [entree("Teleos", "général"), entree("Teleos2", "réservé", { mot: "Teleos", id: "pr-r", portee: { voixId: "voix-will" } }), entree("Clara", "kla-ra", { portee: { personnageId: "p-clara" } })];
  it("sans portée : toutes les voix ; réservé à une autre voix : écarté", () => {
    expect(pr.prononciationsActives(liste, { voixId: "voix-x", personnageId: "p-x" })).toEqual([{ mot: "Teleos", prononciation: "général" }]);
  });
  it("pour la voix visée, l'entrée réservée prime sur l'entrée générale", () => {
    expect(pr.prononciationsActives(liste, { voixId: "voix-will", personnageId: "p-will" })).toEqual([{ mot: "Teleos", prononciation: "réservé" }]);
  });
  it("une entrée réservée à un personnage vaut pour toutes ses voix", () => {
    expect(pr.prononciationsActives(liste, { voixId: "voix-clara", personnageId: "p-clara" }).map((p) => p.mot)).toContain("Clara");
  });
  it("une entrée archivée n'est jamais appliquée", () => {
    expect(pr.prononciationsActives([entree("PV", "pé-vé", { archiveLe: t0 })])).toEqual([]);
  });
});

describe("n° 2 — détection des mots à risque", () => {
  const texte = "Chez Teleos, nous traitons vos PV en 35 h. Votre manager reçoit un feedback de ChatGPT. Le RGPD protège 1 200 € de données. Contactez Williams via Axion IA.";
  it("sigles (épelés), noms propres, anglicismes, chiffres avec unités (en lettres)", () => {
    const r = pr.detecterMotsARisque(texte, [], 20);
    const par = Object.fromEntries(r.map((m) => [m.mot, m]));
    expect(par.PV).toMatchObject({ raison: "sigle", suggestion: "pé-vé" });
    expect(par.Teleos).toMatchObject({ raison: "nom-propre" });
    expect(par.ChatGPT).toMatchObject({ raison: "nom-propre" });
    expect(par.manager).toMatchObject({ raison: "anglicisme" });
    expect(par["35 h"]).toMatchObject({ raison: "chiffre", suggestion: "trente-cinq heures" });
    expect(par["1 200 €"]).toMatchObject({ suggestion: "mille deux cents euros" });
  });
  it("un mot déjà dans la liste (même sous une variante) n'est plus proposé", () => {
    const r = pr.detecterMotsARisque(texte, [{ mot: "RGPD" }, { mot: "Axion-IA" }, { mot: "Teleos" }], 20).map((m) => m.mot);
    expect(r).not.toContain("RGPD");
    expect(r).not.toContain("Teleos");
    expect(r).not.toContain("Axion");
    expect(r).not.toContain("IA");
  });
  it("un mot courant en début de phrase n'est pas un nom propre", () => {
    expect(pr.detecterMotsARisque("Contactez-nous. Votre équipe avance.").map((m) => m.mot)).toEqual([]);
  });
  it("nombres en lettres (orthographe traditionnelle)", () => {
    expect([71, 80, 91, 200, 21, 1200, 180000, 2000000].map(pr.nombreEnLettres)).toEqual([
      "soixante et onze",
      "quatre-vingts",
      "quatre-vingt-onze",
      "deux cents",
      "vingt et un",
      "mille deux cents",
      "cent quatre-vingt mille",
      "deux millions",
    ]);
    expect(pr.chiffreEnLettres("1", "5", "%")).toBe("un virgule cinq pour cent");
    expect(pr.epelerSigle("B2B")).toBe("bé-deux-bé");
  });
});

describe("n° 4 — liste collée « mot = prononciation »", () => {
  it("séparateurs acceptés, écriture après « | », doublons et lignes illisibles signalés", () => {
    const l = pr.lireListeCollee("PV = pé-vé\nTeleos : té-lé-osse\nnimporte\npv => pé vé\n35h = trente-cinq heures | 35 h\nRGPD\tèr", [{ mot: "RGPD" }]);
    expect(l.map((x) => [x.mot, x.etat])).toEqual([
      ["PV", "nouveau"],
      ["Teleos", "nouveau"],
      ["nimporte", "illisible"],
      ["pv", "doublon-du-collage"],
      ["35h", "nouveau"],
      ["RGPD", "deja-dans-la-liste"],
    ]);
    expect(l[4]).toMatchObject({ prononciation: "trente-cinq heures", ecriture: "35 h" });
  });
});

describe("n° 1 — écoute avant / après", () => {
  it("phrase type « Chez mot, nous… » ; après = la prononciation à la place du mot", () => {
    expect(pr.textesAvantApres("Teleos", "té-lé-osse")).toEqual({ avant: "Chez Teleos, nous vous expliquons tout simplement.", apres: "Chez té-lé-osse, nous vous expliquons tout simplement." });
  });
  it("service : la voix par défaut de Will lit la phrase (simulation sans clé : son de démonstration, coût affiché)", async () => {
    const avant = await service.ecouterPrononciation("Teleos", "té-lé-osse", "avant");
    const apres = await service.ecouterPrononciation("Teleos", "té-lé-osse", "apres");
    expect(avant).toMatchObject({ simulee: true, voix: "Ma voix" });
    expect(apres.url).toBe("/demo/essai-voix.mp3");
    expect(apres.cout.centimes).toBeGreaterThanOrEqual(0);
    // Simulation : aucune dépense enregistrée.
    expect(await depots().depenses.compter((x) => x.lignes.some((l) => l.etape.startsWith("Écoute")))).toBe(0);
  });
});

describe("n° 5 — recherche, tri, « utilisé dans N vidéos »", () => {
  it("compte les vidéos dont le texte contient le mot ou sa façon d'écrire", () => {
    expect(pr.compterUtilisations({ mot: "PV" }, ["Un PV.", "Deux PVs.", "Rien."])).toBe(2);
    expect(pr.compterUtilisations({ mot: "35h", ecriture: "35 h" }, ["En 35 h.", "En 35h."])).toBe(2);
  });
  it("service : la liste porte le compteur recalculé", async () => {
    const liste = await service.listerPrononciationsAvecUsage();
    expect(liste.every((p) => typeof p.utilisations === "number")).toBe(true);
  });
});

describe("service — ajout, doublons, modification archivée, lot (rien n'est effacé)", () => {
  it("ajout avec écriture, portée, origine et « écoutée »", async () => {
    const id = await service.ajouterPrononciation("Teleos", "té-lé-osse", { ecriture: "TELEOS", source: "script", ecoutee: true, portee: { voixId: "voix-will" } });
    expect(await depots().prononciations.obtenir(id)).toMatchObject({ mot: "Teleos", ecriture: "TELEOS", source: "script", portee: { voixId: "voix-will" } });
    expect((await depots().prononciations.obtenir(id))?.ecouteeLe).toBeTruthy();
  });
  it("un doublon (variante comprise) est refusé avec un message clair", async () => {
    await expect(service.ajouterPrononciation("AXION IA", "x")).rejects.toMatchObject({ code: "DOUBLON" });
  });
  it("modifier : l'ancienne entrée est archivée, une nouvelle la remplace", async () => {
    const nouveau = await service.modifierPrononciation("pr-1", { mot: "Axion-IA", prononciation: "a-xion i-a" });
    expect(nouveau).not.toBe("pr-1");
    expect((await depots().prononciations.obtenir("pr-1"))?.archiveLe).toBeTruthy();
    expect(await depots().prononciations.obtenir(nouveau)).toMatchObject({ prononciation: "a-xion i-a" });
  });
  it("restaurer une entrée dont le mot est déjà actif est refusé (jamais deux fois le même mot)", async () => {
    const nouveau = await service.modifierPrononciation("pr-1", { mot: "Axion-IA", prononciation: "a-xion i-a" });
    await expect(service.remettrePrononciation("pr-1")).rejects.toMatchObject({ code: "DOUBLON" });
    await service.rangerPrononciation(nouveau);
    await service.remettrePrononciation("pr-1");
    expect((await depots().prononciations.obtenir("pr-1"))?.archiveLe).toBeUndefined();
  });
  it("liste collée : seules les lignes nouvelles sont enregistrées, avec l'origine « lot »", async () => {
    const r = await service.ajouterListeCollee("Teleos = té-lé-osse\nRGPD = èr\nTeleos = autre");
    expect(r).toEqual({ ajoutes: 1, ignores: 2 });
    expect(await depots().prononciations.trouver((p) => p.mot === "Teleos")).toMatchObject({ source: "lot" });
  });
  it("détection côté service : les mots de la liste ne sont plus proposés", async () => {
    const mots = (await service.detecterDansScript("Le RGPD et Teleos.")).map((m) => m.mot);
    expect(mots).toEqual(["Teleos"]);
  });
});

describe("n° 9 — contrôle : vidéo fabriquée AVANT l'ajout d'un mot qu'elle contient", () => {
  it("pur : signale le mot ajouté depuis, pas celui que la commande appliquait déjà", () => {
    const r = pr.prononciationsAjouteesDepuis({ texte: "Un PV chez Teleos.", prononciations: [{ mot: "PV", prononciation: "pé-vé" }] }, [entree("PV", "pé-vé"), entree("Teleos", "té-lé-osse"), entree("Absent", "x")]);
    expect(r.map((x) => x.mot)).toEqual(["Teleos"]);
  });
  it("pur : une prononciation CHANGÉE depuis est signalée aussi", () => {
    const r = pr.prononciationsAjouteesDepuis({ texte: "Un PV.", prononciations: [{ mot: "PV", prononciation: "pévé" }] }, [entree("PV", "pé-vé")]);
    expect(r.map((x) => x.mot)).toEqual(["PV"]);
  });
  it("service : sur une vidéo prête de la démonstration, un mot ajouté après est signalé", async () => {
    const d = depots();
    const video = await d.videos.trouver((v) => v.statut === "prete" && !!v.versionChoisieId);
    const version = await d.versions.obtenir(video!.versionChoisieId!);
    const mot = version!.commande.script.texteComplet.split(/\s+/).find((m) => /^[\p{L}]{6,}$/u.test(m))!;
    expect(await service.prononciationsAjouteesDepuisVideo(video!.id)).not.toContainEqual(expect.objectContaining({ mot }));
    await service.ajouterPrononciation(mot, "essai");
    expect(await service.prononciationsAjouteesDepuisVideo(video!.id)).toContainEqual(expect.objectContaining({ mot, prononciation: "essai" }));
  });
});

describe("n° 10 — liste de départ (migration étape 12)", () => {
  it("ajoute les 15 mots manquants, origine « depart », à valider à l'écoute ; pose le choix de Will", async () => {
    const d = depots();
    const r = await etape12Prononciations(d, t0);
    // La démonstration a déjà Axion-IA, RGPD, PME, ChatGPT : ils ne sont ni réécrits ni ajoutés.
    expect(r?.prononciationsAjoutees).toEqual(["IA", "PV", "TVA", "TPE", "CRM", "API", "SEO", "Excel", "Telegram", "Claude", "HeyGen"]);
    expect(await d.prononciations.obtenir("pr-1")).toMatchObject({ mot: "Axion-IA", prononciation: "axion i-a" });
    const ia = await d.prononciations.trouver((p) => p.mot === "IA");
    expect(ia).toMatchObject({ source: "depart" });
    expect(ia?.ecouteeLe).toBeUndefined();
    expect((await d.parametres.obtenir("voix.choixWill"))?.valeur).toEqual(CHOIX_VOIX_WILL);
  });
  it("idempotente : rejouée, elle ne change rien", async () => {
    const d = depots();
    await etape12Prononciations(d, t0);
    const n = await d.prononciations.compter();
    expect(await etape12Prononciations(d, "2026-10-03T00:00:00.000Z")).toBeNull();
    expect(await d.prononciations.compter()).toBe(n);
  });
  it("un mot archivé par Will n'est jamais remis ; un choix déjà posé n'est jamais écrasé", async () => {
    const d = depots();
    await d.prononciations.modifier("pr-1", { archiveLe: t0 });
    await d.parametres.enregistrer({ id: "voix.choixWill", valeur: "autre", creeLe: t0, modifieLe: t0 });
    const r = await etape12Prononciations(d, t0);
    expect(r?.prononciationsAjoutees).not.toContain("Axion-IA");
    expect((await d.prononciations.obtenir("pr-1"))?.archiveLe).toBe(t0);
    expect((await d.parametres.obtenir("voix.choixWill"))?.valeur).toBe("autre");
  });
  it("valider à l'écoute pose la date", async () => {
    await etape12Prononciations(depots(), t0);
    const ia = await depots().prononciations.trouver((p) => p.mot === "IA");
    await service.validerEcoute(ia!.id);
    expect((await depots().prononciations.obtenir(ia!.id))?.ecouteeLe).toBeTruthy();
  });
});
