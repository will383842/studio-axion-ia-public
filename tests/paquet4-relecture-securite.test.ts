/**
 * RELECTURE PAQUET 4 — lentille SÉCURITÉ (docs/controles/RELECTURE-PAQUET4-SECURITE.md), tests de non-régression.
 * Chacun était ROUGE sur 81d1bba.
 *  - D1 (VETO) : bombe .docx et bombe .pdf FORGÉES EN MÉMOIRE (quelques centaines de Ko, 80 à 100 Mo une fois ouvertes) :
 *    refus clair en quelques secondes, sans faire gonfler la mémoire du studio ; .docx dont le répertoire central ment ;
 *    lecture arrêtée au-delà du délai ; texte de plus de 200 000 caractères refusé (fichier, .txt/.md et découpage).
 *  - P1 : l'import passe par /api/import, qui exige la session AVANT de lire le corps ; les actions reviennent à 1 Mo.
 *  - P2 : signature du contenu (« PK », « %PDF- ») contrôlée avant la bibliothèque.
 *  - P3 : verrou perdu, la veille s'arrête aussi.  P4 : copie R2 vers le point d'accès S3.  P6 : retour arrière gardé.
 * Aucun réseau, aucune clé.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { constants, crc32, deflateRawSync, deflateSync } from "node:zlib";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { mockHeaders, mockNavigation, reinitialiserRequete } from "./helpers/next-mocks";
import { preparerMotDePasse } from "./helpers/g1a";

vi.mock("next/headers", () => mockHeaders);
vi.mock("next/navigation", () => mockNavigation);

const { MESSAGE_FICHIER_TROP_COMPLEXE, MESSAGE_TEXTE_TROP_LONG, TEXTE_MAX_CARACTERES, verifierTexteColle } = await import("@/assistant/express/texte-colle");
const { extraireTexteFichier, extraireDansUnProcessus, signatureValide } = await import("@/services/import-texte");

const RACINE = join(__dirname, "..");
const lire = (f: string) => readFileSync(join(RACINE, f), "utf8");

/* ------------------------------------------------------------------ */
/* Fichiers forgés en mémoire                                          */
/* ------------------------------------------------------------------ */

/** Zip minimal (méthode « deflate ») ; `annonce` remplace la taille décompressée écrite dans les en-têtes (mensonge). */
function zip(entrees: { nom: string; donnees: Buffer; annonce?: number }[]): Buffer {
  const locaux: Buffer[] = [];
  const central: Buffer[] = [];
  let decalage = 0;
  for (const e of entrees) {
    const nom = Buffer.from(e.nom, "utf8");
    const comp = deflateRawSync(e.donnees, { level: 9 });
    const crc = crc32(e.donnees);
    const taille = e.annonce ?? e.donnees.length;
    const l = Buffer.alloc(30);
    l.writeUInt32LE(0x04034b50, 0);
    l.writeUInt16LE(20, 4);
    l.writeUInt16LE(0, 6);
    l.writeUInt16LE(8, 8);
    l.writeUInt32LE(crc, 14);
    l.writeUInt32LE(comp.length, 18);
    l.writeUInt32LE(taille, 22);
    l.writeUInt16LE(nom.length, 26);
    const c = Buffer.alloc(46);
    c.writeUInt32LE(0x02014b50, 0);
    c.writeUInt16LE(20, 4);
    c.writeUInt16LE(20, 6);
    c.writeUInt16LE(8, 10);
    c.writeUInt32LE(crc, 16);
    c.writeUInt32LE(comp.length, 20);
    c.writeUInt32LE(taille, 24);
    c.writeUInt16LE(nom.length, 28);
    c.writeUInt32LE(decalage, 42);
    locaux.push(l, nom, comp);
    central.push(c, nom);
    decalage += l.length + nom.length + comp.length;
  }
  const cd = Buffer.concat(central);
  const fin = Buffer.alloc(22);
  fin.writeUInt32LE(0x06054b50, 0);
  fin.writeUInt16LE(entrees.length, 8);
  fin.writeUInt16LE(entrees.length, 10);
  fin.writeUInt32LE(cd.length, 12);
  fin.writeUInt32LE(decalage, 16);
  return Buffer.concat([...locaux, cd, fin]);
}

const TYPES = Buffer.from(
  '<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>',
);
const RELS = Buffer.from(
  '<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>',
);
const docx = (corps: Buffer, annonce?: number) =>
  new Uint8Array(
    zip([
      { nom: "[Content_Types].xml", donnees: TYPES },
      { nom: "_rels/.rels", donnees: RELS },
      {
        nom: "word/document.xml",
        donnees: Buffer.concat([Buffer.from('<?xml version="1.0" encoding="UTF-8"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>'), corps, Buffer.from("</w:t></w:r></w:p></w:body></w:document>")]),
        annonce,
      },
    ]),
  );

