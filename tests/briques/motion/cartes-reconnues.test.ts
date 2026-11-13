/**
 * GV2-44 : face caméra, reconnaître ce que le script donne (pourcentages, liste annoncée, « d'un côté / de l'autre »,
 * étapes, lieu en tête de phrase). Les dix scripts de contrôle passés à `planifierCartesAuto`.
 */
import { describe, expect, it } from "vitest";
import { DIX_SCRIPTS, motsHorodates } from "../faits-script/dix-scripts";
import { choisirModele } from "@/briques/motion/choix";
import { choisirModeleTous } from "@/briques/motion/choix-etendu";
import { planifierCartesAuto, type MotCarte } from "@/briques/habillage-facecam/cartes-auto";

/** Parole posée à un rythme de lecture posé (600 ms par mot) : assez d'air pour que plusieurs cartes tiennent. */
const PAS_MS = 600;
const motsDe = (texte: string): MotCarte[] => motsHorodates(texte, PAS_MS).map((m) => ({ mot: m.texte, debutSec: m.debutMs / 1000, finSec: m.finMs / 1000 }));
const cartesDe = (texte: string) => {
  const mots = motsDe(texte);
  return planifierCartesAuto(mots, Math.ceil(mots[mots.length - 1].finSec + 30)).map((c) => c.carte);
};
/** Raisons des cartes posées par les nouveaux détecteurs de cette fiche (les règles générales ont leurs propres raisons). */
const raisonsDe = (texte: string) => {
  const mots = motsDe(texte);
  return planifierCartesAuto(mots, Math.ceil(mots[mots.length - 1].finSec + 30)).map((c) => c.raison);
};
const parScript = DIX_SCRIPTS.map((s) => cartesDe(s));

/** Familles d'unités (reprise de GV2-40) : un avant / après ne mélange pas des unités de familles différentes. */
const FAMILLES: Record<string, string> = { h: "d", min: "d", s: "d", jours: "d", semaines: "d", mois: "d", ans: "d", "%": "p", "€": "a", clients: "c", fois: "f" };
const jetons = (t: string) => t.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[’]/g, "'").split(/[^a-z0-9]+/).filter(Boolean);

describe("GV2-44 · les dix scripts de contrôle", () => {
  it("au moins 7 scripts sur 10 reçoivent au moins une carte", () => {
    expect(parScript.filter((c) => c.length > 0).length).toBeGreaterThanOrEqual(7);
  });
  it("au moins 6 modèles distincts sur l'ensemble", () => {
    expect(new Set(parScript.flat().map((c) => c.modele)).size).toBeGreaterThanOrEqual(6);
  });
  it("script 2 : une carte chiffre 40 %", () => {
    const c = parScript[1].find((x) => x.modele === "chiffre");
    expect(c?.donnees).toMatchObject({ valeur: 40, unite: "%" });
  });
  it("script 4 : une carte liste à 4 éléments exacts", () => {
    const c = parScript[3].find((x) => x.modele === "liste");
    const textes = (c?.donnees as { elements: { texte: string }[] }).elements.map((e) => e.texte.toLowerCase());
    expect(textes).toEqual(["pas de photos", "pas d'horaires", "aucun avis", "aucune réponse"]);
  });
  it("script 9 : trois questions, le « et » de la fin n'est pas dans l'élément", () => {
    const c = parScript[8].find((x) => x.modele === "liste");
    const textes = (c?.donnees as { elements: { texte: string }[] }).elements.map((e) => e.texte.toLowerCase());
    expect(textes).toEqual(["qui fait le travail", "combien de temps ça dure", "comment on arrête"]);
  });
  it("script 8 : une deux-colonnes « le bouche à oreille » / « la publicité »", () => {
    const c = parScript[7].find((x) => x.modele === "deux-colonnes");
    const d = c!.donnees as { gauche: { titre: string; points: string[] }; droite: { titre: string; points: string[] } };
    expect(d.gauche.titre.toLowerCase()).toBe("le bouche à oreille");
    expect(d.droite.titre.toLowerCase()).toBe("la publicité");
    expect(d.gauche.points.map((p) => p.toLowerCase())).toEqual(["lent", "solide"]);
    expect(d.droite.points.map((p) => p.toLowerCase())).toEqual(["rapide", "chère"]);
  });
  it("script 1 : une ligne-de-temps trier / répondre / classer", () => {
    const c = parScript[0].find((x) => x.modele === "ligne-de-temps");
    const etapes = (c?.donnees as { etapes: { titre: string }[] }).etapes.map((e) => e.titre.toLowerCase());
    expect(etapes).toEqual(["trier", "répondre", "classer"]);
  });
  it("script 5 : « À Lyon » en tête de phrase est un lieu", () => {
    expect(choisirModeleTous(DIX_SCRIPTS[4].split(/(?<=[.?!])\s+/)[0])?.carte).toMatchObject({ modele: "documentaire", donnees: { lieu: "Lyon" } });
  });
});

