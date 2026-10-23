/**
 * Contrôles en code des scripts du tableau animé : chacun passe sur l'exemple validé du 15/10 (« Formation », ici avec
 * une fin « commentaire ») et rougit sur un contre-exemple. Les contrôles du gabarit cadré : `gabarit-cadre.test.ts` ;
 * organisation et vérité : `regles.test.ts`.
 */
import { describe, expect, it } from "vitest";
import {
  controlerAccroche,
  controlerAction,
  controlerChiffres,
  controlerCloture,
  controlerDuree,
  controlerEcriture,
  controlerEntrepriseTexte,
  controlerEtapes,
  controlerExemple,
  controlerMotsInterdits,
  controlerPhrases,
  dureeEstimee,
  texteDitDe,
} from "@/domaine/scripts-tableau-controles";
import { schemaEcriture, type DemandeScriptTableau, type EcritureScript, type ScriptTableau } from "@/domaine/scripts-tableau";
import { CARACTERES_PAR_SECONDE_TABLEAU } from "@/domaine/duree-tableau";
import { DEMANDE_MODELE as DEMANDE_TEMOIN, ecritureModele as ecritureTemoin } from "./modele-valide";

/** L'exemple validé, sur le fil, avec une fin « commentaire » (le mot ROUGE) et sans phrase sur l'entreprise. */
const DEMANDE_MODELE: DemandeScriptTableau = { ...DEMANDE_TEMOIN, reseau: "fil", fin: { type: "commentaire", mot: "ROUGE" } };
function ecritureModele(): EcritureScript {
  const e = ecritureTemoin();
  // Sans question sur l'IA ni phrase sur l'entreprise (fin « commentaire »). Lot B2b : budget de 125 à 145 mots, la matière
  // de plus ajoutée à l'exemple pour tenir les 160 mots est retirée (une phrase sur l'entreprise de 8 mots doit pouvoir s'ajouter).
  e.script.appel = [
    { dit: "Écrivez ROUGE en commentaire.", ecran: "Commentez ROUGE" },
    { dit: "Je vous l'envoie.", ecran: "Je vous l'envoie" },
  ];
  return e;
}
const modele = () => ecritureModele().script;
/** Un texte dit d'environ `sec` secondes, à l'estimateur commun (« mot » et son espace : 4 caractères). */
const environ = (sec: number) => "mot ".repeat(Math.round((sec * CARACTERES_PAR_SECONDE_TABLEAU) / 4));
const avec = (f: (s: ScriptTableau) => void): ScriptTableau => {
  const s = modele();
  f(s);
  return s;
};
const codes = (d: { code: string }[]) => d.map((x) => x.code);

describe("le script validé passe tous les contrôles", () => {
  it("respecte le schéma et n'a aucun défaut", () => {
    expect(schemaEcriture.safeParse(ecritureModele()).success).toBe(true);
    expect(controlerEcriture(ecritureModele(), DEMANDE_MODELE)).toEqual([]);
  });
  it("dure dans la fourchette du fil (40 à 75 s)", () => {
    const d = dureeEstimee(texteDitDe(modele()));
    expect(d).toBeGreaterThanOrEqual(45);
    expect(d).toBeLessThanOrEqual(75);
  });
});

describe("accroche", () => {
  it("refuse plus de 8 mots affichés", () => {
    const d = controlerAccroche(avec((s) => (s.accroche[0].ecran = "Un salarié colle un contrat client dans ChatGPT, en cachette")));
    expect(codes(d)).toContain("accroche-longue");
    expect(d[0].message).toMatch(/8 au plus/);
  });
  it("refuse une question molle", () => {
    expect(codes(controlerAccroche(avec((s) => (s.accroche = [{ dit: "Vous utilisez l'IA ?", ecran: "L'IA ?" }]))))).toContain("accroche-question-molle");
  });
  it("accepte une vraie question ouverte", () => {
    expect(controlerAccroche(avec((s) => (s.accroche = [{ dit: "Pourquoi l'IA vous déçoit ?", ecran: "Pourquoi l'IA déçoit" }])))).toEqual([]);
  });
  it("refuse une salutation et « dans cette vidéo »", () => {
    expect(codes(controlerAccroche(avec((s) => (s.accroche[0].dit = "Bonjour à tous !"))))).toContain("accroche-salutation");
    expect(codes(controlerAccroche(avec((s) => (s.accroche[0].dit = "Dans cette vidéo, on parle d'IA."))))).toContain("accroche-salutation");
  });
});

