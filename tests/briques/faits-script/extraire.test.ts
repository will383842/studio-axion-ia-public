import { describe, expect, it } from "vitest";
import { faitsDuScript, familleUnite, recoller, type Fait, type MotFait } from "../../../src/briques/faits-script";
import { DIX_SCRIPTS, motsHorodates } from "./dix-scripts";

function faits(i: number): { mots: MotFait[]; faits: Fait[] } {
  const mots = motsHorodates(DIX_SCRIPTS[i - 1] as string);
  return { mots, faits: faitsDuScript(mots) };
}
function de<T extends Fait["type"]>(l: Fait[], type: T): Extract<Fait, { type: T }>[] {
  return l.filter((f): f is Extract<Fait, { type: T }> => f.type === type);
}

describe("faits du script : les dix scripts de contrôle", () => {
  it("script 1 : un passage 2 h → 20 min et des étapes trier / répondre / classer", () => {
    const { faits: l } = faits(1);
    const p = de(l, "passage");
    expect(p).toHaveLength(1);
    expect(p[0]?.avant).toMatchObject({ valeur: 2, unite: "h" });
    expect(p[0]?.apres).toMatchObject({ valeur: 20, unite: "min" });
    const e = de(l, "etapes");
    expect(e).toHaveLength(1);
    expect(e[0]?.elements.map((x) => x.texte)).toEqual(["trier", "répondre", "classer"]);
    expect(de(l, "liste")).toHaveLength(0);
  });

  it("script 2 : un nombre 40 % et une comparaison débordé / organisé", () => {
    const { faits: l } = faits(2);
    expect(de(l, "nombre").some((n) => n.valeur === 40 && n.unite === "%")).toBe(true);
    const c = de(l, "comparaison");
    expect(c).toHaveLength(1);
    expect(c[0]?.gauche.texte).toBe("un artisan débordé");
    expect(c[0]?.droite.texte).toBe("un artisan organisé");
    expect(de(l, "nombre").some((n) => n.unite === undefined && n.valeur === 2)).toBe(false);
  });

  it("script 3 : une citation qui commence à « je n'ai pas le temps »", () => {
    const { faits: l } = faits(3);
    const c = de(l, "citation");
    expect(c).toHaveLength(1);
    expect(c[0]?.texte.startsWith("je n'ai pas le temps")).toBe(true);
  });

  it("script 4 : une liste annoncée 4 avec quatre éléments", () => {
    const { faits: l } = faits(4);
    const li = de(l, "liste");
    expect(li).toHaveLength(1);
    expect(li[0]?.annonce).toBe(4);
    expect(li[0]?.elements.map((x) => x.texte)).toEqual(["pas de photos", "pas d'horaires", "aucun avis", "aucune réponse"]);
    expect(de(l, "nombre")).toHaveLength(0);
  });

  it("script 5 : un lieu Lyon, 30 %, trois mois, et aucun passage", () => {
    const { faits: l } = faits(5);
    expect(de(l, "lieu").map((x) => x.nom)).toEqual(["Lyon"]);
    expect(de(l, "nombre").some((n) => n.valeur === 30 && n.unite === "%")).toBe(true);
    const d = de(l, "duree");
    expect(d.some((x) => x.valeur === 3 && x.unite === "mois" && x.texte === "trois mois")).toBe(true);
    expect(de(l, "passage")).toHaveLength(0);
  });

  it("script 6 : rien de montrable", () => {
    expect(faits(6).faits.filter((f) => f.type !== "duree")).toEqual([]);
  });

  it("script 7 : une question, aucun nombre pour 2026, un nombre 5 min", () => {
    const { faits: l } = faits(7);
    expect(de(l, "question").some((q) => q.texte.startsWith("Faut-il un site internet"))).toBe(true);
    expect(de(l, "nombre").some((n) => n.valeur === 2026)).toBe(false);
    expect(de(l, "nombre").some((n) => n.valeur === 5 && n.unite === "min")).toBe(true);
    expect(de(l, "duree")).toHaveLength(0);
  });

  it("script 8 : une comparaison sur deux phrases ; « une fois par mois » ne donne aucun nombre", () => {
    const { faits: l } = faits(8);
    const c = de(l, "comparaison");
    expect(c).toHaveLength(1);
    expect(c[0]?.gauche.texte).toBe("le bouche à oreille");
    expect(c[0]?.droite.texte).toBe("la publicité");
    expect(de(l, "nombre")).toHaveLength(0);
  });

  it("script 9 : une liste de 3 questions annoncée 3", () => {
    const li = de(faits(9).faits, "liste");
    expect(li).toHaveLength(1);
    expect(li[0]?.annonce).toBe(3);
    expect(li[0]?.elements.map((x) => x.texte)).toEqual(["qui fait le travail", "combien de temps ça dure", "comment on arrête"]);
  });

  it("script 10 : aucun nombre, aucun passage", () => {
    const l = faits(10).faits;
    expect(de(l, "nombre")).toHaveLength(0);
    expect(de(l, "passage")).toHaveLength(0);
  });

  it("pour chaque fait : texte = mots premier..dernier, surMot dans l'intervalle, ordre croissant", () => {
    for (let i = 1; i <= 10; i++) {
      const { mots, faits: l } = faits(i);
      let precedent = -1;
      for (const f of l) {
        const { premier, dernier } = f.mots;
        expect(premier).toBeGreaterThanOrEqual(0);
        expect(dernier).toBeLessThan(mots.length);
        expect(dernier).toBeGreaterThanOrEqual(premier);
        expect(f.texte).toBe(recoller(mots, premier, dernier));
        const surMots: number[] = [];
        if ("surMot" in f) surMots.push(f.surMot);
        if (f.type === "passage") surMots.push(f.avant.surMot, f.apres.surMot);
        if (f.type === "liste" || f.type === "etapes") surMots.push(...f.elements.map((x) => x.surMot));
        if (f.type === "comparaison") surMots.push(f.gauche.surMot, f.droite.surMot);
        for (const s of surMots) {
          expect(s).toBeGreaterThanOrEqual(premier);
          expect(s).toBeLessThanOrEqual(dernier);
        }
        expect(premier).toBeGreaterThanOrEqual(precedent);
        precedent = premier;
      }
    }
  });

  it("même entrée, même sortie", () => {
    for (let i = 1; i <= 10; i++) {
      const mots = motsHorodates(DIX_SCRIPTS[i - 1] as string);
      expect(faitsDuScript(mots)).toEqual(faitsDuScript(mots));
    }
  });
});

