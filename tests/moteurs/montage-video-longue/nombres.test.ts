import { describe, expect, it } from "vitest";
import { formaterNombre, nombresEcrits, uniteApres } from "../../../src/moteurs/montage-video-longue/nombres";

const valeurs = (t: string) => nombresEcrits(t).map((n) => n.valeur);

describe("nombresEcrits : nombres en lettres", () => {
  const table: [string, number][] = [
    ["zéro", 0],
    ["deux", 2],
    ["trois", 3],
    ["sept", 7],
    ["onze", 11],
    ["douze", 12],
    ["seize", 16],
    ["dix-sept", 17],
    ["dix-neuf", 19],
    ["vingt", 20],
    ["vingt-deux", 22],
    ["vingt et un", 21],
    ["vingt-et-un", 21],
    ["trente", 30],
    ["quarante-cinq", 45],
    ["cinquante", 50],
    ["soixante", 60],
    ["soixante et onze", 71],
    ["soixante-dix", 70],
    ["soixante-quinze", 75],
    ["quatre-vingts", 80],
    ["quatre-vingt-un", 81],
    ["quatre-vingt-dix", 90],
    ["quatre-vingt-dix-neuf", 99],
    ["cent", 100],
    ["cent un", 101],
    ["deux cents", 200],
    ["trois cent cinquante", 350],
    ["mille", 1000],
    ["trois mille", 3000],
    ["trois mille cinq cents", 3500],
    ["deux mille vingt-quatre", 2024],
    ["un million deux", 2],
    ["deux millions", 2_000_000],
    ["trois milliards", 3_000_000_000],
  ];
  it.each(table)("« %s » = %d", (texte, v) => {
    expect(valeurs(`Il y a ${texte} cas.`)).toEqual([v]);
  });

  it("garde le nombre tel qu'écrit et l'affiche en chiffres français", () => {
    const [n] = nombresEcrits("Un clic montre douze mois, puis trois mille cinq cents lignes.");
    expect(n.ecrit).toBe("douze");
    expect(n.affiche).toBe("12");
    const [, m] = nombresEcrits("Un clic montre douze mois, puis trois mille cinq cents lignes.");
    expect(m.ecrit).toBe("trois mille cinq cents");
    expect(m.affiche).toBe("3 500");
  });

  it("deux nombres collés par une virgule restent deux nombres", () => {
    expect(valeurs("Trois, quatre articles, puis cinq.")).toEqual([3, 4, 5]);
    expect(valeurs("Deux trois fois.")).toEqual([2, 3]);
  });
});

describe("nombresEcrits : exclusions", () => {
  it("« un » et « une » ne sont jamais des chiffres", () => {
    expect(nombresEcrits("Une journée entière. Un client appelle. Il y a une rupture.")).toEqual([]);
    expect(nombresEcrits("Un million de clients")).toEqual([]);
  });
  it("une journée n'est pas 1", () => {
    expect(valeurs("quelqu'un passe une journée entière à compter")).toEqual([]);
  });
  it("ni ordinaux, ni approximations", () => {
    expect(nombresEcrits("Le premier, le deuxième, une dizaine d'articles, la moitié du stock, un tiers.")).toEqual([]);
  });
  it("« tous les deux » n'est pas une quantité", () => {
    expect(nombresEcrits("Les deux outils servent, tous les deux, à compter.").map((n) => n.ecrit)).toEqual(["deux"]);
  });
  it("« neuf » adjectif est ignoré, « neuf » quantité compte", () => {
    expect(nombresEcrits("Un outil neuf arrive.")).toEqual([]);
    expect(valeurs("Il reste neuf articles.")).toEqual([]);
    expect(valeurs("Il reste les neuf articles.")).toEqual([9]);
  });
  it("aucun nombre dans un texte sans nombre", () => {
    expect(nombresEcrits("Le tableau de bord lit chaque vente et chaque livraison.")).toEqual([]);
  });
  it("« mille » dans un mot n'est pas un nombre", () => {
    expect(nombresEcrits("famille, millésime, centre, sixième")).toEqual([]);
  });
});

