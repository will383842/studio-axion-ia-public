/**
 * M1b · Règles R12 à R22 de la fiche d'écrans et validation complète (plan cas concret § 6.3) : par règle, un cas qui
 * passe et un cas refusé, message en français qui nomme l'écran.
 */
import { describe, expect, it } from "vitest";
import { recrutementApporteurs } from "@/formats/cas-concret/catalogue/recrutement-apporteurs";
import { CATALOGUE } from "@/formats/cas-concret/catalogue";
import type { EcranFin } from "@/moteurs/montage-cas-concret/fiche";
import {
  LISTE_BLANCHE_NOMS,
  REGLES_CAS_CONCRET,
  cadeauDeLOffre,
  nombresDe,
  nomsPropres,
  problemesDuCas,
  regleConformite,
  regleDureeTotale,
  regleNombreEcrans,
  regleNombresDesFaits,
  regleReserveEstimation,
  regleSansAppel,
  regleSansPrix,
  regleSansTemoignage,
  regleSansUsageReel,
  regleSigles,
  regleVisuelsConnus,
  sansPointsDeSigle,
  texteNormalise,
  validerFicheEcrans,
  verifierRegles,
} from "@/moteurs/montage-cas-concret/regles";
import { avec, contexteVideo1, details, ecran, ficheVideo1 } from "../outils";

const ctx = contexteVideo1();

describe("M1b · liste des règles et validation complète", () => {
  // V4-3 : R23 (ordre du fonctionnement) s'ajoute à la suite.
  it("REGLES_CAS_CONCRET : R02 à R23, dans l'ordre", () => {
    expect(REGLES_CAS_CONCRET.map((r) => r.id)).toEqual(Array.from({ length: 22 }, (_, i) => `R${String(i + 2).padStart(2, "0")}`));
  });

  it("la fiche de la vidéo 1 passe le schéma et les 21 règles avec le cas du catalogue", () => {
    const r = validerFicheEcrans(ficheVideo1(), ctx);
    expect(r.ok ? [] : r.problemes.map((p) => p.message)).toEqual([]);
  });

  it("le schéma est vérifié d'abord : une fiche mal formée n'atteint pas les règles", () => {
    const brut = { ...ficheVideo1(), auteur: "x" };
    const r = validerFicheEcrans(brut, ctx);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.problemes.map((p) => p.regle)).toEqual(["schéma exact"]);
  });

  it("les manquements des règles sont rendus avec l'écran et le nom de la règle", () => {
    const f = avec(ficheVideo1(), (x) => {
      ecran(x, 6, "etape").ligne = "Écrivez IA en commentaire.";
    });
    const r = validerFicheEcrans(f, ctx);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.problemes.map((p) => p.message)).toContain("Écran e07 · règle « aucun appel dans le corps » : « Écrivez IA en commentaire. » contient « en commentaire » ; l'appel vient de la table des fins, jamais du corps.");
  });

  it("le document promis du cas est le cadeau de son offre", () => {
    for (const cas of CATALOGUE) expect(problemesDuCas(cas), cas.id).toEqual([]);
    expect(cadeauDeLOffre("formation")).toBe("fin-if-cadeau-formation");
    const c = contexteVideo1();
    c.cas.documentPromis.finCadeauId = "fin-if-cadeau-audit";
    const r = validerFicheEcrans(ficheVideo1(), c);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.problemes[0].message).toBe("Fiche · règle « document promis » : le document promis « Structure de l'automatisation » ne correspond pas au cadeau annoncé par la fin de l'offre.");
  });
});

