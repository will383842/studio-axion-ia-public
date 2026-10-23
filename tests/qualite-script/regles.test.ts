/**
 * SOCLE QUALITÉ · chaque règle, une par une, sur un bon script et sa variante fautive. Aucun appel, aucun réseau.
 */
import { describe, expect, it } from "vitest";
import { RECETTE_ECRIRE_FACECAM, RECETTE_IMAGE_VIDEO } from "@/domaine/qualite-script/recettes";
import { BON, code, ecarts, evaluer, RECETTE_ESSAI, variante } from "./aide";

describe("le bon script d'essai", () => {
  it("passe toutes les règles : aucun écart, voyant vert, les 8 fonctions minimales présentes", () => {
    const r = evaluer(BON);
    expect(ecarts(r)).toEqual([]);
    expect(r.voyant).toBe("vert");
    expect(Object.values(r.fonctions).every(Boolean)).toBe(true);
    expect(r.dureeSec).toBe(31);
  });
});

describe("accroche (AC)", () => {
  it("AC-01 : 1re phrase de 12 mots au plus", () => {
    const r = evaluer(variante(0, ["accroche", "Ce devis que vous envoyez le soir vous coûte trois heures chaque semaine."]));
    expect(code(r, "AC-01").statut).toBe("ecart");
    expect(code(r, "AC-01").message).toContain("13 mots");
  });
  it("AC-02 : 1re phrase finie avant 3 s, au débit de la recette", () => {
    // 10 mots à 3 mots/s = 3,33 s.
    const r = evaluer(variante(0, ["accroche", "Ce devis vous coûte trois heures chaque semaine, vraiment, chaque."]));
    expect(code(r, "AC-01").statut).toBe("ok");
    expect(code(r, "AC-02").statut).toBe("ecart");
  });
  it("AC-03 : l'accroche entière finit avant 5 s (sauf écart de la recette)", () => {
    const r = evaluer([["accroche", "Ce devis vous coûte trois heures."], ["accroche", "Chaque semaine, votre assistante le recopie à la main, ligne après ligne."], ...BON.slice(1)]);
    expect(code(r, "AC-03").statut).toBe("ecart");
  });
  it("AC-04 : pas de préambule ni de salut", () => {
    expect(code(evaluer(variante(0, ["accroche", "Bonjour, ce devis vous coûte trois heures."])), "AC-04").statut).toBe("ecart");
    expect(code(evaluer(variante(0, ["accroche", "Aujourd'hui, parlons de vos devis."])), "AC-04").statut).toBe("ecart");
  });
  it("AC-05 : un chiffre, une contradiction ou « pour qui » dans les 9 premiers mots", () => {
    expect(code(evaluer(BON), "AC-05").message).toContain("un chiffre");
    expect(code(evaluer(variante(0, ["accroche", "Le logiciel envoie le document chaque matin vers le serveur."])), "AC-05").statut).toBe("ecart");
  });
  it("AC-06 : une tension (douleur ou curiosité) avant 40 %", () => {
    const sans = [["accroche", "Ce devis part avec trois pièces jointes."], ["corps", "La fiche est rangée dans le dossier du client."], ["corps", "Le dossier garde la date et le nom du chantier."], ...BON.slice(3)] as typeof BON;
    const r = evaluer(sans);
    expect(code(r, "AC-06").statut).toBe("ecart");
    expect(code(evaluer(BON), "AC-06").message).toContain("la douleur");
  });
});

