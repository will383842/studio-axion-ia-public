/**
 * T-EXT-24 · dossier de l'écran de validation (pur). Entrées fictives des rôles 18 à 23 et du registre 40 ; aucun appel, 0 €.
 */
import { describe, expect, it } from "vitest";
import type { CarteZones } from "@/moteurs/montage-tutoriel-outil/equipe/analyste";
import type { CahierVideo } from "@/moteurs/montage-tutoriel-outil/equipe/chef-de-projet";
import type { VerdictControleur } from "@/moteurs/montage-tutoriel-outil/equipe/controleur";
import { construireDossierValidation, PHRASE_MINIATURE_ABSENTE, type EntreeDossierValidation } from "@/moteurs/montage-tutoriel-outil/equipe/dossier-validation";
import type { ParcoursTutoriel } from "@/moteurs/montage-tutoriel-outil/equipe/realisateur";
import { etablirRegistre } from "@/moteurs/montage-tutoriel-outil/equipe/registre-textes";
import type { PropositionScripts, ScriptChoisi } from "@/moteurs/montage-tutoriel-outil/equipe/scenariste";
import type { FicheValeur } from "@/moteurs/montage-tutoriel-outil/equipe/strategie-valeur";

// Même intention que `devis-tutoriel.test.ts`, mais mots entiers : « spectateur » contient « eur » sans être un montant.
const MONTANT = /€|\$|\bEUR\b|\bUSD\b|\beuros?\b|\bdollars?\b|\bprix\b|\bcoûts?\b|\bcouts?\b/i;
const INTERDITES = /Douleur|Solution|À vous|Exemple\s*:/;

const cahier = (fin: "aucune" | "prendre-rendez-vous" = "aucune"): CahierVideo => ({
  version: "cahier-tutoriel.v1",
  entree: "B",
  cas: 1,
  gabarits: ["G-Decision"],
  roles: ["analyste", "stratege", "scenariste", "realisateur", "controleur"],
  manques: [],
  scriptsFournis: [],
  fin,
  ratios: ["4:5", "9:16"],
  dureeCibleSec: [40, 55],
  raisons: [],
});

const carte: CarteZones = {
  version: "carte-zones.v1",
  maquette: "Espace démo · Plomberie",
  manques: [],
  zones: [
    { id: "chiffres", nom: "Les chiffres du jour", aller: "/", cible: "#chiffres", etat: "maintenant", gestes: ["zoom"], prouve: "Le chiffre du jour", chiffres: [] },
    { id: "liste", nom: "La liste des demandes", aller: "/", cible: "#liste", etat: "maintenant", gestes: ["clic"], prouve: "Les demandes", chiffres: [] },
    { id: "alerte", nom: "L'alerte", aller: "/", cible: "#alerte", etat: "maintenant", gestes: ["apparition"], prouve: "L'alerte", chiffres: [] },
  ],
};

const fiche: FicheValeur = {
  version: "fiche-valeur.v1",
  persona: { metier: "Plombier", journee: "Il passe ses soirées à recompter ses demandes.", perte: "Il perd du temps et des clients." },
  avant: ["Des demandes dans tous les sens"],
  moments: [
    { id: "m1", zoneId: "chiffres", geste: "zoom", permet: "Savoir où l'on en est d'un coup d'œil" },
    { id: "m2", zoneId: "liste", geste: "clic", evite: "Chercher dans ses messages" },
  ],
  gainEntreprise: { devient: "plus-sereine", pourquoi: "Chaque demande a sa place." },
  emotion: "soulagement",
};

const phr = (texte: string, temps: "situation" | "changement" | "gain", zoneId: string) => ({ texte, temps, apport: "Montre le chiffre du jour", zoneId });
const proposition: PropositionScripts = {
  version: "scripts-tutoriel.v1",
  versions: [
    { id: "A", source: "ecrit", empreinte: "a", phrases: [phr("Chaque soir, vous recomptez vos demandes à la main.", "situation", "liste"), phr("Ici, tout est déjà compté pour vous.", "changement", "chiffres"), phr("Votre entreprise respire enfin.", "gain", "chiffres")] },
    { id: "B", source: "ecrit", empreinte: "b", phrases: [phr("Vos demandes arrivent de partout.", "situation", "liste"), phr("Elles se rangent toutes seules.", "changement", "liste"), phr("Vous gardez la main sur votre semaine.", "gain", "alerte")] },
  ],
};

