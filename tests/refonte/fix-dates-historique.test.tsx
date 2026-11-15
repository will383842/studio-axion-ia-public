/**
 * Correctif de l'erreur d'affichage React n° 418 sur la fiche d'une vidéo « L'erreur corrigée » : les dates de l'historique
 * étaient écrites à l'heure du serveur (UTC) puis réécrites à l'heure du navigateur. Elles sont maintenant à l'heure de Paris,
 * la même des deux côtés.
 */
// Le serveur de la CI est en UTC : on le force ici pour que le test prouve le correctif sur n'importe quelle machine.
process.env.TZ = "UTC";

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: () => undefined }) }));
vi.mock("@/app/(studio)/videos/actions-tableau-tracabilite", () => ({ noterPublicationAction: vi.fn(), telechargerHistoriqueAction: vi.fn() }));

const { HistoriqueTableau } = await import("@/components/formats/tableau-anime/HistoriqueTableau");
const { dateRecent } = await import("@/components/creation/RecentsGenerateur");

describe("HistoriqueTableau : dates à l'heure de Paris", () => {
  it("22:56 UTC le 18 octobre s'écrit 00:56 le 19 octobre (Paris), quel que soit le fuseau du serveur", () => {
    const vue = { lignes: [{ id: "1", phrase: "Script d'origine", date: "2026-10-18T22:56:00Z" }], reseaux: [] };
    const html = renderToStaticMarkup(createElement(HistoriqueTableau, { videoId: "v1", vue: vue as never }));
    expect(html).toContain("19 octobre 2026 · 00:56");
    expect(html).not.toContain("18 octobre 2026 · 22:56");
  });

  it("les récents du générateur sont aussi à l'heure de Paris (même fuseau serveur et navigateur)", () => {
    expect(dateRecent("2026-10-18T22:56:00Z")).toContain("00:56");
    expect(dateRecent("2026-10-18T22:56:00Z")).toMatch(/19 oct/);
  });
});