describe("rétention (RT)", () => {
  it("RT-01 : alerte au-delà de 14 mots, refus au-delà de 22", () => {
    const quinze = evaluer(variante(8, ["corps", "Le prix reste une décision humaine que votre équipe prend avec le client chaque fois."]));
    expect(code(quinze, "RT-01")).toMatchObject({ statut: "ecart", niveauVise: "alerte" });
    const dixNeuf = evaluer(variante(8, ["corps", "Le prix reste une décision humaine que votre équipe prend avec le client chaque fois, en regardant le chantier."]));
    expect(code(dixNeuf, "RT-01")).toMatchObject({ statut: "ecart", niveauVise: "alerte" });
    const vingtTrois = evaluer(variante(8, ["corps", "Le prix reste une décision humaine que votre équipe prend avec le client chaque fois, en regardant le chantier et en relisant le devis."]));
    expect(code(vingtTrois, "RT-01")).toMatchObject({ statut: "ecart", niveauVise: "bloquant" });
  });
  it("RT-01 : une énumération se lit comme une liste (W02 de la v4)", () => {
    const r = evaluer(variante(1, ["douleur", "Avant, c'était ça : trier les candidatures, répondre à chacun, relancer, caler un rendez-vous, envoyer le contrat, courir après la signature."]));
    expect(code(r, "RT-01").statut).toBe("ok");
  });
  it("RT-01 : l'image → vidéo garde 12 mots dans sa recette", () => {
    const r = evaluer(variante(8, ["corps", "Le prix reste une décision humaine prise par votre équipe à chaque fois."]), RECETTE_IMAGE_VIDEO);
    expect(code(r, "RT-01")).toMatchObject({ statut: "ecart", niveauVise: "bloquant" });
  });
  it("RT-02 : boucle annoncée interdite", () => {
    const r = evaluer(variante(3, ["promesse", "Restez jusqu'au bout, je vous montre la méthode."]));
    expect(code(r, "RT-02").statut).toBe("ecart");
  });
  it("RT-03 : boucle implicite tenue, ou non tenue", () => {
    const tenue = evaluer(variante(3, ["promesse", "Trois réflexes à prendre. Un. La fiche. Deux. Le devis. Trois. La relance."]));
    expect(code(tenue, "RT-03").message).toContain("tenue");
    const non = evaluer(variante(3, ["promesse", "Voici les cinq étapes qu'on met en place."]));
    expect(code(non, "RT-03").statut).toBe("ecart");
    expect(code(evaluer(BON), "RT-03").message).toContain("facultatif");
  });
  it("RT-04 : la valeur arrive avant 40 %", () => {
    const tard = BON.map(([p, d], i) => [i >= 4 && i <= 8 ? "douleur" : p, d] as [typeof p, string]);
    tard[6] = ["douleur", "Une relance de plus, encore une, toujours la même chaque semaine."];
    expect(code(evaluer(tard), "RT-04").statut).toBe("ecart");
  });
  it("RT-05 : relance obligatoire à 45 s, facultative à 30 s", () => {
    const sans = variante(7, ["corps", "Tout ne s'automatise pas."]);
    expect(code(evaluer(sans), "RT-05")).toMatchObject({ statut: "ok", niveauVise: "info" });
    expect(code(evaluer(sans, RECETTE_ESSAI, { dureeViseeSec: 45 }), "RT-05").statut).toBe("ecart");
    expect(code(evaluer(BON, RECETTE_ESSAI, { dureeViseeSec: 45 }), "RT-05").statut).toBe("ok");
  });
  it("RT-06 : changement à l'écran toutes les 2,5 s, sauf face caméra, mesuré sur de vrais écrans", () => {
    const ecrans = { ...RECETTE_ESSAI, ecransReels: true };
    const r = evaluer(BON, ecrans);
    expect(code(r, "RT-06").statut).toBe("ecart");
    const avecEvenements = evaluer(BON.map(([p, d]) => [p, d, { changements: [3, 6, 9] }]), ecrans);
    expect(code(avecEvenements, "RT-06").statut).toBe("ok");
    expect(code(evaluer(BON, RECETTE_ECRIRE_FACECAM), "RT-06").statut).toBe("non-mesure");
    expect(code(evaluer(BON), "RT-06").statut).toBe("non-mesure");
  });
  it("RT-07 : rien après la demande, pas de fin molle", () => {
    expect(code(evaluer([...BON, ["fin", "Merci d'avoir regardé."]]), "RT-07").statut).toBe("ecart");
    expect(code(evaluer([...BON, ["fin", "La méthode tient en une page."]]), "RT-07").statut).toBe("ecart");
  });
});

