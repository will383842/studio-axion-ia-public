/** T-EXT-V2-06 : pièces déduites d'un flux créé (pur, sans IA, aucun appel, aucun navigateur, aucun rendu, 0 €). */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import vm from "node:vm";
import { describe, expect, it } from "vitest";
import { schemaCarteZones } from "@/moteurs/montage-tutoriel-outil/equipe/analyste";
import { carteDepuisFlux, controlerFluxCree, empreinteFlux, scenarioApercuFlux, textesDuFlux } from "@/moteurs/montage-tutoriel-outil/flux-cree";
import { lireFluxAutomatisation, VERSION_FLUX, type FluxAutomatisation } from "@/moteurs/montage-tutoriel-outil/gabarit-flux";
import { lireScenarioMaquette } from "@/moteurs/montage-tutoriel-outil/scenario-maquette";

type Libre = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any -- données de test abîmées champ par champ

/** Contenus du bureau exemple (T-EXT-49), lus en lecture seule dans `demo-data.js`, sans les vues du tableur et de l'agenda (chiffres, hors flux). */
function contenus(): Libre {
  const source = readFileSync(join(process.cwd(), "outils/maquettes-tableaux-de-bord/ecrans-outils/demo-data.js"), "utf8");
  const ctx: Libre = {};
  vm.runInNewContext(source, { window: ctx });
  const c = JSON.parse(JSON.stringify(ctx.DONNEES_ECRANS.contenus)) as Libre;
  delete c.tableur;
  delete c.agenda;
  return c;
}

/** Noms de personnes d'exemple du bureau (`noms.json` : « Espace démo · … », « Entreprise exemple », et les noms de `demo-data.js`). */
const NOMS = ["Client exemple", "Fournisseur exemple", "Voisin exemple", "Partenaire exemple", "Contact exemple", "Équipe exemple", "Atelier exemple"];

/** Flux fixe « tri d'e-mails » : 5 étapes, une humaine, 3 moments. */
function brut(): Libre {
  return {
    version: VERSION_FLUX,
    avant: { vue: "boite", etat: "avant", surMot: "déborde" },
    declencheur: { vue: "boite", etat: "nouveau", surMot: "arrive" },
    etapes: [
      { id: "classement", vue: "boite", etat: "etiquete", acteur: "automatisation", libelleSchema: "Classement du message", surMot: "classe" },
      { id: "brouillon", vue: "boite", etat: "brouillon", acteur: "ia", libelleSchema: "Brouillon de réponse", surMot: "brouillon" },
      { id: "validation", vue: "boite", etat: "brouillon", acteur: "humain", libelleSchema: "Vous validez", surMot: "validez" },
      { id: "equipe", vue: "messagerie", etat: "notification", acteur: "automatisation", libelleSchema: "Équipe prévenue", surMot: "équipe" },
      { id: "fiche", vue: "crm", etat: "fiche-remplie", acteur: "automatisation", libelleSchema: "Fiche à jour", surMot: "fiche" },
    ],
    moments: ["classement", "brouillon", "validation"],
    resultat: { vue: "crm", etat: "fiche-remplie", surMot: "résultat" },
    contenus: contenus(),
  };
}

const flux = (b: Libre = brut()): FluxAutomatisation => {
  const r = lireFluxAutomatisation(b);
  if (!r.ok) throw new Error(r.erreurs.join(" | "));
  return r.flux;
};
const defauts = (b: Libre) => controlerFluxCree(b as FluxAutomatisation, NOMS).join(" | ");

describe("controlerFluxCree (V2-06)", () => {
  it("le flux « tri d'e-mails » est sans défaut", () => {
    expect(defauts(brut())).toBe("");
  });

  it("adresse réelle refusée, adresse d'exemple admise", () => {
    const b = brut();
    b.contenus.boite.messages[0].adresse = "contact@exemple.fr";
    expect(defauts(b)).toMatch(/adresse réelle possible/);
    const ok = brut();
    ok.contenus.boite.messages[0].adresse = "marie@exemple.invalid";
    expect(defauts(ok)).toBe("");
  });

  it("une adresse réelle glissée dans un texte est refusée aussi", () => {
    const b = brut();
    b.contenus.messagerie.notification.texte = "Écrire à marie@exemple.com";
    expect(defauts(b)).toMatch(/adresse réelle possible/);
  });

  it("étiquette « Solution : tri auto » refusée", () => {
    const b = brut();
    b.etapes[0].libelleSchema = "Solution : tri auto";
    expect(defauts(b)).toMatch(/étiquette interdite/);
  });

  it("tutoiement « Ton e-mail est classé » refusé", () => {
    const b = brut();
    b.etapes[0].libelleSchema = "Ton e-mail est classé";
    expect(defauts(b)).toMatch(/tutoiement/);
  });

  it("nom propre non choisi refusé", () => {
    const b = brut();
    b.etapes[0].libelleSchema = "Envoi à Dupont";
    expect(defauts(b)).toMatch(/nom propre/);
  });

  it("nombre « 42 messages » refusé, « 9 h 30 » et une date courte admis", () => {
    const b = brut();
    b.etapes[0].libelleSchema = "42 messages classés";
    expect(defauts(b)).toMatch(/nombre non choisi/);
    const h = brut();
    h.etapes[0].libelleSchema = "Relevé à 9 h 30";
    expect(defauts(h)).toBe("");
    const d = brut();
    d.etapes[0].libelleSchema = "Relevé du 12/11";
    expect(defauts(d)).toBe("");
  });

  it("un nombre dans un texte de contenu est refusé", () => {
    const b = brut();
    b.contenus.messagerie.notification.texte = "42 demandes reçues";
    expect(defauts(b)).toMatch(/nombre non choisi/);
  });

  it("une vue hors du bureau exemple est refusée (par le lecteur du flux)", () => {
    const b = brut();
    b.etapes[0].vue = "comptabilite";
    expect(defauts(b)).toMatch(/vue inconnue/);
  });

  it("aucune étape humaine : refus, par le lecteur du flux", () => {
    const b = brut();
    b.etapes[2].acteur = "automatisation";
    expect(defauts(b)).toMatch(/personne contrôle et décide/);
  });

  it("ne lève jamais, même sur n'importe quoi", () => {
    for (const x of [null, undefined, 3, "x", [], {}, { etapes: 4 }]) expect(Array.isArray(controlerFluxCree(x as never))).toBe(true);
    expect(controlerFluxCree(null as never).length).toBeGreaterThan(0);
  });
});