describe("R12 · tout nombre est la valeur d'un fait", () => {
  it("les nombres de la vidéo 1 viennent des faits (et de la phrase de conformité validée)", () => {
    expect(regleNombresDesFaits(ficheVideo1(), ctx)).toEqual([]);
  });
  it("un nombre absent des faits est refusé, dit ou écrit", () => {
    const f = avec(ficheVideo1(), (x) => {
      x.ecrans[12].texteDit = "Trente minutes. C'est notre seul travail.";
      ecran(x, 7, "etape").puces = ["12 secondes"];
    });
    expect(regleNombresDesFaits(f, ctx)).toEqual([
      { ecranId: "e08", detail: "« 12 » ne vient d'aucun fait du cas ; tout nombre dit ou écrit est la valeur d'un fait." },
      { ecranId: "e13", detail: "« 30 » ne vient d'aucun fait du cas ; tout nombre dit ou écrit est la valeur d'un fait." },
    ]);
  });
  it("centaines et milliers en lettres (essai blog du 15/10 : « 9 » et « 3 » refusés à tort)", () => {
    expect(nombresDe("L'I.A. écrit neuf cents à mille trois cents mots.")).toEqual([900, 1300]);
    expect(nombresDe("Deux cent mille.")).toEqual([200000]);
    expect(nombresDe("Cent vingt.")).toEqual([120]);
    expect(nombresDe("Quatre-vingt-dix-neuf cent.")).toEqual([99, 100]);
    expect(nombresDe("Sous soixante-quinze sur cent.")).toEqual([75, 100]);
  });
  it("« du neuf » n'est pas 9, « neuf articles » et « à neuf heures » le sont", () => {
    expect(nombresDe("Du neuf chaque jour, tout neuf.")).toEqual([]);
    expect(nombresDe("Neuf articles, du neuf heures au soir, à neuf heures.")).toEqual([9, 9, 9]);
  });
  it("« une automatisation » n'est pas un nombre, « une heure » en est un", () => {
    expect(nombresDe("Une automatisation de plus.")).toEqual([]);
    expect(nombresDe("En une heure.")).toEqual([1]);
    const f = avec(ficheVideo1(), (x) => {
      ecran(x, 6, "etape").ligne = "Une automatisation simple.";
    });
    expect(regleNombresDesFaits(f, ctx)).toEqual([]);
    const sansFait = contexteVideo1();
    sansFait.cas.faits = sansFait.cas.faits.filter((x) => x.id !== "plus-d-une-heure");
    expect(details(regleNombresDesFaits(ficheVideo1(), sansFait))).toContain("e05 : « 1 » ne vient d'aucun fait du cas");
  });
  it("le chiffre montré est une valeur de son fait", () => {
    const f = avec(ficheVideo1(), (x) => {
      ecran(x, 1, "chiffre").faitId = "filet-vingt-quatre-heures";
    });
    expect(regleNombresDesFaits(f, ctx)).toEqual([{ ecranId: "e02", detail: "le chiffre « 15 » n'est pas une valeur du fait « Sans réservation après 24 heures, l'invitation part quand même. »." }]);
  });
});

describe("R13 · une estimation est dite avec sa réserve", () => {
  it("« Plus d'une heure » porte sa réserve ; « environ » aussi", () => {
    expect(regleReserveEstimation(ficheVideo1(), ctx)).toEqual([]);
    const f = avec(ficheVideo1(), (x) => {
      x.ecrans[4].texteDit = "Environ une heure, pour chaque personne.";
    });
    expect(regleReserveEstimation(f, ctx)).toEqual([]);
  });
  it("une estimation dite sans réserve est refusée", () => {
    const f = avec(ficheVideo1(), (x) => {
      x.ecrans[4].texteDit = "Une heure, pour chaque personne.";
    });
    expect(regleReserveEstimation(f, ctx)).toEqual([{ ecranId: "e05", detail: "« Plus d'une heure, pour chaque personne. » est une estimation ; dites-la avec sa réserve (« plus d' », « plus de », « environ »)." }]);
  });
});

