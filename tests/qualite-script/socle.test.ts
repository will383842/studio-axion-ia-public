/**
 * SOCLE QUALITÉ · seuils, liste unique des interdits, lecture et horloge, rapport, adaptateurs, bibliothèque
 * d'accroches. Aucun appel, aucun réseau.
 */
import { describe, expect, it } from "vitest";
import { evaluerQualite, interditsCommuns, LISTE_INTERDITS, pastillesQualite, SEUILS_COMMUNS, seuilsDe, voyantDe, type ResultatRegle } from "@/domaine/qualite-script";
import { depuisEcransCasConcret, textesAffiches } from "@/domaine/qualite-script/adaptateurs/cas-concret";
import { depuisLignesEcrire, depuisVersionEcrire, partieDuBloc } from "@/domaine/qualite-script/adaptateurs/ecrire";
import { depuisFicheImage } from "@/domaine/qualite-script/adaptateurs/image-video";
import { depuisLignesTableau, depuisScriptTableau } from "@/domaine/qualite-script/adaptateurs/tableau";
import { ECARTES_DE_LA_RECHERCHE, GABARITS_ACCROCHE } from "@/domaine/qualite-script/bibliotheque-accroches";
import { RECETTE_IMAGE_VIDEO, RECETTES_QUALITE, RECETTE_TABLEAU } from "@/domaine/qualite-script/recettes";
import { ACCROCHE_MOTS_MAX_IV, PHRASE_MOTS_MAX_IV } from "@/domaine/qualite-script/recettes/image-video";
import { INTERDITS_EN_PLUS_IMAGE_VIDEO, INTERDITS_TOUS_ECRIVAINS, interditsDans, interditsTousEcrivains } from "@/domaine/qualite-script/regles/interdits";
import { FAITES_LE_VOUS_MEME, NOUVEAUTE_OUTIL } from "@/domaine/qualite-script/regles/positionnement";
import { typeAppel } from "@/domaine/qualite-script/regles/prospects";
import { APPELS_PAR_RESEAU, classeDuree } from "@/domaine/qualite-script/seuils";
import { lire, motsUniteMax } from "@/domaine/qualite-script/script";
import { normaliser } from "@/domaine/controles-script/texte";
import { lignesDuScriptTableau, pastillesTexteTableau } from "@/domaine/relecture-tableau";
import { MOTS_INTERDITS_FORMAT } from "@/moteurs/montage-cas-concret/regles";
import { SCRIPT_V4_RECRUTEMENT } from "@/moteurs/montage-cas-concret/scripts-valides/recrutement-apporteurs";
import { ACCROCHE_IV_MOTS_MAX, INTERDITS_PERMANENTS as INTERDITS_IV, MOTS_PAR_PHRASE_MAX } from "@/moteurs/montage-image-video/regles";
import { FICHES_SIMULEES } from "@/moteurs/montage-image-video/ecriture.simulation";
import { exempleV4 } from "../tableau-scripts/exemples-v4";
import { BON, evaluer, RECETTE_ESSAI, script } from "./aide";