describe("textesDuFlux (V2-06)", () => {
  it("dans l'ordre des étapes, libellé du schéma d'abord, sans doublon", () => {
    const t = textesDuFlux(flux());
    expect(t.map((x) => x.etapeId)).toEqual(["classement", "brouillon", "validation", "equipe", "fiche"]);
    expect(t[0]!.textes[0]).toBe("Classement du message");
    const tous = t.flatMap((x) => x.textes);
    expect(new Set(tous).size).toBe(tous.length);
    // la boîte est la vue de 3 étapes : ses textes ne sont listés qu'à la première
    expect(t[1]!.textes).toEqual(["Brouillon de réponse"]);
    expect(t[0]!.textes).toContain("Demande de devis pour un chantier");
  });

  it("un flux illisible donne une liste vide", () => {
    expect(textesDuFlux(null as never)).toEqual([]);
  });
});

describe("carteDepuisFlux (V2-06)", () => {
  it("5 étapes : 5 zones, ordre croissant, relue par le schéma de la carte", () => {
    const r = carteDepuisFlux(flux());
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.carte.zones).toHaveLength(5);
    expect(r.carte.zones.map((z) => z.flux?.ordre)).toEqual([0, 1, 2, 3, 4]);
    expect(r.carte.zones.map((z) => z.id)).toEqual(["classement", "brouillon", "validation", "equipe", "fiche"]);
    expect(r.carte.zones.map((z) => z.aller)).toEqual(r.carte.zones.map((z) => z.id));
    expect(r.carte.zones[0]!.flux?.evenement).toBe("Classement du message");
    expect(r.carte.zones[0]!.prouve).toBe("Étape : Classement du message");
    expect(r.carte.zones.every((z) => z.etat === "maintenant")).toBe(true);
    expect(schemaCarteZones.safeParse(r.carte).success).toBe(true);
  });

  it("l'étape humaine se prouve par un clic, les autres par une apparition", () => {
    const r = carteDepuisFlux(flux());
    if (!r.ok) throw new Error("carte attendue");
    expect(r.carte.zones.find((z) => z.id === "validation")!.gestes).toEqual(["clic"]);
    expect(r.carte.zones.find((z) => z.id === "equipe")!.gestes).toEqual(["apparition"]);
  });

  it("moins de 3 étapes : refus sans lever", () => {
    const b = brut();
    b.etapes = b.etapes.slice(1, 3); // 2 étapes dont l'humaine
    b.moments = ["validation"];
    const r = carteDepuisFlux(flux(b));
    expect(r).toEqual({ ok: false, erreurs: [expect.stringMatching(/3 à 12 étapes/)] });
  });

  it("un flux illisible : refus sans lever", () => {
    expect(carteDepuisFlux(null as never).ok).toBe(false);
  });
});

describe("empreinteFlux et scenarioApercuFlux (V2-06)", () => {
  it("l'empreinte ne dépend pas de l'ordre des clés, et change si un texte change", () => {
    const a = flux();
    const inverse = JSON.parse(JSON.stringify(a), (_k, v) => (v && typeof v === "object" && !Array.isArray(v) ? Object.fromEntries(Object.entries(v).reverse()) : v)) as FluxAutomatisation;
    expect(empreinteFlux(inverse)).toBe(empreinteFlux(a));
    const b = brut();
    b.etapes[0].libelleSchema = "Classement des messages";
    expect(empreinteFlux(flux(b))).not.toBe(empreinteFlux(a));
  });

  it("le scénario d'aperçu : déclencheur, 5 étapes, résultat ; dernière étape « appel » ; relu par le lecteur", () => {
    const s = scenarioApercuFlux(flux(), "ecrans-outils");
    expect(lireScenarioMaquette(s).ok).toBe(true);
    expect(s.maquette).toBe("ecrans-outils");
    expect(s.etapes.map((e) => e.aller)).toEqual(["declencheur", "classement", "brouillon", "validation", "equipe", "fiche", "resultat"]);
    expect(s.etapes[0]!.role).toBe("accroche");
    expect(s.etapes.at(-1)!.role).toBe("appel");
    expect(s.etapes.filter((e) => e.role === "appel")).toHaveLength(1);
  });
});