describe("R14 · aucun récit de client, aucun nom propre hors liste blanche", () => {
  it("la liste blanche", () => {
    expect(LISTE_BLANCHE_NOMS).toEqual(["Axion-IA", "IA", "Facebook", "Instagram", "LinkedIn", "TikTok"]);
  });
  it("la vidéo 1 passe ; les noms de la liste blanche et les sigles passent", () => {
    expect(regleSansTemoignage(ficheVideo1())).toEqual([]);
    expect(nomsPropres("La personne voit notre annonce sur Facebook, puis chez Axion-IA, conforme au RGPD.")).toEqual([]);
  });
  it("« un de nos clients a gagné » est refusé", () => {
    const f = avec(ficheVideo1(), (x) => {
      ecran(x, 16, "resultat").ligne = "Un de nos clients a gagné des heures.";
    });
    expect(regleSansTemoignage(f)).toEqual([{ ecranId: "e17", detail: "« Un de nos clients a gagné des heures. » raconte un client ; le format montre le cas, jamais un témoignage." }]);
  });
  it("un nom propre ou un mot de témoignage est refusé", () => {
    const f = avec(ficheVideo1(), (x) => {
      ecran(x, 6, "etape").ligne = "Camille voit notre annonce.";
      ecran(x, 7, "etape").ligne = "Elle s'inscrit chez Dupont.";
      ecran(x, 16, "resultat").titre = "Leur avis";
    });
    expect(details(regleSansTemoignage(f))).toBe(
      ["e08 : « Elle s'inscrit chez Dupont. » cite « Dupont » ; aucun nom propre hors Axion-IA, IA, Facebook, Instagram, LinkedIn, TikTok.", "e17 : « Leur avis » contient « avis » ; aucun avis ni témoignage."].join("\n"),
    );
    // En tête de phrase, la majuscule ne dit rien (e07 passe : limite connue) ; ailleurs, le prénom est repéré.
    expect(nomsPropres("Ensuite, Camille signe.")).toEqual(["Camille"]);
  });
});

describe("R15 · posture « offre » ou porte B : aucune tournure d'usage réel", () => {
  const etapesSeules = (posture: "offre" | "chez-nous", origine: "porte-a" | "porte-b" = "porte-a") =>
    avec(ficheVideo1(), (x) => {
      x.posture = posture;
      x.origine = origine;
      x.ecrans = x.ecrans.slice(6, 11);
    });
  it("posture « chez-nous » : la vidéo 1 passe ; posture « offre » sans tournure d'usage réel : passe", () => {
    expect(regleSansUsageReel(ficheVideo1())).toEqual([]);
    expect(regleSansUsageReel(etapesSeules("offre"))).toEqual([]);
  });
  it("posture « offre » avec « chez nous » est refusée ; porte B aussi", () => {
    const f = avec(etapesSeules("offre"), (x) => {
      ecran(x, 0, "etape").ligne = "Chez nous, l'annonce part seule.";
    });
    expect(regleSansUsageReel(f)).toEqual([{ ecranId: "e07", detail: "« Chez nous, l'annonce part seule. » dit « chez nous » ; ce cas est une offre, pas un usage réel chez nous." }]);
    const g = avec(etapesSeules("chez-nous", "porte-b"), (x) => {
      x.ecrans[1].texteDit = "Nous utilisons ce formulaire.";
    });
    expect(regleSansUsageReel(g).map((m) => m.ecranId)).toEqual(["e08"]);
  });
});

describe("R16 · aucun prix hors grille officielle", () => {
  it("sans prix, ou un prix de la grille officielle (fait du site), passe", () => {
    expect(regleSansPrix(ficheVideo1(), ctx)).toEqual([]);
    const c = contexteVideo1();
    c.cas.faits.push({ id: "prix-diagnostic", enonce: "Le diagnostic coûte 49 € sur le site.", valeurs: [49], source: "site", preuve: "Page des tarifs." });
    const f = avec(ficheVideo1(), (x) => {
      ecran(x, 6, "etape").ligne = "Un diagnostic à 49 €.";
    });
    expect(regleSansPrix(f, c)).toEqual([]);
  });
  it("un prix hors grille est refusé, en chiffres ou en lettres", () => {
    const f = avec(ficheVideo1(), (x) => {
      ecran(x, 6, "etape").ligne = "Un diagnostic à 49 €.";
      x.ecrans[7].texteDit = "Pour vingt euros par mois.";
    });
    expect(details(regleSansPrix(f, ctx))).toBe(
      ["e07 : « Un diagnostic à 49 €. » donne un prix ; aucun prix hors de la grille officielle.", "e08 : « Pour vingt euros par mois. » donne un prix ; aucun prix hors de la grille officielle."].join("\n"),
    );
  });
});

