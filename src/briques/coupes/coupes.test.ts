import { describe, expect, it } from "vitest";
import type { MotHorodate } from "@/domaine/types";
import { calculerCoupes, controlerCoupes, gardesApres, motsDuMontage, resumeCoupes, versConsignesFacecam, versMontage, versPrise } from "./index";

/** Pose les mots d'une phrase régulièrement dans [debut, fin]. */
function dire(phrase: string, debut: number, fin: number): MotHorodate[] {
  const mots = phrase.split(/\s+/).filter(Boolean);
  const pas = (fin - debut) / mots.length;
  return mots.map((mot, i) => ({ mot, debutSec: +(debut + i * pas).toFixed(3), finSec: +(debut + (i + 1) * pas - pas * 0.15).toFixed(3) }));
}

/** Pose la DERNIÈRE syllabe exactement à `fin` (le dernier mot finit à `fin`). */
function direJusqua(phrase: string, debut: number, fin: number): MotHorodate[] {
  const m = dire(phrase, debut, fin);
  m[m.length - 1] = { ...m[m.length - 1], finSec: fin };
  return m;
}

const PHRASES_F0 = [
  "Bonjour, je suis Will, fondateur d'Axion-IA.",
  "Aujourd'hui je vais vous parler de la formation de vos équipes.",
  "Beaucoup de dirigeants pensent que l'intelligence artificielle est réservée aux grands groupes.",
  "C'est faux.",
  "Avec un financement OPCO, la formation peut être prise en charge.",
  "Nous sommes certifiés Certifexemple depuis trois ans.",
  "Chaque formation est construite sur mesure, pour votre métier.",
  "Vos équipes gagnent en moyenne cinq heures par semaine.",
  "Et ce n'est que le début.",
  "Quel que soit votre taille.",
  "Si vous sentez que du temps vous échappe, appelez-nous.",
];

/**
 * Prise F0 (IMG_7747, essai du 08/10) reconstituée : installation et bavardage avant 15,1 s, texte de 15,24 à 101,72 s,
 * essai abandonné « Quel que soit votre taille. Si vous sentez que du temps… » de 102,3 à 106 s, reprise à 111,28 s,
 * dernier mot à 118,02 s, départ de la chaise (« Voilà, c'est bon. ») puis fin de la prise à 130,7 s.
 */
function priseF0(): { mots: MotHorodate[]; texte: string; duree: number } {
  const mots: MotHorodate[] = [...dire("C'est bon, ça tourne ?", 3, 4.2), ...dire("Attends, je me mets bien.", 9.5, 11)];
  const avant = PHRASES_F0.slice(0, 9);
  const debut = 15.24;
  const fin = 101.72;
  const creneau = (fin - debut) / avant.length;
  avant.forEach((p, k) => {
    const d = debut + k * creneau;
    const f = k === avant.length - 1 ? fin : d + creneau - 0.45;
    mots.push(...direJusqua(p, d, f));
  });
  mots.push(...dire("Quel que soit votre taille.", 102.3, 104), ...dire("Si vous sentez que du temps…", 104.5, 106));
  mots.push(...dire("Quel que soit votre taille.", 111.28, 113.2), ...direJusqua("Si vous sentez que du temps vous échappe, appelez-nous.", 113.6, 118.02));
  mots.push(...dire("Voilà, c'est bon.", 121, 122.2));
  return { mots, texte: PHRASES_F0.join(" "), duree: 130.7 };
}