describe("seuils : une seule source, arbitrages de Will", () => {
  it("valeurs communes adoptées (audit § 2.3)", () => {
    expect(SEUILS_COMMUNS).toMatchObject({ premierePhraseMotsMax: 12, premierePhraseFinSec: 3, accrocheFinSecMax: 5, phraseAlerteMots: 14, phraseRefusMots: 22, changementEcranSec: 2.5, gainAvantPart: 0.4, relanceDebutPart: 0.5, relanceFinPart: 0.7 });
  });
  it("l'image → vidéo garde 12 mots et une accroche de 8 mots : les valeurs de son format", () => {
    expect(PHRASE_MOTS_MAX_IV).toBe(MOTS_PAR_PHRASE_MAX);
    expect(ACCROCHE_MOTS_MAX_IV).toBe(ACCROCHE_IV_MOTS_MAX);
    expect(seuilsDe(RECETTE_IMAGE_VIDEO)).toMatchObject({ phraseAlerteMots: 12, phraseRefusMots: 12, premierePhraseMotsMax: 8 });
  });
  it("un écart sans raison écrite n'est pas appliqué", () => {
    expect(seuilsDe({ ...RECETTE_ESSAI, ecarts: { phraseRefusMots: { valeur: 30, raison: " " } } }).phraseRefusMots).toBe(22);
    expect(seuilsDe({ ...RECETTE_ESSAI, ecarts: { phraseRefusMots: { valeur: 30, raison: "essai" } } }).phraseRefusMots).toBe(30);
  });
  it("un niveau visé changé par la recette exige une raison", () => {
    const sans = evaluer(BON, { ...RECETTE_ESSAI, niveaux: { "RT-01": { valeur: "info", raison: "" } } });
    const avec = evaluer(BON, { ...RECETTE_ESSAI, niveaux: { "RT-01": { valeur: "info", raison: "essai" } } });
    expect(sans.resultats.find((r) => r.code === "RT-01")?.niveauVise).toBe("bloquant");
    expect(avec.resultats.find((r) => r.code === "RT-01")?.niveauVise).toBe("info");
  });
  it("toutes les recettes déclarent leurs écarts avec une raison, et au moins une structure", () => {
    for (const r of RECETTES_QUALITE) {
      for (const e of Object.values(r.ecarts ?? {})) expect(e?.raison.trim().length, r.id).toBeGreaterThan(10);
      expect(r.structures.length, r.id).toBeGreaterThan(0);
    }
  });
  it("classe de durée : la durée visée prime, sinon la plus proche", () => {
    expect(classeDuree(31).id).toBe("court-30");
    expect(classeDuree(31, 60).id).toBe("court-60");
    expect(classeDuree(43).id).toBe("court-45");
  });
});

describe("appels par réseau (table de code)", () => {
  it("LinkedIn : question, message privé ET mot à commenter (décision de Will du 17/10)", () => {
    expect(APPELS_PAR_RESEAU.linkedin.permis).toEqual(expect.arrayContaining(["question", "message-prive", "commentez-mot"]));
    expect(APPELS_PAR_RESEAU.linkedin.ecartes["commentez-mot"]).toBeUndefined();
  });
  it("Instagram et Facebook : « Commentez PLAN » permis", () => {
    expect(APPELS_PAR_RESEAU.instagram.permis).toContain("commentez-mot");
    expect(APPELS_PAR_RESEAU.facebook.permis).toContain("commentez-mot");
  });
  it("reconnaît la forme de la demande", () => {
    expect(typeAppel("Écrivez PLAN en commentaire.")).toBe("commentez-mot");
    expect(typeAppel("Commentez PLAN.")).toBe("commentez-mot");
    expect(typeAppel("Écrivez-moi DIAGNOSTIC en message privé.")).toBe("message-prive");
    expect(typeAppel("Réservez un appel de diagnostic.")).toBe("diagnostic");
    expect(typeAppel("Le lien est en commentaire.")).toBe("lien");
    expect(typeAppel("Abonnez-vous pour la suite.")).toBe("abonnement");
    expect(typeAppel("Envoyez-la à votre associé.")).toBe("envoi");
    expect(typeAppel("Quelle tâche pourrait tourner toute seule ?")).toBe("question");
  });
});