describe("R17 · phrase de conformité", () => {
  it("normalisation : « R.G.P.D. » = « RGPD », « cent pour cent » = « 100 % »", () => {
    expect(sansPointsDeSigle("au R.G.P.D. :")).toBe("au RGPD :");
    expect(texteNormalise("R.G.P.D., cent pour cent")).toBe(texteNormalise("RGPD, 100 %"));
  });
  it("acceptée avec le fait : écrite « RGPD, 100 % », dite « R.G.P.D., cent pour cent »", () => {
    expect(regleConformite(ficheVideo1(), ctx)).toEqual([]);
  });
  it("refusée sans le fait", () => {
    const c = contexteVideo1();
    delete c.cas.conformite;
    expect(regleConformite(ficheVideo1(), c)).toEqual([{ ecranId: "e16", detail: "la conformité n'est dite que si le cas porte le fait validé ; ce cas ne le porte pas." }]);
  });
  it("refusée si elle n'est pas dite mot pour mot, ou si l'écran s'en écarte", () => {
    const f = avec(ficheVideo1(), (x) => {
      x.ecrans[15].texteDit = "Et tout est conforme au R.G.P.D. : cent pour cent automatique.";
      ecran(x, 15, "preuve").titre = "Conforme à la loi";
    });
    expect(regleConformite(f, ctx)).toEqual([
      { ecranId: "e16", detail: "la phrase de conformité doit être dite mot pour mot : « Tout est conforme au R.G.P.D. : cent pour cent automatique, sans aucune intervention manuelle. »" },
      { ecranId: "e16", detail: "« Conforme à la loi » s'écarte de la phrase de conformité validée (« a », « la », « loi »)." },
    ]);
  });
});

describe("R18 · aucune phrase d'appel dans le corps", () => {
  it("« le lien de réservation part par e-mail » est accepté dans le corps", () => {
    const f = avec(ficheVideo1(), (x) => {
      ecran(x, 9, "etape").ligne = "Le lien de réservation part par e-mail.";
    });
    expect(regleSansAppel(f)).toEqual([]);
  });
  it("« Écrivez IA en commentaire » est refusé, et chaque tournure de la liste", () => {
    const f = avec(ficheVideo1(), (x) => {
      x.ecrans[17].texteDit = "Écrivez IA en commentaire.";
      ecran(x, 6, "etape").puces = ["Dans la bio"];
      ecran(x, 9, "etape").ligne = "Faites votre diagnostic gratuit.";
    });
    expect(regleSansAppel(f).map((m) => m.ecranId)).toEqual(["e07", "e10", "e18"]);
  });
});

describe("R19 · objets et captures connus, toute capture a un repli", () => {
  it("les visuels de la vidéo 1 sont connus", () => {
    expect(regleVisuelsConnus(ficheVideo1(), ctx)).toEqual([]);
  });
  it("un vrai écran qui vise une étape sans capture, ou absente, est refusé", () => {
    const f = avec(ficheVideo1(), (x) => {
      ecran(x, 6, "etape").visuel = { sorte: "ecran", etapeCas: 1, repli: "telephone-capture" };
      ecran(x, 7, "etape").visuel = { sorte: "ecran", etapeCas: 7, repli: "telephone-capture" };
    });
    expect(regleVisuelsConnus(f, ctx)).toEqual([
      { ecranId: "e07", detail: "l'étape 1 du cas n'a pas de vrai écran à montrer." },
      { ecranId: "e08", detail: "le vrai écran vise l'étape 7 ; le cas n'en a que 6." },
    ]);
  });
  it("un objet ou un repli hors banque est refusé (fiche non passée par le schéma)", () => {
    const f = avec(ficheVideo1(), (x) => {
      (ecran(x, 11, "objet").visuel as { objet: string }).objet = "personnage";
      (ecran(x, 7, "etape").visuel as { repli: string }).repli = "dessin-libre";
    });
    expect(details(regleVisuelsConnus(f, ctx))).toBe(["e08 : le repli « dessin-libre » n'est pas dans la banque ; toute capture a un repli connu.", "e12 : l'objet « personnage » n'est pas dans la banque."].join("\n"));
  });
});

