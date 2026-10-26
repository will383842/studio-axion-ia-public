/**
 * Réparation sans appel d'une phrase trop longue (Q09) : la coupe ne change JAMAIS un mot ni la lecture d'un chiffre
 * (valeur ET unité), ne touche ni la phrase-choc ni la question de commentaire, et une coupe qui fait apparaître un
 * refus nouveau est jetée. Tout est réel (aucun double), sauf le jugement d'un seul test (refus nouveau après coupe).
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import type { CarteImage } from "@/domaine/image-video/carte";
import { motsDits, phrasesDe, type FicheImage } from "@/domaine/image-video/fiche";
import { ficheSimulee } from "@/moteurs/montage-image-video/ecriture.simulation";
import { couperPhrasesLongues, reparerPhrasesLonguesIV } from "@/moteurs/montage-image-video/reparation-script";
import { cleFormule, lectureChiffres, verifierScript, type ContexteRegles } from "@/moteurs/montage-image-video/regles";

const etat = vi.hoisted(() => ({ nouveauRefus: false }));
vi.mock("@/moteurs/montage-image-video/regles", async (importOriginal) => {
  const reel = await importOriginal<typeof import("@/moteurs/montage-image-video/regles")>();
  return {
    ...reel,
    // Seul le test « refus nouveau » allume l'interrupteur : un refus Q04 apparaît dès qu'un écran contient une coupe.
    verifierScript: (f: FicheImage, c: ContexteRegles) => {
      const v = reel.verifierScript(f, c);
      if (etat.nouveauRefus && f.ecrans.some((e) => e.texteDit.includes(". Plus de temps"))) v.manquements.push({ regle: "Q04", priorite: 5, message: "Écran e01 : refus nouveau." });
      return v;
    },
  };
});

const carte = JSON.parse(readFileSync(join(process.cwd(), "tests/image-video/fixtures/cartes/D.json"), "utf8")) as CarteImage;
const GARDER = Object.fromEntries(["dès le premier jour", "0 demande perdue", "toujours", "0 question sans réponse", "risque erreur : zéro", "Zéro erreur"].map((f) => [cleFormule(f), "garder" as const]));
const ctx: ContexteRegles = { carte, choixFormules: GARDER };
const fiche = () => structuredClone(ficheSimulee("essai-d")!);

const lecture = (t: string) => {
  const l = lectureChiffres(t);
  return { chiffres: l.chiffres.map((c) => [c.valeur, c.unite]), calculs: l.calculs };
};
const motsNus = (t: string) => motsDits(t).map((m) => m.toLowerCase().replace(/[^\p{L}\p{N}]/gu, ""));
/** Invariants d'une coupe réussie : mêmes mots, même nombre, même lecture des chiffres, plus aucune phrase de plus de 12 mots. */
function invariants(avant: string, apres: string) {
  expect(motsNus(apres)).toEqual(motsNus(avant));
  expect(motsDits(apres)).toHaveLength(motsDits(avant).length);
  expect(lecture(apres)).toEqual(lecture(avant));
}
const toutesCourtes = (t: string) => phrasesDe(t).every((p) => motsDits(p).length <= 12);

const TREIZE = "Moins de tâches répétitives, plus de temps pour vos clients et votre croissance";

describe("couperPhrasesLongues · coupes", () => {
  it("phrase de treize mots : coupée après la virgule, mêmes mots", () => {
    expect(motsDits(TREIZE)).toHaveLength(13);
    const r = couperPhrasesLongues(TREIZE);
    expect(r).toBe("Moins de tâches répétitives. Plus de temps pour vos clients et votre croissance");
    invariants(TREIZE, r);
    expect(toutesCourtes(r)).toBe(true);
  });

  it("phrase de 30 mots avec une virgule et un mot de liaison : trois morceaux de 12 mots au plus", () => {
    const t = "Chaque matin vous ouvrez votre boîte, vous triez les messages reçus pendant la nuit, puis vous répondez à chaque personne, vous passez enfin à votre vraie tâche du jour";
    expect(motsDits(t).length).toBeGreaterThan(28);
    const r = couperPhrasesLongues(t);
    expect(r).not.toBe(t);
    invariants(t, r);
    expect(toutesCourtes(r)).toBe(true);
    expect(r).toBe("Chaque matin vous ouvrez votre boîte. Vous triez les messages reçus pendant la nuit. Puis vous répondez à chaque personne. Vous passez enfin à votre vraie tâche du jour");
  });

  it("phrase de 30 mots sans aucune frontière sûre : NON modifiée", () => {
    const t = "Vous ouvrez votre boîte chaque matin et vous triez des dizaines de messages un par un en lisant tout ce qui arrive dans la journée pour ensuite répondre à chaque personne";
    expect(motsDits(t).length).toBeGreaterThan(28);
    expect(couperPhrasesLongues(t)).toBe(t);
  });

  it("une phrase de 12 mots ou moins n'est jamais touchée", () => {
    const t = "Moins de tâches, plus de temps pour vos clients et votre croissance";
    expect(couperPhrasesLongues(t)).toBe(t);
  });

  it("le retour à la ligne et les espaces d'origine sont conservés", () => {
    const t = "Moins de tâches répétitives,\nplus de temps pour vos clients et votre croissance.  Ensuite, on continue";
    const r = couperPhrasesLongues(t);
    expect(r).toBe("Moins de tâches répétitives.\nPlus de temps pour vos clients et votre croissance.  Ensuite, on continue");
    invariants(t, r);
  });

  it("guillemet ouvrant : la lettre qui suit prend la majuscule", () => {
    for (const ouvrant of ["«plus", "« plus", "\"plus"]) {
      const t = `Moins de tâches répétitives, ${ouvrant} de temps pour vos clients et votre croissance`;
      const r = couperPhrasesLongues(t);
      expect(r).toContain(ouvrant.replace("plus", "Plus"));
      expect(r).toContain("répétitives. ");
      invariants(t, r);
    }
  });

  it("deux phrases longues dans le même texte : chacune est coupée", () => {
    const t = `${TREIZE}. ${TREIZE}`;
    const r = couperPhrasesLongues(t);
    expect(toutesCourtes(r)).toBe(true);
    invariants(t, r);
  });
});

