/**
 * Corrections de la relecture d'« Ajouter un cas » : messages du schéma en clair, mot à commenter, gardes plus strictes pour un
 * texte écrit à la main, promesses chiffrées sans chiffre, rang des filtres, simulation d'écriture sur le cas figé.
 */
import { describe, expect, it } from "vitest";
import { champEnFaute, saisieVide, versFormulaire } from "@/components/formats/cas-concret/ajouter/formulaire-cas";
import { correspondAuxFiltres, filtrerCas } from "@/components/formats/cas-concret/entree/piocher";
import { stockDeLAjoute } from "@/components/formats/cas-concret/entree/vue";
import { CATALOGUE } from "@/formats/cas-concret/catalogue";
import { preparerCasAjoute, refusDoublonAvecCatalogue } from "@/moteurs/montage-cas-concret/cas-ajoutes";
import { casDesEntrees } from "@/moteurs/montage-cas-concret";
import { avecCasRetenus } from "@/moteurs/montage-cas-concret/cas-simules";
import { roleEcritureCasConcret } from "@/moteurs/montage-cas-concret/ecriture";
import { refusMot, refusPremierMotPropre, refusPromessesChiffrees, refusSiglesInconnus, refusTextesCas } from "@/moteurs/montage-cas-concret/gardes-textes-cas";
import { FORMULAIRE_MINIMAL } from "./formulaires";

const prep = (plus: Record<string, unknown> = {}) => preparerCasAjoute({ ...FORMULAIRE_MINIMAL, ...plus }, { id: "ajout-essai-ab12", autres: CATALOGUE });
const raisons = (plus: Record<string, unknown>): string[] => {
  const r = prep(plus);
  return r.ok ? [] : r.raisons;
};

describe("messages du schéma : « Champ : … » en français", () => {
  it("un formulaire vide : chaque raison commence par un nom de champ connu, sans anglais ni chemin technique", () => {
    const r = preparerCasAjoute(versFormulaire(saisieVide()), { id: "ajout-vide-0000", autres: CATALOGUE });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    const connus = /^(Titre|Thème|Promesse|Pour qui|Sujet|Scène|Exemple|Tâches?( \d+)?|Étapes?( \d+)?( \([^)]+\))?|Ce qui reste humain|Partie humaine \(étape\)|Résultat|Mot à commenter|Offre|Nature|Secteur|Taille) : /;
    for (const raison of r.raisons) {
      expect(raison, raison).toMatch(connus);
      expect(raison, raison).not.toMatch(/Too small|Too big|Invalid|expected|etapes\.|taches\./);
    }
    // Chaque champ vide est dit.
    for (const nom of ["Titre", "Thème", "Pour qui", "Promesse", "Sujet", "Scène", "Exemple", "Tâches", "Ce qui reste humain", "Partie humaine (étape)", "Résultat", "Mot à commenter"]) {
      expect(r.raisons.some((x) => x.startsWith(`${nom} : `)), nom).toBe(true);
    }
  });
  it("tâches, mot, partie humaine et mots porteurs : messages précis", () => {
    expect(raisons({ taches: ["Une seule tâche"] }).join("|")).toMatch(/Tâches : donnez au moins 2 tâches/);
    expect(raisons({ mot: "A" }).join("|")).toMatch(/Mot à commenter : au moins 2 lettres/);
    expect(raisons({ resteHumainApresEtape: 0 }).join("|")).toMatch(/Partie humaine \(étape\) : indiquez le numéro de l'étape/);
    expect(raisons({ motsCles: ["devis"] }).join("|")).toMatch(/Sujet : donnez au moins deux mots porteurs/);
    expect(raisons({ etapes: [{ ligne: "Une." }, { ligne: "Deux." }, { ligne: "" }, { ligne: "Quatre." }] }).join("|")).toMatch(/Étape 3 : à remplir/);
    expect(raisons({ etapes: FORMULAIRE_MINIMAL.etapes.map((e, i) => (i === 1 ? { ...e, titre: "x".repeat(70) } : e)) }).join("|")).toMatch(/Étape 2 \(nom court\) : trop long/);
  });
  it("champEnFaute reconnaît les noms en clair", () => {
    expect(champEnFaute("Partie humaine (étape) : indiquez le numéro")).toBe("apres");
    expect(champEnFaute("Tâches : donnez au moins 2 tâches")).toBe("taches");
    expect(champEnFaute("Sujet : donnez au moins deux mots porteurs")).toBe("sujet");
    expect(champEnFaute("Étape 2 (nom court) : trop long")).toBe("etape-1-titre");
    expect(champEnFaute("Étape 2 (précision) : x")).toBe("etape-1-detail");
    expect(champEnFaute("Étape 2 : x")).toBe("etape-1");
    expect(champEnFaute("Étapes : au moins 3 étapes")).toBeNull();
  });
});

