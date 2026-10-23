/**
 * SECONDE RELECTURE PAQUET 4 — lentille SÉCURITÉ (docs/controles/RERELECTURE-PAQUET4.md, § 2.1 et 2.3) : levée du veto
 * sur la bombe .pdf. Les trois fichiers de contournement de l'annexe (1 000 Mo une fois ouverts, moins d'1 Mo envoyé)
 * étaient ROUGES sur 36a80df : 15 s chacun et plus d'1 Go de mémoire en plus pour le processus du studio.
 *  - filtre INDIRECT (`/Filter 6 0 R`), dictionnaire de plus de 2 Ko, faux `/Subtype /Image` sur le flux de contenu :
 *    refus clair en quelques secondes, moins de 300 Mo de plus pour le processus du studio ;
 *  - contrôle préalable indépendant du dictionnaire : filtres hors Flate/DCT/JPX refusés, flux zlib décompressés bornés
 *    quel que soit leur dictionnaire (50 Mo au total), Flate dans Flate compris ;
 *  - lecture dans un PROCESSUS ENFANT : sa mémoire réelle (RSS) est surveillée toutes les 50 ms, il est tué au-delà de
 *    250 Mo ou de 15 s ; le studio ne lui passe aucune variable d'environnement (aucun secret).
 * Aucun réseau, aucune clé.
 */
import { constants, createDeflate, createDeflateRaw, deflateSync } from "node:zlib";
import { beforeAll, describe, expect, it } from "vitest";

const { MESSAGE_FICHIER_TROP_COMPLEXE } = await import("@/assistant/express/texte-colle");
const imp = await import("@/services/import-texte");

/* ------------------------------------------------------------------ */
/* PDF forgés en mémoire                                               */
/* ------------------------------------------------------------------ */

/** Flux zlib de `mo` Mo de « q Q » (presque aucun texte), compressé PAR MORCEAUX : jamais 1 Go en mémoire ici. */
function fluxGeant(mo: number): Promise<Buffer> {
  return new Promise((ok, ko) => {
    const d = createDeflate({ level: 9, strategy: constants.Z_DEFAULT_STRATEGY });
    const sortie: Buffer[] = [];
    d.on("data", (b: Buffer) => sortie.push(b));
    d.on("end", () => ok(Buffer.concat(sortie)));
    d.on("error", ko);
    const morceau = Buffer.from("q Q\n".repeat(2 ** 18));
    let i = 0;
    const ecrire = () => {
      while (i < mo) {
        i++;
        if (!d.write(morceau)) return void d.once("drain", ecrire);
      }
      d.end();
    };
    ecrire();
  });
}

/** PDF d'une page dont le contenu est `flux` ; `dico` est le dictionnaire du flux ; `extra` ajoute des objets. */
function pdfAvec(flux: Buffer, dico: string, extra: Record<number, string> = {}): Uint8Array {
  const morceaux: Buffer[] = [Buffer.from("%PDF-1.4\n")];
  const decalages: number[] = [];
  const objet = (n: number, corps: Buffer | string) => {
    decalages[n] = morceaux.reduce((s, b) => s + b.length, 0);
    morceaux.push(Buffer.from(`${n} 0 obj\n`), Buffer.isBuffer(corps) ? corps : Buffer.from(corps), Buffer.from("\nendobj\n"));
  };
  objet(1, "<< /Type /Catalog /Pages 2 0 R >>");
  objet(2, "<< /Type /Pages /Kids [3 0 R] /Count 1 >>");
  objet(3, "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>");
  objet(4, Buffer.concat([Buffer.from(`<< /Length ${flux.length} ${dico} >>\nstream\n`), flux, Buffer.from("\nendstream")]));
  objet(5, "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>");
  const nums = [1, 2, 3, 4, 5];
  for (const [n, corps] of Object.entries(extra)) {
    objet(Number(n), corps);
    nums.push(Number(n));
  }
  const xref = morceaux.reduce((s, b) => s + b.length, 0);
  const taille = Math.max(...nums) + 1;
  const lignes = ["xref", `0 ${taille}`, "0000000000 65535 f "];
  for (let k = 1; k < taille; k++) lignes.push(decalages[k] !== undefined ? `${String(decalages[k]).padStart(10, "0")} 00000 n ` : "0000000000 65535 f ");
  lignes.push("trailer", `<< /Size ${taille} /Root 1 0 R >>`, "startxref", String(xref), "%%EOF");
  morceaux.push(Buffer.from(lignes.join("\n")));
  return new Uint8Array(Buffer.concat(morceaux));
}

