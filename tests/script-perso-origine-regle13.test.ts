/**
 * SCRIPT PERSO, 4e tour (décision de Will du 18/10) : un texte que Will fournit lui-même est pris à l'identique, jusqu'au
 * découpage payant. L'origine « will » est rangée dans `donnees` du brouillon et fait sauter, sur le texte DIT seulement,
 * le tutoiement et les mots de temps de la règle 13. Les textes écrits par Claude gardent tous leurs contrôles.
 * Mémoire seulement, aucun réseau.
 */
import { describe, expect, it, vi } from "vitest";
import { mockHeaders, mockNavigation } from "./helpers/next-mocks";
import { regleControlesScript } from "../src/moteurs/montage-tableau/regles";
import { contexteFormationV3, ficheFormationV3Brute } from "./tableau/reference-3/fiches";

vi.mock("next/headers", () => mockHeaders);
vi.mock("next/navigation", () => mockNavigation);
vi.mock("next/cache", () => ({ revalidatePath: () => undefined, revalidateTag: () => undefined }));

const { validerDonneesScript, entreeDecoupage, SERIES_TABLEAU, RESEAUX_TABLEAU } = await import("@/services/tableau-creation");
const { STRUCTURES_TABLEAU } = await import("@/moteurs/montage-tableau/fiche");

const brut = {
  texte: "Voici un texte de Will assez long pour passer le contrôle des huit mots.",
  serieCode: "", structure: "", douleur: "Le problème", gesteMinute: "Le geste", finId: "", reseaux: ["tiktok"],
};

function donneesValides(origine?: unknown) {
  const r = validerDonneesScript({ ...brut, serieCode: SERIES_TABLEAU[0].code, structure: STRUCTURES_TABLEAU[0], reseaux: [RESEAUX_TABLEAU[0].valeur], ...(origine !== undefined ? { origine } : {}) });
  if (!r.ok) throw new Error(r.phrase);
  return r.donnees;
}

function ficheVoixFamiliere() {
  const f = ficheFormationV3Brute();
  f.scenes[0].texteDit = `${f.scenes[0].texteDit} Tu verras, demain tu gagneras du temps.`;
  return f;
}

describe("origine « will » dans le brouillon", () => {
  it("l'origine « will » envoyée par l'écran est rangée dans `donnees`", () => {
    expect(donneesValides("will").origine).toBe("will");
  });
  it.each([undefined, "generateur", "autre", 3])("origine %s : rien n'est rangé (tous les contrôles restent)", async (o) => {
    expect((donneesValides(o)).origine).toBeUndefined();
  });
  it("le découpage reçoit l'origine dans son contexte de contrôle", () => {
    const d = donneesValides("will");
    const base = { sourcesChiffres: [], preuves: [], matieres: [], aujourdhui: "2026-10-18" };
    expect(entreeDecoupage(d, "v1", "b1", base, []).controle.texteDeWill).toBe(true);
    expect(entreeDecoupage({ ...d, origine: undefined }, "v1", "b1", base, []).controle.texteDeWill).toBeUndefined();
  });
});

describe("règle 13 : texte dit de Will", () => {
  const contexteDe = (f: ReturnType<typeof ficheVoixFamiliere>) => contexteFormationV3(f);
  it("origine will : « tu » et « demain » dans le texte dit ne refusent pas le découpage", () => {
    const f = ficheVoixFamiliere();
    expect(regleControlesScript(f, { ...contexteDe(f), texteDeWill: true })).toEqual([]);
  });
  it("origine generateur (ou absente) : le même texte est toujours refusé", () => {
    const f = ficheVoixFamiliere();
    const details = regleControlesScript(f, contexteDe(f)).map((m) => m.detail).join(" | ");
    expect(details).toContain("tutoie");
    expect(details).toContain("demain");
  });
  it("origine will : un « tu » ÉCRIT à l'écran (écrit par Claude) reste refusé", () => {
    const f = ficheFormationV3Brute();
    const titre = f.scenes[1].elements.find((e) => e.id === "e03") as { texte: string };
    titre.texte = "Tu gagnes du temps demain";
    const details = regleControlesScript(f, { ...contexteDe(f), texteDeWill: true }).map((m) => m.detail).join(" | ");
    expect(details).toContain("tutoie");
  });
});
