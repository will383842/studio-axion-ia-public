/**
 * S-13-b-v20j : option `preteAvecRemarques` du moteur du tableau. Absente (ou autre chose que `true`), rien ne change.
 * Donnée : une variété refusée (après le montage ou avant la voix) devient une remarque ; la liste fermée reste bloquante.
 * Chemin réel : `controlerVideoTableau`, `relireFicheTableau`, `qualiteDe`, `fabriquerTableau` (doubles, 0 €).
 */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import type { ResumeVisuel } from "../../../src/briques/variete";
import { PREFIXE_REMARQUE_LIVRAISON } from "../../../src/domaine/livraison-avec-remarques";
import { controlerVideoTableau, type EntreeControleTableau } from "../../../src/moteurs/montage-tableau/controles";
import { fabriquerTableau } from "../../../src/moteurs/montage-tableau/fabriquer";
import { sortiesDesReseaux } from "../../../src/moteurs/montage-tableau/formats-sortie";
import { qualiteDe } from "../../../src/moteurs/montage-tableau";
import type { FicheTableau } from "../../../src/moteurs/montage-tableau/fiche";
import { relireFicheTableau, sortiesRelues } from "../../../src/moteurs/montage-tableau/relecture";
import { choisirFinTableau } from "../../../src/services/tableau-fin";
import { doubles } from "../fabriquer/doubles";
import { contexteExemple, copie, ficheErreurCorrigee } from "../regles/exemples";
import { scene } from "../regles/outils";

const MESURES = { lufs: -14, creteVraieDbtp: -2, imageNoireTete: 0, imagesNoiresHorsFin: 0, imagesFigeesHorsFin: 0, dureeSec: 60, vmaf: 95, vmafSeuil: 90 };
const RELECTURE_RAS = { relireImagesCles: () => ({ imagesLues: 6, remarques: [] }) };
const DEJA_VU = [{ structure: "erreur-corrigee", dessins: ["autre-1"], accroche: "Tout autre sujet ici", format: "tableau-anime" }] as ResumeVisuel[];

const entree = (extra: Partial<EntreeControleTableau> = {}): EntreeControleTableau => {
  const fiche = copie(ficheErreurCorrigee);
  return { fiche, contexte: contexteExemple(fiche), historique: [], dejaVu: { coche: true, le: "2026-10-10" }, mesures: MESURES, ...extra };
};
const OPTION = { preteAvecRemarques: true as const };
const libelles = (l: { libelle: string }[]) => l.map((x) => x.libelle);

describe("(a) éteint = identique", () => {
  const cas: [string, Partial<EntreeControleTableau>][] = [
    ["variété refusée", { historique: DEJA_VU }],
    ["déjà-vu non coché", { dejaVu: { coche: false } }],
    ["durée 200 s", { mesures: { ...MESURES, dureeSec: 200 } }],
    ["image noire au début", { mesures: { ...MESURES, imageNoireTete: 1 } }],
    ["volume faible", { mesures: { ...MESURES, lufs: -20 } }],
  ];
  for (const apresMontage of [false, true]) {
    it.each(cas)(`%s (apresMontage ${apresMontage}) : l'option absente, undefined ou fausse rend le même rapport`, async (_n, extra) => {
      const base = await controlerVideoTableau(entree({ ...extra, apresMontage }), RELECTURE_RAS);
      for (const v of [{}, { preteAvecRemarques: undefined }, { preteAvecRemarques: "true" }, { preteAvecRemarques: 1 }, { preteAvecRemarques: {} }]) {
        expect(await controlerVideoTableau(entree({ ...extra, apresMontage, ...(v as object) }), RELECTURE_RAS)).toEqual(base);
      }
      expect(base.lignes.some((l) => l.remarque)).toBe(false);
    });
  }
  it("fiche refusée : bloque comme avant, avec l'option", async () => {
    const fiche = copie(ficheErreurCorrigee);
    scene(fiche, "s03").texteDit = "Autre texte que le script validé.";
    const e = { ...entree({ fiche }), contexte: contexteExemple(copie(ficheErreurCorrigee)), apresMontage: true };
    const sans = await controlerVideoTableau(e, RELECTURE_RAS);
    expect(await controlerVideoTableau({ ...e, ...OPTION }, RELECTURE_RAS)).toEqual(sans);
    expect(sans.verdict).toBe("bloque");
  });
});

