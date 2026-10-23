/**
 * CORRECTEUR 3 · B6 et B13 (audit B, 03/10).
 *  - B6 : « Importer un fichier » à côté de « Coller » : .txt et .md lus dans le navigateur, .docx et .pdf lus par le
 *    serveur ; 5 Mo au plus ; tout autre fichier refusé avec une phrase claire. Le texte suit ensuite le même découpage
 *    que le coller (aucun mot réécrit).
 *  - B13 : un texte de moins de 3 mots n'est plus ignoré en silence : « Ce texte est trop court. »
 * Fichiers d'essai : tests/fixtures/c3-script.docx et c3-script.pdf (aucun appel réseau).
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { MESSAGE_TROP_COURT, TAILLE_MAX_IMPORT, texteDuMarkdown, verifierFichierImport, verifierTexteColle } from "@/assistant/express/texte-colle";
import { extraireTexteFichier } from "@/services/import-texte";
import { decouperTexte } from "@/fournisseurs/simulation/script";
import { formatAvocat } from "@/formats/avocat";

const FIX = join(__dirname, "fixtures");
const lire = (n: string) => new Uint8Array(readFileSync(join(FIX, n)));
const mots = (t: string) => t.split(/\s+/).filter(Boolean);
const ECRAN = (f: string) => readFileSync(join(__dirname, "..", f), "utf8");

describe("B13 · texte trop court", () => {
  it("moins de 3 mots : refus avec « Ce texte est trop court. »", () => {
    expect(MESSAGE_TROP_COURT).toBe("Ce texte est trop court.");
    expect(verifierTexteColle("Bonjour à")).toEqual({ ok: false, message: "Ce texte est trop court." });
    expect(verifierTexteColle("  Bonjour à tous  ")).toEqual({ ok: true, texte: "Bonjour à tous" });
  });

  it("la zone « Coller » affiche ce message au lieu d'ignorer le texte en silence", () => {
    const src = ECRAN("src/assistant/express/ZoneColler.tsx");
    expect(src).toMatch(/verifierTexteColle\(/);
    expect(src).not.toMatch(/split\(\/\\s\+\/\)\.length < 3\) return;/);
  });
});

describe("B6 · importer un fichier", () => {
  it("contrôle : extensions permises, 5 Mo au plus, refus clair sinon", () => {
    expect(TAILLE_MAX_IMPORT).toBe(5 * 1024 * 1024);
    expect(verifierFichierImport({ nom: "texte.TXT", taille: 10 })).toEqual({ ok: true, lecture: "navigateur", extension: ".txt" });
    expect(verifierFichierImport({ nom: "notes.md", taille: 10 })).toEqual({ ok: true, lecture: "navigateur", extension: ".md" });
    expect(verifierFichierImport({ nom: "script.docx", taille: 10 })).toEqual({ ok: true, lecture: "serveur", extension: ".docx" });
    expect(verifierFichierImport({ nom: "script.pdf", taille: 10 })).toEqual({ ok: true, lecture: "serveur", extension: ".pdf" });
    const gros = verifierFichierImport({ nom: "script.pdf", taille: TAILLE_MAX_IMPORT + 1 });
    expect(gros).toEqual({ ok: false, message: "Ce fichier dépasse 5 Mo : il est trop lourd." });
    const autre = verifierFichierImport({ nom: "photo.jpg", taille: 10 });
    expect(autre.ok).toBe(false);
    expect(!autre.ok && autre.message).toMatch(/\.txt, \.md, \.docx ou \.pdf/);
    expect(verifierFichierImport({ nom: "ancien.doc", taille: 10 }).ok).toBe(false);
  });

  it(".md : les marques de mise en forme sont retirées, aucun mot n'est changé", () => {
    const md = "# Titre du script\n\nVotre **patron** lit vos _mails_ ?\n- Il en a le droit.\n> Retenez [ce mot](https://exemple.fr).";
    expect(texteDuMarkdown(md)).toBe("Titre du script\n\nVotre patron lit vos mails ?\nIl en a le droit.\nRetenez ce mot.");
  });

  it(".docx lu par le serveur, mot pour mot, paragraphes gardés", async () => {
    const t = await extraireTexteFichier("script.docx", lire("c3-script.docx"));
    expect(mots(t)).toEqual(mots("Votre patron lit vos mails ? Il peut ouvrir les mails professionnels. Retenez le mot personnel."));
    expect(t.split(/\n\s*\n/).length).toBe(3);
  });

  it(".pdf lu par le serveur, mot pour mot, lignes gardées", async () => {
    const t = await extraireTexteFichier("script.pdf", lire("c3-script.pdf"));
    expect(t.split("\n").map((l) => l.trim())).toEqual(["Votre patron lit vos mails ?", "Il peut ouvrir les mails professionnels.", "Retenez le mot personnel."]);
  });

  it("le texte importé suit le même découpage que le coller (aucun mot réécrit)", async () => {
    const t = await extraireTexteFichier("script.docx", lire("c3-script.docx"));
    const blocs = decouperTexte(t, formatAvocat.recetteScript);
    expect(blocs[0].blocRecette).toBe("accroche");
    expect(blocs.flatMap((b) => b.segments.flatMap((s) => mots(s.texte)))).toEqual(mots(t));
  });

  it("le serveur refuse lui aussi : trop lourd, mauvais type, fichier illisible", async () => {
    await expect(extraireTexteFichier("script.pdf", new Uint8Array(TAILLE_MAX_IMPORT + 1))).rejects.toThrow("Ce fichier dépasse 5 Mo : il est trop lourd.");
    await expect(extraireTexteFichier("photo.jpg", new Uint8Array(4))).rejects.toThrow(/\.txt, \.md, \.docx ou \.pdf/);
    await expect(extraireTexteFichier("faux.pdf", new TextEncoder().encode("pas un pdf"))).rejects.toThrow("Ce fichier n'a pas pu être lu. Ouvrez-le, copiez le texte et collez-le.");
    await expect(extraireTexteFichier("faux.docx", new TextEncoder().encode("pas un docx"))).rejects.toThrow("Ce fichier n'a pas pu être lu. Ouvrez-le, copiez le texte et collez-le.");
  });

  it("le bouton « Importer un fichier » est à côté de « Coller », avec les bons types de fichier", () => {
    // L'import vit dans le bouton commun, que la zone « Coller » affiche.
    expect(ECRAN("src/assistant/express/ZoneColler.tsx")).toMatch(/<BoutonImporterTexte/);
    const src = ECRAN("src/assistant/express/BoutonImporterTexte.tsx");
    expect(src).toMatch(/Importer un fichier/);
    expect(src).toMatch(/accept="\.txt,\.md,\.docx,\.pdf"/);
    // Relecture paquet 4 (sécurité P1) : le fichier passe par /api/import (session exigée avant la lecture du corps).
    expect(src).toMatch(/\/api\/import/);
  });
});