describe("valeur (VA)", () => {
  it("VA-01 : un gain avec son unité", () => {
    expect(code(evaluer(BON), "VA-01").message).toContain("trois heures");
    const sans = BON.map(([p, d]) => [p, d.replace(/trois heures|huit salariés/g, "du temps")] as [typeof p, string]);
    expect(code(evaluer(sans), "VA-01").statut).toBe("ecart");
  });
  it("VA-02 : une preuve ou un exemple", () => {
    const sans = variante(6, ["corps", "Le devis repart vers le client, signé."]);
    expect(code(evaluer(sans), "VA-02").statut).toBe("ecart");
  });
  it("VA-03 : la promesse de l'accroche revient dans la seconde moitié", () => {
    const r = evaluer(variante(0, ["accroche", "Votre standard sonne trois fois de trop."]));
    expect(code(r, "VA-03").statut).toBe("ecart");
  });
});

describe("prospects (PR)", () => {
  it("PR-01 : la cible est nommée dans les 10 premières secondes", () => {
    const loin = [["accroche", "Ce document prend trois heures."], ["douleur", "Le papier s'empile et le stylo sèche sur la table du bureau."], ["douleur", "La pile monte, monte, et monte encore sans fin, page après page, jour après jour."], ...BON.slice(3)] as typeof BON;
    expect(code(evaluer(loin), "PR-01").statut).toBe("ecart");
  });
  it("PR-02 : une seule demande, en fin, liée à l'idée", () => {
    expect(code(evaluer([...BON.slice(0, 10), ["appel", "Écrivez DEVIS en commentaire. Abonnez-vous aussi."]]), "PR-02").message).toContain("2 demandes");
    expect(code(evaluer([...BON.slice(0, 9), ["a-retenir", "Bonne soirée à tous."], ["appel", "Écrivez GATEAU en commentaire pour la recette."]]), "PR-02").message).toContain("pas liée");
    const milieu = [...BON.slice(0, 3), ["corps", "Réservez un appel de diagnostic."], ...BON.slice(3, 10)] as typeof BON;
    expect(code(evaluer(milieu), "PR-02").message).toContain("pas en fin");
  });
  it("PR-02 : une question suivie d'une demande compte pour une seule demande (v4)", () => {
    const r = evaluer([...BON.slice(0, 10), ["question", "Et chez vous, quel devis pourrait partir seul ?"], ["appel", "Écrivez DEVIS en commentaire."]]);
    expect(code(r, "PR-02").statut).toBe("ok");
  });
  it("PR-02 : sans demande, écart sauf format à demande facultative", () => {
    const sans = BON.slice(0, 10);
    expect(code(evaluer(sans), "PR-02").statut).toBe("ecart");
    expect(code(evaluer(sans, { ...RECETTE_ESSAI, demandeFinale: "facultative" }), "PR-02").statut).toBe("ok");
  });
  it("PR-03 : « Commentez MOT » permis sur Instagram, Facebook et LinkedIn, écarté sur Shorts", () => {
    expect(code(evaluer(BON, RECETTE_ESSAI, { reseau: "instagram" }), "PR-03").statut).toBe("ok");
    expect(code(evaluer(BON, RECETTE_ESSAI, { reseau: "facebook" }), "PR-03").statut).toBe("ok");
    const li = code(evaluer(BON, RECETTE_ESSAI, { reseau: "linkedin" }), "PR-03");
    expect(li.statut).toBe("ok");
    expect(code(evaluer(BON, RECETTE_ESSAI, { reseau: "youtube-shorts" }), "PR-03").statut).toBe("ecart");
  });
  it("PR-03 : sur LinkedIn, « écrivez-moi DEVIS en message privé » et la question ouverte sont permis", () => {
    const mp = variante(10, ["appel", "Écrivez-moi DEVIS en message privé, je vous montre la méthode du devis."]);
    expect(code(evaluer(mp, RECETTE_ESSAI, { reseau: "linkedin" }), "PR-03").statut).toBe("ok");
    const question = variante(10, ["question", "Et chez vous, quel devis prend le plus de temps ?"]);
    expect(code(evaluer(question, RECETTE_ESSAI, { reseau: "linkedin" }), "PR-03").statut).toBe("ok");
  });
  it("PR-04 : pas de jargon de l'IA dans les 5 premières secondes", () => {
    expect(code(evaluer(variante(0, ["accroche", "Un prompt vous coûte trois heures."])), "PR-04").statut).toBe("ecart");
  });
});

