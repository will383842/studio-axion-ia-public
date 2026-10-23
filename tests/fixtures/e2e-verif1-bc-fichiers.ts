/**
 * VÉRIFICATEUR E2E n° 1 (bc) — fabrique de PETITS FICHIERS RÉELS pour « Importer un fichier » : un vrai .docx (zip
 * Office Open XML, écrit avec jszip, la bibliothèque que mammoth utilise lui-même) et un vrai .pdf (écrit à la main,
 * PDF 1.4 sans compression, police Helvetica en WinAnsi). Rien n'est lu sur le disque ni sur le réseau.
 */
import { createRequire } from "node:module";

const exiger = createRequire(import.meta.url);
type Zip = { file(nom: string, contenu: string): void; generateAsync(o: { type: "uint8array"; compression?: string }): Promise<Uint8Array> };
const JSZip = createRequire(exiger.resolve("mammoth"))("jszip") as new () => Zip;

const echapper = (t: string) => t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** Un paragraphe Word : une suite de « runs » (texte et mise en forme) et d'éléments spéciaux. */
export type Morceau = string | { t: string; gras?: boolean; italique?: boolean; souligne?: boolean } | { br: true } | { tab: true } | { supprime: string } | { insere: string } | { lien: string };
export interface ParagrapheDocx {
  morceaux: Morceau[];
  titre?: boolean;
  liste?: boolean;
}

function run(m: Morceau): string {
  if (typeof m === "string") return `<w:r><w:t xml:space="preserve">${echapper(m)}</w:t></w:r>`;
  if ("br" in m) return "<w:r><w:br/></w:r>";
  if ("tab" in m) return "<w:r><w:tab/></w:r>";
  if ("supprime" in m) return `<w:del w:id="1" w:author="Relecteur" w:date="2026-10-01T10:00:00Z"><w:r><w:delText xml:space="preserve">${echapper(m.supprime)}</w:delText></w:r></w:del>`;
  if ("insere" in m) return `<w:ins w:id="2" w:author="Relecteur" w:date="2026-10-01T10:00:00Z"><w:r><w:t xml:space="preserve">${echapper(m.insere)}</w:t></w:r></w:ins>`;
  if ("lien" in m) return `<w:hyperlink r:id="rIdLien"><w:r><w:rPr><w:rStyle w:val="Hyperlink"/></w:rPr><w:t xml:space="preserve">${echapper(m.lien)}</w:t></w:r></w:hyperlink>`;
  const rpr = `${m.gras ? "<w:b/>" : ""}${m.italique ? "<w:i/>" : ""}${m.souligne ? '<w:u w:val="single"/>' : ""}`;
  return `<w:r>${rpr ? `<w:rPr>${rpr}</w:rPr>` : ""}<w:t xml:space="preserve">${echapper(m.t)}</w:t></w:r>`;
}

/** Un vrai .docx (Word) : paragraphes, titres, listes, gras, italique, retours à la ligne, révisions, lien, tableau. */
export async function fabriquerDocx(paragraphes: ParagrapheDocx[], options: { tableau?: string[][]; entete?: string } = {}): Promise<Uint8Array> {
  const zip = new JSZip();
  zip.file(
    "[Content_Types].xml",
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>' +
      (options.entete ? '<Override PartName="/word/header1.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.header+xml"/>' : "") +
      "</Types>",
  );
  zip.file("_rels/.rels", '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>');
  zip.file(
    "word/_rels/document.xml.rels",
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rIdLien" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/hyperlink" Target="https://axion-ia.com" TargetMode="External"/>' +
      (options.entete ? '<Relationship Id="rIdEntete" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/header" Target="header1.xml"/>' : "") +
      "</Relationships>",
  );
  if (options.entete) zip.file("word/header1.xml", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:hdr xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:p><w:r><w:t>${echapper(options.entete)}</w:t></w:r></w:p></w:hdr>`);
  const corps = paragraphes
    .map((p) => {
      const ppr = p.titre ? '<w:pPr><w:pStyle w:val="Heading1"/></w:pPr>' : p.liste ? '<w:pPr><w:pStyle w:val="ListParagraph"/><w:numPr><w:ilvl w:val="0"/><w:numId w:val="1"/></w:numPr></w:pPr>' : "";
      return `<w:p>${ppr}${p.morceaux.map(run).join("")}</w:p>`;
    })
    .join("");
  const tableau = options.tableau ? `<w:tbl>${options.tableau.map((l) => `<w:tr>${l.map((c) => `<w:tc><w:p><w:r><w:t xml:space="preserve">${echapper(c)}</w:t></w:r></w:p></w:tc>`).join("")}</w:tr>`).join("")}</w:tbl>` : "";
  const sect = options.entete ? '<w:sectPr><w:headerReference w:type="default" r:id="rIdEntete"/></w:sectPr>' : "";
  zip.file(
    "word/document.xml",
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><w:body>${corps}${tableau}${sect}</w:body></w:document>`,
  );
  return zip.generateAsync({ type: "uint8array", compression: "DEFLATE" });
}

