/**
 * T-MONTEUR-AVOCAT-v20f — tests directs des fonctions du monteur avocat jusque-là jamais appelées par un test :
 * catalogue, règles fixes, adaptateur, lecture de l'option, zooms. Importé depuis `monteur.ts`, jamais `index.ts`.
 */
import { describe, expect, it } from "vitest";
import {
  adaptateurMonteurAvocat,
  appliquerZoomsAvocat,
  catalogueMonteurAvocat,
  optionMonteurAvocat,
  reglesFixesAvocat,
  schemaReponseMonteurAvocat,
} from "@/moteurs/montage-avocat/monteur";
import type { ConsigneAncree } from "@/briques/monteur/adaptateur";
import type { PlanProduit } from "@/moteurs/types";
import type { CommandeFabrication } from "@/domaine/types";

const ancre = { debutMot: 2, finMot: 3 };
const consigne = (id: string, texte: string): ConsigneAncree => ({ id, origine: "ecrite", texte, ancre });

describe("catalogueMonteurAvocat", () => {
  it("sans motion : seulement 3 caméras et zoom, dans cet ordre", () => {
    expect(catalogueMonteurAvocat(false).map((e) => e.type)).toEqual(["multicamera", "zoom"]);
  });
  it("avec motion : ajoute carte animée puis titre", () => {
    const c = catalogueMonteurAvocat(true);
    expect(c.map((e) => e.type)).toEqual(["multicamera", "zoom", "ajouterCarte", "titre"]);
    expect(c[0].libelle).toBe("3 caméras");
    expect(c[0].exemples).toEqual(["Fais-le en 3 caméras"]);
  });
});

describe("reglesFixesAvocat", () => {
  it("consignes vides : « Rien à changer. », aucune opération", () => {
    expect(reglesFixesAvocat([], false)).toEqual({ reponse: "Rien à changer.", operations: [], consignes: [] });
  });
  it("zoom ancré : une opération punch-in sur les mots ancrés", () => {
    const r = reglesFixesAvocat([consigne("a", "Zoome quand je dis licenciement")], false);
    expect(r.operations).toEqual([{ type: "zoom", debutMot: 2, finMot: 3, style: "punch-in", cible: "visage" }]);
    expect(r.consignes).toEqual([{ consigneId: "a", comprise: true, resume: "Zoom ajouté", operations: [0] }]);
    expect(r.reponse).toBe("C'est fait : zoom ajouté.");
  });
  it("zoom « doucement » : style lent", () => {
    const r = reglesFixesAvocat([consigne("a", "Zoome doucement sur ce mot")], false);
    expect(r.operations[0]).toMatchObject({ type: "zoom", style: "lent" });
  });
  it("deux consignes comprises : 3 caméras puis zoom, indices d'opérations décalés", () => {
    const r = reglesFixesAvocat([consigne("a", "Fais-le en 3 caméras"), consigne("b", "Zoome ici")], false);
    expect(r.operations.map((o) => o.type)).toEqual(["multicamera", "zoom"]);
    expect(r.operations[0]).toEqual({ type: "multicamera", actif: true });
    expect(r.consignes.map((l) => l.operations)).toEqual([[0], [1]]);
    expect(r.reponse).toBe("C'est fait : 2 consignes appliquées.");
  });
  it("« une seule caméra » : multicaméra inactif", () => {
    const r = reglesFixesAvocat([consigne("a", "Une seule caméra")], false);
    expect(r.operations).toEqual([{ type: "multicamera", actif: false }]);
    expect(r.consignes[0].resume).toBe("Une seule caméra");
  });
  it("carte demandée sans motion : refus clair, aucune opération", () => {
    const r = reglesFixesAvocat([consigne("a", "Mets une carte avec le chiffre 32 %")], false);
    expect(r.operations).toEqual([]);
    expect(r.consignes[0].comprise).toBe(false);
    expect(r.reponse).toBe("Pour une vidéo avocat, je ne sais pas encore faire une carte animée : rien n'a été changé.");
  });
  it("titre avec motion : texte entre guillemets repris, plein écran", () => {
    const r = reglesFixesAvocat([consigne("a", "Mets le titre « Vos droits au travail »")], true);
    expect(r.operations).toEqual([{ type: "titre", texte: "Vos droits au travail", debutMot: 2, finMot: 3, pleinEcran: true }]);
    expect(r.reponse).toBe("C'est fait : titre « Vos droits au travail ».");
  });
  it("titre sans guillemets : question posée, rien d'appliqué", () => {
    const r = reglesFixesAvocat([consigne("a", "Mets un titre")], true);
    expect(r.operations).toEqual([]);
    expect(r.reponse).toBe("Quel titre voulez-vous ? Écrivez-le entre guillemets.");
  });
  it("consigne inconnue : demande de reformuler", () => {
    const r = reglesFixesAvocat([consigne("a", "blabla quelconque")], false);
    expect(r.consignes[0]).toEqual({ consigneId: "a", comprise: false, resume: "Je n'ai pas compris cette consigne : pouvez-vous la reformuler ?", operations: [] });
  });
});

