/**
 * FIX-DECOUPAGE-AUTOREPARE-a (18/11/2026) : le Studio répare SEUL, sans IA, les refus de forme qu'il a lui-même créés
 * (liste sur une page « douleur », 2 phrases clés…) avant toute relance. Tout passe par le chemin réel : vrai `decouperEnScenes`
 * (double de `appeler` qui rend la réponse JSON, comme `refus-du-18-10.test.ts`), vrai `jugerFiche`, vraie validation, vraie
 * mise en page (aucun `vi.mock`). Témoin RECONSTRUIT : aucun journal réel de la tâche v-64a273d3580c n'est fourni ; on part de
 * la fiche réelle v-365dd2ae67ee (style « reference/3 », paperboard tiré) dont la page « douleur » dit les trois outils.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { DESSINS } from "@/briques/dessins";
import { decouperEnScenes, jugerFiche, partiesDuDecoupage, variableRelance, type EntreeDecoupage } from "@/moteurs/montage-tableau/decoupage";
import { reparerRefusDeForme } from "@/moteurs/montage-tableau/reparation-refus";

type El = Record<string, unknown>;
type Scene = { id: string; page: number; role: string; texteDit: string; gabarit?: Record<string, unknown>; elements: El[] };
type Cas = { texteScript: string; motsDouleur: string[] | null; parties: { texte: string }[]; reponse: { scenes: Scene[]; [cle: string]: unknown } };
const charger = (id: string): Cas => JSON.parse(readFileSync(join(__dirname, "temoins", `decoupage-${id}.json`), "utf8"));

function entreeDe(cas: Cas, sansParties = false): EntreeDecoupage {
  const b = cas.reponse as Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
  const preuveIds = new Set<string>();
  for (const s of b.scenes) for (const e of s.elements) if (e.type === "preuve") preuveIds.add(e.preuveId);
  const parties = sansParties ? undefined : partiesDuDecoupage(cas.parties);
  return {
    texteScript: cas.texteScript, structure: b.structure, serie: b.serie, douleur: b.douleur, gesteMinute: b.gesteMinute,
    preuves: [...preuveIds].map((id) => ({ id, resume: "x" })), dessins: DESSINS.map((d) => ({ id: d.id, motsCles: d.motsCles })),
    videoId: b.videoId, versionId: b.versionId, habillage: b.habillage, stylo: b.stylo, ratio: b.ratio,
    controle: { aujourdhui: "2026-10-18", sourcesChiffres: [], preuves: [], matieres: [...preuveIds].map((id) => ({ id, type: "demonstration", statut: "validee" })), ...(cas.motsDouleur ? { motsDouleur: cas.motsDouleur } : {}) },
    ...(parties ? { parties } : {}),
  } as EntreeDecoupage;
}

const DOULEUR_ORIGINE = "Vous fouillez ses mails. Vous rappelez le client. Vous refaites ce qu'elle avait peut-être déjà fait. Et la matinée y passe.";
const DIT = "Un outil pour les devis. Un autre pour les e-mails. Un troisième pour les relances.";
const ligne = (id: string, texte: string, bloc: string, ancre: number, plus: El = {}): El => ({ id, type: "ligne", texte, niveau: "texte", role: "alerte", bloc, ancre, ...plus });

/** Témoin RECONSTRUIT (aucun journal réel de v-64a273d3580c fourni) : la fiche v-365dd2ae67ee dont la page « douleur » dit les trois outils. */
function casDouleur(elements: El[], dit = DIT, gabarit: Record<string, unknown> = { role: "douleur" }): Cas {
  const c = structuredClone(charger("v-365dd2ae67ee"));
  c.texteScript = c.texteScript.replace(DOULEUR_ORIGINE, dit);
  c.parties = c.parties.map((p) => (p.texte === DOULEUR_ORIGINE ? { ...p, texte: dit } : p));
  const s = c.reponse.scenes[1];
  s.texteDit = dit;
  s.gabarit = gabarit;
  s.elements = elements;
  return c;
}
const liste = (bloc: string, extra: Record<string, unknown>[] = [{}, {}, {}]) =>
  [ligne("e02", "Un outil pour les devis.", "phrase-cle", 0), ...["Devis", "E-mails", "Relances"].map((t, k) => ligne(`e0${3 + k}`, t, bloc, [4, 9, 14][k], extra[k]))];

/** `appeler` rend DEUX fois la même réponse : l'IA refait le même rangement à la relance. */
async function lancer(cas: Cas, sansParties = false) {
  let appels = 0;
  const r = await decouperEnScenes(entreeDe(cas, sansParties), {
    appeler: async () => (appels++, { ok: true, simule: false, donnees: JSON.stringify(cas.reponse), stopReason: "end_turn" }),
    budget: { reserver: async () => ({ ok: true }) },
  } as never);
  return { r, appels };
}