describe("(b) variété refusée après le montage", () => {
  it("avec l'option : livrable, 1 remarque ; sans : bloque", async () => {
    expect((await controlerVideoTableau(entree({ historique: DEJA_VU, apresMontage: true }), RELECTURE_RAS)).verdict).toBe("bloque");
    const r = await controlerVideoTableau(entree({ historique: DEJA_VU, apresMontage: true, ...OPTION }), RELECTURE_RAS);
    expect(r.verdict).toBe("livrable");
    expect(r.lignes.filter((l) => l.remarque)).toHaveLength(1);
    const alertes = qualiteDe(r, undefined, undefined).alertes;
    const a = alertes.find((x) => x.gravite === "bloquant");
    expect(a?.message.startsWith(`${PREFIXE_REMARQUE_LIVRAISON}Variété`)).toBe(true);
  });
});

describe("(c) variété refusée avant la voix", () => {
  const fiche = copie(ficheErreurCorrigee);
  const relire = (extra: object, dejaVu: { coche: boolean; le?: string } = { coche: true, le: "2026-10-10" }) =>
    relireFicheTableau({ fiche, contexte: contexteExemple(fiche), historique: DEJA_VU, dejaVu, sorties: ["vertical"], ...extra });
  it("l'option rend la relecture livrable ; sans : bloque", async () => {
    expect((await relire({})).rapport.verdict).toBe("bloque");
    const { rapport } = await relire(OPTION);
    expect(rapport.verdict).toBe("livrable");
    expect(rapport.lignes.some((l) => l.remarque && l.famille === "variete")).toBe(true);
  });
  it("déjà-vu non coché : toujours bloquant avec l'option", async () => {
    const { rapport } = await relire(OPTION, { coche: false });
    expect(rapport.verdict).toBe("bloque");
    expect(rapport.bloquants.map((l) => l.famille)).toEqual(["deja-vu"]);
  });
});

describe("(d) liste fermée : durée et phrase non choisie", () => {
  it("durée 200 s bloque, même message", async () => {
    const e = entree({ apresMontage: true, mesures: { ...MESURES, dureeSec: 200 } });
    const sans = await controlerVideoTableau(e, RELECTURE_RAS);
    const avec = await controlerVideoTableau({ ...e, ...OPTION }, RELECTURE_RAS);
    expect(avec.verdict).toBe("bloque");
    expect(avec.phrases).toEqual(sans.phrases);
  });
  it("une ligne « Phrase non choisie » reste bloquante (famille fiche)", async () => {
    const fiche = copie(ficheErreurCorrigee);
    scene(fiche, "s03").texteDit = "Autre texte que le script validé.";
    const r = await controlerVideoTableau({ ...entree({ fiche, apresMontage: true, ...OPTION }), contexte: contexteExemple(copie(ficheErreurCorrigee)) }, RELECTURE_RAS);
    expect(r.verdict).toBe("bloque");
  });
});