describe("positionnement de Will (PO)", () => {
  it("PO-01 : jamais « faites-le vous-même » en conclusion", () => {
    const r = evaluer(variante(9, ["a-retenir", "Le devis part seul : faites-le vous-même dès ce soir."]));
    expect(code(r, "PO-01")).toMatchObject({ statut: "ecart", niveauVise: "bloquant" });
    expect(code(evaluer(variante(9, ["a-retenir", "À vous de jouer avec votre devis."])), "PO-01").statut).toBe("ecart");
  });
  it("PO-01 : donner de la valeur dans le corps reste permis ; montrer NOS outils aussi", () => {
    const corps = variante(5, ["corps", "Remplacez les noms par des lettres, la relance reste utile."]);
    expect(code(evaluer(corps), "PO-01").statut).toBe("ok");
    expect(code(evaluer(BON), "PO-01").statut).toBe("ok"); // « Voici ce qu'on met en place chez nos clients. »
  });
  it("PO-02 : jamais « vient de sortir », « nouvel outil », « nouvelle fonctionnalité », « dernière mise à jour », « X vient d'annoncer »", () => {
    for (const phrase of ["Cet outil vient de sortir.", "Un nouvel outil change tout.", "La nouvelle fonctionnalité aide le devis.", "La dernière mise à jour aide le devis.", "OpenAI vient d'annoncer un modèle.", "J'ai testé les deux pour vos devis."]) {
      expect(code(evaluer(variante(3, ["promesse", phrase])), "PO-02").statut, phrase).toBe("ecart");
    }
  });
  it("PO-03 : une phrase relie l'entreprise du spectateur à un gain", () => {
    const sans = evaluer([["accroche", "Ce nuage passe trois fois au-dessus du toit."], ["corps", "Il change de forme à chaque passage."], ["appel", "Écrivez NUAGE en commentaire."]]);
    expect(code(sans, "PO-03").statut).toBe("ecart");
    expect(code(evaluer(BON), "PO-03").statut).toBe("ok");
  });
  it("PO-04 : tics d'écriture IA repérés en observation (niveau info)", () => {
    const r = evaluer(variante(8, ["corps", "Ce n'est pas un outil, c'est une méthode."]));
    expect(code(r, "PO-04")).toMatchObject({ statut: "ecart", niveauVise: "info" });
    expect(code(evaluer(variante(8, ["corps", "Une méthode révolutionnaire."])), "PO-04").statut).toBe("ecart");
  });
});

