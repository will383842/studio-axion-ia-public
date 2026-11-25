import { createHash } from "node:crypto";
import { existsSync, mkdtempSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { describe, expect, it } from "vitest";
import { FAMILLE_CSS } from "@/briques/charte/axion-2026";
import { FAMILLE_CSS_AXION } from "@/briques/jetons-motion";

/**
 * POLICES-P3-a : pour chaque hôte qui dessine les petits objets, la première famille demandée par chaque objet
 * doit être enregistrée (`new FontFace(`) par cet hôte. Lecture de TEXTE seulement (pas de navigateur en CI).
 * Le défaut d'aujourd'hui est figé dans `tests/polices/ecarts/<famille>.json` (un fichier par police) : la liste ne peut que rétrécir (cliquet).
 */
const racine = process.cwd();
const OBJETS = "src/briques/motion/petits-objets";
const COMPOSITIONS = ["studio-rendu", "compositions"].join("/");
const DOSSIER = join(racine, "tests/polices/ecarts");
const ORIGINE = join(racine, "tests/polices/ecarts-origine-95aa5af.json");
const GENERIQUES = new Set(["sans-serif", "serif", "monospace", "cursive", "system-ui"]);

/** Hôtes : fichier principal + fichiers voisins lus avec lui (le tableau dessine ses objets via ObjetsTableau). */
export const HOTES: Record<string, string[]> = {
  "plan-scenes/PlanDeScenes.tsx": ["plan-scenes/PlanDeScenes.tsx"],
  "plan-scenes/CalquePlanScenes.tsx": ["plan-scenes/CalquePlanScenes.tsx"],
  "commune/PlanSousTexte.tsx": ["commune/PlanSousTexte.tsx"],
  "demo-facecam/DemoFacecam.tsx": ["demo-facecam/DemoFacecam.tsx"],
  "tableau/TableauScene.tsx": ["tableau/TableauScene.tsx", "tableau/ObjetsTableau.tsx"],
  "petits-objets/planche/RacinePlanches.tsx": ["petits-objets/planche/RacinePlanches.tsx"],
};

export type Ecart = { hote: string; objet: string; famille: string };

const lire = (chemin: string): string => readFileSync(join(racine, chemin), "utf8");
const tailler = (s: string): string => s.trim().replace(/^["'`]|["'`]$/g, "");

/** Première famille non générique d'une pile CSS (« "A", "B", sans-serif » → A). */
export function premiereFamille(pile: string): string {
  const noms = pile.split(",").map(tailler).filter((n) => n && !GENERIQUES.has(n.toLowerCase()));
  if (noms.length === 0) throw new Error(`pile sans famille : ${pile}`);
  return noms[0];
}

/** Valeur littérale d'une constante `const NOM = "…"` ou `` `…` `` cherchée dans des textes. */
function constante(nom: string, textes: string[]): string | undefined {
  for (const t of textes) {
    const m = t.match(new RegExp(`const ${nom}\\s*=\\s*(?:"([^"]*)"|\`([^\`]*)\`)`));
    if (m) return m[1] ?? m[2];
  }
  return undefined;
}

/** Première famille demandée par un fichier d'objet, en résolvant les constantes connues. */
export function famillesDemandees(texte: string): string[] {
  const noms: string[] = [];
  const LU = /fontFamily\s*[=:]\s*(?:\{`[^`]*`\}|\{[A-Za-z_]+\}|[A-Za-z_]+|"([^"]*)"|'([^']*)'|\{\s*"([^"]*)"\s*\}|\{\s*'([^']*)'\s*\})/g;
  let lues = 0;
  for (const m of texte.matchAll(LU)) {
    lues += 1;
    const litteral = m[1] ?? m[2] ?? m[3] ?? m[4];
    const expression = m[0].replace(/^fontFamily\s*[=:]\s*/, "").replace(/^\{|\}$/g, "");
    const gabarit = expression.match(/^`"?\$\{FAMILLE_CSS\}"?/);
    let valeur: string | undefined;
    if (litteral !== undefined) valeur = premiereFamille(litteral);
    else if (gabarit) valeur = FAMILLE_CSS;
    else if (expression === "FAMILLE_CSS") valeur = FAMILLE_CSS;
    else if (expression === "FAMILLE_CSS_AXION") valeur = premiereFamille(FAMILLE_CSS_AXION);
    else if (expression === "PILE_CSS") valeur = FAMILLE_CSS;
    else if (/^FAMILLE_[A-Z_]+$/.test(expression)) {
      const pile = constante(expression, [texte]);
      if (pile) valeur = premiereFamille(pile);
    }
    if (!valeur) throw new Error(`expression fontFamily inconnue : ${m[0]}`);
    noms.push(valeur);
  }
  // Filet : une occurrence de fontFamily non lue ci-dessus ne doit jamais être ignorée en silence.
  const presentes = (texte.match(/fontFamily\s*[=:]/g) ?? []).length;
  if (presentes > lues) throw new Error(`expression fontFamily inconnue : ${presentes} occurrences, ${lues} lues`);
  return [...new Set(noms)];
}

/** Familles enregistrées par un hôte : `new FontFace(` de ses fichiers et des fichiers relatifs qu'ils importent. */
export function famillesEnregistrees(fichiers: string[]): Set<string> {
  const lus = new Map<string, string>();
  const suivre = (f: string, texte: string, nouveaux: string[]): void => {
    for (const m of texte.matchAll(/from\s+"(\.\.?\/[^"]+)"/g)) {
      const base = join(dirname(f), m[1]);
      for (const suffixe of [".tsx", ".ts"]) {
        const chemin = `${COMPOSITIONS}/${base}${suffixe}`;
        if (existsSync(join(racine, chemin)) && !lus.has(base + suffixe)) {
          lus.set(base + suffixe, lire(chemin));
          nouveaux.push(base + suffixe);
        }
      }
    }
  };
  const niveau1: string[] = [];
  for (const f of fichiers) {
    const texte = lire(`${COMPOSITIONS}/${f}`);
    lus.set(f, texte);
    suivre(f, texte, niveau1);
  }
  // Un niveau d'imports relatifs de plus (le chargeur commun est délégué par les hôtes).
  for (const f of niveau1) suivre(f, lus.get(f) ?? "", []);
  const textes = [...lus.values()];
  const noms = new Set<string>();
  for (const t of textes) {
    for (const m of t.matchAll(/new FontFace\(\s*("([^"]+)"|([A-Za-z_]+))/g)) {
      const nom = m[2] ?? constante(m[3], textes);
      if (nom) noms.add(nom);
    }
  }
  return noms;
}

/** Écarts (hôte × objet) dont la première famille n'est enregistrée par aucun fichier de l'hôte. */
export function ecartsDe(hotes: Record<string, Set<string>>, objets: Record<string, string[]>): Ecart[] {
  const ecarts: Ecart[] = [];
  for (const [hote, familles] of Object.entries(hotes)) {
    for (const [objet, demandees] of Object.entries(objets)) {
      const premiere = demandees[0];
      if (premiere && !familles.has(premiere)) ecarts.push({ hote, objet, famille: premiere });
    }
  }
  return ecarts;
}

const cle = (e: Ecart): string => `${e.hote} | ${e.objet} | ${e.famille}`;

export function cleFichier(famille: string): string {
  return famille.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

export function lireEcarts(dossier: string): Ecart[] {
  return readdirSync(dossier).filter((n) => n.endsWith(".json")).sort().flatMap((n) => JSON.parse(readFileSync(join(dossier, n), "utf8")) as Ecart[]);
}

export function ecrireEcarts(dossier: string, constates: Ecart[]): void {
  const noms = new Set([...readdirSync(dossier).filter((n) => n.endsWith(".json")), ...constates.map((e) => `${cleFichier(e.famille)}.json`)]);
  for (const nom of noms) writeFileSync(join(dossier, nom), JSON.stringify(constates.filter((e) => `${cleFichier(e.famille)}.json` === nom), null, 2) + "\n");
}

function objetsReels(): Record<string, string[]> {
  const sortie: Record<string, string[]> = {};
  for (const f of readdirSync(join(racine, OBJETS)).filter((n) => n.endsWith(".tsx")).sort()) {
    const demandees = famillesDemandees(lire(`${OBJETS}/${f}`));
    if (demandees.length > 0) sortie[f.replace(/\.tsx$/, "")] = demandees;
  }
  return sortie;
}

function hotesReels(): Record<string, Set<string>> {
  return Object.fromEntries(Object.entries(HOTES).map(([h, fichiers]) => [h, famillesEnregistrees(fichiers)]));
}

describe("POLICES-P3-a : la première famille de chaque objet est enregistrée par l'hôte", () => {
  const constates = ecartsDe(hotesReels(), objetsReels());
  if (process.env.ECRIRE_ECARTS_POLICES === "1") {
    ecrireEcarts(DOSSIER, constates);
  }
  const figes: Ecart[] = lireEcarts(DOSSIER);

  it("(a) tout écart constaté est dans la liste figée (aucun écart neuf)", () => {
    const connus = new Set(figes.map(cle));
    expect(constates.map(cle).filter((c) => !connus.has(c))).toEqual([]);
  });

  it("(b) toute ligne de la liste est encore un écart (sinon : liste périmée, retire la ligne)", () => {
    const reels = new Set(constates.map(cle));
    expect(figes.map(cle).filter((c) => !reels.has(c))).toEqual([]);
  });

  it("(c) la liste n'a ni doublon ni hôte ou objet inconnu", () => {
    const cles = figes.map(cle);
    expect(cles.length).toBe(new Set(cles).size);
    const objets = Object.keys(objetsReels());
    expect(figes.filter((e) => !(e.hote in HOTES) || !objets.includes(e.objet))).toEqual([]);
  });

  it("(d) un fichier par police : chaque entrée est dans le fichier de sa famille, sans doublon", () => {
    for (const n of readdirSync(DOSSIER)) expect((JSON.parse(readFileSync(join(DOSSIER, n), "utf8")) as Ecart[]).filter((e) => `${cleFichier(e.famille)}.json` !== n || Object.keys(e).sort().join() !== "famille,hote,objet")).toEqual([]);
    expect(new Set(figes.map(cle)).size).toBe(figes.length);
    expect(["Axion Manrope", "JetBrains Mono", "Manrope"].map(cleFichier)).toEqual(["axion-manrope", "jetbrains-mono", "manrope"]);
  });

  it("(e) aucune entrée perdue au découpage : la liste ne peut que rétrécir", () => {
    const texte = readFileSync(ORIGINE, "utf8");
    expect(createHash("sha256").update(texte).digest("hex")).toBe("aa3a6bb3a8562d9f7da0ba17cd808d169b2b3aea2bae7ff6e376c636c114515e");
    const origine: Ecart[] = JSON.parse(texte);
    const [anciens, presents, reels] = [origine, figes, constates].map((l) => new Set(l.map(cle)));
    expect([origine.length, figes.map(cle).filter((c) => !anciens.has(c))]).toEqual([106, []]);
    expect(origine.map(cle).filter((c) => !presents.has(c) && reels.has(c))).toEqual([]);
  });

  it("(f) l'écriture redonne les mêmes fichiers ; un fichier sans écart devient [] sans disparaître", () => {
    const tmp = mkdtempSync(join(tmpdir(), "ecarts-"));
    // Un fichier sans écart existe déjà (« [] ») : il ne doit pas disparaître à l'écriture.
    for (const n of readdirSync(DOSSIER)) writeFileSync(join(tmp, n), "[]\n");
    ecrireEcarts(tmp, lireEcarts(DOSSIER));
    expect(readdirSync(tmp).map((n) => readFileSync(join(tmp, n), "utf8"))).toEqual(readdirSync(DOSSIER).map((n) => readFileSync(join(DOSSIER, n), "utf8")));
    // Borne réelle : un écart Manrope SYNTHÉTIQUE est écrit, puis il disparaît : le fichier redevient « [] » sans disparaître.
    ecrireEcarts(tmp, [...figes, { hote: "sonde.tsx", objet: "sonde", famille: "Manrope" }]);
    expect(readFileSync(join(tmp, "manrope.json"), "utf8")).toContain("sonde.tsx");
    ecrireEcarts(tmp, figes.filter((e) => e.famille !== "Manrope"));
    expect(readFileSync(join(tmp, "manrope.json"), "utf8")).toBe("[]\n");
  });

  it("un objet qui demande une police non chargée par l'hôte est vu (cas factice)", () => {
    const factice = famillesDemandees(`<text fontFamily={"x"}`.replace('{"x"}', "{FAMILLE_CSS}"));
    expect(factice).toEqual(["Axion Manrope"]);
    const vus = ecartsDe({ hote: new Set(["Manrope"]) }, { faux: ["Police Fantome"], vrai: ["Manrope"] });
    expect(vus).toEqual([{ hote: "hote", objet: "faux", famille: "Police Fantome" }]);
  });

  it("la pile d'une constante terminal est résolue : première famille non générique", () => {
    expect(famillesDemandees('const FAMILLE_TERMINAL = `"JetBrains Mono", monospace`;\n<text fontFamily={FAMILLE_TERMINAL}>')).toEqual(["JetBrains Mono"]);
    expect(premiereFamille("Manrope, sans-serif")).toBe("Manrope");
  });

  it("une famille écrite en littéral est lue, jamais ignorée en silence", () => {
    expect(famillesDemandees('<text fontFamily="Police Fantome">')).toEqual(["Police Fantome"]);
    expect(famillesDemandees("<text fontFamily='Police Fantome'>")).toEqual(["Police Fantome"]);
    expect(famillesDemandees('<text fontFamily={"Police Fantome"}>')).toEqual(["Police Fantome"]);
    expect(famillesDemandees("<text fontFamily={'Police Fantome'}>")).toEqual(["Police Fantome"]);
    expect(famillesDemandees("style={{ fontFamily: \"'Axion Manrope', sans-serif\" }}")).toEqual(["Axion Manrope"]);
    expect(() => famillesDemandees("<text fontFamily={choisir()}>")).toThrow("expression fontFamily inconnue");
  });
});
