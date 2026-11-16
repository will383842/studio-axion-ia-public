/**
 * LOGOS D'OUTILS (C8-L03) : outil LOCAL, lancé à la main, de récupération d'un logo d'outil.
 * L'outil ne télécharge RIEN : l'humain fournit un dossier (pack officiel déjà obtenu) ou un paquet `simple-icons`
 * déjà installé hors dépôt, à version exacte, plus la page de charte enregistrée en fichier local.
 *
 * Usage : pnpm exec tsx outils/logos-outils/recuperer.mts <fichier-entree.json>
 *   {"id":"…","source":{"type":"dossier","chemin":"…","fichier":"…svg","version":"…"}
 *           | {"type":"simple-icons","chemin":"…","version":"13.0.0","slug":"…"},
 *    "charte":"<page copiée>","licence":"CC0-1.0","empreinteAttendue":"<sha256 facultatif>",
 *    "sortie":{"fichiers":"…","preuves":"…"} (facultatif : hors dépôt pour un kit non redistribuable)}
 *
 * Il copie le SVG seulement si `assainirSvg` (C8-L02) l'accepte, calcule le sha256 et écrit dans
 * `PREUVES/<id>-<AAAA-MM-JJ>/` la copie de la charte et `preuve.json`. Il ne met JAMAIS `statut: "valide"` :
 * « vérifié » = page copiée, datée, lue par un humain (règle 8).
 */
