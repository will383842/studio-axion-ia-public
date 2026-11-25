/**
 * QUALL-8 : l'écran et la fabrication comptent pareil (même nombre de chapitres, mêmes horodatages, carton de titre compris),
 * et un chapitre sans titre n'est jamais affiché « Chapitre N » : son titre est déduit de son texte.
 */
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import type { CommandeFabrication } from "@/domaine/types";
import { chapitresMinutes, dureeTotaleSec, PlanChapitres } from "../../src/components/formats/video-longue/PlanChapitres";
import { TexteParChapitre } from "../../src/components/formats/video-longue/TexteParChapitre";
import { lireEntreesVideoLongue } from "../../src/moteurs/montage-video-longue/entrees";
import { minuterSansVoix } from "../../src/moteurs/montage-video-longue/minutage";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: () => {} }) }));

const phrases = (n: number, tag: string) => Array.from({ length: n }, (_, i) => `Phrase ${tag} numéro ${i + 1} du texte long.`).join(" ");
const QUESTION = "Comment suivre ses stocks ?";
// Un chapitre trop court (fusionné par la fabrication) au milieu, un « Chapitre 2 » sans vrai titre.
const PLAN = [
  { id: "a", titre: "Premier", explique: "", texte: phrases(6, "a") },
  { id: "b", titre: "Chapitre 2", texte: "Court.", explique: "" },
  { id: "c", titre: "", explique: "", texte: `Le seuil minimum compte. ${phrases(6, "c")}` },
  { id: "d", titre: "Dernier", explique: "", texte: phrases(6, "d") },
];

describe("QUALL-8 : écran = fabrication", () => {
  const commande = { videoId: "v", ratios: ["16:9"], entrees: { videoLongue: { chapitres: PLAN.map(({ id, titre, texte }) => ({ id, titre, texte })), sansVoix: true, question: QUESTION } } } as unknown as CommandeFabrication;
  const fab = minuterSansVoix(lireEntreesVideoLongue(commande));

  it("mêmes chapitres, mêmes horodatages, même durée totale que la fabrication", () => {
    const ecran = chapitresMinutes(PLAN, QUESTION);
    expect(ecran.length).toBe(fab.chapitres.length);
    expect(ecran.length).toBeLessThan(PLAN.length);
    expect(ecran.map((c) => [c.debutSec, c.finSec, c.libelle])).toEqual(fab.chapitres.map((c) => [c.debutSec, c.finSec, c.libelle]));
    expect(dureeTotaleSec(PLAN, QUESTION)).toBe(fab.dureeSec);
  });
  it("sans la question, le carton de titre n'est pas compté (3 s de moins)", () => {
    expect(dureeTotaleSec(PLAN, QUESTION) - dureeTotaleSec(PLAN)).toBeGreaterThanOrEqual(2.9);
  });
  it("l'écran du plan annonce le nombre de chapitres de la fabrication", () => {
    const html = renderToStaticMarkup(createElement(PlanChapitres, { chapitres: PLAN, question: QUESTION, onChange: () => {}, onSuivant: () => {} }));
    expect(html.replace(/<[^>]+>/g, " ")).toContain(`${fab.chapitres.length} chapitres`);
  });
});

describe("QUALL-8 : jamais « Chapitre N » affiché", () => {
  it("TexteParChapitre : le titre est déduit du texte", () => {
    const html = renderToStaticMarkup(
      createElement(TexteParChapitre, { chapitres: [{ id: "x", titre: "", versions: [{ cle: "colle", phrases: ["Le seuil minimum compte. Une autre phrase."] }] }], onValiderTout: () => {} }),
    );
    const t = html.replace(/<[^>]+>/g, " ");
    expect(t).toContain("Le seuil minimum compte");
    expect(t).not.toMatch(/Chapitre \d/);
  });
});
