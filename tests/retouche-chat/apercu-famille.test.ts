import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";
import type { OperationRetouche } from "@/briques/operations";
import { PHRASES } from "@/briques/retouche-portee";
import { ApercuFamille } from "@/components/retouche-chat/ApercuFamille";
import { apercuDepuisImpact } from "@/services/retouche-segments/apercu";

const scenes: OperationRetouche[] = [{ type: "ajouter-dynamisme", intensite: "leger", sceneIds: ["s1"] }];
const voix: OperationRetouche[] = [{ type: "modifier-script", ancien: "38", nouveau: "40" }];
const rendre = (generateur: string, operations: OperationRetouche[], sc: string[], total: number) =>
  renderToStaticMarkup(createElement(ApercuFamille, { generateur, operations, impact: { scenes: sc, total } }));

describe("ApercuFamille (G13-14)", () => {
  it("scènes : « Gratuit · environ 3 min · 1 scène sur 3 » pour demo-facecam", () => {
    const html = rendre("demo-facecam", scenes, ["s1"], 3);
    expect(html).toContain("Gratuit · environ 3 min · 1 scène sur 3");
    expect(html).not.toContain("text-accent");
  });
  it("voix : « Payant : refusé. » en terracotta, sans montant", () => {
    const html = rendre("demo-facecam", voix, [], 3);
    expect(html.replaceAll("&#x27;", "'")).toContain(`Payant : refusé. ${PHRASES.voix}`);
    expect(html).toContain("text-accent");
    expect(html).not.toMatch(/€|euro/i);
  });
  it("générateur inconnu : pas de durée", () => {
    expect(rendre("inconnu", scenes, ["s1"], 3)).toContain("Gratuit · 1 scène sur 3");
  });
  it("apercuDepuisImpact : même résultat que la phrase attendue", () => {
    const a = apercuDepuisImpact({ generateur: "tutoriel-outil", operations: scenes, scenes: ["s1", "s2"], total: 7 });
    expect(a.phrase).toBe("Gratuit · environ 2 min · 2 scènes sur 7");
    expect(a.famille).toBe("gratuite");
  });
  it("Manrope seulement, aucun composant ui touché", () => {
    const src = readFileSync("src/components/retouche-chat/ApercuFamille.tsx", "utf8");
    expect(src).not.toMatch(/font-family|fontFamily|Montserrat/);
  });
});
