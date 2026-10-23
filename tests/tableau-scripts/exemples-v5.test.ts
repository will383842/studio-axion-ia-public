/**
 * LE TÉMOIN V5 (lot B1, décision D1 de Will du 18/10) : il passe TOUS les contrôles en code du générateur, tels qu'un vrai
 * passage les ferait (écriture avec la question sur l'IA, puis version retenue), sans aucune remarque ; sa grille est à
 * 10 sur 10 ; son document dans `exemples-v5/` le reprend mot pour mot. Aucun numéro dit, aucun impératif.
 */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { CRITERES_GRILLE, eliminatoiresEchoues, noteDeGrille, partiesAccordees, partiesDuScript, phrasesDites, schemaEcriture, schemaRelecture } from "@/domaine/scripts-tableau";
import { compterMots, controlerEcriture, texteDitDe, versionRetenue } from "@/domaine/scripts-tableau-controles";
import { caracteresDits, dureeDiteSec } from "@/domaine/duree-tableau";
import { EXEMPLES_V5 } from "./exemples-v5";
import { QUESTIONS_IA } from "@/domaine/scripts-tableau";

// Fins de ligne Windows (`core.autocrlf`) : les « \r » sont retirés avant de comparer.
const doc = (f: string) => readFileSync(new URL(`../../docs/formats/tableau-anime-scripts/${f}`, import.meta.url), "utf8").replace(/\r/g, "");

const OPT = { questionIa: QUESTIONS_IA[0] };
for (const e of EXEMPLES_V5) {
  describe(e.titre, () => {
    it("respecte le schéma de l'écriture et celui de la relecture", () => {
      expect(schemaEcriture.safeParse(e.ecriture).success).toBe(true);
      expect(schemaRelecture.safeParse({ corrections: [], grille: e.grille, faiblesses: [], affirmations: [], manques: e.manques }).success).toBe(true);
    });
    it("passe TOUS les contrôles en code, sans aucune remarque, même avec un historique de métiers", () => {
      expect(controlerEcriture(e.ecriture, e.demande, OPT)).toEqual([]);
      expect(controlerEcriture(e.ecriture, e.demande, { ...OPT, metiersRecents: ["plombier", "agent immobilier", "comptable"] })).toEqual([]);
      expect(versionRetenue([{ passe: "relecture", ecriture: e.ecriture }], e.demande, OPT)).toMatchObject({ valide: true });
    });
    it("125 à 145 mots hors question sur l'IA (60 s, lot B2b : 144 ici), 150 question comprise, une cinquantaine de secondes au débit commun", () => {
      const t = texteDitDe(e.ecriture.script);
      expect(compterMots(t)).toBe(150);
      expect(compterMots(t) - compterMots(QUESTIONS_IA[0])).toBeGreaterThanOrEqual(125);
      expect(compterMots(t) - compterMots(QUESTIONS_IA[0])).toBeLessThanOrEqual(145);
      expect(dureeDiteSec(t)).toBeGreaterThan(45);
      expect(dureeDiteSec(t)).toBeLessThan(60);
    });
    it("aucun numéro dit, aucun impératif adressé au spectateur, une question dans la douleur, aucun nombre d'étapes annoncé", () => {
      const s = e.ecriture.script;
      for (const x of s.etapes) expect(x.action.dit).not.toMatch(/^(Un|Deux|Trois|Quatre|Cinq)\./);
      expect(s.douleur.at(-1)!.dit.endsWith("?")).toBe(true);
      expect(s.promesse.map((x) => x.dit).join(" ")).not.toMatch(/étapes|réflexes|gestes/);
    });
    it("pas de pronom sans personne nommée, pas de phrase sans verbe conjugué, un écran en mots-clés cohérent avec la voix", () => {
      const dit = phrasesDites(e.ecriture.script).map((p) => p.dit).join(" ");
      expect(dit).toContain("Avant, l'assistante cherchait partout, puis appelait le collègue absent. Maintenant, elle lit trois lignes et prépare la suite.");
      expect(dit).not.toMatch(/Avant, il |Maintenant, il /);
      expect(dit).toContain("On ne fouille plus l'historique de ses mails.");
      expect(dit).not.toContain("Plus besoin");
      const ecrans = phrasesDites(e.ecriture.script).map((p) => p.ecran);
      expect(ecrans).not.toContain("La fiche garde l'historique");
      expect(ecrans).not.toContain("Avant : il cherche partout");
    });
    it("note 10 sur 10, aucun critère éliminatoire échoué, rien ne manque", () => {
      expect(e.grille.map((l) => l.critere)).toEqual(CRITERES_GRILLE.map((c) => c.id));
      expect(noteDeGrille(e.grille)).toBe(10);
      expect(eliminatoiresEchoues(e.grille)).toEqual([]);
      expect(e.manques).toEqual([]);
    });
    it("donne au découpage ses parties nommées, qui redonnent exactement le texte dit", () => {
      const parties = partiesDuScript(e.ecriture.script);
      expect(parties.map((x) => x.partie)).toEqual(["accroche", "douleur", "solution", "etape", "etape", "etape", "exemple", "a-retenir", "appel"]);
      expect(partiesAccordees(parties, texteDitDe(e.ecriture.script))).toBe(true);
    });
    // Version publique : le document d'exemple est un texte court inventé, non comparable au script du code.
    it.skip("son document reprend mot pour mot chaque phrase dite, ses mots à l'écran, ses affirmations et sa durée", () => {
      const md = doc(`exemples-v5/${e.fichier}.md`);
      for (const p of phrasesDites(e.ecriture.script)) {
        expect(md, p.dit).toContain(p.dit);
        if (p.ecran) expect(md, p.ecran).toContain(p.ecran);
      }
      const t = texteDitDe(e.ecriture.script);
      expect(md).toContain(`> ${t}`);
      for (const a of e.ecriture.affirmations) expect(md, a.extrait).toContain(a.extrait);
      expect(md).toContain(`| Durée estimée | ${String(dureeDiteSec(t)).replace(".", ",")} s (${caracteresDits(t)} caractères dits`);
      expect(md).toContain(`- **Idée** : ${e.ecriture.idee}`);
      expect(md).toContain("## La grille (note 10 sur 10)");
      expect(md).toContain(`- **Gain** : ${e.ecriture.gain.formule} (unité : ${e.ecriture.gain.unite})`);
    });
  });
}
