/** SONS-PLANCHE-ECOUTE-v19c : planche d'écoute (outil local) des sons EXISTANTS ; aucun son neuf, rien de validé par la page. */
import React from "react";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { SONS } from "../../src/briques/sons";
import { famillesDesSons, PlancheSonsExistants } from "../../outils/planche-sons-existants/PlancheSonsExistants";

type Fond = "ivoire" | "noir";
const RACINE = join(__dirname, "..", "..");
const lire = (p: string) => readFileSync(join(RACINE, p), "utf8");
const rendre = (fond: Fond = "ivoire", racine = "file:///r") => renderToStaticMarkup(<PlancheSonsExistants racine={racine} fond={fond} />);
function fichiers(dossier: string): string[] {
  return readdirSync(join(RACINE, dossier)).flatMap((n) => {
    const rel = `${dossier}/${n}`;
    if (n === "node_modules" || n.startsWith(".")) return [];
    return statSync(join(RACINE, rel)).isDirectory() ? fichiers(rel) : [rel];
  });
}
const virgule = (n: number) => String(n).replace(".", ",");

describe("planche des sons existants", () => {
  it("55 lecteurs audio, un par son, src = racine + chemin, chaque id une seule fois", () => {
    const html = rendre();
    expect(SONS).toHaveLength(55);
    expect(html.match(/<audio\b/g)).toHaveLength(55);
    for (const s of SONS) {
      expect(html).toContain(`src="file:///r/${s.chemin}"`);
      expect(html.match(new RegExp(`data-son="${s.id.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}"`, "g"))).toHaveLength(1);
    }
  });
  it("comptes d'écoute calculés depuis SONS, repris dans l'en-tête", () => {
    const html = rendre();
    const porte = SONS.filter((s) => s.ecoute === "porte-en-base").length;
    const valide = SONS.filter((s) => s.ecoute === "valide-par-decision").length;
    expect(html.match(/data-ecoute="porte-en-base"/g)).toHaveLength(porte);
    expect(html.match(/data-ecoute="valide-par-decision"/g)).toHaveLength(valide);
    expect(porte + valide).toBe(SONS.length);
    expect(html).toContain(`${SONS.length} sons existants, dont ${porte} à écouter`);
  });
  it("familles en ordre alphabétique, sons triés par id, durée à virgule", () => {
    const fam = famillesDesSons();
    const noms = fam.map((f) => f.famille);
    expect(noms).toEqual([...new Set(SONS.map((s) => s.famille))].sort((a, b) => a.localeCompare(b, "fr")));
    for (const f of fam) {
      expect(f.sons.every((s) => s.famille === f.famille)).toBe(true);
      expect(f.sons.map((s) => s.id)).toEqual([...f.sons.map((s) => s.id)].sort());
    }
    expect(fam.flatMap((f) => f.sons)).toHaveLength(55);
    const html = rendre();
    const ordre = noms.map((n) => html.indexOf(`data-famille="${n}"`));
    expect(ordre.every((i) => i >= 0)).toBe(true);
    expect(ordre).toEqual([...ordre].sort((a, b) => a - b));
    for (const s of SONS) expect(html).toContain(`${virgule(s.dureeSec)} s`);
  });
  it("chaque section ne contient que des sons de sa famille", () => {
    const html = rendre();
    const sections = html.split("<section").slice(1);
    expect(sections).toHaveLength(famillesDesSons().length);
    for (const sec of sections) {
      const fam = /data-famille="([^"]*)"/.exec(sec)![1];
      for (const m of sec.matchAll(/data-son="([^"]*)"/g)) expect(SONS.find((s) => s.id === m[1])?.famille).toBe(fam);
    }
  });
  it("déterministe, sans image ni lien, annonce « aucun son neuf », deux fonds différents", () => {
    expect(rendre("noir")).toBe(rendre("noir"));
    expect(rendre("ivoire")).not.toBe(rendre("noir"));
    const html = rendre();
    expect(html).not.toContain("<img");
    expect(html).not.toContain("href=");
    expect(html).toContain("aucun son neuf");
  });
  it("éteint = identique : 55 sons, personne dans src ni studio-rendu ne cite la planche, aucun fichier audio dans l'outil", () => {
    expect(SONS.length).toBe(55);
    for (const d of ["src", "studio-rendu"]) {
      for (const f of fichiers(d).filter((x) => /\.(ts|tsx|mts)$/.test(x))) {
        const t = lire(f);
        expect(t.includes("planche-sons-existants"), f).toBe(false);
        expect(t.includes("PlancheSonsExistants"), f).toBe(false);
      }
    }
    expect(fichiers("outils/planche-sons-existants").filter((f) => /\.(wav|mp3|ogg)$/i.test(f))).toEqual([]);
  });
  it("gardes statiques des deux fichiers", () => {
    for (const f of ["outils/planche-sons-existants/PlancheSonsExistants.tsx", "outils/planche-sons-existants/planche.mts"]) {
      const t = lire(f);
      for (const interdit of ["@/", "fournisseurs", "remotion", "fetch("]) expect(t.includes(interdit), `${f} : ${interdit}`).toBe(false);
    }
    const tsx = lire("outils/planche-sons-existants/PlancheSonsExistants.tsx");
    expect(/#[0-9a-fA-F]{3,8}\b/.test(tsx)).toBe(false);
    expect(tsx.includes("rgb(")).toBe(false);
  });
});
