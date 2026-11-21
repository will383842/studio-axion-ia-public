/**
 * S-13-e : « prête, avec remarques » pour l'image vers vidéo (module pur, sans importeur, éteint, 0 €).
 * Verdicts fabriqués à la main (aucun appel, aucun fournisseur).
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { PREFIXE_REMARQUE_LIVRAISON, RESTE_BLOQUANT } from "@/domaine/livraison-avec-remarques";
import { CODES_CONTROLE_IV, type CodeControleIV, type LigneControleIV } from "@/moteurs/montage-image-video/controles";
import type { VerdictPorteIV } from "@/moteurs/montage-image-video/porte";
import { assouplirVerdictIV, TABLE_RECLASSEMENT_IV } from "@/moteurs/montage-image-video/remarques-livraison";

const RACINE = resolve(__dirname, "../..");

const ligne = (code: CodeControleIV, o: Partial<LigneControleIV> = {}): LigneControleIV => ({ code, version: "longue", reseaux: ["instagram", "linkedin"], etat: "reussi", bloquant: true, phrase: `${code} : ok.`, details: [], ...o });
const echec = (code: CodeControleIV, details: string[] = ["défaut."], o: Partial<LigneControleIV> = {}) => ligne(code, { etat: "echoue", phrase: `${code} : ${details[0]}`, details, ...o });

type Version = { version: string; reseaux: string[]; courte?: boolean; lignes: LigneControleIV[] };
function verdict(versions: Version[], o: Partial<VerdictPorteIV> = {}): VerdictPorteIV {
  const jugees = versions.map((v) => ({ version: v.version, cle: v.version, reseaux: v.reseaux, courte: !!v.courte, ok: !v.lignes.some((l) => l.bloquant && l.etat !== "reussi"), phrases: v.lignes.filter((l) => l.bloquant && l.etat !== "reussi").map((l) => l.phrase), instants: [], lignes: v.lignes }));
  const phrases = jugees.flatMap((j) => j.lignes.filter((l) => l.bloquant && l.etat !== "reussi").map((l) => `Instagram, LinkedIn · ${l.phrase}`));
  const reseaux = ["instagram", "linkedin"].map((r) => ({ reseau: r, nom: r === "instagram" ? "Instagram" : "LinkedIn", verdict: "ok", version: "longue", dureeSec: 40 }));
  const ok = phrases.length === 0;
  return {
    ok,
    statut: ok ? "prete" : "refusee",
    phrase: ok ? "La vidéo est prête." : `La vidéo est refusée : ${phrases.length} défaut.`,
    phrases,
    ...(ok ? {} : { nature: "faute" as const }),
    mentions: ["Instagram · un peu longue."],
    generaux: [],
    reseaux,
    versions: jugees,
    parReseau: ["instagram", "linkedin"].map((r) => ({ reseau: r, ok: jugees.filter((j) => j.reseaux.includes(r)).every((j) => j.ok), phrases: [], versionsRefusees: [] })),
    partielle: false,
    transcriptions: {},
    relectures: {},
    appelsPayes: 2,
    ...o,
  } as unknown as VerdictPorteIV;
}
const entree = (versions: Version[]) => ({ reseaux: ["instagram", "linkedin"] as never, versions: versions.map((v) => ({ version: v.version, reseaux: v.reseaux })) as never });
const longue = (lignes: LigneControleIV[]): Version => ({ version: "longue", reseaux: ["instagram", "linkedin"], lignes });

describe("la table de reclassement", () => {
  it("couvre exactement les contrôles de la porte ; chaque valeur est un code de RESTE_BLOQUANT ou null", () => {
    expect(Object.keys(TABLE_RECLASSEMENT_IV).sort()).toEqual([...CODES_CONTROLE_IV].sort());
    const codes: string[] = RESTE_BLOQUANT.map((e) => e.code);
    for (const v of Object.values(TABLE_RECLASSEMENT_IV)) expect(v === null || codes.includes(v)).toBe(true);
  });
  it("jamais de re-blocage : les lignes déjà « zéro blocage » ou de détail valent null", () => {
    for (const c of ["Q12", "Q13", "Q14", "Q15", "Q19", "Q20", "Q21", "Q22", "Q23", "Q25", "Q27", "FOND", "ORANGE", "SCENE"] as const) expect(TABLE_RECLASSEMENT_IV[c], c).toBeNull();
  });
  it("chaque code de RESTE_BLOQUANT que la porte sait mesurer est porté par une ligne de la table", () => {
    const portes = new Set(Object.values(TABLE_RECLASSEMENT_IV));
    for (const c of ["mot-dit-faux", "chiffre-faux", "mot-interdit", "voix-ou-accord", "regles-h1-h2", "duree-plus-180-s", "fin-absente"]) expect(portes.has(c as never), c).toBe(true);
  });
});

describe("même référence quand rien ne se reclasse", () => {
  it("verdict ok", () => {
    const b = verdict([longue([ligne("Q06")])]);
    expect(assouplirVerdictIV(b, entree([longue([])]))).toBe(b);
  });
  it("défaut général", () => {
    const b = verdict([longue([echec("Q26")])], { generaux: ["aucun réseau demandé."] });
    expect(assouplirVerdictIV(b, entree([longue([])]))).toBe(b);
  });
  it("un contrôle « non-fait » (version refusée avant l'écoute)", () => {
    const b = verdict([longue([echec("Q26"), ligne("Q18", { etat: "non-fait", phrase: "Écoute (non vérifié)." })])]);
    expect(assouplirVerdictIV(b, entree([longue([])]))).toBe(b);
  });
  it.each([["Q08"], ["CHIFFRES"], ["Q16"], ["Q17"], ["Q18"], ["Q06"], ["FIN"], ["Q11"]] as const)("une ligne de RESTE_BLOQUANT (%s) mêlée à une remarque", (code) => {
    const b = verdict([longue([echec("Q08bis"), echec(code)])]);
    expect(assouplirVerdictIV(b, entree([longue([])]))).toBe(b);
  });
  it("Q24 « image noire » et Q26 qui voit une fin absente ou une phrase non choisie", () => {
    const a = verdict([longue([echec("Q24", ["image noire de 2 s (0,5 s au plus)."])])]);
    expect(assouplirVerdictIV(a, entree([longue([])]))).toBe(a);
    const c = verdict([longue([echec("Q26", ["l'écran de fin est absent à la fin."])])]);
    expect(assouplirVerdictIV(c, entree([longue([])]))).toBe(c);
    const d = verdict([longue([echec("Q26", ["une phrase non choisie est visible."])])]);
    expect(assouplirVerdictIV(d, entree([longue([])]))).toBe(d);
  });
  it("Q08bis (règle du texte) et Q26 « faux : » (chiffre faux vu à l'image) restent bloquants : verdict d'origine", () => {
    const a = verdict([longue([echec("Q08bis", ["Question de commentaire : la question dépasse 12 mots."])])]);
    expect(assouplirVerdictIV(a, entree([longue([])]))).toBe(a);
    const b = verdict([longue([echec("Q26", ["à 3,2 s, faux : 45 % au lieu de 54 %."])])]);
    expect(assouplirVerdictIV(b, entree([longue([])]))).toBe(b);
  });

  it("Q26 « rendu suspect, sans relecture » (aucune image lue) : relecture impossible, reste bloquant, verdict d'origine", () => {
    const b = verdict([longue([echec("Q26", ["les images de contrôle n'ont pas pu être extraites du fichier final (x). Le rendu est suspect : la vidéo n'est pas livrée sans relecture."])])]);
    expect(assouplirVerdictIV(b, entree([longue([])]))).toBe(b);
  });
  it("un code de contrôle inconnu reste bloquant", () => {
    const b = verdict([longue([echec("Q26"), echec("Z99" as never)])]);
    expect(assouplirVerdictIV(b, entree([longue([])]))).toBe(b);
  });
});

describe("seuls des blocages reclassables : prête, avec remarques", () => {
  const lignes = [echec("Q26", ["le texte de l'image 3 est coupé."]), echec("Q19", ["le contraste est faible."]), echec("Q24", ["volume trop bas."]), ligne("Q06")];
  const v = [longue(lignes)];
  const b = verdict(v);
  const avant = JSON.stringify(b);
  const r = assouplirVerdictIV(b, entree(v));
  it("ok, prête, sans phrase bloquante, ni nature, ni livraison partielle", () => {
    expect(r).not.toBe(b);
    expect(r.ok).toBe(true);
    expect(r.statut).toBe("prete");
    expect(r.phrases).toEqual([]);
    expect(r.nature).toBeUndefined();
    expect(r.partielle).toBe(false);
    expect(r.phrase).toMatch(/^La vidéo est prête pour Instagram, LinkedIn \(4 remarques à lire\)\.$/);
  });
  it("mentions d'avant gardées, puis une remarque préfixée par ligne reclassée", () => {
    expect(r.mentions[0]).toBe("Instagram · un peu longue.");
    expect(r.mentions.slice(1)).toEqual([
      `${PREFIXE_REMARQUE_LIVRAISON}Instagram, LinkedIn · Q26 : le texte de l'image 3 est coupé.`,
      `${PREFIXE_REMARQUE_LIVRAISON}Instagram, LinkedIn · Q19 : le contraste est faible.`,
      `${PREFIXE_REMARQUE_LIVRAISON}Instagram, LinkedIn · Q24 : volume trop bas.`,
    ]);
  });
  it("versions et réseaux livrables ; lignes reclassées non bloquantes ; le reste recopié", () => {
    expect(r.versions[0]!.ok).toBe(true);
    expect(r.versions[0]!.phrases).toEqual([]);
    expect(r.versions[0]!.lignes.some((l) => l.bloquant && l.etat !== "reussi")).toBe(false);
    expect(r.versions[0]!.lignes.map((l) => l.etat)).toEqual(["echoue", "echoue", "echoue", "reussi"]);
    expect(r.parReseau.map((x) => [x.reseau, x.ok, x.versionsRefusees])).toEqual([["instagram", true, []], ["linkedin", true, []]]);
    expect(r.transcriptions).toBe(b.transcriptions);
    expect(r.appelsPayes).toBe(2);
  });
  it("le verdict d'origine n'est pas modifié", () => {
    expect(JSON.stringify(b)).toBe(avant);
  });
});

describe("livraison partielle 4:5 (traitée comme porte.ts)", () => {
  it("la version 4:5 refusée pour une remarque : tous les réseaux livrables, plus de partielle", () => {
    const vs: Version[] = [
      { version: "longue", reseaux: ["instagram"], lignes: [ligne("Q26", { reseaux: ["instagram"] })] },
      { version: "longue-4x5", reseaux: ["linkedin"], lignes: [echec("Q24", ["volume trop bas."], { reseaux: ["linkedin"], version: "longue-4x5" })] },
    ];
    const b = verdict(vs, { partielle: true });
    b.parReseau = [{ reseau: "instagram", ok: true, phrases: [], versionsRefusees: [] }, { reseau: "linkedin", ok: false, phrases: ["volume trop bas."], versionsRefusees: ["longue-4x5"] }] as never;
    const r = assouplirVerdictIV(b, entree(vs));
    expect(r.ok).toBe(true);
    expect(r.partielle).toBe(false);
    expect(r.parReseau.every((x) => x.ok && x.versionsRefusees.length === 0 && x.phrases.length === 0)).toBe(true);
  });
  it("un réseau sans aucune version : verdict d'origine", () => {
    const vs: Version[] = [{ version: "longue", reseaux: ["instagram"], lignes: [echec("Q26")] }];
    const b = verdict(vs);
    expect(assouplirVerdictIV(b, entree(vs))).toBe(b);
  });
});

describe("sans importeur (éteint)", () => {
  it("aucun fichier de src/ n'importe remarques-livraison", () => {
    const vus: string[] = [];
    const marche = (d: string) => {
      for (const f of readdirSync(d)) {
        const p = join(d, f);
        if (statSync(p).isDirectory()) marche(p);
        else if (/\.(tsx?|mts)$/.test(f) && !p.endsWith("remarques-livraison.ts") && /remarques-livraison/.test(readFileSync(p, "utf8"))) vus.push(p);
      }
    };
    marche(join(RACINE, "src"));
    expect(vus).toEqual([]);
  });
});
