/**
 * VÉRIFICATEUR E2E n° 1 — PARCOURS B (bc) : « Coller » et « Importer un fichier » (.txt, .md, .docx, .pdf), de la
 * route /api/import (la VRAIE route, session exigée) jusqu'aux blocs du script, sans aucun appel réseau.
 *
 * Les fichiers sont de VRAIS petits fichiers fabriqués dans le test (tests/fixtures/e2e-verif1-bc-fichiers.ts) : un
 * .docx Word (zip OOXML, gras, italique, souligné, titres, liste, révisions, lien, tableau, en-tête de page) et des .pdf
 * (texte WinAnsi : accents, « », ’, œ, €, ligatures fi / fl ; page « scannée » = une image sans texte).
 *
 * Ce qui marche : tests verts. Défauts confirmés puis corrigés : `it("CORRIGÉ — …")` (le test décrit le comportement
 * ATTENDU) ; les anciens tests « constat » décrivent désormais le comportement corrigé.
 */
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { mockHeaders, mockNavigation, reinitialiserRequete } from "./helpers/next-mocks";
import { preparerMotDePasse } from "./helpers/g1a";
import { fabriquerDocx, fabriquerPdf } from "./fixtures/e2e-verif1-bc-fichiers";

vi.mock("next/headers", () => mockHeaders);
vi.mock("next/navigation", () => mockNavigation);

// Aucun appel réseau, même pour un client créé à l'import (il garde le `fetch` du moment).
vi.stubGlobal("fetch", async (u: unknown) => {
  throw new Error(`Adresse inattendue (aucun appel réel permis) : ${String(u)}`);
});
const { reinitialiserDepots } = await import("@/donnees/memoire");
const auth = await import("@/services/auth");
const scripts = await import("@/services/scripts");
const { POST } = await import("@/app/api/import/route");
const { preparerTexteVoix } = await import("@/moteurs/montage-avocat/report");
const { decoderTexteFichier, verifierFichierImport, verifierTexteColle, texteDuMarkdown, TAILLE_MAX_IMPORT, MESSAGE_PDF_SCANNE } = await import("@/assistant/express/texte-colle");

const MDP = "e2e-verif1-bc-import";
const mots = (t: string) => t.split(/\s+/).filter(Boolean);
const motsDesBlocs = (b: { segments: { texte: string }[] }[]) => b.flatMap((x) => x.segments.flatMap((s) => mots(s.texte)));

/** Aucun texte technique dans un message montré à Will. */
const TECHNIQUE = /IMPORT_|ErreurStudio|Error|undefined|null|NaN|\{|\}|\bHTTP\b|\b[45]\d\d\b|stack|mammoth|unpdf|pdf\.js|jszip|ENOENT|SIGKILL|process/i;

/** Appelle la VRAIE route /api/import comme le fait l'écran (ZoneColler.lireFichierSurLeServeur). */
async function importer(nom: string, octets: Uint8Array, entetes: Record<string, string> = {}) {
  const r = await POST(
    new NextRequest("http://localhost/api/import", {
      method: "POST",
      body: octets,
      headers: { "x-nom-fichier": encodeURIComponent(nom), "content-length": String(octets.byteLength), ...entetes },
      duplex: "half",
    } as ConstructorParameters<typeof NextRequest>[1]),
  );
  const corps = (await r.json().catch(() => ({}))) as { texte?: string; erreur?: string; code?: string };
  return { statut: r.status, ...corps };
}

/**
 * Le chemin du NAVIGATEUR pour .txt et .md (ZoneColler.importer) : octets du `File` (`arrayBuffer()`), décodés par
 * `decoderTexteFichier` (UTF-8, sinon Windows-1252), .md nettoyé.
 */
async function lireCommeLeNavigateur(nom: string, octets: Uint8Array): Promise<string> {
  const v = verifierFichierImport({ nom, taille: octets.byteLength });
  if (!v.ok || v.lecture !== "navigateur") throw new Error("pas lu par le navigateur");
  const brut = decoderTexteFichier(new Uint8Array(await new Blob([new Uint8Array(octets)]).arrayBuffer()));
  return v.extension === ".md" ? texteDuMarkdown(brut) : brut;
}

beforeAll(async () => {
  await preparerMotDePasse(MDP);
});