describe("nombresEcrits : chiffres", () => {
  it("entiers, milliers, décimales, unités", () => {
    expect(nombresEcrits("42 % des 1 200 articles").map((n) => [n.ecrit, n.valeur, n.affiche])).toEqual([
      ["42 %", 42, "42 %"],
      ["1 200", 1200, "1 200"],
    ]);
    expect(nombresEcrits("Un gain de 12,5 % et 3 h.").map((n) => [n.ecrit, n.valeur])).toEqual([
      ["12,5 %", 12.5],
      ["3 h", 3],
    ]);
    expect(nombresEcrits("150 €").map((n) => n.valeur)).toEqual([150]);
  });
  it("l'espace insécable est normalisée à l'affichage", () => {
    const [n] = nombresEcrits("1 200 articles");
    expect(n.valeur).toBe(1200);
    expect(n.affiche).toBe("1 200");
  });
  it("une lettre collée n'est pas une unité", () => {
    expect(nombresEcrits("10 heures et 5 s'est").map((n) => n.ecrit)).toEqual(["10", "5"]);
  });
  it("résultats triés par position, positions exactes", () => {
    const t = "Vingt articles puis 12 mois.";
    const r = nombresEcrits(t);
    expect(r.map((n) => t.slice(n.debut, n.fin))).toEqual(["Vingt", "12"]);
  });
});

describe("formaterNombre et uniteApres", () => {
  it("formate à la française", () => {
    expect(formaterNombre(12)).toBe("12");
    expect(formaterNombre(1200)).toBe("1 200");
    expect(formaterNombre(1_000_000)).toBe("1 000 000");
    expect(formaterNombre(12.5)).toBe("12,5");
  });
  it("l'unité : 1 à 3 mots jusqu'à une ponctuation ou un mot de liaison", () => {
    const t = "Un clic montre son historique sur douze mois.";
    const [n] = nombresEcrits(t);
    expect(uniteApres(t, n.fin)).toBe("mois");
    const t2 = "Vous suivez vingt articles qui se vendent le plus.";
    expect(uniteApres(t2, nombresEcrits(t2)[0].fin)).toBe("articles");
    const t3 = "Il y a trois, quatre cas.";
    expect(uniteApres(t3, nombresEcrits(t3)[0].fin)).toBe("");
    const t4 = "Il y a deux fois de trop.";
    expect(uniteApres(t4, nombresEcrits(t4)[0].fin)).toBe("fois");
  });
});

describe("QUALL-8 : pour cent, ordinaux, décimales, heures, formules", () => {
  const vus = (t: string) => nombresEcrits(t).map((n) => [n.valeur, n.affiche]);
  it("« cinq pour cent » = 5 % (un seul chiffre) ; jamais un 100 tiré de « pour cent »", () => {
    expect(vus("Cinq pour cent des clients.")).toEqual([[5, "5 %"]]);
    expect(vus("cinq %")).toEqual([[5, "5 %"]]);
    expect(vus("5 pour cent des clients")).toEqual([[5, "5 %"]]);
    expect(vus("Le pour cent.")).toEqual([]);
    expect(vus("Un gain de cent pour cent.")).toEqual([]);
  });
  it("ordinaux exclus : 3e, 2nd, 1er, 2ème", () => {
    expect(nombresEcrits("Le 3e client, le 2nd, le 1er, la 4ème, la 1re.")).toEqual([]);
  });
  it("décimales : « 3.5 » et « 3,5 » entiers, affichés avec la virgule ; une date n'est pas un nombre", () => {
    expect(vus("Il vaut 3.5 euros et 3,5 aussi.")).toEqual([[3.5, "3,5"], [3.5, "3,5"]]);
    expect(nombresEcrits("Le 12.05.2024 et 1.200 pièces.")).toEqual([]);
  });
  it("heures : « 10h30 » → « 10 h 30 », jamais 10 seul", () => {
    expect(vus("À 10h30 et à 10 h 30.")).toEqual([[10.5, "10 h 30"], [10.5, "10 h 30"]]);
  });
  it("formules et noms propres : pas de chiffre", () => {
    expect(nombresEcrits("Mille fois merci.")).toEqual([]);
    expect(nombresEcrits("Dans les Deux-Sèvres.")).toEqual([]);
    expect(nombresEcrits("Deux ou trois articles, 2 ou 3 jours.")).toEqual([]);
    expect(valeurs("Mille clients.")).toEqual([1000]);
  });
});
