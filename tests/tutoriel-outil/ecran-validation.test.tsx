/**
 * T-EXT-24 · écran de validation du tutoriel d'outil. Rendu serveur seulement (`renderToStaticMarkup`, comme
 * `tests/barre-rubriques.test.tsx` : ni jsdom ni testing-library) ; les gestes sont des fonctions exportées, testées en
 * appel direct avec des actions simulées. Aucun appel réel, aucune voix, aucun rendu, 0 €.
 */
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

const issue = { ok: true as const, donnees: { statut: "ok" as const, phrase: "C'est fait." } };
const actionsSimulees = vi.hoisted(() => ({
  choisirVersionAction: vi.fn(async () => ({ ok: true as const, donnees: { statut: "ok" as const, phrase: "C'est fait." } })),
  corrigerScriptAction: vi.fn(async () => ({ ok: true as const, donnees: { statut: "ok" as const, phrase: "C'est fait." } })),
  choisirPropositionAction: vi.fn(async () => ({ ok: true as const, donnees: { statut: "ok" as const, phrase: "C'est fait." } })),
  refaireEcrireAction: vi.fn(async () => ({ ok: true as const, donnees: { statut: "ok" as const, phrase: "C'est fait." } })),
  validerTutorielAction: vi.fn(async () => ({ ok: true as const, donnees: { statut: "ok" as const, phrase: "C'est fait." } })),
}));
vi.mock("@/app/(studio)/tutoriel-outil/actions", () => actionsSimulees);
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: () => undefined }) }));
vi.mock("@/services/auth", () => ({ exigerSession: async () => ({}) }));

const { EcranValidationTutoriel, surChoixVersion, surCorrection, surProposition, surRefaire, surValidation, raisonInactif } = await import("@/components/formats/tutoriel-outil/EcranValidationTutoriel");
const { construireDossierValidation } = await import("@/moteurs/montage-tutoriel-outil/equipe/dossier-validation");
const { etablirRegistre } = await import("@/moteurs/montage-tutoriel-outil/equipe/registre-textes");
const { vueValidationTutoriel } = await import("@/services/tutoriel-validation-ecran");
const { ID_FORMAT_TUTORIEL_OUTIL } = await import("@/formats/tutoriel-outil");
import type { EntreeDossierValidation } from "@/moteurs/montage-tutoriel-outil/equipe/dossier-validation";