describe("brique coupes — cas F0 (plan v4, tests gardés n° 4)", () => {
  const { mots, texte, duree } = priseF0();
  const plan = calculerCoupes({ mots, dureeSec: duree, texteValide: texte });
  const passages = plan.coupes.filter((c) => c.type !== "silence" && c.type !== "hesitation");

  it("début à jeter 0 → 15,1 s, reprise 101,8 → 111,2 s, fin à jeter 118,3 → 130,7 s", () => {
    expect(plan.mode).toBe("texte");
    expect(passages.map((c) => c.type)).toEqual(["debut", "reprise", "fin"]);
    const [debut, reprise, fin] = passages;
    expect(debut.debutSec).toBe(0);
    expect(debut.finSec).toBeCloseTo(15.1, 1);
    expect(reprise.debutSec).toBeCloseTo(101.8, 1);
    expect(reprise.finSec).toBeCloseTo(111.2, 1);
    expect(fin.debutSec).toBeCloseTo(118.3, 1);
    expect(fin.finSec).toBe(130.7);
    expect(reprise.libelle).toMatch(/^Phrase reprise : « Quel que soit votre taille/);
  });

  it("garde le DERNIER essai complet de chaque phrase, et aucune phrase ne manque ni n'est doublée", () => {
    const reprise = plan.phrases[9];
    expect(reprise.essais).toBe(2);
    expect(reprise.debutSec).toBeCloseTo(111.28, 2);
    expect(plan.phrases[10].debutSec).toBeCloseTo(113.6, 2);
    expect(plan.phrases.every((p) => p.debutSec !== undefined)).toBe(true);
    const ctrl = controlerCoupes(plan, mots);
    expect(ctrl.phrasesManquantes).toEqual([]);
    expect(ctrl.coupesDansUnMot).toEqual([]);
    // Aucun mot de l'essai abandonné ne reste dans le montage.
    const montes = motsDuMontage(mots, plan.gardes).map((m) => m.mot);
    expect(montes.filter((m) => m === "Quel")).toHaveLength(1);
    expect(montes).not.toContain("tourne");
  });

  it("blancs de plus de 0,25 s ramenés à 0,10-0,15 s, bornes calées sur les images à 25 i/s", () => {
    const silences = plan.coupes.filter((c) => c.type === "silence");
    expect(silences.length).toBeGreaterThan(0);
    for (const c of plan.coupes) {
      expect(Math.abs(c.debutSec * 25 - Math.round(c.debutSec * 25))).toBeLessThan(1e-6);
      if (c.finSec !== duree) expect(Math.abs(c.finSec * 25 - Math.round(c.finSec * 25))).toBeLessThan(1e-6);
    }
    const montes = motsDuMontage(mots, plan.gardes);
    for (let i = 0; i + 1 < montes.length; i++) {
      const blanc = montes[i + 1].debutSec - montes[i].finSec;
      const chute = plan.chutes.some((c) => Math.abs(versMontage(c.finSec, plan.gardes)! - montes[i + 1].debutSec) < 0.01);
      expect(blanc).toBeLessThanOrEqual(chute ? 0.62 : 0.25 + 0.04);
    }
  });

  it("résumé lisible pour Will, durée utile ≈ 94 s sur 131", () => {
    expect(resumeCoupes(plan)).toMatch(/^3 passages retirés, 2:11 devient 1:\d\d$/);
    expect(plan.dureeSortieSec).toBeLessThan(96);
    expect(plan.dureeSortieSec).toBeGreaterThan(85);
  });

  it("l'original n'est jamais modifié : la prise reste intacte, tout se rétablit (tests gardés n° 5)", () => {
    const fige = priseF0();
    const copie = JSON.parse(JSON.stringify(fige.mots));
    Object.freeze(fige.mots);
    fige.mots.forEach((m) => Object.freeze(m));
    const p = calculerCoupes({ mots: fige.mots, dureeSec: fige.duree, texteValide: fige.texte });
    expect(fige.mots).toEqual(copie);
    // Coupes et passages gardés sont exprimés dans le temps de la prise d'origine et la couvrent exactement.
    const couvert = p.coupes.reduce((s, c) => s + c.finSec - c.debutSec, 0) + p.gardes.reduce((s, g) => s + g.finSec - g.debutSec, 0);
    expect(couvert).toBeCloseTo(fige.duree, 3);
    // Tout rétablir rend la prise entière.
    expect(gardesApres(p, p.coupes.map((c) => c.id))).toEqual([{ debutSec: 0, finSec: 130.7 }]);
    // Rétablir la reprise seule la remet, sans toucher au reste.
    const reprise = p.coupes.find((c) => c.type === "reprise")!;
    const apres = gardesApres(p, [reprise.id]);
    expect(apres.some((g) => g.debutSec <= 102.3 && g.finSec >= 106)).toBe(true);
    expect(resumeCoupes(p, [reprise.id])).toMatch(/^2 passages retirés/);
  });

  it("temps du montage ↔ temps de la prise", () => {
    const t = versMontage(111.28, plan.gardes)!;
    expect(versPrise(t, plan.gardes)).toBeCloseTo(111.28, 2);
    expect(versMontage(105, plan.gardes)).toBeNull();
    expect(versMontage(16, plan.gardes)).toBeCloseTo(16 - 15.1, 1);
  });
});

