/**
 * NEW-ARG-01f · aucun montant à l'écran dans les six écrans du tableau animé. Rendu serveur (pas de jsdom) pour l'historique ;
 * pour les phrases du serveur posées en état (rendues après un clic), garde sur le source : tout texte du serveur affiché
 * passe par `messageSansMontant` (aide de NEW-ARG-01). Les coûts restent enregistrés et reçus : seul l'affichage change.
 */
import { readFileSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: () => undefined }) }));
vi.mock("@/app/(studio)/videos/actions-tableau-tracabilite", () => ({ noterPublicationAction: vi.fn(), telechargerHistoriqueAction: vi.fn() }));

const { HistoriqueTableau } = await import("@/components/formats/tableau-anime/HistoriqueTableau");
const { messageSansMontant } = await import("@/components/ui/ConfirmationPrix");

const texte = (html: string) => html.replace(/<[^>]*>/g, " ").replace(/&#x27;/g, "'").replace(/\s+/g, " ").trim();
const SANS_ARGENT = /€|\$|euros?\b|dollars?\b|\bUSD\b|\bEUR\b|\d\s*cents?\b/i;
const DOSSIER = "src/components/formats/tableau-anime/";

describe("HistoriqueTableau", () => {
  it("une phrase de l'historique qui porte un prix s'affiche sans montant", () => {
    const vue = {
      lignes: [
        { id: "1", phrase: "Voix lue : 1,20 € payés", date: "2026-11-01T10:00:00Z" },
        { id: "2", phrase: "Coût total : 3.40 euros", date: "2026-11-01T11:00:00Z" },
      ],
      reseaux: [],
    };
    const t = texte(renderToStaticMarkup(createElement(HistoriqueTableau, { videoId: "v1", vue: vue as never })));
    expect(t).not.toMatch(SANS_ARGENT);
    expect(t).not.toMatch(/1,20|3\.40/);
  });
});

describe("textes du serveur dans les six écrans", () => {
  it("messageSansMontant retire le prix d'une phrase", () => {
    expect(messageSansMontant("La voix coûte environ 0,80 € de plus.")).not.toMatch(SANS_ARGENT);
  });
  const GARDES: [string, RegExp[]][] = [
    ["EcrireScriptTableau.tsx", [/\{messageSansMontant\(phrase\)\}/, /messageSansMontant\(refusSujet\.refus\.phrase\)/, /Remarque : \{messageSansMontant\(d\.message\)\}/]],
    ["NouvelleVideoTableau.tsx", [/\{messageSansMontant\(phrase\)\}/, /messageSansMontant\(refusSujet\.refus\.phrase\)/, /\{messageSansMontant\(x\)\}/]],
    ["RetouchesTableau.tsx", [/\{messageSansMontant\(refus\)\}/]],
    ["SuiviTableau.tsx", [/\{messageSansMontant\(phrase\)\}/, /notifier\.succes\(messageSansMontant\(r\.donnees\.phrase\)\)/, /notifier\.erreur\(messageSansMontant\(r\.message\)\)/]],
    ["SuiviTacheTableau.tsx", [/\{messageSansMontant\(phrase\)\}/]],
    ["HistoriqueTableau.tsx", [/\{messageSansMontant\(l\.phrase\)\}/, /notifier\.erreur\(messageSansMontant\(r\.message\)\)/]],
  ];
  it.each(GARDES)("%s : chaque texte du serveur passe par messageSansMontant", (fichier, motifs) => {
    const source = readFileSync(DOSSIER + fichier, "utf8");
    for (const m of motifs) expect(source).toMatch(m);
  });
  it.each(GARDES.map(([f]) => f))("%s : aucun symbole d'argent écrit dans le source", (fichier) => {
    expect(readFileSync(DOSSIER + fichier, "utf8")).not.toMatch(/[€$]\s*\d|\d\s*[€]/);
  });
});