describe("R20 · 12 à 26 écrans, 3 à 7 étapes", () => {
  it("la vidéo 1 (18 écrans, 6 étapes) passe", () => {
    expect(regleNombreEcrans(ficheVideo1())).toEqual([]);
  });
  it("trop peu d'écrans, trop peu d'étapes, ou une numérotation fausse sont refusés", () => {
    const f = avec(ficheVideo1(), (x) => {
      x.ecrans = [...x.ecrans.slice(0, 8), ...x.ecrans.slice(15)];
      ecran(x, 6, "etape").total = 2;
      ecran(x, 7, "etape").total = 2;
    });
    expect(regleNombreEcrans(f)).toEqual([{ detail: "le corps compte 11 écrans ; de 12 à 26." }, { detail: "la fiche compte 2 étapes ; de 3 à 7." }]);
    const g = avec(ficheVideo1(), (x) => {
      ecran(x, 9, "etape").numero = 5;
    });
    expect(regleNombreEcrans(g)).toEqual([{ ecranId: "e10", detail: "l'étape est numérotée 5 sur 6 ; attendu 4 sur 6." }]);
  });
});

describe("R21 · durée estimée du tout", () => {
  it("la vidéo 1, fin la plus longue de la table comprise, tient entre 35 et 65 s", () => {
    expect(regleDureeTotale(ficheVideo1(), ctx)).toEqual([]);
  });
  it("une vidéo trop courte est refusée", () => {
    const f = avec(ficheVideo1(), (x) => {
      x.ecrans = x.ecrans.slice(0, 9);
    });
    expect(regleDureeTotale(f, ctx)).toEqual([{ detail: "la vidéo est estimée à 23,3 s, fin la plus longue comprise ; elle doit tenir de 35,0 s à 65,0 s (visée : 40 à 60 s)." }]);
  });
  it("les fins planifiées, si elles sont passées, remplacent la table", () => {
    const fin = (finMs: number): { ecrans: EcranFin[] } => ({
      ecrans: [{ id: "f01", type: "lien", fond: "sombre", marque: "axion-ia.com", texteDit: "Le lien est dans mon profil.", avanceMs: 0, evenements: [], fins: ["fin-tt-lien-profil"], titre: "Le lien est dans mon profil", bulle: "Diagnostic gratuit · lien dans le profil", debutMs: 0, finMs }],
    });
    expect(regleDureeTotale(ficheVideo1(), contexteVideo1({ fins: [fin(4000), fin(9000)] }))).toEqual([]);
    expect(regleDureeTotale(ficheVideo1(), contexteVideo1({ fins: [fin(4000), fin(30000)] }))[0].detail).toMatch(/^la vidéo est estimée à 68,8 s/);
  });
});

describe("R22 · sigles écrits pour être lus dans le texte dit seulement", () => {
  it("« R.G.P.D. » dit et « RGPD » écrit passent", () => {
    expect(regleSigles(ficheVideo1())).toEqual([]);
  });
  it("« RGPD » dit, ou « R.G.P.D. » écrit, sont refusés", () => {
    const f = avec(ficheVideo1(), (x) => {
      x.ecrans[15].texteDit = "Et tout est conforme au RGPD : cent pour cent automatique, sans aucune intervention manuelle.";
      ecran(x, 15, "preuve").titre = "Conforme au R.G.P.D.";
    });
    expect(regleSigles(f)).toEqual([
      { ecranId: "e16", detail: "« RGPD » est dit ; écrivez-le pour être lu (« R.G.P.D. »)." },
      { ecranId: "e16", detail: "« Conforme au R.G.P.D. » montre « R.G.P.D. » ; à l'écran, le sigle s'écrit « RGPD »." },
    ]);
  });
});

describe("M1b · le cas du catalogue est celui de la vidéo", () => {
  it("le contexte de test reprend le cas 8 sans le modifier", () => {
    expect(ctx.cas).toEqual(recrutementApporteurs);
    expect(verifierRegles(ficheVideo1(), ctx, REGLES_CAS_CONCRET)).toEqual([]);
  });
});