const choisi = (): ScriptChoisi => ({
  texte: "Chaque soir, vous recomptez vos demandes à la main. Ici, tout est déjà compté pour vous.",
  source: "choisi",
  empreinte: "x",
  phrases: [
    { ...phr("Chaque soir, vous recomptez vos demandes à la main.", "situation", "liste"), aRevoir: false },
    { ...phr("Ici, tout est déjà compté pour vous.", "changement", "chiffres"), aRevoir: false },
  ],
});

const parcours: ParcoursTutoriel = {
  version: "parcours-tutoriel.v1",
  gabarits: ["G-Decision"],
  scenario: { version: "scenario-maquette.v1", etapes: [] } as never,
  plansDessines: [],
  gestes: [
    { etapeId: "e1", phraseIndex: 0, geste: "clic" },
    { etapeId: "e2", phraseIndex: 1, geste: "zoom" },
  ],
  empreinte: "p",
};

const ok: VerdictControleur = { verdict: "ok", controles: [{ id: "c1", libelle: "Durée", etat: "reussi", bloquant: true, details: ["Durée conforme."] }], nonFaits: [], resume: "Rien à signaler" };
const bloque: VerdictControleur = {
  verdict: "bloque",
  controles: [{ id: "c2", libelle: "Phrases", etat: "echoue", bloquant: true, details: ["La phrase 2 est trop longue pour être lue d'un coup."] }],
  nonFaits: [],
  resume: "Bloqué : 1 défaut à corriger",
};

const registre = (opts: { fin?: "aucune" | "prendre-rendez-vous"; texteFin?: string; longue?: string } = {}) =>
  etablirRegistre({
    script: { phrases: ["Chaque soir, vous recomptez vos demandes à la main.", opts.longue ?? "Ici, tout est déjà compté pour vous."], origine: "choisi" },
    fin: opts.fin ?? "aucune",
    ...(opts.texteFin ? { texteFin: opts.texteFin } : {}),
    parcours: {},
    textesMaquette: [{ etapeId: "e1", textes: ["Demandes du jour"], creee: false }],
    propositions: [{ id: "prop-1", texte: "Un titre proposé par le Studio", etapeId: "e1" }],
  });

const entree = (sur: Partial<EntreeDossierValidation> = {}): EntreeDossierValidation => ({ cahier: cahier(), carte, fiche, proposition, verdict: ok, ...sur });

const textesDe = (v: unknown, sortie: string[] = []): string[] => {
  if (typeof v === "string") sortie.push(v);
  else if (Array.isArray(v)) v.forEach((x) => textesDe(x, sortie));
  else if (v && typeof v === "object") Object.values(v).forEach((x) => textesDe(x, sortie));
  return sortie;
};

describe("verdict", () => {
  it("« ok » : on peut valider", () => {
    const d = construireDossierValidation(entree());
    expect(d.controle.peutValider).toBe(true);
    expect(d.controle.raisons).toEqual([]);
  });
  it("« bloque » : on ne peut pas valider, les raisons sont des phrases", () => {
    const d = construireDossierValidation(entree({ verdict: bloque }));
    expect(d.controle.peutValider).toBe(false);
    expect(d.controle.raisons).toEqual(["La phrase 2 est trop longue pour être lue d'un coup."]);
    expect(d.controle.resume).toContain("trop longue");
  });
});

describe("en-tête et fin", () => {
  it("dit le genre de vidéo en mots simples", () => {
    const d = construireDossierValidation(entree());
    expect(d.entete).toEqual({ cas: "Tableau de bord fourni", gabarits: ["Du chiffre à la décision"], fin: "Aucune", formats: ["4:5", "9:16"], dureeVisee: "40 à 55 s" });
  });
  it("fin « aucune » : écrit « Aucune » et aucune ligne de fin dans les textes", () => {
    const d = construireDossierValidation(entree({ registre: registre() }));
    expect(d.entete.fin).toBe("Aucune");
    expect(d.textes.lignes.some((l) => l.ou === "Fin")).toBe(false);
  });
  it("fin choisie : la ligne de fin apparaît en entier", () => {
    const fin = "Pour en parler, prenez rendez-vous quand vous voulez, nous regarderons ensemble votre situation.";
    const d = construireDossierValidation(entree({ cahier: cahier("prendre-rendez-vous"), registre: registre({ fin: "prendre-rendez-vous", texteFin: fin }) }));
    expect(d.entete.fin).toBe("Prendre rendez-vous");
    expect(d.textes.lignes.find((l) => l.ou === "Fin")?.texte).toBe(fin);
    expect(d.textes.finSansTexte).toBe(false);
  });
  it("fin choisie sans texte : signalée, jamais inventée", () => {
    const d = construireDossierValidation(entree({ cahier: cahier("prendre-rendez-vous"), registre: registre({ fin: "prendre-rendez-vous" }) }));
    expect(d.textes.finSansTexte).toBe(true);
    expect(d.textes.lignes.some((l) => l.ou === "Fin")).toBe(false);
  });
});

