/**
 * SCRIPT PERSO, 8e tour (décision de Will : un script collé par lui est pris à l'identique, jamais bloqué ni coupé) : les
 * règles qui refusaient plus loin, APRÈS dépense, le texte DIT de Will (douleur en tête, geste fort, « fin sans
 * commentaire ») l'exemptent quand `texteDeWill` est vrai. Les mots ÉCRITS et le geste fort restent contrôlés ; les
 * textes de Claude gardent toutes leurs règles. Mémoire seulement, aucun réseau.
 */
import { describe, expect, it } from "vitest";
import { calerFicheTableau } from "../src/moteurs/montage-tableau/calage";
import { controlerFormeSortie } from "../src/moteurs/montage-tableau/controles";
import { validerFicheTableau, type FicheTableau } from "../src/moteurs/montage-tableau/fiche";
import { regleDouleurEnTete, regleGesteFortDouleur } from "../src/moteurs/montage-tableau/regles";
import { contexteExemple, ficheErreurCorrigee, texteScriptDe } from "./tableau/regles/exemples";
import { contexteDe, motsReguliers } from "./tableau/reference-1/fiches";

/** Une fiche dont la douleur écrite est bien là, mais que la voix ne dit pas dans les 3 premières secondes. */
function ficheSansDouleurDite(): FicheTableau {
  const f = structuredClone(ficheErreurCorrigee);
  f.scenes[0].texteDit = "Vos outils d'IA sont lents ? Voici pourquoi.";
  return f;
}
const contexteDeFiche = (f: FicheTableau, texteDeWill?: boolean) => ({ ...contexteExemple(f), ...(texteDeWill ? { texteDeWill } : {}) });

describe("règles 10 et 17 : douleur dite au début", () => {
  it("sans texteDeWill : le texte sans douleur au début est refusé (règles 10 et 17)", () => {
    const f = ficheSansDouleurDite();
    expect(regleDouleurEnTete(f, contexteDeFiche(f)).map((m) => m.detail).join(" | ")).toContain("n'est dit dans les 3 premières secondes");
    expect(regleGesteFortDouleur(f, contexteDeFiche(f)).map((m) => m.detail).join(" | ")).toContain("n'est dit dans les 3 premières secondes");
    expect(validerFicheTableau(f, { ...contexteDeFiche(f), texteScript: texteScriptDe(f) }).ok).toBe(false);
  });
  it("avec texteDeWill : le texte dit n'est pas contrôlé, la fiche passe", () => {
    const f = ficheSansDouleurDite();
    const c = contexteDeFiche(f, true);
    expect(regleDouleurEnTete(f, c)).toEqual([]);
    expect(regleGesteFortDouleur(f, c)).toEqual([]);
    const v = validerFicheTableau(f, { ...c, texteScript: texteScriptDe(f) });
    expect(v.ok ? [] : v.problemes.map((p) => p.message)).toEqual([]);
  });
  it("avec texteDeWill : les mots ÉCRITS et le geste fort restent exigés", () => {
    const f = ficheSansDouleurDite();
    f.douleur = "Une toute autre douleur sans rapport.";
    const c = { ...contexteDeFiche(f, true), motsDouleur: ["zébulon"] };
    expect(regleDouleurEnTete(f, c).map((m) => m.detail).join(" | ")).toContain("n'est écrit dans la première scène");
    expect(regleGesteFortDouleur(f, c).map((m) => m.detail).join(" | ")).toContain("aucun geste fort");
  });
  it("le calage (après la voix) ne lève pas d'erreur sur ce texte de Will", () => {
    const f = ficheSansDouleurDite();
    const mots = motsReguliers(f);
    const c = { ...contexteDe(f), ...contexteDeFiche(f, true), texteScript: texteScriptDe(f) };
    const r = calerFicheTableau(f, mots, { contexte: c, dureeSec: mots.at(-1)!.finSec + 0.5 });
    expect(r.ok ? [] : r.problemes).toEqual([]);
    const sans = calerFicheTableau(f, mots, { contexte: { ...c, texteDeWill: undefined }, dureeSec: mots.at(-1)!.finSec + 0.5 });
    expect(sans.ok).toBe(false);
  });
});

describe("« fin sans commentaire » (TikTok, Shorts, LinkedIn)", () => {
  const dit = (): FicheTableau => {
    const f = structuredClone(ficheErreurCorrigee);
    f.scenes[1].texteDit = `${f.scenes[1].texteDit} Laissez un commentaire si vous voulez en discuter.`;
    return f;
  };
  it("sans texteDeWill : un « commentez » dit est bloqué", () => {
    const f = dit();
    expect(controlerFormeSortie(f, contexteDeFiche(f), { sansCommentaire: true }).map((l) => l.libelle)).toEqual(["Règle « fin sans commentaire »"]);
  });
  it("avec texteDeWill : le texte dit passe (le texte écrit reste contrôlé)", () => {
    const f = dit();
    expect(controlerFormeSortie(f, contexteDeFiche(f, true), { sansCommentaire: true })).toEqual([]);
    const ecrit = structuredClone(f);
    const ligne = ecrit.scenes[1].elements.find((e) => e.type === "ligne") as { texte: string };
    ligne.texte = "Écrivez DEVIS en commentaire";
    expect(controlerFormeSortie(ecrit, contexteDeFiche(ecrit, true), { sansCommentaire: true }).length).toBeGreaterThan(0);
  });
});