describe("phrases", () => {
  it("refuse une phrase dite de plus de 18 mots", () => {
    const longue = "Choisissez une seule tâche que vous refaites chaque semaine au bureau avec votre équipe et vos collègues depuis des années.";
    const d = controlerPhrases(avec((s) => (s.etapes[0].action.dit = longue)));
    expect(codes(d)).toEqual(["phrase-longue"]);
    expect(d[0].message).toMatch(/20 mots/);
  });
  it("refuse moins de 2 ou plus de 6 mots à l'écran", () => {
    expect(codes(controlerPhrases(avec((s) => (s.douleur[0].ecran = "Plates"))))).toEqual(["ecran-mots"]);
    expect(codes(controlerPhrases(avec((s) => (s.douleur[0].ecran = "Des réponses plates et tristes un peu partout"))))).toEqual(["ecran-mots"]);
  });
});

describe("étapes et exemple", () => {
  it("refuse moins de 2 ou plus de 5 étapes (Will, 15/10 : 3 par défaut, de 2 à 5)", () => {
    expect(codes(controlerEtapes(avec((s) => (s.etapes = s.etapes.slice(0, 1)))))).toEqual(["nombre-etapes"]);
    expect(codes(controlerEtapes(avec((s) => (s.etapes = [...s.etapes, ...s.etapes]))))).toEqual(["nombre-etapes"]);
  });
  it("refuse un exemple absent", () => {
    expect(codes(controlerExemple(avec((s) => (s.exemple.phrases = [])), DEMANDE_MODELE))).toEqual(["exemple-absent"]);
  });
  it("exige « Exemple illustratif » sans vrai cas, pas avec un vrai cas", () => {
    const sansMention = avec((s) => (s.exemple.mentionEcran = ""));
    expect(codes(controlerExemple(sansMention, DEMANDE_MODELE))).toEqual(["exemple-non-marque"]);
    const vraiCas = { metier: "Artisan", tache: "Relances", avant: "Froid", apres: "Chaleureux", date: "2026-09-01" };
    expect(controlerExemple(sansMention, { vraiCas })).toEqual([]);
  });
});

describe("une seule action", () => {
  it("refuse deux actions", () => {
    expect(codes(controlerAction(avec((s) => s.appel.splice(2, 0, { dit: "Et abonnez-vous.", ecran: "Abonnez-vous" })), DEMANDE_MODELE))).toEqual(["actions-multiples"]);
  });
  it("refuse l'absence d'action", () => {
    expect(codes(controlerAction(avec((s) => (s.appel[0].dit = "La page est prête.")), DEMANDE_MODELE))).toEqual(["action-absente"]);
  });
  it("refuse une action autre que celle demandée, ou un autre mot", () => {
    expect(codes(controlerAction(modele(), { fin: { type: "diagnostic" } }))).toEqual(["action-hors-demande"]);
    expect(codes(controlerAction(modele(), { fin: { type: "commentaire", mot: "DEVIS" } }))).toEqual(["action-hors-demande"]);
  });
});

describe("clôture", () => {
  it("refuse une dernière phrase trop longue ou d'un mot", () => {
    expect(codes(controlerCloture(avec((s) => (s.appel[1].dit = "Je vous l'envoie dès que possible ce soir."))))).toEqual(["cloture-longueur"]);
    expect(codes(controlerCloture(avec((s) => (s.appel[1].dit = "Merci."))))).toEqual(["cloture-longueur"]);
  });
  it("refuse une question et une virgule", () => {
    expect(codes(controlerCloture(avec((s) => (s.appel[1].dit = "On essaie ?"))))).toEqual(["cloture-question"]);
    expect(codes(controlerCloture(avec((s) => (s.appel[1].dit = "Je l'envoie, promis."))))).toEqual(["cloture-virgule"]);
  });
});