describe("liste unique des interdits permanents, lue depuis l'existant", () => {
  it("une seule entrée par expression, avec toutes ses sources", () => {
    const cles = LISTE_INTERDITS.map((i) => i.cle);
    expect(new Set(cles).size).toBe(cles.length);
    const villeexemple = LISTE_INTERDITS.find((i) => i.cle === "villeexemple");
    expect(villeexemple?.portee.sort()).toEqual(["cas-concret", "ecrire", "image-video", "tableau"]);
    expect(villeexemple?.sources).toEqual(["Écrire C42", "Cas concret R10", "Image → vidéo Q08", "Tableau"]);
  });
  it("les interdits communs aux quatre écrivains : « Villeexemple », « aucun gain garanti » et la certification Certifexemple", () => {
    expect(interditsCommuns().map((i) => i.cle).sort()).toEqual(["aucun gain garanti", "villeexemple", ...LISTE_INTERDITS.filter((i) => i.sources.includes("Règles de Will")).map((i) => i.cle)].sort());
    expect(LISTE_INTERDITS.filter((i) => i.sources.includes("Règles de Will"))).toHaveLength(INTERDITS_TOUS_ECRIVAINS.length);
  });
  it("certification Certifexemple refusée pour TOUS les écrivains, dans les deux ordres, accents et casse ignorés", () => {
    const refuses = ["Nous sommes certifiés Certifexemple.", "Un organisme Certifexemple certifié.", "CERTIFIEE CERTIFEXEMPLE depuis 2024", "certifexemple certifiées", "Certification Certifexemple obtenue en mars.", "Nous avons obtenu la certification Certifexemple.", "Organisme certifié par Certifexemple.", "Formateur certifié(e) Certifexemple.", "Centre labellisé Certifexemple."];
    for (const t of refuses) {
      expect(interditsTousEcrivains(t), t).toHaveLength(1);
      for (const e of ["ecrire", "tableau", "cas-concret", "image-video"] as const) expect(interditsDans(t, e).some((i) => INTERDITS_TOUS_ECRIVAINS.some((x) => x.libelle === i.libelle)), `${e} : ${t}`).toBe(true);
    }
    // Le mot « Certifexemple » seul n'est refusé que là où il l'était (image → vidéo), rien de plus.
    const seul = "La formation Certifexemple finance une partie du coût.";
    expect(interditsTousEcrivains(seul)).toEqual([]);
    for (const e of ["ecrire", "tableau", "cas-concret"] as const) expect(interditsDans(seul, e), e).toEqual([]);
    expect(interditsDans(seul, "image-video").map((i) => i.libelle)).toEqual(["« Certifexemple »"]);
  });
  it("la liste de l'image → vidéo est exactement celle de son format (Q08)", () => {
    expect([...MOTS_INTERDITS_FORMAT, ...INTERDITS_EN_PLUS_IMAGE_VIDEO]).toEqual([...INTERDITS_IV]);
    const tous = new Set(LISTE_INTERDITS.filter((i) => i.sources.includes("Règles de Will")).map((i) => i.cle));
    const iv = LISTE_INTERDITS.filter((i) => i.portee.includes("image-video") && !tous.has(i.cle)).map((i) => i.cle);
    expect(iv.sort()).toEqual(INTERDITS_IV.map((m) => normaliser(m)).sort());
  });
  it("même verdict que chaque écrivain : le test du tableau trouve ce que le tableau refuse", () => {
    const t = "Nos clients à Villeexemple paient en euros.";
    const parLeSocle = evaluer([["accroche", t]], { ...RECETTE_ESSAI, interdits: "tableau" }).resultats.filter((r) => r.code === "LG-01" && r.statut === "ecart").map((r) => r.message.replace("Interdit permanent : ", "").replace(/\.$/, ""));
    expect(parLeSocle.sort()).toEqual(["« Villeexemple »", "« nos clients »", "un prix"].sort());
  });
  it("mode observation : le socle passé sur le témoin ne change aucune pastille de l'écrivain, n'altère pas ses entrées et reste en « info » (toutes les sources : exactitude.test.ts)", () => {
    const ex = exempleV4("01-formation");
    const lignes = lignesDuScriptTableau(ex.ecriture.script);
    const contexte = { ecriture: ex.ecriture, demande: ex.demande };
    const avant = JSON.stringify(pastillesTexteTableau(lignes, contexte));
    const entrees = JSON.stringify(lignes);
    const rapport = evaluerQualite(depuisLignesTableau(lignes, { dureeViseeSec: ex.demande.duree }), RECETTE_TABLEAU);
    expect(rapport.pastilles.length).toBeGreaterThan(0); // le socle a bien tourné
    expect(JSON.stringify(lignes)).toBe(entrees);
    expect(JSON.stringify(pastillesTexteTableau(lignes, contexte))).toBe(avant);
    expect(rapport.pastilles.every((p) => p.niveau === "info" && p.code?.startsWith("socle-"))).toBe(true);
  });
});

