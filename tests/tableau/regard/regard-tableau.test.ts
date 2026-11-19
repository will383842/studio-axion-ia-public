import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { jugerRegard } from "../../../src/briques/regardeur";
import type { ImageLue, InstantRegard, LectureRegard } from "../../../src/briques/regardeur";
import type { FicheTableau } from "../../../src/moteurs/montage-tableau/fiche";
import { texteDitDe } from "../../../src/moteurs/montage-tableau/variantes-fin";
import { textesEcrits, textesEcransScene } from "../../../src/moteurs/montage-tableau/regles";
import { instantsTableau, partiesTableau, relectureDuVerdict, textesPermisTableau } from "../../../src/moteurs/montage-tableau/regard-tableau";

interface Temoin { fiche: FicheTableau; ficheCalee: FicheTableau; voix: { dureeSec: number } }
// Aucun témoin « reference-3 » ne porte debutMs/finMs : on prend la fiche calée du témoin du blocage de la fin TikTok.
const temoin = JSON.parse(readFileSync(new URL("../temoins/blocage-fin-tiktok-2026-10-14.json", import.meta.url), "utf8")) as Temoin;
const calee = temoin.ficheCalee;
const duree = temoin.voix.dureeSec;
const FIN = "Écrivez PLAN en commentaire";

const ecrits = (f: FicheTableau, page: number) => f.scenes.filter((s) => s.page === page).flatMap((s) => [...s.elements.flatMap(textesEcrits), ...textesEcransScene(s)]);
/** Lecture factice qui recopie fidèlement les textes écrits de la page de chaque instant. */
const lecture = (f: FicheTableau, instants: InstantRegard[], extra: Record<string, string> = {}): LectureRegard => ({
  images: instants.map((i): ImageLue => {
    const n = /^page-(\d+)$/.exec(i.partieId ?? "")?.[1];
    const textes = n ? ecrits(f, Number(n)) : [];
    if (n && extra[n]) textes.push(extra[n]);
    return { nom: i.nom, textes: textes.map((texte) => ({ texte, coupe: false, horsCadre: false })), sousTitre: null, pageVide: false, noire: false, illisible: false };
  }),
});

describe("regard-tableau", () => {
  it("a) une partie par page, dans l'ordre, sans chevauchement ; ≤ 24 instants, le dernier de sorte fin", () => {
    const parties = partiesTableau(calee);
    const pages = [...new Set(calee.scenes.map((s) => s.page))];
    expect(parties.map((p) => p.id)).toEqual(pages.map((p) => `page-${p}`));
    for (let k = 1; k < parties.length; k++) expect(parties[k]!.debutSec).toBeGreaterThanOrEqual(parties[k - 1]!.finSec);
    expect(parties[0]!.debutSec).toBe(0);
    const instants = instantsTableau(calee, duree);
    expect(instants.length).toBeLessThanOrEqual(24);
    expect(instants.at(-1)!.sorte).toBe("fin");
    expect(instants.filter((i) => i.sorte === "partie")).toHaveLength(parties.length);
  });

  it("b) textes permis : texte dit complet et fin donnée ; sans fin, la fin n'y est pas", () => {
    const avec = textesPermisTableau(calee, { ecran: FIN });
    expect(avec).toContain(texteDitDe(calee));
    expect(avec).toContain(FIN);
    expect(textesPermisTableau(calee)).not.toContain(FIN);
    // rien de fabriqué : tout vient du texte dit, des textes écrits ou de la fin
    const attendus = new Set([texteDitDe(calee), ...calee.scenes.flatMap((s) => [...s.elements.flatMap(textesEcrits), ...textesEcransScene(s)]), FIN]);
    for (const t of avec) expect(attendus.has(t)).toBe(true);
  });

  it("c) lecture fidèle : aucune remarque", () => {
    const instants = instantsTableau(calee, duree);
    const v = jugerRegard({ instants, lecture: lecture(calee, instants), textesPermis: textesPermisTableau(calee, { ecran: FIN }) });
    const r = relectureDuVerdict(v);
    expect(r.remarques).toEqual([]);
    expect(r.imagesLues).toBe(instants.length);
  });

  it("d) texte étranger sur la page 2 : une remarque « page 2 : phrase que vous n'avez ni écrite ni choisie »", () => {
    const instants = instantsTableau(calee, duree);
    const v = jugerRegard({ instants, lecture: lecture(calee, instants, { "2": "Gagnez du temps chaque jour avec nous" }), textesPermis: textesPermisTableau(calee, { ecran: FIN }) });
    const r = relectureDuVerdict(v);
    expect(r.remarques).toHaveLength(1);
    expect(r.remarques[0]!.raison).toContain("page 2 : phrase que vous n'avez ni écrite ni choisie");
    expect(r.remarques[0]!.raison).toContain("Gagnez du temps chaque jour avec nous");
    expect(r.remarques[0]!.image).toBe(instants.findIndex((i) => i.partieId === "page-2") + 1);
  });

  it("d bis) images non relues : une remarque de plus, sans remarque par image non relue", () => {
    const instants = instantsTableau(calee, duree);
    const v = jugerRegard({ instants, lecture: null, textesPermis: [] });
    const r = relectureDuVerdict(v);
    expect(r.imagesLues).toBe(0);
    expect(r.remarques).toHaveLength(1);
    expect(r.remarques[0]!.raison).toBe(`${instants.length} images non relues`);
  });

  it("e) fiche non calée : aucune partie, aucune exception", () => {
    expect(partiesTableau(temoin.fiche)).toEqual([]);
    expect(() => instantsTableau(temoin.fiche, duree)).not.toThrow();
    expect(instantsTableau(temoin.fiche, duree).map((i) => i.sorte)).toEqual(["debut", "fin"]);
  });
});
