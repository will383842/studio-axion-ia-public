/**
 * R5 · Mode automatique : l'image incohérente ne bloque jamais, le code répare et adapte seul, sans validation.
 * Tout est SIMULÉ (`doubles-fabrication.ts`) : aucun appel payant, aucune date, aucun hasard.
 */
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { adapterCarteAutomatiquement } from "@/domaine/image-video/analyste/chaine-auto";
import { analyserRealisme } from "@/domaine/image-video/analyste/realisme";
import { completerCarte, type BrouillonCarte, type CarteImage, type NoeudCarte } from "@/domaine/image-video/carte";
import type { FicheImage } from "@/domaine/image-video/fiche";
import { BlocAdapteAutomatiquement, phrasesAdaptees } from "@/components/formats/image-video/AdapteAutomatiquement";
import { schemaReglagesImageVideo } from "@/formats/image-video";
import { avancerJusquAArretIV, etatInitialIV, miseDeCoteScriptIV, type PropositionScriptIV } from "@/moteurs/montage-image-video/fabrication";
import { ficheMiseEnScene } from "@/moteurs/montage-image-video/mise-en-scene";
import { lectureDeCarte } from "@/moteurs/montage-image-video/lecture/simulation";
import { carteFixe, demandeEssai, IMAGES, monde, outilsSimules } from "./doubles-fabrication";

vi.setConfig({ testTimeout: 120_000 });

const base = carteFixe("C");
const noeud = (id: string, libelle: string, ordre: number, extra: Partial<NoeudCarte> = {}): NoeudCarte => ({ id, libelle, role: "etape", couleur: "neutre", acteur: "auto", ordre, ...extra });
const lien = (id: string, de: string, vers: string) => ({ id, de, vers, couleur: "neutre" as const, style: "plein" as const });

function carte(p: { noeuds: NoeudCarte[]; liens: ReturnType<typeof lien>[]; phraseChoc?: string; validee?: boolean }): CarteImage {
  const c = completerCarte({ ...base, titre: "Un schéma", phraseChoc: p.phraseChoc ?? "Une phrase simple", noeuds: p.noeuds, liens: p.liens, groupes: [], bandeau: [], pied: [], lecture: { ecarts: [], alertes: [] }, validation: undefined, adaptations: undefined, types: undefined, chiffres: undefined } as unknown as BrouillonCarte);
  return p.validee ? { ...c, validation: { par: "reglage", le: "x", empreinteCarte: c.image.empreinte } } : c;
}
const fausse = (validee = false) =>
  carte({ validee, noeuds: [noeud("a", "Début", 1, { role: "declencheur" }), noeud("b", "Saisie", 2, { detail: "15 min + 4 min = 20 min perdues" }), noeud("c", "Fin", 3, { role: "resultat" })], liens: [lien("l1", "a", "b"), lien("l2", "b", "c")] });

