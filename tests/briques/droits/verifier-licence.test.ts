import { readFileSync, readdirSync } from "node:fs";
import { describe, it, expect } from "vitest";
import { reconnaitre } from "../../../outils/licences/verifier-licence.mjs";

const MIT = "Permission is hereby granted, free of charge, to any person obtaining a copy of this software";
const ISC = "Permission to use, copy, modify, and/or distribute this software for any purpose with or without fee is hereby granted";
const APACHE =
  "Apache License\nVersion 2.0, January 2004\n... You must retain all copyright, patent, trademark, and attribution notices from the Source form ...";
const CC0 = "CC0 1.0 Universal\nStatement of Purpose";
const UNLICENSE = "This is free and unencumbered software released into the public domain.";
const OFL = "SIL Open Font License, Version 1.1";
const CC_BY = "Creative Commons Attribution 4.0 International Public License. Attribution is required.";
const GPL = "GNU General Public License\nVersion 3, 29 June 2007";
const MIXTE = `Font Awesome Free License
Icons: CC BY 4.0 License. Attribution is required.
Fonts: SIL OFL 1.1
Code: MIT License. ${MIT}`;

describe("verifier-licence : reconnaître", () => {
  it.each([
    ["MIT", MIT, "MIT"],
    ["ISC", ISC, "ISC"],
    ["Apache-2.0 (avec « attribution notices »)", APACHE, "Apache-2.0"],
    ["CC0", CC0, "CC0-1.0"],
    ["Unlicense", UNLICENSE, "Unlicense"],
    ["OFL", OFL, "OFL-1.1"],
  ])("admet %s", (_n, texte, attendu) => {
    expect(reconnaitre(texte)).toBe(attendu);
  });

  it.each([
    ["CC-BY-4.0", CC_BY],
    ["GPL-3.0", GPL],
    ["cas mixte MIT + CC BY", MIXTE],
    ["licence multiple MIT + ISC", `${MIT}\n${ISC}`],
    ["texte inconnu", "Tous droits réservés."],
  ])("refuse %s", (_n, texte) => {
    expect(reconnaitre(texte)).toBeNull();
  });
});

describe("verifier-licence : vrais fichiers du dépôt (lecture seule)", () => {
  const lire = (p: string) => readFileSync(p, "utf8");
  it.each([
    ["src/briques/sous-titres/polices/OFL-Manrope.txt", "OFL-1.1"],
    ["studio-rendu/compositions/interface-claire/sons/LICENCE-Kenney-CC0.txt", "CC0-1.0"],
    ["studio-rendu/compositions/commune/polices/LICENCE-PermanentMarker-Apache-2.0.txt", "Apache-2.0"],
    ["studio-rendu/compositions/visuels/icones/LICENCE-Lucide-ISC.txt", null],
  ])("%s -> %s", (chemin, attendu) => {
    expect(reconnaitre(lire(chemin))).toBe(attendu);
  });

  it("ISC coupé sur deux lignes", () => {
    expect(reconnaitre("Permission to use, copy, modify, and/or distribute this software for any\npurpose with or without fee is hereby granted")).toBe("ISC");
  });
  it("tous les OFL-*.txt du dépôt sont reconnus", () => {
    const dossier = "studio-rendu/compositions/commune/polices";
    const fichiers = readdirSync(dossier).filter((f) => /^OFL-.*\.txt$/.test(f));
    expect(fichiers.length).toBeGreaterThan(5);
    for (const f of fichiers) expect(reconnaitre(lire(`${dossier}/${f}`))).toBe("OFL-1.1");
  });
});
