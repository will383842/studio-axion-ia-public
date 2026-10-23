/**
 * M1a · Règles R02 à R11 de la fiche d'écrans (plan cas concret § 6.3) : par règle, un cas qui passe et un cas refusé,
 * message en français qui nomme l'écran.
 */
import { describe, expect, it } from "vitest";
import { motsLus, validerSchemaFiche } from "@/moteurs/montage-cas-concret/fiche";
import {
  MOTS_INTERDITS_FORMAT,
  REGLES_R02_R11,
  nombresDe,
  regleAccroche,
  regleDureeEcran,
  regleDureeEcransFin,
  regleFondsAlternes,
  regleMarque,
  regleMotsInterdits,
  regleOrdre,
  regleRythme,
  regleTexteDuScript,
  regleTextesCourts,
  regleVouvoiement,
  tempsEcrans,
  texteAvecNombres,
  verifierRegles,
} from "@/moteurs/montage-cas-concret/regles";
import type { EcranFin } from "@/moteurs/montage-cas-concret/fiche";
import { contactVersCrm } from "@/formats/cas-concret/catalogue/contact-vers-crm";
import { regleSigles } from "@/moteurs/montage-cas-concret/regles";
import { avec, contexteVideo1, details, ecran, ficheVideo1 } from "../outils";

const ctx = contexteVideo1();

describe("M1a · la fiche de la vidéo 1", () => {
  it("passe le schéma et les règles R02 à R11", () => {
    const f = ficheVideo1();
    const schema = validerSchemaFiche(f);
    expect(schema.ok, JSON.stringify(schema)).toBe(true);
    const problemes = verifierRegles(f, ctx, REGLES_R02_R11);
    expect(problemes.map((p) => p.message)).toEqual([]);
  });

  it("le message nomme l'écran et la règle", () => {
    const f = avec(ficheVideo1(), (x) => {
      x.ecrans[4].marque = "axion.com";
    });
    const [p] = verifierRegles(f, ctx, REGLES_R02_R11);
    expect(p.sceneId).toBe("e05");
    expect(p.message).toMatch(/^Écran e05 · règle « marque présente » : /);
  });
});

describe("R02 · le texte dit est le script entier", () => {
  it("le texte dit bout à bout reprend le script, ponctuation et casse à part", () => {
    expect(regleTexteDuScript(ficheVideo1(), ctx)).toEqual([]);
  });
  it("un mot changé est refusé, sur l'écran où il est dit", () => {
    const f = avec(ficheVideo1(), (x) => {
      x.ecrans[6].texteDit = "La personne voit votre annonce.";
    });
    const m = regleTexteDuScript(f, ctx);
    expect(m).toHaveLength(1);
    expect(m[0].ecranId).toBe("e07");
    expect(m[0].detail).toContain("« votre »");
  });
  it("une fin de script non dite est refusée", () => {
    const f = avec(ficheVideo1(), (x) => {
      x.ecrans[17].texteDit = "Et dans votre entreprise ?";
    });
    expect(regleTexteDuScript(f, ctx)[0].ecranId).toBe("e18");
    const g = avec(ficheVideo1(), (x) => {
      x.ecrans.pop();
    });
    expect(regleTexteDuScript(g, ctx)[0].detail).toContain("il manque la fin du script");
  });
});

describe("R03 · accroche", () => {
  it("l'accroche dit la promesse du cas (« quinze » vaut « 15 ») en 8 mots au plus, finie avant 3 s", () => {
    expect(regleAccroche(ficheVideo1(), ctx)).toEqual([]);
  });
  it("une accroche qui ne dit pas la promesse est refusée", () => {
    const f = avec(ficheVideo1(), (x) => {
      x.ecrans[0].texteDit = "On recrute nos collaborateurs en dix minutes.";
    });
    const m = regleAccroche(f, ctx);
    expect(m.map((x) => x.ecranId)).toEqual(["e01"]);
    expect(m[0].detail).toContain("« 15 »");
  });
  it("une accroche de plus de 8 mots est refusée", () => {
    const f = avec(ficheVideo1(), (x) => {
      x.ecrans[0].texteDit = "Chez nous, on recrute nos collaborateurs en quinze minutes.";
    });
    expect(regleAccroche(f, ctx).map((x) => x.detail)).toContain("l'accroche dit 9 mots ; 8 au plus.");
  });
  it("une accroche finie après 3 s est refusée", () => {
    // 7 mots au débit de 2,2 mots par seconde, sans avance sur l'écran suivant : 3,2 s.
    const f = avec(ficheVideo1(), (x) => {
      x.ecrans[1].avanceMs = 0;
    });
    const m = regleAccroche(f, contexteVideo1({ debitMotsParSeconde: 2.2 }));
    expect(m).toHaveLength(1);
    expect(m[0].detail).toBe("l'accroche finit à 3,2 s ; elle doit finir avant 3,0 s.");
  });
  it("un premier écran qui n'est pas une accroche est refusé", () => {
    const f = avec(ficheVideo1(), (x) => {
      x.ecrans.shift();
    });
    expect(regleAccroche(f, ctx)[0]).toEqual({ ecranId: "e02", detail: "le premier écran doit être l'accroche." });
  });
});

