/**
 * CAL-18 (écrite EN AVANCE, empilée sur CAL-24) · bouton « Proposer la semaine ».
 * Le Studio appelle l'usine par la porte, AFFICHE la semaine proposée en « Proposée » et ne programme rien : la validation se fait
 * dans l'écran « À valider » de l'usine. Plafond d'appels par jour compté côté serveur, message sans montant.
 * AUCUN appel réel : `fetch` est une doublure, dépôts en mémoire, rien n'est allumé.
 */
import { readFileSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { reinitialiserDepots } from "@/donnees/memoire";

vi.mock("server-only", () => ({}));
vi.mock("react", async (o) => ({ ...(await o<typeof import("react")>()), ...(await import("./aides/crochets-factices")).crochets }));

const { proposerSemaine, PLAFOND_APPELS_SEMAINE_PAR_JOUR, PHRASE_PLAFOND_SEMAINE } = await import("@/services/proposer-semaine");
const { BoutonProposerSemaine } = await import("@/components/calendrier/BoutonProposerSemaine");
const { monter, trouver, texteDe, attendre } = await import("./aides/crochets-factices");

const ENV = { USINE_URL: "https://usine.test/", USINE_PORTE_SECRET: "s".repeat(40) };
const LUNDI = "2026-12-14";
const JOUR1 = new Date("2026-12-10T22:30:00.000Z"); // le 10 à Paris
const JOUR2 = new Date("2026-12-10T23:30:00.000Z"); // déjà le 11 à Paris, encore le 10 en UTC
const ligne = (o: Record<string, unknown> = {}) => ({ cle: "u1|linkedin", jour: "2026-12-15", reseau: "linkedin", type: "video", heure: "09:00", titre: "Comment préparer un devis", pourquoi: "Jour sans publication", ressemble_a: "Publication du 4 décembre", ...o });
const reponse = (corps: unknown, statut = 200) => new Response(JSON.stringify(corps), { status: statut, headers: { "content-type": "application/json" } });
const doublure = (corps: unknown = { propositions: [ligne()] }) => vi.fn(async () => reponse(corps));
const F = (f: unknown) => f as unknown as typeof fetch;

beforeEach(() => reinitialiserDepots());

describe("CAL-18 · appel à l'usine par la porte", () => {
  it("un POST sur la porte de planification avec la clé, la semaine demandée et AUCUN statut", async () => {
    const f = doublure();
    await proposerSemaine({ debut: LUNDI }, { env: ENV, fetchImpl: F(f), maintenant: JOUR1 });
    expect(f).toHaveBeenCalledTimes(1);
    const [url, init] = f.mock.calls[0] as unknown as [string, { method: string; headers: Record<string, string>; body: string }];
    expect(url).toBe("https://usine.test/api/porte/planification/semaine");
    expect(init.method).toBe("POST");
    expect(init.headers.Authorization).toBe(`Bearer ${ENV.USINE_PORTE_SECRET}`);
    const corps = JSON.parse(init.body) as Record<string, unknown>;
    expect(corps.debut).toBe(LUNDI);
    expect(Object.keys(corps)).not.toContain("statut");
  });

  it("les réponses arrivent en « propose », jamais programmées, même si l'usine envoie un autre statut", async () => {
    const f = doublure({ propositions: [ligne({ statut: "programme" }), ligne({ cle: "u2|instagram", reseau: "instagram", etat: "programme" })] });
    const r = await proposerSemaine({ debut: LUNDI }, { env: ENV, fetchImpl: F(f), maintenant: JOUR1 });
    expect(r.propositions).toHaveLength(2);
    for (const p of r.propositions) expect(p.etat).toBe("propose");
    expect(r.propositions[0]).toMatchObject({ cle: "u1|linkedin", jour: "2026-12-15", reseau: "linkedin", type: "video", heure: "09:00", pourquoi: "Jour sans publication", ressembleA: "Publication du 4 décembre" });
  });

  it("une ligne illisible ou hors de la semaine demandée est ignorée, pas affichée", async () => {
    const f = doublure({ propositions: [ligne(), ligne({ cle: "x", reseau: "myspace" }), ligne({ cle: "y", jour: "2026-12-30" }), ligne({ cle: "z", type: "hologramme" }), "n'importe quoi"] });
    const r = await proposerSemaine({ debut: LUNDI }, { env: ENV, fetchImpl: F(f), maintenant: JOUR1 });
    expect(r.propositions.map((p) => p.cle)).toEqual(["u1|linkedin"]);
  });

  it("un jour qui n'existe pas (29 février 2026) est ignoré, il ne déborde pas sur le mois suivant", async () => {
    const f = doublure({ propositions: [ligne({ cle: "a", jour: "2026-02-24" }), ligne({ cle: "b", jour: "2026-02-29" })] });
    const r = await proposerSemaine({ debut: "2026-02-23" }, { env: ENV, fetchImpl: F(f), maintenant: JOUR1 });
    expect(r.propositions.map((p) => p.cle)).toEqual(["a"]);
  });

  it("une semaine qui ne commence pas un lundi, ou une date illisible, est refusée sans appel", async () => {
    const f = doublure();
    await expect(proposerSemaine({ debut: "2026-12-15" }, { env: ENV, fetchImpl: F(f), maintenant: JOUR1 })).rejects.toMatchObject({ code: "SEMAINE_DATE" });
    await expect(proposerSemaine({ debut: "demain" }, { env: ENV, fetchImpl: F(f), maintenant: JOUR1 })).rejects.toMatchObject({ code: "SEMAINE_DATE" });
    expect(f).not.toHaveBeenCalled();
  });

  it("usine non reliée : message en français, aucun appel, et l'essai n'est pas compté", async () => {
    const f = doublure();
    await expect(proposerSemaine({ debut: LUNDI }, { env: {}, fetchImpl: F(f), maintenant: JOUR1 })).rejects.toMatchObject({ code: "USINE_ETEINTE" });
    expect(f).not.toHaveBeenCalled();
    const r = await proposerSemaine({ debut: LUNDI }, { env: ENV, fetchImpl: F(doublure()), maintenant: JOUR1 });
    expect(r.appelsRestants).toBe(PLAFOND_APPELS_SEMAINE_PAR_JOUR - 1);
  });

  it("une panne de l'usine est comptée comme un appel (le plafond protège l'usine) mais ne casse rien", async () => {
    const f = vi.fn(async () => reponse({ erreur: "x" }, 500));
    await expect(proposerSemaine({ debut: LUNDI }, { env: ENV, fetchImpl: F(f), maintenant: JOUR1 })).rejects.toMatchObject({ code: "USINE_ERREUR" });
    expect(f).toHaveBeenCalledTimes(1);
    const suite = await proposerSemaine({ debut: LUNDI }, { env: ENV, fetchImpl: F(doublure()), maintenant: JOUR1 });
    expect(suite.appelsRestants).toBe(PLAFOND_APPELS_SEMAINE_PAR_JOUR - 2);
  });
});

describe("CAL-18 · plafond d'appels par jour, compté côté serveur", () => {
  it("au-delà du plafond : refus avec une phrase sans aucun montant ni chiffre, et plus aucun appel", async () => {
    const f = doublure();
    for (let i = 0; i < PLAFOND_APPELS_SEMAINE_PAR_JOUR; i++) await proposerSemaine({ debut: LUNDI }, { env: ENV, fetchImpl: F(f), maintenant: JOUR1 });
    expect(f).toHaveBeenCalledTimes(PLAFOND_APPELS_SEMAINE_PAR_JOUR);
    const refus = proposerSemaine({ debut: LUNDI }, { env: ENV, fetchImpl: F(f), maintenant: JOUR1 });
    await expect(refus).rejects.toMatchObject({ code: "SEMAINE_PLAFOND", message: PHRASE_PLAFOND_SEMAINE });
    expect(f).toHaveBeenCalledTimes(PLAFOND_APPELS_SEMAINE_PAR_JOUR);
    expect(PHRASE_PLAFOND_SEMAINE).not.toMatch(/[€$\d]|prix|tarif|coût|euro|dollar/i);
    expect(PHRASE_PLAFOND_SEMAINE).toMatch(/à la main/);
  });

  it("le lendemain (jour de Paris), le compteur repart de zéro", async () => {
    const f = doublure();
    for (let i = 0; i < PLAFOND_APPELS_SEMAINE_PAR_JOUR; i++) await proposerSemaine({ debut: LUNDI }, { env: ENV, fetchImpl: F(f), maintenant: JOUR1 });
    await expect(proposerSemaine({ debut: LUNDI }, { env: ENV, fetchImpl: F(f), maintenant: JOUR1 })).rejects.toMatchObject({ code: "SEMAINE_PLAFOND" });
    await expect(proposerSemaine({ debut: LUNDI }, { env: ENV, fetchImpl: F(f), maintenant: JOUR2 })).resolves.toBeDefined();
  });

  it("appels en rafale : le plafond tient (jamais plus d'appels que permis)", async () => {
    const f = doublure();
    const essais = await Promise.allSettled(Array.from({ length: PLAFOND_APPELS_SEMAINE_PAR_JOUR + 4 }, () => proposerSemaine({ debut: LUNDI }, { env: ENV, fetchImpl: F(f), maintenant: JOUR1 })));
    expect(f).toHaveBeenCalledTimes(PLAFOND_APPELS_SEMAINE_PAR_JOUR);
    expect(essais.filter((e) => e.status === "fulfilled")).toHaveLength(PLAFOND_APPELS_SEMAINE_PAR_JOUR);
  });

  it("le service indique combien d'appels restent", async () => {
    const r = await proposerSemaine({ debut: LUNDI }, { env: ENV, fetchImpl: F(doublure()), maintenant: JOUR1 });
    expect(r.appelsRestants).toBe(PLAFOND_APPELS_SEMAINE_PAR_JOUR - 1);
  });
});

describe("CAL-18 · le bouton et l'affichage de la semaine", () => {
  const sortie = { ok: true as const, donnees: { appelsRestants: 4, propositions: [{ cle: "u1|linkedin", jour: "2026-12-15", reseau: "linkedin" as const, type: "video" as const, etat: "propose" as const, heure: "09:00", titre: "Idée", pourquoi: "Jour sans publication", ressembleA: "Publication du 4 décembre" }] } };
  const monterBouton = (proposer = vi.fn(async () => sortie)) => {
    const m = monter(BoutonProposerSemaine, { debutSemaine: LUNDI, proposer });
    return { m, proposer };
  };
  const bouton = (arbre: ReturnType<ReturnType<typeof monter>["rendre"]>) => trouver(arbre, (e) => e.type === "button")[0];

  it("le bouton dit « Proposer la semaine », n'est pas orange plein, et fait au moins 44 px", () => {
    const { m } = monterBouton();
    const b = bouton(m.rendre());
    expect(texteDe(b)).toContain("Proposer la semaine");
    const cls = String(b.props.className);
    expect(cls).not.toMatch(/orange|bg-accent\b|bg-cta/);
    expect(cls).toContain("min-h-[44px]");
  });

  it("un clic appelle l'action UNE fois avec le lundi, puis affiche les cartes « Proposée » et aucun lien avant la retenue", async () => {
    const { m, proposer } = monterBouton();
    (bouton(m.rendre()).props.onClick as () => void)();
    await attendre();
    expect(proposer).toHaveBeenCalledTimes(1);
    expect(proposer).toHaveBeenCalledWith(LUNDI);
    const html = renderToStaticMarkup(createElement("div", null, m.rendre() as never));
    expect(html).toContain("Proposée");
    expect(html).toContain("border-dashed");
    expect(html).toContain("Pourquoi ici");
    expect(html).toContain("Ressemble à");
    // Pas de lien avant la retenue : « Voir dans « Écrire » » ne vient qu'après « Retenir ce sujet ».
    expect(html).not.toContain("href=");
    expect(html).not.toMatch(/Programmé/);
    expect(html).toMatch(/Rien n(&#x27;|')est programmé/);
  });

  it("aucun bouton qui programme ou valide : un seul bouton (Proposer la semaine), le reste est un lien", async () => {
    const { m } = monterBouton();
    (bouton(m.rendre()).props.onClick as () => void)();
    await attendre();
    const arbre = m.rendre();
    const boutons = trouver(arbre, (e) => e.type === "button");
    expect(boutons).toHaveLength(1);
    expect(texteDe(arbre)).not.toMatch(/Programmer|Tout valider|Valider la s|Publier/);
  });

  it("une réponse d'erreur (plafond atteint) s'affiche telle quelle, sans montant, et le bouton reste utilisable", async () => {
    const proposer = vi.fn(async () => ({ ok: false as const, message: PHRASE_PLAFOND_SEMAINE, code: "SEMAINE_PLAFOND" }));
    const { m } = monterBouton(proposer as never);
    (bouton(m.rendre()).props.onClick as () => void)();
    await attendre();
    const arbre = m.rendre();
    expect(texteDe(arbre)).toContain(PHRASE_PLAFOND_SEMAINE);
    expect(texteDe(arbre)).not.toMatch(/[€$]|prix|tarif/i);
    expect(bouton(arbre).props.disabled).toBeFalsy();
  });

  it("un succès puis un refus : plus aucune carte de la demande précédente", async () => {
    let n = 0;
    const proposer = vi.fn(async () => (n++ === 0 ? sortie : { ok: false as const, message: PHRASE_PLAFOND_SEMAINE, code: "SEMAINE_PLAFOND" }));
    const { m } = monterBouton(proposer as never);
    (bouton(m.rendre()).props.onClick as () => void)();
    await attendre();
    expect(renderToStaticMarkup(createElement("div", null, m.rendre() as never))).toContain("Proposée");
    (bouton(m.rendre()).props.onClick as () => void)();
    await attendre();
    const html = renderToStaticMarkup(createElement("div", null, m.rendre() as never));
    expect(html).not.toContain("data-proposition");
    expect(texteDe(m.rendre())).toContain(PHRASE_PLAFOND_SEMAINE);
  });

  it("une action qui plante affiche une phrase simple : l'ajout manuel n'est pas bloqué", async () => {
    const proposer = vi.fn(async () => {
      throw new Error("réseau coupé");
    });
    const { m } = monterBouton(proposer as never);
    (bouton(m.rendre()).props.onClick as () => void)();
    await attendre();
    expect(texteDe(m.rendre())).toMatch(/à la main/);
  });

  it("un double clic rapide ne lance qu'un seul appel", async () => {
    const { m, proposer } = monterBouton();
    const clic = bouton(m.rendre()).props.onClick as () => void;
    clic();
    clic();
    await attendre();
    expect(proposer).toHaveBeenCalledTimes(1);
  });
});

describe("CAL-18 · le Studio n'a aucun stratège", () => {
  const lire = (c: string) => readFileSync(new URL(`../${c}`, import.meta.url), "utf8");
  const FICHIERS = ["src/services/proposer-semaine.ts", "src/components/calendrier/BoutonProposerSemaine.tsx"];
  it.each(FICHIERS)("%s : aucun appel de modèle, aucun Haiku, aucun prix", (c) => {
    const s = lire(c);
    expect(s).not.toMatch(/haiku/i);
    expect(s).not.toMatch(/generation-claude|plafond-claude|@anthropic-ai|api\.anthropic|fournisseur\(\s*["']claude/i);
    expect(s).not.toMatch(/[€]|\bprix\b|\btarif\b/i);
  });
  it("le Studio ne programme rien depuis ces fichiers (ni validation, ni envoi)", () => {
    for (const c of FICHIERS) expect(lire(c)).not.toMatch(/validerEntree|transitionner|creneauxEditoriaux\.enregistrer|publications\.(creer|modifier)|zernio/i);
  });
  it("aucun nom de personne dans le dépôt public", () => {
    for (const c of [...FICHIERS, "tests/cal-18-proposer-semaine.test.ts"]) expect(lire(c)).not.toMatch(new RegExp("will" + "iams", "i"));
  });
  it("l'action serveur vit dans actions/proposer-semaine.ts ; actions.ts n'est pas modifié (les trois gardes des fiches sœurs tiennent)", () => {
    expect(lire("src/app/(studio)/calendrier/actions.ts")).not.toMatch(/proposerSemaine/);
    const a = lire("src/app/(studio)/calendrier/actions/proposer-semaine.ts");
    expect(a.startsWith('"use server"')).toBe(true);
    expect(a).toMatch(/exigerSession\(\)/);
  });
  it("la page de la semaine monte le bouton avec l'action serveur (jamais un appel direct du navigateur)", () => {
    const page = lire("src/app/(studio)/calendrier/page.tsx");
    expect(page).toContain("<BoutonProposerSemaine");
    expect(page).toMatch(/proposer=\{proposerSemaineAction\}/);
    // Rien n'allumé : monté seulement si l'usine est reliée (l'adresse de « À valider » est facultative).
    expect(page).toMatch(/usineActive\(\) && <div[^\n]*<BoutonProposerSemaine/);
    // Jamais un lien qui ramène à la page du calendrier ; cartes d'une semaine jamais gardées sur une autre.
    expect(page).not.toMatch(/lienAValider=\{adresseSemaine\}/);
    expect(page).toMatch(/<BoutonProposerSemaine key=\{lundiCle\}/);
  });
});

describe("CAL-18 · adresse de « À valider »", () => {
  it("seule une adresse https donnée par l'environnement est retenue", async () => {
    const { adresseAValiderUsine } = await import("@/services/proposer-semaine");
    expect(adresseAValiderUsine({})).toBeNull();
    expect(adresseAValiderUsine({ USINE_A_VALIDER_URL: "http://usine.test/a-valider" })).toBeNull();
    expect(adresseAValiderUsine({ USINE_A_VALIDER_URL: "pas une adresse" })).toBeNull();
    expect(adresseAValiderUsine({ USINE_A_VALIDER_URL: "https://usine.test/a-valider" })).toBe("https://usine.test/a-valider");
  });
});

describe("CAL-18 · action serveur", () => {
  it("sans session, rien n'est appelé : l'action s'arrête au contrôle de session", async () => {
    vi.resetModules();
    const proposerFactice = vi.fn();
    vi.doMock("@/services/auth", () => ({ exigerSession: async () => { throw new Error("session"); } }));
    vi.doMock("@/services/proposer-semaine", () => ({ proposerSemaine: proposerFactice }));
    const { proposerSemaineAction } = await import("@/app/(studio)/calendrier/actions/proposer-semaine");
    await expect(proposerSemaineAction(LUNDI)).rejects.toThrow("session");
    expect(proposerFactice).not.toHaveBeenCalled();
    vi.doUnmock("@/services/auth");
    vi.doUnmock("@/services/proposer-semaine");
  });
  it("avec une session : le résultat du service est rendu tel quel, et une erreur du Studio devient une phrase sans montant", async () => {
    vi.resetModules();
    const { ErreurStudio } = await import("@/services/_commun");
    vi.doMock("@/services/auth", () => ({ exigerSession: async () => ({ id: "f" }) }));
    vi.doMock("@/services/proposer-semaine", () => ({ proposerSemaine: async () => { throw new ErreurStudio("SEMAINE_PLAFOND", "Phrase de plafond."); } }));
    const { proposerSemaineAction } = await import("@/app/(studio)/calendrier/actions/proposer-semaine");
    const r = await proposerSemaineAction(LUNDI);
    expect(r).toEqual({ ok: false, message: "Phrase de plafond.", code: "SEMAINE_PLAFOND" });
    vi.doUnmock("@/services/auth");
    vi.doUnmock("@/services/proposer-semaine");
  });
  it("usine non reliée : l'action répond en français, sans appel réel", async () => {
    vi.resetModules();
    vi.doMock("@/services/auth", () => ({ exigerSession: async () => ({ id: "f" }) }));
    const { proposerSemaineAction } = await import("@/app/(studio)/calendrier/actions/proposer-semaine");
    const f = vi.spyOn(globalThis, "fetch");
    const r = await proposerSemaineAction(LUNDI);
    expect(r.ok).toBe(false);
    expect(f).not.toHaveBeenCalled();
    f.mockRestore();
    vi.doUnmock("@/services/auth");
  });
});