describe("brique coupes — consignes « Monteur, … » (v4 n° 15)", () => {
  const texte = "Voici les trois étapes. D'abord on écoute. Ensuite on construit.";
  const mots = [
    ...dire("Monteur, mets une carte liste pour les étapes.", 2, 5),
    ...dire("Voici les trois étapes.", 8, 9.5),
    ...dire("Monteur, zoome sur moi ici.", 10.5, 12.2),
    ...dire("D'abord on écoute.", 13.5, 14.6),
    ...dire("Ensuite on construit.", 15, 16.2),
  ];
  const plan = calculerCoupes({ mots, dureeSec: 18, texteValide: texte });

  it("repérées avant les coupes, y compris dans le début jeté ; chacune devient une coupe « consigne »", () => {
    expect(plan.consignes.map((c) => c.texte)).toEqual(["mets une carte liste pour les étapes.", "zoome sur moi ici."]);
    const consignes = plan.coupes.filter((c) => c.type === "consigne");
    expect(consignes).toHaveLength(2);
    expect(consignes[0].debutSec).toBeLessThanOrEqual(2);
    expect(consignes[1].debutSec).toBeLessThanOrEqual(10.5);
    expect(consignes[1].finSec).toBeGreaterThanOrEqual(12.2 - 0.05);
    expect(controlerCoupes(plan, mots).consignesAudibles).toEqual([]);
    expect(motsDuMontage(mots, plan.gardes).map((m) => m.mot)).not.toContain("Monteur,");
  });

  it("une consigne rétablie est signalée audible ; une phrase qui ne commence pas par « Monteur » n'est pas une consigne", () => {
    const id = plan.coupes.find((c) => c.type === "consigne" && c.debutSec > 9)!.id;
    expect(controlerCoupes(plan, mots, [id]).consignesAudibles).toHaveLength(1);
    const sans = calculerCoupes({ mots: dire("Mettez une carte ici et le monteur verra.", 0, 3), dureeSec: 3 });
    expect(sans.consignes).toEqual([]);
    expect(versConsignesFacecam(plan.consignes)[0]).toMatchObject({ origine: "voix", texte: "mets une carte liste pour les étapes.", dansPriseSec: 2 });
  });
});

describe("brique coupes — hésitations, chute et vidéo libre", () => {
  it("« euh » et bégaiement retirés, chute gardée avant une phrase forte (2 au plus)", () => {
    const mots = [
      ...dire("Le le problème, euh, c'est le temps.", 0.5, 3),
      ...dire("Mais la solution existe !", 3.8, 5.2),
      ...dire("On en parle.", 6, 7),
    ];
    const plan = calculerCoupes({ mots, dureeSec: 7.5 });
    const montes = motsDuMontage(mots, plan.gardes).map((m) => m.mot);
    expect(montes).not.toContain("euh,");
    expect(montes.filter((m) => m === "Le" || m === "le")).toHaveLength(2);
    expect(plan.coupes.some((c) => c.type === "hesitation")).toBe(true);
    expect(plan.chutes).toHaveLength(1);
    expect(plan.chutes[0].finSec).toBeCloseTo(3.8, 2);
    expect(plan.chutes[0].finSec - plan.chutes[0].debutSec).toBeGreaterThanOrEqual(0.35);
  });

  it("vidéo libre : bavardage d'installation, redémarrage et « pardon, je recommence » retirés", () => {
    const mots = [
      ...dire("C'est bon, ça tourne ?", 0.5, 1.8),
      ...dire("Si vous sentez que…", 4, 5),
      ...dire("Si vous sentez que le temps vous échappe, écoutez bien.", 6, 9),
      ...dire("La formation est financée.", 10, 11.5),
      ...dire("Pardon, je recommence.", 12.5, 13.5),
      ...dire("La formation est prise en charge.", 14.5, 16.5),
      ...dire("Voilà.", 18, 18.5),
    ];
    const plan = calculerCoupes({ mots, dureeSec: 20 });
    expect(plan.mode).toBe("libre");
    const montes = motsDuMontage(mots, plan.gardes).map((m) => m.mot).join(" ");
    expect(montes).toBe("Si vous sentez que le temps vous échappe, écoutez bien. La formation est prise en charge.");
  });

  it("texte non retrouvé : bascule en vidéo libre, sans lever", () => {
    const plan = calculerCoupes({ mots: dire("Rien à voir avec le texte prévu.", 0, 3), dureeSec: 4, texteValide: "Une phrase. Une autre phrase complètement différente." });
    expect(plan.mode).toBe("libre");
    expect(plan.texteNonRetrouve).toBe(true);
    expect(calculerCoupes({ mots: [], dureeSec: 5 }).gardes).toEqual([{ debutSec: 0, finSec: 5 }]);
  });
});