/** Pic de mémoire (RSS) du processus du studio pendant `f`, relevé toutes les 10 ms. */
async function avecPicMemoire<T>(f: () => Promise<T>): Promise<{ resultat: PromiseSettledResult<T>; picMo: number; departMo: number; dureeMs: number }> {
  const departMo = process.memoryUsage().rss / 2 ** 20;
  let pic = departMo;
  const sonde = setInterval(() => (pic = Math.max(pic, process.memoryUsage().rss / 2 ** 20)), 10);
  const debut = Date.now();
  const [resultat] = await Promise.allSettled([f()]);
  clearInterval(sonde);
  return { resultat, picMo: Math.max(pic, process.memoryUsage().rss / 2 ** 20), departMo, dureeMs: Date.now() - debut };
}

let flux1000: Buffer;
beforeAll(async () => {
  flux1000 = await fluxGeant(1000);
}, 120_000);

function attendreRefusRapide(m: Awaited<ReturnType<typeof avecPicMemoire>>, nom: string) {
  // Mesure gardée dans la sortie des tests (reprise dans docs/controles/INTEGRATION-PAQUET4.md).
  console.info(`[mesure] ${nom} : ${m.resultat.status === "rejected" ? "refusé" : "LU"} en ${(m.dureeMs / 1000).toFixed(2)} s, studio +${(m.picMo - m.departMo).toFixed(0)} Mo`);
  expect(m.resultat.status).toBe("rejected");
  expect((m.resultat as PromiseRejectedResult).reason).toMatchObject({ code: "IMPORT_TROP_COMPLEXE", message: MESSAGE_FICHIER_TROP_COMPLEXE });
  expect(m.dureeMs).toBeLessThan(5_000);
  expect(m.picMo - m.departMo).toBeLessThan(300);
}

/* ------------------------------------------------------------------ */
describe("Veto .pdf · les trois contournements de l'annexe (1 000 Mo une fois ouverts)", () => {
  it("filtre INDIRECT (`/Filter 6 0 R`) : refusé en quelques secondes, studio < +300 Mo", { timeout: 60_000 }, async () => {
    const bombe = pdfAvec(flux1000, "/Filter 6 0 R", { 6: "/FlateDecode" });
    expect(bombe.byteLength).toBeLessThan(1.5 * 2 ** 20);
    attendreRefusRapide(await avecPicMemoire(() => imp.extraireTexteFichier("indirect.pdf", bombe)), "filtre indirect, 1 000 Mo");
  });

  it("dictionnaire de plus de 2 Ko avant `stream` : refusé en quelques secondes, studio < +300 Mo", { timeout: 60_000 }, async () => {
    const bombe = pdfAvec(flux1000, `/Filter /FlateDecode /Bourrage (${"x".repeat(3000)})`);
    attendreRefusRapide(await avecPicMemoire(() => imp.extraireTexteFichier("long.pdf", bombe)), "dictionnaire de 3 Ko, 1 000 Mo");
  });

  it("faux `/Subtype /Image` sur le flux de contenu : refusé en quelques secondes, studio < +300 Mo", { timeout: 60_000 }, async () => {
    const bombe = pdfAvec(flux1000, "/Filter /FlateDecode /Subtype /Image");
    attendreRefusRapide(await avecPicMemoire(() => imp.extraireTexteFichier("image.pdf", bombe)), "faux /Image, 1 000 Mo");
  });
});

/* ------------------------------------------------------------------ */
describe("Contrôle préalable indépendant du dictionnaire", () => {
  const petit = deflateSync(Buffer.from("BT /F1 12 Tf 72 712 Td (Votre patron lit vos mails ?) Tj ET"));

  it("un PDF honnête se lit toujours (Flate direct)", { timeout: 30_000 }, async () => {
    expect(await imp.extraireTexteFichier("honnete.pdf", pdfAvec(petit, "/Filter /FlateDecode"))).toContain("Votre patron lit vos mails ?");
  });

  it("filtre hors Flate/DCT/JPX (LZW, RunLength, ASCII85…) : refusé, même en tableau ou en nom échappé", { timeout: 30_000 }, async () => {
    for (const dico of ["/Filter /LZWDecode", "/Filter /RunLengthDecode", "/Filter [/ASCII85Decode /FlateDecode]", "/Filter /LZ#57Decode", "/Filt#65r /RL", "/Filter null"]) {
      await expect(imp.extraireTexteFichier("filtre.pdf", pdfAvec(petit, dico)), dico).rejects.toMatchObject({ code: "IMPORT_TROP_COMPLEXE" });
    }
  });

  it("filtre indirect DANS un tableau (`/Filter [6 0 R]`) : refusé", { timeout: 30_000 }, async () => {
    await expect(imp.extraireTexteFichier("tableau.pdf", pdfAvec(petit, "/Filter [6 0 R]", { 6: "/FlateDecode" }))).rejects.toMatchObject({ code: "IMPORT_TROP_COMPLEXE" });
  });

  it("flux zlib SANS `/Filter` déclaré : décompressé quand même, refusé au-delà de 50 Mo", { timeout: 60_000 }, async () => {
    const f80 = await fluxGeant(80);
    await expect(imp.extraireTexteFichier("sans-filtre.pdf", pdfAvec(f80, ""))).rejects.toMatchObject({ code: "IMPORT_TROP_COMPLEXE" });
  });

  it("faux « endstream » au début des données zlib (bloc non compressé) : le contrôle ne s'y arrête pas (pdf.js suit /Length)", { timeout: 60_000 }, async () => {
    // En-tête zlib, bloc « stored » de 9 octets « endstream », puis 80 Mo compressés en deflate brut (somme finale nulle :
    // le refus arrive avant elle).
    const brut = await new Promise<Buffer>((ok) => {
      const d = createDeflateRaw({ level: 9 });
      const s: Buffer[] = [];
      d.on("data", (b: Buffer) => s.push(b));
      d.on("end", () => ok(Buffer.concat(s)));
      const morceau = Buffer.from("q Q\n".repeat(2 ** 18));
      for (let i = 0; i < 80; i++) d.write(morceau);
      d.end();
    });
    const piege = Buffer.concat([Buffer.from([0x78, 0x01, 0x00, 0x09, 0x00, 0xf6, 0xff]), Buffer.from("endstream"), brut, Buffer.alloc(4)]);
    expect(imp.controlerPdf(pdfAvec(piege, "/Filter /FlateDecode"))).toBe("complexe");
  });

  it("Flate dans Flate (`[/FlateDecode /FlateDecode]`) : le second étage est compté aussi", { timeout: 60_000 }, async () => {
    const interieur = await fluxGeant(400);
    expect(interieur.byteLength).toBeLessThan(50 * 2 ** 20);
    const double = deflateSync(interieur);
    expect(imp.controlerPdf(pdfAvec(double, "/Filter [/FlateDecode /FlateDecode]"))).toBe("complexe");
  });

  it("PDF chiffré : illisible", () => {
    expect(imp.controlerPdf(new Uint8Array(Buffer.from("%PDF-1.4\ntrailer << /Encrypt 9 0 R >>")))).toBe("illisible");
  });
});

