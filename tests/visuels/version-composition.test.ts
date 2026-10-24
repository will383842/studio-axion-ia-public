/**
 * ART-1, tour 2 : mise en ligne simultanée du studio et de studio-rendu. Le spec VALIDÉ porte la version de la composition des pages
 * (`composition`) : elle entre dans l'empreinte du rendu, et un studio-rendu plus ANCIEN (schéma strict, qui ne connaît pas la clé) ou d'une
 * autre version REFUSE le rendu — jamais un rendu de l'ancienne composition rangé sous la nouvelle version.
 */
import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { CarrouselSpec } from "@/domaine/visuels/schema";
import { validerProprietesPage, VERSION_COMPOSITION } from "@/visuels/proprietes-page";
import { empreinteCarrousel, VERSION_RENDU } from "@/visuels/services/rendu";
import { CONTENU_ESSAI } from "../../studio-rendu/scripts/contenu-essai-visuel";

describe("version de la composition dans le spec validé", () => {
  it("VERSION_RENDU (empreinte du studio) est la version de la composition de studio-rendu, visuel-page/8 (ART-1, puis finitions de la PR n° 5)", () => {
    expect(VERSION_COMPOSITION).toBe("visuel-page/8");
    expect(VERSION_RENDU).toBe(VERSION_COMPOSITION);
  });
  it("le spec validé porte la version de la composition (studio) ; revalidé par studio-rendu, il est accepté tel quel", () => {
    const { spec } = validerProprietesPage({ spec: CONTENU_ESSAI, index: 0 });
    expect(spec.composition).toBe(VERSION_COMPOSITION);
    expect(validerProprietesPage({ spec, index: 0 }).spec).toEqual(spec);
  });
  it("ROUGE : un studio-rendu plus ancien (schéma strict sans la clé) refuse le spec envoyé par le nouveau studio", () => {
    const { spec } = validerProprietesPage({ spec: CONTENU_ESSAI, index: 0 });
    expect(CarrouselSpec.safeParse(spec).success).toBe(false);
  });
  it("une autre version de composition est refusée, avec un message clair", () => {
    expect(() => validerProprietesPage({ spec: { ...CONTENU_ESSAI, composition: "visuel-page/7" }, index: 0 })).toThrow(/composition « visuel-page\/7 »/);
    expect(() => validerProprietesPage({ spec: { ...CONTENU_ESSAI, composition: 7 }, index: 0 })).toThrow(/composition/);
  });
  it("l'empreinte du rendu contient la version de la composition (dans le spec validé)", () => {
    const { spec } = validerProprietesPage({ spec: CONTENU_ESSAI, index: 0 });
    expect(JSON.stringify(spec)).toContain(VERSION_COMPOSITION);
    const sans = createHash("sha256").update(`${VERSION_RENDU}\n${JSON.stringify(CONTENU_ESSAI)}`).digest("hex");
    expect(empreinteCarrousel(CONTENU_ESSAI)).not.toBe(sans);
  });
});