/** PDF d'une page dont le contenu est UN flux FlateDecode (texte « (aaaa…) Tj » de `taille` octets). */
function pdf(taille: number): Uint8Array {
  const contenu = Buffer.concat([Buffer.from("BT /F1 12 Tf 72 712 Td ("), Buffer.alloc(taille, 0x61), Buffer.from(") Tj ET")]);
  const flux = deflateSync(contenu, { level: 9, strategy: constants.Z_DEFAULT_STRATEGY });
  const morceaux: Buffer[] = [Buffer.from("%PDF-1.4\n")];
  const decalages: number[] = [];
  const objet = (n: number, corps: Buffer | string) => {
    decalages[n] = morceaux.reduce((s, b) => s + b.length, 0);
    morceaux.push(Buffer.from(`${n} 0 obj\n`), Buffer.isBuffer(corps) ? corps : Buffer.from(corps), Buffer.from("\nendobj\n"));
  };
  objet(1, "<< /Type /Catalog /Pages 2 0 R >>");
  objet(2, "<< /Type /Pages /Kids [3 0 R] /Count 1 >>");
  objet(3, "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>");
  objet(4, Buffer.concat([Buffer.from(`<< /Length ${flux.length} /Filter /FlateDecode >>\nstream\n`), flux, Buffer.from("\nendstream")]));
  objet(5, "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>");
  const xref = morceaux.reduce((s, b) => s + b.length, 0);
  const lignes = ["xref", "0 6", "0000000000 65535 f ", ...[1, 2, 3, 4, 5].map((n) => `${String(decalages[n]).padStart(10, "0")} 00000 n `), "trailer", "<< /Size 6 /Root 1 0 R >>", "startxref", String(xref), "%%EOF"];
  morceaux.push(Buffer.from(lignes.join("\n")));
  return new Uint8Array(Buffer.concat(morceaux));
}

/** Pic de mémoire du processus (RSS) pendant `f`. */
async function avecPicMemoire<T>(f: () => Promise<T>): Promise<{ resultat: PromiseSettledResult<T>; picMo: number; departMo: number; dureeMs: number }> {
  const departMo = process.memoryUsage().rss / 2 ** 20;
  let pic = departMo;
  const sonde = setInterval(() => (pic = Math.max(pic, process.memoryUsage().rss / 2 ** 20)), 20);
  const debut = Date.now();
  const [resultat] = await Promise.allSettled([f()]);
  clearInterval(sonde);
  return { resultat, picMo: Math.max(pic, process.memoryUsage().rss / 2 ** 20), departMo, dureeMs: Date.now() - debut };
}

