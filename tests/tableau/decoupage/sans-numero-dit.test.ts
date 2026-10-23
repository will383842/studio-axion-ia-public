/**
 * Lot B1.3 (décision D1 de Will, 18/10) : le tableau ne dit plus « Un. », « Deux. », « Trois. ». Le découpage ne tire
 * plus de numéro de page du texte dit : le gabarit retombe sur son repli (pas de pastille « Étape x sur N », aucune
 * exigence de numéro), sans erreur. La consigne du découpage demande des mots-clés pour les détails (reference/3) ;
 * « reference/1 » (phrases presque complètes, décision du 14/10) et le plancher « la moitié des mots écrits sont dits »
 * ne changent pas.
 */
import { describe, expect, it } from "vitest";
import { CONSIGNE_DECOUPAGE, roleDecoupageTableau } from "../../../src/moteurs/montage-tableau/decoupage";
import { validerFicheTableau, type FicheTableau } from "../../../src/moteurs/montage-tableau/fiche";
import { BORNES_GABARIT, numerosDits, partDite } from "../../../src/moteurs/montage-tableau/gabarit";
import { mettreEnPage } from "../../../src/moteurs/montage-tableau/mise-en-page";
import { texteDitDe } from "../../../src/domaine/scripts-tableau-controles";
import { exempleV5 } from "../../tableau-scripts/exemples-v5";
import { contexteGabaritCadre, ficheGabaritCadre } from "../reference-3/fiches";

const NUMEROS = /^(Un|Deux|Trois)\s*[.:](?:\s+|$)/;

/**
 * La fiche de l'ancien témoin, SANS ses numéros dits ni sa pastille d'étape (ce que donne un script « ce qui change ») :
 * « Un. Remplacez… » devient « Remplacez… » ; la scène qui ne disait que « Deux. » disparaît (sa seule fonction était de
 * porter le numéro), les scènes sont renumérotées.
 */
function ficheSansNumero(): FicheTableau {
  const f = ficheGabaritCadre();
  for (const s of f.scenes) {
    s.texteDit = s.texteDit.replace(NUMEROS, "");
    if (s.gabarit) delete s.gabarit.numero;
  }
  f.scenes = f.scenes.filter((s) => s.texteDit.trim());
  f.scenes.forEach((s, i) => (s.id = `s${String(i + 1).padStart(2, "0")}`));
  return f;
}

describe("le texte du témoin v5 ne dit aucun numéro d'étape", () => {
  it("numerosDits ne trouve rien dans le texte dit du témoin v5", () => {
    expect(numerosDits(texteDitDe(exempleV5("01-continuite").ecriture.script))).toEqual([]);
  });
  it("tandis que l'ancien témoin en dit trois (l'ancien défaut)", () => {
    expect(ficheGabaritCadre().scenes.flatMap((s) => numerosDits(s.texteDit)).map((x) => x.n)).toEqual([1, 2, 3]);
  });
});

describe("une fiche simulée sans numéro dit : le gabarit retombe sur son repli, sans erreur", () => {
  it("la fiche passe les règles (aucune exigence de numéro), le texte dit n'a plus de « Un. »", () => {
    const f = ficheSansNumero();
    expect(f.scenes.some((s) => NUMEROS.test(s.texteDit))).toBe(false);
    const v = validerFicheTableau(f, { ...contexteGabaritCadre(f), texteScript: f.scenes.map((s) => s.texteDit).join(" ") });
    expect(v.ok ? [] : v.problemes.map((p) => p.message)).toEqual([]);
  });
  it("la mise en page ne lève pas et n'écrit aucune pastille d'étape « Étape x sur N »", () => {
    const f = ficheSansNumero();
    const mise = mettreEnPage(f);
    expect(mise.pages.length).toBeGreaterThan(0);
    const pastilles = mise.pages.flatMap((p) => p.elements.filter((x) => x.gabarit?.sorte === "pastille"));
    expect(pastilles).toEqual([]);
  });
  it("une voix qui dit encore « Un. » sans pastille écrite est toujours refusée (la règle du numéro dit ne change pas)", () => {
    const f = ficheGabaritCadre();
    const s = f.scenes.find((x) => x.gabarit?.numero)!;
    delete s.gabarit!.numero;
    const v = validerFicheTableau(f, contexteGabaritCadre(f));
    expect(v.ok ? [] : v.problemes.map((p) => p.message).join(" ")).toMatch(/la voix dit le numéro/);
  });
});

