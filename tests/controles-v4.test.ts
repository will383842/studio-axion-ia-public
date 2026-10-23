/**
 * CONTRÔLES ÉTALONNÉS SUR LA V4 DE WILL (sa référence d'écriture, `docs/formats/v4-reference/voix4.json`).
 *
 * Au barème « machine », la v4 n'a AUCUNE violation bloquante et son voyant est vert : les contrôles qui sanctionnaient
 * ses procédés (anaphore « toute seule », écho « Oui, quinze minutes. », 5 étapes d'une même solution, « ça : » qui
 * annonce une liste, liste après deux-points, « Résultat : » de son carnet de voix) sont recalibrés. Un contre-exemple
 * mauvais (abstrait, pré-roll, tournures IA, interdit permanent) reste rouge. Les garde-fous sont limités au légal, à
 * l'invention et à l'appel. Contrôles de rétention C89-C93 : information, poids modeste.
 */
import { describe, expect, it } from "vitest";
import { codesLeves, controlerVersion, GARDE_FOUS, NIVEAUX, noterVersion, voyant, type EntreeControle } from "@/domaine/controles-script";
import { problemeAbstrait } from "@/domaine/controles-script";
import { matiere, texteDe } from "./helpers/g3";
import { versionV4 } from "./helpers/v4";

const resultat = (e: EntreeControle) => {
  const r = controlerVersion(e);
  return { r, note: noterVersion(r.violations) };
};

describe("la v4 de Will passe les contrôles", () => {
  it("barème machine : aucune violation bloquante, voyant vert", () => {
    const { r, note } = resultat(versionV4("machine"));
    expect(codesLeves(r, ["bloquant"])).toEqual([]);
    expect(r.passe).toBe(true);
    expect(note.gardeFous.echecs).toEqual([]);
    expect(note.globale).toBeGreaterThanOrEqual(85);
    expect(voyant(note)).toBe("vert");
  });

  it("barème Will : voyant vert", () => {
    const { r, note } = resultat(versionV4("will"));
    expect(r.passe).toBe(true);
    expect(voyant(note)).toBe("vert");
  });

  it("aucun des procédés de la v4 n'est relevé (anaphore, écho, « ça : », liste, nombre répété, carnet de voix)", () => {
    const codes = codesLeves(controlerVersion(versionV4("machine")));
    for (const c of ["C5", "C9", "C10", "C33", "C38", "C38 bis", "C41", "C77"]) expect(codes).not.toContain(c);
  });

  it("aucun contrôle de rétention ne se lève sur la v4", () => {
    const codes = codesLeves(controlerVersion(versionV4("machine")));
    for (const c of ["C89", "C90", "C91", "C92", "C93"]) expect(codes).not.toContain(c);
  });
});

describe("un contre-exemple mauvais reste rouge", () => {
  const mauvais = () =>
    versionV4("machine", (e) => {
      texteDe(e, "a1", "Bonjour, dans cette vidéo je vous parle de transformation.", { preuveIds: [], matiereIds: [] });
      texteDe(e, "a2", "Aujourd'hui, l'innovation change tout pour les entreprises.", { preuveIds: [], coupeCourteVoulue: false });
      texteDe(e, "c3", "Et devinez quoi ? C'est là que tout bascule.");
      texteDe(e, "c9", "Nos équipes à Villeexemple ont tout optimisé.");
      e.maitre!.angle = { ...e.maitre!.angle!, probleme: "La transformation digitale" };
    });

  it("garde-fous échoués (tournures IA, interdit permanent), voyant rouge", () => {
    const { r, note } = resultat(mauvais());
    expect(r.passe).toBe(false);
    expect(note.gardeFous.echecs).toEqual(expect.arrayContaining(["C5", "C42"]));
    expect(voyant(note)).toBe("rouge");
  });

  it("pré-roll, abstraction et ouverture sans prise relevés", () => {
    const codes = codesLeves(controlerVersion(mauvais()));
    expect(codes).toEqual(expect.arrayContaining(["C3 bis", "C5", "C5 bis", "C42", "C77", "C90", "C91"]));
  });

  it("« Villeexemple » est un interdit permanent, même sans contexte de Will", () => {
    const e = versionV4("machine", (x) => ((x.contexte = undefined), texteDe(x, "c9", "Nous, on arrive à Villeexemple pour la visio.")));
    expect(controlerVersion(e).violations.some((v) => v.controle === "C42" && v.bloquant)).toBe(true);
  });
});