describe("couperPhrasesLongues · le sens ne casse jamais", () => {
  it.each([
    "Avec notre assistant vous ne payez que ce que vous utilisez vraiment chaque mois sans aucun engagement de votre part",
    "Plus jamais un seul client important de votre entreprise sans réponse rapide le soir ou le week-end",
    "Les clients de votre cabinet qui paient en retard reçoivent un rappel poli et automatique tous les matins",
    "Votre équipe devient deux fois plus rapide que la concurrence pour répondre à chaque demande entrante du jour",
    "Vous gagnez du temps grâce à notre assistant qui répond à vos clients à toute heure de la journée",
  ])("sans virgule, devant qui, que, sans, ne… que : NON modifiée (%#)", (t) => {
    expect(motsDits(t).length).toBeGreaterThan(12);
    expect(couperPhrasesLongues(t)).toBe(t);
  });

  it.each([
    "Plus jamais un seul client important de votre entreprise, sans réponse rapide le soir ou le week-end",
    "Les clients de votre cabinet, qui paient en retard, reçoivent un rappel poli et automatique tous les matins",
    "Votre équipe devient deux fois plus rapide, que la concurrence pour répondre à chaque demande entrante du jour",
    "Notre assistant, disponible jour et nuit, répond à toutes vos questions en quelques secondes",
    "Vous ne laissez, désormais, plus aucun client sans réponse le soir ou le week-end",
    "Vous gérez les devis, les factures, les relances clients et les rendez-vous de toute votre équipe",
    "Votre équipe répond à chaque client, plus vite que la concurrence et sans effort",
    "Vous suivez toutes vos relances, c'est-à-dire les e-mails que vos clients attendent chaque matin",
    "Vous gagnez du temps sur vos échanges clients, grâce à notre assistant qui répond la nuit",
    "Votre assistant répond à chaque client de votre cabinet chaque matin, dont les plus pressés et les plus exigeants",
    "Votre assistant répond à chaque client de votre cabinet chaque matin, comme le ferait un vrai collaborateur humain",
    "Votre assistant répond à chaque client de votre cabinet chaque matin, si vous le souhaitez vraiment ainsi",
    "Votre assistant répond à chaque client de votre cabinet chaque matin, lorsque vous êtes absent du bureau",
    "Votre assistant répond à chaque client de votre cabinet chaque matin, afin que personne n'attende trop longtemps",
    "Votre assistant répond à chaque client de votre cabinet chaque matin, après avoir lu tout le courrier reçu",
    "Votre assistant répond à chaque client de votre cabinet chaque matin, avant même que vous soyez arrivé au bureau",
    "Vous ne payez pas de frais cachés chaque mois, vous gardez le contrôle de votre budget et de vos dépenses",
    "Vous ne payez rien de caché chaque mois, vous gardez le contrôle de votre budget et de vos dépenses",
    "Si vous automatisez enfin toutes vos relances clients, vous gagnez du temps chaque semaine",
    "Avec un assistant IA bien réglé, vous répondez à chaque client en moins d'une minute",
    "Ce que vos clients attendent vraiment chaque matin, c'est une réponse rapide et claire",
    "Vous travaillez tard chaque soir au bureau, alors que vos concurrents dorment déjà tranquillement",
    "Vous automatisez vos relances clients, ce qui libère du temps pour toute votre équipe",
  ])("liste blanche : coupe refusée, texte INCHANGÉ (%#)", (t) => {
    expect(motsDits(t).length).toBeGreaterThan(12);
    const r = couperPhrasesLongues(t);
    expect(r).toBe(t);
  });

  it("négation ouverte à gauche : jamais coupée ; négation fermée : coupée", () => {
    const ouverte = "Vous ne gérez, seul, chaque dossier de vos clients ce matin, nous le faisons avec vous chaque jour";
    expect(couperPhrasesLongues(ouverte)).toBe(ouverte);
    const ferme = "Vous ne perdez jamais un seul message de vos clients ce matin, nous le gérons pour vous chaque jour";
    expect(couperPhrasesLongues(ferme)).toBe("Vous ne perdez jamais un seul message de vos clients ce matin. Nous le gérons pour vous chaque jour");
  });

  it.each([
    [
      "Moins de tâches répétitives, plus de temps pour vos clients et votre croissance",
      "Moins de tâches répétitives. Plus de temps pour vos clients et votre croissance",
    ],
    [
      "Vous gagnez du temps chaque jour sur vos tâches, mais vous gardez le contrôle de chaque étape importante",
      "Vous gagnez du temps chaque jour sur vos tâches. Mais vous gardez le contrôle de chaque étape importante",
    ],
    [
      "Votre assistant lit chaque message reçu dans la journée, il propose ensuite une réponse claire à valider",
      "Votre assistant lit chaque message reçu dans la journée. Il propose ensuite une réponse claire à valider",
    ],
  ])("cas positifs : coupée devant le bon mot, mots et chiffres identiques (%#)", (t, attendu) => {
    const r = couperPhrasesLongues(t);
    expect(r).toBe(attendu);
    expect(motsNus(r)).toEqual(motsNus(t));
    expect(lecture(r)).toEqual(lecture(t));
  });

  it("devant mais, donc, car, puis, alors : coupe permise après la virgule", () => {
    const t = "Vous ouvrez votre boîte chaque matin tôt, puis vous répondez calmement à chaque personne qui vous écrit";
    expect(couperPhrasesLongues(t)).toBe("Vous ouvrez votre boîte chaque matin tôt. Puis vous répondez calmement à chaque personne qui vous écrit");
  });

  it("une question n'est jamais coupée", () => {
    const t = "Combien de temps perdez-vous chaque semaine, à trier vos messages, puis à répondre à tout le monde ?";
    expect(motsDits(t).length).toBeGreaterThan(12);
    expect(couperPhrasesLongues(t)).toBe(t);
    const m = `${TREIZE}. ${t}`;
    expect(couperPhrasesLongues(m)).toBe(`Moins de tâches répétitives. Plus de temps pour vos clients et votre croissance. ${t}`);
  });

  it.each(["au lieu de douze heures", "contre trois jours", "chez vos clients actuels", "pour vos clients"])("morceau de droite en « %s » : pas de coupe", (g) => {
    const t = `Vous traitez maintenant chaque demande reçue en une matinée, ${g} de travail manuel pénible et lent`;
    expect(couperPhrasesLongues(t)).toBe(t);
  });
});

