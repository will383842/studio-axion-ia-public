/**
 * VÉRIFICATION E2E n° 1 — AGENT g — « Importer un fichier » (.docx / .pdf) DANS L'IMAGE AUTONOME (production).
 *
 * src/services/import-texte.ts lit le fichier dans un processus enfant (`node -e`) qui charge mammoth, jszip et unpdf
 * PAR LEUR NOM depuis `process.cwd()` (/app dans l'image Docker). Dans `.next/standalone`, Next 16 (Turbopack) ne pose
 * en tête de `node_modules` que mammoth, pg, web-push, next, react, react-dom et @node-rs : unpdf n'y est PAS (le serveur
 * le charge sous un alias haché, `.next/node_modules/unpdf-<empreinte>`). Constaté sur une construction réelle
 * (`next build`, serveur autonome lancé depuis une copie isolée) : le .docx revient, le .pdf répond
 * « Ce fichier n'a pas pu être lu… » (IMPORT_ILLISIBLE) avec, en console, « Cannot find package 'unpdf' ».
 * Dans le dépôt (et donc dans tous les autres tests), le dossier `node_modules` du dépôt masque le défaut.
 *
 * Ce test reproduit la disposition de l'image : un dossier hors du dépôt, avec SEULEMENT `node_modules/mammoth` (lien
 * vers le paquet réel, comme dans `.next/standalone`), devient le dossier courant du studio.
 *
 * CORRIGÉ par le correcteur final B (import-texte.ts, `chargerUnpdf` : l'enfant cherche aussi l'alias haché
 * `.next/node_modules/unpdf-<empreinte>` et le dossier pnpm). Vérifié le 04/10/2026 sur une VRAIE construction
 * Turbopack (`next build`, comme le Dockerfile) : `.next/standalone/node_modules` = @node-rs, mammoth, next, pg, react,
 * react-dom, web-push (pas d'unpdf) ; `.next/standalone/.next/node_modules/unpdf-fe9c66141c03beec` → dossier pnpm
 * `node_modules/.pnpm/unpdf@1.8.1/node_modules/unpdf`. La disposition « image » du test reprend donc cet alias ; et
 * quand une construction existe (`.next/standalone`), une copie isolée de la vraie sortie est essayée aussi.
 */