describe("garde-fous limités au légal, à l'invention et à l'appel", () => {
  it("la liste exacte", () => {
    expect([...GARDE_FOUS].sort()).toEqual(["C1", "C1 bis", "C1 ter", "C15", "C16", "C18", "C2", "C3", "C31", "C32", "C34", "C4", "C42", "C5", "C5 bis", "C50", "C54", "C55", "C57", "C59", "C63", "C64", "C72", "C83", "C95"].sort());
  });
  it("C32 : une parole de Will inventée, dite par son double, est un garde-fou (invention)", () => {
    const { r, note } = resultat(versionV4("machine", (e) => texteDe(e, "c11", "Je pense que c'est notre seul travail.")));
    expect(r.violations.some((v) => v.controle === "C32" && v.bloquant)).toBe(true);
    expect(note.gardeFous.echecs).toContain("C32");
    expect(voyant(note)).toBe("rouge");
  });
  it("C30, C39, C43, C62, C71, C77 n'en font plus partie", () => {
    for (const c of ["C30", "C39", "C43", "C62", "C71", "C77"]) expect(GARDE_FOUS).not.toContain(c);
  });
  it("tournures IA : niveaux inchangés (C4, C5, C5 bis bloquants pour la machine)", () => {
    expect([NIVEAUX.C4.machine, NIVEAUX.C5.machine, NIVEAUX["C5 bis"].machine]).toEqual(["bloquant", "bloquant", "bloquant"]);
  });
});

describe("recalibrages, un par procédé de la v4", () => {
  const leves = (e: EntreeControle) => codesLeves(controlerVersion(e));

  it("C5 : une expression du carnet de voix de Will n'est pas une tournure IA ; hors carnet, elle l'est", () => {
    expect(leves(versionV4("machine", (e) => (e.contexte!.carnetVoix = [])))).toContain("C5");
  });
  it("C33 : « ça : » annonce ce qui suit, ce n'est pas un renvoi ; « ça » seul en est un", () => {
    expect(leves(versionV4("machine", (e) => texteDe(e, "c1", "Ça prenait du temps : trier les candidatures, répondre à chacun.")))).toContain("C33");
  });
  it("C38 : anaphore volontaire (même groupe de mots) exemptée ; racine répétée hors refrain toujours relevée", () => {
    expect(leves(versionV4("machine", (e) => texteDe(e, "c13", "Elle signe toute seule sur son téléphone.")))).not.toContain("C38");
    const e = versionV4("machine", (x) => {
      texteDe(x, "c4", "Elle regarde notre annonce.");
      texteDe(x, "c6", "Elle reçoit et regarde ses e-mails.");
      texteDe(x, "c13", "Le contrat, elle le regarde sur son téléphone.");
    });
    expect(controlerVersion(e).violations.some((v) => v.controle === "C38" && /« regard…/.test(v.message))).toBe(true);
  });
  it("C38 bis : l'écho immédiat (« Oui, quinze minutes. ») n'est pas une redite", () => {
    expect(leves(versionV4("machine"))).not.toContain("C38 bis");
  });
  it("C39 : la suite de solutions n'est plus qu'une information (jamais bloquante)", () => {
    const r = controlerVersion(versionV4("machine", (e) => e.corps[0].segments.forEach((s) => (s.marqueurs = ["solution"]))));
    const c39 = r.violations.filter((v) => v.controle === "C39");
    expect(c39.length).toBeGreaterThan(0);
    expect(c39.every((v) => v.niveau === "info")).toBe(true);
  });
  it("C41 : le même nombre redit (écho) compte une fois ; deux nombres différents restent relevés", () => {
    expect(leves(versionV4("machine", (e) => texteDe(e, "a2", "Pas soixante, quinze.", { coupeCourteVoulue: true })))).toContain("C41");
  });
  it("C9 : une liste annoncée par « : » se lit élément par élément ; une phrase longue sans liste reste relevée", () => {
    expect(leves(versionV4("machine", (e) => texteDe(e, "c11", "C'est notre seul travail et tout le reste se fait sans personne derrière son écran.")))).toContain("C9");
  });
  it("C10 : « recrute » puis « recrutement » : la même famille compte comme répétition", () => {
    expect(leves(versionV4("machine", (e) => texteDe(e, "c15", "Résultat : des heures gagnées, à chaque embauche.")))).toContain("C10");
  });
  it("C77 : un geste du quotidien (trier, relancer) rend le problème concret", () => {
    expect(problemeAbstrait("Trier les candidatures et relancer chacun")).toBeNull();
    expect(problemeAbstrait("La transformation digitale")).not.toBeNull();
  });
  it("C78 : coût dit après 5 s → information (la v4 le dit vers 12 s)", () => {
    expect(NIVEAUX.C78.machine).toBe("info");
    expect(controlerVersion(versionV4("machine")).violations.filter((v) => v.controle === "C78").every((v) => v.niveau === "info")).toBe(true);
  });
});

