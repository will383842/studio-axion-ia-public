/**
 * EXPORT TÉLÉPROMPTEUR (18/10) — fonctions pures : texte dit seul (sans étiquettes accroche/corps/appel), paragraphes
 * courts, pauses marquées ; nom du fichier .txt ; lien et défilement de la page « Lecture » (iPad / Safari).
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import type { BlocScript } from "@/domaine/types";
import { LIBELLE_COPIER, LIBELLE_TELECHARGER, PAUSE, defilementPx, lienLecture, nomFichierTxt, texteTeleprompteur, texteDepuisLien, vitesseBornee } from "@/domaine/teleprompteur";

const seg = (id: string, texte: string) => ({ id, texte });
const BLOCS: BlocScript[] = [
  { id: "b1", blocRecette: "accroche", segments: [seg("s1", "Vous perdez deux heures par jour sur vos e-mails ?")] },
  {
    id: "b2",
    blocRecette: "corps",
    segments: [seg("s2", "Moi aussi, avant."), seg("s3", "Aujourd'hui l'IA trie ma boîte en 5 minutes."), seg("s4", "Je ne touche plus à rien."), seg("s5", "Les mails importants remontent tout seuls.")],
  },
  { id: "b3", blocRecette: "appel", segments: [seg("s6", "Abonnez-vous pour la suite.")] },
];

describe("teleprompteur · texte à copier", () => {
  const t = texteTeleprompteur(BLOCS);

  it("contient le texte dit, mot pour mot, sans étiquette de bloc", () => {
    expect(t).not.toMatch(/accroche|corps|appel/i);
    const dit = t.replaceAll(PAUSE, " ").replace(/\s+/g, " ").trim();
    expect(dit).toBe("Vous perdez deux heures par jour sur vos e-mails ? Moi aussi, avant. Aujourd'hui l'IA trie ma boîte en 5 minutes. Je ne touche plus à rien. Les mails importants remontent tout seuls. Abonnez-vous pour la suite.");
  });

  it("paragraphes courts (2 phrases au plus, séparés par une ligne vide) et pause marquée entre les blocs", () => {
    const paragraphes = t.split(/\n\s*\n/).map((p) => p.trim()).filter((p) => p && p !== PAUSE);
    expect(paragraphes.length).toBeGreaterThanOrEqual(4);
    for (const p of paragraphes) expect((p.match(/[.!?…]/g) ?? []).length).toBeLessThanOrEqual(2);
    expect(t.split(PAUSE).length - 1).toBe(2);
  });

  it("texte vide : chaîne vide, jamais d'étiquette", () => {
    expect(texteTeleprompteur([])).toBe("");
    expect(texteTeleprompteur([{ id: "x", blocRecette: "corps", segments: [seg("a", "  ")] }])).toBe("");
  });
});

describe("teleprompteur · fichier .txt, boutons et lien", () => {
  it("nom de fichier sûr, accents retirés, extension .txt", () => {
    expect(nomFichierTxt("Mes e-mails triés par l'IA !")).toBe("mes-e-mails-tries-par-l-ia.txt");
    expect(nomFichierTxt("")).toBe("texte-a-lire.txt");
  });

  it("libellés des boutons", () => {
    expect(LIBELLE_COPIER).toBe("Copier le texte");
    expect(LIBELLE_TELECHARGER).toBe("Télécharger en .txt");
  });

  it("le lien de la page Lecture porte le texte et le restitue à l'identique (accents, sauts de ligne)", () => {
    const t = texteTeleprompteur(BLOCS);
    const lien = lienLecture(t, "Mes e-mails");
    expect(lien.startsWith("/lecture#")).toBe(true);
    expect(texteDepuisLien(lien.slice(lien.indexOf("#")))).toEqual({ texte: t, titre: "Mes e-mails" });
    expect(texteDepuisLien("")).toEqual({ texte: "", titre: "" });
    expect(texteDepuisLien("#%E0%A4%A")).toEqual({ texte: "", titre: "" });
  });
});

describe("teleprompteur · défilement réglable", () => {
  it("vitesse bornée de 1 à 10, 5 par défaut", () => {
    expect(vitesseBornee(0)).toBe(1);
    expect(vitesseBornee(99)).toBe(10);
    expect(vitesseBornee(Number.NaN)).toBe(5);
    expect(vitesseBornee(7.4)).toBe(7);
  });

  it("le défilement croît avec la vitesse et avec le temps écoulé, et s'arrête à pause (dt = 0)", () => {
    expect(defilementPx(5, 1000)).toBeGreaterThan(0);
    expect(defilementPx(8, 1000)).toBeGreaterThan(defilementPx(3, 1000));
    expect(defilementPx(5, 2000)).toBeCloseTo(2 * defilementPx(5, 1000), 5);
    expect(defilementPx(5, 0)).toBe(0);
  });
});

describe("teleprompteur · écran du texte à lire et page Lecture", () => {
  const lire = (c: string) => readFileSync(join(process.cwd(), c), "utf8");

  it("l'écran du texte (face caméra seulement) offre Copier, Télécharger et Lecture", () => {
    const script = lire("src/assistant/etapes/Script.tsx");
    expect(script).toContain("LIBELLE_COPIER");
    expect(script).toContain("LIBELLE_TELECHARGER");
    expect(script).toMatch(/scriptFacultatif\(formatId\)/);
    expect(script).toContain("lienLecture");
  });

  it("la page Lecture existe : plein écran, vitesse, miroir, contraste fort", () => {
    const page = lire("src/app/(studio)/lecture/page.tsx");
    expect(page).toContain("LecturePrompteur");
    const vue = lire("src/components/tournage/LecturePrompteur.tsx");
    expect(vue).toMatch(/scaleX\(-1\)/);
    expect(vue).toContain("Miroir");
    expect(vue).toContain("Vitesse");
    expect(vue).toMatch(/bg-black/);
    expect(vue).toMatch(/text-white/);
  });
});