/* ------------------------------------------------------------------ */
describe("D1 (VETO) · bombe .docx / .pdf : mémoire, temps et longueur bornés", () => {
  it("bombe .docx (≈ 100 Ko, 100 Mo une fois ouvert) : refus clair en quelques secondes, mémoire du studio tenue", { timeout: 60_000 }, async () => {
    const bombe = docx(Buffer.alloc(100 * 2 ** 20, 0x61));
    expect(bombe.byteLength).toBeLessThan(500 * 1024);
    const m = await avecPicMemoire(() => extraireTexteFichier("bombe.docx", bombe));
    expect(m.resultat.status).toBe("rejected");
    expect((m.resultat as PromiseRejectedResult).reason).toMatchObject({ code: "IMPORT_TROP_COMPLEXE", message: MESSAGE_FICHIER_TROP_COMPLEXE });
    expect(m.dureeMs).toBeLessThan(10_000);
    expect(m.picMo - m.departMo).toBeLessThan(300);
  });

  it("bombe .docx dont le répertoire central MENT (taille annoncée minuscule) : arrêtée par la lecture en flux", { timeout: 60_000 }, async () => {
    const bombe = docx(Buffer.alloc(100 * 2 ** 20, 0x61), 1000);
    const m = await avecPicMemoire(() => extraireTexteFichier("menteur.docx", bombe));
    expect((m.resultat as PromiseRejectedResult).reason).toMatchObject({ code: "IMPORT_TROP_COMPLEXE" });
    expect(m.dureeMs).toBeLessThan(10_000);
    expect(m.picMo - m.departMo).toBeLessThan(300);
  });

  it("bombe .pdf (≈ 80 Ko, un flux Flate de 80 Mo) : refus clair en quelques secondes, mémoire du studio tenue", { timeout: 120_000 }, async () => {
    const bombe = pdf(80 * 2 ** 20);
    expect(bombe.byteLength).toBeLessThan(500 * 1024);
    const m = await avecPicMemoire(() => extraireTexteFichier("bombe.pdf", bombe));
    expect(m.resultat.status).toBe("rejected");
    expect((m.resultat as PromiseRejectedResult).reason).toMatchObject({ code: "IMPORT_TROP_COMPLEXE", message: MESSAGE_FICHIER_TROP_COMPLEXE });
    expect(m.dureeMs).toBeLessThan(10_000);
    expect(m.picMo - m.departMo).toBeLessThan(300);
  });

  it("la lecture tourne dans un fil borné : au-delà du délai, elle est arrêtée et le fichier refusé", async () => {
    const r = extraireDansUnProcessus(".pdf", pdf(30 * 2 ** 20), { delaiMs: 50, pdfDecompresseOctets: 1024 * 2 ** 20 });
    await expect(r).rejects.toMatchObject({ code: "IMPORT_TROP_COMPLEXE" });
  });

  it("le fil est borné en mémoire : un tas trop petit pour le fichier = refus, le studio continue", { timeout: 60_000 }, async () => {
    // Contrôles du zip relâchés pour l'essai : seule la borne de mémoire du fil arrête mammoth.
    // Un million de paragraphes : des millions de nœuds XML, bien plus que 64 Mo de tas.
    const paragraphes = Buffer.from("a</w:t></w:r></w:p><w:p><w:r><w:t>".repeat(1_000_000));
    const r = extraireDansUnProcessus(".docx", docx(paragraphes), { memoireMo: 64, docxDecompresseOctets: 1024 * 2 ** 20 });
    await expect(r).rejects.toMatchObject({ code: "IMPORT_TROP_COMPLEXE" });
    // Un fichier normal se lit toujours ensuite.
    const t = await extraireTexteFichier("court.docx", docx(Buffer.from("Votre patron lit vos mails ?")));
    expect(t).toBe("Votre patron lit vos mails ?");
  });

  it("texte de plus de 200 000 caractères : refus clair (fichier .docx honnête, .txt, .md), jamais coupé en silence", async () => {
    const long = "mot ".repeat(Math.ceil(TEXTE_MAX_CARACTERES / 4) + 10);
    await expect(extraireTexteFichier("long.docx", docx(Buffer.from(long)))).rejects.toMatchObject({ code: "IMPORT_TROP_LONG", message: MESSAGE_TEXTE_TROP_LONG });
    await expect(extraireTexteFichier("long.txt", new TextEncoder().encode(long))).rejects.toMatchObject({ code: "IMPORT_TROP_LONG" });
    await expect(extraireTexteFichier("long.md", new TextEncoder().encode(long))).rejects.toMatchObject({ code: "IMPORT_TROP_LONG" });
    expect(verifierTexteColle(long)).toEqual({ ok: false, message: MESSAGE_TEXTE_TROP_LONG });
    // Juste sous la borne : lu.
    const juste = "a".repeat(TEXTE_MAX_CARACTERES);
    await expect(extraireTexteFichier("juste.txt", new TextEncoder().encode(juste))).resolves.toHaveLength(TEXTE_MAX_CARACTERES);
  });

  it("le découpage sur le serveur applique la même borne", async () => {
    await preparerMotDePasse("paquet4-relecture-securite");
    reinitialiserRequete();
    const auth = await import("@/services/auth");
    await auth.seConnecter("paquet4-relecture-securite", false);
    const { decouperTexteColle } = await import("@/services/scripts");
    await expect(decouperTexteColle("avocat", "mot ".repeat(TEXTE_MAX_CARACTERES))).rejects.toMatchObject({ code: "TEXTE_TROP_LONG", message: MESSAGE_TEXTE_TROP_LONG });
  });
});

/* ------------------------------------------------------------------ */
describe("P1 · /api/import exige la session AVANT de lire le corps ; actions serveur à 1 Mo", () => {
  beforeAll(() => reinitialiserRequete());

  it("sans session : 401, et le corps n'est jamais lu", async () => {
    reinitialiserRequete();
    const { POST } = await import("@/app/api/import/route");
    let lu = false;
    const corps = new ReadableStream<Uint8Array>(
      {
        pull() {
          lu = true;
        },
      },
      { highWaterMark: 0 },
    );
    const { NextRequest } = await import("next/server");
    const r = await POST(new NextRequest("http://localhost/api/import", { method: "POST", body: corps, headers: { "x-nom-fichier": "a.docx" }, duplex: "half" } as ConstructorParameters<typeof NextRequest>[1]));
    expect(r.status).toBe(401);
    expect(lu).toBe(false);
  });

  it("avec session : un fichier de plus de 5 Mo est coupé à la lecture (413)", async () => {
    await preparerMotDePasse("paquet4-relecture-securite");
    reinitialiserRequete();
    const auth = await import("@/services/auth");
    await auth.seConnecter("paquet4-relecture-securite", false);
    const { POST } = await import("@/app/api/import/route");
    const { NextRequest } = await import("next/server");
    const r = await POST(new NextRequest("http://localhost/api/import", { method: "POST", body: new Uint8Array(5 * 1024 * 1024 + 10), headers: { "x-nom-fichier": "a.pdf" } }));
    expect(r.status).toBe(413);
    const ok = await POST(new NextRequest("http://localhost/api/import", { method: "POST", body: new TextEncoder().encode("Votre patron lit vos mails ?"), headers: { "x-nom-fichier": encodeURIComponent("é.txt") } }));
    expect(await ok.json()).toEqual({ texte: "Votre patron lit vos mails ?" });
  });

  it("la limite des actions serveur n'est plus relevée (1 Mo par défaut)", () => {
    expect(lire("next.config.ts")).not.toMatch(/bodySizeLimit/);
  });
});