/**
 * Prise IMG_7747 du 09/10 (travail trav-2d323cdd6e4c), premier vrai montage face caméra : transcription Whisper
 * horodatée (fautes d'écoute comprises, chiffres écrits en chiffres, « ? » isolés) et texte validé collé tel quel.
 * En prod, 6 passages dits UNE SEULE FOIS ont été marqués « reprise », et la vraie reprise de fin a été manquée.
 */
function priseIMG7747(): { mots: MotHorodate[]; texte: string; duree: number } {
  const mots: MotHorodate[] = [
    ...dire("Les soirées sur les deux vies, les relances à la main, les chiffres qui arrivent trop", 23.08, 27.48),
    ...dire("Ce n'est pas la charge normale d'un dirigeant, c'est du temps qui s'échappe, chaque jour,", 27.48, 32.52),
    ...dire("Pas de recrutement,", 60.48, 61.68),
    ...dire("ces équipes ont retrouvé leur après-midi et lui, c'est weekend.", 61.68, 65.24),
    ...dire("Un premier diagnostic gratuit de 45 minutes en visio avec notre équipe.", 69.68, 74.08),
    ...dire("1, ou par votre temps ?", 74.08, 76.16),
    ...dire("2, qu'est-ce qui peut changer en premier ?", 76.16, 79.04),
    ...dire("3, de quoi avez-vous besoin pour avancer ?", 79.04, 82.24),
    ...dire("Une formation pour vos équipes avec des aideaux que possible à Calliopee,", 82.24, 86.08),
    ...dire("en vous orientant vers les bonnes. Ou peut-être un accompagnement one-to-one,", 86.08, 89.32),
    ...dire("L'IA ne rapporte qu'à partir du moment où elle s'attaque à la bonne fuite.", 97.68, 101.76),
    ...dire("Quel que soit votre taille.", 101.76, 104.08),
    ...dire("Si vous sentez que du temps,", 104.08, 111.2),
    ...dire("Quel que soit votre taille, si vous sentez que du temps vous échappe,", 111.2, 114.2),
    ...direJusqua("réservez votre appel diagnostic gratuit.", 114.2, 118.2),
  ];
  const texte = [
    "Les soirées sur les devis, les relances à la main, les chiffres qui arrivent trop tard.",
    "Ce n'est pas la charge normale d'un dirigeant, c'est du temps qui s'échappe, chaque jour.",
    "Pas de recrutement : ses équipes ont retrouvé leurs après-midi, et lui, ses week-ends.",
    "Un premier diagnostic gratuit de quarante-cinq minutes, en visio, avec notre équipe.",
    "Un : où part votre temps ? Deux : qu'est-ce qui peut changer en premier ? Trois : de quoi avez-vous besoin pour avancer ?",
    "Une formation pour vos équipes, avec des aides autant que possible grâce à Certifexemple, en vous orientant vers les bonnes.",
    "Ou peut-être un accompagnement one-to-one.",
    "L'IA ne rapporte qu'à partir du moment où elle s'attaque à la bonne fuite.",
    "Quelle que soit votre taille, si vous sentez que du temps vous échappe, réservez votre appel diagnostic gratuit.",
  ].join(" ");
  return { mots, texte, duree: 120 };
}