type Fiche = { scenes: Scene[] };
const lignesDe = (f: Fiche) => f.scenes.flatMap((s) => s.elements.filter((e) => e.type === "ligne"));
const dits = (f: Fiche) => f.scenes.map((s) => s.texteDit).join(" ");
const blocsDe = (f: Fiche, texte: string) => lignesDe(f).filter((l) => l.texte === texte).map((l) => l.bloc);

/** Propriété c) : texte intact (suite des textes dits identique, textes de lignes après ⊆ avant, parties et numéros inchangés). */
function texteIntact(avant: Fiche, apres: Fiche) {
  expect(dits(apres)).toBe(dits(avant));
  const textesAvant = new Set(lignesDe(avant).map((l) => l.texte));
  for (const l of lignesDe(apres)) expect(textesAvant.has(l.texte as string)).toBe(true);
  const roles = (f: Fiche) => f.scenes.map((s) => s.gabarit?.role).filter((x, k, t) => k === 0 || x !== t[k - 1]);
  expect(roles(apres)).toEqual(roles(avant));
  const numeros = (f: Fiche) => f.scenes.flatMap((s) => (s.gabarit?.numero ? [s.gabarit.numero] : []));
  expect(numeros(apres)).toEqual(numeros(avant));
}

describe("a) le cas du 18/11 : trois outils en liste sur la page « douleur »", () => {
  it("master refuse (2 appels, refusee) ; après : 1 appel, accepté, réparé sans IA, mêmes mots en détail", async () => {
    const cas = casDouleur(liste("liste"));
    const { r, appels } = await lancer(cas);
    expect(r.ok).toBe(true);
    expect(appels).toBe(1);
    if (!r.ok) return;
    expect(r.relance).toBe(false);
    expect(r.reparations?.map((x) => x.cle)).toContain("bloc-hors-partie");
    expect(r.reparations?.every((x) => x.sceneId === "s02" || x.sceneId === "s03")).toBe(true);
    // Les trois lignes gardent leurs MÊMES textes, en « detail ». La page ne tenait pas à 3 blocs (phrase clé + 3 détails) :
    // les lignes passent sur une page de SUITE « douleur » (essai composé i-bis) ; le test fixe ce choix.
    for (const t of ["Devis", "E-mails", "Relances"]) expect(blocsDe(r.fiche, t)).toEqual(["detail"]);
    const pagesDouleur = new Set(r.fiche.scenes.filter((s) => s.gabarit?.role === "douleur").map((s) => s.page));
    expect(pagesDouleur.size).toBe(2);
    texteIntact(cas.reponse, r.fiche);
  });
  it("la trace dit « réparé sans IA »", async () => {
    const trace: string[] = [];
    const avant = console.warn;
    console.warn = (...a: unknown[]) => void trace.push(a.join(" "));
    try {
      await lancer(casDouleur(liste("liste")));
    } finally {
      console.warn = avant;
    }
    expect(trace.some((t) => t.includes("réparé sans IA") && t.includes("bloc-hors-partie"))).toBe(true);
  });
  it("a') avec 2 éléments « code » (vert, rouge) : même issue", async () => {
    const cas = casDouleur([ligne("e02", "Un outil pour les devis.", "phrase-cle", 0), ligne("e03", "Devis", "code", 4, { code: "vert" }), ligne("e04", "E-mails", "code", 9, { code: "rouge" })]);
    const { r, appels } = await lancer(cas);
    expect(appels).toBe(1);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.reparations?.[0].cle).toBe("bloc-hors-partie");
    for (const t of ["Devis", "E-mails"]) expect(blocsDe(r.fiche, t)).toEqual(["detail"]);
    expect(lignesDe(r.fiche).some((l) => l.code)).toBe(false);
    texteIntact(cas.reponse, r.fiche);
  });
  it("a'') règle de FIX-TABLEAU-LISTE-DOULEUR : scène « douleur » sur une page déclarée « solution », 3 lignes « code »", async () => {
    const cas = casDouleur(liste("code", [{ code: "vert" }, { code: "orange" }, { code: "rouge" }]), DIT, { role: "solution" });
    // Sans les parties du script : la page garde la partie que le modèle lui a donnée.
    const { r, appels } = await lancer(cas, true);
    expect(r.ok).toBe(true);
    expect(appels).toBe(1);
    if (!r.ok) return;
    for (const t of ["Devis", "E-mails", "Relances"]) expect(blocsDe(r.fiche, t)).toEqual(["detail"]);
    texteIntact(cas.reponse, r.fiche);
  });
});

