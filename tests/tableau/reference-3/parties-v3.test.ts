/**
 * CONTRAT « parties » générateur v3 → découpage (`docs/formats/tableau-anime-scripts/REGLES.md` § 9). Un VRAI résultat
 * du générateur v3 (le script témoin Formation, `exemples-v3/01-formation.md`) passe par le chemin de production :
 * `donneesDepuisScript` (le champ `parties`), `entreeDecoupage`, puis `decouperEnScenes` avec un double de Claude qui
 * rend la fiche de ce script en se TROMPANT de parties (tout en « douleur », aucun numéro d'étape). Les parties du
 * générateur remettent chaque page dans sa partie : les repères lus sur la mise en page sont « L'accroche », « La
 * douleur », « La solution » (+ « Étape n sur 4 » à côté de la pastille), « Exemple illustratif », « À retenir », puis
 * « À vous » (charte Axion, 15/10/2026).
 */
import { describe, expect, it, vi } from "vitest";
import { mockHeaders, mockNavigation } from "../../helpers/next-mocks";
import { LIBELLES_PARTIES, partiesDuScript } from "../../../src/domaine/scripts-tableau";
import { appliquerParties, decouperEnScenes, partiesDuDecoupage, PAGE_DE_PARTIE, variableDecoupage, type OutilsDecoupage } from "../../../src/moteurs/montage-tableau/decoupage";
import type { FicheTableau } from "../../../src/moteurs/montage-tableau/fiche";
import { chapitresDesParties3, nomChapitre3 } from "../../../src/briques/tableau-scene/reference/charte";
import { mettreEnPage } from "../../../src/moteurs/montage-tableau/mise-en-page";
import { exempleV3 } from "../../tableau-scripts/exemples-v3";
import { contexteFormationV3, ficheFormationV3Brute } from "./fiches";

vi.mock("next/headers", () => mockHeaders);
vi.mock("next/navigation", () => mockNavigation);
vi.mock("next/cache", () => ({ revalidatePath: () => undefined, revalidateTag: () => undefined }));

const { donneesDepuisScript, entreeDecoupage } = await import("@/services/tableau-creation");

const FORMATION = exempleV3("01-formation");
const balise = (texte: string, nom: string) => new RegExp(`<${nom}>\\n([\\s\\S]*?)\\n</${nom}>`).exec(texte)![1];

/** Le résultat du générateur, tel que « Utiliser ce script » le recopie dans les données du brouillon. */
function donnees() {
  return donneesDepuisScript(FORMATION.demande, { script: FORMATION.ecriture.script, angle: FORMATION.demande.sujet, motsDouleur: FORMATION.ecriture.motsDouleur });
}

/** La fiche du script Formation, rendue par « Claude » en se trompant de parties (aucune étape numérotée). */
function ficheTrompee(variable: string): FicheTableau {
  const f = ficheFormationV3Brute();
  Object.assign(f, JSON.parse(balise(variable, "fiche_fixe")), { serie: JSON.parse(balise(variable, "serie")), douleur: balise(variable, "douleur"), gesteMinute: balise(variable, "geste_minute") });
  for (const s of f.scenes) s.gabarit = { role: s.page === 1 ? "accroche" : "douleur" };
  return f;
}

