/**
 * Relire et modifier le script avant la vidéo, GRANDE CHAÎNE (briques 4 et 5) : modèle pur du générateur de sujets.
 * - Barème par phrase : une phrase écrite ou modifiée par Will (`ecritPar: "will"`) est jugée au barème « will », les
 *   autres au barème « machine » ;
 * - lignes d'un lot de versions (début et fin par réseau, milieu commun une seule fois) ;
 * - application des modifications : texte repris mot pour mot, phrase marquée « Will », milieu changé une fois.
 * Aucun réseau.
 */
import { describe, expect, it } from "vitest";
import { controlerVersion, horodaterSegments, recontrolerSurHorodatageReel } from "@/domaine/controles-script";
import { appliquerAuLot, controlerSelonAuteurs, lignesDuLot, pastillesDeVersion, pastillesDuLot, type VersionDuLot } from "@/domaine/relecture-generateur";
import { appliquerSaisie, empreinte } from "@/domaine/relecture-script";
import type { BlocScript } from "@/domaine/types";
import { segmentDe, temoin, texteDe } from "./helpers/g3";

describe("barème par phrase", () => {
  it("une salutation dans l'accroche écrite par la machine bloque", () => {
    const e = temoin((x) => texteDe(x, "a1", "Bonjour, un temps plein pour des Excel."));
    const r = controlerSelonAuteurs(e);
    expect(r.violations.find((v) => v.controle === "C3 bis")?.niveau).toBe("bloquant");
  });

  it("la même phrase écrite par Will passe au barème « will » (information, plus de blocage)", () => {
    const e = temoin((x) => {
      texteDe(x, "a1", "Bonjour, un temps plein pour des Excel.");
      segmentDe(x, "a1").ecritPar = "will";
    });
    const r = controlerSelonAuteurs(e);
    expect(r.violations.find((v) => v.controle === "C3 bis")?.niveau).toBe("info");
    expect(r.violations.filter((v) => v.segmentIndex === 0 && v.bloquant)).toEqual([]);
  });

  it("une phrase de Will ne change pas le barème des phrases de la machine", () => {
    const e = temoin((x) => {
      texteDe(x, "a1", "Bonjour, un temps plein pour des Excel.");
      texteDe(x, "c6", "Et devinez quoi ? Ce temps sert ailleurs.");
      segmentDe(x, "a1").ecritPar = "will";
    });
    const r = controlerSelonAuteurs(e);
    const machine = controlerVersion({ ...e, auteur: "machine" });
    const c5 = (x: typeof r) => x.violations.filter((v) => v.controle === "C5" && v.segmentIndex !== undefined && v.segmentIndex > 0);
    expect(c5(r).map((v) => v.niveau)).toEqual(c5(machine).map((v) => v.niveau));
    expect(c5(r).some((v) => v.bloquant)).toBe(true);
    expect(r.passe).toBe(false);
  });

  it("après la fabrication (horodatage réel) : un texte de Will n'est plus jugé au barème machine", () => {
    const e = temoin();
    const reel = horodaterSegments([...e.ouverture, ...e.corps, ...e.fin], e.debit).map((h) => ({ debutSec: +(h.debutSec * 1.7).toFixed(3), finSec: +(h.finSec * 1.7).toFixed(3) }));
    const recontrole = (x: typeof e) => recontrolerSurHorodatageReel(x, reel);
    expect(controlerSelonAuteurs(e, recontrole).violations.some((v) => v.bloquant)).toBe(true);
    const deWill = temoin((x) => [...x.ouverture, ...x.corps, ...x.fin].forEach((b) => b.segments.forEach((g) => (g.ecritPar = "will"))));
    const r = controlerSelonAuteurs(deWill, recontrole);
    expect(r.violations.filter((v) => v.bloquant)).toEqual([]);
    expect(r.violations).toEqual(recontrolerSurHorodatageReel({ ...deWill, auteur: "will" }, reel).violations);
  });

  it("sans phrase de Will : exactement le barème machine", () => {
    const e = temoin();
    expect(controlerSelonAuteurs(e).violations).toEqual(controlerVersion({ ...e, auteur: "machine" }).violations);
  });
});

const seg = (id: string, texte: string) => ({ id, texte });
const bloc = (blocRecette: string, ...segments: { id: string; texte: string }[]): BlocScript => ({ id: `b-${blocRecette}-${segments[0]?.id}`, blocRecette, segments });

const CORPS = [bloc("coeur", seg("c1", "Remplacer Excel, ici, voulait dire tout supprimer."), seg("c2", "Chez un client, 35 heures par semaine."))];
const TT: VersionDuLot = {
  varianteId: "var-tt",
  code: "0042-AV-TT",
  reseau: "tiktok",
  nomReseau: "TikTok",
  scriptId: "script-1",
  corpsScript: CORPS,
  versionsSurLeCorps: 2,
  segmentFacultatifRetenu: false,
  ouverture: [bloc("accroche", seg("a-tt", "Un temps plein pour des Excel."))],
  fin: [bloc("appel", seg("f-tt", "Envoyez-la à votre DAF."))],
  encadre: "Remplacer Excel",
};
const LI: VersionDuLot = { ...TT, varianteId: "var-li", code: "0042-AV-LI", reseau: "linkedin", nomReseau: "LinkedIn", ouverture: [bloc("accroche", seg("a-li", "35 heures par semaine."))], fin: [bloc("appel", seg("f-li", "Et vous ?"))], encadre: undefined };