describe("durée", () => {
  it("le témoin passe sur tous les réseaux (v3 : courts et fil 40 à 75 s)", () => {
    const texte = texteDitDe(modele());
    for (const r of ["courts", "fil", "linkedin", "youtube"] as const) expect(controlerDuree(texte, r)).toEqual([]);
  });
  it("environ 46 s sur les courts (cas réel refusé le 12/10) : accepté", () => {
    const texte = environ(46);
    expect(controlerDuree(texte, "courts")).toEqual([]);
  });
  it("refuse un script nettement hors de la fourchette du réseau", () => {
    const long = environ(85);
    expect(controlerDuree(long, "courts")).toMatchObject([{ code: "duree-reseau", eliminatoire: true }]);
    const court = environ(20);
    expect(controlerDuree(court, "linkedin")).toMatchObject([{ code: "duree-reseau", eliminatoire: true }]);
  });
  it("un écart de moins de 10 % est une remarque, pas un défaut éliminatoire", () => {
    const juste = environ(78);
    const d = controlerDuree(juste, "courts");
    expect(d).toMatchObject([{ code: "duree-reseau", eliminatoire: false }]);
    expect(d[0].message).toMatch(/remarque/);
  });
  it("au-delà du plafond du découpage (90 s), toujours éliminatoire, même à moins de 10 % de la borne du réseau", () => {
    for (const r of ["linkedin", "youtube"] as const) {
      const d = controlerDuree(environ(95), r);
      expect(d).toMatchObject([{ code: "duree-reseau", eliminatoire: true }]);
      expect(d[0].message).toMatch(/plafond de 90 s/);
      expect(d[0].message).toMatch(/raccourcissez le texte dit d'environ \d+ caractères/);
    }
  });
  it("la durée d'une variante (non affichée) n'est jamais éliminatoire", () => {
    const e = ecritureModele();
    e.variantes = [{ reseau: "linkedin", changements: "", texteDit: "Trop court. Écrivez ROUGE en commentaire." }];
    const d = controlerEcriture(e, DEMANDE_MODELE).filter((x) => x.code === "duree-reseau");
    expect(d.length).toBe(1);
    expect(d[0].eliminatoire).toBe(false);
  });
});

describe("mots interdits", () => {
  const cas: [string, string][] = [
    ["Rendez-vous sur axion-ia.com.", "adresse du site"],
    ["Tout est sur axion ia point com.", "adresse du site"],
    ["Notre formation dure trois jours.", "notre formation"],
    ["Nos formations sont courtes.", "nos formations"],
    ["Notre équipe vous suit.", "notre équipe"],
    ["Nos clients adorent.", "nos clients"],
    ["Contactez-nous vite.", "contactez-nous"],
    ["Nous sommes à Villeexemple.", "Villeexemple"],
    ["Aucun gain garanti.", "aucun gain garanti"],
    ["Pour 49 € seulement.", "prix"],
    ["Le prix est bas.", "prix"],
    ["Trois cents euros.", "prix"],
    ["Essayez demain.", "demain"],
    ["Optimisez vos relances.", "optimiser"],
    ["Boostez vos ventes.", "booster"],
    ["Cela va révolutionner votre travail.", "révolutionner"],
    ["Tu as essayé l'IA.", "tutoiement"],
    ["Prends ton devis.", "tutoiement"],
    ["L'IA t'aide.", "tutoiement"],
  ];
  it.each(cas)("refuse « %s » (%s)", (texte) => {
    expect(codes(controlerMotsInterdits(texte))).toEqual(["mot-interdit"]);
  });
  it("ne voit rien d'interdit dans le script validé (« lendemain », « tâche », « c'est » passent)", () => {
    expect(controlerMotsInterdits(texteDitDe(modele()) + " Dès le lendemain, c'est votre tâche.")).toEqual([]);
  });
  it("contrôle aussi les variantes par réseau", () => {
    const e = ecritureModele();
    e.variantes = [{ reseau: "courts", changements: "Étape trois retirée", texteDit: "Contactez-nous. " + "mot ".repeat(130) }];
    expect(codes(controlerEcriture(e, DEMANDE_MODELE))).toContain("mot-interdit");
  });
});

describe("chiffres statistiques", () => {
  it("refuse un chiffre statistique sans source", () => {
    expect(codes(controlerChiffres("Sept dirigeants sur dix abandonnent.", []))).toEqual(["chiffre-sans-source"]);
    expect(codes(controlerChiffres("Vous perdez 30 % de votre temps.", []))).toEqual(["chiffre-sans-source"]);
    expect(codes(controlerChiffres("C'est trois fois plus rapide.", []))).toEqual(["chiffre-sans-source"]);
    expect(codes(controlerChiffres("Selon une étude, ça marche.", []))).toEqual(["chiffre-sans-source"]);
  });
  it("refuse une source vide, accepte une source déclarée qui cite l'extrait", () => {
    expect(codes(controlerChiffres("Vous perdez 30 % de votre temps.", [{ extrait: "30 %", source: "" }]))).toEqual(["chiffre-sans-source"]);
    expect(controlerChiffres("Vous perdez 30 % de votre temps.", [{ extrait: "30 %", source: "Insee, enquête TIC 2025" }])).toEqual([]);
  });
  it("ne prend pas « trois fois » ni « cinq jours » pour des statistiques", () => {
    expect(controlerChiffres(texteDitDe(modele()), [])).toEqual([]);
  });
});

describe("l'entreprise : un peu, à la fin (Will, 14/10)", () => {
  /** Le modèle, avec `phrase` dite juste avant la demande de fin (« Écrivez ROUGE en commentaire. »). */
  const finAvec = (...phrases: string[]) => {
    const e = ecritureModele();
    // Lot B2b (budget de 125 à 145 mots) : la phrase sur l'entreprise du modèle est REMPLACÉE, pas doublée.
    e.script.appel = [...phrases.map((dit) => ({ dit, ecran: "Axion IA" })), ...e.script.appel.filter((x) => !/en place pour vous|^Je vous l'envoie/.test(x.dit))];
    return e;
  };
  const defautsEntreprise = (e: ReturnType<typeof ecritureModele>) => controlerEcriture(e, DEMANDE_MODELE).filter((d) => d.eliminatoire);

  it("refuse une phrase sur l'entreprise dans le corps (nom, ou « nous » de l'entreprise)", () => {
    for (const dit of ["Chez Axion IA, on automatise les devis.", "Nous installons ce genre de méthode."]) {
      const e = ecritureModele();
      e.script.etapes[1].comment.push({ dit, ecran: "Chez nous" });
      const d = defautsEntreprise(e);
      expect(codes(d), dit).toContain("entreprise-corps");
      expect(d.find((x) => x.code === "entreprise-corps")!.message).toMatch(/juste avant la demande/);
    }
  });
  it("accepte UNE phrase courte sur l'entreprise, liée à l'idée, juste avant la demande de fin", () => {
    expect(defautsEntreprise(finAvec("Axion-IA met cette fiche en place pour vous."))).toEqual([]);
    expect(defautsEntreprise(finAvec("Nous mettons cette fiche en place pour vous."))).toEqual([]);
  });
  it("refuse deux phrases sur l'entreprise à la fin", () => {
    expect(codes(defautsEntreprise(finAvec("Chez Axion IA, nous installons ça.", "Nous le faisons aussi.")))).toContain("entreprise-fin");
  });
  it("refuse un prix ou une promesse chiffrée dans la phrase de fin", () => {
    expect(codes(defautsEntreprise(finAvec("Chez Axion IA, l'accompagnement coûte 900 €.")))).toContain("mot-interdit");
    expect(codes(defautsEntreprise(finAvec("Nous vous faisons gagner dix heures par semaine.")))).toContain("entreprise-fin");
  });
  it("refuse une phrase de plus de 15 mots", () => {
    expect(codes(defautsEntreprise(finAvec("Chez Axion IA, nous aidons les dirigeants de petites entreprises à reprendre enfin la main sur leurs tâches répétitives.")))).toContain("entreprise-fin");
  });
  it("refuse la phrase ailleurs que juste avant la demande (après elle)", () => {
    const e = ecritureModele();
    e.script.appel = [e.script.appel[0], { dit: "Nous apprenons ces réflexes aux équipes.", ecran: "Axion IA" }, e.script.appel[1]];
    expect(codes(defautsEntreprise(e))).toContain("entreprise-fin");
  });
  it("la voix ne prononce jamais l'adresse du site, même à la fin", () => {
    expect(codes(defautsEntreprise(finAvec("Tout est sur axion-ia.com.")))).toContain("mot-interdit");
  });
  it("variantes : même règle (une phrase courte juste avant la demande, rien dans le corps)", () => {
    const corps = texteDitDe(modele());
    const e = ecritureModele();
    e.variantes = [{ reseau: "courts", changements: "Fin signée", texteDit: corps.replace("Écrivez ROUGE", "Chez Axion IA, nous installons ça. Écrivez ROUGE") }];
    expect(codes(defautsEntreprise(e))).not.toContain("entreprise-fin");
    e.variantes = [{ reseau: "courts", changements: "Corps signé", texteDit: "Chez Axion IA, nous installons ça. " + corps }];
    expect(codes(defautsEntreprise(e))).toContain("entreprise-corps");
  });
});

describe("un geste décrit à l'indicatif n'est pas une demande (brouillon v-693abee466e1, 18/10)", () => {
  const geste1 = "Au retour, vous relisez, vous corrigez une date, vous cliquez.";
  const geste2 = "Au retour, vous relisez, corrigez une date, et vous cliquez.";
  const DEMANDE_DIAGNOSTIC: DemandeScriptTableau = { ...DEMANDE_MODELE, fin: { type: "diagnostic" } };
  const finDiagnostic = (e: EcritureScript) => {
    e.script.appel = [
      { dit: "Axion-IA installe ce tri et ces brouillons.", ecran: "Axion-IA installe ce tri" },
      { dit: "Réservez un appel de diagnostic.", ecran: "Appel de diagnostic" },
    ];
    return e;
  };

  it.each([geste1, geste2])("« %s » dans le corps : une seule action (diagnostic)", (geste) => {
    const e = finDiagnostic(ecritureModele());
    e.script.etapes[2].comment.push({ dit: geste, ecran: "Relire puis envoyer" });
    expect(codes(controlerAction(e.script, DEMANDE_DIAGNOSTIC))).toEqual([]);
  });

  it("la phrase sur l'entreprise reste reconnue juste avant la demande de fin", () => {
    const texte = `Trois. Réglez l'assistant sur brouillons seulement. ${geste2} Vos mails se trient et se préparent sans vous ; vous gardez l'envoi. Axion-IA installe ce tri et ces brouillons. Réservez un appel de diagnostic.`;
    expect(controlerEntrepriseTexte(texte, "La variante Fil")).toEqual([]);
  });

  it("l'écriture entière ne déclenche ni actions-multiples ni entreprise-fin", () => {
    const e = finDiagnostic(ecritureModele());
    e.script.etapes[2].comment.push({ dit: geste2, ecran: "Relire puis envoyer" });
    const defauts = codes(controlerEcriture(e, DEMANDE_DIAGNOSTIC)).filter((c) => c === "actions-multiples" || c === "entreprise-fin");
    expect(defauts).toEqual([]);
  });

  it("une vraie seconde demande à l'impératif reste refusée", () => {
    const e = finDiagnostic(ecritureModele());
    e.script.appel.push({ dit: "Cliquez sur le lien en bio.", ecran: "Lien en bio" });
    expect(codes(controlerAction(e.script, DEMANDE_DIAGNOSTIC))).toEqual(["actions-multiples"]);
  });

  it("« Inscrivez-vous » (avec le tiret) reste compté malgré le geste décrit dans le corps", () => {
    const e = finDiagnostic(ecritureModele());
    e.script.etapes[2].comment.push({ dit: geste2, ecran: "Relire puis envoyer" });
    e.script.appel.push({ dit: "Inscrivez-vous.", ecran: "Inscrivez-vous" });
    expect(codes(controlerAction(e.script, DEMANDE_DIAGNOSTIC))).toEqual(["actions-multiples"]);
  });

  it("« Vous prenez rendez-vous avec le client » dans le corps n'est pas une demande", () => {
    const s = avec((x) => x.etapes[2].comment.push({ dit: "Vous prenez rendez-vous avec le client.", ecran: "Rendez-vous client" }));
    expect(codes(controlerAction(s, DEMANDE_MODELE))).toEqual([]);
  });
});
