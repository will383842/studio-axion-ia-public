/**
 * Fuseaux : les dates des composants restants sont écrites à l'heure de Paris, la même côté serveur (UTC) et côté navigateur
 * (erreur d'affichage React 418). Le serveur est forcé en UTC ici pour que le test prouve le correctif sur n'importe quelle machine.
 */
process.env.TZ = "UTC";

import { readFileSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: () => undefined }) }));
vi.mock("@/app/(studio)/videos/actions-tableau-tracabilite", () => ({ noterPublicationAction: vi.fn(), telechargerHistoriqueAction: vi.fn() }));

const { HistoriqueTableau } = await import("@/components/formats/tableau-anime/HistoriqueTableau");
const { PanneauSujetCentralDejaTraite } = await import("@/components/generateur/PanneauSujetCentralDejaTraite");
const { PanneauSujetDejaTraite } = await import("@/components/formats/cas-concret/entree/PanneauSujetDejaTraite");

const INSTANT = "2026-10-18T22:56:00Z"; // 00:56 le 19 octobre à Paris

afterEach(() => vi.useRealTimers());

describe("dates à l'heure de Paris (serveur en UTC)", () => {
  it("le formulaire « Publiée sur… » propose le jour de Paris, pas celui d'UTC", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(INSTANT));
    const html = renderToStaticMarkup(createElement(HistoriqueTableau, { videoId: "v1", vue: { lignes: [], reseaux: [] } as never }));
    expect(html).toContain('value="2026-10-19"');
    expect(html).not.toContain('value="2026-10-18"');
  });

  it("Sujet central déjà traité : « le 19/10 » et non « le 18/10 »", () => {
    const refus = { precedents: [{ titre: "Sujet", le: INSTANT, lien: "/x", videoId: "v" }], suggestions: [] };
    const html = renderToStaticMarkup(createElement(PanneauSujetCentralDejaTraite, { refus: refus as never, chargement: false, onAutreSujet: () => undefined, onRefaire: () => undefined }));
    expect(html).toContain("le 19/10");
    expect(html).not.toContain("le 18/10");
  });

  it("Cas concret déjà traité : « le 19/11/2026 » pour 23:56 UTC le 18 novembre", () => {
    const dejaTraite = { phrase: "Déjà fait", jeton: "j", suggestions: [], precedents: [{ titre: "Cas", le: "2026-11-18T23:56:00Z", lien: "/x", videoId: "v" }] };
    const html = renderToStaticMarkup(createElement(PanneauSujetDejaTraite, { dejaTraite: dejaTraite as never, onChoisir: () => undefined }));
    expect(html).toContain("19/11/2026");
    expect(html).not.toContain("18/11/2026");
  });

  it("chaque formateur de date des fichiers de la fiche porte timeZone Europe/Paris (lecture du source)", () => {
    const fichiers = [
      "src/components/voix/MaVoix.tsx",
      "src/components/formats/tableau-anime/EcrireScriptTableau.tsx",
      "src/components/formats/tableau-anime/NouvelleVideoTableau.tsx",
      "src/components/formats/facecam-animee/DepotPrise.tsx",
      "src/components/formats/cas-concret/entree/PanneauSujetDejaTraite.tsx",
      "src/components/generateur/PanneauSujetCentralDejaTraite.tsx",
      "src/components/generateur/EcranSujet.tsx",
      "src/components/formats/tableau-anime/HistoriqueTableau.tsx",
    ];
    for (const f of fichiers) {
      const source = readFileSync(f, "utf8");
      const appels = source.match(/(toLocale(Date|Time)?String|formateurDate|new Intl\.DateTimeFormat)\([^\n]*/g) ?? [];
      expect(appels.length, f).toBeGreaterThan(0);
      for (const a of appels) expect(a, `${f} : ${a}`).toContain('timeZone: "Europe/Paris"');
      expect(source, f).not.toContain("toISOString().slice");
    }
  });
});