beforeEach(async () => {
  reinitialiserDepots();
  reinitialiserRequete();
  // Aucun appel réseau : tout `fetch` fait échouer le test.
  vi.stubGlobal("fetch", async (u: unknown) => {
    throw new Error(`Adresse inattendue (aucun appel réel permis) : ${String(u)}`);
  });
  await auth.seConnecter(MDP, false);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

const SCRIPT_DOCX = [
  { titre: true, morceaux: ["Le licenciement économique"] },
  { morceaux: [{ t: "Vo", gras: true }, { t: "tre", italique: true }, " patron peut-il ", { t: "vous", souligne: true }, " licencier ? L’œuvre « efficace » coûte 1 500 €."] },
  { morceaux: ["Le mot ", { supprime: "SUPPRIMÉ " }, { insere: "inséré " }, "reste. Voir ", { lien: "axion-ia.com" }, "."] },
  { liste: true, morceaux: ["Premier point à retenir."] },
  { liste: true, morceaux: ["Second point à retenir."] },
];

describe("B · route /api/import (la vraie) : session, taille, type", () => {
  it("sans session : 401 « Connexion requise. », le fichier n'est pas lu", async () => {
    reinitialiserRequete();
    const r = await importer("script.pdf", fabriquerPdf([{ lignes: ["Un texte quelconque ici."] }]));
    expect(r).toMatchObject({ statut: 401, erreur: "Connexion requise." });
    expect(r.texte).toBeUndefined();
  });

  it("plus de 5 Mo (annoncé ou réel) : 413 et une phrase claire ; type inconnu : refus clair", async () => {
    const gros = await importer("gros.pdf", new Uint8Array(8), { "content-length": String(TAILLE_MAX_IMPORT + 1) });
    expect(gros).toMatchObject({ statut: 413, erreur: "Ce fichier dépasse 5 Mo : il est trop lourd." });
    // Corps réellement plus gros que 5 Mo, même si l'en-tête ment.
    const vrai = await importer("gros.docx", new Uint8Array(TAILLE_MAX_IMPORT + 10), { "content-length": "10" });
    expect(vrai).toMatchObject({ statut: 413, erreur: "Ce fichier dépasse 5 Mo : il est trop lourd." });
    const doc = await importer("ancien.doc", new Uint8Array([0xd0, 0xcf, 0x11, 0xe0]));
    expect(doc).toMatchObject({ statut: 400, erreur: "Ce type de fichier n'est pas lu. Choisissez un fichier .txt, .md, .docx ou .pdf." });
    // L'écran ne montre que `erreur` : jamais de texte technique.
    for (const m of [gros.erreur, vrai.erreur, doc.erreur]) expect(m).not.toMatch(TECHNIQUE);
  });

  it("fichiers vides (.txt, .docx, .pdf blanc) et faux fichiers : refus clair, lisible, jamais d'écran mort", async () => {
    const vides = [
      await importer("vide.txt", new Uint8Array(0)),
      await importer("blanc.txt", new TextEncoder().encode("   \n\n  ")),
      await importer("vide.docx", await fabriquerDocx([])),
      await importer("vide.pdf", fabriquerPdf([{ lignes: [] }])),
    ];
    for (const v of vides) expect(v).toMatchObject({ statut: 400, erreur: "Ce fichier ne contient pas de texte." });
    const faux = [await importer("faux.pdf", new TextEncoder().encode("pas un pdf")), await importer("faux.docx", new TextEncoder().encode("pas un docx"))];
    for (const f of faux) expect(f).toMatchObject({ statut: 400, erreur: "Ce fichier n'a pas pu être lu. Ouvrez-le, copiez le texte et collez-le." });
    for (const m of [...vides, ...faux].map((x) => x.erreur)) expect(m).not.toMatch(TECHNIQUE);
  });

  // Ancien constat : le .pdf scanné recevait « Ce fichier ne contient pas de texte. ». Désormais (corrigé) : la phrase
  // dédiée au scan, toujours lisible et refusée proprement (400).
  it(".pdf scanné (une image, aucun texte) : refusé avec une phrase lisible", async () => {
    const r = await importer("scan.pdf", fabriquerPdf([{ lignes: [], image: true }]));
    expect(r.statut).toBe(400);
    expect(r.erreur).not.toMatch(TECHNIQUE);
    expect(r.erreur).toBe(MESSAGE_PDF_SCANNE);
  });

  // GÊNE CORRIGÉE : un PDF scanné CONTIENT du texte aux yeux de Will (il le voit à l'écran) ; « ne contient pas de
  // texte » le laissait sans piste. Désormais : le message dit que c'est une image (scan) et propose de copier-coller ou
  // de dicter. Un .pdf blanc (sans image) garde « Ce fichier ne contient pas de texte. ».
  it("CORRIGÉ — .pdf scanné : le message dit que c'est une image (scan), pas « ne contient pas de texte »", async () => {
    const r = await importer("scan.pdf", fabriquerPdf([{ lignes: [], image: true }]));
    expect(r.erreur).toMatch(/scan|image/i);
    expect(r.erreur).toMatch(/coll/i);
    expect(r.erreur).toMatch(/dict/i);
    expect(r.erreur).not.toBe("Ce fichier ne contient pas de texte.");
    expect(r.code).toBe("IMPORT_SCAN");
    const blanc = await importer("blanc.pdf", fabriquerPdf([{ lignes: [] }]));
    expect(blanc.erreur).toBe("Ce fichier ne contient pas de texte.");
  });
});

describe("B · le texte lu, mot pour mot (accents, ligatures, mise en forme)", () => {
  it(".docx mis en forme : gras / italique / souligné recollés, titres et listes gardés, révision supprimée retirée, en-tête de page ignoré", async () => {
    const r = await importer("Mon script.docx", await fabriquerDocx(SCRIPT_DOCX, { tableau: [["Cellule A", "Cellule B"]], entete: "Cabinet — confidentiel" }));
    expect(r.statut).toBe(200);
    const t = r.texte!;
    expect(t).toContain("Votre patron peut-il vous licencier ? L’œuvre « efficace » coûte 1 500 €.");
    expect(t).toContain("Le mot inséré reste. Voir axion-ia.com.");
    expect(t).not.toContain("SUPPRIMÉ");
    expect(t).not.toContain("confidentiel");
    expect(t.split("\n\n").slice(0, 3)).toEqual(["Le licenciement économique", "Votre patron peut-il vous licencier ? L’œuvre « efficace » coûte 1 500 €.", "Le mot inséré reste. Voir axion-ia.com."]);
  });

  it(".pdf : accents, guillemets, apostrophe courbe, œ, €, tiret long ; pages séparées ; ligatures fi / fl rendues en lettres", async () => {
    const r = await importer("script.pdf", fabriquerPdf([{ lignes: ["Votre patron peut-il vous licencier ?", "L’œuvre « efficace » coûte 1 500 € — c’est ça."] }, { lignes: ["Page deux : la fin."] }]));
    expect(r.texte).toBe("Votre patron peut-il vous licencier ?\nL’œuvre « efficace » coûte 1 500 € — c’est ça.\n\nPage deux : la fin.");
    const lig = await importer("ligatures.pdf", fabriquerPdf([{ lignes: ["Le bénéfice officiel est fixé : affluence."] }], { ligatures: true }));
    expect(lig.texte).toBe("Le bénéfice officiel est fixé : affluence.");
    expect(lig.texte).not.toMatch(/[ﬀ-ﬆ]/);
  });

  it(".md et .txt (lus par le navigateur) : marques retirées, aucun mot changé ; UTF-8 avec BOM : BOM retiré", async () => {
    const md = await lireCommeLeNavigateur("notes.md", new TextEncoder().encode("# Titre\n\nVotre **patron** lit vos _mails_ ?\n- Il en a le droit."));
    expect(md).toBe("Titre\n\nVotre patron lit vos mails ?\nIl en a le droit.");
    const bom = await lireCommeLeNavigateur("bom.txt", new Uint8Array([0xef, 0xbb, 0xbf, ...new TextEncoder().encode("Le salarié protégé.")]));
    expect(bom).toBe("Le salarié protégé.");
  });

  // GÊNE CORRIGÉE : un .txt enregistré en Windows-1252 / ISO-8859-1 (vieux Bloc-notes, export de logiciel métier) était
  // décodé en UTF-8 sans contrôle : chaque lettre accentuée devenait « � » (U+FFFD), dans le navigateur (`f.text()`)
  // comme sur le serveur (`fatal: false`), et la voix aurait lu « salari� ». Désormais `decoderTexteFichier`
  // (texte-colle.ts), le même dans le navigateur et sur le serveur : UTF-8 strict, sinon relu en Windows-1252.
  it("CORRIGÉ — .txt en Windows-1252 : les accents sont gardés (jamais de « � » dans le script)", async () => {
    const latin1 = new Uint8Array(Buffer.from("Le salarié protégé a été licencié.", "latin1"));
    const navigateur = await lireCommeLeNavigateur("ancien.txt", latin1);
    expect(navigateur).not.toContain("�");
    const serveur = await importer("ancien.txt", latin1);
    expect(serveur.texte ?? "").not.toContain("�");
  });

  // Ancien constat (« � » partout, contrôle passé quand même) réécrit pour le comportement corrigé : le texte est lu
  // mot pour mot, avec ses accents, pareil dans le navigateur et sur le serveur ; un vrai UTF-8 reste lu en UTF-8.
  it("constat corrigé : le .txt Windows-1252 est lu avec ses accents, identique dans le navigateur et sur le serveur", async () => {
    const lu = await lireCommeLeNavigateur("ancien.txt", new Uint8Array(Buffer.from("Le salarié protégé a été licencié.", "latin1")));
    expect(lu).toBe("Le salarié protégé a été licencié.");
    expect(verifierTexteColle(lu).ok).toBe(true);
    const serveur = await importer("ancien.txt", new Uint8Array(Buffer.from("Le salarié protégé a été licencié.", "latin1")));
    expect(serveur).toMatchObject({ statut: 200, texte: lu });
    // Windows-1252 propre : « œ », « € », guillemets courbes.
    expect(decoderTexteFichier(new Uint8Array([0x9c, 0x75, 0x76, 0x72, 0x65, 0x20, 0x80, 0x20, 0x93, 0x6f, 0x6b, 0x94]))).toBe("œuvre € “ok”");
    expect(await importer("utf8.txt", new TextEncoder().encode("L’œuvre coûte 1 500 €."))).toMatchObject({ statut: 200, texte: "L’œuvre coûte 1 500 €." });
  });

  // GÊNE CORRIGÉE : un retour à la ligne MANUEL de Word (Maj + Entrée, <w:br/>) n'était rendu par rien
  // (mammoth.extractRawText) : les deux mots de part et d'autre étaient SOUDÉS (« mailsIl »), un mot nouveau que la voix
  // aurait lu. Désormais chaque <w:br/> devient un saut de ligne (import-texte.ts, `lireDocx`).
  it("CORRIGÉ — .docx avec retour à la ligne manuel (Maj + Entrée) : les mots ne sont pas soudés", async () => {
    const r = await importer("br.docx", await fabriquerDocx([{ morceaux: ["Votre patron lit vos mails", { br: true }, "Il en a le droit."] }]));
    expect(mots(r.texte!)).toEqual(["Votre", "patron", "lit", "vos", "mails", "Il", "en", "a", "le", "droit."]);
  });

  // Ancien constat (« mailsIl ») réécrit pour le comportement corrigé : le retour manuel devient un saut de ligne.
  it("constat corrigé : le retour manuel de Word devient un saut de ligne entre « mails » et « Il »", async () => {
    const r = await importer("br.docx", await fabriquerDocx([{ morceaux: ["Votre patron lit vos mails", { br: true }, "Il en a le droit."] }]));
    expect(r.texte).toBe("Votre patron lit vos mails\nIl en a le droit.");
  });
});

describe("B · du texte importé aux blocs du script (aucun mot réécrit)", () => {
  it("collé, .txt, .docx et .pdf donnent le même script, mot pour mot", async () => {
    const texte = "Votre patron peut-il lire vos mails ?\n\nOui, s'ils sont professionnels. Mais un mail marqué « personnel » est protégé.\n\nRetenez ce mot : personnel.";
    const colle = verifierTexteColle(texte);
    expect(colle.ok).toBe(true);
    const sources = {
      colle: texte,
      txt: await lireCommeLeNavigateur("script.txt", new TextEncoder().encode(texte)),
      docx: (await importer("script.docx", await fabriquerDocx(texte.split("\n\n").map((p) => ({ morceaux: [p] }))))).texte!,
      pdf: (await importer("script.pdf", fabriquerPdf(texte.split("\n\n").map((p) => ({ lignes: [p] }))))).texte!,
    };
    for (const [source, t] of Object.entries(sources)) {
      const blocs = await scripts.decouperTexteColle("avocat", t);
      expect(motsDesBlocs(blocs), source).toEqual(mots(texte));
      expect(blocs[0].blocRecette, source).toBe("accroche");
      expect(blocs.at(-1)!.segments.at(-1)!.texte, source).toBe("Retenez ce mot : personnel.");
    }
  });

  it("un texte de moins de 3 mots, ou démesuré, est refusé avec une phrase (jamais ignoré en silence)", async () => {
    expect(verifierTexteColle("Bonjour Will")).toEqual({ ok: false, message: "Ce texte est trop court." });
    await expect(scripts.decouperTexteColle("avocat", "mot ".repeat(60_000))).rejects.toMatchObject({ message: "Ce texte est trop long pour un script (200 000 caractères au plus)." });
  });

  // GÊNE CORRIGÉE : dans un .pdf, chaque ligne VISUELLE de la page devient une ligne du texte (la mise en page coupe
  // les phrases), et le découpage garde chaque ligne comme un morceau séparé (pensé pour les retours à la ligne de Will,
  // pas pour ceux de la mise en page) : une phrase d'un PDF était coupée en plusieurs segments au milieu d'un groupe de
  // mots. Désormais `recollerLignesPdf` (import-texte.ts) recolle une ligne qui ne finit pas une phrase à la suivante
  // qui commence par une minuscule, avant le découpage.
  it("CORRIGÉ — .pdf : une phrase coupée par la mise en page reste UNE phrase dans le script", async () => {
    const r = await importer("paragraphe.pdf", fabriquerPdf([{ lignes: ["Votre employeur peut lire les mails que vous", "envoyez depuis votre boîte professionnelle, sauf", "s'ils sont marqués personnels."] }]));
    const blocs = await scripts.decouperTexteColle("avocat", r.texte!);
    const segments = blocs.flatMap((b) => b.segments.map((s) => s.texte));
    expect(segments).toEqual(["Votre employeur peut lire les mails que vous envoyez depuis votre boîte professionnelle, sauf s'ils sont marqués personnels."]);
  });

  // Ancien constat (3 segments) réécrit pour le comportement corrigé : la phrase est recollée, un mot coupé en fin de
  // ligne (« licencie- » / « ment ») est recollé sans espace, et ce qui doit rester séparé l'est (fin de phrase, titre
  // suivi d'une phrase en majuscule, pages). Aucun caractère n'est changé : seuls des retours à la ligne disparaissent.
  it("constat corrigé : la phrase du PDF est recollée, sans réunir ce qui doit rester séparé", async () => {
    const r = await importer("paragraphe.pdf", fabriquerPdf([{ lignes: ["Votre employeur peut lire les mails que vous", "envoyez depuis votre boîte professionnelle, sauf", "s'ils sont marqués personnels."] }]));
    expect(r.texte).toBe("Votre employeur peut lire les mails que vous envoyez depuis votre boîte professionnelle, sauf s'ils sont marqués personnels.");
    const coupe = await importer("coupe.pdf", fabriquerPdf([{ lignes: ["Le licencie-", "ment économique est encadré.", "Le titre", "Une phrase. Puis :", "la suite."] }, { lignes: ["page deux."] }]));
    expect(coupe.texte).toBe("Le licencie-ment économique est encadré.\nLe titre\nUne phrase. Puis :\nla suite.\n\npage deux.");
  });

  // PETITE GÊNE CORRIGÉE : un guillemet ouvrant « en fin de ligne (texte collé avec ses retours, ou ligne de PDF) était
  // collé au mot PRÉCÉDENT (`motsSousTitres` l'ajoute sans espace au dernier mot du segment) : « marqué« ». Désormais le
  // découpage (decoupage-colle.ts, `ouvrantsAvecLaSuite`) le passe au début du morceau suivant, avec le mot qu'il ouvre.
  it("CORRIGÉ — « en fin de ligne : jamais collé au mot précédent dans le texte lu par la voix", async () => {
    const blocs = await scripts.decouperTexteColle("avocat", "Un mail marqué «\npersonnel » est protégé, même au bureau.");
    const segments = blocs.flatMap((b) => b.segments.map((x) => ({ id: x.id, texte: x.texte })));
    expect(preparerTexteVoix(segments, []).texte).not.toMatch(/marqué«/);
  });

  // Ancien constat (« marqué« ») réécrit pour le comportement corrigé : le guillemet ouvre le segment suivant, les mots
  // et leur ordre ne changent pas.
  it("constat corrigé : le « passe avec « personnel », dans les segments comme dans le texte lu par la voix", async () => {
    const texte = "Un mail marqué «\npersonnel » est protégé, même au bureau.";
    const blocs = await scripts.decouperTexteColle("avocat", texte);
    const segments = blocs.flatMap((b) => b.segments.map((x) => ({ id: x.id, texte: x.texte })));
    expect(segments.map((x) => x.texte)).toEqual(["Un mail marqué", "« personnel » est protégé, même au bureau."]);
    expect(motsDesBlocs(blocs)).toEqual(mots(texte));
    expect(preparerTexteVoix(segments, []).texte).not.toMatch(/marqué«/);
  });
});