describe("contrôles de rétention (information, poids modeste)", () => {
  const leves = (e: EntreeControle) => codesLeves(controlerVersion(e));

  it("tous au niveau « information », pour la machine comme pour Will", () => {
    for (const c of ["C89", "C90", "C91", "C92", "C93"]) expect(NIVEAUX[c]).toEqual({ machine: "info", will: "info" });
  });
  it("poids modeste : une information de rétention retire au plus 2 points", () => {
    const r = controlerVersion(versionV4("machine", (e) => texteDe(e, "a1", "On recrute nos nouveaux collaborateurs pour notre réseau d'apporteurs en quinze minutes seulement.")));
    expect(codesLeves(r)).toContain("C89");
    const avec = noterVersion(r.violations).globale;
    const sans = noterVersion(r.violations.filter((v) => v.controle !== "C89")).globale;
    expect(sans - avec).toBeGreaterThan(0);
    expect(sans - avec).toBeLessThanOrEqual(2);
  });
  it("C89 : 1re phrase de plus de 12 mots", () => {
    expect(leves(versionV4("machine", (e) => texteDe(e, "a1", "On recrute nos nouveaux collaborateurs pour notre réseau d'apporteurs en quinze minutes seulement.")))).toContain("C89");
  });
  it.each(["Dans cette vidéo, on recrute en quinze minutes.", "Aujourd'hui, on recrute en quinze minutes."])("C90 : pré-roll en tête (« %s »)", (t) => {
    expect(leves(versionV4("machine", (e) => texteDe(e, "a1", t)))).toContain("C90");
  });
  it("C90 ne doublonne pas C3 bis (salut, présentation)", () => {
    const codes = leves(versionV4("machine", (e) => texteDe(e, "a1", "Bonjour, on recrute en quinze minutes.")));
    expect(codes).toContain("C3 bis");
    expect(codes).not.toContain("C90");
  });
  it("C91 : ni chiffre, ni contradiction, ni « pour qui » dans les 9 premiers mots", () => {
    expect(leves(versionV4("machine", (e) => (texteDe(e, "a1", "On a changé notre manière de faire entrer les gens.", { preuveIds: [] }), texteDe(e, "a2", "Oui, vraiment.", { preuveIds: [] }))))).toContain("C91");
    expect(leves(versionV4("machine", (e) => texteDe(e, "a1", "Dirigeants, vous recrutez encore à la main ?", { preuveIds: [] })))).not.toContain("C91");
    expect(leves(versionV4("machine", (e) => texteDe(e, "a1", "Arrêtez de trier les candidatures vous-même.", { preuveIds: [] })))).not.toContain("C91");
  });
  it("C92 : la promesse de l'accroche n'est jamais reprise avant la dernière phrase", () => {
    const e = versionV4("machine", (x) => {
      texteDe(x, "c10", "Une courte visio.", { preuveIds: [] });
      x.corps[0].segments.forEach((s) => (s.marqueurs = (s.marqueurs ?? []).filter((m) => m !== "livraison" && m !== "resultat")));
    });
    expect(leves(e)).toContain("C92");
  });
  it("C93 : longueur incohérente avec la durée (80-100 mots pour 30 s, 160-190 pour 60 s, ± 15 %)", () => {
    expect(leves(versionV4("machine", (e) => (e.horodatageReel = e.horodatageReel!.map((h) => h && { debutSec: h.debutSec * 2, finSec: h.finSec * 2 }))))).toContain("C93");
    expect(leves(versionV4("machine", (e) => (e.horodatageReel = e.horodatageReel!.map((h) => h && { debutSec: h.debutSec / 2, finSec: h.finSec / 2 }))))).toContain("C93");
  });
});

