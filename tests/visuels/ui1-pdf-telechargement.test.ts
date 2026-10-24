/** UI-1 : « Télécharger le PDF » télécharge au lieu d'ouvrir le PDF à la place du studio. */
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { BarreValidation, type ActionsCarrousel } from "@/components/visuels/BarreValidation";
import { nomFichierPdf } from "@/domaine/visuels/depot";
import { creerStockageR2 } from "@/fournisseurs/r2/stockage";

const CONFIG = { compte: "c", cleAcces: "AK", secret: "SK", seau: "seau", hote: "r2.exemple", env: "dev" as const };
const stockage = () => creerStockageR2(CONFIG, { maintenant: () => new Date("2026-10-23T10:00:00Z"), fetch: (async () => new Response("")) as typeof fetch });
const actions = Object.fromEntries(["valider", "refuser", "refaire", "relancer_rendu", "corbeille", "restaurer"].map((a) => [a, async () => undefined])) as unknown as ActionsCarrousel;

describe("nom du PDF téléchargé", () => {
  it("titre nettoyé : accents retirés, caractères sûrs, extension .pdf", () => {
    expect(nomFichierPdf("Se lancer dans l'IA : sans fausse route !")).toBe("Se-lancer-dans-l-IA-sans-fausse-route.pdf");
    expect(nomFichierPdf("Été à l'œuvre \"vite\"\r\n")).toBe("Ete-a-l-uvre-vite.pdf");
    expect(nomFichierPdf("   ")).toBe("carrousel.pdf");
    expect(nomFichierPdf("x".repeat(300)).length).toBeLessThanOrEqual(84);
  });
});

describe("adresse signée de téléchargement", () => {
  it("response-content-disposition=attachment; filename=\"…\" est signé dans l'adresse", async () => {
    const s = stockage();
    const url = new URL(await s.urlLectureDuree!("studio/dev/visuels/c.pdf", 600, { telechargerSous: "Mon-carrousel.pdf" }));
    expect(url.searchParams.get("response-content-disposition")).toBe('attachment; filename="Mon-carrousel.pdf"');
    expect(url.searchParams.get("X-Amz-Signature")).toBeTruthy();
  });
  it("sans option : adresse de lecture inchangée", async () => {
    const url = new URL(await stockage().urlLectureDuree!("studio/dev/visuels/c.pdf", 600));
    expect(url.searchParams.has("response-content-disposition")).toBe(false);
  });
  it("un nom piégé (guillemet, saut de ligne) ne sort pas de filename", async () => {
    const url = new URL(await stockage().urlLectureDuree!("k.pdf", 60, { telechargerSous: 'a"; x=\r\nb.pdf' }));
    expect(url.searchParams.get("response-content-disposition")).toMatch(/^attachment; filename="[A-Za-z0-9._-]+"$/);
  });
});

describe("lien de la barre d'actions", () => {
  const html = (pdfUrl: string, pdfTelechargement = false) => renderToStaticMarkup(createElement(BarreValidation, { id: "vis_a", actionsPermises: [], actions, pdfUrl, pdfTelechargement }));
  it("adresse de téléchargement : lien direct", () => {
    const h = html("https://r2.exemple/k.pdf?response-content-disposition=attachment%3B", true);
    expect(h).toContain("Télécharger le PDF");
    expect(h).not.toContain("_blank");
  });
  it("le choix vient de la vue, pas de l'adresse", () => {
    expect(html("https://r2.exemple/k.pdf?response-content-disposition=attachment%3B")).toContain("_blank");
  });
  it("adresse de lecture simple : nouvel onglet, sans fuite", () => {
    const h = html("https://r2.exemple/k.pdf?X-Amz=1");
    expect(h).toContain('target="_blank"');
    expect(h).toContain('rel="noopener"');
  });
});