describe("interdits (LG)", () => {
  it("LG-01 : interdit permanent commun (« Villeexemple ») trouvé pour tous les écrivains", () => {
    const g = variante(8, ["corps", "Nous sommes à Villeexemple."]);
    for (const interdits of ["ecrire", "tableau", "cas-concret", "image-video"] as const) {
      expect(code(evaluer(g, { ...RECETTE_ESSAI, interdits }), "LG-01").statut, interdits).toBe("ecart");
    }
  });
  it("LG-01 : chaque écrivain garde SA liste (« machine » : cas concret et image → vidéo seulement)", () => {
    const m = variante(8, ["corps", "La machine fait le devis."]);
    const machine = (interdits: "ecrire" | "tableau") => evaluer(m, { ...RECETTE_ESSAI, interdits }).resultats.filter((x) => x.code === "LG-01" && x.message.includes("machine"));
    expect(code(evaluer(m, { ...RECETTE_ESSAI, interdits: "cas-concret" }), "LG-01").statut).toBe("ecart");
    expect(code(evaluer(m, { ...RECETTE_ESSAI, interdits: "image-video" }), "LG-01").statut).toBe("ecart");
    expect(machine("ecrire")).toEqual([]);
    expect(machine("tableau")).toEqual([]);
  });
  it("LG-05 : « machine » est signalé en info dans tous les formats, sans changer LG-01", () => {
    const m = variante(8, ["corps", "La machine fait le devis."]);
    for (const interdits of ["ecrire", "tableau", "cas-concret", "image-video"] as const) {
      expect(code(evaluer(m, { ...RECETTE_ESSAI, interdits }), "LG-05"), interdits).toMatchObject({ statut: "ecart", niveauVise: "info" });
    }
    expect(code(evaluer(BON), "LG-05").statut).toBe("ok");
  });
  it("PR-01 : la cible grande entreprise ou une fonction compte comme cible nommée", () => {
    const ge = [["accroche", "Votre grande entreprise perd trois heures."], ...BON.slice(1)] as typeof BON;
    expect(code(evaluer(ge), "PR-01").statut).toBe("ok");
  });
  it("LG-01 : le tableau garde ses règles propres (« nos clients » : l'entreprise seulement à la fin)", () => {
    expect(code(evaluer(BON, { ...RECETTE_ESSAI, interdits: "tableau" }), "LG-01").message).toContain("nos clients");
    expect(code(evaluer(BON, { ...RECETTE_ESSAI, interdits: "ecrire" }), "LG-01").statut).toBe("ok");
  });
  it("LG-01 : « Certifexemple » et « certifié » pour l'image → vidéo", () => {
    const q = variante(8, ["corps", "Notre organisme est certifié Certifexemple."]);
    expect(code(evaluer(q, { ...RECETTE_ESSAI, interdits: "image-video" }), "LG-01").statut).toBe("ecart");
  });
  it("LG-02 : un récit de client est à vérifier (info)", () => {
    const r = evaluer(variante(6, ["exemple", "Mon client a gagné trois heures par semaine."]));
    expect(code(r, "LG-02")).toMatchObject({ statut: "ecart", niveauVise: "info" });
  });
  it("LG-03 : une formule absolue est À TRANCHER, avec sa version prudente", () => {
    const r = evaluer(variante(5, ["corps", "La relance part toujours le lendemain."]));
    const a = code(r, "LG-03");
    expect(a.statut).toBe("a-trancher");
    expect(a.versionPrudente).toBe("La relance part presque toujours le lendemain.");
    expect(r.voyant).not.toBe("rouge");
  });
  it("LG-04 : chiffre sans source quand l'écrivain le dit ; sinon non mesuré", () => {
    expect(code(evaluer(BON), "LG-04").statut).toBe("non-mesure");
    const r = evaluer(BON.map(([p, d], i) => [p, d, i === 6 ? { sourcee: false } : {}]));
    expect(code(r, "LG-04").statut).toBe("ecart");
    expect(r.voyant).toBe("rouge");
  });
});

describe("forme (DF)", () => {
  it("DF-01 : la durée tombe dans la classe de durée visée", () => {
    expect(code(evaluer(BON), "DF-01").statut).toBe("ok");
    expect(code(evaluer(BON, RECETTE_ESSAI, { dureeViseeSec: 60 }), "DF-01").statut).toBe("ecart");
  });
  it("DF-02 : textes à l'écran de 8 mots au plus", () => {
    const r = evaluer(BON.map(([p, d], i) => [p, d, i === 2 ? { ecrits: [{ texte: "Elle oublie une relance et le client signe ailleurs", modifiable: true }] } : {}]));
    expect(code(r, "DF-02").statut).toBe("ecart");
  });
});