describe("b) ni l'aplatissement ni la page de plus ne passent : la liste est retirée", () => {
  // La scène ne dit qu'UNE phrase : aucune fin de phrase où la couper, donc aucune page de plus (même effet que les bornes de
  // pages atteintes : 28 pages ne se construisent pas sur une fiche de test réelle) ; la phrase clé et 3 détails feraient 4 blocs.
  const DIT_B = "Devis, e-mails, relances : trois outils qui ne se parlent pas.";
  const elements = (): El[] => [ligne("e02", "Trois outils qui ne se parlent pas.", "phrase-cle", 0), ...["Devis", "E-mails", "Relances"].map((t, k) => ligne(`e0${3 + k}`, t, "liste", k))];
  it("accepté en 1 appel ; la page garde sa phrase clé ; la voix dit toujours les mots", async () => {
    const cas = casDouleur(elements(), DIT_B);
    const { r, appels } = await lancer(cas);
    expect(appels).toBe(1);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.reparations?.[0]).toMatchObject({ cle: "bloc-hors-partie", sceneId: "s02" });
    expect(blocsDe(r.fiche, "Trois outils qui ne se parlent pas.")).toEqual(["phrase-cle"]);
    for (const t of ["Devis", "E-mails", "Relances"]) expect(blocsDe(r.fiche, t)).toEqual([]);
    expect(r.fiche.scenes[1].texteDit).toBe(DIT_B);
    texteIntact(cas.reponse, r.fiche);
  });
});

describe("d) 2 phrases clés sur une page : la 2e devient détail", () => {
  it("accepté en 1 appel", async () => {
    const cas = casDouleur([ligne("e02", "Un outil pour les devis.", "phrase-cle", 0), ligne("e03", "Un autre pour les e-mails.", "phrase-cle", 5), ligne("e04", "Un troisième pour les relances.", "detail", 10)]);
    const { r, appels } = await lancer(cas);
    expect(appels).toBe(1);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.reparations?.map((x) => x.cle)).toEqual(["phrases-cles"]);
    expect(blocsDe(r.fiche, "Un autre pour les e-mails.")).toEqual(["detail"]);
    expect(blocsDe(r.fiche, "Un outil pour les devis.")).toEqual(["phrase-cle"]);
    texteIntact(cas.reponse, r.fiche);
  });
});

describe("e) page qui ne tient pas — NON REPRODUIT sur la vraie mise en page", () => {
  // Au gabarit « reference/3 » les bornes de la règle 18 (phrase clé de 12 mots au plus, 3 blocs) font tenir toute page : grille
  // paperboard / tableau-blanc / ardoise essayée le 18/11, aucune page refusée par la règle 4. Même constat que
  // `page-seule-raison.test.ts` (« aucune vraie fiche ne reproduit le cas »). La mise en page n'est PAS simulée ici : la
  // réparation « page-ne-tient-pas » du module n'est donc prouvée que par sa branche « page de plus » (cas a, blocs-max).
  it("une page qui tient n'appelle aucune réparation de page (fiche valide : aucune réparation)", async () => {
    const { r } = await lancer(charger("v-365dd2ae67ee"));
    expect(r.ok).toBe(true);
    if (r.ok) expect("reparations" in r).toBe(false);
  });
});