describe("mot à commenter", () => {
  it("lettres seulement : un chiffre est refusé", () => {
    expect(raisons({ mot: "DEVIS2" }).join("|")).toMatch(/Mot à commenter : de 2 à 24 lettres, sans chiffre/);
  });
  it("accents et casse ramenés en majuscules A à Z", () => {
    const r = prep({ mot: "Éclair" });
    expect(r.ok && r.cas.mot).toBe("ECLAIR");
  });
  it("jamais un mot interdit (Grenoble, première personne, interdits du format)", () => {
    expect(refusMot("Mot à commenter", "GRENOBLE").join("|")).toMatch(/Grenoble/);
    expect(refusMot("Mot à commenter", "MACHINE").join("|")).toMatch(/interdit/);
    expect(refusMot("Mot à commenter", "NOUS").join("|")).toMatch(/neutre/);
    expect(refusMot("Mot à commenter", "DEVIS")).toEqual([]);
    expect(raisons({ mot: "Grenoble" }).join("|")).toMatch(/Mot à commenter : .*Grenoble/);
  });
});

describe("gardes plus strictes pour un texte écrit à la main", () => {
  const r1 = (t: string) => refusTextesCas([{ nom: "Champ", texte: t }]);
  it("première personne : mon, ma, mes, moi, me, m'", () => {
    for (const t of ["Mon devis part", "Ma relance part", "Mes devis partent", "Relancez-moi vite", "Il me relance", "Il m'envoie le devis", "Il m’envoie le devis"]) expect(r1(t).join("|"), t).toMatch(/première personne/);
    expect(r1("Les devis partent")).toEqual([]);
  });
  it("mot en capitales de 3 lettres ou plus hors sigles permis", () => {
    expect(refusSiglesInconnus([{ nom: "Champ", texte: "Un outil comme ACME relance" }]).join("|")).toMatch(/ACME/);
    expect(refusSiglesInconnus([{ nom: "Champ", texte: "Le CRM et le PDF partent" }])).toEqual([]);
    expect(raisons({ cible: "Un dirigeant qui utilise ACME pour ses devis." }).join("|")).toMatch(/Pour qui : « ACME »/);
  });
  it("premier mot propre : « Dupont relance… » refusé, un début de phrase courant ne l'est jamais", () => {
    const vocab = new Set(["vos", "chaque", "les"]);
    expect(refusPremierMotPropre([{ nom: "Champ", texte: "Dupont relance les devis" }], vocab).join("|")).toMatch(/Champ : « Dupont » ressemble à un nom propre/);
    expect(refusPremierMotPropre([{ nom: "Champ", texte: "Vos devis partent" }], vocab)).toEqual([]);
    // Un mot du reste du formulaire, en minuscules, est connu.
    expect(refusPremierMotPropre([{ nom: "A", texte: "Planifier les relances" }, { nom: "B", texte: "Il faut planifier chaque envoi" }], vocab)).toEqual([]);
    expect(raisons({ titre: "Dupont relance les devis envoyés" }).join("|")).toMatch(/Titre : « Dupont » ressemble à un nom propre/);
  });
  it("pas de faux refus massifs : des débuts de phrase ordinaires passent", () => {
    for (const debut of ["Planifier", "Facturer", "Envoyer", "Relancer", "Classer", "Suivre", "Chaque", "Quand", "Pourquoi", "Votre", "Aucun", "Trop", "Beaucoup", "Rappeler"]) {
      const r = raisons({ titre: `${debut} les devis envoyés sans effort` });
      expect(r.filter((x) => x.startsWith("Titre : ") && /ressemble à un nom propre/.test(x)), debut).toEqual([]);
    }
  });
  it("caractères invisibles et de contrôle refusés (NFKC)", () => {
    expect(raisons({ titre: "Les devis​ relancés vite" }).join("|")).toMatch(/Titre : caractères de contrôle ou invisibles refusés/);
    expect(raisons({ scene: "Le devis est parti depuis longtemps\u0007 et personne n'a pensé à demander la réponse." }).join("|")).toMatch(/Scène : caractères de contrôle/);
  });
  it("NFKC : une écriture pleine largeur est ramenée à la normale (le contrôle voit le vrai texte)", () => {
    expect(raisons({ resultat: "Vos devis sont suivis en １２ jours." }).join("|")).toMatch(/Résultat : contient un nombre/);
  });
  it("sauts de ligne dans un champ : ramenés à une espace, pas refusés", () => {
    const r = prep({ scene: "Le devis est parti depuis longtemps.\nPersonne n'a pensé à demander la réponse, et le dossier dort dans la boîte d'envoi." });
    expect(r.ok).toBe(true);
  });
});