const MONTANT = /€|\$|\bprix\b|\bcoûts?\b|\beuros?\b/i;
const INTERDITES = /Douleur|Solution|À vous/;
const visible = (html: string) => html.replace(/<script[\s\S]*?<\/script>/g, "").replace(/<[^>]+>/g, " ").replace(/&#x27;|&#39;/g, "'").replace(/&amp;/g, "&").replace(/\s+/g, " ").trim();

const phr = (texte: string, temps: "situation" | "changement" | "gain", apport: string, zoneId: string) => ({ texte, temps, apport, zoneId });
const entree = (verdict: "ok" | "bloque" = "ok"): EntreeDossierValidation => ({
  cahier: { version: "cahier-tutoriel.v1", entree: "B", cas: 3, gabarits: ["G-Flux"], roles: [], manques: [], scriptsFournis: [], fin: "aucune", ratios: ["9:16"], dureeCibleSec: [40, 55], raisons: [] },
  carte: { version: "carte-zones.v1", maquette: "Espace démo · Plomberie", manques: [], zones: [{ id: "liste", nom: "La liste", aller: "/", cible: "#l", etat: "maintenant", gestes: ["clic"], prouve: "p", chiffres: [] }] },
  fiche: {
    version: "fiche-valeur.v1",
    persona: { metier: "Plombier", journee: "Il recompte ses demandes chaque soir.", perte: "Il perd des heures." },
    avant: ["Des messages partout"],
    moments: [{ id: "m1", zoneId: "liste", geste: "clic", permet: "Tout voir d'un coup" }],
    gainEntreprise: { devient: "plus-solide", pourquoi: "Rien ne se perd." },
    emotion: "maitrise",
  },
  proposition: {
    version: "scripts-tutoriel.v1",
    versions: [
      { id: "A", source: "ecrit", empreinte: "a", phrases: [phr("Phrase de la version A, première.", "situation", "Apport de A", "liste"), phr("Vous voyez tout votre travail ici.", "changement", "Apport de A bis", "liste")] },
      { id: "B", source: "ecrit", empreinte: "b", phrases: [phr("Phrase de la version B, première.", "situation", "Apport de B", "liste"), phr("Vous gardez la main sur vos demandes.", "gain", "Apport de B bis", "liste")] },
    ],
  },
  verdict:
    verdict === "ok"
      ? { verdict: "ok", controles: [], nonFaits: [], resume: "Rien à signaler" }
      : { verdict: "bloque", controles: [{ id: "c", libelle: "Phrases", etat: "echoue", bloquant: true, details: ["Une phrase est trop longue pour être lue d'un coup."] }], nonFaits: [], resume: "Bloqué" },
  registre: etablirRegistre({ script: { phrases: ["Phrase de la version A, première."], origine: "choisi" }, fin: "aucune", parcours: {}, textesMaquette: [], propositions: [{ id: "prop-1", texte: "Titre proposé par le Studio" }] }),
});

const rendre = (e: EntreeDossierValidation) => renderToStaticMarkup(createElement(EcranValidationTutoriel, { videoId: "v1", dossier: construireDossierValidation(e) }));
const boutonValider = (html: string) => html.match(/<button[^>]*>(?:(?!<\/button>)[\s\S])*Valider et lancer la fabrication/)?.[0] ?? "";

describe("écran rendu", () => {
  it("les deux versions côte à côte, avec leurs phrases et leurs apports", () => {
    const html = rendre(entree());
    const t = visible(html);
    for (const x of ["Version A", "Version B", "Phrase de la version A, première.", "Phrase de la version B, première.", "Apport de A", "Apport de B bis", "Situation", "Ce qui change", "Ce que l'entreprise gagne"]) expect(t).toContain(x);
    expect(html).toContain("md:grid-cols-2");
    expect(t).toContain("Choisir la version A");
    expect(t).toContain("Choisir la version B");
    expect(t).toContain("Corriger le texte");
    expect(t).toContain("Refaire écrire");
  });
  it("verdict « bloque » : « Valider » inactif et la raison est visible", () => {
    const html = rendre(entree("bloque"));
    expect(boutonValider(html)).toMatch(/\bdisabled=""/);
    expect(visible(html)).toContain("Une phrase est trop longue pour être lue d'un coup.");
    expect(visible(html)).toContain("corrigez-les d'abord");
  });
  it("verdict « ok » mais aucune version choisie : « Valider » inactif aussi, avec sa raison", () => {
    const html = rendre(entree());
    expect(boutonValider(html)).toMatch(/\bdisabled=""/);
    expect(visible(html)).toContain("Choisissez d'abord la version A ou la version B.");
  });
  it("verdict « ok » et version choisie : « Valider » actif", () => {
    const e = entree();
    const html = rendre({ ...e, scriptChoisi: { texte: "Phrase de la version A, première.", source: "choisi", empreinte: "x", phrases: [{ texte: "Phrase de la version A, première.", aRevoir: false }] } });
    expect(boutonValider(html)).not.toMatch(/\bdisabled=""/);
  });
  it("aucune étiquette interdite, aucun montant", () => {
    const e = entree();
    const html = rendre({ ...e, devis: { phrases: ["Claude : 9 appels au plus", "Voix : 640 caractères (environ 45 s)"], empreinte: "e1" } });
    const t = visible(html);
    expect(t).not.toMatch(INTERDITES);
    expect(t).not.toMatch(MONTANT);
    expect(t).toContain("Claude : 9 appels au plus");
    expect(t).toContain("Titre proposé par le Studio");
  });
  it("une proposition du Studio n'est pas cochée par défaut", () => {
    const html = rendre(entree());
    expect(html).toMatch(/role="checkbox"[^>]*aria-checked="false"|aria-checked="false"[^>]*role="checkbox"/);
  });
});

describe("gestes (appel direct, actions simulées)", () => {
  const actions = () => ({
    choisirVersion: vi.fn(async () => issue),
    corrigerScript: vi.fn(async () => issue),
    choisirProposition: vi.fn(async () => issue),
    refaireEcrire: vi.fn(async () => issue),
    valider: vi.fn(async () => issue),
  });
  it("« Choisir la version B » : un appel, les bons arguments, aucune autre action", async () => {
    const a = actions();
    const r = await surChoixVersion("v1", "B", a);
    expect(a.choisirVersion).toHaveBeenCalledTimes(1);
    expect(a.choisirVersion).toHaveBeenCalledWith("v1", "B");
    expect(r).toEqual({ reussi: true, phrase: "C'est fait." });
    for (const k of ["corrigerScript", "choisirProposition", "refaireEcrire", "valider"] as const) expect(a[k]).not.toHaveBeenCalled();
  });
  it("correction : seules les différences partent, telles quelles", async () => {
    const a = actions();
    const diffs = [{ id: "voix-2", dit: "Mon texte, à moi." }];
    await surCorrection("v1", diffs, a);
    expect(a.corrigerScript).toHaveBeenCalledTimes(1);
    expect(a.corrigerScript).toHaveBeenCalledWith("v1", diffs);
    expect(a.choisirVersion).not.toHaveBeenCalled();
  });
  it("proposition cochée, « Refaire écrire » : une action chacun", async () => {
    const a = actions();
    await surProposition("v1", "prop-1", true, a);
    expect(a.choisirProposition).toHaveBeenCalledWith("v1", "prop-1", true);
    await surRefaire("v1", a);
    expect(a.refaireEcrire).toHaveBeenCalledWith("v1");
    expect(a.valider).not.toHaveBeenCalled();
  });
  it("« Valider » : l'empreinte du devis part à l'action ; sans devis, aucune empreinte", async () => {
    const a = actions();
    await surValidation("v1", "empreinte-9", a);
    expect(a.valider).toHaveBeenLastCalledWith("v1", { empreinteDevis: "empreinte-9" });
    await surValidation("v1", undefined, a);
    expect(a.valider).toHaveBeenLastCalledWith("v1", {});
  });
  it("un refus est montré tel quel ; une erreur aussi", async () => {
    const a = actions();
    a.choisirVersion.mockResolvedValueOnce({ ok: true, donnees: { statut: "refusee", phrase: "Rien à valider pour l'instant." } } as never);
    expect(await surChoixVersion("v1", "A", a)).toEqual({ reussi: false, phrase: "Rien à valider pour l'instant." });
    a.valider.mockResolvedValueOnce({ ok: false, message: "Le générateur est éteint." } as never);
    expect(await surValidation("v1", undefined, a)).toEqual({ reussi: false, phrase: "Le générateur est éteint." });
  });
  it("raisonInactif : défauts d'abord, puis version à choisir, puis rien", () => {
    const d = construireDossierValidation(entree("bloque"));
    expect(raisonInactif(d)).toContain("corrigez-les d'abord");
    const ok = construireDossierValidation(entree());
    expect(raisonInactif(ok)).toContain("Choisissez d'abord");
    expect(raisonInactif({ ...ok, choix: { source: "choisi", texte: "x" } })).toBeNull();
  });
});

describe("vueValidationTutoriel", () => {
  const equipe = () => {
    const e = entree();
    return { cahier: e.cahier, carte: e.carte, fiche: e.fiche, propositionScripts: e.proposition, verdict: e.verdict };
  };
  const travail = (tutoriel: unknown) => ({ id: "t1", parametres: { tutoriel } }) as never;
  it("une vidéo d'un autre format : null", async () => {
    expect(await vueValidationTutoriel("v1", { video: async () => ({ id: "v1", formatId: "image-video" }), travail: async () => travail({ equipe: equipe() }) })).toBeNull();
  });
  it("vidéo inconnue : null", async () => {
    expect(await vueValidationTutoriel("v1", { video: async () => null })).toBeNull();
  });
  it("sans `equipe` dans le travail (ou sans travail) : null", async () => {
    const video = async () => ({ id: "v1", formatId: ID_FORMAT_TUTORIEL_OUTIL });
    expect(await vueValidationTutoriel("v1", { video, travail: async () => travail({}) })).toBeNull();
    expect(await vueValidationTutoriel("v1", { video, travail: async () => null })).toBeNull();
  });
  it("équipe incomplète (pas de verdict) : null", async () => {
    const { verdict: _v, ...sans } = equipe();
    void _v;
    expect(await vueValidationTutoriel("v1", { video: async () => ({ id: "v1", formatId: ID_FORMAT_TUTORIEL_OUTIL }), travail: async () => travail({ equipe: sans }) })).toBeNull();
  });
  it("équipe complète : le dossier, miniatures signées, devis repris, rien d'écrit", async () => {
    const url = vi.fn(async (cle: string) => (cle === "cle-ok" ? "https://exemple.invalide/ok.png" : null));
    const d = await vueValidationTutoriel("v1", {
      video: async () => ({ id: "v1", formatId: ID_FORMAT_TUTORIEL_OUTIL }),
      travail: async () => travail({ equipe: { ...equipe(), scriptChoisi: { texte: "Phrase.", source: "choisi", empreinte: "x", phrases: [{ texte: "Phrase.", zoneId: "liste", aRevoir: false }] }, parcours: { gestes: [{ etapeId: "e1", phraseIndex: 0, geste: "clic" }] }, miniatures: { e1: "cle-ok", e2: "cle-absente" }, devis: { phrases: ["Claude : 9 appels au plus"], empreinte: "emp" } } }),
      url,
    });
    expect(d?.parcours[0]).toMatchObject({ miniature: "https://exemple.invalide/ok.png", miniatureDisponible: true });
    expect(d?.devis).toEqual({ phrases: ["Claude : 9 appels au plus"] });
    expect(d?.empreinteDevis).toBe("emp");
    expect(d?.choix?.source).toBe("choisi");
  });
});
