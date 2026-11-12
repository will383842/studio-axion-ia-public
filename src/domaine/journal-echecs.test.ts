import { describe, expect, it } from "vitest";
import { familleDe, identifiantEchec, LONGUEUR_MAX_DETAIL, nettoyerDetail } from "./journal-echecs";

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

  it("nettoyage : les clés en camelCase sont retirées", () => {
    expect(nettoyerDetail("accessToken=valeur4")).not.toContain("valeur4");
    expect(nettoyerDetail('clientSecret: "abc123"')).not.toContain("abc123");
    expect(nettoyerDetail('{"refreshToken":"xyz"}')).not.toContain("xyz");
    expect(nettoyerDetail("apiKey=k9")).not.toContain("k9");
  });

  it("nettoyage : monkey, article et cycle restent intacts", () => {
    expect(nettoyerDetail("monkey: banane")).toBe("monkey: banane");
    expect(nettoyerDetail("article: 12")).toBe("article: 12");
    expect(nettoyerDetail("cycle=3")).toBe("cycle=3");
  });

  it("nettoyage : les jetons Bearer sont retirés, seuls ou après Authorization", () => {
    expect(nettoyerDetail("Authorization: Bearer abc.def")).not.toContain("abc.def");
    expect(nettoyerDetail("Bearer abc.def")).not.toContain("abc.def");
  });
});