describe("versions", () => {
  it("A et B avec les trois temps en mots de tous les jours", () => {
    const d = construireDossierValidation(entree());
    expect(d.versions.map((v) => v.id)).toEqual(["A", "B"]);
    expect(d.versions[0].phrases.map((p) => p.temps)).toEqual(["Situation", "Ce qui change", "Ce que l'entreprise gagne"]);
    expect(d.versions[0].phrases[0].apport).toBe("Montre le chiffre du jour");
    expect(d.versions[0].phrases[1].zone).toBe("Les chiffres du jour (chiffres)");
    expect(d.versions[0].phrases[0].dureeSec).toBeGreaterThan(0);
  });
  it("aucune chaîne du dossier ne contient « Douleur », « Solution », « À vous »", () => {
    const d = construireDossierValidation(entree({ scriptChoisi: choisi(), parcours, registre: registre(), devis: { phrases: ["Claude : 9 appels au plus"], empreinte: "e" } }));
    const toutes = textesDe(d);
    expect(toutes.length).toBeGreaterThan(20);
    for (const t of toutes) expect(t).not.toMatch(INTERDITES);
    expect(Object.keys(d.valeur.persona).join(" ")).not.toMatch(INTERDITES);
  });
});

describe("textes mot pour mot", () => {
  it("un texte de 300 caractères est rendu entier", () => {
    const long = `${"Un texte long et précis. ".repeat(12)}`.slice(0, 300);
    expect(long).toHaveLength(300);
    const d = construireDossierValidation(entree({ registre: registre({ longue: long }) }));
    expect(d.textes.lignes.find((l) => l.texte === long)).toBeTruthy();
  });
  it("les propositions du Studio ne sont pas cochées par défaut", () => {
    const d = construireDossierValidation(entree({ registre: registre() }));
    expect(d.textes.propositions).toEqual([{ id: "prop-1", texte: "Un titre proposé par le Studio", ou: "Texte proposé par le Studio", choisi: false }]);
  });
  it("sans registre : aucune ligne", () => {
    const d = construireDossierValidation(entree());
    expect(d.textes).toEqual({ lignes: [], propositions: [], finSansTexte: false });
  });
});

describe("parcours", () => {
  it("sans miniature : « miniature après la capture » ; sans script choisi, les phrases de A", () => {
    const d = construireDossierValidation(entree());
    expect(d.parcours).toHaveLength(3);
    expect(d.parcours[0].miniature).toBe(PHRASE_MINIATURE_ABSENTE);
    expect(d.parcours.every((l) => !l.miniatureDisponible)).toBe(true);
  });
  it("avec miniature : l'url ; geste et zone en mots simples", () => {
    const d = construireDossierValidation(entree({ scriptChoisi: choisi(), parcours, miniatures: { e1: "https://exemple.invalide/e1.png" } }));
    expect(d.parcours).toHaveLength(2);
    expect(d.parcours[0]).toMatchObject({ numero: 1, miniature: "https://exemple.invalide/e1.png", miniatureDisponible: true, geste: "on clique", zone: "La liste des demandes (liste)" });
    expect(d.parcours[1].miniature).toBe(PHRASE_MINIATURE_ABSENTE);
    expect(d.parcours[1].geste).toBe("on s'approche");
  });
});

describe("devis", () => {
  it("absent : aucune section ni empreinte", () => {
    const d = construireDossierValidation(entree());
    expect(d.devis).toBeUndefined();
    expect(d.empreinteDevis).toBeUndefined();
  });
  it("présent : ses phrases telles quelles et l'empreinte gardée pour le clic « Valider »", () => {
    const phrases = ["Claude : 9 appels au plus", "Voix : 640 caractères (environ 45 s)"];
    const d = construireDossierValidation(entree({ devis: { phrases, empreinte: "empreinte-1" } }));
    expect(d.devis).toEqual({ phrases });
    expect(d.empreinteDevis).toBe("empreinte-1");
  });
  it("aucun montant nulle part dans le dossier", () => {
    const d = construireDossierValidation(entree({ scriptChoisi: choisi(), parcours, registre: registre(), devis: { phrases: ["Claude : 9 appels au plus"], empreinte: "e" } }));
    for (const t of textesDe(d)) expect(t).not.toMatch(MONTANT);
  });
});
