/** Script fourni : aller-retour sur tous les cas (le texte tiré du gabarit redonne une fiche conforme, mêmes phrases). */
import { describe, expect, it } from "vitest";
import { CATALOGUE } from "@/formats/cas-concret/catalogue";
import { dureesDesFins, ficheParGabarit } from "@/moteurs/montage-cas-concret/ecriture";
import { bornesDesFins, controlerTexteFourni, texteFourniDesEcrans } from "@/moteurs/montage-cas-concret/script-fourni";
import { validerFicheEcrans } from "@/moteurs/montage-cas-concret/regles";

const FIXE = { videoId: "v", versionId: "v", habillage: "charte-duo/1", origine: "porte-a" } as const;

describe("aller-retour sur les cas", () => {
  it("chaque cas dont le gabarit est conforme : le texte tiré du gabarit est conforme, avec les mêmes phrases", () => {
    const echecs: string[] = [];
    const ignores: string[] = [];
    const couverts = { sansRecit: 0, chiffre: 0, preuve: 0 };
    let n = 0;
    for (const cas of CATALOGUE) {
      // Le gabarit avec les fins connues, jugé avec la fin la plus courte comme avec la plus longue.
      const b = bornesDesFins(cas);
      const g = ficheParGabarit(cas, FIXE, dureesDesFins([b.courte, b.longue]));
      const texteScript = g.ecrans.map((e) => e.texteDit).join(" ");
      if (!validerFicheEcrans(g, { cas, texteScript, fins: [b.courte] }).ok || !validerFicheEcrans(g, { cas, texteScript }).ok) {
        ignores.push(cas.id);
        continue;
      }
      n++;
      if (!cas.recit) couverts.sansRecit++;
      if (g.ecrans.some((e) => e.type === "chiffre")) couverts.chiffre++;
      if (g.ecrans.some((e) => e.type === "preuve")) couverts.preuve++;
      const texte = texteFourniDesEcrans(g.ecrans, cas);
      const r = controlerTexteFourni(texte, cas, { motsInterdits: [] });
      if (!r.ok) echecs.push(`${cas.id} : ${r.refus.map((x) => x.message).join(" | ").slice(0, 400)}`);
      else if (JSON.stringify(r.ecrans.map((e) => e.texteDit)) !== JSON.stringify(g.ecrans.map((e) => e.texteDit))) echecs.push(`${cas.id} : phrases différentes`);
    }
    // Les 118 cas (22 du catalogue, 96 du stock) ont un gabarit conforme : aucun n'est ignoré.
    expect(ignores, `cas ignorés : ${ignores.join(", ")}`).toEqual([]);
    expect(n).toBe(CATALOGUE.length);
    expect(n).toBe(118);
    // La couverture : des cas sans récit (catalogue), des cas avec un chiffre, des cas avec une preuve.
    expect(couverts.sansRecit).toBe(22);
    expect(couverts.chiffre).toBeGreaterThan(0);
    expect(couverts.preuve).toBeGreaterThan(0);
    expect(echecs, echecs.join("\n")).toEqual([]);
  });
});

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { trouverCas } from "@/formats/cas-concret/catalogue";

const LT02 = trouverCas("transporteur-demandes-de-cotation")!;
const bornes = bornesDesFins(LT02);
const gabaritLT02 = ficheParGabarit(LT02, FIXE, dureesDesFins([bornes.courte, bornes.longue]));
const BASE = texteFourniDesEcrans(gabaritLT02.ecrans, LT02);
const lignesBase = () => BASE.split("\n");
const sansEtiquette = (t: string) => t.split("\n").map((l) => l.replace(/^\[[^\]]+\]\s*/, "")).join("\n");
const refusDe = (texte: string, options?: { motsInterdits?: string[] }) => {
  const r = controlerTexteFourni(texte, LT02, options);
  return r.ok ? [] : r.refus.map((x) => x.message);
};