/** Encode une chaîne en WinAnsi (cp1252) pour une chaîne PDF littérale ; les caractères hors table sont refusés. */
const WINANSI_EXTRA: Record<string, number> = { "€": 0x80, "‚": 0x82, "„": 0x84, "…": 0x85, "‘": 0x91, "’": 0x92, "“": 0x93, "”": 0x94, "–": 0x96, "—": 0x97, "œ": 0x9c, "Œ": 0x8c };
function winAnsi(t: string): number[] {
  return [...t].map((c) => {
    if (WINANSI_EXTRA[c] !== undefined) return WINANSI_EXTRA[c];
    const n = c.codePointAt(0)!;
    if (n < 256) return n;
    throw new Error(`hors WinAnsi : ${c}`);
  });
}

/** Une ligne de page PDF : texte en WinAnsi ; `ligatureFi` : les « fi » sont écrits avec le glyphe de ligature /fi. */
export interface PagePdf {
  lignes: string[];
  /** Page « scannée » : une simple image, aucun texte. */
  image?: boolean;
}

/**
 * Un vrai .pdf (1.4, sans compression) : une page par entrée, Helvetica en WinAnsi ; `ligatures` : les « fi » et « fl »
 * sont dessinés par les glyphes de ligature /fi et /fl (codes 0xAE et 0xAF, table /Differences), comme le font Word et
 * InDesign à l'export.
 */
export function fabriquerPdf(pages: PagePdf[], options: { ligatures?: boolean } = {}): Uint8Array {
  const objets: Buffer[] = [];
  const ajouter = (contenu: Buffer | string) => {
    objets.push(typeof contenu === "string" ? Buffer.from(contenu, "latin1") : contenu);
    return objets.length;
  };
  const police = ajouter(
    options.ligatures
      ? "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding << /Type /Encoding /BaseEncoding /WinAnsiEncoding /Differences [174 /fi /fl] >> >>"
      : "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>",
  );
  const pagesId = objets.length + 1;
  ajouter("PLACEHOLDER");
  const enfants: number[] = [];
  for (const p of pages) {
    let flux: Buffer;
    let ressources = `/Font << /F1 ${police} 0 R >>`;
    if (p.image) {
      // Image 8×8 en niveaux de gris, données brutes (aucun filtre) : une « page scannée » sans texte.
      const img = Buffer.concat([Buffer.from("<< /Type /XObject /Subtype /Image /Width 8 /Height 8 /ColorSpace /DeviceGray /BitsPerComponent 8 /Length 64 >>\nstream\n", "latin1"), Buffer.alloc(64, 0x80), Buffer.from("\nendstream", "latin1")]);
      const imgId = ajouter(img);
      ressources += ` /XObject << /Im1 ${imgId} 0 R >>`;
      flux = Buffer.from("q 500 0 0 700 50 50 cm /Im1 Do Q", "latin1");
    } else {
      const parties: Buffer[] = [Buffer.from("BT /F1 14 Tf 18 TL 60 760 Td\n", "latin1")];
      for (const l of p.lignes) {
        let octets = winAnsi(l);
        if (options.ligatures) {
          const s: number[] = [];
          for (let i = 0; i < octets.length; i++) {
            if (octets[i] === 0x66 && (octets[i + 1] === 0x69 || octets[i + 1] === 0x6c)) {
              s.push(octets[i + 1] === 0x69 ? 0xae : 0xaf);
              i++;
            } else s.push(octets[i]);
          }
          octets = s;
        }
        const echappe = Buffer.from(octets.flatMap((o) => (o === 0x28 || o === 0x29 || o === 0x5c ? [0x5c, o] : [o])));
        parties.push(Buffer.from("(", "latin1"), echappe, Buffer.from(") Tj T*\n", "latin1"));
      }
      parties.push(Buffer.from("ET", "latin1"));
      flux = Buffer.concat(parties);
    }
    const contenu = ajouter(Buffer.concat([Buffer.from(`<< /Length ${flux.length} >>\nstream\n`, "latin1"), flux, Buffer.from("\nendstream", "latin1")]));
    enfants.push(ajouter(`<< /Type /Page /Parent ${pagesId} 0 R /MediaBox [0 0 595 842] /Resources << ${ressources} >> /Contents ${contenu} 0 R >>`));
  }
  objets[pagesId - 1] = Buffer.from(`<< /Type /Pages /Kids [${enfants.map((e) => `${e} 0 R`).join(" ")}] /Count ${enfants.length} >>`, "latin1");
  const catalogue = ajouter(`<< /Type /Catalog /Pages ${pagesId} 0 R >>`);
  const morceaux: Buffer[] = [Buffer.from("%PDF-1.4\n%\xe2\xe3\xcf\xd3\n", "latin1")];
  const positions: number[] = [];
  let pos = morceaux[0].length;
  objets.forEach((o, i) => {
    const bloc = Buffer.concat([Buffer.from(`${i + 1} 0 obj\n`, "latin1"), o, Buffer.from("\nendobj\n", "latin1")]);
    positions.push(pos);
    pos += bloc.length;
    morceaux.push(bloc);
  });
  const xref = `xref\n0 ${objets.length + 1}\n0000000000 65535 f \n${positions.map((p) => `${String(p).padStart(10, "0")} 00000 n \n`).join("")}trailer\n<< /Size ${objets.length + 1} /Root ${catalogue} 0 R >>\nstartxref\n${pos}\n%%EOF\n`;
  morceaux.push(Buffer.from(xref, "latin1"));
  return new Uint8Array(Buffer.concat(morceaux));
}