describe("lecture et horloge", () => {
  it("débit en mots : 3 mots/s → 1/3 s par mot ; en caractères : le mot et son espace", () => {
    const l = lire(script([["accroche", "Un deux trois."]]), { unite: "mots", parSeconde: 3 });
    expect(l.dureeSec).toBeCloseTo(1, 5);
    const c = lire(script([["accroche", "abcd efgh"]]), { unite: "caracteres", parSeconde: 10 });
    expect(c.dureeSec).toBeCloseTo(1, 5);
  });
  it("les phrases se lisent sur le texte entier (un écran peut couper une phrase)", () => {
    const l = lire(script([["accroche", "On recrute en"], ["preuve", "quinze minutes. Oui."]]), { unite: "mots", parSeconde: 3 });
    expect(l.phrases.map((p) => p.texte)).toEqual(["On recrute en quinze minutes.", "Oui."]);
  });
  it("l'horodatage réel prime sur l'estimation", () => {
    const l = lire(script([["accroche", "Un deux.", { debutSec: 0, finSec: 4 }], ["corps", "Trois."]]), { unite: "mots", parSeconde: 3 });
    expect(l.debutLigne[1]).toBe(4);
  });
  it("la ponctuation isolée ne compte pas comme un mot", () => {
    const l = lire(script([["question", "Quelle tâche pourrait tourner toute seule ?"]]), { unite: "mots", parSeconde: 3 });
    expect(l.mots).toHaveLength(6);
    expect(l.phrases[0].texte.endsWith("?")).toBe(true);
  });
  it("unités de lecture : coupure aux deux-points, énumération lue comme une liste", () => {
    expect(motsUniteMax("Avant, c'était ça : trier les candidatures, répondre à chacun, relancer, caler un rendez-vous, envoyer le contrat.")).toBe(3);
    expect(motsUniteMax("Une phrase simple sans liste qui dure longtemps.")).toBe(8);
  });
});

describe("rapport", () => {
  const r = (statut: ResultatRegle["statut"], niveauVise: ResultatRegle["niveauVise"], theme: ResultatRegle["theme"] = "accroche"): ResultatRegle => ({ code: "X", theme, message: "m", statut, niveauVise });
  it("voyant : rouge si une règle qui serait bloquante est en écart ; ambre si un thème < 7/10 ; vert sinon", () => {
    expect(voyantDe([r("ecart", "bloquant")])).toBe("rouge");
    expect(voyantDe([r("ecart", "alerte"), r("ok", "alerte")])).toBe("ambre");
    expect(voyantDe([r("ok", "alerte"), r("a-trancher", "bloquant"), r("non-mesure", "bloquant")])).toBe("vert");
  });
  it("pastilles : toutes « info », le résumé des notes d'abord, la version prudente d'un absolu", () => {
    const p = pastillesQualite([{ ...r("a-trancher", "bloquant", "interdits"), code: "LG-03", message: "Formule absolue « toujours ».", versionPrudente: "presque toujours", ligneId: "l1" }, r("ecart", "bloquant")]);
    expect(p.every((x) => x.niveau === "info")).toBe(true);
    expect(p[0].texte).toMatch(/^Socle qualité \(observation\) : Accroche 0\/10 · Interdits 10\/10\.$/);
    expect(p[1]).toMatchObject({ code: "socle-LG-03", ligneId: "l1", texte: expect.stringContaining("presque toujours") });
  });
  it("même un script plein de défauts ne produit aucune pastille bloquante", () => {
    const pire = evaluerQualite(script([["accroche", "Bonjour à tous, aujourd'hui je vais vous parler longuement d'un nouvel outil qui vient de sortir à Villeexemple, garanti."], ["appel", "Faites-le vous-même."]]), RECETTE_ESSAI);
    expect(pire.voyant).toBe("rouge");
    expect(pire.pastilles.every((x) => x.niveau === "info")).toBe(true);
  });
});

