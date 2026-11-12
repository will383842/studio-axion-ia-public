import { describe, expect, it } from "vitest";
import { compterEchecs, familleDe, identifiantEchec, LONGUEUR_MAX_DETAIL, nettoyerDetail, type LigneEchec } from "./journal-echecs";

describe("journal des échecs (pur)", () => {
  it("familles : chaque code tombe dans la bonne", () => {
    expect(familleDe("IV_CARTE_A_VALIDER")).toBe("attente-validation");
    expect(familleDe("IV_SCRIPT_A_VALIDER")).toBe("attente-validation");
    expect(familleDe("CAS_CONCRET_SCRIPT_A_VALIDER")).toBe("attente-validation");
    expect(familleDe("FOURNISSEUR_REFUS")).toBe("fournisseur");
    expect(familleDe("FOURNISSEUR_INDISPONIBLE")).toBe("fournisseur");
    expect(familleDe("IV_IMAGE")).toBe("entree-a-corriger");
    expect(familleDe("IV_TYPE_A_CHOISIR")).toBe("entree-a-corriger");
    expect(familleDe("BUDGET_DEPASSE")).toBe("controle");
    expect(familleDe("CLE_ABSENTE")).toBe("reglage");
    expect(familleDe("PANNE_EXPORT")).toBe("panne");
    expect(familleDe("QUELQUE_CHOSE_D_INCONNU")).toBe("autre");
  });

  it("nettoyage : un faux secret est retiré, le texte utile reste", () => {
    const faux = "sk-abcdefghijklmnop1234567890";
    const texte = `Refus du fournisseur (HTTP 401) api_key=${faux} Authorization: Bearer abcDEF1234567890xyz`;
    const net = nettoyerDetail(texte);
    expect(net).not.toContain(faux);
    expect(net).not.toContain("abcDEF1234567890xyz");
    expect(net).toContain("Refus du fournisseur (HTTP 401)");
  });

  it("nettoyage : 500 caractères au plus, vide si rien", () => {
    expect(nettoyerDetail("mot ".repeat(400)).length).toBeLessThanOrEqual(LONGUEUR_MAX_DETAIL);
    expect(nettoyerDetail(undefined)).toBe("");
    expect(nettoyerDetail("")).toBe("");
  });

  it("identifiant stable pour un même travail et un même essai", () => {
    expect(identifiantEchec("tr-1", 2)).toBe("ev-echec-tr-1-2");
    expect(identifiantEchec("tr-1", 2)).toBe(identifiantEchec("tr-1", 2));
    expect(identifiantEchec("tr-1", 3)).not.toBe(identifiantEchec("tr-1", 2));
  });

  it("nettoyage : les mots qui contiennent « cle » ou « key » ne sont pas pris pour des clés", () => {
    expect(nettoyerDetail("article: lisible, cycle=3, monkey: oui")).toBe("article: lisible, cycle=3, monkey: oui");
  });

  it("nettoyage : les vraies clés nommées sont retirées", () => {
    expect(nettoyerDetail("x-api-key: valeur1")).not.toContain("valeur1");
    expect(nettoyerDetail("access_token=valeur2 fin")).not.toContain("valeur2");
    expect(nettoyerDetail("cle=valeur3")).not.toContain("valeur3");
  });
});

const MAINTENANT = "2026-11-12T12:00:00.000Z";
function ligne(code: string, famille: LigneEchec["famille"], date = "2026-11-11T10:00:00.000Z", generateur = "avocat", etape = "montage"): LigneEchec {
  return { date, videoId: "v-1", travailId: "tr-1", generateur, moteur: "m", etape, code, famille, phrase: "p", detail: "", essai: 1 };
}

describe("compterEchecs (pur)", () => {
  it("3 contrôles + 1 fournisseur + 2 attentes : total 4, attentes 2 à part", () => {
    const lignes = [
      ligne("BUDGET_X", "controle"), ligne("BUDGET_Y", "controle"), ligne("SUJET_Z", "controle"),
      ligne("FOURNISSEUR_REFUS", "fournisseur", undefined, "podcast", "voix"),
      ligne("IV_CARTE_A_VALIDER", "attente-validation"), ligne("IV_SCRIPT_A_VALIDER", "attente-validation"),
    ];
    const b = compterEchecs(lignes, MAINTENANT);
    expect(b.jours30.total).toBe(4);
    expect(b.jours30.attentes).toBe(2);
    expect(b.jours30.parFamille).toEqual({ controle: 3, fournisseur: 1 });
    expect(b.jours30.parGenerateur).toEqual({ avocat: 3, podcast: 1 });
    expect(b.jours30.parEtape).toEqual({ montage: 3, voix: 1 });
    expect(b.jours30.parCode.FOURNISSEUR_REFUS).toBe(1);
  });

  it("7 jours et 30 jours : les anciennes lignes ne comptent qu'à 30 jours, au-delà de 30 jours nulle part", () => {
    const b = compterEchecs([ligne("A", "autre", "2026-11-05T12:00:00.000Z"), ligne("B", "autre", "2026-10-20T12:00:00.000Z"), ligne("C", "autre", "2026-09-01T12:00:00.000Z"), ligne("D", "autre", "pas une date")], MAINTENANT);
    expect(b.jours7.total).toBe(1);
    expect(b.jours30.total).toBe(2);
  });

  it("aucune ligne : tout à zéro", () => {
    const b = compterEchecs([], MAINTENANT);
    expect(b.jours30).toEqual({ total: 0, attentes: 0, parFamille: {}, parGenerateur: {}, parEtape: {}, parCode: {} });
  });
});