describe("un script d'un cas du stock", () => {
  it("le texte tiré du gabarit est conforme", () => {
    expect(refusDe(BASE)).toEqual([]);
  });

  it("un script SANS aucune étiquette est lu par les règles fixes et conforme (accroche, avant, bascule, 5 étapes, partie humaine, résultat, question)", () => {
    const texte = [
      "Vos demandes de prix arrivent sans le poids.",
      "Avant : un client écrit, il lui faut un camion la semaine prochaine.",
      "Avant, votre exploitant recopie, rappelle, attend. La demande dort dans la pile.",
      "Voici ce que devient cette demande.",
      "La demande de ce client est enregistrée au même endroit, d'où qu'elle vienne.",
      "L'automatisation voit ce qui manque : le poids et l'adresse.",
      "Le client reçoit aussitôt un message court qui les réclame.",
      "Il répond ; la demande complète arrive chez votre équipe.",
      "Fixer le prix et accepter ou non le transport.",
      "La demande attend alors votre exploitant sur son téléphone.",
      "Résultat : plus personne ne rappelle pour un poids, votre équipe chiffre des demandes complètes.",
      "Et chez vous, combien de demandes de prix arrivent sans le poids ?",
    ].join("\n");
    const r = controlerTexteFourni(texte, LT02);
    expect(r.ok, r.ok ? "" : r.refus.map((x) => x.message).join(" | ")).toBe(true);
    if (r.ok) expect(r.lignes.map((l) => l.forme)).toEqual(["accroche", "avant", "avant", "bascule", "etape", "etape", "etape", "etape", "humain", "etape", "resultat", "question"]);
  });

  it("déterministe : deux appels, même sortie", () => {
    expect(JSON.stringify(controlerTexteFourni(BASE, LT02))).toBe(JSON.stringify(controlerTexteFourni(BASE, LT02)));
  });

  it("le module n'appelle jamais Claude (ni appels, ni rôles, ni fetch dans la source)", () => {
    const src = readFileSync(join(__dirname, "../../../src/moteurs/montage-cas-concret/script-fourni.ts"), "utf8");
    for (const interdit of [/from "\.\/appels"/, /from "\.\/roles/, /\bfetch\(/, /anthropic/i, /executer\(/]) expect(src).not.toMatch(interdit);
  });
});

describe("refus, en « Ligne N : … » avec le geste à faire", () => {
  it("accroche de 10 mots (R03) : le sujet à dire", () => {
    const l = lignesBase();
    l[0] = "[accroche] Vos demandes de prix arrivent sans le poids du colis.";
    const r = refusDe(l.join("\n"));
    expect(r[0]).toBe(`Ligne 1 : l'accroche compte 10 mots ; de 2 à 8 mots. Dites le sujet de la vidéo, par exemple « ${LT02.recit!.sujet} ».`);
  });

  it("accroche qui ne dit pas le sujet (R03) : la phrase à dire", () => {
    const l = lignesBase();
    l[0] = "[accroche] Bonjour à tous ici.";
    const r = refusDe(l.join("\n"));
    expect(r.some((m) => m.startsWith("Ligne 1 : ") && m.includes(`La première phrase dit le sujet : « ${LT02.recit!.sujet} », en 8 mots au plus.`))).toBe(true);
  });

  it("ligne trop longue (R05) : coupez en deux", () => {
    const l = lignesBase();
    const i = l.findIndex((x) => x.startsWith("[étape 2]"));
    l[i] = "[étape 2] " + Array.from({ length: 20 }, () => "mot").join(" ") + " fin.";
    const r = refusDe(l.join("\n"));
    expect(r.some((m) => m.startsWith(`Ligne ${i + 1} : `) && m.endsWith("Coupez cette phrase en deux lignes."))).toBe(true);
  });

  it("neuf lignes seulement (R20) : « Il faut de 12 à 26 lignes »", () => {
    const l = lignesBase();
    const r = refusDe([l[0], ...l.slice(1, 7), l[l.length - 2], l[l.length - 1]].join("\n"));
    expect(r.some((m) => m.includes("Il faut de 12 à 26 lignes"))).toBe(true);
  });

  it("un nombre qui ne vient d'aucun fait (R12)", () => {
    const l = lignesBase();
    const i = l.findIndex((x) => x.startsWith("[étape 1]"));
    l[i] = l[i].replace(/\.$/, "") + " en 42 jours.";
    expect(refusDe(l.join("\n")).some((m) => m.startsWith(`Ligne ${i + 1} : `) && m.includes("Ce nombre ne vient d'aucun fait du cas : retirez-le."))).toBe(true);
  });

  it("un appel dans le corps (R18) : la fin est ajoutée toute seule", () => {
    const l = lignesBase();
    const i = l.findIndex((x) => x.startsWith("[étape 1]"));
    l[i] = l[i].replace(/\.$/, "") + ", le lien est en commentaire.";
    expect(refusDe(l.join("\n")).some((m) => m.includes("La fin (lien, mot à commenter, diagnostic) est ajoutée toute seule selon le réseau : retirez-la."))).toBe(true);
  });

  it("un tutoiement (R11) et un mot interdit de Will (R10)", () => {
    const l = lignesBase();
    const i = l.findIndex((x) => x.startsWith("[étape 1]"));
    const tut = [...l];
    tut[i] = "[étape 1] Tu reçois la demande et tu la ranges.";
    expect(refusDe(tut.join("\n")).some((m) => m.startsWith(`Ligne ${i + 1} : `))).toBe(true);
    const mot = l[i].replace(/^\[étape 1\]\s*/, "").split(/\s+/).find((m) => m.length > 5)!.replace(/[^\p{L}]/gu, "");
    expect(refusDe(l.join("\n"), { motsInterdits: [mot] }).some((m) => m.startsWith(`Ligne ${i + 1} : `))).toBe(true);
  });

  it("une question sans « ? »", () => {
    const l = lignesBase();
    l[l.length - 1] = l[l.length - 1].replace(/\?\s*$/, ".");
    expect(refusDe(l.join("\n"))).toContain(`Ligne ${l.length} : la question finale doit finir par un point d'interrogation (« ? »).`);
  });

  it("la partie humaine absente (R23) : la phrase exacte à dire, et après quelle étape", () => {
    const l = lignesBase().filter((x) => !x.startsWith("[humain]"));
    const r = refusDe(l.join("\n"));
    expect(r.some((m) => m.includes(`Dites mot pour mot « ${LT02.resteHumain} », après l'étape ${LT02.resteHumainApresEtape}.`))).toBe(true);
  });

  it("trop court avec la fin la plus courte (R21) : « ajoutez une phrase »", () => {
    const l = lignesBase().map((x) => (/^\[(étape|détail|humain)/.test(x) ? x.replace(/^(\[[^\]]+\]).*$/, (_, e) => (e.startsWith("[humain") ? x : `${e} Quatre mots dits ici.`)) : x));
    const r = refusDe(l.join("\n"));
    expect(r.some((m) => /^Durée : avec la fin la plus courte la vidéo ferait environ [\d,]+ s, il en faut au moins 35 : ajoutez une phrase\.$/.test(m))).toBe(true);
  });

  it("une étiquette inconnue, une ligne trop longue, trop de lignes, un texte trop long", () => {
    expect(refusDe("[xyz] Bonjour.\nDeux.")[0]).toBe("Ligne 1 : l'étiquette [xyz] est inconnue. Étiquettes possibles : [accroche] [chiffre] [avant] [bascule] [étape] [détail] [humain] [preuve] [résultat] [question].");
    expect(refusDe("a".repeat(401))[0]).toBe("Ligne 1 : la ligne compte 401 caractères ; 400 au plus. Coupez-la en deux lignes.");
    expect(refusDe(Array.from({ length: 27 }, () => "Une phrase.").join("\n"))[0]).toBe("Le script compte 27 lignes ; 26 au plus (une ligne = un écran).");
    expect(refusDe("a ".repeat(2001))[0]).toContain("Le script est trop long : 4000 caractères au plus");
  });
});