describe("R03 · sigle écrit pour être lu", () => {
  it("« C.R.M. » vaut « CRM » : la promesse de contact-vers-crm passe R03 et R22", () => {
    const f = avec(ficheVideo1(), (x) => {
      x.ecrans[0].texteDit = "Vos contacts arrivent dans le C.R.M. sans ressaisie.";
    });
    const c = contexteVideo1({ cas: structuredClone(contactVersCrm) });
    expect(regleAccroche(f, c)).toEqual([]);
    expect(regleSigles(f)).toEqual([]);
  });
  it("sans le sigle, la promesse reste refusée", () => {
    const f = avec(ficheVideo1(), (x) => {
      x.ecrans[0].texteDit = "Vos contacts arrivent dans le logiciel sans ressaisie.";
    });
    const m = regleAccroche(f, contexteVideo1({ cas: structuredClone(contactVersCrm) }));
    expect(m[0].detail).toContain("« crm »");
  });
});

describe("R04 · ordre des écrans", () => {
  it("l'ordre de la vidéo 1 (reste humain entre deux étapes) est accepté", () => {
    const f = ficheVideo1();
    expect(f.ecrans[10].type).toBe("etape");
    expect(f.ecrans[11].texteDit).toMatch(/^Nous, on arrive pour la visio/);
    expect(f.ecrans[13].type).toBe("etape");
    expect(regleOrdre(f, ctx)).toEqual([]);
  });
  it("une étape avant la liste « avant » est refusée", () => {
    const f = avec(ficheVideo1(), (x) => {
      const [etape] = x.ecrans.splice(6, 1);
      x.ecrans.splice(2, 0, etape);
    });
    const m = regleOrdre(f, ctx);
    expect(details(m)).toContain("la liste « avant » vient après la première étape");
  });
  it("sans titre entre la liste et la première étape, refusé", () => {
    const f = avec(ficheVideo1(), (x) => {
      x.ecrans.splice(5, 1);
    });
    expect(regleOrdre(f, ctx).map((m) => m.detail)).toContain("aucun titre entre la liste « avant » (e04) et la première étape ; la bascule les sépare.");
  });
  it("une liste commencée à 6 s ou plus est refusée", () => {
    const m = regleOrdre(ficheVideo1(), contexteVideo1({ debitMotsParSeconde: 1.5 }));
    expect(m.map((x) => x.ecranId)).toEqual(["e03"]);
    expect(m[0].detail).toMatch(/^la liste « avant » commence à 6,\d s/);
  });
  it("le reste humain dit avant la première étape est refusé", () => {
    const c = contexteVideo1();
    c.cas.resteHumain = "Alors on a tout automatisé.";
    expect(regleOrdre(ficheVideo1(), c)).toEqual([{ ecranId: "e06", detail: "le reste humain du cas est dit avant la première étape ; il vient après." }]);
  });
  it("un résultat avant la dernière étape, ou une question qui n'est pas le dernier écran, sont refusés", () => {
    const f = avec(ficheVideo1(), (x) => {
      const [resultat] = x.ecrans.splice(16, 1);
      x.ecrans.splice(10, 0, resultat);
    });
    expect(details(regleOrdre(f, ctx))).toContain("le résultat vient avant la dernière étape");
    const g = avec(ficheVideo1(), (x) => {
      const [question] = x.ecrans.splice(17, 1);
      x.ecrans.splice(16, 0, question);
    });
    expect(details(regleOrdre(g, ctx))).toContain("le dernier écran du corps doit être la question");
  });
});