describe("couperPhrasesLongues · un nombre dit ne change jamais de lecture", () => {
  const SUITE = "puis nous avons tout mis en place pour vous ce matin";
  const GROUPES = [
    "trente et une minutes",
    "quatre-vingt-quinze pour cent",
    "trois heures et demie",
    "deux virgule cinq heures",
    "chaque semaine",
    "au lieu de douze",
    "vingt-quatre heures sur vingt-quatre",
    "deux heures vingt",
  ];

  it.each(GROUPES)("« %s » : jamais séparé, texte inchangé", (g) => {
    for (const t of [`Ce mois-ci nous avons prévu ${g}, ${SUITE}`, `Ce mois-ci nous avons prévu ${g} ${SUITE}`]) {
      expect(motsDits(t).length).toBeGreaterThan(12);
      const r = couperPhrasesLongues(t);
      expect(r).toBe(t);
      invariants(t, r);
    }
  });

  it("« vingt et un dossiers » : le seul endroit sûr est après « dossiers, » et pas avant « et »", () => {
    const t = "Nous avons réglé vingt et un dossiers, donc vos équipes respirent enfin beaucoup mieux ce mois-ci";
    const r = couperPhrasesLongues(t);
    expect(r).toBe("Nous avons réglé vingt et un dossiers. Donc vos équipes respirent enfin beaucoup mieux ce mois-ci");
    invariants(t, r);
  });

  it("la virgule collée à un nombre ou à une unité n'est jamais une coupe", () => {
    const t = "Cette semaine nous avons gagné trois heures et demie, puis nous avons tout mis en place pour vous";
    expect(couperPhrasesLongues(t)).toBe(t);
    const u = "Chaque lundi nous relisons le travail fait ces deux dernières semaines, avec attention pour tout vérifier ensuite";
    expect(couperPhrasesLongues(u)).toBe(u);
  });
});

