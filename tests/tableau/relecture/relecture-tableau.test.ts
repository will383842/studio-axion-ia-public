/**
 * RELIRE LE SCRIPT · TABLEAU ANIMÉ (brique 7 sur 8) : l'adaptateur PUR du tableau vers l'écran commun « Relire le
 * script ». Le texte dit en lignes (par passage du gabarit cadré quand il vient du générateur, sinon phrase par phrase),
 * les contrôles du tableau sur le texte relu (gabarit, étapes, bornes de mots, mots interdits), la fiche de scènes en
 * lignes (« la voix dit » et les lignes écrites), et le REPÈRE « script relu » de la fiche. Aucun réseau.
 */
import { describe, expect, it } from "vitest";
import { appliquerSaisie, empreinte, scriptReluDe } from "@/domaine/relecture-script";
import {
  correctionsDeLaRelecture,
  lignesDeDepart,
  lignesDeLaFiche,
  lignesDuScriptTableau,
  lignesDuTexteTableau,
  pastillesTexteTableau,
  repereFiche,
  scriptAvecLignes,
  texteDesLignes,
} from "@/domaine/relecture-tableau";
import { texteDitDe } from "@/domaine/scripts-tableau-controles";
import { partiesAccordees, partiesDuScript } from "@/domaine/scripts-tableau";
import { exempleV4 } from "../../tableau-scripts/exemples-v4";
import { copie, ficheErreurCorrigee } from "../regles/exemples";

const formation = () => exempleV4("01-formation");

describe("le texte dit en lignes", () => {
  it("script du générateur : une ligne par phrase dite, groupée par passage, ses mots à l'écran modifiables", () => {
    const { ecriture } = formation();
    const lignes = lignesDuScriptTableau(ecriture.script);
    expect(texteDesLignes(lignes)).toBe(texteDitDe(ecriture.script));
    expect(lignes[0]).toMatchObject({ id: "p0", groupe: "Accroche", ecrits: [{ texte: ecriture.script.accroche[0].ecran, modifiable: true }] });
    const groupes = [...new Set(lignes.map((l) => l.groupe))];
    expect(groupes).toEqual(["Accroche", "Douleur", "Solution", "Étape 1", "Étape 2", "Étape 3", "Exemple", "À retenir", "Appel"]);
  });

  it("les modifications reviennent dans le script, et ses parties redonnent le texte relu mot pour mot", () => {
    const { ecriture } = formation();
    const avant = lignesDuScriptTableau(ecriture.script);
    const apres = appliquerSaisie(avant, "p0", { dit: "Ce devis collé dans l'IA contient trois données de trop.", ecrit: { index: 0, texte: "TROIS *DONNÉES* DE TROP" } });
    const script = scriptAvecLignes(ecriture.script, apres);
    expect(script.accroche[0]).toEqual({ dit: "Ce devis collé dans l'IA contient trois données de trop.", ecran: "TROIS *DONNÉES* DE TROP" });
    expect(texteDitDe(script)).toBe(texteDesLignes(apres));
    expect(partiesAccordees(partiesDuScript(script), texteDesLignes(apres))).toBe(true);
  });

  it("texte écrit à la main : une ligne par phrase ; un texte qui ne suit plus le script généré redevient du texte", () => {
    const lignes = lignesDuTexteTableau("Première phrase. Deuxième phrase ? Troisième !");
    expect(lignes.map((l) => [l.id, l.dit])).toEqual([
      ["t0", "Première phrase."],
      ["t1", "Deuxième phrase ?"],
      ["t2", "Troisième !"],
    ]);
    const { ecriture } = formation();
    expect(lignesDeDepart(texteDitDe(ecriture.script), ecriture.script)[0].id).toBe("p0");
    expect(lignesDeDepart(`${texteDitDe(ecriture.script)} Une phrase ajoutée.`, ecriture.script)[0].id).toBe("t0");
    expect(lignesDeDepart("Un texte.", undefined)).toEqual([{ id: "t0", dit: "Un texte." }]);
  });
});

