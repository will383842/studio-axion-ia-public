/**
 * NON-RÉGRESSION SUR DONNÉES RÉELLES — montage v2 de IMG_7747 (prod, 10/10). Aucun appel réel : fixtures lues sur disque.
 *  - DÉFAUT 1 : la reprise de fin (« Quel que soit votre taille. Si vous sentez que du temps, » puis tout redit à
 *    111,2 s) était absorbée par des mots étirés : elle est maintenant retirée, et aucune phrase dite une seule fois
 *    ne l'est ; `phrasesManquantes` ne signale plus de faux absents.
 *  - DÉFAUT 2 : les cartes automatiques illustrent exactement ce qui est dit, quand c'est dit (critères a à e).
 */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { appliquerRecalages, calculerCoupes, controlerCoupes, motsDuMontage, reprisesAbsorbees, type PlanCoupes } from "@/briques/coupes";
import { horodaterMotsPrononces } from "@/briques/calage/report";
import { planifierCartesAuto, type CarteAuto } from "@/briques/habillage-facecam";
import { choisirModele } from "@/briques/motion/choix";
import { habillageFacecam } from "@/moteurs/montage-facecam/habillage";
import type { MotHorodate } from "@/domaine/types";

const reel = JSON.parse(readFileSync("tests/fixtures/img7747-v2-montage-reel.json", "utf-8")) as { mots: MotHorodate[]; coupes: { type: string }[]; cartes: unknown[] };
const DUREE_PRISE = 130.732;