describe("GV2-44 · pourcentages", () => {
  const carte40 = (t: string) => cartesDe(t).find((c) => c.modele === "chiffre");
  const cle = (t: string) => {
    const d = carte40(t)?.donnees as { valeur: number; unite: string; libelle: string; surTitre?: string } | undefined;
    return d && { valeur: d.valeur, unite: d.unite, libelle: d.libelle, surTitre: d.surTitre };
  };
  const base = "Un artisan sur deux ne rappelle jamais ses prospects. Résultat : ";
  it("« quarante pour cent des devis » et « 40% des devis » donnent la même carte", () => {
    const a = cle(`${base}quarante pour cent des devis partent chez le concurrent.`);
    expect(a).toMatchObject({ valeur: 40, unite: "%", libelle: "des devis partent chez le concurrent" });
    expect(cle(`${base}40% des devis partent chez le concurrent.`)).toEqual(a);
    expect(cle(`${base}40 % des devis partent chez le concurrent.`)).toEqual(a);
    expect(cle(`${base}40 pour cent des devis partent chez le concurrent.`)).toEqual(a);
    expect(cle(`${base}quarante pourcent des devis partent chez le concurrent.`)).toEqual(a);
  });
  it("une virgule décimale reste une virgule décimale (« 2,5 heures » n'est pas 25 heures)", () => {
    expect(carte40("Cela prend 2,5 heures chaque semaine pour tout vérifier à la main.")?.donnees).toMatchObject({ valeur: 2.5, unite: "h" });
  });
});

describe("GV2-44 · pas de carte fausse", () => {
  it("liste annoncée : le nombre de morceaux doit égaler le nombre annoncé", () => {
    expect(raisonsDe("Les 3 erreurs qui ruinent votre fiche : pas de photos, pas d'horaires, aucun avis, aucune réponse. Corrigez-les.")).not.toContain("une liste annoncée par un nombre");
    expect(raisonsDe("Les 4 erreurs qui ruinent votre fiche : pas de photos, pas d'horaires, aucun avis, aucune réponse. Corrigez-les.")).toContain("une liste annoncée par un nombre");
  });
  it("« d'abord … ensuite » avec deux marqueurs seulement : pas de ligne-de-temps", () => {
    expect(raisonsDe("Il faut d'abord trier vos mails, ensuite répondre à ceux qui comptent vraiment.")).not.toContain("des étapes dites dans l'ordre");
    expect(raisonsDe("Il faut d'abord trier vos mails, ensuite répondre à ceux qui comptent, enfin tout classer.")).toContain("des étapes dites dans l'ordre");
  });
  it("« d'un côté » sans « de l'autre » : pas de deux-colonnes", () => {
    expect(raisonsDe("D'un côté, le bouche à oreille, lent mais solide. Entre les deux, il y a vos anciens clients.")).not.toContain("deux côtés opposés");
  });
  it("« d'un côté / de l'autre » dans une seule phrase", () => {
    const c = cartesDe("D'un côté, le bouche à oreille, de l'autre, la publicité, avec vos anciens clients au milieu.").find((x) => x.modele === "deux-colonnes");
    expect(c?.donnees).toMatchObject({ gauche: { titre: "Le bouche à oreille" }, droite: { titre: "La publicité" } });
  });
  it.each(DIX_SCRIPTS.map((s, i) => [i + 1, s] as const))("script %i : les vérifications de GV2-40 sur ces sorties", (_i, texte) => {
    const phrases = texte.split(/(?<=[.?!])\s+/);
    const cartes = [...cartesDe(texte), ...phrases.flatMap((p) => [choisirModele(p)?.carte, choisirModeleTous(p)?.carte]).filter((c) => !!c)];
    for (const c of cartes) {
      if (c!.modele === "avant-apres") {
        const d = c!.donnees as { avant: { unite: string }; apres: { unite: string } };
        expect(FAMILLES[d.avant.unite] ?? d.avant.unite).toBe(FAMILLES[d.apres.unite] ?? d.apres.unite);
      }
      if (c!.modele === "icone-mot") expect((c!.donnees as { surTitre: string }).surTitre.trim()).not.toMatch(/^pas$/i);
      if (c!.modele === "probleme-solution") expect(c!.donnees).not.toHaveProperty("etiquetteSolution");
    }
  });
});

describe("GV2-44 · tout texte posé est fait de mots dits", () => {
  /** Textes affichés d'une carte (hors icônes, valeurs, unités et réglages). */
  const textesDe = (donnees: unknown, cle = ""): string[] => {
    if (typeof donnees === "string") return ["titre", "surTitre", "libelle", "mot", "texte", "points", "lieu", "motCle", "probleme", "solution"].includes(cle) ? [donnees] : [];
    if (Array.isArray(donnees)) return donnees.flatMap((x) => textesDe(x, cle));
    if (donnees && typeof donnees === "object") return Object.entries(donnees).flatMap(([k, v]) => textesDe(v, k));
    return [];
  };
  it.each(DIX_SCRIPTS.map((s, i) => [i + 1, s] as const))("script %i", (_i, texte) => {
    const dits = new Set(jetons(texte));
    for (const c of cartesDe(texte)) for (const t of textesDe(c.donnees)) for (const j of jetons(t)) expect(dits.has(j), `« ${j} » (carte ${c.modele}) n'est pas dit`).toBe(true);
  });
});

describe("GV2-44 · lieu en tête de phrase", () => {
  it.each([
    ["À Lyon, un restaurant de quarante couverts a réduit son gaspillage de 30 % en trois mois.", "Lyon"],
    ["Au Mans, un garage a gagné 12 clients en deux mois.", "Mans"],
  ])("« %s »", (t, lieu) => {
    expect(choisirModeleTous(t)?.carte).toMatchObject({ modele: "documentaire", donnees: { lieu } });
  });
  it("« à » minuscule garde son sens, et un mot qui n'est pas un nom propre n'est pas un lieu", () => {
    expect(choisirModeleTous("Un restaurant à Lyon a réduit son gaspillage de 30 % en trois mois.")?.carte).toMatchObject({ donnees: { lieu: "Lyon" } });
    expect(choisirModeleTous("À mon avis, un restaurant a réduit son gaspillage de 30 % en trois mois.")?.modele).not.toBe("documentaire");
  });
});
