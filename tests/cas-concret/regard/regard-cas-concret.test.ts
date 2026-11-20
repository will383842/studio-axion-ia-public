import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { jugerRegard, type ImageLue, type InstantRegard, type LectureRegard } from "@/briques/regardeur";
import { calerFiche } from "@/moteurs/montage-cas-concret/calage";
import { VERSION_FICHE_ECRANS, type EcranCorps, type FicheEcrans } from "@/moteurs/montage-cas-concret/fiche";
import { MARQUE, textesEcrits } from "@/moteurs/montage-cas-concret/regles";
import { instantsCasConcret, partiesCasConcret, reservesDuVerdict, textesPermisCasConcret } from "@/moteurs/montage-cas-concret/regard-cas-concret";
import type { MotCalage } from "@/briques/motion/calage";

const DITS = ["un", "deux", "trois", "quatre", "cinq"].map((m) => `${m} mot dit ici`);
const brute = (): FicheEcrans => ({
  version: VERSION_FICHE_ECRANS, formatId: "cas-concret", videoId: "video-1", versionId: "version-1", habillage: "charte-duo/1", ratio: "9:16",
  offre: "integration", origine: "porte-a", posture: "chez-nous", casId: "recrutement-apporteurs", empreinteCas: "cas-0123456789abcdef-1a",
  ecrans: DITS.map((texteDit, k) => ({ id: `e0${k + 1}`, type: "titre", fond: "sombre", marque: MARQUE, texteDit, avanceMs: 0, evenements: [], lignes: [`Titre ${k + 1}`] }) as EcranCorps),
});
const mots: MotCalage[] = DITS.join(" ").split(" ").map((mot, i) => ({ mot, debutSec: i * 0.4, finSec: i * 0.4 + 0.35 }));
const calee = (): FicheEcrans => {
  const r = calerFiche(brute(), null, mots, { finApresDernierMotSec: 2.1 });
  if (!r.ok) throw new Error(r.problemes.join("\n"));
  return r.fiche;
};
const duree = 12;

const lecture = (f: FicheEcrans, instants: InstantRegard[], extra: Record<string, string> = {}): LectureRegard => ({
  images: instants.map((i): ImageLue => {
    const e = f.ecrans.find((x) => x.id === i.partieId);
    const textes = e ? textesEcrits(e) : [];
    if (i.partieId && extra[i.partieId]) textes.push(extra[i.partieId]!);
    return { nom: i.nom, textes: textes.map((texte) => ({ texte, coupe: false, horsCadre: false })), sousTitre: null, pageVide: false, noire: false, illisible: false };
  }),
});

describe("regard-cas-concret", () => {
  it("a) 5 écrans calés : 5 parties croissantes, ≤ 24 instants, un par écran", () => {
    const f = calee();
    const parties = partiesCasConcret(f);
    expect(parties.map((p) => p.id)).toEqual(["e01", "e02", "e03", "e04", "e05"]);
    for (let k = 1; k < parties.length; k++) expect(parties[k]!.debutSec).toBeGreaterThan(parties[k - 1]!.debutSec);
    expect(parties.every((p) => p.texteAttendu)).toBe(true);
    const instants = instantsCasConcret(f, null, duree);
    expect(instants.length).toBeLessThanOrEqual(24);
    for (const p of parties) expect(instants.some((i) => i.partieId === p.id)).toBe(true);
  });

  it("b) fiche non calée : aucune partie, instants de début et de fin seulement", () => {
    const f = brute();
    expect(partiesCasConcret(f)).toEqual([]);
    const instants = instantsCasConcret(f, null, duree);
    expect(instants.length).toBeGreaterThan(0);
    expect(instants.every((i) => i.sorte !== "partie")).toBe(true);
  });

  it("c) textes permis : la marque, le texte dit, chaque texte écrit", () => {
    const f = calee();
    const permis = textesPermisCasConcret(f);
    expect(permis).toContain(MARQUE);
    expect(permis.some((t) => t.includes(DITS[2]!))).toBe(true);
    for (const e of f.ecrans) for (const t of textesEcrits(e)) expect(permis).toContain(t);
  });

  it("d) texte inconnu sur e03 : la réserve nomme « écran e03 » et cite le texte ; lecture fidèle : []", () => {
    const f = calee();
    const instants = instantsCasConcret(f, null, duree);
    const textesPermis = textesPermisCasConcret(f);
    const v = jugerRegard({ instants, lecture: lecture(f, instants, { e03: "Gagnez du temps chaque jour" }), textesPermis });
    const r = reservesDuVerdict(v);
    expect(r).toHaveLength(1);
    expect(r[0]).toContain("écran e03");
    expect(r[0]).toContain("Gagnez du temps chaque jour");
    expect(reservesDuVerdict(jugerRegard({ instants, lecture: lecture(f, instants), textesPermis }))).toEqual([]);
  });

  it("d bis) images non relues : une seule phrase de compte", () => {
    const instants = instantsCasConcret(calee(), null, duree);
    expect(reservesDuVerdict(jugerRegard({ instants, lecture: null, textesPermis: [] }))).toEqual([`${instants.length} images non relues`]);
  });

  it("e) éteint = identique : aucun fichier de src n'importe l'adaptateur", () => {
    const parcourir = (d: string): string[] => readdirSync(d).flatMap((n) => { const p = join(d, n); return statSync(p).isDirectory() ? parcourir(p) : /\.(ts|tsx)$/.test(n) ? [p] : []; });
    const importeurs = parcourir("src").filter((p) => !p.endsWith("regard-cas-concret.ts") && p.split("\\").join("/") !== "src/services/regardeur-cas-concret.ts" && readFileSync(p, "utf8").includes("regard-cas-concret"));
    expect(importeurs).toEqual([]);
  });
});