describe("R05 · durée d'un écran", () => {
  it("chaque écran estimé tient entre 1,0 et 5,0 s", () => {
    expect(regleDureeEcran(ficheVideo1(), ctx)).toEqual([]);
  });
  it("un écran estimé à 5,4 s est refusé", () => {
    // 18 mots à 3,4 mots par seconde (5,29 s) et 106 ms d'avance : 5,4 s ; le refus est jugé au débit prudent de 3,0 : 6,11 s.
    const f = avec(ficheVideo1(), (x) => {
      x.ecrans[14].texteDit = "Et le dossier est classé tout seul dans le bon dossier de l'apporteur avec toutes ses pièces jointes.";
      x.ecrans[14].avanceMs = 106;
    });
    const t = tempsEcrans(f.ecrans)[14];
    expect(Math.round(t.finMs - t.debutMs)).toBe(5400);
    expect(regleDureeEcran(f, ctx)).toEqual([{ ecranId: "e15", detail: "l'écran est estimé à 6,11 s ; 5 s au plus." }]);
  });
  it("B3 · un écran de 16 mots lus sans avance est refusé au débit prudent (5,3 s)", () => {
    const f = avec(ficheVideo1(), (x) => {
      x.ecrans[14].texteDit = "Et le dossier est classé tout seul dans le bon dossier de l'apporteur avec ses pièces.";
      x.ecrans[14].avanceMs = 0;
      x.ecrans[15].avanceMs = 0;
    });
    expect(motsLus(f.ecrans[14].texteDit)).toHaveLength(16);
    const m = regleDureeEcran(f, ctx).filter((x) => x.ecranId === "e15");
    expect(m).toHaveLength(1);
    expect(m[0].detail).toMatch(/^l'écran est estimé à 5,3\d s ; 5 s au plus\.$/);
  });
  it("B3 · le même écran à 14 mots est accepté", () => {
    const f = avec(ficheVideo1(), (x) => {
      x.ecrans[14].texteDit = "Et le dossier est classé tout seul dans le bon dossier de l'apporteur concerné.";
      x.ecrans[14].avanceMs = 0;
      x.ecrans[15].avanceMs = 0;
    });
    expect(motsLus(f.ecrans[14].texteDit)).toHaveLength(14);
    expect(regleDureeEcran(f, ctx).filter((x) => x.ecranId === "e15")).toEqual([]);
  });
  it("un écran trop court est refusé", () => {
    const f = avec(ficheVideo1(), (x) => {
      x.ecrans[1].avanceMs = 0;
    });
    expect(regleDureeEcran(f, ctx)).toMatchObject([{ ecranId: "e02", detail: expect.stringMatching(/^l'écran est estimé à 0,\d\d s ; 1 s au moins\.$/) }]);
  });
  it("X1 · un écran calé de 0,96 s : la durée est donnée à deux décimales, jamais arrondie vers le seuil", () => {
    const f = avec(ficheVideo1(), (x) => {
      x.ecrans.forEach((e, i) => {
        e.debutMs = i * 2000;
        e.finMs = (i + 1) * 2000;
      });
      x.ecrans[3].finMs = 6960;
      x.ecrans[4].debutMs = 6960;
    });
    expect(regleDureeEcran(f, ctx)).toEqual([{ ecranId: "e04", detail: "l'écran dure 0,96 s ; 1 s au moins." }]);
  });
  it("sur une fiche calée, les heures sont reprises", () => {
    const f = avec(ficheVideo1(), (x) => {
      x.ecrans.forEach((e, i) => {
        e.debutMs = i * 2000;
        e.finMs = (i + 1) * 2000;
      });
      x.ecrans[3].finMs = 9200;
      x.ecrans.slice(4).forEach((e, i) => {
        e.debutMs = 9200 + i * 2000;
        e.finMs = 9200 + (i + 1) * 2000;
      });
    });
    expect(regleDureeEcran(f, ctx)).toEqual([]);
    // V4-3 : une liste « avant » (e04) dure jusqu'à 12 s (la v4 : 9,2 s) ; tout autre écran, 5 s au plus.
    const g = avec(f, (x) => {
      x.ecrans[3].debutMs = 3000;
    });
    expect(regleDureeEcran(g, ctx)).toEqual([]);
    const h = avec(f, (x) => {
      x.ecrans[4].finMs = x.ecrans[4].debutMs! + 6200;
    });
    expect(regleDureeEcran(h, ctx)).toEqual([{ ecranId: "e05", detail: "l'écran dure 6,20 s ; 5 s au plus." }]);
  });
  it("dans une fin, la tenue finale de 2,1 s du dernier écran ne compte pas", () => {
    const fin = (finDernier: number): { ecrans: EcranFin[] } => ({
      ecrans: [
        { id: "f01", type: "appel-mot", fond: "sombre", marque: "axion-ia.com", texteDit: "Écrivez I.A. en commentaire.", avanceMs: 0, evenements: [], fins: ["fin-if-mot"], mot: "IA", debutMs: 40000, finMs: 42000 },
        { id: "f02", type: "lien", fond: "ivoire", marque: "axion-ia.com", texteDit: "Le lien est dans mon profil.", avanceMs: 0, evenements: [], fins: ["fin-tt-lien-profil"], titre: "Le lien est dans mon profil", bulle: "Diagnostic gratuit · lien dans le profil", debutMs: 42000, finMs: finDernier },
      ],
    });
    expect(regleDureeEcransFin(fin(48500), ctx)).toEqual([]);
    expect(regleDureeEcransFin(fin(49500), ctx)).toEqual([{ ecranId: "f02", detail: "l'écran dure 5,40 s ; 5 s au plus." }]);
  });
});

describe("R06 · rythme", () => {
  it("un événement visible toutes les 2 s au plus, débit de la recette", () => {
    expect(regleRythme(ficheVideo1(), ctx)).toEqual([]);
  });
  it("un écran sans événement sur plus de 2 s est refusé", () => {
    const f = avec(ficheVideo1(), (x) => {
      x.ecrans[13].evenements = [];
    });
    const m = regleRythme(f, ctx);
    expect(m).toHaveLength(1);
    expect(m[0].ecranId).toBe("e14");
    expect(m[0].detail).toMatch(/^rien ne bouge pendant 3,2 s/);
  });
  it("B3-bis · le débit minimal est 3,0 : 3,0 accepté, 2,9 refusé", () => {
    expect(regleRythme(ficheVideo1(), contexteVideo1({ debitMotsParSeconde: 3.0 })).map((m) => m.detail).filter((d) => d.startsWith("débit"))).toEqual([]);
    expect(regleRythme(ficheVideo1(), contexteVideo1({ debitMotsParSeconde: 2.9 })).map((m) => m.detail)).toContain("débit de 2,9 mots par seconde ; il doit rester entre 3 et 3,9.");
  });
  it("un débit hors de 3 à 3,9 mots par seconde est refusé", () => {
    expect(regleRythme(ficheVideo1(), contexteVideo1({ debitMotsParSeconde: 4.2 })).map((m) => m.detail)).toContain("débit de 4,2 mots par seconde ; il doit rester entre 3 et 3,9.");
  });
});

describe("R07 · fonds alternés", () => {
  it("deux écrans de suite sur le même fond passent", () => {
    const f = avec(ficheVideo1(), (x) => {
      x.ecrans[2].fond = "ivoire";
      x.ecrans[3].fond = "sombre";
    });
    expect(regleFondsAlternes(f)).toEqual([]);
  });
  // V4-3 : trois écrans de suite sur le même fond passent (la v4 : s11, s12, s13) ; le quatrième est refusé.
  it("trois fonds sombres de suite passent, quatre sont refusés", () => {
    const f = avec(ficheVideo1(), (x) => {
      x.ecrans[3].fond = "sombre";
      x.ecrans[4].fond = "sombre";
    });
    expect(regleFondsAlternes(f)).toEqual([]);
    const g = avec(f, (x) => {
      x.ecrans[5].fond = "sombre";
    });
    expect(regleFondsAlternes(g)).toEqual([{ ecranId: "e06", detail: "quatrième écran de suite sur fond sombre ; les fonds alternent." }]);
  });
});

describe("R08 · textes d'écran courts", () => {
  it("titres de 3 mots, lignes de 8 mots, puces de 3 mots passent", () => {
    expect(regleTextesCourts(ficheVideo1())).toEqual([]);
  });
  it("un titre, une ligne ou une puce trop longs sont refusés", () => {
    const f = avec(ficheVideo1(), (x) => {
      ecran(x, 5, "titre").lignes = ["Alors on automatise tout"];
      ecran(x, 6, "etape").ligne = "La personne voit notre annonce sur son téléphone ce matin.";
      ecran(x, 15, "preuve").puces = ["100 % automatique", "Sans aucune intervention manuelle"];
    });
    expect(regleTextesCourts(f)).toEqual([
      { ecranId: "e06", detail: "titre « Alors on automatise tout » de 4 mots ; 3 au plus." },
      { ecranId: "e07", detail: "ligne « La personne voit notre annonce sur son téléphone ce matin. » de 10 mots ; 8 au plus." },
      { ecranId: "e16", detail: "puce « Sans aucune intervention manuelle » de 4 mots ; 3 au plus." },
    ]);
  });
});

describe("R09 · marque présente", () => {
  it("« axion-ia.com » sur chaque écran passe", () => {
    expect(regleMarque(ficheVideo1())).toEqual([]);
  });
  it("une autre marque est refusée", () => {
    const f = avec(ficheVideo1(), (x) => {
      x.ecrans[2].marque = "Axion";
    });
    expect(regleMarque(f)).toEqual([{ ecranId: "e03", detail: "la marque « axion-ia.com » doit figurer en haut de l'écran (lu : « Axion »)." }]);
  });
});

describe("R10 · mots interdits", () => {
  it("la liste du format", () => {
    expect(MOTS_INTERDITS_FORMAT).toEqual(["machine", "machines", "Villeexemple", "aucun gain garanti"]);
  });
  it("« partout en France » est accepté", () => {
    const f = avec(ficheVideo1(), (x) => {
      ecran(x, 6, "etape").ligne = "Partout en France.";
    });
    expect(regleMotsInterdits(f, ctx)).toEqual([]);
  });
  it("« La machine tourne seule » est refusé", () => {
    const f = avec(ficheVideo1(), (x) => {
      ecran(x, 5, "titre").lignes = ["La machine tourne seule"];
    });
    expect(regleMotsInterdits(f, ctx)).toEqual([{ ecranId: "e06", detail: "« La machine tourne seule » contient le mot interdit « machine »." }]);
  });
  it("« à Villeexemple » est refusé, dit ou écrit", () => {
    const f = avec(ficheVideo1(), (x) => {
      ecran(x, 6, "etape").ligne = "Une annonce à Villeexemple.";
    });
    expect(regleMotsInterdits(f, ctx).map((m) => m.ecranId)).toEqual(["e07"]);
  });
  it("les interdits de Will et ceux passés par l'appelant sont appliqués", () => {
    const c = contexteVideo1({ motsInterdits: ["visio"], interdits: [{ id: "i1", texte: "jamais « seul travail »", regex: "seul travail", origine: "will" }] });
    expect(details(regleMotsInterdits(ficheVideo1(), c))).toBe(
      [
        "e12 : « Nous, on arrive pour la visio. » contient le mot interdit « visio ».",
        "e12 : « La visio » contient le mot interdit « visio ».",
        "e13 : « Quinze minutes. C'est notre seul travail. » enfreint un interdit de Will : jamais « seul travail » (« seul travail »).",
        "e13 : « Notre seul travail » enfreint un interdit de Will : jamais « seul travail » (« seul travail »).",
      ].join("\n"),
    );
  });
});

describe("R11 · vouvoiement", () => {
  it("le vouvoiement passe", () => {
    expect(regleVouvoiement(ficheVideo1())).toEqual([]);
  });
  it("le tutoiement est refusé, dit ou écrit", () => {
    const f = avec(ficheVideo1(), (x) => {
      ecran(x, 17, "question").question = "Et toi, quelle tâche ?";
    });
    expect(regleVouvoiement(f)).toEqual([{ ecranId: "e18", detail: "« Et toi, quelle tâche ? » tutoie ; le format vouvoie." }]);
  });
});

describe("R11 · « ton » nom et « ton » possessif", () => {
  const refus = (t: string) => {
    const f = avec(ficheVideo1(), (x) => {
      x.ecrans[7].texteDit = t;
    });
    return regleVouvoiement(f);
  };
  it.each(["Une première version au bon ton.", "Le ton est donné.", "Un ton posé, sans jargon.", "On peut changer de ton."])("« %s » n'est pas un tutoiement", (t) => {
    expect(refus(t)).toEqual([]);
  });
  it.each(["Ouvre ton agenda.", "Tu gagnes du temps.", "Prends tes notes.", "Je te rappelle.", "Et toi ?", "Dans ta boîte de réception.", "Change ton ton."])("« %s » reste refusé", (t) => {
    expect(refus(t)).toHaveLength(1);
  });
});

describe("nombres en lettres", () => {
  it("de 0 à 100, « un » et « une » seulement devant une unité, « cent pour cent »", () => {
    expect(nombresDe("quinze minutes, vingt et une heures, soixante-dix, quatre-vingt-dix-neuf, cent")).toEqual([15, 21, 70, 99, 100]);
    expect(nombresDe("une automatisation")).toEqual([]);
    expect(nombresDe("une heure")).toEqual([1]);
    expect(texteAvecNombres("cent pour cent automatique")).toBe("100 % automatique");
    expect(texteAvecNombres("Plus d'une heure")).toBe("plus d 1 heure");
    expect(nombresDe("deux, trois")).toEqual([2, 3]);
  });
});
