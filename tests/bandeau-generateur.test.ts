/**
 * Bandeau du générateur en haut des pages de suivi d'une vidéo : nom court du registre, « Essai », lien vers la création.
 * Aucun appel réel ; le composant est rendu en HTML statique.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { BandeauGenerateur } from "@/components/videos/BandeauGenerateur";
import { adresseCreationFormat, formatEnEssai, listerFormats, nomCourtFormat } from "@/formats";

const rendre = (formatId: string | null | undefined) => renderToStaticMarkup(createElement(BandeauGenerateur, { formatId }));

describe("BandeauGenerateur", () => {
  it.each(listerFormats({ inclureMasques: true, inclureReservesAWill: true }).map((f) => [f.id] as const))(
    "%s : nom court, lien de création, « Essai » selon le registre",
    (id) => {
      const f = listerFormats({ inclureMasques: true, inclureReservesAWill: true }).find((x) => x.id === id)!;
      const html = rendre(id);
      expect(html).toContain(nomCourtFormat(f));
      expect(html).toContain(`href="${adresseCreationFormat(f)}"`);
      expect(html.includes("Essai")).toBe(formatEnEssai(f));
    },
  );

  it("format inconnu, vide ou absent : rien n'est affiché", () => {
    expect(rendre("format-qui-n-existe-pas")).toBe("");
    expect(rendre("")).toBe("");
    expect(rendre(null)).toBe("");
    expect(rendre(undefined)).toBe("");
  });

  it("le texte du lien reste lisible tel quel (pas d'aria-label qui masque « Essai »)", () => {
    expect(rendre("avocat")).not.toContain("aria-label");
  });

  it("réserve sa hauteur (pas de décalage de mise en page)", () => {
    expect(rendre("avocat")).toMatch(/min-h-/);
  });
});

describe("garde : chaque page de suivi d'une vidéo porte le bandeau", () => {
  const PAGES = [
    "src/app/(studio)/videos/[id]/page.tsx",
    "src/app/(studio)/image-video/[videoId]/page.tsx",
    "src/app/(studio)/image-video/lot/[lotId]/page.tsx",
  ];
  it.each(PAGES)("%s", (p) => {
    const src = readFileSync(join(process.cwd(), p), "utf8");
    expect(src).toContain("BandeauGenerateur");
    expect(src).toMatch(/<BandeauGenerateur\b/);
  });
});

describe("fiche /videos/[id] : un seul nom de générateur, en haut", () => {
  const lire = (p: string) => readFileSync(join(process.cwd(), p), "utf8");
  it("l'en-tête de la fiche ne répète plus la pastille du format", () => {
    expect(lire("src/components/videos/EnTeteVideo.tsx")).not.toMatch(/<Pastille icone=\{format\.icone\}>/);
  });
  it("une seule mention du générateur sur la fiche (un seul bandeau, aucun lien /formats/ dans l'en-tête)", () => {
    expect(lire("src/app/(studio)/videos/[id]/page.tsx").match(/<BandeauGenerateur\b/g)).toHaveLength(1);
    expect(lire("src/components/videos/EnTeteVideo.tsx")).not.toContain("/formats/");
  });
  it("le bandeau est placé avant la grille (lecteur), à côté de « Mes vidéos »", () => {
    const src = lire("src/app/(studio)/videos/[id]/page.tsx");
    expect(src.indexOf("<BandeauGenerateur")).toBeGreaterThan(-1);
    expect(src.indexOf("<BandeauGenerateur")).toBeLessThan(src.indexOf("lg:grid-cols-[minmax(0,420px)"));
  });
});
