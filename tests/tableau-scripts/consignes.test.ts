/**
 * Consignes du générateur de scripts du tableau animé : fidèles aux documents de règles, trois requêtes distinctes,
 * Opus seulement, sortie structurée acceptable par l'API.
 */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { CRITERES_GRILLE, PARTIES_SCRIPT, QUESTIONS_IA, phrasesDites, schemaAngle, schemaEcriture, schemaRelecture } from "@/domaine/scripts-tableau";
import { ACCROCHE_MAX_SEC, AFFIRMATIONS_ABSOLUES, BORNES_PASSAGES, REPERE_CONSTAT, compterMots, FORMULES_CREUSES, NOM_ENTREPRISE, normaliser } from "@/domaine/scripts-tableau-controles";
import {
  CONSIGNE_RELECTURE,
  CONTRE_EXEMPLES,
  MAX_TOKENS,
  REGLES_TABLEAU,
  SCRIPT_TEMOIN,
  requeteAngle,
  requeteEcriture,
  requeteRelecture,
  schemaPourClaude,
  verifierModele,
} from "@/services/tableau-scripts/consignes";
import { DEMANDE_MODELE, ecritureModele } from "./modele-valide";
import { exempleV5 } from "./exemples-v5";

const doc = (f: string) => readFileSync(new URL(`../../docs/formats/tableau-anime-scripts/${f}`, import.meta.url), "utf8");

