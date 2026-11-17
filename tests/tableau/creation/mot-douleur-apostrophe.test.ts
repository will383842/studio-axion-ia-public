/**
 * « Les mots de la douleur » reconnaissent un mot précédé d'une élision (l', d', qu'…, apostrophe droite ou
 * typographique) ; un mot absent ou un morceau de mot reste refusé. Essai réel du 17/11 (« erreur » dans « L'erreur… »).
 */
import { describe, expect, it, vi } from "vitest";
import { mockHeaders, mockNavigation } from "../../helpers/next-mocks";
import { defautsMotsDouleur, motDouleurDit, positionDite, sansElision } from "@/domaine/douleur-tableau";
import { ficheErreurCorrigee, texteScriptDe } from "../regles/exemples";

vi.mock("next/headers", () => mockHeaders);
vi.mock("next/navigation", () => ({ ...mockNavigation, useRouter: () => ({ push: () => undefined, replace: () => undefined, refresh: () => undefined }), usePathname: () => "/tableau/nouvelle" }));
vi.mock("next/cache", () => ({ revalidatePath: () => undefined, revalidateTag: () => undefined }));

const { validerDonneesScript, donneesDepuisScript } = await import("@/services/tableau-creation");

const ACCROCHE_ERREUR = "L'erreur que font beaucoup d'entreprises avec l'IA ?";
const TEXTE = `${ACCROCHE_ERREUR} Elles achètent un outil avant de savoir quoi en faire.`;
const fiche = ficheErreurCorrigee;
const donnees = { texte: texteScriptDe(fiche), serieCode: "formation", structure: fiche.structure, douleur: fiche.douleur, gesteMinute: fiche.gesteMinute, finId: "fin-if-abonnement", reseaux: ["verticaux", "linkedin"] };
const valider = (texte: string, motsDouleur: string) => validerDonneesScript({ ...donnees, texte, motsDouleur });
const refus = (m: string) => ({ ok: false, phrase: `Le mot de la douleur « ${m} » n'est pas dans le texte dit : recopiez-le tel qu'il est dit, ou retirez-le.` });

describe("mots de la douleur et élisions", () => {
  it("a) validerDonneesScript accepte le mot élidé, apostrophe droite ou typographique", () => {
    expect(valider(TEXTE, "erreur")).toMatchObject({ ok: true });
    expect(valider(TEXTE, "erreur, entreprises")).toMatchObject({ ok: true });
    expect(valider(TEXTE.replace(/'/g, "’"), "erreur, entreprises")).toMatchObject({ ok: true });
    expect(valider(TEXTE, "L’erreur")).toMatchObject({ ok: true });
  });

  it("b) un mot absent, un morceau de mot, « hui » dans « aujourd'hui » restent refusés", () => {
    expect(valider(TEXTE, "chronomètre")).toEqual(refus("chronomètre"));
    expect(valider(TEXTE, "rreur")).toEqual(refus("rreur"));
    expect(valider("Aujourd'hui, vos réponses sont vagues. Il faut les préciser.", "hui")).toEqual(refus("hui"));
  });

  it("c) sansElision et motDouleurDit : l', d', qu', jusqu', ’ ; aujourd'hui intact", () => {
    expect(sansElision("L'erreur d’entreprises")).toBe("erreur entreprises");
    expect(sansElision("qu'il jusqu’ici")).toBe("il ici");
    expect(sansElision("aujourd'hui")).toBe("aujourd'hui");
    expect(motDouleurDit("Jusqu’ici, qu'il parte", "ici")).toBe(true);
    expect(motDouleurDit("Jusqu’ici, qu'il parte", "il")).toBe(true);
    expect(motDouleurDit("Aujourd'hui", "hui")).toBe(false);
    expect(motDouleurDit("Aujourd'hui", "aujourd'hui")).toBe(true);
    expect(motDouleurDit(TEXTE, "rreur")).toBe(false);
  });

  it("d) defautsMotsDouleur et positionDite", () => {
    expect(defautsMotsDouleur(["erreur", "entreprises"], ACCROCHE_ERREUR)).toEqual([]);
    expect(positionDite(ACCROCHE_ERREUR, "erreur")).toBe(0);
    expect(positionDite(ACCROCHE_ERREUR, "entreprises")).toBe(ACCROCHE_ERREUR.indexOf("d'entreprises"));
    expect(defautsMotsDouleur(["chronomètre", "erreur"], ACCROCHE_ERREUR)).toHaveLength(1);
  });

  it("e) donneesDepuisScript garde « erreur » quand le texte dit « L'erreur »", () => {
    const script = { accroche: [{ dit: ACCROCHE_ERREUR }], douleur: [], promesse: [], etapes: [], exemple: { phrases: [] }, aRetenir: [], appel: [] };
    const demande = { serie: "formation", sujet: "L'erreur des entreprises", fin: { type: "abonnement" }, reseau: "linkedin" };
    const d = donneesDepuisScript(demande as never, { script: script as never, angle: "", motsDouleur: ["erreur", "entreprises", "chronomètre"] }, undefined, TEXTE);
    expect(d.motsDouleur).toEqual(["erreur", "entreprises"]);
  });
});