describe("adaptateurs", () => {
  it("Écrire : les blocs d'une version (partie depuis `blocRecette`), l'encadré sur la 1re ligne", () => {
    const s = depuisVersionEcrire({
      ouverture: [{ id: "b1", blocRecette: "accroche", segments: [{ id: "s1", texte: "Ce devis vous coûte trois heures." }] }],
      corps: [{ id: "b2", blocRecette: "preuve", segments: [{ id: "s2", texte: "Un artisan gagne trois heures.", preuveIds: ["p1"] }] }],
      fin: [{ id: "b3", blocRecette: "appel", segments: [{ id: "s3", texte: "Écrivez DEVIS en commentaire." }, { id: "s4", texte: " " }] }],
      encadre: "Trois heures",
      reseau: "linkedin",
    });
    expect(s.lignes.map((l) => [l.id, l.partie])).toEqual([["s1", "accroche"], ["s2", "preuve"], ["s3", "appel"]]);
    expect(s.lignes[0].ecrits?.[0].texte).toBe("Trois heures");
    expect(s.lignes[1].sourcee).toBe(true);
    expect(s.reseau).toBe("linkedin");
    expect(partieDuBloc("explication", "corps")).toBe("corps");
    expect(partieDuBloc("boucle", "fin")).toBe("fin");
  });
  it("Écrire : les lignes du lot relu (Début, Milieu, Fin)", () => {
    const s = depuisLignesEcrire([{ id: "a", dit: "x.", groupe: "Début" }, { id: "b", dit: "y.", groupe: "Milieu commun" }, { id: "c", dit: "z.", groupe: "Fin" }]);
    expect(s.lignes.map((l) => l.partie)).toEqual(["accroche", "corps", "appel"]);
  });
  it("tableau : les passages du gabarit cadré donnent les parties ; un texte libre prend les parties par défaut", () => {
    const s = depuisScriptTableau(exempleV4("01-formation").ecriture.script);
    expect([...new Set(s.lignes.map((l) => l.partie))]).toEqual(["accroche", "douleur", "promesse", "corps", "exemple", "a-retenir", "appel"]);
    const libre = depuisLignesTableau([{ id: "t0", dit: "Un." }, { id: "t1", dit: "Deux." }, { id: "t2", dit: "Trois." }]);
    expect(libre.lignes.map((l) => l.partie)).toEqual(["accroche", "corps", "appel"]);
  });
  it("cas concret : une ligne par écran, ses textes, ses événements, ses chiffres tirés d'un fait", () => {
    const s = depuisEcransCasConcret(SCRIPT_V4_RECRUTEMENT.ecrans);
    expect(s.lignes).toHaveLength(SCRIPT_V4_RECRUTEMENT.ecrans.length);
    expect(s.lignes[0]).toMatchObject({ id: "e01", partie: "accroche", changements: [2, 5] });
    expect(s.lignes[1]).toMatchObject({ partie: "preuve", sourcee: true });
    expect(s.lignes.at(-1)?.partie).toBe("question");
    expect(textesAffiches(SCRIPT_V4_RECRUTEMENT.ecrans[1])).toEqual(["15 minutes", "0 CV à trier", "0 relance", "0 papier"]);
  });
  it("image → vidéo : une ligne par écran, puis la question (sauf sur LinkedIn)", () => {
    const fiche = Object.values(FICHES_SIMULEES)[0];
    const s = depuisFicheImage(fiche, { reseau: "instagram" });
    expect(s.lignes).toHaveLength(fiche.ecrans.length + 1);
    expect(s.lignes.at(-1)?.partie).toBe("question");
    expect(depuisFicheImage(fiche, { reseau: "linkedin" }).lignes).toHaveLength(fiche.ecrans.length);
    // Les fiches simulées (non validées par Will) s'évaluent sans erreur ; leurs écarts servent à la comparaison.
    for (const f of Object.values(FICHES_SIMULEES)) expect(evaluerQualite(depuisFicheImage(f), RECETTE_IMAGE_VIDEO).pastilles[0].code).toBe("socle-notes");
  });
  it("le tableau s'évalue aussi depuis les lignes de « Relire le script »", () => {
    const ex = exempleV4("01-formation");
    const r = evaluerQualite(depuisLignesTableau(lignesDuScriptTableau(ex.ecriture.script), { dureeViseeSec: 60 }), RECETTE_TABLEAU);
    expect(r.voyant).toBe("vert");
  });
});

describe("bibliothèque d'accroches passée au crible du positionnement", () => {
  it("les gabarits 11, 16 et 19 sont retirés ; 17 restent", () => {
    expect(GABARITS_ACCROCHE.some((g) => [11, 16, 19].includes(g.numero))).toBe(false);
    expect(GABARITS_ACCROCHE).toHaveLength(17);
  });
  it("aucun gabarit gardé ne tombe sous « nouveauté d'outil » ni « faites-le vous-même »", () => {
    for (const g of GABARITS_ACCROCHE) {
      expect(NOUVEAUTE_OUTIL.test(normaliser(g.gabarit)), g.gabarit).toBe(false);
      expect(FAITES_LE_VOUS_MEME.test(normaliser(g.gabarit)), g.gabarit).toBe(false);
    }
  });
  it("les gabarits retirés sont bien repérés par les règles de Will ; N13 est réécrite", () => {
    const [onze, seize, dixNeuf, n13] = ECARTES_DE_LA_RECHERCHE;
    expect(NOUVEAUTE_OUTIL.test(normaliser(onze.texte))).toBe(true);
    expect(NOUVEAUTE_OUTIL.test(normaliser(seize.texte))).toBe(true);
    expect(FAITES_LE_VOUS_MEME.test(normaliser(dixNeuf.texte))).toBe(true);
    expect(n13.remplacement).toContain("voici ce qu'on met en place");
  });
});
