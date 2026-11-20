/** RAP-3 · bandeau d'écart du calendrier : visible seulement si l'écart est non nul ou non vérifié. */
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { BandeauEcartDiffuseur, etatBandeauEcart } from "@/components/calendrier/BandeauEcartDiffuseur";

vi.mock("@/app/(studio)/calendrier/actions/relire-diffuseur", () => ({ relireDiffuseurAction: vi.fn() }));
vi.mock("@/app/(studio)/calendrier/actions/retirer-introuvables", () => ({ retirerIntrouvablesAction: vi.fn() }));
const NOW = Date.parse("2026-11-20T10:30:00.000Z");
const ecart = (o: object) => ({ luLe: "2026-11-20T10:20:00.000Z", verifie: true, chezDiffuseur: 77, absents: 0, exemples: [], ...o });
const html = (e: unknown) => renderToStaticMarkup(<BandeauEcartDiffuseur ecart={e as never} maintenant={NOW} />).replace(/&#x27;/g, "'");

describe("RAP-3 · bandeau d'écart", () => {
  it("absents:3 → phrase avec 3 et bouton « Relire le diffuseur »", () => {
    const h = html(ecart({ absents: 3 }));
    expect(h).toContain("3 publications du diffuseur ne sont pas encore au calendrier");
    expect(h).toContain("Relire le diffuseur");
    expect(h).toContain('role="status"');
    expect(h).toMatch(/min-h-11/);
  });
  it("absents:1 → singulier", () => expect(html(ecart({ absents: 1 }))).toContain("1 publication du diffuseur n'est pas encore au calendrier"));
  it("verifie:false → « non vérifié »", () => {
    const h = html(ecart({ verifie: false }));
    expect(h).toContain("pas pu être vérifié");
    expect(h).toContain("Relire le diffuseur");
  });
  it("lecture de plus d'une heure → non vérifié", () => expect(etatBandeauEcart(ecart({ luLe: "2026-11-20T09:00:00.000Z" }) as never, NOW)).toBe("non-verifie"));
  it("écart nul, récent, vérifié → aucun bandeau ; mesure absente → aucun bandeau", () => {
    expect(html(ecart({}))).toBe("");
    expect(html(null)).toBe("");
    expect(etatBandeauEcart(ecart({}) as never, NOW)).toBe("aucun");
  });
  it("jamais de nom de l'ancien outil, ni de texte de post", () => {
    expect(html(ecart({ absents: 2, exemples: [{ postId6: "abc123", reseau: "instagram", jourParis: "2026-11-25", raison: "absent" }] }))).not.toMatch(/buffer/i);
  });
});

const ids = (n: number) => Array.from({ length: n }, (_, i) => `zr_${i}`);
describe("RAP-3 finitions · rapatriées introuvables", () => {
  it("introuvables (affichées) et retirables (bouton) comptés séparément ; pluriel / singulier", () => {
    const h = html(ecart({ introuvables: 77, retirables: ids(40) }));
    expect(h).toContain("77 publications du calendrier introuvables chez le diffuseur, dont 40 retirables");
    expect(h).toContain("Retirer du calendrier les 40 retirables");
    expect(h).toContain("Relire le diffuseur");
    const un = html(ecart({ introuvables: 1, retirables: ids(1) }));
    expect(un).toContain("1 publication du calendrier introuvable chez le diffuseur, dont 1 retirable");
    expect(un).toContain("Retirer du calendrier la retirable");
  });
  it("introuvables sans retirable : phrase, mais aucun bouton de retrait", () => {
    const h = html(ecart({ introuvables: 4, retirables: [] }));
    expect(h).toContain("4 publications du calendrier introuvables");
    expect(h).not.toContain("Retirer du calendrier");
  });
  it("état « non vérifié » (échec, ou plus d'une heure) : jamais de bouton de retrait, même avec des retirables", () => {
    expect(html(ecart({ verifie: false, introuvables: 2, retirables: ids(2) }))).not.toContain("Retirer du calendrier");
    expect(html(ecart({ luLe: "2026-11-20T08:00:00.000Z", introuvables: 2, retirables: ids(2) }))).not.toContain("Retirer du calendrier");
    expect(html(ecart({ verifie: false, introuvables: 2, retirables: ids(2) }))).toContain("2 publications du calendrier introuvables");
  });
  it("écart « absents » en même temps : pas d'état « introuvables », pas de bouton", () => {
    const h = html(ecart({ absents: 3, introuvables: 2, retirables: ids(2) }));
    expect(h).toContain("3 publications du diffuseur ne sont pas encore au calendrier");
    expect(h).not.toContain("Retirer du calendrier");
  });
  it("jamais mesuré : le dire, pas de bouton de retrait", () => {
    const h = html({ luLe: "", verifie: false, jamaisMesuree: true, chezDiffuseur: 0, absents: 0, exemples: [], introuvables: 2, retirables: ids(2) });
    expect(h).toContain("jamais été mesuré");
    expect(h).not.toContain("Retirer du calendrier");
    expect(h).not.toContain("pas pu être vérifié");
  });
  it("0 introuvable : pas de bouton de retrait", () => expect(html(ecart({ absents: 3, introuvables: 0 }))).not.toContain("introuvable"));
});
