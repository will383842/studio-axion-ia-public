/**
 * LES CONTRÔLES GRATUITS DU GABARIT CADRÉ (REGLES § 3 quater, 15/10) : pour chacun, l'exemple validé par Will passe
 * et un cas précis est refusé. Lot B1 (18/10) : les blocs 1 à 3 (constats « ce qui change », promesse) et l'avant / après
 * se jouent sur le témoin v5 ; les autres contrôles (gain, « à retenir », entreprise, répétitions, formules, métier,
 * nombres), que le lot B1 ne touche pas, gardent les phrases de l'ancien témoin v4 comme données de test. Puis l'avant / après : le script réel du 15/10 (v-d3e2a726cf0c, noté 10 sur 10 par
 * l'ancienne relecture) est REFUSÉ, l'exemple validé est ACCEPTÉ ; les quatre témoins v3 ne passent plus.
 */
import { describe, expect, it } from "vitest";
import { QUESTIONS_IA, type DemandeScriptTableau, type EcritureScript } from "@/domaine/scripts-tableau";
import {
  aDesEliminatoires,
  appliquerCorrections,
  bornesEtape,
  controlerARetenir,
  controlerEcriture,
  controlerEtapes,
  controlerFormules,
  controlerGain,
  controlerMetier,
  controlerMots,
  controlerNombres,
  controlerPhraseEntreprise,
  controlerPromesse,
  controlerRepetitionMots,
  texteDitDe,
} from "@/domaine/scripts-tableau-controles";
import { BORNES_PASSAGES, MOTS_SCRIPT, REPERE_CONSTAT, compterMots, motsParPassage } from "@/domaine/scripts-tableau-controles";
import { exempleV4 } from "./exemples-v4";
import { exempleV5 } from "./exemples-v5";
import { EXEMPLES_V3, ecritureV3 } from "./exemples-v3";
import { DEMANDE_1510, ecriture1510, scenes1510 } from "./script-15-10";

const VALIDE = () => exempleV4("01-formation");
const valide = (): EcritureScript => VALIDE().ecriture;
const codes = (d: { code: string }[]) => [...new Set(d.map((x) => x.code))];
const p = (dit: string, ecran = "Deux mots") => ({ dit, ecran });
const avec = (f: (e: EcritureScript) => void): EcritureScript => {
  const e = valide();
  f(e);
  return e;
};

const v5 = () => exempleV5("01-continuite").ecriture;
const avec5 = (f: (e: EcritureScript) => void): EcritureScript => {
  const e = v5();
  f(e);
  return e;
};

describe("1. nombre de constats « ce qui change » : 2 à 3, 3 par défaut (lot B1)", () => {
  it("passe : 3 constats ; 2 constats", () => {
    expect(controlerEtapes(v5().script)).toEqual([]);
    expect(codes(controlerEtapes(avec5((e) => e.script.etapes.pop()).script))).toEqual([]);
  });
  it("refusé : un seul constat, quatre constats (l'ancien plafond de 5 est tombé), ou quatre en 30 s", () => {
    expect(codes(controlerEtapes(avec5((e) => (e.script.etapes = e.script.etapes.slice(0, 1))).script))).toEqual(["nombre-etapes"]);
    const quatre = avec5((e) => e.script.etapes.push({ action: p("Le suivi se met à jour sans qu'on y pense."), comment: [p("Un nom oublié se voit.")] }));
    expect(codes(controlerEtapes(quatre.script))).toEqual(["nombre-etapes"]);
    expect(codes(controlerEtapes(quatre.script, { duree: 30 }))).toEqual(["nombre-etapes"]);
  });
});

describe("2. la promesse n'annonce plus un nombre d'étapes (remarque, jamais éliminatoire)", () => {
  it("passe : le gain pour le spectateur, « trois lignes » n'est pas un nombre d'étapes", () => {
    expect(controlerPromesse(v5().script)).toEqual([]);
  });
  it("relevé : « Trois réflexes à prendre », « Cinq gestes » ; jamais éliminatoire", () => {
    for (const dit of ["Trois réflexes à prendre avant de coller.", "Cinq gestes pour reprendre un dossier.", "Deux étapes suffisent."]) {
      const d = controlerPromesse(avec5((e) => (e.script.promesse[0].dit = dit)).script);
      expect(codes(d), dit).toEqual(["promesse-nombre"]);
      expect(aDesEliminatoires(d), dit).toBe(false);
    }
  });
});

