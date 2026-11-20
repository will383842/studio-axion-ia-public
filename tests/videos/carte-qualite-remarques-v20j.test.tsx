/**
 * S-13-c-v20j : la carte Qualité dit « Prête, avec remarques » et liste les remarques de livraison en tête, sans le
 * préfixe technique. Sans remarque : rendu identique à celui d'avant (chaînes figées).
 */
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { CarteQualite } from "../../src/components/videos/CarteQualite";
import { alerteRemarque, PREFIXE_REMARQUE_LIVRAISON } from "../../src/domaine/livraison-avec-remarques";
import type { NoteQualite } from "../../src/domaine/types";

const rendu = (note: NoteQualite) => renderToStaticMarkup(createElement(CarteQualite, { note }));
const occurrences = (s: string, sous: string) => s.split(sous).length - 1;

const ATTENTION = { code: "rythme" as const, gravite: "attention" as const, message: "Plan long à 12 s." };
const BLOQUANT_SANS_PREFIXE = { code: "defaut-visuel" as const, gravite: "bloquant" as const, message: "Texte coupé à droite." };

describe("(a) sans remarque : rendu identique à master", () => {
  const AVANT: string[] = ["<section aria-label=\"Qualité\" class=\"rounded-carte border border-trait bg-surface-1 p-4\"><div class=\"flex items-center gap-4\"><div class=\"relative size-[72px] shrink-0\"><svg viewBox=\"0 0 72 72\" class=\"size-full -rotate-90\" aria-hidden=\"true\"><circle cx=\"36\" cy=\"36\" r=\"30\" class=\"fill-none stroke-surface-3\" stroke-width=\"7\"></circle><circle cx=\"36\" cy=\"36\" r=\"30\" class=\"fill-none stroke-current text-sauge\" stroke-width=\"7\" stroke-linecap=\"round\" stroke-dasharray=\"188.49555921538757\" stroke-dashoffset=\"18.84955592153875\"></circle></svg><span class=\"absolute inset-0 grid place-items-center\"><span class=\"font-titre text-xl tabular-nums leading-none text-texte\">90</span></span></div><div class=\"min-w-0 flex-1\"><p class=\"text-sm font-semibold text-texte\">Qualité</p><p class=\"text-xs text-texte-faible\">Estimation</p></div></div></section>", "<section aria-label=\"Qualité\" class=\"rounded-carte border border-trait bg-surface-1 p-4\"><div class=\"flex items-center gap-4\"><div class=\"relative size-[72px] shrink-0\"><svg viewBox=\"0 0 72 72\" class=\"size-full -rotate-90\" aria-hidden=\"true\"><circle cx=\"36\" cy=\"36\" r=\"30\" class=\"fill-none stroke-surface-3\" stroke-width=\"7\"></circle><circle cx=\"36\" cy=\"36\" r=\"30\" class=\"fill-none stroke-current text-ambre\" stroke-width=\"7\" stroke-linecap=\"round\" stroke-dasharray=\"188.49555921538757\" stroke-dashoffset=\"37.6991118430775\"></circle></svg><span class=\"absolute inset-0 grid place-items-center\"><span class=\"font-titre text-xl tabular-nums leading-none text-texte\">80</span></span></div><div class=\"min-w-0 flex-1\"><p class=\"text-sm font-semibold text-texte\">Qualité</p><p class=\"text-xs text-texte-faible\">Estimation</p></div></div><ul class=\"mt-4 space-y-1.5 border-t border-trait pt-3\"><li class=\"flex items-start gap-2 text-sm\"><svg xmlns=\"http://www.w3.org/2000/svg\" width=\"16\" height=\"16\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.9\" stroke-linecap=\"round\" stroke-linejoin=\"round\" class=\"lucide lucide-circle-alert lucide-alert-circle mt-0.5 shrink-0 text-ambre\" aria-hidden=\"true\"><circle cx=\"12\" cy=\"12\" r=\"10\"></circle><line x1=\"12\" x2=\"12\" y1=\"8\" y2=\"12\"></line><line x1=\"12\" x2=\"12.01\" y1=\"16\" y2=\"16\"></line></svg><span class=\"text-texte-doux\">Plan long à 12 s.</span></li></ul></section>", "<section aria-label=\"Qualité\" class=\"rounded-carte border border-trait bg-surface-1 p-4\"><div class=\"flex items-center gap-4\"><div class=\"relative size-[72px] shrink-0\"><svg viewBox=\"0 0 72 72\" class=\"size-full -rotate-90\" aria-hidden=\"true\"><circle cx=\"36\" cy=\"36\" r=\"30\" class=\"fill-none stroke-surface-3\" stroke-width=\"7\"></circle><circle cx=\"36\" cy=\"36\" r=\"30\" class=\"fill-none stroke-current text-brique\" stroke-width=\"7\" stroke-linecap=\"round\" stroke-dasharray=\"188.49555921538757\" stroke-dashoffset=\"75.39822368615503\"></circle></svg><span class=\"absolute inset-0 grid place-items-center\"><span class=\"font-titre text-xl tabular-nums leading-none text-texte\">60</span></span></div><div class=\"min-w-0 flex-1\"><p class=\"text-sm font-semibold text-texte\">Qualité</p><p class=\"text-xs text-texte-faible\">Estimation</p></div></div><ul class=\"mt-4 space-y-1.5 border-t border-trait pt-3\"><li class=\"flex items-start gap-2 text-sm\"><svg xmlns=\"http://www.w3.org/2000/svg\" width=\"16\" height=\"16\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.9\" stroke-linecap=\"round\" stroke-linejoin=\"round\" class=\"lucide lucide-circle-alert lucide-alert-circle mt-0.5 shrink-0 text-brique\" aria-hidden=\"true\"><circle cx=\"12\" cy=\"12\" r=\"10\"></circle><line x1=\"12\" x2=\"12\" y1=\"8\" y2=\"12\"></line><line x1=\"12\" x2=\"12.01\" y1=\"16\" y2=\"16\"></line></svg><span class=\"text-texte-doux\">Texte coupé à droite.</span></li></ul></section>"];
  it("aucune alerte, une alerte « attention », une alerte « bloquant » sans préfixe", () => {
    const cas: NoteQualite[] = [{ globale: 90, alertes: [] }, { globale: 80, alertes: [ATTENTION] }, { globale: 60, alertes: [BLOQUANT_SANS_PREFIXE] }];
    expect(cas.map(rendu)).toEqual(AVANT);
  });
  it("aucun bloc de remarques", () => {
    expect(rendu({ globale: 80, alertes: [ATTENTION] })).not.toContain("Prête, avec remarques");
  });
});