describe("chaîne d'adaptation automatique (pure)", () => {
  it("un calcul faux est corrigé, dit dans les adaptations, et la validation tombe", () => {
    const r = adapterCarteAutomatiquement(fausse(true));
    expect(r.changee).toBe(true);
    expect(r.carte.noeuds.find((n) => n.id === "b")!.detail).toBe("15 min + 4 min = 19 min perdues");
    expect(r.carte.validation).toBeUndefined();
    expect(r.carte.adaptations!.join(" ")).toContain("15 min + 4 min = 19 min");
    expect(r.phrases.join(" ")).toContain("Corrigé par le code");
    expect(analyserRealisme(r.carte).problemes.filter((p) => p.code === "calcul-faux")).toEqual([]);
  });

  it("idempotente : une seconde passe ne change plus rien", () => {
    const une = adapterCarteAutomatiquement(fausse()).carte;
    const deux = adapterCarteAutomatiquement(une);
    expect(deux.changee).toBe(false);
    expect(JSON.stringify(deux.carte)).toBe(JSON.stringify(une));
  });

  it("les phrases affirmatives sont GARDÉES telles quelles et seulement signalées", () => {
    const c = carte({ phraseChoc: "0 question sans réponse", noeuds: [noeud("a", "Début", 1, { role: "declencheur" }), noeud("b", "Fin", 2, { role: "resultat" })], liens: [lien("l1", "a", "b")] });
    expect(c.formulesAbsolues.length).toBeGreaterThan(0);
    const r = adapterCarteAutomatiquement(c);
    expect(r.carte.phraseChoc).toBe("0 question sans réponse");
    expect(r.carte.phraseChocValidee).toBeUndefined();
    expect(r.carte.adaptations!.join(" ")).toMatch(/Phrase affirmative gardée telle quelle/);
  });

  it("ne lève jamais : une entrée absurde est rendue telle quelle", () => {
    const absurde = { n: 1 } as unknown as CarteImage;
    expect(() => adapterCarteAutomatiquement(absurde)).not.toThrow();
    expect(adapterCarteAutomatiquement(absurde)).toEqual({ carte: absurde, changee: false, phrases: [] });
  });

  it("les 7 cartes du jeu d'essai : jamais d'exception, jamais de défaut bloquant ajouté", () => {
    for (const nom of IMAGES) {
      const r = adapterCarteAutomatiquement(carteFixe(nom));
      expect(analyserRealisme(r.carte).problemes.filter((p) => p.gravite === "bloquant" && p.code !== "entonnoir-croissant")).toEqual([]);
    }
  });
});