describe("3. constats courts : 2 phrases et 28 mots au plus (1 phrase et 16 mots en 30 s)", () => {
  it("passe : les trois constats du témoin v5", () => {
    expect(bornesEtape(60)).toEqual({ motsMax: 28, phrasesMax: 2 });
    expect(bornesEtape(30)).toEqual({ motsMax: 16, phrasesMax: 1 });
    expect(controlerEtapes(v5().script)).toEqual([]);
  });
  it("refusé : une troisième phrase, ou un mot de trop", () => {
    const trois = avec5((e) => e.script.etapes[1].comment.push(p("C'est rapide."), p("Et sûr.")));
    expect(controlerEtapes(trois.script)[0].message).toMatch(/Le constat 2 dit 3 phrases après l'action : 2 au plus/);
    const long = avec5((e) => (e.script.etapes[0].comment[0].dit = "Où en est le dossier, ce qui a été promis, la prochaine étape, et la date du prochain contact avec lui."));
    expect(controlerEtapes(long.script)[0].message).toMatch(/Le constat 1 fait \d+ mots : 28 au plus/);
  });
  it("30 s : une seule phrase concrète par constat", () => {
    const deux = avec5((e) => e.script.etapes[0].comment.push(p("C'est rapide.")));
    expect(controlerEtapes(deux.script, { duree: 30 }).map((d) => d.code)).toContain("etape-longue");
  });
});

describe("4. bornes de mots : 125 à 145 (60 s, lot B2b), 75 à 95 (30 s), et chaque passage", () => {
  it("passe : 144 mots hors question sur l'IA (témoin v5, décompte de controlerMots), chaque passage dans sa borne", () => {
    // controlerMots ne compte pas la question sur l'IA : 150 mots dits au total, 144 hors question.
    expect(compterMots(texteDitDe(v5().script))).toBe(150);
    expect(motsHorsQuestion(v5().script)).toBe(144);
    expect(controlerMots(v5().script)).toEqual([]);
  });
  it("refusé : un script trop long, une douleur trop courte, un exemple trop long", () => {
    expect(codes(controlerMots(v5().script, { duree: 30 }))).toEqual(["script-mots", "passage-mots"]);
    // Le budget de l'ancien gabarit (187 mots) dépasse le nouveau maximum de 145.
    expect(controlerMots(valide().script).map((d) => d.message)).toContain("Le script fait 187 mots : 125 à 145 pour une vidéo de 60 s.");
    const douleur = avec((e) => (e.script.douleur = e.script.douleur.slice(0, 3)));
    expect(controlerMots(douleur.script).map((d) => d.message)).toEqual(expect.arrayContaining([expect.stringMatching(/^La douleur fait 9 mots : 19 à 25 visés/)]));
    const exemple = avec((e) => e.script.exemple.phrases.push(p("Elle a gagné du temps sur chaque relance de la semaine.")));
    expect(controlerMots(exemple.script).map((d) => d.message)).toEqual(expect.arrayContaining([expect.stringMatching(/^L'exemple fait 50 mots/), expect.stringMatching(/^Le script fait 198 mots : 125 à 145/)]));
  });
});

const PASSAGES = ["accroche", "douleur", "promesse", "exemple", "fin"] as const;
const milieu = ([a, b]: readonly [number, number]) => (a + b) / 2;
/** Mots dits hors question sur l'IA (le décompte de `controlerMots`). */
const motsHorsQuestion = (s: EcritureScript["script"]) => {
  const { constats, ...passages } = motsParPassage(s);
  return Object.values(passages).reduce((t, n) => t + n, 0) + constats.reduce((t, n) => t + n, 0);
};

describe("4 bis. les repères des passages tiennent dans le budget de 125 à 145 mots (5e passe)", () => {
  it("la somme des MILIEUX des 5 passages + 3 × le milieu du constat vaut le milieu de 125-145 (135 mots)", () => {
    const b = BORNES_PASSAGES[60];
    const somme = PASSAGES.reduce((t, k) => t + milieu(b[k].repere), 0) + 3 * milieu(REPERE_CONSTAT[60]);
    expect(REPERE_CONSTAT[60]).toEqual([14, 20]);
    expect(somme).toBeGreaterThanOrEqual(MOTS_SCRIPT[60].min);
    expect(somme).toBeLessThanOrEqual(MOTS_SCRIPT[60].max);
    expect(Math.abs(somme - (MOTS_SCRIPT[60].min + MOTS_SCRIPT[60].max) / 2)).toBeLessThanOrEqual(1);
  });
  it("30 s : même budget, milieux des repères + 3 milieux de constat dans 75-95", () => {
    const b = BORNES_PASSAGES[30];
    const somme = PASSAGES.reduce((t, k) => t + milieu(b[k].repere), 0) + 3 * milieu(REPERE_CONSTAT[30]);
    expect(somme).toBeGreaterThanOrEqual(MOTS_SCRIPT[30].min);
    expect(somme).toBeLessThanOrEqual(MOTS_SCRIPT[30].max);
  });
  it("chaque repère est inclus dans sa limite dure (refus)", () => {
    for (const d of [60, 30] as const)
      for (const k of PASSAGES) {
        const { repere, refus } = BORNES_PASSAGES[d][k];
        expect(repere[0], `${k} ${d}`).toBeGreaterThanOrEqual(refus[0]);
        expect(repere[1], `${k} ${d}`).toBeLessThanOrEqual(refus[1]);
      }
  });
  it("le témoin v5 respecte CHAQUE repère (cinq passages et trois constats), sans remarque", () => {
    const m = motsParPassage(v5().script);
    for (const k of PASSAGES) {
      const [a, b] = BORNES_PASSAGES[60][k].repere;
      expect(m[k], k).toBeGreaterThanOrEqual(a);
      expect(m[k], k).toBeLessThanOrEqual(b);
    }
    expect(m.constats).toHaveLength(3);
    for (const n of m.constats) {
      expect(n).toBeGreaterThanOrEqual(REPERE_CONSTAT[60][0]);
      expect(n).toBeLessThanOrEqual(REPERE_CONSTAT[60][1]);
    }
    expect(controlerMots(v5().script)).toEqual([]);
  });
  it("sous les limites dures, un repère dépassé est une REMARQUE (non éliminatoire) ; à l'extrême, un refus", () => {
    const rallonge = (mots: number) =>
      avec5((x) => {
        x.script.douleur[1].dit = `On fouille la boîte mail ${Array.from({ length: mots }, () => "encore").join(" ")}.`;
      });
    // Douleur : 25 mots au repère haut ; 28 mots = au-delà du repère, sous la limite dure (30) : remarque.
    const douleur28 = controlerMots(rallonge(5).script).filter((d) => d.code === "passage-mots");
    expect(douleur28).toHaveLength(1);
    expect(douleur28[0].eliminatoire).toBe(false);
    expect(douleur28[0].message).toMatch(/^La douleur fait 28 mots : 19 à 25 visés/);
    // 31 mots : au-delà de la limite dure (30) : refus.
    const douleur31 = controlerMots(rallonge(8).script).filter((d) => d.code === "passage-mots");
    expect(douleur31.map((d) => d.eliminatoire)).toEqual([true]);
    // Un constat hors de 14 à 20 mots mais sous les 28 mots : remarque seulement.
    const court = avec5((x) => (x.script.etapes[1].comment[0].dit = "Plus de fouille."));
    const rem = controlerMots(court.script).filter((d) => d.code === "passage-mots");
    expect(rem.map((d) => d.eliminatoire)).toEqual([false]);
    expect(rem[0].message).toMatch(/^Le constat 2 fait \d+ mots : 14 à 20 visés/);
  });
  it("les repères sont ceux du budget de 135 mots", () => {
    expect(BORNES_PASSAGES[60].accroche.repere).toEqual([7, 10]);
    expect(BORNES_PASSAGES[60].douleur.repere).toEqual([19, 25]);
    expect(BORNES_PASSAGES[60].promesse.repere).toEqual([10, 15]);
    expect(BORNES_PASSAGES[60].exemple.repere).toEqual([18, 24]);
    expect(BORNES_PASSAGES[60].fin.repere).toEqual([17, 23]);
  });
});

describe("5. le gain : non vide, avec son unité, dans la promesse ET dans l'exemple", () => {
  it("passe : « Six lignes collées au lieu de tout le fil de mails », unité « lignes »", () => {
    expect(controlerGain(valide())).toEqual([]);
  });
  it("passe : une unité courte (« min », « h ») dite telle quelle (relecture A09)", () => {
    const min = avec((e) => {
      e.gain = { formule: "Dix min gagnées à coller", unite: "min" };
      e.script.exemple.phrases[3].dit = "La relance part en dix min, et les données du client restent chez vous.";
    });
    expect(controlerGain(min)).toEqual([]);
    expect(codes(controlerGain(avec((e) => (e.gain = { formule: "Dix min gagnées à coller", unite: "min" }))))).toEqual(["gain-hors-exemple"]);
  });
  it("refusé : vide, sans unité, absent de la promesse, absent de l'exemple", () => {
    expect(codes(controlerGain(avec((e) => (e.gain = { formule: "", unite: "" }))))).toEqual(["gain-absent"]);
    expect(controlerGain(avec((e) => (e.gain.unite = "minutes")))[0].message).toMatch(/n'est pas un mot de sa formule/);
    expect(codes(controlerGain(avec((e) => (e.script.promesse[0].dit = "Trois réflexes à prendre tout de suite."))))).toEqual(["gain-hors-promesse"]);
    expect(codes(controlerGain(avec((e) => (e.script.exemple.phrases[2].dit = "Maintenant, elle colle le strict nécessaire : Client A, sans coordonnées."))))).toEqual(["gain-hors-exemple"]);
  });
});

describe("6. « À retenir » = l'idée en une phrase, pas une liste de verbes", () => {
  it("passe : « Ce qui permet de reconnaître votre client ne se colle pas. »", () => {
    expect(controlerARetenir(valide())).toEqual([]);
  });
  it("refusé : une liste de verbes, les verbes des étapes, une idée absente ou non dite", () => {
    expect(codes(controlerARetenir(avec((e) => (e.script.aRetenir = [p("À retenir : remplacez, effacez, coupez, relisez.")]))))).toContain("a-retenir-liste");
    expect(codes(controlerARetenir(avec((e) => (e.script.aRetenir = [p("Remplacez les noms et coupez la signature avant de coller.")]))))).toEqual(["a-retenir-liste"]);
    expect(codes(controlerARetenir(avec((e) => (e.idee = ""))))).toEqual(["idee-absente"]);
    expect(controlerARetenir(avec((e) => (e.script.aRetenir = [p("La relance part plus vite le lundi matin.")])))[0].message).toMatch(/ne dit pas l'idée du script/);
  });
});

describe("7. la phrase sur l'entreprise est liée à l'idée et cohérente avec le corps", () => {
  it("passe : « Axion-IA forme les équipes à ces réflexes. » ; et sans phrase sur l'entreprise", () => {
    expect(controlerPhraseEntreprise(valide())).toEqual([]);
    expect(controlerPhraseEntreprise(avec((e) => e.script.appel.shift()))).toEqual([]);
  });
  it("passe : « un seul de ces réflexes », « une seule habitude » ne disent pas « sans aide » (relecture A09)", () => {
    expect(controlerPhraseEntreprise(avec((e) => (e.script.etapes[0].comment[1].dit = "Un seul de ces réflexes protège déjà le client.")))).toEqual([]);
    expect(controlerPhraseEntreprise(avec((e) => (e.script.etapes[0].comment[1].dit = "Une seule de ces habitudes protège déjà le client.")))).toEqual([]);
    // Ni en tête de phrase, ni après une négation : ce n'est pas « faites-le seul ».
    for (const dit of ["Seul, vous perdez une heure avec ces réflexes.", "Avec ces réflexes, vous n'êtes pas seul."])
      expect(controlerPhraseEntreprise(avec((e) => (e.script.etapes[0].comment[1].dit = dit))), dit).toEqual([]);
  });
  it("« -le seul » / « -les seuls » (pronom après trait d'union) refusés ; « Seul, vous… » et « pas seul » acceptés (relecture A09)", () => {
    const corps = (t: string) => avec((e) => (e.script.promesse[0].dit = t));
    const etape = (t: string) => avec((e) => (e.script.etapes[0].comment[1].dit = t));
    expect(codes(controlerPhraseEntreprise(corps("Trois réflexes, faites-le seul.")))).toEqual(["entreprise-incoherente"]);
    expect(codes(controlerPhraseEntreprise(corps("Trois réflexes : Faites-les seuls.")))).toEqual(["entreprise-incoherente"]);
    expect(controlerPhraseEntreprise(etape("Seul, vous perdez une heure."))).toEqual([]);
    expect(controlerPhraseEntreprise(etape("Vous n'êtes pas seul."))).toEqual([]);
  });
  it("refusé : « faites-le seul » ou « tout seuls » dans le corps, puis « Axion forme les équipes à ces réflexes »", () => {
    expect(codes(controlerPhraseEntreprise(avec((e) => (e.script.promesse[0].dit = "Trois réflexes à prendre seul, avant de coller."))))).toEqual(["entreprise-incoherente"]);
    expect(codes(controlerPhraseEntreprise(avec((e) => (e.script.promesse[0].dit = "Trois réflexes que les équipes prennent tout seuls."))))).toEqual(["entreprise-incoherente"]);
    // Le pronom accroché par un trait d'union compte (seconde lecture A09).
    for (const dit of ["Trois réflexes : faites-le seul.", "Faites-les seuls, avant de coller trois réflexes."])
      expect(codes(controlerPhraseEntreprise(avec((e) => (e.script.promesse[0].dit = dit)))), dit).toEqual(["entreprise-incoherente"]);
  });
  it("refusé : « formez-les vous-même » dans le corps puis « Axion forme » ; une phrase sans lien avec l'idée", () => {
    const contredit = avec((e) => (e.script.promesse[0].dit = "Trois réflexes pour les former vous-même avant de coller."));
    expect(codes(controlerPhraseEntreprise(contredit))).toEqual(["entreprise-incoherente"]);
    expect(codes(controlerPhraseEntreprise(avec((e) => (e.script.appel[0].dit = "Axion-IA automatise aussi vos factures."))))).toEqual(["entreprise-sans-lien"]);
  });
});

describe("8. aucune suite de 3 mots dite deux fois", () => {
  it("passe : l'exemple validé", () => {
    expect(controlerRepetitionMots(texteDitDe(valide().script))).toEqual([]);
  });
  it("refusé : « sur leurs vraies tâches » dite deux fois", () => {
    expect(codes(controlerRepetitionMots("Formez-les sur leurs vraies tâches. Axion les forme sur leurs vraies tâches."))).toEqual(["repetition-mots"]);
    // Des mots vides seuls (« il y a ») ne comptent pas.
    expect(controlerRepetitionMots("Il y a un devis. Il y a une relance.")).toEqual([]);
  });
});

describe("9. formules creuses éliminatoires, jargon signalé", () => {
  it("passe : l'exemple validé n'a ni formule creuse ni jargon", () => {
    expect(controlerFormules(texteDitDe(valide().script))).toEqual([]);
  });
  it("refusé : « votre parole est en jeu », « le bon geste » ; signalé (non éliminatoire) : « paramètres »", () => {
    expect(controlerFormules("Si le client l'apprend, votre parole est en jeu.")).toMatchObject([{ code: "formule-creuse", eliminatoire: true }]);
    expect(controlerFormules("Tous ont fait le bon geste.")).toMatchObject([{ code: "formule-creuse", eliminatoire: true }]);
    expect(controlerFormules("Ouvrez les paramètres.")).toMatchObject([{ code: "jargon", eliminatoire: false }]);
    expect(controlerFormules("Gardez un modèle de relance.")).toEqual([]);
  });
});

describe("10. le métier de l'exemple change (jamais celui des 3 derniers scripts)", () => {
  it("passe : « assistante » après plombier, comptable, agent immobilier ; sans historique, contrôle désactivé", () => {
    expect(controlerMetier(valide(), ["plombier", "comptable", "agent immobilier"])).toEqual([]);
    expect(controlerMetier(avec((e) => (e.metierExemple = "plombier")), undefined)).toEqual([]);
    expect(controlerMetier(avec((e) => (e.metierExemple = "plombier")), [])).toEqual([]);
  });
  it("refusé : « plomberie » quand un plombier est dans les 3 derniers ; un métier non dit avec un historique", () => {
    expect(codes(controlerMetier(avec((e) => (e.metierExemple = "plomberie")), ["comptable", "plombier"]))).toEqual(["metier-repete"]);
    expect(controlerMetier(avec((e) => (e.metierExemple = "")), ["comptable"])[0].message).toMatch(/n'est pas dit/);
    // Seuls les 3 derniers comptent.
    expect(controlerMetier(avec((e) => (e.metierExemple = "plombier")), ["comptable", "fleuriste", "boulanger", "plombier"])).toEqual([]);
  });
});

describe("11. les nombres de l'accroche et de l'exemple se tiennent", () => {
  it("passe : « trois données » dans l'accroche, « six lignes » dans l'exemple (autre unité)", () => {
    expect(controlerNombres(valide().script)).toEqual([]);
  });
  it("refusé : « trois données » puis « deux données »", () => {
    const e = avec((x) => (x.script.exemple.phrases[3].dit = "La relance est aussi utile, et deux données du client restent chez vous."));
    expect(codes(controlerNombres(e.script))).toEqual(["nombres-incoherents"]);
  });
});

describe("relecture : 3 phrases corrigées au plus, jamais d'ajout", () => {
  it("remplace une phrase existante, écarte un ajout, une phrase introuvable et la quatrième correction", () => {
    const c = (avant: string, apres: string, ecran = "") => ({ avant, apres, ecran, pourquoi: "" });
    const r = appliquerCorrections(valide(), [c("Son portable.", "Son numéro de portable.", "Son numéro"), c("Le nom du client.", "Le nom. Et le prénom."), c("Introuvable.", "x"), c("L'adresse du chantier.", "L'adresse.")]);
    expect(r.appliquees.map((x) => x.avant)).toEqual(["Son portable."]);
    expect(r.ecartees.map((x) => x.raison)).toEqual(["Elle ajoute une phrase.", "Phrase introuvable dans le script.", "3 corrections au plus."]);
    expect(r.ecriture.script.douleur[2]).toEqual({ dit: "Son numéro de portable.", ecran: "Son numéro" });
    expect(texteDitDe(r.ecriture.script).split(" ").length).toBe(texteDitDe(valide().script).split(" ").length + 2);
    // L'original n'est pas touché.
    expect(valide().script.douleur[2].dit).toBe("Son portable.");
  });
});

describe("avant / après", () => {
  it("le script réel du 15/10 (v-d3e2a726cf0c, noté 10 sur 10 ce jour-là) est REFUSÉ par les nouveaux contrôles", () => {
    const e = ecriture1510();
    expect(texteDitDe(e.script)).toBe(scenes1510().map((s) => s.texteDit).join(" "));
    const d = controlerEcriture(e, DEMANDE_1510, { metiersRecents: ["plombier", "agent immobilier", "comptable"] });
    expect(aDesEliminatoires(d)).toBe(true);
    expect(codes(d.filter((x) => x.eliminatoire))).toEqual(
      expect.arrayContaining(["nombre-etapes", "script-mots", "gain-absent", "idee-absente", "a-retenir-liste", "entreprise-incoherente", "repetition-mots", "formule-creuse", "metier-repete"]),
    );
    expect(codes(d.filter((x) => !x.eliminatoire))).toEqual(expect.arrayContaining(["jargon"]));
    expect(d.find((x) => x.code === "script-mots")!.message).toBe("Le script fait 249 mots : 125 à 145 pour une vidéo de 60 s.");
  });
  it("le témoin v5 est ACCEPTÉ, sans aucune remarque ; l'ancien témoin (tutoriel numéroté) est REFUSÉ", () => {
    const x = exempleV5("01-continuite");
    expect(controlerEcriture(x.ecriture, x.demande, { metiersRecents: ["plombier", "agent immobilier", "comptable"], questionIa: QUESTIONS_IA[0] })).toEqual([]);
    const v4 = VALIDE();
    expect(codes(controlerEcriture(v4.ecriture, v4.demande).filter((d) => d.eliminatoire))).toContain("etape-imperatif");
  });
  it("les quatre témoins v3 du 14/10 ne passent plus (trop longs, sans idée ni gain)", () => {
    for (const t of EXEMPLES_V3) {
      const d = controlerEcriture(ecritureV3(t), t.demande as DemandeScriptTableau);
      expect(aDesEliminatoires(d), t.titre).toBe(true);
      expect(codes(d), t.titre).toEqual(expect.arrayContaining(["gain-absent", "idee-absente"]));
    }
  });
});