describe("(b) une remarque et une alerte « attention »", () => {
  const html = rendu({ globale: 70, alertes: [alerteRemarque("Variété", "Même structure que la vidéo d'hier."), ATTENTION] });
  it("titre, texte sans préfixe, une seule fois", () => {
    expect(html).toContain("Prête, avec remarques");
    expect(html).toContain("La vidéo est livrée. Regardez ces points avant de la publier.");
    expect(html).toContain("Variété : Même structure que la vidéo d&#x27;hier");
    expect(html).not.toContain(PREFIXE_REMARQUE_LIVRAISON);
    expect(occurrences(html, "Même structure")).toBe(1);
    expect(html).toContain('role="status"');
    expect(html).toContain("Plan long à 12 s.");
  });
  it("le bloc est en tête, avant les autres alertes", () => {
    expect(html.indexOf("Prête, avec remarques")).toBeLessThan(html.indexOf("Plan long à 12 s."));
  });
});

describe("(c) deux remarques", () => {
  it("deux éléments de liste dans le bloc, dans l'ordre ; plus de liste générale s'il ne reste rien", () => {
    const html = rendu({ globale: 60, alertes: [alerteRemarque("Variété", "Une."), alerteRemarque("Déjà-vu", "Deux.")] });
    expect(html.match(/<li[ >]/g)).toHaveLength(2);
    expect(html.indexOf("Variété : Une")).toBeLessThan(html.indexOf("Déjà-vu : Deux"));
  });
});

describe("(d) garde des anciennes sous-notes", () => {
  it("ni « Sous-titres », ni « Lèvres », ni « Réalisme »", () => {
    const html = rendu({ globale: 70, alertes: [alerteRemarque("Variété", "Raison.")] });
    for (const mot of ["Sous-titres", "Lèvres", "Réalisme"]) expect(html).not.toContain(mot);
  });
});