describe("lignes du lot", () => {
  it("une version : début, milieu commun, fin ; l'encadré est un texte écrit modifiable", () => {
    const l = lignesDuLot([TT]);
    expect(l.map((x) => x.dit)).toEqual(["Un temps plein pour des Excel.", "Remplacer Excel, ici, voulait dire tout supprimer.", "Chez un client, 35 heures par semaine.", "Envoyez-la à votre DAF."]);
    expect(l.map((x) => x.groupe)).toEqual(["Début", "Milieu commun", "Milieu commun", "Fin"]);
    expect(l[0].ecrits).toEqual([{ texte: "Remplacer Excel", modifiable: true }]);
  });

  it("plusieurs versions : le milieu commun n'apparaît qu'une fois", () => {
    const l = lignesDuLot([TT, LI]);
    expect(l.filter((x) => x.dit.startsWith("Remplacer Excel, ici"))).toHaveLength(1);
    expect(l.map((x) => x.groupe)).toEqual(["Début · TikTok", "Début · LinkedIn", "Milieu commun", "Milieu commun", "Fin · TikTok", "Fin · LinkedIn"]);
  });

  it("les identifiants des lignes ne dépendent que du code et du segment (l'empreinte survit à une nouvelle version)", () => {
    const suite = { ...TT, varianteId: "var-tt-v2", scriptId: "script-2" };
    expect(empreinte(lignesDuLot([suite]))).toBe(empreinte(lignesDuLot([TT])));
  });
});

describe("appliquer les modifications", () => {
  it("rien de changé : aucun enregistrement", () => {
    const r = appliquerAuLot([TT, LI], lignesDuLot([TT, LI]));
    expect(r.ok && r.scripts.length + r.versions.length).toBe(0);
  });

  it("une phrase du milieu : le corps change une fois, la phrase est marquée « Will »", () => {
    const avant = lignesDuLot([TT, LI]);
    const id = avant.find((x) => x.dit.startsWith("Chez un client"))!.id;
    const r = appliquerAuLot([TT, LI], appliquerSaisie(avant, id, { dit: "Chez un client, une personne y passait 35 heures." }));
    if (!r.ok) throw new Error(r.raisons.join());
    expect(r.versions).toEqual([]);
    expect(r.scripts).toHaveLength(1);
    const s = r.scripts[0].blocs[0].segments.find((x) => x.id === "c2")!;
    expect(s).toMatchObject({ texte: "Chez un client, une personne y passait 35 heures.", ecritPar: "will" });
    expect(r.scripts[0].blocs[0].segments.find((x) => x.id === "c1")!.ecritPar).toBeUndefined();
  });

  it("le début d'un réseau et son encadré : seule cette version change", () => {
    const avant = lignesDuLot([TT, LI]);
    const id = avant[0].id;
    const apres = appliquerSaisie(appliquerSaisie(avant, id, { dit: "Un temps plein, juste pour des Excel." }), id, { ecrit: { index: 0, texte: "Fini *Excel*" } });
    const r = appliquerAuLot([TT, LI], apres);
    if (!r.ok) throw new Error(r.raisons.join());
    expect(r.scripts).toEqual([]);
    expect(r.versions.map((v) => v.code)).toEqual(["0042-AV-TT"]);
    expect(r.versions[0].ouverture?.[0].segments[0]).toMatchObject({ texte: "Un temps plein, juste pour des Excel.", ecritPar: "will" });
    expect(r.versions[0].encadre).toEqual("Fini *Excel*");
  });

  it("une phrase vidée ou un texte qui ne correspond plus au script : refus, rien n'est enregistré", () => {
    const avant = lignesDuLot([TT]);
    expect(appliquerAuLot([TT], appliquerSaisie(avant, avant[1].id, { dit: "  " })).ok).toBe(false);
    expect(appliquerAuLot([TT], avant.slice(1)).ok).toBe(false);
  });
});

describe("pastilles", () => {
  it("chaque contrôle d'une phrase est rattaché à SA ligne ; ceux du texte entier n'ont pas de ligne", () => {
    const v: VersionDuLot = { ...TT, ouverture: [bloc("accroche", seg("a-tt", "Bonjour, un temps plein pour des Excel."))] };
    const p = pastillesDeVersion(v, [{ controle: "C3 bis", message: "salut", bloquant: true, niveau: "bloquant", segmentIndex: 0 }, { controle: "C6", message: "trop long", bloquant: true, niveau: "bloquant" }], false);
    expect(p[0]).toMatchObject({ niveau: "bloquant", ligneId: lignesDuLot([v])[0].id, code: "C3 bis" });
    expect(p[1].ligneId).toBeUndefined();
  });

  it("« Fabriquer les N » : un contrôle du texte entier levé sur plusieurs réseaux n'apparaît qu'une fois", () => {
    const court = { controle: "C12", message: "court", bloquant: false, niveau: "info" as const };
    const long = { controle: "C6", message: "trop long", bloquant: true, niveau: "bloquant" as const };
    const p = pastillesDuLot([
      { version: TT, violations: [court, long] },
      { version: LI, violations: [court] },
    ]);
    expect(p.filter((x) => x.code === "C12")).toHaveLength(1);
    expect(p.find((x) => x.code === "C12")?.texte.startsWith("TikTok")).toBe(false);
    expect(p.find((x) => x.code === "C6")?.texte.startsWith("TikTok : ")).toBe(true);
  });
});
