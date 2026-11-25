/**
 * T-EXT-33 · formulaire d'entrée du tutoriel d'outil. Rendu serveur seulement (`renderToStaticMarkup`, comme
 * `tests/barre-rubriques.test.tsx` : jsdom n'est pas installé, les clics ne sont pas rejoués ici). Aucun appel réel, 0 €.
 */
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { mockHeaders, mockNavigation } from "../helpers/next-mocks";

vi.mock("next/headers", () => mockHeaders);
vi.mock("next/navigation", () => mockNavigation);

const { AIDE_MODE_SANS_VOIX } = await import("@/formats/tutoriel-outil/mode-sans-voix");
const { FormulaireTutorielOutil, textesScript, scriptSuffisant, phraseRienDepense, PHRASE_RIEN_DEPENSE, PHRASE_RIEN_DEPENSE_SANS_DEVIS, PHRASE_RIEN_DEPENSE_SCRIPT, PHRASE_RIEN_DEPENSE_SCRIPT_DEVIS } = await import("@/components/formats/vitrines/FormulaireTutorielOutil");

const deposer = vi.fn(async () => ({ ok: true as const, donnees: { statut: "lancee" as const, videoId: "v1" } }));
const rendre = (interrupteurs?: { formulaire: boolean; dossier: boolean; phrase: boolean; devis?: boolean }, equipeOuverte = true) => renderToStaticMarkup(createElement(FormulaireTutorielOutil, (interrupteurs ? { interrupteurs, deposer, equipeOuverte } : {}) as never));
/** Le texte VISIBLE : balises et attributs retirés. */
const visible = (html: string) => html.replace(/<script[\s\S]*?<\/script>/g, "").replace(/<[^>]+>/g, " ").replace(/&#x27;|&#39;/g, "'").replace(/&amp;/g, "&").replace(/\s+/g, " ").trim();

/** Les cases d'un groupe : valeur et état coché, dans l'ordre (l'ordre des attributs ne compte pas). */
const cases = (html: string, nom: string) => [...html.matchAll(new RegExp(`<input[^>]*name="${nom}"[^>]*>`, "g"))].map((m) => ({ valeur: /value="([^"]*)"/.exec(m[0])?.[1] ?? "", coche: /\bchecked=""/.test(m[0]) }));

const TOUT = { formulaire: true, dossier: true, phrase: true };
const VITRINE = ["Titre ou idée", "Outil montré", "Votre script (facultatif)", "Préparer le tutoriel"];

describe("éteint : la vitrine d'aujourd'hui, inchangée", () => {
  it("sans interrupteur, formulaire éteint, ou entrées ouvertes sans le formulaire : le même écran", () => {
    const ref = rendre();
    for (const sw of [{ formulaire: false, dossier: true, phrase: true }, { formulaire: false, dossier: false, phrase: false }]) expect(rendre(sw)).toBe(ref);
    const t = visible(ref);
    for (const x of VITRINE) expect(t).toContain(x);
    expect(t).toContain("Collez-le : il fait foi. Sans script, le studio en écrit un que vous relirez avant de valider.");
    expect(t).not.toContain("Ce que vous donnez");
    expect(t).not.toContain("Préparer la vidéo");
  });
  it("`true` n'est lu que sous forme booléenne : une chaîne ne l'allume pas", () => {
    const html = renderToStaticMarkup(createElement(FormulaireTutorielOutil, { interrupteurs: { formulaire: "true", dossier: true, phrase: true }, deposer } as never));
    expect(html).toBe(rendre());
  });
});

describe("allumé : les quatre blocs, dans l'ordre", () => {
  const html = rendre(TOUT);
  const t = visible(html);
  it("« Ce que vous donnez », « Fin de la vidéo », « Parcours », « Formats », puis la phrase fixe et le bouton", () => {
    const ordre = ["Ce que vous donnez", "Un dossier (.zip)", "Une phrase", "Fin de la vidéo", "Aucune", "Prendre rendez-vous", "Parcours", "Choisi par le Studio", "Formats", "4:5", "9:16", "1:1", "Le studio prépare le parcours et le script", "Préparer la vidéo"];
    let depuis = 0;
    for (const x of ordre) {
      const i = t.indexOf(x, depuis);
      expect(i, x).toBeGreaterThanOrEqual(depuis);
      depuis = i;
    }
    // Devis éteint (défaut) : on ne promet pas un devis qui n'existe pas.
    expect(t).toContain("Le studio prépare le parcours et le script dès l'envoi ; rien n'est lu ni rendu avant que vous validiez le script.");
    expect(t).not.toContain("l'estimation");
  });
  it("l'estimation n'est annoncée que si le réglage est allumé (`true` exact)", () => {
    expect(visible(rendre({ ...TOUT, devis: true }))).toContain("Rien n'est dépensé avant votre accord : vous verrez d'abord l'estimation, puis le parcours et le script.");
    expect(visible(rendre({ ...TOUT, devis: "true" as never }))).not.toContain("l'estimation");
  });
  it("la phrase « Rien n'est dépensé » suit le script collé : pas de relecture ni de devis promis à tort", () => {
    expect(phraseRienDepense(false, "")).toBe(PHRASE_RIEN_DEPENSE_SANS_DEVIS);
    expect(phraseRienDepense(true, "  ")).toBe(PHRASE_RIEN_DEPENSE);
    expect(phraseRienDepense(false, "Mon texte")).toBe(PHRASE_RIEN_DEPENSE_SCRIPT);
    expect(PHRASE_RIEN_DEPENSE_SCRIPT).toContain("part au rendu dès l'envoi avec votre script");
    expect(PHRASE_RIEN_DEPENSE_SCRIPT).not.toMatch(/devis|relu|le script et/);
    expect(phraseRienDepense(true, "Mon texte")).toBe(PHRASE_RIEN_DEPENSE_SCRIPT_DEVIS);
    expect(PHRASE_RIEN_DEPENSE_SCRIPT_DEVIS).toBe("Rien n'est dépensé avant votre accord : vous verrez d'abord l'estimation.");
    expect(PHRASE_RIEN_DEPENSE_SCRIPT_DEVIS).not.toMatch(/parcours|script/);
  });
  it("un seul contrôle du son (pastilles « Avec voix » par défaut / « Sans voix ») et une seule zone de script", () => {
    const pastilles = [...html.matchAll(/<button[^>]*role="radio"[^>]*aria-checked="(true|false)"[^>]*>([\s\S]*?)<\/button>/g)].map((m) => ({ coche: m[1] === "true", texte: visible(m[2]) }));
    expect(pastilles).toHaveLength(2);
    expect(pastilles[0]).toEqual({ coche: true, texte: "Avec voix" });
    expect(pastilles[1].coche).toBe(false);
    // Pastille courte : la longue explication ne va jamais DANS la pastille (390 px) mais dans un <p> sous le sélecteur.
    expect(pastilles[1].texte).toBe("Sans voix (sous-titres)");
    expect(pastilles[1].texte.length).toBeLessThanOrEqual(30);
    expect(t).not.toContain(AIDE_MODE_SANS_VOIX);
    expect(html).not.toMatch(/type="checkbox"[^>]*>\s*(?:<[^>]+>\s*)*Sans voix/);
    expect((t.match(/Son de la vidéo/g) ?? []).length).toBe(1);
    expect((html.match(/<textarea/g) ?? []).length).toBe(1);
    expect((t.match(/Script à utiliser tel quel \(facultatif\)/g) ?? []).length).toBe(1);
    // « Mon script » est une entrée à part entière, proposée en plus du dossier et de la phrase.
    expect(t).toContain("Mon script");
  });
  it("le bloc du son est annoncé une seule fois : titre « Son et script » relié à sa section, sans libellé doublon", () => {
    expect(html).toMatch(/<section aria-labelledby="bloc-son"[^>]*>\s*<h2 id="bloc-son"[^>]*>\s*Son et script/);
    expect(html).not.toMatch(/<section[^>]*aria-label="Son de la vidéo"/);
  });
  it("« Aucune » est cochée par défaut, « Prendre rendez-vous » non ; aucune autre option de fin", () => {
    expect(cases(html, "fin")).toEqual([{ valeur: "aucune", coche: true }, { valeur: "prendre-rendez-vous", coche: false }]);
  });
  it("les trois formats sont cochés par défaut ; le parcours est replié et « Choisi par le Studio » est le défaut", () => {
    expect(cases(html, "formats")).toEqual([{ valeur: "4:5", coche: true }, { valeur: "9:16", coche: true }, { valeur: "1:1", coche: true }]);
    expect(html).toMatch(/<details>\s*<summary[^>]*>Parcours<\/summary>/);
    expect(cases(html, "parcours")[0]).toEqual({ valeur: "", coche: true });
    expect(cases(html, "parcours").filter((c) => c.coche)).toHaveLength(1);
    for (const p of ["Une journée avant / après", "Du chiffre à la décision", "Le client écrit à 2 h du matin", "Une automatisation de bout en bout"]) expect(t).toContain(p);
  });
  it("dossier : la case d'attestation (texte de la fiche), 50 Mo au plus ; le champ « Votre script » de la vitrine n'est plus montré", () => {
    expect(t).toContain("Je confirme qu'aucune donnée personnelle n'est visible sur les images du dossier");
    expect(t).toContain("50 Mo au plus");
    expect(t).not.toContain("Votre script");
    expect(t).not.toContain("Préparer le tutoriel");
  });
  it("aucun mot technique (« zip » seulement dans « Un dossier (.zip) »), aucun montant, aucune étiquette interdite", () => {
    expect((t.match(/zip/gi) ?? []).length).toBe((t.match(/\(\.zip\)/g) ?? []).length);
    expect(t).not.toMatch(/€|\bEUR\b|euros?\b|\bprix\b|\bco[ûu]ts?\b|\d\s?\$/i);
    expect(t).not.toMatch(/\b(API|JSON|extraction|octets|serveur|fichier brut)\b/i);
    expect(t).not.toMatch(/Douleur|Solution|Exemple|À vous/);
  });
});

describe("entrées ouvertes une à une", () => {
  it("« Un dossier (.zip) » absent si tutoriel.entreeZip éteint ; la phrase est proposée (avec « Mon script »)", () => {
    const t = visible(rendre({ formulaire: true, dossier: false, phrase: true }));
    expect(t).not.toContain("Un dossier (.zip)");
    expect(t).not.toMatch(/zip/i);
    expect(t).toContain("Une phrase");
    expect(t).toContain("Votre phrase");
    expect(t).toContain("De 10 à 300 caractères.");
    expect(t).not.toContain("Je confirme qu'aucune donnée personnelle");
  });
  it("« Une phrase » absente si l'entrée phrase n'est pas ouverte ; le dossier est proposé (avec « Mon script »)", () => {
    const html = rendre({ formulaire: true, dossier: true, phrase: false });
    const t = visible(html);
    expect(t).toContain("Un dossier (.zip)");
    expect(t).not.toContain("Une phrase");
    expect(cases(html, "mode").map((c) => c.valeur)).toEqual(["dossier", "script"]);
  });
  it("les deux ouvertes : un choix entre les deux, le dossier d'abord, puis « Mon script »", () => {
    const html = rendre(TOUT);
    expect(cases(html, "mode")).toEqual([{ valeur: "dossier", coche: true }, { valeur: "phrase", coche: false }, { valeur: "script", coche: false }]);
  });
});

describe("« Mon script » : toujours possible formulaire ouvert", () => {
  const EXT = { formulaire: true, dossier: false, phrase: false };
  it("les deux entrées éteintes : la pastille « Mon script » est là et cochée ; plus aucun « Aucune entrée n'est ouverte »", () => {
    for (const equipe of [true, false]) {
      const html = rendre(EXT, equipe);
      const t = visible(html);
      expect(cases(html, "mode")).toEqual([{ valeur: "script", coche: true }]);
      expect(t).toContain("Mon script");
      expect(t).toContain("Ce que vous donnez");
      expect(t).toContain("Votre script");
      expect(t).toContain("Son de la vidéo");
      expect(t).toContain("Fin de la vidéo");
      expect(t).toContain("Préparer la vidéo");
      expect(t).not.toContain("Aucune entrée n'est ouverte");
      expect(t).not.toContain("Votre phrase");
      expect(t).not.toMatch(/zip/i);
    }
  });
  it("le script minimum est annoncé (40 caractères au moins) et le bouton est désactivé tant qu'il est vide", () => {
    const html = rendre(EXT);
    expect(visible(html)).toContain("40 caractères au moins");
    expect(/<button[^>]*type="submit"[^>]*disabled=""/.test(html) || /<button[^>]*disabled=""[^>]*type="submit"/.test(html)).toBe(true);
  });
  it("équipe fermée : « Mon script » vient en tête, puis le dossier et la phrase", () => {
    expect(cases(rendre(TOUT, false), "mode")).toEqual([{ valeur: "script", coche: true }, { valeur: "dossier", coche: false }, { valeur: "phrase", coche: false }]);
  });
  it("équipe ouverte : « Mon script » reste proposé, après les entrées ouvertes", () => {
    expect(cases(rendre(TOUT, true), "mode").map((c) => c.valeur)).toEqual(["dossier", "phrase", "script"]);
  });
  it("équipe fermée : l'aide « collez votre script » est visible quel que soit le mode, sans la promesse « le studio en écrit un »", () => {
    for (const sw of [TOUT, { formulaire: true, dossier: true, phrase: false }, { formulaire: true, dossier: false, phrase: true }, EXT]) {
      const t = visible(rendre(sw, false));
      expect(t).toContain("L'équipe qui écrit le script n'est pas ouverte : collez votre script.");
      expect(t).not.toContain("le studio en écrit un");
      expect(t).not.toContain("que vous relirez");
    }
  });
  it("le script est exigé : phrase et dossier équipe fermée (non vide), « Mon script » toujours (40 caractères), facultatif équipe ouverte", () => {
    expect(textesScript("phrase", false)).toEqual({ libelle: "Script à utiliser tel quel (obligatoire)", aide: "L'équipe qui écrit le script n'est pas ouverte : collez votre script." });
    expect(textesScript("dossier", false).libelle).toContain("(obligatoire)");
    expect(textesScript("phrase", true).libelle).toContain("(facultatif)");
    expect(textesScript("script", true).libelle).toBe("Votre script");
    for (const equipe of [true, false]) {
      expect(textesScript("script", equipe).aide).toContain("40 caractères au moins");
      expect(scriptSuffisant("script", equipe, "x".repeat(39))).toBe(false);
      expect(scriptSuffisant("script", equipe, " ".repeat(10) + "x".repeat(40) + " ")).toBe(true);
    }
    for (const mode of ["phrase", "dossier"] as const) {
      expect(scriptSuffisant(mode, false, "")).toBe(false);
      expect(scriptSuffisant(mode, false, "   ")).toBe(false);
      expect(scriptSuffisant(mode, false, "Un script")).toBe(true);
      expect(scriptSuffisant(mode, true, "")).toBe(true);
    }
  });
  it("équipe ouverte : le script reste facultatif pour la phrase et le dossier", () => {
    const t = visible(rendre(TOUT, true));
    expect(t).toContain("Script à utiliser tel quel (facultatif)");
    expect(t).not.toContain("L'équipe qui écrit le script n'est pas ouverte");
  });
  it("équipe non précisée : l'écran d'avant (script facultatif) ; seul `false` explicite ferme, comme la page le passe en cas de lecture en échec", () => {
    const html = renderToStaticMarkup(createElement(FormulaireTutorielOutil, { interrupteurs: TOUT, deposer } as never));
    expect(visible(html)).toContain("Script à utiliser tel quel (facultatif)");
    expect(cases(html, "mode")[0]).toEqual({ valeur: "dossier", coche: true });
    const ferme = renderToStaticMarkup(createElement(FormulaireTutorielOutil, { interrupteurs: TOUT, deposer, equipeOuverte: false } as never));
    expect(visible(ferme)).toContain("L'équipe qui écrit le script n'est pas ouverte");
    expect(cases(ferme, "mode")[0]).toEqual({ valeur: "script", coche: true });
  });
});

describe("vitrine : le lien vers les réglages du tutoriel", () => {
  it("formulaire éteint : « Ouvrir les réglages du tutoriel » mène à /reglages/tutoriel-outil", () => {
    for (const html of [rendre(), rendre({ formulaire: false, dossier: true, phrase: true })]) {
      expect(html).toMatch(/<a[^>]*href="\/reglages\/tutoriel-outil"[^>]*>\s*Ouvrir les réglages du tutoriel\s*<\/a>/);
    }
  });
  it("formulaire ouvert : pas de lien (le formulaire sert déjà)", () => {
    expect(visible(rendre(TOUT))).not.toContain("Ouvrir les réglages du tutoriel");
  });
});

describe("0 € : rien n'est envoyé au rendu", () => {
  it("le rendu serveur n'appelle pas l'action de dépôt", () => {
    deposer.mockClear();
    rendre(TOUT);
    expect(deposer).not.toHaveBeenCalled();
  });
});