describe("réglage « automatique »", () => {
  it("est le réglage par défaut du format, et les anciens restent permis", () => {
    expect(schemaReglagesImageVideo.parse({}).validationCarte).toBe("automatique");
    for (const v of ["toujours", "si-doute"] as const) expect(schemaReglagesImageVideo.parse({ validationCarte: v }).validationCarte).toBe(v);
  });

  it("sans aucune carte déjà validée, aucune porte n'attend Will : carte et script validés par le réglage", async () => {
    for (const nom of ["A", "B", "C"] as const) {
      const c = carteFixe(nom);
      const apres = await avancerJusquAArretIV(etatInitialIV(demandeEssai(c, { validationCarte: "automatique", plafondCentimes: 5000 })), outilsSimules(c, monde(), { cartesValidees: 0 }));
      expect(apres.miseDeCote, `${nom} ${JSON.stringify(apres.miseDeCote)}`).toBeUndefined();
      expect(apres.etape, nom).not.toBe("carte-a-valider");
      expect(apres.etape, nom).not.toBe("script-a-valider");
      expect(apres.carte?.par, nom).toBe("reglage");
      expect(apres.carte?.carte.validation?.par, nom).toBe("reglage");
      expect(apres.script, nom).toBeDefined();
      expect(apres.miseDeCote, nom).toBeUndefined();
      expect(apres.journal.join("\n"), nom).toMatch(/validée par le réglage « automatique »/);
    }
  });

  it("le prix reste la seule raison de mettre le script de côté : image chère, petit prix accordé", async () => {
    const c = carteFixe("A");
    const apres = await avancerJusquAArretIV(etatInitialIV(demandeEssai(c, { validationCarte: "automatique", plafondCentimes: 500 })), outilsSimules(c, monde(), { cartesValidees: 0 }));
    expect(apres.etape).toBe("script-a-valider");
    expect(apres.miseDeCote?.porte).toBe("script");
    expect(apres.miseDeCote?.motif).toMatch(/dépasserait le prix accordé/);
  });

  it("la phrase affirmative de l'image ne met rien de côté (choix « garder » posé par le réglage)", async () => {
    const c = completerCarte({ ...carteFixe("B"), phraseChoc: "0 question sans réponse" } as unknown as BrouillonCarte);
    const apres = await avancerJusquAArretIV(etatInitialIV(demandeEssai(c, { validationCarte: "automatique" })), outilsSimules(c, monde(), { cartesValidees: 0 }));
    expect(apres.miseDeCote).toBeUndefined();
    expect(apres.etape).not.toBe("script-a-valider");
    expect(apres.carte?.carte.phraseChoc).toBe("0 question sans réponse");
    expect(Object.values(apres.script?.choixFormules ?? {}).every((x) => x === "garder")).toBe(true);
  });

  it("en lot, un écart entre les deux lectures ne met plus la vidéo de côté (« si-doute » la mettait de côté)", async () => {
    const c = carteFixe("B");
    const b = lectureDeCarte(c);
    b.noeuds[0] = { ...b.noeuds[0], libelle: `${b.noeuds[0].libelle} bis` };
    const lot = { id: "lot-1", rang: 1 };
    const auto = await avancerJusquAArretIV(etatInitialIV(demandeEssai(c, { validationCarte: "automatique", lot, plafondCentimes: 5000 })), outilsSimules(c, monde(), { cartesValidees: 0, lectures: { b } }));
    expect(auto.miseDeCote).toBeUndefined();
    expect(auto.carte?.par).toBe("reglage");
    const ancien = await avancerJusquAArretIV(etatInitialIV(demandeEssai(c, { validationCarte: "si-doute", lot, plafondCentimes: 5000 })), outilsSimules(c, monde(), { cartesValidees: 0, lectures: { b } }));
    expect(ancien.miseDeCote?.porte).toBe("carte");
  });

  it("hors lot, le contrôle du prix reste STRICT au prix accordé même en mode indicatif (pas 5 ×)", async () => {
    const c = carteFixe("A");
    const base = outilsSimules(c, monde(), { cartesValidees: 0 });
    const o = { ...base, budget: { ...base.budget, indicatif: { facteurSecurite: 5, signaler: async () => undefined } } };
    const apres = await avancerJusquAArretIV(etatInitialIV(demandeEssai(c, { validationCarte: "automatique", plafondCentimes: 500 })), o);
    expect(apres.etape).toBe("script-a-valider");
    expect(apres.miseDeCote?.motif).toMatch(/dépasserait le prix accordé/);
  });

  it("un chiffre lu une seule fois est accepté sans relecture MAIS écrit dans les adaptations avant la validation", async () => {
    const c = carteFixe("C");
    const b = lectureDeCarte(c);
    b.noeuds = b.noeuds.map((n) => ({ ...n, libelle: n.libelle.replace(/\d+/g, "").trim() || n.libelle, ...(n.detail ? { detail: n.detail.replace(/\d+/g, "").trim() || n.detail } : {}) }));
    const apres = await avancerJusquAArretIV(etatInitialIV(demandeEssai(c, { validationCarte: "automatique", plafondCentimes: 5000 })), outilsSimules(c, monde(), { cartesValidees: 0, lectures: { b } }));
    expect(apres.carte?.par).toBe("reglage");
    expect(apres.carte?.carte.validation).toBeDefined();
    const dites = phrasesAdaptees(apres.carte!.carte).join(" ");
    expect(dites).toMatch(/Point accepté sans relecture, à vérifier/);
    expect(dites).toMatch(/écart|lu\(s\) une seule fois|une seule fois/);
  });

  it("bout en bout : un mot interdit (Q08, « machine ») dans la phrase-choc met le script de côté", async () => {
    const c = completerCarte({ ...carteFixe("B"), phraseChoc: "Cette machine travaille pour vous" } as unknown as BrouillonCarte);
    const apres = await avancerJusquAArretIV(etatInitialIV(demandeEssai(c, { validationCarte: "automatique", plafondCentimes: 5000 })), outilsSimules(c, monde(), { cartesValidees: 0 }));
    expect(apres.miseDeCote?.porte).toBe("script");
  });

  it("l'ancien réglage « si-doute » garde sa porte sous 10 cartes", async () => {
    const c = carteFixe("B");
    const apres = await avancerJusquAArretIV(etatInitialIV(demandeEssai(c, { validationCarte: "si-doute" })), outilsSimules(c, monde(), { cartesValidees: 0 }));
    expect(apres.etape).toBe("carte-a-valider");
  });
});