describe("(d2) liste fermée par le chemin normal, APRÈS le montage (fiche de sortie : retour anticipé exclu)", () => {
  const PHRASE_BANQUE = "Et chez vous, quelle tâche revient tous les jours ?";
  const f = (JSON.parse(readFileSync(new URL("../temoins/blocage-fin-tiktok-2026-10-14.json", import.meta.url), "utf8")) as { fiche: FicheTableau }).fiche;
  f.appelId = "fin-if-mot-envoi" as never;
  const contexte = {
    aujourdhui: "2026-10-14",
    sourcesChiffres: [],
    preuves: [],
    matieres: [...new Set(f.scenes.flatMap((s) => s.elements).flatMap((e) => (e.type === "preuve" ? [e.preuveId] : [])))].map((id) => ({ id, type: "demonstration" as const, statut: "validee" as const, perimeLe: "2027-01-09" })),
    texteScript: f.scenes.map((s) => s.texteDit).join(" "),
  };
  const choisir = choisirFinTableau({}, { sorties: sortiesDesReseaux(["verticaux"]), mot: "REPONSES" });
  const preparees = sortiesRelues(f, sortiesDesReseaux(["verticaux"]), (id) => choisir(f.appelId ?? null, id));
  const variante = structuredClone(preparees[1].fiche);
  variante.scenes[variante.scenes.length - 1].texteDit += ` ${PHRASE_BANQUE}`;
  const base = (en: object): EntreeControleTableau =>
    ({ fiche: variante, contexte: { ...contexte, texteScript: variante.scenes.map((x) => x.texteDit).join(" ") }, historique: [], dejaVu: { coche: true, le: "2026-10-14" }, mesures: MESURES, apresMontage: true, ficheReference: f, sorties: [{ id: preparees[1].id, libelle: preparees[1].libelle, fiche: variante, options: preparees[1].options }], ...en }) as EntreeControleTableau;

  it("« Phrase non choisie » : bloquante avec l'option, aucune remarque, ligne conservée", async () => {
    const sans = await controlerVideoTableau(base({}), RELECTURE_RAS);
    const avec = await controlerVideoTableau(base(OPTION), RELECTURE_RAS);
    expect(avec.verdict).toBe("bloque");
    expect(avec.bloquants.some((l) => l.libelle === "Phrase non choisie" && l.raison.includes("revient tous les jours"))).toBe(true);
    expect(avec.lignes.some((l) => l.remarque)).toBe(false);
    expect(avec).toEqual(sans);
  }, 60_000);
  it("« Fiche de chaque sortie » (sortiesImpossibles) : bloquante avec l'option, aucune remarque", async () => {
    const e = base({ sortiesImpossibles: ["Sortie impossible : écran manquant."] });
    const avec = await controlerVideoTableau({ ...e, ...OPTION }, RELECTURE_RAS);
    expect(avec.verdict).toBe("bloque");
    expect(avec.bloquants.some((l) => l.libelle === "Fiche de chaque sortie")).toBe(true);
    expect(avec.lignes.some((l) => l.remarque)).toBe(false);
  }, 60_000);
});

describe("(e) image noire", () => {
  it("au début : bloque ; hors début : déclassée en attention, pas une remarque", async () => {
    const debut = await controlerVideoTableau(entree({ apresMontage: true, mesures: { ...MESURES, imageNoireTete: 1 }, ...OPTION }), RELECTURE_RAS);
    expect(debut.verdict).toBe("bloque");
    expect(libelles(debut.bloquants)).toContain("Image noire");
    const hors = await controlerVideoTableau(entree({ apresMontage: true, mesures: { ...MESURES, imagesNoiresHorsFin: 2 }, ...OPTION }), RELECTURE_RAS);
    expect(hors.verdict).toBe("livrable");
    expect(hors.lignes.some((l) => l.declasse)).toBe(true);
    expect(hors.lignes.some((l) => l.remarque)).toBe(false);
  });
});

describe("(f) par la fabrication (doubles, 0 €)", () => {
  const sorties = sortiesDesReseaux(["verticaux"]);
  const fabriquer = async (extra: object) => {
    const f = copie(ficheErreurCorrigee);
    const d = doubles(f);
    return fabriquerTableau({ ...d.outils, contexte: contexteExemple(f), historique: DEJA_VU, sorties, choisirFin: choisirFinTableau({}, { sorties, mot: "REPONSES" }), dejaVu: { coche: true, le: "2026-10-10" }, ...extra });
  };
  it("sans l'option : arrêt à l'étape « script » ; avec : la vidéo est faite, la remarque est dite", async () => {
    await expect(fabriquer({})).rejects.toThrow();
    const r = await fabriquer(OPTION);
    expect(r.sorties.length).toBeGreaterThan(0);
    for (const s of r.sorties) {
      expect(s.controles.verdict).toBe("livrable");
      expect((s.alertes ?? []).some((a) => a.gravite === "bloquant" && a.message.startsWith(`${PREFIXE_REMARQUE_LIVRAISON}Variété`))).toBe(true);
    }
  }, 120_000);
  it("option `\"true\"` ou 1 : traitée comme absente", async () => {
    await expect(fabriquer({ preteAvecRemarques: "true" })).rejects.toThrow();
    await expect(fabriquer({ preteAvecRemarques: 1 })).rejects.toThrow();
  }, 120_000);
});
