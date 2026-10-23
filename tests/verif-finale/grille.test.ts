/**
 * VÉRIFICATION FINALE · grille « Scripts exceptionnels » : tests de contrat GRATUITS (lecture du code et des données,
 * aucun appel réseau, aucun réglage allumé). Voir `docs/ecriture/VERIF-FINALE-GRILLE.md`.
 * Les lots D, E, B2 et C2-C4 sont fusionnés : leurs points sont de vrais tests. Seuls restent en `it.todo` les points non testables
 * gratuitement ou pas encore branchés (autres générateurs, voix réelle du tableau).
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { GABARITS_ACCROCHE } from "@/domaine/qualite-script/bibliotheque-accroches";
import { ANNONCES_OUTIL_WILL, REGLES_WILL, TICS_IA_WILL } from "@/donnees/generateur/regles-will";
import { APPELS_PAR_RESEAU, LISTE_INTERDITS, RECETTES_QUALITE_REF, interditsCommuns, interditsDans, trouverRepetitions, voyantDe } from "./reference";
import { BON, RECETTE_ESSAI, code, ecarts, evaluer, variante } from "../qualite-script/aide";
import { ECRITURE_RESEAUX, regleIdsEcriture } from "@/reseaux/ecriture";
import { NOUVEAUTE_OUTIL, faitLeVousMeme } from "@/domaine/positionnement";
import { controlerSelonAuteurs } from "@/domaine/relecture-generateur";
import { NIVEAUX } from "@/domaine/controles-script";
import { RECETTE_SCRIPT, ruptureDite } from "@/donnees/generateur/recette-script";
import { DEBIT_MOTS_PAR_SEC } from "@/domaine/image-video/complexite";
import { segmentDe, temoin, texteDe } from "../helpers/g3";
import { ADAPTATIONS_RESEAUX_PAR_DEFAUT, adaptationsActives, boucleVisuelle, CLE_ADAPTATIONS_RESEAUX, ordreScript, vitesseVoix } from "@/reseaux/adaptations";
import { demandeConfirmationVoyant, voyantDeVersion } from "@/domaine/voyant-rouge";
import { DEBIT_CIBLE_MOTS_PAR_SEC } from "@/domaine/debit-voix";
import { CARACTERES_PAR_SECONDE_TABLEAU, DEBIT_TABLEAU_MOTS_PAR_SEC, caracteresDits, dureeDiteSec } from "@/domaine/duree-tableau";
import { MOTS_SCRIPT } from "@/domaine/scripts-tableau-controles";

const RACINE = join(__dirname, "..", "..");
const lire = (p: string) => readFileSync(join(RACINE, p), "utf8");
const FORMATS = RECETTES_QUALITE_REF;
const RESEAUX = ["linkedin", "instagram", "facebook", "tiktok", "youtube-shorts"] as const;

describe("recette commune en 8 éléments (hook / douleur / question / promesse / une idée / preuve / rupture « on s'en occupe » / appel)", () => {
  it("la consigne des écrivains porte l'esprit de la rupture : la fin dit ce que nous mettons en place", () => {
    expect(REGLES_WILL).toMatch(/ce que nous mettons en place/);
  });
  it("présence du texte : la recette commune (RECETTE_SCRIPT) compte 8 éléments dont le n° 7 « Rupture »", () => {
    expect(RECETTE_SCRIPT).toContain("8 éléments");
    expect(RECETTE_SCRIPT).toContain("7. Rupture");
  });
  it("`ruptureDite` reconnaît « on s'en occupe pour vous » et refuse « c'est coûteux pour vous »", () => {
    expect(ruptureDite("On s'en occupe pour vous.")).toBe(true);
    expect(ruptureDite("C'est coûteux pour vous.")).toBe(false);
  });
  it("présence du texte : le socle vérifie 8 fonctions minimales (accroche, tension, valeur, preuve, promesse, gain tôt, relance, demande)", () => {
    const rapport = lire("src/domaine/qualite-script/rapport.ts");
    for (const id of ["accroche", "tension", "valeur", "preuve", "promesse", "gain-tot", "relance", "demande"]) expect(rapport).toContain(`id: "${id}"`);
  });
  it("la banque d'accroches ne contient plus ni annonce d'outil ni « faites-le vous-même »", () => {
    for (const g of GABARITS_ACCROCHE) {
      expect(NOUVEAUTE_OUTIL.test(g.gabarit.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().replace(/[’ʼ`]/g, "'")), g.gabarit).toBe(false);
      expect(faitLeVousMeme(g.gabarit), g.gabarit).toBeUndefined();
    }
  });
  it("présence du texte : la chaîne courte importe la recette commune (RECETTE_SCRIPT)", () => {
    expect(lire("src/generateur/chaine-courte.ts")).toMatch(/from "@\/donnees\/generateur\/recette-script"/);
    expect(lire("src/generateur/chaine-courte.ts")).toContain("RECETTE_SCRIPT");
  });
  // La face caméra lit bien la recette commune, via la chaîne courte (`tests/generateur/facecam-animee-recette.test.ts`).
  it("le tableau lit une partie de la recette commune : RECETTE_SCRIPT importée, éléments 3 à 7 (RECETTE_SANS_DEBIT) dans sa consigne", () => {
    const src = lire("src/services/tableau-scripts/consignes.ts");
    expect(src).toMatch(/import \{[^}]*\bRECETTE_SCRIPT\b[^}]*\} from "@\/donnees\/generateur\/recette-script"/);
    expect(src).toMatch(/const RECETTE_SANS_DEBIT = .*RECETTE_SCRIPT/);
    expect(src).toContain("[3-7]");
    expect(src).toContain("${RECETTE_SANS_DEBIT}");
    // Les éléments 3 à 7 existent bien dans la recette commune.
    for (const n of [3, 4, 5, 6, 7]) expect(RECETTE_SCRIPT).toMatch(new RegExp(`^${n}\\. `, "m"));
  });
  it.todo("cas concret et équipe : la recette commune n'y est pas branchée (cas concret garde ses règles R01+) ; image → vidéo : gelé");
});

describe("positionnement partout : jamais « faites-le vous-même » en conclusion", () => {
  it("présence du texte : la consigne des écrivains l'interdit en toutes lettres", () => {
    expect(REGLES_WILL).toMatch(/JAMAIS conclure par « faites-le vous-même »/);
  });
  it("présence du texte : les deux chaînes d'écriture (équipe et courte) citent la même consigne REGLES_WILL", () => {
    expect(lire("src/generateur/chaine-courte.ts")).toContain("REGLES_WILL");
    expect(lire("src/generateur/roles/equipe-commun.ts")).toMatch(/REGLES_WILL/);
  });
  it("le détecteur repère la dérobade et laisse passer « on s'en occupe »", () => {
    expect(faitLeVousMeme("Lancez-vous, testez-le vous-même ce soir.")).toBeDefined();
    expect(faitLeVousMeme("Vous n'avez plus à le faire vous-même, on s'en occupe.")).toBeUndefined();
  });
  for (const recette of FORMATS) {
    it(`${recette.id} : PO-01 passe sur la conclusion « on s'en occupe », s'écarte sur « faites-le vous-même »`, () => {
      const ok = evaluer(BON, { ...RECETTE_ESSAI, ...recette } as typeof RECETTE_ESSAI);
      expect(code(ok, "PO-01").statut).toBe("ok");
      const ko = evaluer(variante(10, ["appel", "Faites-le vous-même dès ce soir."]), { ...RECETTE_ESSAI, ...recette } as typeof RECETTE_ESSAI);
      expect(code(ko, "PO-01").statut).toBe("ecart");
      expect(code(ko, "PO-01").niveauVise).toBe("bloquant");
    });
  }
});

describe("débit : chaque format déclare le sien (image → vidéo = constante recalibrée, tableau en caractères/s)", () => {
  it("l'image → vidéo déclare le débit de référence DEBIT_MOTS_PAR_SEC", () => {
    const r = FORMATS.find((f) => f.id === "image-video")!;
    expect(r.debit).toEqual({ unite: "mots", parSeconde: DEBIT_MOTS_PAR_SEC });
  });
  it("chaque recette déclare un débit lisible (mots 2,5-4,6 /s ou caractères pour le tableau)", () => {
    for (const r of FORMATS) {
      if (r.debit.unite === "mots") {
        expect(r.debit.parSeconde, r.id).toBeGreaterThanOrEqual(2.5);
        expect(r.debit.parSeconde, r.id).toBeLessThanOrEqual(4.6);
      } else {
        // Vrai contrôle : la durée calculée avec le débit de la recette tableau est celle de `dureeDiteSec` (échoue si le débit de la recette change).
        const phrase = "Votre devis part tout seul, depuis la fiche du client, dès le premier appel.";
        expect(r.debit.parSeconde, r.id).toBe(CARACTERES_PAR_SECONDE_TABLEAU);
        expect(Math.round((caracteresDits(phrase) / r.debit.parSeconde) * 10) / 10, r.id).toBe(dureeDiteSec(phrase));
      }
    }
  });
  it("la face caméra utilise le débit du téléprompteur (2,9), pas celui du double", () => {
    const f = FORMATS.find((x) => x.id === "ecrire-facecam")!;
    const a = FORMATS.find((x) => x.id === "ecrire-avocat")!;
    expect(f.debit.parSeconde).toBe(2.9);
    expect(f.debit.parSeconde).not.toBe(a.debit.parSeconde);
  });
});

describe("redite et densité", () => {
  it("une phrase redite à l'identique est trouvée ; un texte sans redite n'en a aucune", () => {
    const redite = trouverRepetitions(["Le devis part tout seul depuis la fiche.", "La relance part le lendemain.", "Le devis part tout seul depuis la fiche."]);
    expect(redite.some((r) => r.genre === "identique")).toBe(true);
    expect(trouverRepetitions(BON.map(([, t]) => t))).toEqual([]);
  });
  it("la phrase longue est la règle RT-01 (alerte 14 mots, refus 22)", () => {
    const longue = "Votre assistante recopie chaque semaine toutes les lignes de tous les devis à la main puis les renvoie à chaque client par courriel sans jamais rien oublier du tout.";
    const r = evaluer(variante(1, ["douleur", longue]));
    expect(code(r, "RT-01").statut).toBe("ecart");
  });
});

describe("script collé par Will pris à l'identique (origine « will »)", () => {
  it("une phrase de Will (`ecritPar: \"will\"`) est lue au barème « will » par le contrôleur du générateur", () => {
    const e = temoin((x) => {
      texteDe(x, "a1", "Bonjour, un temps plein pour des Excel.");
      segmentDe(x, "a1").ecritPar = "will";
    });
    const r = controlerSelonAuteurs(e);
    expect(r.violations.find((v) => v.controle === "C3 bis")?.niveau).toBe("info");
    expect(r.violations.filter((v) => v.segmentIndex === 0 && v.bloquant)).toEqual([]);
  });
  it("le barème « will » n'est jamais plus sévère que « machine »", () => {
    const rang = { info: 0, correction: 0, alerte: 1, bloquant: 2 } as const;
    for (const [id, ligne] of Object.entries(NIVEAUX)) {
      if (ligne.will === null) continue;
      expect(ligne.machine, id).not.toBeNull();
      expect(rang[ligne.will], id).toBeLessThanOrEqual(rang[ligne.machine!]);
    }
  });
});

describe("voyant rouge", () => {
  it("rouge dès qu'une règle bloquante est en écart (conclusion « faites-le vous-même »)", () => {
    const r = evaluer(variante(10, ["appel", "Faites-le vous-même dès ce soir."]));
    expect(voyantDe(r.resultats)).toBe("rouge");
  });
  it("vert sur le bon script de référence", () => {
    expect(voyantDe(evaluer(BON).resultats)).toBe("vert");
  });
});

describe("adaptation au réseau", () => {
  it("chaque réseau a ses règles d'écriture, chacune citant une règle datée", () => {
    for (const r of RESEAUX) {
      expect(ECRITURE_RESEAUX[r].reseau).toBe(r);
      expect(ECRITURE_RESEAUX[r].boucle.regleId).toBeTruthy();
      expect(ECRITURE_RESEAUX[r].premiereLigne.regleId).toBeTruthy();
    }
    expect(regleIdsEcriture().length).toBeGreaterThan(0);
  });
  it("YouTube Shorts écarte « commentez MOT » et le message privé ; LinkedIn écarte l'abonnement", () => {
    expect(APPELS_PAR_RESEAU["youtube-shorts"].permis).not.toContain("commentez-mot");
    expect(APPELS_PAR_RESEAU["youtube-shorts"].permis).not.toContain("message-prive");
    expect(APPELS_PAR_RESEAU.linkedin.permis).not.toContain("abonnement");
  });
  it("une vidéo qui dit « abonnez-vous » sur LinkedIn est signalée (PR-03)", () => {
    const r = evaluer(variante(10, ["appel", "Abonnez-vous à la page."]), { ...RECETTE_ESSAI, reseaux: ["linkedin"] });
    expect(code(r, "PR-03").statut).toBe("ecart");
  });
  it("présence du texte : la chaîne courte exporte une version par réseau avec l'appel imposé par réseau", () => {
    const c = lire("src/generateur/chaine-courte.ts");
    expect(c).toMatch(/export function appelImposeCourt/);
    expect(c).toMatch(/export function reseauxDe/);
  });
});

describe("interdits « Villeexemple » et « Aucun gain garanti »", () => {
  it("refusés par les 4 écrivains (écrire, tableau, cas concret, image → vidéo)", () => {
    const communs = interditsCommuns().map((i) => i.cle);
    expect(communs).toContain("villeexemple");
    expect(communs).toContain("aucun gain garanti");
    for (const ecrivain of ["ecrire", "tableau", "cas-concret", "image-video"] as const) {
      expect(interditsDans("Nous travaillons à Villeexemple.", ecrivain).map((i) => i.cle), ecrivain).toContain("villeexemple");
      expect(interditsDans("Aucun gain garanti.", ecrivain).map((i) => i.cle), ecrivain).toContain("aucun gain garanti");
    }
    expect(LISTE_INTERDITS.length).toBeGreaterThan(2);
  });
  it("la consigne des écrivains et la base des interdits les citent", () => {
    expect(REGLES_WILL).toMatch(/aucun gain garanti/);
    const base = lire("src/donnees/bases-usine/donnees/8-voix-et-interdits.json");
    expect(base).toContain("interdit.ville");
    expect(base).toContain("interdit.gain-garanti");
  });
  it("aucune donnée d'écriture (modèles, tournures, accroches, tics) n'EMPLOIE ces expressions", () => {
    const fichiers = ["modeles-will.ts", "modeles-avocatref.ts", "tournures-calibrees.ts"].map((f) => `src/donnees/generateur/${f}`);
    for (const f of fichiers) {
      const t = lire(f);
      expect(t, f).not.toMatch(/villeexemple/i);
      expect(t, f).not.toMatch(/aucun gain garanti/i);
    }
    expect([...TICS_IA_WILL, ...ANNONCES_OUTIL_WILL].join(" ")).not.toMatch(/villeexemple/i);
  });
});

describe("mémoire anti-copie", () => {
  it("présence du texte : cas concret, la mémoire des scripts déjà écrits est en place (domaine + service)", () => {
    expect(lire("src/domaine/cas-concret-variete.ts")).toMatch(/\bsequencesDe,[\s\S]*ecriture-commune\/ressemblance/);
    expect(lire("src/services/cas-concret-scripts.ts")).toMatch(/export async function scriptsDejaEcrits/);
  });
  // C2-C4 sont fusionnés (#537, #538, #540) : le branchement est lu dans le code, sans base ni réseau, et chaque réglage est nommé.
  it("présence du texte · C3 : la chaîne courte lit la mémoire centrale, réglage `ecriture.memoireCentrale`", () => {
    expect(lire("src/generateur/chaine-courte.ts")).toMatch(/from "@\/domaine\/ecriture-commune\/memoire-centrale"/);
    expect(lire("src/services/memoire-centrale.ts")).toContain('REGLAGE_MEMOIRE_CENTRALE = "ecriture.memoireCentrale"');
  });
  it("présence du texte · C2 : le tableau lit la mémoire commune, réglage `ecriture.memoireTableau`", () => {
    expect(lire("src/services/tableau-scripts/index.ts")).toMatch(/from "\.\/memoire"/);
    expect(lire("src/services/tableau-scripts/memoire.ts")).toContain('PARAM_MEMOIRE_TABLEAU = "ecriture.memoireTableau"');
  });
  it("présence du texte · C4 : le cas concret lit la mémoire commune, réglage `ecriture.memoireCasConcret`", () => {
    expect(lire("src/moteurs/montage-cas-concret/ecriture.ts")).toMatch(/from "\.\/memoire-commune"/);
    expect(lire("src/services/memoire-cas-concret.ts")).toContain('REGLAGE_MEMOIRE_CAS_CONCRET = "ecriture.memoireCasConcret"');
  });
  // Le « seul `true` exact allume » est prouvé en comportement par `tests/ecriture-commune/memoire-centrale-service.test.ts`,
  // `tests/tableau-scripts/memoire-commune.test.ts` et `tests/cas-concret/memoire-commune/service.test.ts` (la recherche de texte `=== true` ne prouvait rien).
});

describe("lot D · adaptations par réseau : code posé, réglage coupé (identité)", () => {
  it("le réglage est coupé par défaut ; seul `true` strict l'allume", () => {
    expect(CLE_ADAPTATIONS_RESEAUX).toBe("adaptations_reseaux.actif");
    expect(ADAPTATIONS_RESEAUX_PAR_DEFAUT).toBe(false);
    for (const v of [undefined, null, 0, 1, "true", "oui"]) expect(adaptationsActives(v), String(v)).toBe(false);
    expect(adaptationsActives(true)).toBe(true);
  });
  it("coupé : pas de boucle imposée (null), voix jamais accélérée, ordre du script inchangé", () => {
    for (const reseau of ["tiktok", "instagram", "linkedin", "facebook", "youtube-shorts"] as const) {
      expect(boucleVisuelle({ actif: false, origine: "machine", reseau, typeAppel: "commentaire" as never }), reseau).toBeNull();
      expect(vitesseVoix({ actif: true, origine: "machine", reseau }), reseau).toBe(1);
    }
    expect(ordreScript({ actif: true, origine: "machine", ordre: ["a", "b", "c"] })).toEqual(["a", "b", "c"]);
  });
  it("un script collé par Will est pris à l'identique, même réglage allumé", () => {
    expect(boucleVisuelle({ actif: true, origine: "will", reseau: "tiktok", typeAppel: "commentaire" as never })).toBeNull();
  });
});

describe("lot E · second oui avant la voix si le voyant est rouge", () => {
  it("le voyant : rouge sous 70 ou garde-fou échoué, ambre de 70 à 84, vert à 85 et plus", () => {
    expect(voyantDeVersion({ note: { globale: 62 } })).toBe("rouge");
    expect(voyantDeVersion({ note: { globale: 78 } })).toBe("ambre");
    expect(voyantDeVersion({ note: { globale: 92 } })).toBe("vert");
    expect(voyantDeVersion({ note: { globale: 95 }, controles: { violations: [{ controle: "C95", bloquant: true }] } })).toBe("rouge");
  });
  it("une version non notée (absente ou 0) n'est ni verte ni rouge par la note", () => {
    expect(voyantDeVersion({})).not.toBe("rouge");
    expect(voyantDeVersion({ note: { globale: 0 } })).not.toBe("rouge");
  });
  it("une version rouge de la machine demande UN second oui, dit en français simple et sans le mot « voyant »", () => {
    const d = demandeConfirmationVoyant([{ code: "A", note: { globale: 55 } }, { code: "B", note: { globale: 60 } }, { code: "C", note: { globale: 90 } }]);
    expect(d?.codes).toEqual(["A", "B"]);
    expect(d?.message).toContain("Elle est payante");
    expect(d?.message).not.toMatch(/voyant/i);
  });
  it("jamais de second oui pour un script collé par Will, ni quand rien n'est rouge", () => {
    expect(demandeConfirmationVoyant([{ code: "A", origine: "will", note: { globale: 10 } }])).toBeNull();
    expect(demandeConfirmationVoyant([{ code: "A", note: { globale: 90 } }])).toBeNull();
  });
});

describe("lot B2 · tableau", () => {
  it("le débit du tableau est le débit commun (2,75 mots/s) ; présence du texte : branché sur le module de débit", () => {
    expect(DEBIT_TABLEAU_MOTS_PAR_SEC).toBe(DEBIT_CIBLE_MOTS_PAR_SEC);
    expect(DEBIT_TABLEAU_MOTS_PAR_SEC).toBe(2.75);
    expect(lire("src/domaine/duree-tableau.ts")).toMatch(/from "\.\/debit-voix"/);
  });
  it("le budget de mots de 60 s et de 30 s est fixé (125 à 145 et 75 à 95)", () => {
    expect(MOTS_SCRIPT[60]).toEqual({ min: 125, max: 145 });
    expect(MOTS_SCRIPT[30]).toEqual({ min: 75, max: 95 });
  });
  it.todo("tableau : la voix réelle (appel payant à la fabrication) : non testable gratuitement");
});