describe("contrôles en direct du texte relu", () => {
  it("le script validé du 15/10 passe : aucune pastille bloquante", () => {
    const { ecriture, demande } = formation();
    const lignes = lignesDuScriptTableau(ecriture.script);
    expect(pastillesTexteTableau(lignes, { ecriture, demande }).filter((p) => p.niveau === "bloquant")).toEqual([]);
  });

  it("un mot interdit bloque, sur SA phrase", () => {
    const { ecriture, demande } = formation();
    const avant = lignesDuScriptTableau(ecriture.script);
    const apres = appliquerSaisie(avant, "p1", { dit: "Contactez-nous dès demain." });
    const p = pastillesTexteTableau(apres, { ecriture, demande });
    expect(p.filter((x) => x.niveau === "bloquant").map((x) => [x.ligneId, x.code])).toEqual([
      ["p1", "mot-interdit"],
      ["p1", "mot-interdit"],
    ]);
  });

  it("gabarit cadré : une étape retirée et des mots en trop sont signalés (étapes, bornes de mots)", () => {
    const { ecriture, demande } = formation();
    const avant = lignesDuScriptTableau(ecriture.script);
    const longue = "Le nom, le portable, l'adresse, la plaque, le numéro de dossier, la date de naissance et le montant exact du devis partent tous dans la même phrase collée sans réfléchir.";
    const apres = appliquerSaisie(avant, avant.find((l) => l.groupe === "Douleur")!.id, { dit: longue });
    const codes = pastillesTexteTableau(apres, { ecriture, demande }).map((x) => x.code);
    expect(codes).toContain("passage-mots");
    // Les étapes : vidées, elles ne comptent plus (2 à 5 étapes).
    const sansEtapes = avant.map((l) => (l.groupe?.startsWith("Étape") && l.groupe !== "Étape 1" ? { ...l, dit: "" } : l));
    expect(pastillesTexteTableau(sansEtapes, { ecriture, demande }).map((x) => x.code)).toContain("nombre-etapes");
  });

  it("texte à la main (décision du 18/10) : mots interdits sans blocage ni avis ; seul le plafond de durée du tableau bloque", () => {
    const lignes = lignesDuTexteTableau("Voici un conseil simple. Nos formations sont les meilleures.");
    expect(pastillesTexteTableau(lignes)).toEqual([]);
    const trop = lignesDuTexteTableau("Une phrase assez longue pour le test de durée. ".repeat(40));
    expect(pastillesTexteTableau(trop).some((p) => p.niveau === "bloquant" && p.code === "duree-plafond" && !p.ligneId)).toBe(true);
  });
});

describe("la fiche de scènes en lignes et le repère « script relu »", () => {
  const fiche = () => copie(ficheErreurCorrigee);

  it("une ligne par scène : la voix dit, puis ses lignes écrites (modifiables), groupées par page", () => {
    const f = fiche();
    const lignes = lignesDeLaFiche(f);
    expect(lignes).toHaveLength(f.scenes.length);
    const s = f.scenes[0];
    const ecrites = s.elements.filter((e) => e.type === "ligne");
    expect(lignes[0]).toEqual({ id: s.id, dit: s.texteDit, groupe: `Page ${s.page}`, ecrits: ecrites.map((e) => ({ texte: (e as { texte: string }).texte, modifiable: true })) });
  });

  it("les modifications deviennent les corrections de la fiche (texte dit, lignes par identifiant)", () => {
    const f = fiche();
    const avant = lignesDeLaFiche(f);
    const s = f.scenes[1];
    const ligne = s.elements.find((e) => e.type === "ligne")!;
    const apres = appliquerSaisie(appliquerSaisie(avant, s.id, { dit: "Un texte dit corrigé." }), s.id, { ecrit: { index: 0, texte: "CORRIGÉ" } });
    expect(correctionsDeLaRelecture(f, apres)).toEqual([{ sceneId: s.id, texteDit: "Un texte dit corrigé.", lignes: { [ligne.id]: "CORRIGÉ" } }]);
    expect(correctionsDeLaRelecture(f, avant)).toEqual([]);
  });

  it("le repère est l'empreinte du texte relu : il tombe dès que la voix dit ou un écrit change", () => {
    const f = fiche();
    expect(repereFiche(f)).toBe(empreinte(lignesDeLaFiche(f)));
    expect(repereFiche(f)).toBe(scriptReluDe(lignesDeLaFiche(f), lignesDeLaFiche(f)).empreinte);
    const changee = fiche();
    changee.scenes[0] = { ...changee.scenes[0], texteDit: `${changee.scenes[0].texteDit} Encore.` };
    expect(repereFiche(changee)).not.toBe(repereFiche(f));
  });
});
