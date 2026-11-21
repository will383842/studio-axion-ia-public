import { readFileSync } from "node:fs";
import { join } from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ETAT_VIDE, VueRelectureTableau, type EtatEcran } from "../../src/components/formats/tableau-de-bord/EcranRelectureTableau";

const image = { base64: "AAAA", type: "image/png" as const, largeur: 100, hauteur: 50 };
const aRelire = [
  { cle: "indicateur:a", libelle: "Visites", valeur: 120, unite: "visites" },
  { cle: "indicateur:b", libelle: "Appels", valeur: 30, unite: "appels" },
];
const rendre = (e: Partial<EtatEcran>) =>
  renderToStaticMarkup(<VueRelectureTableau etat={{ ...ETAT_VIDE, ...e }} onChoisir={() => {}} onEnvoyer={() => {}} onDecider={() => {}} onValider={() => {}} />);
const dsb = (b: string) => /\sdisabled(=|>|\s)/.test(b);
const bouton = (html: string, texte: string) => (html.match(/<button[^>]*>[^<]*<\/button>/g) ?? []).find((b) => b.includes(`>${texte}<`)) ?? "";

describe("G4-08-b2 · écran de relecture (vue)", () => {
  it("a) sans image : le bouton d'envoi est désactivé", () => {
    expect(dsb(bouton(rendre({}), "Lire la capture"))).toBe(true);
  });

  it("a) avec une image : le bouton d'envoi est actif ; pendant l'envoi : tout est désactivé", () => {
    expect(dsb(bouton(rendre({ image }), "Lire la capture"))).toBe(false);
    const html = rendre({ image, envoi: true });
    expect(dsb(bouton(html, "Lire la capture"))).toBe(true);
    expect(html).toMatch(/<input[^>]*type="file"[^>]*disabled/);
  });

  it("a) avec des chiffres à relire : une ligne par chiffre, « Valider les chiffres » désactivé tant que tout n'est pas relu", () => {
    const ouverture = { etape: "relecture" as const, brouillon: {}, aRelire };
    const html = rendre({ ouverture });
    expect(html).toContain("Visites");
    expect(html).toContain("Appels");
    expect(html).toContain("0 chiffres relus sur 2");
    expect(dsb(bouton(html, "Valider les chiffres"))).toBe(true);
    const tout = rendre({ ouverture, decisions: { "indicateur:a": { type: "valide" }, "indicateur:b": { type: "refuse" } } });
    expect(dsb(bouton(tout, "Valider les chiffres"))).toBe(false);
    const enVoi = rendre({ ouverture, envoi: true, decisions: { "indicateur:a": { type: "valide" }, "indicateur:b": { type: "valide" } } });
    expect(dsb(bouton(enVoi, "Valider les chiffres"))).toBe(true);
    for (const b of enVoi.match(/<button[^>]*>/g) ?? []) expect(dsb(b)).toBe(true);
  });

  it("a) repli : la raison et le lien d'aide, aucun chiffre ni formulaire de saisie", () => {
    const html = rendre({ ouverture: { etape: "saisie-manuelle", raison: "Éteint. Saisis à la main." } });
    expect(html).toContain("Éteint. Saisis à la main.");
    expect(html).toContain('href="/aide-chat"');
    expect(html).not.toContain("chiffres relus");
    expect(html).not.toContain('type="number"');
  });

  it("les erreurs de validation sont montrées", () => {
    expect(rendre({ erreurs: ["1 chiffre n'est pas encore relu."] })).toContain("1 chiffre n&#x27;est pas encore relu.");
  });

  it("d) garde : le fichier ne contient ni lecture-capture, ni le nom du module de relecture, ni montant en dur, ni importeur", () => {
    const source = readFileSync(join(__dirname, "..", "..", "src/components/formats/tableau-de-bord/EcranRelectureTableau.tsx"), "utf8");
    expect(source).not.toMatch(/lecture-capture/);
    expect(source).not.toMatch(/relecture-chiffres/);
    expect(source).not.toMatch(/\d+\s*(€|eur|usd|\$)/i);
    expect(source).not.toMatch(/@\/services|@\/fournisseurs|server-only/);
  });
});