describe("brique coupes — non-régression IMG_7747 (09/10) : jamais de reprise pour un passage dit une seule fois", () => {
  const { mots, texte, duree } = priseIMG7747();
  const plan = calculerCoupes({ mots, dureeSec: duree, texteValide: texte });
  const retires = plan.coupes.filter((c) => c.type === "reprise" || c.type === "debut" || c.type === "fin");
  const reprises = retires.filter((c) => c.type === "reprise");
  const montes = motsDuMontage(mots, plan.gardes).map((m) => m.mot);
  /** Le mot dit à `t` (début du mot) est-il entendu dans le montage ? */
  const entendu = (t: number) => {
    const m = mots.find((x) => Math.abs(x.debutSec - t) < 1e-6)!;
    return plan.gardes.some((g) => (m.debutSec + m.finSec) / 2 >= g.debutSec && (m.debutSec + m.finSec) / 2 <= g.finSec);
  };
  const motsEntre = (a: number, b: number) => mots.filter((m) => m.debutSec >= a - 1e-6 && m.debutSec < b - 1e-6);

  it("mode texte, toutes les phrases retrouvées, aucune phrase manquante ni coupe dans un mot", () => {
    expect(plan.mode).toBe("texte");
    expect(plan.texteNonRetrouve).toBe(false);
    expect(plan.phrases.filter((p) => p.debutSec === undefined).map((p) => p.texte)).toEqual([]);
    const ctrl = controlerCoupes(plan, mots);
    expect(ctrl.phrasesManquantes).toEqual([]);
    expect(ctrl.coupesDansUnMot).toEqual([]);
  });

  it("aucune des 6 fausses coupes : chaque passage dit une seule fois reste entendu en entier", () => {
    const passages: [number, number][] = [
      [23.08, 32.52], // « Les soirées sur les deux vies, les… » (deux vies / devis, « trop » sans « tard »)
      [60.48, 65.24], // « … et lui, c'est weekend » (ses week-ends)
      [69.68, 74.08], // « … de 45 minutes … » (quarante-cinq)
      [74.08, 82.24], // « 1, ou par votre temps ? 2, … ? 3, … ? » (Un / Deux / Trois, « ? » isolés)
      [82.24, 89.32], // « Une formation … aideaux que possible à Calliopee, … » (aides autant / Certifexemple)
      [97.68, 101.76], // « … la bonne fuite. »
    ];
    for (const [a, b] of passages) for (const m of motsEntre(a, b)) expect(entendu(m.debutSec), `« ${m.mot} » (${m.debutSec} s)`).toBe(true);
    for (const c of reprises) expect(c.debutSec >= 101.7 && c.finSec <= 111.3, `${c.type} ${c.debutSec}-${c.finSec} ${c.libelle}`).toBe(true);
    // Début et fin à jeter : seulement les blancs avant le premier mot et après le dernier.
    expect(retires.filter((c) => c.type !== "reprise").map((c) => c.type)).toEqual(["debut", "fin"]);
    expect(retires[0].finSec).toBeLessThanOrEqual(23.08);
    expect(retires[retires.length - 1].debutSec).toBeGreaterThanOrEqual(118.2);
    for (const forme of ["1,", "?", "2,", "3,", "weekend.", "Une", "trop", "Calliopee,"]) expect(montes).toContain(forme);
  });

  it("la vraie reprise de fin est retirée : « Quel que soit votre taille. Si vous sentez que du temps, » abandonné puis redit", () => {
    expect(reprises).toHaveLength(1);
    const [reprise] = reprises;
    expect(reprise.debutSec).toBeCloseTo(101.76, 0);
    expect(reprise.finSec).toBeCloseTo(111.2, 0);
    expect(reprise.libelle).toMatch(/^Phrase reprise : « Quel que soit votre taille/);
    for (const m of motsEntre(101.76, 111.2)) expect(entendu(m.debutSec), `« ${m.mot} » (${m.debutSec} s)`).toBe(false);
    for (const m of motsEntre(111.2, 118.2)) expect(entendu(m.debutSec)).toBe(true);
    expect(montes.filter((m) => m === "Quel")).toHaveLength(1);
    expect(montes.join(" ")).toMatch(/la bonne fuite\. Quel que soit votre taille, si vous sentez que du temps vous échappe, réservez votre appel diagnostic gratuit\.$/);
    const derniere = plan.phrases[plan.phrases.length - 1];
    expect(derniere.essais).toBe(2);
    expect(derniere.debutSec).toBeCloseTo(111.2, 2);
  });
});