describe("fidélité aux documents (v5 du 18/10, ce qui change)", () => {
  it("le script témoin donné au générateur reprend mot pour mot l'exemple v5 (sauf la phrase sur l'entreprise, la question sur l'IA tirée à chaque script)", () => {
    const phrases = phrasesDites(exempleV5("01-continuite").ecriture.script)
      .map((p) => p.dit)
      .filter((dit) => !QUESTIONS_IA.includes(dit as (typeof QUESTIONS_IA)[number]));
    expect(phrases.length).toBeGreaterThanOrEqual(18);
    for (const dit of phrases) {
      if (NOM_ENTREPRISE.test(normaliser(dit))) expect(SCRIPT_TEMOIN).not.toContain(dit);
      else expect(SCRIPT_TEMOIN, dit).toContain(dit);
    }
    expect(SCRIPT_TEMOIN).toContain(`Idée : ${ecritureModele().idee}`);
    // Le témoin ne dicte aucun tutoriel : pas de numéro dit, pas d'impératif en tête de constat.
    expect(SCRIPT_TEMOIN).not.toMatch(/action : (Un|Deux|Trois)\./);
  });
  // Version publique : REGLES.md est un document générique réduit, sa fidélité au code n'est plus vérifiable.
  it.skip("les règles reprennent la règle d'or, l'effacement de l'entreprise et TOUTE la grille de REGLES.md", () => {
    const regles = doc("REGLES.md");
    for (const t of [regles, REGLES_TABLEAU]) {
      expect(t).toContain("RÈGLE D'OR : UNE idée, UN gain (avec son unité), UNE preuve.");
      expect(t).not.toMatch(/solution COMPLÈTE|solution complète, en étapes/);
    }
    expect(REGLES_TABLEAU).toMatch(/ne décrit JAMAIS notre façon de travailler/);
    for (const c of CRITERES_GRILLE) {
      expect(regles, c.id).toContain(c.libelle);
      expect(REGLES_TABLEAU, c.id).toContain(c.libelle);
    }
    expect(CONTRE_EXEMPLES).toMatch(/FAÇON DE TRAVAILLER DE L'ENTREPRISE/);
  });
  // Version publique : REGLES.md est un document générique réduit, sa fidélité au code n'est plus vérifiable.
  it.skip("le gabarit : six passages dans le même ordre, 3 étapes par défaut, de 2 à 5, bornes de mots (Will, 15/10)", () => {
    const regles = doc("REGLES.md");
    const noms = ["ACCROCHE", "DOULEUR", "PROMESSE ET BOUCLE OUVERTE", "CE QUI CHANGE", "EXEMPLE", "À RETENIR ET APPEL"];
    for (const t of [regles, REGLES_TABLEAU]) {
      const positions = noms.map((n) => (t.indexOf(`| **${n}`) >= 0 ? t.indexOf(`| **${n}`) : t.search(new RegExp(`\\d\\. ${n}`))));
      positions.forEach((pos, i) => expect(pos, noms[i]).toBeGreaterThanOrEqual(0));
      expect([...positions].sort((x, y) => x - y)).toEqual(positions);
      expect(t).toMatch(/3 constats par défaut|3 par défaut/);
      expect(t).toMatch(/2 ou 3 constats|de 2 à 3/);
      expect(t).toContain("125 à 145 mots");
      expect(t).toContain("75 à 95 mots");
      // Lot B1 : la promesse n'annonce plus le nombre d'étapes ; la douleur finit par une question ; aucun tutoriel numéroté.
      expect(t).toMatch(/SANS annoncer un nombre d'étapes/);
      expect(t).toMatch(/QUESTION au spectateur|UNE QUESTION au spectateur/);
      expect(t).not.toMatch(/NOMBRE RÉEL d'étapes/);
      expect(t).not.toMatch(/3 à 4 étapes|au-delà de 4 étapes/);
    }
    // Les repères de mots du tableau de REGLES.md sont ceux du programme.
    for (const [d, col] of [[60, 2], [30, 4]] as const)
      for (const [passage, nom] of [["accroche", "ACCROCHE"], ["douleur", "DOULEUR"], ["promesse", "PROMESSE ET BOUCLE OUVERTE"], ["exemple", "EXEMPLE = PROMESSE TENUE"], ["fin", "À RETENIR ET APPEL"]] as const) {
        const ligne = regles.split("\n").find((l) => l.startsWith(`| **${nom}**`))!;
        const cellules = ligne.split("|").map((x) => x.trim());
        expect(cellules[col + 1], `${nom} ${d} s`).toBe(BORNES_PASSAGES[d][passage].repere.join(" à "));
        if (d === 60) expect(cellules[4], `${nom} refus`).toBe(BORNES_PASSAGES[60][passage].refus.join(" à "));
      }
  });
  // Version publique : REGLES.md est un document générique réduit, sa fidélité au code n'est plus vérifiable.
  it.skip("« problème », le retournement et les formules creuses sont bannis ; le jargon est signalé", () => {
    const regles = doc("REGLES.md");
    expect(regles).toContain("Jamais « problème »");
    expect(REGLES_TABLEAU).toContain("Jamais le mot « problème »");
    for (const t of [regles, REGLES_TABLEAU]) {
      expect(t).toMatch(/retournement/);
      for (const f of ["votre parole est en jeu", "le bon geste", "entraînement", "paramètres"]) expect(t, f).toContain(f);
    }
    for (const f of ["votre parole est en jeu", "le bon geste", "la clé du succès", "tout simplement"]) expect(FORMULES_CREUSES.some((x) => x.motif.test(f)), f).toBe(true);
  });
  // Version publique : REGLES.md est un document générique réduit, sa fidélité au code n'est plus vérifiable.
  it.skip("la vérité est éliminatoire : chaque affirmation absolue refusée par le programme est citée dans les deux textes", () => {
    const regles = doc("REGLES.md");
    for (const exemple of ["rien n'est sorti", "aucun risque", "100 %", "en toute sécurité", "garanti", "plus jamais"]) {
      expect(regles, exemple).toContain(exemple);
      expect(REGLES_TABLEAU, exemple).toContain(exemple);
      expect(AFFIRMATIONS_ABSOLUES.some((a) => a.motif.test(normaliser(exemple))), exemple).toBe(true);
    }
    expect(REGLES_TABLEAU).toMatch(/« affirmations »/);
  });
  // Version publique : REGLES.md est un document générique réduit, sa fidélité au code n'est plus vérifiable.
  it.skip("le contrat avec le découpage décrit chaque partie nommée et chaque champ", () => {
    const contrat = doc("REGLES.md").split("## 9. Contrat avec le découpage")[1].split("## 10.")[0];
    for (const p of PARTIES_SCRIPT) expect(contrat, p).toContain(`\`${p}\``);
    for (const champ of ["partie", "libelle", "texte", "ecran", "numero", "etape", "mention", "partiesAccordees", "DonneesScriptTableau.parties"]) expect(contrat, champ).toContain(champ);
    expect(contrat).toMatch(/1 à 5/);
  });
  // Version publique : REGLES.md est un document générique réduit, sa fidélité au code n'est plus vérifiable.
  it.skip("l'entreprise « un peu, à la fin », liée à l'idée et cohérente avec le corps — dans REGLES.md et dans les règles livrées", () => {
    const regles = doc("REGLES.md");
    expect(regles).toContain("Will, 14/10 : « un peu, à la fin »");
    for (const t of [regles, REGLES_TABLEAU]) {
      expect(t).toMatch(/UNE phrase courte \(15 mots au plus\)/i);
      expect(t).toMatch(/juste avant la demande de fin/);
      expect(t).toMatch(/LIÉE À L'IDÉE|liée à l'idée/);
      expect(t).toMatch(/formez-les vous-même/);
    }
    expect(REGLES_TABLEAU).toMatch(/ne prononce JAMAIS l'adresse du site/);
  });
  // Version publique : REGLES.md est un document générique réduit, sa fidélité au code n'est plus vérifiable.
  it.skip("la relecture corrige 3 phrases au plus, jamais de réécriture totale ni d'ajout (REGLES.md et consigne)", () => {
    expect(doc("REGLES.md")).toMatch(/Corriger les 3 phrases les plus faibles au plus/);
    expect(doc("REGLES.md")).toMatch(/Jamais de réécriture totale ni d'ajout/);
    expect(CONSIGNE_RELECTURE).toMatch(/les 3 phrases les plus FAIBLES au plus/);
    expect(CONSIGNE_RELECTURE).not.toMatch(/Comblez-le|script ENTIER|réécrivez-le jusqu'à/);
  });
  it("les plafonds de sortie restent à 28 000 (écriture, relecture) : jamais baissés", () => {
    expect(MAX_TOKENS.ecriture).toBe(28_000);
    expect(MAX_TOKENS.relecture).toBe(28_000);
  });
  it("les consignes ne contiennent pas elles-mêmes le nom de l'entreprise", () => {
    expect(NOM_ENTREPRISE.test([REGLES_TABLEAU, SCRIPT_TEMOIN, CONTRE_EXEMPLES].join("\n").toLowerCase())).toBe(false);
  });
});

describe("trois requêtes distinctes", () => {
  const ecriture = ecritureModele();
  const angle = {
    angle: "",
    douleur: "",
    accroches: (["situation-vecue", "idee-recue-contredite", "chiffre-vrai", "erreur-frequente", "promesse-precise"] as const).map((type) => ({ type, dit: "", ecran: "", pourquoi: "" })),
    retenue: 0,
    raison: "",
  };
  const requetes = [requeteAngle(DEMANDE_MODELE), requeteEcriture(DEMANDE_MODELE, angle), requeteRelecture(DEMANDE_MODELE, angle, ecriture)];

  it("utilisent Opus, jamais Haiku, et posent au plus 4 points de cache", () => {
    for (const r of requetes) {
      expect(r.modele).toBe("claude-opus-5-5");
      expect(r.systeme.filter((b) => b.cache).length).toBeLessThanOrEqual(4);
    }
    expect(() => verifierModele("claude-haiku-4-5")).toThrow(/jamais Haiku/);
  });
  it("ont chacune leur consigne et leur schéma", () => {
    const consignes = requetes.map((r) => r.systeme.at(-1)!.texte);
    expect(new Set(consignes).size).toBe(3);
    expect(requetes[0].schema).toEqual(schemaPourClaude(schemaAngle));
    expect(requetes[1].schema).toEqual(schemaPourClaude(schemaEcriture));
    expect(requetes[2].schema).toEqual(schemaPourClaude(schemaRelecture));
  });
  it("la demande est transmise (série, sujet, mot à commenter, exemple illustratif)", () => {
    const m = requetes[0].messages[0].contenu;
    expect(m).toContain(DEMANDE_MODELE.sujet);
    expect(m).toMatch(/réserve un appel de diagnostic/);
    expect(requeteAngle({ ...DEMANDE_MODELE, fin: { type: "commentaire", mot: "ROUGE" } }).messages[0].contenu).toContain("« ROUGE »");
    expect(m).toMatch(/Exemple illustratif/);
  });
});

describe("sortie structurée", () => {
  const cles = (x: unknown, acc: string[] = []): string[] => {
    if (Array.isArray(x)) x.forEach((y) => cles(y, acc));
    else if (x && typeof x === "object") {
      for (const [k, v] of Object.entries(x)) {
        acc.push(k);
        cles(v, acc);
      }
    }
    return acc;
  };
  const objets = (x: unknown, acc: Record<string, unknown>[] = []): Record<string, unknown>[] => {
    if (Array.isArray(x)) x.forEach((y) => objets(y, acc));
    else if (x && typeof x === "object") {
      const o = x as Record<string, unknown>;
      if (o.type === "object") acc.push(o);
      Object.values(o).forEach((v) => objets(v, acc));
    }
    return acc;
  };
  it.each([
    ["angle", schemaAngle],
    ["écriture", schemaEcriture],
    ["relecture", schemaRelecture],
  ] as const)("le schéma « %s » est fermé et sans contrainte refusée", (_n, s) => {
    const json = schemaPourClaude(s);
    const k = cles(json);
    for (const refusee of ["$schema", "minLength", "maxLength", "maxItems", "minimum", "maximum", "pattern"]) expect(k).not.toContain(refusee);
    for (const o of objets(json)) expect(o.additionalProperties).toBe(false);
    expect(k).not.toContain("anyOf");
  });
});

describe("la recette commune du tableau : seulement les éléments 3 à 7, au vouvoiement", () => {
  it("aucun débit en mots par seconde, aucune ligne « Limites »", () => {
    expect(REGLES_TABLEAU).not.toMatch(/mots par seconde/);
    expect(REGLES_TABLEAU).not.toMatch(/^Limites/m);
  });
  it("aucun chiffre contraire au gabarit (éléments 1, 2, 8), aucun tutoiement, pas de « 8 éléments »", () => {
    expect(REGLES_TABLEAU).not.toContain("tu resserres");
    expect(REGLES_TABLEAU).not.toContain("tous obligatoires");
    for (const x of ["Accroche à tension (0-3 s)", "Douleur avec les mots du spectateur (3-10 s", "Appel (42-45 s)", "vidéo de 45 s ; proportionnel"]) expect(REGLES_TABLEAU).not.toContain(x);
    expect(REGLES_TABLEAU).not.toContain("(vous ou tu)");
  });
  it("garde les éléments 3 à 7 et les anti-patterns", () => {
    for (const n of [3, 4, 5, 6, 7]) expect(REGLES_TABLEAU).toMatch(new RegExp(`^${n}\. `, "m"));
    expect(REGLES_TABLEAU).toContain("ANTI-PATTERNS");
  });
});

describe("script témoin : la phrase sur l'entreprise annoncée compte ses mots", () => {
  it("« Axion-IA met cette fiche en place pour vous. » fait 8 mots, et la consigne le dit", () => {
    expect(compterMots("Axion-IA met cette fiche en place pour vous.")).toBe(8);
    expect(SCRIPT_TEMOIN).toContain("Une phrase de 8 mots sur l'entreprise");
    expect(SCRIPT_TEMOIN).not.toContain("Une phrase de 7 mots");
  });
});

describe("REGLES.md : le tableau des contrôles nomme les deux remarques de densité et de redite", () => {
  it.skip("`densite-scene` et `ecran-redit` y figurent, non éliminatoires", () => {
    const regles = doc("REGLES.md");
    expect(regles).toMatch(/\| `densite-scene` \| remarque \(non éliminatoire\)/);
    expect(regles).toMatch(/\| `ecran-redit` \| remarque \(non éliminatoire\)/);
    expect(regles).toContain("(règle v4, remplacée en v5)");
  });
});

describe("« Pourquoi il est validé » : chaque citation figure dans le texte dit du témoin v5", () => {
  it("toutes les citations entre « » du bloc sont des extraits exacts du texte dit", () => {
    const bloc = SCRIPT_TEMOIN.slice(SCRIPT_TEMOIN.indexOf("Pourquoi il est validé"));
    const citations = [...bloc.matchAll(/«\s*([^»]+?)\s*»/g)].map((m) => m[1]);
    expect(citations.length).toBeGreaterThan(0);
    const dit = phrasesDites(exempleV5("01-continuite").ecriture.script).map((p) => p.dit).join(" ");
    for (const c of citations) expect(dit, c).toContain(c);
  });
});

describe("5e passe : repère des constats, accroche, redite, exemple de douleur (REGLES.md et consignes)", () => {
  const regles = () => doc("REGLES.md");
  it.skip("le repère des constats (14 à 20 mots, milieu 17) est dans REGLES.md §3 et dans les règles livrées, avec la limite dure de 28", () => {
    expect(REPERE_CONSTAT[60]).toEqual([14, 20]);
    expect(regles()).toMatch(/Mots par constat : repère \*\*14 à 20\*\*/);
    expect(regles()).toContain("28 au plus");
    expect(REGLES_TABLEAU).toContain("14 à 20 mots");
    expect(REGLES_TABLEAU).toContain("28 au plus");
  });
  it.skip("une seule formulation de l'accroche : 4,4 s au plus, 12 mots au plus, partout", () => {
    expect(ACCROCHE_MAX_SEC).toBe(4.4);
    for (const t of [REGLES_TABLEAU, regles()]) {
      expect(t).not.toMatch(/0 à 3 s/);
      expect(t).not.toMatch(/(?<![,\d])4 s au plus/);
      expect(t).not.toMatch(/5 à 12 mots/);
    }
    expect(REGLES_TABLEAU).toMatch(/dite en 4,4 s au plus/);
    expect(REGLES_TABLEAU).toMatch(/12 mots au plus/);
    expect(regles()).toMatch(/4,4 s/);
    expect(regles()).toMatch(/12 mots/);
  });
  it.skip("`ecran-redit` est décrit comme le code le fait : 80 % des mots de la phrase dite ou plus (3 mots au moins), jamais « à 100 % »", () => {
    for (const t of [REGLES_TABLEAU, regles()]) {
      expect(t).not.toMatch(/à 100 %|identique à la phrase dite/);
      expect(t).toContain("80 % des mots de la phrase dite ou plus (3 mots au moins)");
    }
  });
  it.skip("les repères par passage sont des guides : seules les limites dures refusent (REGLES.md et consignes)", () => {
    expect(regles()).toMatch(/repères sont des guides/);
    expect(REGLES_TABLEAU).toMatch(/repères sont des guides/);
    expect(REGLES_TABLEAU).not.toMatch(/Un passage hors de sa borne \(une marge d'environ 30 %/);
  });
  it("l'exemple de douleur et l'exemple de promesse des règles sont ceux du témoin", () => {
    const dit = phrasesDites(exempleV5("01-continuite").ecriture.script).map((p) => p.dit).join(" ");
    expect(REGLES_TABLEAU).not.toContain("qui reprendrait ce dossier sans appeler l'absent");
    for (const c of [...REGLES_TABLEAU.matchAll(/« (Chez vous, qui reprendrait[^»]*|Un dossier peut se reprendre[^»]*) »/g)].map((m) => m[1])) expect(dit, c).toContain(c);
  });
});