describe("adaptateurMonteurAvocat", () => {
  it("forme par défaut : format avocat, sans motion", () => {
    const a = adaptateurMonteurAvocat();
    expect(a.format).toBe("avocat");
    expect(a.typesSupportes).toEqual(["multicamera", "zoom"]);
    expect(a.catalogue).toHaveLength(2);
  });
  it("motion: true ajoute carte et titre ; motion: false ou autre valeur non vraie les retire", () => {
    expect(adaptateurMonteurAvocat({ motion: true }).typesSupportes).toEqual(["multicamera", "zoom", "ajouterCarte", "titre"]);
    expect(adaptateurMonteurAvocat({ motion: false }).typesSupportes).toEqual(["multicamera", "zoom"]);
  });
  it("exemples : dans l'ordre du catalogue, bornés par max", () => {
    const a = adaptateurMonteurAvocat({ motion: true });
    expect(a.exemples()).toEqual(["Fais-le en 3 caméras", "Zoome quand je dis « licenciement »", "Mets une carte avec le chiffre 32 %", "Fais les animations en spectaculaire", "Mets le titre « Vos droits au travail »"]);
    expect(a.exemples(2)).toEqual(["Fais-le en 3 caméras", "Zoome quand je dis « licenciement »"]);
  });
  it("reglesFixes de l'adaptateur = reglesFixesAvocat avec le même réglage de motion", () => {
    const cs = [consigne("a", "Mets une carte avec le chiffre 32 %")];
    expect(adaptateurMonteurAvocat({ motion: false }).reglesFixes(cs)).toEqual(reglesFixesAvocat(cs, false));
    expect(adaptateurMonteurAvocat({ motion: true }).reglesFixes(cs)).toEqual(reglesFixesAvocat(cs, true));
  });
  it("lireReponse et schéma : une réponse vide mais valide est lue", () => {
    const a = adaptateurMonteurAvocat();
    expect(schemaReponseMonteurAvocat.safeParse({ reponse: "ok", operations: [], consignes: [] }).success).toBe(true);
    expect(a.lireReponse(null)).toBeNull();
    expect(a.lireReponse("texte")).toBeNull();
    const lue = a.lireReponse({ reponse: "ok", operations: [{ type: "zoom", debutMot: 1, finMot: 2, style: "punch-in", cible: "visage" }, { type: "inconnu" }], consignes: [] });
    expect(lue?.operations).toEqual([{ type: "zoom", debutMot: 1, finMot: 2, style: "punch-in", cible: "visage" }]);
    expect(lue?.ecartees).toHaveLength(1);
  });
});

describe("optionMonteurAvocat", () => {
  const cmd = (entrees: unknown) => ({ entrees }) as unknown as Pick<CommandeFabrication, "entrees">;
  it("sans entrée, entrée non objet ou consignes vides : null", () => {
    expect(optionMonteurAvocat(cmd(undefined))).toBeNull();
    expect(optionMonteurAvocat(cmd({}))).toBeNull();
    expect(optionMonteurAvocat(cmd({ avocatMonteur: "texte" }))).toBeNull();
    expect(optionMonteurAvocat(cmd({ avocatMonteur: { consignes: [] } }))).toBeNull();
    expect(optionMonteurAvocat(cmd({ avocatMonteur: { consignes: [{ texte: "  " }] } }))).toBeNull();
  });
  it("consigne valide : lue avec origine « ecrite » et id généré", () => {
    expect(optionMonteurAvocat(cmd({ avocatMonteur: { consignes: [{ texte: " Zoome ici " }] } }))).toEqual({ consignes: [{ id: "c-1", origine: "ecrite", texte: "Zoome ici" }] });
  });
});

describe("appliquerZoomsAvocat", () => {
  const plan = (ordre: number, sourceImage: string, zoom = 1): PlanProduit => ({ ordre, sourceImage, cadrage: { valeur: "large", zoom } }) as unknown as PlanProduit;
  it("liste d'ordres vide : renvoie la même liste, intacte", () => {
    const plans = [plan(0, "double")];
    expect(appliquerZoomsAvocat(plans, [])).toBe(plans);
  });
  it("ordre ciblé sur un plan « double » : poitrine, zoom et zoomFin à 1,15 ; l'entrée n'est pas mutée", () => {
    const plans = [plan(0, "double"), plan(1, "double")];
    const avant = JSON.parse(JSON.stringify(plans));
    const sortie = appliquerZoomsAvocat(plans, [1]);
    expect(sortie[0]).toBe(plans[0]);
    expect(sortie[1].cadrage).toEqual({ valeur: "poitrine", zoom: 1.15, zoomFin: 1.15 });
    expect(plans).toEqual(avant);
  });
  it("garde un zoom déjà plus fort", () => {
    const [p] = appliquerZoomsAvocat([plan(0, "double", 1.4)], [0]);
    expect(p.cadrage).toMatchObject({ valeur: "poitrine", zoom: 1.4, zoomFin: 1.4 });
  });
  it("ordres hors bornes : plans inchangés (valeurs égales)", () => {
    const plans = [plan(0, "double")];
    expect(appliquerZoomsAvocat(plans, [7, -1])).toEqual(plans);
  });
  it("plan qui n'est pas le double (illustration) : jamais zoomé", () => {
    const plans = [plan(0, "illustration")];
    expect(appliquerZoomsAvocat(plans, [0])[0].cadrage).toEqual({ valeur: "large", zoom: 1 });
  });
});