describe("f) contre-épreuves : rien d'affaibli", () => {
  it("un mot du texte dit changé reste refusé : 2 appels, aucune réparation", async () => {
    const cas = structuredClone(charger("v-365dd2ae67ee"));
    cas.reponse.scenes[1].texteDit = cas.reponse.scenes[1].texteDit.replace("fouillez", "cherchez");
    const { r, appels } = await lancer(cas);
    expect(r.ok).toBe(false);
    expect(appels).toBe(2);
    if (!r.ok) expect(r.refus.length).toBeGreaterThan(0);
  });
  it("un chiffre écrit que la voix ne dit pas reste refusé : 2 appels, aucune réparation", async () => {
    const cas = structuredClone(charger("v-365dd2ae67ee"));
    cas.reponse.scenes[1].elements[1].texte = "Vous fouillez 47 mails.";
    const { r, appels } = await lancer(cas);
    expect(r.ok).toBe(false);
    expect(appels).toBe(2);
    if (!r.ok) expect(r.refus.some((x) => x.includes("47"))).toBe(true);
  });
  it("la liste ET le chiffre : la liste est réparée, le chiffre reste refusé ; la relance dit ce que le Studio a réparé seul et n'envoie que le refus restant", async () => {
    const cas = casDouleur([ligne("e02", "Un outil pour 47 devis.", "phrase-cle", 0), ...liste("liste").slice(1)]);
    const variables: string[] = [];
    const r = await decouperEnScenes(entreeDe(cas), {
      appeler: async (_role: unknown, entree: { variable: string }) => (variables.push(entree.variable), { ok: true, simule: false, donnees: JSON.stringify(cas.reponse), stopReason: "end_turn" }),
      budget: { reserver: async () => ({ ok: true }) },
    } as never);
    expect(r.ok).toBe(false);
    expect(variables).toHaveLength(2);
    if (r.ok) return;
    expect(r.refus.some((x) => x.includes("47"))).toBe(true);
    expect(r.refus.some((x) => x.includes("n'a pas sa place"))).toBe(false);
    expect(variables[1]).toContain("Le Studio a déjà réparé seul :");
    expect(variables[0]).not.toContain("Le Studio a déjà réparé seul");
  });
  it("une liste dont l'aplatissement ET le retrait laisseraient la page sans texte écrit n'est pas réparée : refus inchangé", async () => {
    // Deux éléments de 13 et 14 mots (la règle des détails en permet 12) : l'aplatir fait un détail trop long ; la scène ne dit
    // qu'une phrase (pas de page de plus) ; retirer la liste laisserait la page sans aucun texte écrit.
    const un = "Un outil séparé pour chaque devis envoyé à chaque client chaque semaine entier";
    const deux = "un autre outil séparé pour chaque courriel de relance envoyé à chaque client ensuite";
    const cas = casDouleur([ligne("e02", un, "liste", 0), ligne("e03", deux, "liste", 13)], `${un}, ${deux}.`);
    const { r, appels } = await lancer(cas);
    expect(r.ok).toBe(false);
    expect(appels).toBe(2);
    if (r.ok) return;
    expect("reparations" in r).toBe(false);
    expect(r.refus.some((x) => x.includes("n'a pas sa place sur une page « douleur »"))).toBe(true);
    texteIntact(cas.reponse, r.aCorriger as unknown as Fiche);
  });
});

describe("g) fiche valide du premier coup : résultat identique, sans champ « reparations »", () => {
  it("jugerFiche et decouperEnScenes", async () => {
    const cas = charger("v-365dd2ae67ee");
    const j = jugerFiche(cas.reponse, entreeDe(cas));
    expect(j.ok).toBe(true);
    expect(Object.keys(j).sort()).toEqual(["fiche", "ok", "retraits"]);
    const { r, appels } = await lancer(cas);
    expect(appels).toBe(1);
    if (!r.ok) throw new Error("refusée");
    expect(Object.keys(r).sort()).toEqual(["appels", "fiche", "ok", "relance"]);
    expect(r.fiche).toEqual(j.ok ? j.fiche : null);
  });
  it("variableRelance sans réparation : texte identique à l'ancien format", () => {
    const sans = variableRelance("V", "R", ["a", "b"]);
    expect(sans).not.toContain("réparé seul");
    expect(variableRelance("V", "R", ["a", "b"], [])).toBe(sans);
    expect(variableRelance("V", "R", ["a"], [{ quoi: "la liste devient des détails" }])).toContain("Le Studio a déjà réparé seul : la liste devient des détails.");
  });
});

describe("h) reparerRefusDeForme ne lève jamais", () => {
  it.each([[null], [undefined], [{}], [{ scenes: "x" }], [{ scenes: [] }], [{ scenes: [null] }]])("fiche illisible %#", (f) => {
    const r = reparerRefusDeForme(f as never, { juger: () => [{ message: "x" }] });
    expect(r.reparations).toEqual([]);
    expect(r.fiche).toBe(f);
  });
  it("juge qui lève : fiche rendue telle quelle", () => {
    const fiche = charger("v-365dd2ae67ee").reponse as never;
    const r = reparerRefusDeForme(fiche, { juger: () => { throw new Error("boum"); } });
    expect(r).toEqual({ fiche, reparations: [] });
  });
  it("juge qui ne lève qu'au re-jugement d'un candidat : le pas est oublié, rien ne casse", () => {
    const cas = casDouleur(liste("liste"));
    const fiche = cas.reponse as never;
    let n = 0;
    const r = reparerRefusDeForme(fiche, { juger: () => { if (n++ > 0) throw new Error("boum"); return [{ message: "un élément de « À retenir » (« Devis ») n'a pas sa place sur une page « douleur » (« titre » seulement).", sceneId: "s02" }]; } });
    expect(r).toEqual({ fiche, reparations: [] });
  });
});