describe("porte « script » en mode automatique", () => {
  const manquement = { regle: "Q05bis", priorite: 2, message: "Formule très affirmative", pourWill: true } as const;
  const proposition = (auPlus: number): PropositionScriptIV =>
    ({ fiche: {} as FicheImage, aTrancher: [manquement], formules: [{ cle: "k", texte: "0 erreur", proposition: "presque plus d'erreurs", ecranId: "e1" }], empreinte: "e", prix: { engageCentimes: 10, habituelCentimes: 10, auPlusCentimes: auPlus, plafondCentimes: 100 } }) as unknown as PropositionScriptIV;

  it("phrases affirmatives gardées : prix dans le prix accordé = validé seul", () => {
    expect(miseDeCoteScriptIV(proposition(20), undefined, { formulesGardees: true })).toBeNull();
  });
  it("prix hors du prix accordé = mise de côté, comme avant", () => {
    expect(miseDeCoteScriptIV(proposition(200), undefined, { formulesGardees: true })?.motif).toMatch(/dépasserait le prix accordé/);
  });
  it("sans le mode automatique, la formule met toujours de côté", () => {
    expect(miseDeCoteScriptIV(proposition(20))?.motif).toMatch(/formule trop affirmative/);
  });
  it("un autre point à trancher (phrase-choc interdite) met toujours de côté", () => {
    const p = { ...proposition(20), aTrancher: [manquement, { regle: "Q06", priorite: 3, message: "Phrase-choc à reformuler", pourWill: true }] } as unknown as PropositionScriptIV;
    expect(miseDeCoteScriptIV(p, undefined, { formulesGardees: true })?.motif).toMatch(/phrase à trancher/);
  });
});

describe("garde de scène au choix de scène", () => {
  const fiche = (scene: string, texte: string) => ({ ecrans: [{ id: "e1", scene, partie: "douleur", refs: [], texteDit: texte, textesEcran: [texte] }] }) as unknown as FicheImage;
  it("un calcul faux ne finit jamais en « additionneur » : toile", () => {
    expect(ficheMiseEnScene(fiche("additionneur", "8 min + 6 min + 5 min = 20 min"), base).ecrans[0]!.scene).toBe("toile");
  });
  it("un calcul juste garde l'additionneur", () => {
    expect(ficheMiseEnScene(fiche("additionneur", "8 min + 6 min + 5 min = 19 min"), base).ecrans[0]!.scene).toBe("additionneur");
  });
  it("un entonnoir croissant retombe sur la toile, un entonnoir normal reste", () => {
    const croissant = { ...carte({ noeuds: [noeud("a", "Prospects", 1, { role: "declencheur", quantite: 10 }), noeud("b", "Rendez-vous", 2, { quantite: 40 }), noeud("c", "Clients", 3, { role: "resultat", quantite: 5 })], liens: [lien("l1", "a", "b"), lien("l2", "b", "c")] }), types: ["entonnoir"] } as unknown as CarteImage;
    expect(analyserRealisme(croissant).problemes.map((p) => p.code)).toContain("entonnoir-croissant");
    expect(ficheMiseEnScene(fiche("entonnoir", "Trois étapes"), croissant).ecrans[0]!.scene).toBe("toile");
    expect(ficheMiseEnScene(fiche("entonnoir", "Trois étapes"), base).ecrans[0]!.scene).toBe("entonnoir");
  });
});

describe("bloc « Adapté automatiquement, à vérifier »", () => {
  it("liste les adaptations sans le préfixe technique, sans doublon", () => {
    const phrases = phrasesAdaptees({ adaptations: ["Adapté automatiquement : un calcul corrigé.", "Adapté automatiquement : un calcul corrigé.", "Autre"] });
    expect(phrases).toEqual(["un calcul corrigé.", "Autre"]);
    const html = renderToStaticMarkup(createElement(BlocAdapteAutomatiquement, { phrases }));
    expect(html).toContain("Adapté automatiquement, à vérifier");
    expect(html).toContain("un calcul corrigé.");
    expect(html).toContain("reste un exemple");
  });
  it("rien à montrer : rien", () => {
    expect(renderToStaticMarkup(createElement(BlocAdapteAutomatiquement, { phrases: [] }))).toBe("");
    expect(phrasesAdaptees(undefined)).toEqual([]);
  });
});
