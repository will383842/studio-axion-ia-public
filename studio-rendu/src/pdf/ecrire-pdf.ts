/**
 * Écrivain PDF maison (carrousels V2-A, M2-02) : une image JPEG par page, embarquée TELLE QUELLE (DCTDecode, aucun
 * réencodage), sans dépendance. Pages de 810 × 1012,5 pt (1080 × 1350 px à 0,75). Métadonnées : titre, auteur « Axion-IA »
 * et langue fr — rien d'autre (ni producteur, ni date, ni XMP). Format : PDF 1.4, table des références classique.
 */

export const PAGE_PT = { largeur: 810, hauteur: 1012.5 } as const;
export const AUTEUR_PDF = "Axion-IA";
export const PAGES_MAX = 20;

export interface DimensionsJpeg {
  largeur: number;
  hauteur: number;
  composantes: 1 | 3;
}

/** Dimensions d'un JPEG lues dans son premier marqueur SOF ; refuse tout ce qui n'est pas un JPEG gris ou RVB de base. PUR. */
export function dimensionsJpeg(jpeg: Uint8Array): DimensionsJpeg {
  if (jpeg.length < 4 || jpeg[0] !== 0xff || jpeg[1] !== 0xd8) throw new Error("Page illisible : ce n'est pas un JPEG");
  let i = 2;
  while (i + 4 <= jpeg.length) {
    if (jpeg[i] !== 0xff) throw new Error("Page illisible : JPEG mal formé");
    const marqueur = jpeg[i + 1];
    if (marqueur === 0xff) {
      i++;
      continue;
    }
    if (marqueur === 0xd8 || marqueur === 0x01 || (marqueur >= 0xd0 && marqueur <= 0xd7)) {
      i += 2;
      continue;
    }
    const longueur = (jpeg[i + 2] << 8) | jpeg[i + 3];
    const sof = marqueur >= 0xc0 && marqueur <= 0xcf && marqueur !== 0xc4 && marqueur !== 0xc8 && marqueur !== 0xcc;
    if (sof) {
      if (i + 10 > jpeg.length) break;
      const composantes = jpeg[i + 9];
      if (composantes !== 1 && composantes !== 3) throw new Error(`Page illisible : JPEG à ${composantes} composantes (gris ou RVB seulement)`);
      const hauteur = (jpeg[i + 5] << 8) | jpeg[i + 6];
      const largeur = (jpeg[i + 7] << 8) | jpeg[i + 8];
      if (!largeur || !hauteur) throw new Error("Page illisible : JPEG sans dimensions");
      return { largeur, hauteur, composantes };
    }
    i += 2 + longueur;
  }
  throw new Error("Page illisible : JPEG sans en-tête d'image");
}

/** Chaîne PDF : littérale si ASCII imprimable, sinon UTF-16BE avec BOM en hexadécimal. PUR. */
export function chainePdf(texte: string): string {
  if (/^[\x20-\x7e]*$/.test(texte)) return `(${texte.replace(/[\\()]/g, (c) => `\\${c}`)})`;
  let hex = "FEFF";
  for (let k = 0; k < texte.length; k++) hex += texte.charCodeAt(k).toString(16).padStart(4, "0").toUpperCase();
  return `<${hex}>`;
}

export interface DemandePdf {
  titre: string;
  pages: readonly Uint8Array[];
}

/** Écrit le PDF. Lève une erreur claire si une page n'est pas un JPEG 4:5, ou si le nombre de pages sort de 1 à 20. */
export function ecrirePdf({ titre, pages }: DemandePdf): Buffer {
  if (!titre.trim()) throw new Error("Titre du PDF manquant");
  if (pages.length < 1 || pages.length > PAGES_MAX) throw new Error(`Le PDF compte de 1 à ${PAGES_MAX} pages (reçu : ${pages.length})`);
  const morceaux: Buffer[] = [];
  const decalages: number[] = [];
  let position = 0;
  const ajouter = (b: Buffer | string) => {
    const buf = typeof b === "string" ? Buffer.from(b, "latin1") : b;
    morceaux.push(buf);
    position += buf.length;
  };
  const objet = (numero: number, corps: Buffer | string, flux?: Buffer) => {
    decalages[numero] = position;
    ajouter(`${numero} 0 obj\n`);
    ajouter(corps);
    if (flux) {
      ajouter("\nstream\n");
      ajouter(flux);
      ajouter("\nendstream");
    }
    ajouter("\nendobj\n");
  };

  const dims = pages.map((p, k) => {
    const d = dimensionsJpeg(p);
    if (Math.abs(d.largeur / d.hauteur - PAGE_PT.largeur / PAGE_PT.hauteur) > 0.01) throw new Error(`Page ${k + 1} : format ${d.largeur} × ${d.hauteur} px, 4:5 attendu`);
    return d;
  });

  ajouter("%PDF-1.4\n%\xe2\xe3\xcf\xd3\n");
  objet(1, "<< /Type /Catalog /Pages 2 0 R /Lang (fr) >>");
  objet(2, `<< /Type /Pages /Count ${pages.length} /Kids [${pages.map((_, k) => `${4 + 3 * k} 0 R`).join(" ")}] >>`);
  objet(3, `<< /Title ${chainePdf(titre.trim())} /Author ${chainePdf(AUTEUR_PDF)} >>`);
  pages.forEach((jpeg, k) => {
    const page = 4 + 3 * k;
    const d = dims[k];
    objet(page, `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE_PT.largeur} ${PAGE_PT.hauteur}] /Resources << /XObject << /Im0 ${page + 2} 0 R >> >> /Contents ${page + 1} 0 R >>`);
    const contenu = Buffer.from(`q ${PAGE_PT.largeur} 0 0 ${PAGE_PT.hauteur} 0 0 cm /Im0 Do Q`, "latin1");
    objet(page + 1, `<< /Length ${contenu.length} >>`, contenu);
    const espace = d.composantes === 1 ? "/DeviceGray" : "/DeviceRGB";
    const buf = Buffer.from(jpeg);
    objet(page + 2, `<< /Type /XObject /Subtype /Image /Width ${d.largeur} /Height ${d.hauteur} /ColorSpace ${espace} /BitsPerComponent 8 /Filter /DCTDecode /Length ${buf.length} >>`, buf);
  });

  const total = 4 + 3 * pages.length;
  const debutXref = position;
  ajouter(`xref\n0 ${total}\n0000000000 65535 f \n`);
  for (let n = 1; n < total; n++) ajouter(`${String(decalages[n]).padStart(10, "0")} 00000 n \n`);
  ajouter(`trailer\n<< /Size ${total} /Root 1 0 R /Info 3 0 R >>\nstartxref\n${debutXref}\n%%EOF\n`);
  return Buffer.concat(morceaux);
}