import { createHash } from "node:crypto";
import { copyFileSync, existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { basename, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { assainirSvg } from "./convertir.mts";

export type SourceLogo =
  | { type: "dossier"; chemin: string; fichier: string; version: string }
  | { type: "simple-icons"; chemin: string; version: string; slug: string };

export interface EntreeRecuperation {
  id: string;
  source: SourceLogo;
  /** Fichier local : page de charte copiée. */
  charte: string;
  /** Licence du fichier (obligatoire pour un dossier ; lue dans le paquet pour simple-icons). */
  licence?: string;
  /** Empreinte sha256 attendue du SVG (facultatif). */
  empreinteAttendue?: string;
  /** Dossiers de sortie ; absent = dépôt public (CC0 seulement). */
  sortie?: { fichiers: string; preuves: string };
  /** AAAA-MM-JJ ; absent = aujourd'hui (Paris). */
  date?: string;
}

export type ResultatRecuperation = { sha256: string; fichier: string; dossierPreuve: string } | { refus: string };

const ID_LOGO = /^[a-z0-9]+(-[a-z0-9]+)*$/;
/** Slug SOURCE de simple-icons : certains vrais slugs contiennent « _ » (l'id de sortie garde ID_LOGO). */
const SLUG_SOURCE = /^[a-z0-9_]+$/;
/** Un seul `<title>` sans `<` dans le texte, juste après la balise `<svg …>` (format réel de Simple Icons). */
const TITRE_SVG = /^(\s*<svg[^>]*>)\s*<title>[^<]*<\/title>/;
const VERSION_EXACTE = /^\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$|^\d{4}-\d{2}-\d{2}$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const CC0 = /^CC0(-1\.0)?$/i;
const BASE = join(process.cwd(), "src", "briques", "motion", "logos-outils");
export const SORTIE_PUBLIQUE = { fichiers: join(BASE, "fichiers"), preuves: join(process.cwd(), "outils", "logos-outils", "PREUVES") };

/** Règle `titleToSlug` du `sdk.mjs` de simple-icons, recopiée (rien n'est importé). */
export const titreVersSlug = (titre: string) =>
  titre
    .toLowerCase()
    .replaceAll("+", "plus")
    .replaceAll(".", "dot")
    .replaceAll("&", "and")
    .replace(/đ/g, "d")
    .replace(/ħ/g, "h")
    .replace(/ı/g, "i")
    .replace(/ĸ/g, "k")
    .replace(/ŀ/g, "l")
    .replace(/ł/g, "l")
    .replace(/ß/g, "ss")
    .replace(/ŧ/g, "t")
    .normalize("NFD")
    .replace(/[^a-z0-9]/g, "");

const sha256 = (t: Buffer | string) => createHash("sha256").update(t).digest("hex");
const refus = (m: string): { refus: string } => ({ refus: m });
const dateParis = () => new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Paris" }).format(new Date());
const estFichier = (p: string) => existsSync(p) && statSync(p).isFile();
const estDans = (parent: string, enfant: string) => {
  const r = relative(resolve(parent), resolve(enfant));
  return r !== "" && !r.startsWith("..") && !r.startsWith(sep) && !/^[a-zA-Z]:/.test(r);
};

export function recuperer(e: EntreeRecuperation): ResultatRecuperation {
  if (typeof e.id !== "string" || !ID_LOGO.test(e.id)) return refus("id de logo invalide");
  // Règle 7 : logos CLIENTS hors chantier — seul un outil entre.
  if (/^(client|clients)(-|$)/.test(e.id)) return refus("logo client : hors chantier (outils seulement)");
  const date = e.date ?? dateParis();
  if (!DATE.test(date)) return refus("date invalide (AAAA-MM-JJ)");
  if (typeof e.source?.version !== "string" || !VERSION_EXACTE.test(e.source.version)) {
    return refus("version non figée : une version exacte est exigée (jamais une plage)");
  }
  if (!e.charte || !estFichier(e.charte) || statSync(e.charte).size === 0) return refus("charte absente ou vide : page de charte copiée exigée");

  let fichierSvg: string;
  let licence: string;
  let origine: string;
  if (e.source.type === "simple-icons") {
    const pkg = join(e.source.chemin, "package.json");
    if (!estFichier(pkg)) return refus("paquet simple-icons illisible (package.json absent)");
    let meta: { name?: string; version?: string; license?: string };
    try {
      meta = JSON.parse(readFileSync(pkg, "utf8"));
    } catch {
      return refus("package.json illisible");
    }
    if (meta.name !== "simple-icons") return refus("le dossier n'est pas le paquet simple-icons");
    if (meta.version !== e.source.version) return refus(`version du paquet (${meta.version}) différente de la version demandée (${e.source.version})`);
    if (!SLUG_SOURCE.test(e.source.slug ?? "")) return refus("slug invalide");
    // Trois formats réels : 13.x `_data/simple-icons.json` = { icons: [...] } ; 14.x `_data/` = tableau ; 15.x+ `data/` = tableau.
    const donnees = [join(e.source.chemin, "_data", "simple-icons.json"), join(e.source.chemin, "data", "simple-icons.json")].find(estFichier);
    if (!donnees) return refus("simple-icons.json absent (_data/ ou data/)");
    let icones: { slug?: string; title?: string; license?: { type?: string } }[] | undefined;
    try {
      const brut = JSON.parse(readFileSync(donnees, "utf8"));
      icones = Array.isArray(brut) ? brut : brut?.icons;
    } catch {
      return refus("simple-icons.json illisible");
    }
    // Le vrai fichier n'a `slug` que pour les exceptions : sinon il se déduit du titre.
    const icone = Array.isArray(icones) ? icones.find((i) => (i.slug ?? (typeof i.title === "string" ? titreVersSlug(i.title) : "")) === e.source.slug) : undefined;
    if (!icone) return refus("icône absente de simple-icons.json");
    licence = icone.license?.type ?? meta.license ?? "";
    if (!CC0.test(licence)) return refus(`licence Simple Icons « ${licence || "inconnue"} » : seule CC0 entre dans le dépôt public`);
    fichierSvg = join(e.source.chemin, "icons", `${e.source.slug}.svg`);
    origine = `simple-icons@${e.source.version}/icons/${e.source.slug}.svg`;
  } else if (e.source.type === "dossier") {
    if (!e.source.fichier) return refus("fichier du pack manquant");
    fichierSvg = resolve(e.source.chemin, e.source.fichier);
    if (!estDans(e.source.chemin, fichierSvg)) return refus("fichier hors du dossier du pack");
    licence = e.licence ?? "";
    if (!licence.trim()) return refus("licence du fichier manquante");
    origine = `pack local ${basename(resolve(e.source.chemin))}/${e.source.fichier}`;
  } else {
    return refus("type de source inconnu");
  }
  if (!estFichier(fichierSvg)) return refus("fichier SVG introuvable");

  const sortie = e.sortie ?? SORTIE_PUBLIQUE;
  if (!CC0.test(licence)) {
    if (!e.sortie) return refus("licence non CC0 : sortie hors dépôt public obligatoire (option sortie)");
    if ([e.sortie.fichiers, e.sortie.preuves].some((d) => d === process.cwd() || estDans(process.cwd(), d))) {
      return refus("licence non CC0 : la sortie ne doit pas être située dans le dépôt public");
    }
  }

  const brut = readFileSync(fichierSvg);
  const empreinte = sha256(brut);
  if (e.empreinteAttendue !== undefined && e.empreinteAttendue.toLowerCase() !== empreinte) {
    return refus("empreinte qui ne correspond pas à l'empreinte attendue");
  }
  // Le titre de Simple Icons est retiré avant l'assainisseur (qui refuse `<title>`, C8-L02, non modifié).
  const texte = brut.toString("utf8").replace(TITRE_SVG, "$1");
  const a = assainirSvg(texte);
  if ("refus" in a) return refus(`refus de l'assainisseur : ${a.refus}`);
  const ecrit = Buffer.from(texte, "utf8");
  const empreinteEcrite = sha256(ecrit);

  const dossierPreuve = join(sortie.preuves, `${e.id}-${date}`);
  const cible = join(sortie.fichiers, `${e.id}.svg`);
  if (existsSync(dossierPreuve)) return refus("preuve déjà présente pour ce jour : pas d'écrasement");
  if (existsSync(cible)) return refus("fichier déjà présent : pas d'écrasement");

  mkdirSync(sortie.fichiers, { recursive: true });
  mkdirSync(dossierPreuve, { recursive: true });
  writeFileSync(cible, ecrit);
  if (sha256(readFileSync(cible)) !== empreinteEcrite) return refus("empreinte qui ne correspond pas après copie");
  const nomCharte = `charte${/\.[A-Za-z0-9]{1,5}$/.exec(e.charte)?.[0] ?? ""}`;
  copyFileSync(e.charte, join(dossierPreuve, nomCharte));
  const preuve = {
    id: e.id,
    source: origine,
    version: e.source.version,
    sha256: empreinteEcrite,
    sha256Source: empreinte,
    date,
    licence,
    charte: nomCharte,
    charteSha256: sha256(readFileSync(e.charte)),
    luParUnHumain: false,
  };
  writeFileSync(join(dossierPreuve, "preuve.json"), `${JSON.stringify(preuve, null, 2)}\n`);
  return { sha256: empreinteEcrite, fichier: cible, dossierPreuve };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const entree = process.argv[2];
  if (!entree) {
    console.error("Usage : pnpm exec tsx outils/logos-outils/recuperer.mts <fichier-entree.json>");
    process.exit(2);
  }
  const r = recuperer(JSON.parse(readFileSync(entree, "utf8")) as EntreeRecuperation);
  if ("refus" in r) {
    console.error(`REFUSÉ : ${r.refus}`);
    process.exit(1);
  }
  console.log(`copié : ${r.fichier}\nsha256 : ${r.sha256}\npreuve : ${r.dossierPreuve}\nÀ lire par un humain avant tout « validé ».`);
}