describe("contrat « parties » (REGLES § 9) : générateur v3 → découpage", () => {
  it("le générateur rend les parties du contrat, dans l'ordre, et elles redonnent le texte dit mot pour mot", () => {
    const d = donnees();
    expect(d.parties?.map((p) => p.libelle)).toEqual(["Accroche", "Douleur", "Solution", "Étape 1", "Étape 2", "Étape 3", "Étape 4", "Exemple", "À retenir", "Appel"]);
    expect(d.parties!.map((p) => p.texte).join(" ")).toBe(d.texte);
    // Le découpage les lit par les NOMS EXACTS du contrat.
    expect(partiesDuDecoupage(d.parties)).toEqual(d.parties);
    expect(partiesDuDecoupage([{ partie: "douleur", texte: "Vous ne le savez pas." }])).toBeUndefined();
    expect(partiesDuDecoupage([{ partie: "probleme", libelle: "Problème", texte: "x", ecran: [] }])).toBeUndefined();
    expect(partiesDuDecoupage("non")).toBeUndefined();
    expect(Object.keys(PAGE_DE_PARTIE).sort()).toEqual(Object.keys(LIBELLES_PARTIES).sort());
  });

  it("les parties vont dans la demande à Claude, avec leur partie de page et leur libellé", () => {
    const d = donnees();
    const e = entreeDecoupage(d, "v-formation-v3", "r1", { ...contexteFormationV3(ficheFormationV3Brute()) }, [{ id: "mat-cadastre-demo", resume: "Compromis avant / après." }]);
    expect(e.parties).toEqual(d.parties);
    const v = variableDecoupage(e);
    expect(balise(v, "parties").split("\n")).toEqual(d.parties!.map((p) => `${PAGE_DE_PARTIE[p.partie]}${p.numero ? ` ${p.numero}` : ""} · ${p.libelle} · ${p.texte}`));
    expect(balise(v, "parties")).toMatch(/^solution 2 · Étape 2 · Deux\. Mettez en orange/m);
  });

  it("un vrai résultat du générateur passe dans le découpage : chaque page est rattachée à un chapitre nommé", async () => {
    const d = donnees();
    const { texteScript: _t, ...controle } = contexteFormationV3(ficheFormationV3Brute());
    const e = entreeDecoupage(d, "v-formation-v3", "r1", controle, [{ id: "mat-cadastre-demo", resume: "Compromis avant / après." }]);
    expect(e.habillage).toBe("reference/3");
    const outils: OutilsDecoupage = { appeler: async (_role, entree) => ({ ok: true, simule: false, donnees: JSON.stringify(ficheTrompee(entree.variable)) }), budget: { reserver: async () => ({ ok: true }) } };
    const r = await decouperEnScenes(e, outils);
    if (!r.ok) throw new Error(r.refus.join("\n"));
    expect(r.appels).toBe(1);
    const mise = mettreEnPage(r.fiche);
    // Barre des chapitres nommés (choix de Will du 15/10) : l'accroche ouvre « Douleur », « À retenir » ouvre « À vous ».
    const chapitres = chapitresDesParties3(mise.pages.map((p) => mise.styleReference?.parties?.[p.page] ?? "")).map(nomChapitre3);
    expect(chapitres).toEqual(["Douleur", "Douleur", "Douleur", "Solution", "Solution", "Solution", "Solution", "Solution", "Exemple", "À vous", "À vous"]);
    // Seule la page de l'exemple garde un repère écrit : « Exemple illustratif ».
    const etiquettes = mise.pages.flatMap((p) => p.elements.filter((x) => x.gabarit?.sorte === "partie").map((x) => x.lignes.map((l) => l.texte).join(" · ")));
    expect(etiquettes).toEqual(["Exemple illustratif"]);
    // « Étape n sur 4 » est écrit à droite de la pastille d'étape (charte Axion, 15/10).
    expect(mise.pages.flatMap((p) => p.elements.flatMap((x) => (x.gabarit?.sorte === "pastille" && x.gabarit.etape ? [x.gabarit.etape.texte] : [])))).toEqual([1, 2, 3, 4].map((n) => `Étape ${n} sur 4`));
    expect([...chapitres, ...etiquettes].join(" ")).not.toMatch(/probl[eè]me/i);
    // Les numéros d'étape dits (« Un. », « Deux. »…) sont posés à leur mot.
    expect(r.fiche.scenes.filter((s) => s.gabarit?.numero).map((s) => s.gabarit!.numero)).toEqual([1, 2, 3, 4].map((n) => ({ n, ancre: 0 })));
  });

  it("des parties qui ne redonnent pas le texte des scènes ne changent rien", () => {
    const f = ficheTrompee(`<fiche_fixe>\n{}\n</fiche_fixe>\n<serie>\n{}\n</serie>\n<douleur>\nx\n</douleur>\n<geste_minute>\ny\n</geste_minute>`);
    f.habillage = "reference/3";
    const parties = partiesDuScript(FORMATION.ecriture.script);
    expect(appliquerParties(f, parties.slice(1))).toBe(f);
    expect(appliquerParties(f, undefined)).toBe(f);
    expect(appliquerParties(f, parties)).not.toBe(f);
  });
});