describe("promesses de résultat chiffré sans chiffre", () => {
  const champ = (nom: string, texte: string) => refusPromessesChiffrees([{ nom, texte }]);
  it.each(["Vos ventes doublent.", "Triplez vos devis.", "Quadruplez vos réponses.", "La moitié du travail disparaît.", "Dix fois plus de réponses.", "Des milliers de devis.", "Mille devis suivis.", "Un million de devis.", "Un milliard de devis.", "Cent pour cent de réponses.", "100 % suivis", "Zéro oubli."])("%s est refusé", (t) => {
    expect(champ("Promesse", t).join("|")).toMatch(/Promesse : promet un résultat chiffré sans fait vérifié/);
  });
  it("un texte ordinaire passe", () => {
    expect(champ("Promesse", "Vos devis sont relancés sans oubli.")).toEqual([]);
    expect(champ("Résultat", "Vos devis sont suivis et les réponses arrivent plus vite.")).toEqual([]);
  });
  it("dans un cas ajouté : refusé dans Promesse, Résultat, Titre et Sujet", () => {
    expect(raisons({ promesse: "Vos devis doublent vite." }).join("|")).toMatch(/Promesse : promet un résultat chiffré/);
    expect(raisons({ resultat: "Vos réponses arrivent deux fois plus vite." }).join("|")).toMatch(/Résultat : promet un résultat chiffré/);
    expect(raisons({ titre: "Les devis relancés sans oubli, zéro perte" }).join("|")).toMatch(/Titre : promet un résultat chiffré/);
    expect(raisons({ sujet: "Vos devis restent sans réponse pour moitié." }).join("|")).toMatch(/Sujet : promet un résultat chiffré/);
  });
});

describe("doublon avec le catalogue", () => {
  it("le mot ou le thème d'un cas du catalogue : refus en phrase", () => {
    const r = prep();
    if (!r.ok) throw new Error(r.raisons.join("|"));
    expect(refusDoublonAvecCatalogue(r.cas)).toBeNull();
    expect(refusDoublonAvecCatalogue({ ...r.cas, mot: CATALOGUE[0].mot })).toMatch(/Mot à commenter : .* déjà celui d'un autre cas, modifiez-le/);
    expect(refusDoublonAvecCatalogue({ ...r.cas, theme: CATALOGUE.find((c) => c.theme)!.theme })).toMatch(/Thème : .* déjà celui d'un autre cas, modifiez-le/);
  });
});

describe("filtres : le rang d'un cas ajouté", () => {
  it("un cas ajouté « Artisanat, TPE » est visible quand on filtre ce secteur et cette taille", () => {
    const stock = stockDeLAjoute({ secteur: "AS", taille: "TPE" });
    expect(stock).toEqual({ traite: false, secteur: "AS", taille: "TPE" });
    const cas = { id: "ajout-x", offre: "integration" as const, valide: true, stock };
    expect(correspondAuxFiltres(cas, { secteur: "AS" })).toBe(true);
    expect(correspondAuxFiltres(cas, { secteur: "AS", taille: "TPE" })).toBe(true);
    expect(correspondAuxFiltres(cas, { secteur: "IN" })).toBe(false);
    expect(filtrerCas([cas, { id: "autre", offre: "audit" as const, valide: true }], { secteur: "AS" }).map((c) => c.id)).toEqual(["ajout-x"]);
  });
  it("sans secteur ni taille : pas de rang (comme avant) ; avec le rang du stock : il est gardé", () => {
    expect(stockDeLAjoute({})).toBeUndefined();
    expect(stockDeLAjoute({}, { traite: true, fiche: "AS-01" })).toEqual({ traite: true, fiche: "AS-01" });
  });
});

describe("simulation de l'écriture sur le cas figé", () => {
  it("sans script, la simulation retrouve le cas figé (il n'est pas au catalogue)", () => {
    const r = prep();
    if (!r.ok) throw new Error(r.raisons.join("|"));
    // Le moteur retient le cas figé pour la simulation dès qu'il le lit.
    expect(casDesEntrees({ porte: "porte-a", casId: r.cas.id, casFige: r.cas })).toEqual(r.cas);
    const role = avecCasRetenus(roleEcritureCasConcret);
    const fiche = role.simuler!({ variable: `<cas-id>${r.cas.id}</cas-id>` } as never) as { casId?: string; ecrans?: unknown[] } | string;
    expect(typeof fiche).toBe("object");
    expect((fiche as { casId?: string }).casId).toBe(r.cas.id);
    expect(((fiche as { ecrans?: unknown[] }).ecrans ?? []).length).toBeGreaterThanOrEqual(12);
  });
});
