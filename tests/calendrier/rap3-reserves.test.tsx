/** RAP-3 · réserves de relecture : message du refus « trop tôt » affiché tel quel ; vignette en échec = case de même taille. Sans DOM (crochets factices). */
import type { ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("react", async (o) => ({ ...(await o<typeof import("react")>()), ...(await import("../aides/crochets-factices")).crochets }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
const relire = vi.fn(async (): Promise<{ ok: true; donnees: { lues: number; changees: number } } | { ok: false; message: string }> => ({ ok: false, message: "Le diffuseur vient d'être relu : réessayez dans une minute." }));
vi.mock("@/app/(studio)/calendrier/actions/relire-diffuseur", () => ({ relireDiffuseurAction: () => relire() }));

const { monter, trouver, texteDe, attendre } = await import("../aides/crochets-factices");
const { BoutonRelireDiffuseur } = await import("@/components/calendrier/BoutonRelireDiffuseur");
const { VignetteDiffuseur } = await import("@/components/calendrier/VignetteDiffuseur");
const lisible = (el: unknown) => renderToStaticMarkup(el as ReactElement).replace(/<[^>]*>/g, " ").replace(/&#x27;/g, "'");

describe("RAP-3 · « Relire le diffuseur » : le message de l'action", () => {
  it("refus « trop tôt » : la phrase rendue par l'action est affichée, pas une panne générique", async () => {
    const m = monter(BoutonRelireDiffuseur, {});
    const clic = trouver(m.rendre() as never, (x) => typeof x.props.onClick === "function")[0].props.onClick as () => Promise<void>;
    await clic();
    await attendre();
    const t = lisible(m.rendre());
    expect(t).toContain("réessayez dans une minute");
    expect(t).not.toContain("n'a pas pu être faite");
  });
  it("exception levée : message générique", async () => {
    relire.mockRejectedValueOnce(new Error("réseau"));
    const m = monter(BoutonRelireDiffuseur, {});
    await (trouver(m.rendre() as never, (x) => typeof x.props.onClick === "function")[0].props.onClick as () => Promise<void>)();
    await attendre();
    expect(lisible(m.rendre())).toContain("n'a pas pu être faite");
  });
});

describe("RAP-3 · vignette : l'image échoue", () => {
  it("l'image disparaît mais une case de même taille reste (aucun décalage), sans icône cassée", () => {
    const m = monter(VignetteDiffuseur, { src: "/api/calendrier/miniature/x", alt: "Image", taille: 40 });
    const img = trouver(m.rendre() as never, (x) => x.type === "img")[0];
    (img.props.onError as () => void)();
    const apres = m.rendre() as ReactElement<Record<string, unknown>>;
    expect(trouver(apres as never, (x) => x.type === "img")).toHaveLength(0);
    expect(apres).not.toBeNull();
    expect(apres.props.style).toMatchObject({ width: 40, height: 40 });
    expect(apres.props["aria-hidden"]).toBe(true);
    void texteDe;
  });
});