/* ------------------------------------------------------------------ */
describe("P2 · signature du contenu contrôlée avant la bibliothèque", () => {
  it("« PK » pour un .docx, « %PDF- » dans le premier Ko pour un .pdf", async () => {
    expect(signatureValide(".docx", docx(Buffer.from("ok")))).toBe(true);
    expect(signatureValide(".docx", new TextEncoder().encode("%PDF-1.4"))).toBe(false);
    expect(signatureValide(".pdf", pdf(10))).toBe(true);
    expect(signatureValide(".pdf", docx(Buffer.from("ok")))).toBe(false);
    await expect(extraireTexteFichier("faux.pdf", docx(Buffer.from("texte caché")))).rejects.toMatchObject({ code: "IMPORT_ILLISIBLE" });
  });
});

/* ------------------------------------------------------------------ */
describe("P3 · verrou perdu : la veille s'arrête aussi (elle repart à la reprise)", () => {
  it("arreterVeille() coupe la tâche ; demarrerVeille() la relance", async () => {
    const veille = await import("@/services/veille");
    expect(veille.demarrerVeille()).toBe(true);
    expect(veille.demarrerVeille()).toBe(false);
    veille.arreterVeille();
    expect(veille.demarrerVeille()).toBe(true);
    veille.arreterVeille();
    // Le démarrage du serveur branche l'arrêt sur la perte du verrou.
    const instr = lire("src/instrumentation.ts");
    expect(instr).toMatch(/surPerte: arreterSansLeVerrou/);
    expect(instr).toMatch(/arreterBoucleGeneration/);
    expect(instr).toMatch(/arreterVeille/);
  });
});

/* ------------------------------------------------------------------ */
describe("P4 · copie hors site : toujours le point d'accès S3 du compte", () => {
  it("un domaine personnalisé n'est pas visé ; un point d'accès européen l'est", async () => {
    const { configR2 } = await import("../deploiement/copier-r2.mjs");
    const env = { R2_ACCOUNT_ID: "compte", R2_ACCESS_KEY_ID: "id", R2_SECRET_ACCESS_KEY: "secret-factice", R2_BUCKET: "seau" };
    expect(configR2({ ...env, R2_PUBLIC_HOST: "https://medias.axion-ia.com" })?.hote).toBe("compte.r2.cloudflarestorage.com");
    expect(configR2({ ...env, R2_PUBLIC_HOST: "compte.eu.r2.cloudflarestorage.com" })?.hote).toBe("compte.eu.r2.cloudflarestorage.com");
    expect(configR2(env)?.hote).toBe("compte.r2.cloudflarestorage.com");
  });
});

/* ------------------------------------------------------------------ */
describe("P6 · relancer la mise à jour après un échec garde le bon retour arrière", () => {
  it("`precedente` vient de la dernière version EN BONNE SANTÉ (`bonne`), posée après le contrôle de santé", () => {
    const maj = lire("deploiement/mettre-a-jour.sh");
    expect(maj).toMatch(/docker image tag "\$image:bonne" "\$image:precedente"/);
    // Correcteur final B : le tag `bonne` est posé par `marquer_bonnes` (commun.sh), service par service, après le
    // contrôle de /api/sante ET de la santé de chaque service.
    expect(maj.indexOf("marquer_bonnes")).toBeGreaterThan(maj.indexOf("attendre_services_sains"));
    expect(maj.indexOf("attendre_services_sains")).toBeGreaterThan(maj.indexOf("attendre_sante"));
    expect(lire("deploiement/commun.sh")).toMatch(/"\$image:local" "\$image:bonne"/);
    expect(lire("deploiement/revenir.sh")).toMatch(/marquer_bonnes/);
  });
});