describe("reparerPhrasesLonguesIV · fiche", () => {
  const cible = (f: FicheImage) => f.ecrans.find((e) => e.partie === "douleur")!;

  it("seule la phrase trop longue est coupée : la fiche passe, tout le reste est identique", () => {
    const f = fiche();
    const e = cible(f);
    const avant = e.texteDit;
    e.texteDit = TREIZE;
    e.surMot = [{ mot: 0, action: "apparait" }];
    expect(verifierScript(f, ctx).manquements.some((m) => m.regle === "Q09")).toBe(true);
    const r = reparerPhrasesLonguesIV(f, ctx);
    expect(r).not.toBeNull();
    expect(r!.refus).toEqual([]);
    expect(r!.coupes).toEqual([`écran ${e.id}`]);
    const apres = cible(r!.fiche);
    expect(apres.texteDit).toBe("Moins de tâches répétitives. Plus de temps pour vos clients et votre croissance");
    invariants(TREIZE, apres.texteDit);
    expect(apres.surMot).toEqual(e.surMot);
    expect(r!.fiche.ecrans.filter((x) => x.id !== e.id)).toEqual(f.ecrans.filter((x) => x.id !== e.id));
    expect(avant).not.toBe(TREIZE);
  });

  it("une accroche trop longue est coupée aussi", () => {
    const f = fiche();
    f.accroches[1].texteDit = TREIZE;
    const r = reparerPhrasesLonguesIV(f, ctx);
    expect(r?.coupes).toEqual(["accroche 2"]);
    // L'accroche reste trop longue pour son plafond propre (8 mots) : ce refus-là n'est pas celui de la coupe.
    expect(r?.refus.every((m) => m.startsWith("L'accroche"))).toBe(true);
  });

  it("phrase-choc de 14 mots : jamais modifiée ; question de commentaire : jamais modifiée", () => {
    const f = fiche();
    const choc = f.ecrans.find((e) => e.partie === "phrase-choc")!;
    choc.texteDit = "Vous gagnez du temps, vous gardez vos clients, et vous dormez enfin beaucoup mieux chaque soir";
    expect(motsDits(choc.texteDit).length).toBeGreaterThan(12);
    f.questionCommentaire.texteDit = "Et chez vous, combien de messages attendent encore jusqu'au lendemain matin dans votre boîte ?";
    expect(motsDits(f.questionCommentaire.texteDit).length).toBeGreaterThan(12);
    // Rien d'autre à couper : pas de réparation.
    expect(reparerPhrasesLonguesIV(f, ctx)).toBeNull();
    // Une phrase longue ailleurs est coupée, la phrase-choc et la question restent telles quelles.
    cible(f).texteDit = TREIZE;
    const r = reparerPhrasesLonguesIV(f, ctx);
    expect(r?.coupes).toEqual([`écran ${cible(f).id}`]);
    expect(r!.fiche.ecrans.find((e) => e.partie === "phrase-choc")!.texteDit).toBe(choc.texteDit);
    expect(r!.fiche.questionCommentaire).toEqual(f.questionCommentaire);
    // Ses refus Q09 restent sur le texte d'origine de Claude.
    expect(r!.refus.some((m) => m.includes("phrase de"))).toBe(true);
  });

  it("une fiche déjà bonne, ou illisible, n'est pas touchée", () => {
    expect(reparerPhrasesLonguesIV(fiche(), ctx)).toBeNull();
    expect(reparerPhrasesLonguesIV({ n: 1 }, ctx)).toBeNull();
  });

  it("un refus Q09 dont le message cite le texte (chiffres en lettres) ne bloque pas : comparaison par règle + écran", () => {
    const f = fiche();
    const e = cible(f);
    e.texteDit = `${TREIZE}. Nous gardons 3 clients`;
    const r = reparerPhrasesLonguesIV(f, ctx);
    expect(r).not.toBeNull();
    expect(r!.coupes).toEqual([`écran ${e.id}`]);
    expect(cible(r!.fiche).texteDit).toContain("répétitives. Plus de temps");
    expect(r!.refus.some((m) => m.includes("chiffres se disent en lettres"))).toBe(true);
  });

  it("un refus NOUVEAU après la coupe : la réparation est jetée", () => {
    const f = fiche();
    cible(f).texteDit = TREIZE;
    expect(reparerPhrasesLonguesIV(f, ctx)).not.toBeNull();
    etat.nouveauRefus = true;
    try {
      expect(reparerPhrasesLonguesIV(f, ctx)).toBeNull();
    } finally {
      etat.nouveauRefus = false;
    }
  });
});