/* ------------------------------------------------------------------ */
describe("Processus enfant : mémoire réelle et temps bornés", () => {
  it("contrôle préalable coupé : pdf.js décode 1 000 Mo, l'enfant est TUÉ au-delà de 250 Mo de RSS ; le studio reste < +300 Mo", { timeout: 60_000 }, async () => {
    const bombe = pdfAvec(flux1000, "/Filter /FlateDecode");
    const m = await avecPicMemoire(() => imp.extraireDansUnProcessus(".pdf", bombe, { controlePrealable: false }));
    const mesure = imp.derniereMesureImport();
    console.info(`[mesure] enfant sans contrôle préalable : ${mesure?.issue} après ${((mesure?.dureeMs ?? 0) / 1000).toFixed(2)} s, RSS de l'enfant ${mesure?.rssMaxMo.toFixed(0)} Mo au plus ; studio +${(m.picMo - m.departMo).toFixed(0)} Mo`);
    expect((m.resultat as PromiseRejectedResult).reason).toMatchObject({ code: "IMPORT_TROP_COMPLEXE", message: MESSAGE_FICHIER_TROP_COMPLEXE });
    expect(mesure?.issue).toBe("memoire");
    expect(mesure!.rssMaxMo).toBeGreaterThan(imp.LIMITES_IMPORT.rssMaxMo - 1);
    // Relevé toutes les 50 ms : l'enfant ne dépasse la borne que de ce qu'il alloue en 50 ms.
    expect(mesure!.rssMaxMo).toBeLessThan(600);
    expect(m.picMo - m.departMo).toBeLessThan(300);
    expect(m.dureeMs).toBeLessThan(10_000);
  });

  it("au-delà du délai, l'enfant est tué (SIGKILL) et le fichier refusé", { timeout: 30_000 }, async () => {
    await expect(imp.extraireDansUnProcessus(".pdf", pdfAvec(flux1000, "/Filter /FlateDecode"), { controlePrealable: false, delaiMs: 300, rssMaxMo: 4096 })).rejects.toMatchObject({ code: "IMPORT_TROP_COMPLEXE" });
    expect(imp.derniereMesureImport()?.issue).toBe("delai");
  });

  it("l'enfant ne reçoit AUCUNE variable d'environnement du studio (aucun secret) et ne garde pas NODE_OPTIONS", () => {
    const { env, args } = imp.lancementEnfant(256);
    expect(Object.keys(env)).toEqual([]);
    expect(args).toContain("--max-old-space-size=256");
  });

  it("un seul fichier lu à la fois : trois lectures simultanées se suivent, toutes aboutissent", { timeout: 60_000 }, async () => {
    const petit = deflateSync(Buffer.from("BT /F1 12 Tf 72 712 Td (Une phrase.) Tj ET"));
    const r = await Promise.all([0, 1, 2].map(() => imp.extraireTexteFichier("a.pdf", pdfAvec(petit, "/Filter /FlateDecode"))));
    expect(r.every((t) => t.includes("Une phrase."))).toBe(true);
  });
});