import { cpSync, existsSync, mkdtempSync, mkdirSync, realpathSync, rmSync, symlinkSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { creerZip } from "@/lib/zip";

const { extraireTexteFichier } = await import("@/services/import-texte");

/** Un .pdf d'une page, police standard, texte simple (construit à la main, objets et table xref exacts). */
function pdfMinimal(texte: string): Uint8Array {
  const flux = `BT /F1 18 Tf 20 100 Td (${texte}) Tj ET`;
  const objets = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 300 200] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>",
    `<< /Length ${flux.length} >>\nstream\n${flux}\nendstream`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
  ];
  let sortie = "%PDF-1.4\n";
  const positions: number[] = [];
  objets.forEach((o, i) => {
    positions.push(sortie.length);
    sortie += `${i + 1} 0 obj\n${o}\nendobj\n`;
  });
  const xref = sortie.length;
  sortie += `xref\n0 ${objets.length + 1}\n0000000000 65535 f \n${positions.map((p) => `${String(p).padStart(10, "0")} 00000 n \n`).join("")}`;
  sortie += `trailer\n<< /Size ${objets.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return new TextEncoder().encode(sortie);
}

/** Un .docx minimal (trois parties), zippé sans dépendance. */
function docxMinimal(texte: string): Uint8Array {
  const t = (x: string) => new TextEncoder().encode(x);
  return creerZipDe({
    "[Content_Types].xml": t('<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>'),
    "_rels/.rels": t('<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>'),
    "word/document.xml": t(`<?xml version="1.0" encoding="UTF-8"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>${texte}</w:t></w:r></w:p></w:body></w:document>`),
  });
}

const creerZipDe = (parties: Record<string, Uint8Array>) => creerZip(Object.entries(parties).map(([nom, donnees]) => ({ nom, donnees })));

const TEXTE_PDF = "Bonjour pdf Will avocat";
const TEXTE_DOCX = "Bonjour docx Will avocat";
let dossier = "";

/**
 * Dossier « image autonome » : node_modules/mammoth en tête et unpdf SEULEMENT sous son alias haché
 * `.next/node_modules/unpdf-<empreinte>` (la disposition relevée dans `.next/standalone`). `avecUnpdf: false` : une image
 * cassée, sans unpdf du tout.
 */
function dossierAutonome(avecUnpdf = true): string {
  const d = mkdtempSync(join(realpathSync(tmpdir()), "studio-autonome-g-"));
  mkdirSync(join(d, "node_modules"));
  const depot = createRequire(join(process.cwd(), "index.js"));
  const mammoth = dirname(depot.resolve("mammoth/package.json"));
  symlinkSync(realpathSync(mammoth), join(d, "node_modules", "mammoth"), "dir");
  if (avecUnpdf) {
    mkdirSync(join(d, ".next", "node_modules"), { recursive: true });
    symlinkSync(realpathSync(join(process.cwd(), "node_modules", "unpdf")), join(d, ".next", "node_modules", "unpdf-fe9c66141c03beec"), "dir");
  }
  return d;
}

/** Sortie autonome d'une vraie construction (`next build`), si elle existe dans ce dossier. */
const SORTIE_AUTONOME = join(process.cwd(), ".next", "standalone");
const construction = existsSync(join(SORTIE_AUTONOME, "server.js"));

describe("agent g — import d'un fichier depuis le dossier du studio", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    if (dossier) rmSync(dossier, { recursive: true, force: true });
    dossier = "";
  });

  describe("dans le dépôt (comme tous les autres tests)", () => {
    it(".pdf et .docx reviennent en texte", async () => {
      expect(await extraireTexteFichier("essai.pdf", pdfMinimal(TEXTE_PDF))).toContain(TEXTE_PDF);
      expect(await extraireTexteFichier("essai.docx", docxMinimal(TEXTE_DOCX))).toContain(TEXTE_DOCX);
    }, 60_000);
  });

  describe("dans la disposition de l'image autonome (/app sans node_modules/unpdf, alias haché seulement)", () => {
    beforeEach(() => {
      dossier = dossierAutonome();
      vi.spyOn(process, "cwd").mockReturnValue(dossier);
    });

    it(".docx : le texte revient (mammoth et jszip sont trouvés)", async () => {
      expect(await extraireTexteFichier("essai.docx", docxMinimal(TEXTE_DOCX))).toContain(TEXTE_DOCX);
    }, 60_000);

    // ANCIEN DÉFAUT BLOQUANT (production seulement) : l'enfant faisait `await import("unpdf")` depuis process.cwd() ;
    // unpdf est absent de .next/standalone/node_modules (alias haché sous .next/node_modules/unpdf-<empreinte>) : le
    // .pdf était refusé « illisible ». CORRIGÉ (correcteur final B, `chargerUnpdf`) : l'alias est trouvé.
    it("CORRIGÉ — .pdf : le texte revient aussi dans l'image autonome", async () => {
      expect(await extraireTexteFichier("essai.pdf", pdfMinimal(TEXTE_PDF))).toContain(TEXTE_PDF);
    }, 60_000);
  });

  describe("image cassée (aucun unpdf, même sous alias)", () => {
    beforeEach(() => {
      dossier = dossierAutonome(false);
      vi.spyOn(process, "cwd").mockReturnValue(dossier);
    });

    // Ancien constat (le .pdf sain refusé « illisible » dans l'image) réécrit : il ne vaut plus que pour une image
    // vraiment cassée, sans unpdf du tout ; le refus reste lisible, jamais un plantage.
    it("constat : .pdf refusé comme « illisible » (phrase lisible), le .docx revient toujours", async () => {
      await expect(extraireTexteFichier("essai.pdf", pdfMinimal(TEXTE_PDF))).rejects.toMatchObject({ code: "IMPORT_ILLISIBLE" });
      expect(await extraireTexteFichier("essai.docx", docxMinimal(TEXTE_DOCX))).toContain(TEXTE_DOCX);
    }, 60_000);
  });

  // Preuve sur la VRAIE sortie autonome : copie isolée de `.next/standalone` (comme l'étape `run` du Dockerfile), hors
  // du dépôt. Sautée seulement quand aucune construction n'est présente (`npx next build` la crée).
  describe.skipIf(!construction)("copie isolée de la vraie sortie autonome (.next/standalone)", () => {
    beforeEach(() => {
      dossier = mkdtempSync(join(realpathSync(tmpdir()), "studio-standalone-g-"));
      cpSync(SORTIE_AUTONOME, dossier, { recursive: true, verbatimSymlinks: true });
      vi.spyOn(process, "cwd").mockReturnValue(dossier);
    });

    it("unpdf n'est pas en tête de node_modules, et pourtant le .pdf et le .docx reviennent en texte", async () => {
      expect(existsSync(join(dossier, "node_modules", "unpdf"))).toBe(false);
      expect(await extraireTexteFichier("essai.pdf", pdfMinimal(TEXTE_PDF))).toContain(TEXTE_PDF);
      expect(await extraireTexteFichier("essai.docx", docxMinimal(TEXTE_DOCX))).toContain(TEXTE_DOCX);
    }, 120_000);
  });
});