describe("accord et invention : bloquants, voyant rouge (jamais de faux cas ni de faux témoignage)", () => {
  const rouge = (e: EntreeControle, code: string) => {
    const { r, note } = resultat(e);
    expect(r.violations.some((v) => v.controle === code && v.bloquant)).toBe(true);
    expect(r.passe).toBe(false);
    expect(note.gardeFous.echecs).toContain(code);
    expect(voyant(note)).toBe("rouge");
  };

  it("C55 : un cas client sans accord", () => {
    rouge(
      versionV4("machine", (e) => {
        e.matieres.push(matiere("cas-client", "Chez un client, tout est parti tout seul.", { id: "m-sans-accord", accord: { requis: true, obtenu: false } }));
        texteDe(e, "c9", "Chez un client, tout est parti tout seul.", { matiereIds: ["m-sans-accord"] });
      }),
      "C55",
    );
  });
  it("C54 : la réplique inventée d'un intervenant réel", () => {
    rouge(
      versionV4("machine", (e) => texteDe(e, "c9", "Nous, on a tout économisé.", { intervenant: { personnageId: "p-client", role: "client", joue: false } })),
      "C54",
    );
  });
  it("C16 : un superlatif sans preuve", () => {
    rouge(versionV4("machine", (e) => texteDe(e, "c14", "C'est la meilleure solution du marché.", { preuveIds: [] })), "C16");
  });
  it("C18 : un montant incrusté sans preuve", () => {
    rouge(versionV4("machine", (e) => texteDe(e, "c14", "Et le dossier est classé.", { incrustation: { type: "montant", texte: "5 000 €", sens: "gain" } })), "C18");
  });
  it("C31 : un vécu à la 1re personne sans anecdote de Will", () => {
    rouge(versionV4("machine", (e) => texteDe(e, "c9", "Hier, j'ai rencontré un client qui perdait ses heures.", { matiereIds: [] })), "C31");
  });
  it("C50 : une parole de dirigeant sans accord", () => {
    rouge(
      versionV4("machine", (e) => {
        e.maitre!.pointDeVue = "un-dirigeant";
        e.recette = { ...e.recette, pointsDeVuePermis: [...e.recette.pointsDeVuePermis, "un-dirigeant"] };
        e.matieres.push(matiere("parole-dirigeant", "Un dirigeant m'a dit : « c'est magique ».", { id: "m-parole", accord: { requis: true, obtenu: false } }));
        texteDe(e, "c9", "Un dirigeant m'a dit : c'est magique.", { matiereIds: ["m-parole"] });
      }),
      "C50",
    );
  });
});

describe("mineurs", () => {
  const leves = (e: EntreeControle) => codesLeves(controlerVersion(e));
  it("C38 : une même preuve redite dans 5 segments avec la même formule lève l'alerte si ce n'est pas une anaphore de structure", () => {
    const e = versionV4("machine", (x) => {
      for (const id of ["c4", "c6", "c7", "c13", "c14"]) texteDe(x, id, "Le dossier part en quinze minutes chrono.", { preuveIds: ["F15"] });
    });
    expect(leves(e)).toContain("C38");
  });
  it("C9 : l'exemption du « : » exige des éléments courts (6 mots au plus)", () => {
    const long = "Avant : trier toutes les candidatures reçues le matin, répondre à chacun avec un long message personnel écrit à la main, relancer ceux qui oublient de répondre.";
    expect(leves(versionV4("machine", (e) => texteDe(e, "c1", long)))).toContain("C9");
    expect(leves(versionV4("machine"))).not.toContain("C9");
  });
});