describe("faits du script : cas particuliers", () => {
  const f = (s: string) => faitsDuScript(motsHorodates(s));
  it("l'unité est lue sur le mot brut : 40%, 40 %, quarante pour cent, 40 pourcent", () => {
    for (const s of ["Il gagne 40% de plus.", "Il gagne 40 % de plus.", "Il gagne quarante pour cent de plus.", "Il gagne 40 pourcent de plus."]) {
      const n = f(s).filter((x) => x.type === "nombre");
      expect(n, s).toHaveLength(1);
      expect(n[0]).toMatchObject({ valeur: 40, unite: "%" });
    }
  });
  it("les nombres avec espace et virgule : 10 000 clients, 2,5 heures", () => {
    expect(f("Nous avons 10 000 clients.")[0]).toMatchObject({ type: "nombre", valeur: 10000, unite: "clients" });
    expect(f("Comptez 2,5 heures.")[0]).toMatchObject({ type: "nombre", valeur: 2.5, unite: "h" });
  });
  it("de 12 à 3 heures : un passage, l'unité du premier nombre est reprise", () => {
    const p = f("On passe de 12 à 3 heures.").filter((x) => x.type === "passage");
    expect(p).toHaveLength(1);
    expect(p[0]).toMatchObject({ avant: { valeur: 12, unite: "h" }, apres: { valeur: 3, unite: "h" } });
  });
  it("de 40 % à 10 % : un passage ; de 30 % à 3 mois : aucun passage", () => {
    expect(f("De 40 % à 10 % en un mois.").filter((x) => x.type === "passage")).toHaveLength(1);
    expect(f("On passe de 30 % à 3 mois.").filter((x) => x.type === "passage")).toHaveLength(0);
  });
  it("une année seule n'est pas un nombre ; chaque lundi est une durée sans valeur", () => {
    expect(f("En 2026, tout change.").filter((x) => x.type === "nombre")).toHaveLength(0);
    const d = f("Appelez chaque lundi matin.").filter((x) => x.type === "duree");
    expect(d).toHaveLength(1);
    expect(d[0]).toMatchObject({ repere: "chaque lundi" });
    expect(d[0] && "valeur" in d[0] && d[0].valeur).toBeFalsy();
  });
  it("lieu insensible à la casse de la préposition ; citation entre guillemets", () => {
    expect(f("À Lyon, c'est ouvert.").some((x) => x.type === "lieu" && x.nom === "Lyon")).toBe(true);
    expect(f("Il vit dans Saint-Étienne depuis longtemps.").some((x) => x.type === "lieu" && x.nom === "Saint-Étienne")).toBe(true);
    const c = f("Elle dit « je reste ici ». Fin.").filter((x) => x.type === "citation");
    expect(c).toHaveLength(1);
    expect(c[0]?.texte).toBe("je reste ici");
  });
  it("comparaisons : contrairement à, d'un côté sur la même phrase", () => {
    const a = f("Contrairement à la pub, le bouche à oreille est gratuit.").filter((x) => x.type === "comparaison");
    expect(a).toHaveLength(1);
    expect(a[0]).toMatchObject({ gauche: { texte: "la pub" } });
    const b = f("D'un côté le prix, de l'autre la qualité.").filter((x) => x.type === "comparaison");
    expect(b[0]).toMatchObject({ gauche: { texte: "le prix" }, droite: { texte: "la qualité" } });
  });
  it("familleUnite", () => {
    expect([familleUnite("h"), familleUnite("mois"), familleUnite("%"), familleUnite("€"), familleUnite("clients"), familleUnite("fois"), familleUnite("couverts")]).toEqual(["duree", "duree", "pourcent", "argent", "clients", "fois", null]);
  });
  it("entrée vide ou sans mot montrable", () => {
    expect(faitsDuScript([])).toEqual([]);
  });
});