describe("consigne du découpage (version 17) : mots-clés pour les détails, plancher inchangé", () => {
  it("reference/3 : le détail écrit 2 à 5 mots-clés repris du texte dit, jamais la phrase recopiée ; la phrase clé reste une phrase", () => {
    expect(roleDecoupageTableau.version).toBeGreaterThanOrEqual(17);
    expect(CONSIGNE_DECOUPAGE).toContain("Le DÉTAIL écrit des MOTS-CLÉS repris du texte dit (2 à 5 mots par ligne), jamais la phrase dite recopiée : le sous-titre la montre déjà");
    expect(CONSIGNE_DECOUPAGE).toContain("seules la PHRASE CLÉ, l'accroche et « À retenir » restent des phrases");
  });
  it("reference/1 (décision du 14/10) garde ses phrases presque complètes", () => {
    expect(CONSIGNE_DECOUPAGE).toMatch(/PHRASES PRESQUE COMPLÈTES/);
  });
  it("le plancher ne change pas : la moitié des mots écrits sont dits ; des mots-clés pris du texte dit le passent", () => {
    expect(BORNES_GABARIT.partMotsDits).toBe(0.5);
    const dit = "Chez vous, qui reprendrait ce dossier sans appeler l'absent ? Un dossier peut se reprendre en lisant trois lignes.";
    expect(partDite("Dossier, trois lignes", dit)).toBe(1);
    expect(partDite("Reprendre le dossier", dit)).toBeGreaterThanOrEqual(0.5);
    expect(partDite("Une fiche tenue à jour", dit)).toBeLessThan(0.5);
  });
});

describe("consigne du découpage (version 18) : le numéro dit n'est plus imposé, le titre d'étape est un mot-clé du constat", () => {
  it("plus de « toujours » sur le numéro dit, plus de verbe « Remplacez » imposé au titre", () => {
    expect(roleDecoupageTableau.version).toBeGreaterThanOrEqual(18);
    expect(CONSIGNE_DECOUPAGE).not.toContain("toujours, étapes 1, 2, 3");
    expect(CONSIGNE_DECOUPAGE).not.toContain("le verbe, « Remplacez »");
    expect(CONSIGNE_DECOUPAGE).toContain("obligatoire sur une étape : 1 à 3 mots-clés du constat (« Trois lignes »)");
  });
});

describe("consigne du découpage (version 19, lot B2b) : 2 à 3 constats, exemple « ce qui change » à l'indicatif", () => {
  it("la version est bumpée", () => {
    expect(roleDecoupageTableau.version).toBeGreaterThanOrEqual(19);
  });
  it("plus de « 2 à 5 étapes » : 2 à 3 constats « ce qui change »", () => {
    expect(CONSIGNE_DECOUPAGE).toContain("une page « etape » PAR CONSTAT « ce qui change » (2 à 3)");
    expect(CONSIGNE_DECOUPAGE).not.toContain("PAR ÉTAPE (2 à 5)");
  });
  it("l'exemple n'est plus un tutoriel (« Un. Relisez… ») : un constat à l'indicatif, sans numéro dit", () => {
    expect(CONSIGNE_DECOUPAGE).not.toContain("Un. Relisez");
    expect(CONSIGNE_DECOUPAGE).not.toContain("Notez chaque question qui revient");
    expect(CONSIGNE_DECOUPAGE).toContain("À chaque message, une réponse type se prépare. Elle reprend vos délais et vos horaires.");
    expect(CONSIGNE_DECOUPAGE).not.toContain('"numero":{"n":1,"ancre":0}}');
  });
});

describe("consigne du découpage (version 20, relecture Opus B2a) : l'exemple du gabarit par parties n'est plus l'ancien tutoriel", () => {
  it("la version est bumpée à 20", () => {
    expect(roleDecoupageTableau.version).toBeGreaterThanOrEqual(20);
  });
  it("plus aucune trace du tutoriel numéroté dans l'exemple « forme exacte attendue »", () => {
    expect(CONSIGNE_DECOUPAGE).not.toContain("Un. Remplacez");
    expect(CONSIGNE_DECOUPAGE).not.toContain("Deux. Effacez");
    expect(CONSIGNE_DECOUPAGE).not.toContain("Trois réflexes à prendre");
    expect(CONSIGNE_DECOUPAGE).not.toContain("forme les équipes à ces réflexes");
  });
  it("l'exemple reprend le témoin v5 : promesse sans nombre d'étapes, constats à l'indicatif sans « numero », titre en mots-clés, fin « met cette fiche en place pour vous »", () => {
    expect(CONSIGNE_DECOUPAGE).toContain("Un dossier peut se reprendre en lisant trois lignes.");
    expect(CONSIGNE_DECOUPAGE).toContain('"texte":"Trois lignes"');
    expect(CONSIGNE_DECOUPAGE).toContain("Axion-IA met cette fiche en place pour vous.");
    const exemple = CONSIGNE_DECOUPAGE.slice(CONSIGNE_DECOUPAGE.indexOf("GABARIT PAR PARTIES"));
    expect(exemple).not.toContain('"numero":{"n":');
  });
  it("s01 et s02 viennent du témoin v5 (plus de mélange avec l'ancien témoin « devis »)", () => {
    const exemple = CONSIGNE_DECOUPAGE.slice(CONSIGNE_DECOUPAGE.indexOf("GABARIT PAR PARTIES"));
    expect(exemple).not.toContain("Ce devis collé dans ChatGPT");
    expect(exemple).not.toContain("Le nom du client. L'adresse du chantier");
    expect(exemple).toContain('"texteDit":"Le seul qui connaît ce dossier client est en congé."');
    expect(exemple).toContain('"importants":["dossier client","en congé"]');
    expect(exemple).toContain("d'après le témoin v5 (18/10)");
  });
});