/** Texte tel que les mots l'écrivent (« n », « 'en » recollés). */
const TEXTE_DES_MOTS = reel.mots.map((m) => m.mot).reduce((s, m) => (/^['-]/.test(m) ? s + m : s ? `${s} ${m}` : m), "");

/**
 * Texte validé RECONSTITUÉ (le script n'est pas dans le fixture) : les mots, orthographe du script rétablie là où la
 * transcription s'est trompée (colmater, Certifexemple, « Où part », « Un, Deux, Trois », « audite les entreprises »). Les
 * cartes de prod citaient « colmater » : elles sont bâties sur le texte validé, pas sur la transcription.
 */
const SCRIPT =
  "Si votre entreprise avance mais que vos journées, elles, n'en finissent plus, vous n'avez pas un problème de travail, vous avez une fuite. Et ce qui suit est pour vous. Les soirées sur les devis, les relances à la main, les chiffres qui arrivent trop tard, ce n'est pas la charge normale d'un dirigeant. C'est du temps qui s'échappe, chaque jour, sans bruit. Chez Axion-IA, on forme les équipes à l'IA, on accompagne les dirigeants en one-to-one, on audite les entreprises et on automatise tout ce qui leur coûte du temps. Petite structure, entreprise en croissance ou groupe, partout, je vois le même réflexe. On veut colmater en ajoutant un outil de plus, une embauche de plus, alors que la vraie première étape, c'est de trouver la fuite. Prenez un dirigeant qui voulait recruter pour absorber l'administratif. On a d'abord regardé où partait le temps. Pas de recrutement, ses équipes ont retrouvé leurs après-midi, et lui, ses week-ends. Alors, on vous propose de commencer par là. Le diagnostic fuite. Un premier diagnostic gratuit de 45 minutes en visio avec notre équipe. Un, où part votre temps ? Deux, qu'est-ce qui peut changer en premier ? Trois, de quoi avez-vous besoin pour avancer ? Une formation pour vos équipes, avec des aides OPCO possibles grâce à Certifexemple, en vous orientant vers les bonnes. Ou peut-être un accompagnement one-to-one, un audit complet, de l'automatisation. En 45 minutes, on ne fait pas de miracle, mais vous repartez avec vos priorités claires et classées. Et vous comprendrez une chose. L'IA ne rapporte qu'à partir du moment où elle s'attaque à la bonne fuite. Quelle que soit votre taille, si vous sentez que du temps vous échappe, réservez votre appel diagnostic gratuit.";

/** Transcription libre (Whisper) du fixture : mots répartis dans chaque segment horodaté. */
function motsWhisper(): MotHorodate[] {
  const lignes = readFileSync("tests/fixtures/img7747-transcription-whisper.txt", "utf-8").split("\n");
  return lignes.flatMap((l) => {
    const m = /^\[\s*([\d.]+)-\s*([\d.]+)\]\s*(.+)$/.exec(l.trim());
    if (!m) return [];
    const [d, f] = [Number(m[1]), Number(m[2])];
    const mots = m[3].split(/\s+/).filter(Boolean);
    const pas = (f - d) / mots.length;
    return mots.map((mot, k) => ({ mot, debutSec: +(d + k * pas).toFixed(3), finSec: +(d + (k + 1) * pas).toFixed(3) }));
  });
}

/** Les phrases du texte avant la reprise (0 à 23) restent entendues, les deux dernières aussi (prise complète). */
function verifierAucunePhrasePerdue(plan: PlanCoupes) {
  const c = controlerCoupes(plan, reel.mots);
  expect(c.phrasesManquantes).toEqual([]);
  expect(c.coupesDansUnMot).toEqual([]);
  expect(plan.phrases.every((p) => p.debutSec !== undefined)).toBe(true);
  // Rien d'autre que le début, la fin, la reprise et des blancs n'est retiré.
  expect(plan.coupes.filter((x) => !["debut", "fin", "silence"].includes(x.type)).map((x) => x.type)).toEqual(["reprise"]);
  expect(plan.coupes.filter((x) => x.type === "silence").every((x) => x.finSec - x.debutSec < 1.3)).toBe(true);
}

describe("Défaut 1 — reprise absorbée par l'alignement (IMG_7747 v2, données réelles)", () => {
  it("le fixture reproduit la prod : sans correctif, seulement début + blancs + fin", () => {
    expect(reel.coupes.filter((c) => c.type !== "silence").map((c) => c.type)).toEqual(["debut", "fin"]);
  });

  for (const [nom, texte] of [
    ["texte écrit comme les mots", TEXTE_DES_MOTS],
    ["texte validé (script)", SCRIPT],
  ] as const) {
    it(`retire la PREMIÈRE tentative (≈ 101,8 → 111,2 s) et garde la prise complète — ${nom}`, () => {
      const plan = calculerCoupes({ mots: reel.mots, dureeSec: DUREE_PRISE, texteValide: texte });
      expect(plan.mode).toBe("texte");
      const reprise = plan.coupes.find((c) => c.type === "reprise")!;
      expect(reprise.debutSec).toBeGreaterThan(100.95); // après « … la bonne fuite. »
      expect(reprise.debutSec).toBeLessThan(101.9); // avant le premier « Quel »
      expect(reprise.finSec).toBeGreaterThan(110.4);
      expect(reprise.finSec).toBeLessThanOrEqual(111.2); // jamais dans le « Quel » redit
      expect(reprise.libelle).toMatch(/^Phrase reprise : « Quel/);
      verifierAucunePhrasePerdue(plan);
      // Les mots repris sont recalés sur la prise complète (sous-titres et cartes sur la bonne prise).
      const quel = appliquerRecalages(reel.mots, plan.recalages).find((m) => m.mot === "Quel")!;
      expect(quel.debutSec).toBeGreaterThan(110.4);
      expect(plan.dureeSortieSec).toBeLessThan(93);
    });
  }

  it("avec la transcription libre (Whisper) : départ exact de la prise complète à 111,2 s", () => {
    const plan = calculerCoupes({ mots: reel.mots, dureeSec: DUREE_PRISE, texteValide: SCRIPT, motsLibres: motsWhisper() });
    const reprise = plan.coupes.find((c) => c.type === "reprise")!;
    expect(reprise.finSec).toBeGreaterThan(111.0);
    expect(reprise.finSec).toBeLessThanOrEqual(111.2);
    verifierAucunePhrasePerdue(plan);
  });

  it("dans le doute, on garde : pause normale entre phrases, petit étirement, Whisper sans redite", () => {
    const mots: MotHorodate[] = [];
    let t = 0;
    const dire = (texte: string, etire: Record<string, number> = {}, pause = 0.2) => {
      for (const mot of texte.split(" ")) {
        const d = 0.06 + 0.05 * mot.length + (etire[mot] ?? 0);
        mots.push({ mot, debutSec: +t.toFixed(3), finSec: +(t + d).toFixed(3) });
        t += d + 0.04;
      }
      t += pause;
    };
    dire("Bonjour à tous.", {}, 3); // longue pause ENTRE deux phrases : jamais une reprise
    dire("Voici une phrase dite une seule fois.");
    dire("Celle-ci traîne un peu sur un mot.", { traîne: 1.2 }); // 1,2 s en trop : sous le seuil
    dire("Et la dernière phrase est bien finie.");
    const texte = "Bonjour à tous. Voici une phrase dite une seule fois. Celle-ci traîne un peu sur un mot. Et la dernière phrase est bien finie.";
    const plan = calculerCoupes({ mots, dureeSec: t + 1, texteValide: texte });
    expect(plan.coupes.some((c) => c.type === "reprise")).toBe(false);
    expect(plan.recalages).toEqual([]);
    // Fort étirement mais la transcription libre ne montre aucune redite : rien n'est retiré.
    const etires = mots.map((m) => (m.mot === "traîne" ? { ...m, finSec: m.finSec + 4 } : m.debutSec > (mots.find((x) => x.mot === "traîne")!.debutSec) ? { ...m, debutSec: m.debutSec + 4, finSec: m.finSec + 4 } : m));
    expect(reprisesAbsorbees(etires, etires.map((_, i) => i), [0, 3, 10, 18], etires)).toEqual([]);
  });

  it("phrasesManquantes : une phrase gardée dont le milieu tombe dans un blanc raccourci n'est plus « absente »", () => {
    const plan = calculerCoupes({ mots: reel.mots, dureeSec: DUREE_PRISE, texteValide: SCRIPT });
    const p0 = plan.phrases[0];
    // Son milieu (18,02 s) tombe dans le blanc 17,84 → 18,24 : avant le 10/10, la phrase était signalée absente.
    expect(plan.coupes.some((c) => c.type === "silence" && c.debutSec < (p0.debutSec! + p0.finSec!) / 2 && c.finSec > (p0.debutSec! + p0.finSec!) / 2)).toBe(true);
    expect(controlerCoupes(plan, reel.mots).phrasesManquantes).not.toContain(0);
  });
});

/** Mots de la vidéo montée comme la chaîne les calcule (texte validé calé sur la transcription montée). */
function motsMontes(): { mots: MotHorodate[]; duree: number } {
  const plan = calculerCoupes({ mots: reel.mots, dureeSec: DUREE_PRISE, texteValide: SCRIPT });
  const montes = motsDuMontage(appliquerRecalages(reel.mots, plan.recalages), plan.gardes);
  const texteMonte = plan.phrases.filter((p) => p.debutSec !== undefined).map((p) => p.texte).join(" ");
  return { mots: horodaterMotsPrononces(texteMonte.split(/\s+/).filter(Boolean), montes), duree: plan.dureeSortieSec };
}

const donnees = (c: CarteAuto) => c.carte.donnees as unknown as Record<string, unknown>;
const elementsDe = (c: CarteAuto) => ((donnees(c).elements as { texte: string; aSec?: number }[]) ?? []).map((e) => e.texte);
const instant = (mots: MotHorodate[], mot: string, apres = 0) => mots.find((m) => m.mot.replace(/[,.?]/g, "") === mot && m.debutSec >= apres)!.debutSec;

describe("Défaut 2 — cartes automatiques justes (IMG_7747 v2, données réelles)", () => {
  const { mots, duree } = motsMontes();
  const cartes = planifierCartesAuto(mots, duree);

  it("le fixture reproduit la prod : 2 cartes, dont une liste absurde « De plus »", () => {
    expect(reel.cartes).toHaveLength(2);
    expect(JSON.stringify(reel.cartes)).toContain("De plus");
  });

  it("(a) liste 4 éléments pendant la phrase Axion-IA, chaque élément au mot dit", () => {
    const c = cartes.find((x) => elementsDe(x).some((e) => /^Forme/.test(e)))!;
    expect(c.carte.modele).toBe("liste");
    expect(elementsDe(c)).toEqual(["Forme les équipes", "Accompagne en one-to-one", "Audite", "Automatise"]);
    const chez = instant(mots, "Chez");
    // Finitions du 10/10 : le panneau s'ouvre juste avant le premier point (« forme »), jamais vide.
    expect(c.debutSec).toBeGreaterThanOrEqual(chez);
    expect(instant(mots, "forme", chez) - c.debutSec).toBeLessThanOrEqual(0.4 + 1e-6);
    const el = donnees(c).elements as { aSec: number }[];
    expect(c.debutSec + el[0].aSec).toBeCloseTo(instant(mots, "forme", chez), 1);
    expect(c.debutSec + el[3].aSec).toBeCloseTo(instant(mots, "automatise", chez), 1);
  });

  it("(b) liste numérotée de 3 questions calée sur Un / Deux / Trois", () => {
    const c = cartes.find((x) => donnees(x).numerotee === true)!;
    expect(elementsDe(c)).toEqual(["Où part votre temps ?", "Qu'est-ce qui peut changer en premier ?", "De quoi avez-vous besoin ?"]);
    const el = donnees(c).elements as { aSec: number }[];
    const un = mots.find((m) => m.mot === "Un,")!.debutSec;
    expect(c.debutSec + el[0].aSec).toBeCloseTo(un, 1);
    expect(c.debutSec + el[1].aSec).toBeCloseTo(mots.find((m) => m.mot === "Deux,")!.debutSec, 1);
    expect(c.debutSec + el[2].aSec).toBeCloseTo(mots.find((m) => m.mot === "Trois,")!.debutSec, 1);
  });

  it("(c) chiffre « 45 min · gratuit · en visio », le compteur part sur « 45 »", () => {
    const c = cartes.find((x) => x.carte.modele === "chiffre")!;
    expect(donnees(c)).toMatchObject({ valeur: 45, unite: "min", libelle: "gratuit · en visio" });
    expect(c.debutSec + (donnees(c).aSec as number)).toBeCloseTo(instant(mots, "45"), 1);
  });

  it("(d) « Le diagnostic fuite » en sur-titre du chiffre, visible dès l'ouverture du panneau", () => {
    const c = cartes.find((x) => donnees(x).titre === "Le diagnostic fuite" || donnees(x).surTitre === "Le diagnostic fuite")!;
    expect(c).toBeDefined();
    // Finitions du 10/10 : le panneau ne s'ouvre plus 2,9 s avant le compteur (presque vide) ; il s'ouvre au plus tard
    // possible avant la liste numérotée qui suit, le sur-titre visible dès l'ouverture, le compteur au « 45 » dit.
    expect(c.debutSec).toBeGreaterThanOrEqual(instant(mots, "Le", 40) - 1e-6);
    expect(c.debutSec + (donnees(c).aSec as number)).toBeCloseTo(instant(mots, "45"), 1);
    expect(donnees(c).aSec as number).toBeLessThan(1.6);
  });

  it("(e) appel à l'action final « Réservez votre appel diagnostic gratuit »", () => {
    const c = cartes[cartes.length - 1];
    expect(donnees(c).titre).toBe("Réservez votre appel diagnostic gratuit");
    expect(c.finSec).toBeLessThanOrEqual(duree);
    expect(c.debutSec).toBeLessThanOrEqual(instant(mots, "réservez"));
  });

  it("jamais de carte absurde : listes de 2 éléments au moins, aucun mot de liaison seul, textes tirés de la parole", () => {
    const dit = mots.map((m) => m.mot.toLowerCase()).join(" ");
    for (const c of cartes) {
      if (c.carte.modele === "liste") expect(elementsDe(c).length).toBeGreaterThanOrEqual(2);
      for (const e of elementsDe(c)) {
        expect(e).not.toMatch(/^(de plus|et|puis|alors|en plus)$/i);
        for (const m of e.toLowerCase().replace(/[?]/g, "").split(/\s+/).filter((x) => x.length > 3 && x !== "audite")) expect(dit).toContain(m);
      }
    }
    expect(JSON.stringify(cartes)).not.toContain("De plus");
  });

  it("densité et place : 6 cartes au moins, ≤ 21 s entre deux débuts, 3 à 8 s chacune, aucun chevauchement, plusieurs modèles", () => {
    expect(cartes.length).toBeGreaterThanOrEqual(6);
    for (let k = 0; k < cartes.length; k++) {
      expect(cartes[k].finSec - cartes[k].debutSec).toBeGreaterThanOrEqual(3 - 1e-6);
      expect(cartes[k].finSec - cartes[k].debutSec).toBeLessThanOrEqual(8 + 1e-6);
      if (k) {
        expect(cartes[k].debutSec).toBeGreaterThanOrEqual(cartes[k - 1].finSec);
        expect(cartes[k].debutSec - cartes[k - 1].debutSec).toBeLessThanOrEqual(21);
      }
    }
    expect(new Set(cartes.map((c) => c.carte.modele)).size).toBeGreaterThanOrEqual(4);
    // Densité réglable : un écart visé plus long, moins de cartes de comblement (jamais moins que les cartes sûres).
    expect(planifierCartesAuto(mots, duree, { ecartCibleSec: [30, 60] }).length).toBeLessThanOrEqual(cartes.length);
  });

  it("habillage : les cartes automatiques partent toutes en moitié haute (le visage reste visible en bas)", () => {
    const h = habillageFacecam({ pisteMonteeCle: "p.mov", dureeSec: duree, mots, prefixeCartes: "c" });
    expect(h.cartes).toHaveLength(cartes.length);
    expect(h.entree.ecransPartages).toHaveLength(cartes.length);
    expect(h.entree.cartesPleinEcran).toBeUndefined();
  });

  it("règle générale des 6 modèles : « un outil de plus » n'est plus une liste « De plus »", () => {
    const c = choisirModele("On veut colmater en ajoutant un outil de plus, une embauche de plus, alors que la vraie première étape, c'est de trouver la fuite.");
    expect(c?.modele).not.toBe("liste");
  });
});
