/**
 * FIX-RENDU-PHRASE-NON-CHOISIE (rendu réel `v-64a273d3580c`, 19/11) : après le montage, le contrôle « Phrase non choisie »
 * comparait chaque fichier à la fiche DU FICHIER (déjà variante) : il se comparait à lui-même et ne voyait rien. Il compare
 * maintenant à la fiche de l'UTILISATEUR (`ficheReference`). Chemin réel : `fabriquerTableau` (doubles, aucun appel payant).
 * Pour (a), la phrase de la banque est injectée dans la variante TikTok/Shorts (le défaut d'avant FIX-TABLEAU-FIN-RESEAUX).
 */
import { readFileSync } from "node:fs";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { controlerVideoTableau } from "../../../src/moteurs/montage-tableau/controles";
import { fabriquerTableau } from "../../../src/moteurs/montage-tableau/fabriquer";
import type { FicheTableau } from "../../../src/moteurs/montage-tableau/fiche";
import { sortiesDesReseaux, type IdSortie } from "../../../src/moteurs/montage-tableau/formats-sortie";
import { sortiesRelues } from "../../../src/moteurs/montage-tableau/relecture";
import { choisirFinTableau } from "../../../src/services/tableau-fin";
import { doubles } from "../fabriquer/doubles";

const PHRASE_BANQUE = "Et chez vous, quelle tâche revient tous les jours ?";
const etat = vi.hoisted(() => ({ injecter: false, pret: false, phrase: "" }));

// Injection : dans le plan des voix, la variante qui porte « vertical-liens » reçoit la phrase de la banque en fin de dernière scène.
vi.mock("../../../src/moteurs/montage-tableau/variantes-fin", async (orig) => {
  const vrai = await orig<typeof import("../../../src/moteurs/montage-tableau/variantes-fin")>();
  return {
    ...vrai,
    planVoixSorties: (...a: Parameters<typeof vrai.planVoixSorties>) => {
      const plan = vrai.planVoixSorties(...a);
      if (!etat.injecter || !etat.pret || plan.mode === "unique") return plan;
      const lecture = { id: "fin-injectee", role: "fin" as const, texte: etat.phrase };
      return {
        ...plan,
        lectures: [...plan.lectures, lecture],
        variantes: plan.variantes.map((v) => {
          if (!v.sorties.includes("vertical-liens" as IdSortie)) return v;
          const f = structuredClone(v.fiche);
          const k = f.scenes.length - 1;
          f.scenes[k] = { ...f.scenes[k], texteDit: `${f.scenes[k].texteDit} ${etat.phrase}` };
          return { ...v, fiche: f, fin: lecture.id };
        }),
      };
    },
  };
});

// L'injection ne commence qu'APRÈS la relecture d'avant la voix (sinon la relecture l'arrête avant la fabrication) :
// c'est le cas réel, où le défaut n'apparaît qu'au montage.
vi.mock("../../../src/moteurs/montage-tableau/relecture", async (orig) => {
  const vrai = await orig<typeof import("../../../src/moteurs/montage-tableau/relecture")>();
  return {
    ...vrai,
    relireFicheTableau: async (...a: Parameters<typeof vrai.relireFicheTableau>) => {
      const r = await vrai.relireFicheTableau(...a);
      etat.pret = true;
      return r;
    },
  };
});

const sorties = sortiesDesReseaux(["verticaux"]);
const MOT = "REPONSES";

/** Fiche témoin du 14/10 (valide pour la fabrication, fin au mot « REPONSES » choisie) ; `appelId` null = fin « Aucune ». */
function fiche(appelId: string | null): FicheTableau {
  const f = (JSON.parse(readFileSync(new URL("../temoins/blocage-fin-tiktok-2026-10-14.json", import.meta.url), "utf8")) as { fiche: FicheTableau }).fiche;
  f.appelId = appelId as never;
  return f;
}
const contexteFab = (f: FicheTableau) => ({
  aujourdhui: "2026-10-14",
  sourcesChiffres: [],
  preuves: [],
  matieres: [...new Set(f.scenes.flatMap((s) => s.elements).flatMap((e) => (e.type === "preuve" ? [e.preuveId] : [])))].map((id) => ({ id, type: "demonstration" as const, statut: "validee" as const, perimeLe: "2027-01-09" })),
  texteScript: f.scenes.map((s) => s.texteDit).join(" "),
});

async function fabriquer(f: FicheTableau) {
  const d = doubles(f);
  return fabriquerTableau({
    ...d.outils,
    contexte: contexteFab(f),
    sorties,
    choisirFin: choisirFinTableau({}, { sorties, mot: MOT }),
    dejaVu: { coche: true, le: "2026-10-14" },
  });
}
const lignesPhrase = (r: Awaited<ReturnType<typeof fabriquer>>, id: string) => r.sorties.find((s) => s.format === id)!.controles.bloquants.filter((l) => l.libelle === "Phrase non choisie");

beforeEach(() => {
  etat.injecter = false;
  etat.pret = false;
  etat.phrase = PHRASE_BANQUE;
});

describe("(a) fichier TikTok/Shorts qui dit une phrase de la banque non choisie", () => {
  it("fabrication réelle : « Phrase non choisie » bloquante, qui cite la phrase, sur vertical-liens seulement", async () => {
    etat.injecter = true;
    const r = await fabriquer(fiche("fin-if-mot-envoi"));
    const l = lignesPhrase(r, "vertical-liens");
    expect(l).toHaveLength(1);
    expect(l[0].raison).toContain("Et chez vous, quelle tâche revient tous les jours");
    expect(lignesPhrase(r, "vertical")).toEqual([]);
  }, 120_000);
});

describe("(b) après FIX-TABLEAU-FIN-RESEAUX : aucune vidéo saine refusée", () => {
  it("les sorties n'ont aucune ligne « Phrase non choisie »", async () => {
    const r = await fabriquer(fiche("fin-if-mot-envoi"));
    expect(r.sorties.map((s) => s.format)).toEqual(["vertical", "vertical-liens"]);
    for (const s of r.sorties) expect(lignesPhrase(r, s.format), s.format).toEqual([]);
  }, 120_000);
});

describe("(c) fin « Aucune » et fiche sans appel : rapport identique à master", () => {
  it("aucune ligne neuve sur aucune sortie", async () => {
    const r = await fabriquer(fiche(null));
    for (const s of r.sorties) expect(lignesPhrase(r, s.format), s.format).toEqual([]);
  }, 120_000);
});

describe("(d) controlerVideoTableau", () => {
  const f = fiche("fin-if-mot-envoi");
  const choisir = choisirFinTableau({}, { sorties, mot: MOT });
  const preparees = sortiesRelues(f, sorties, (id) => choisir(f.appelId ?? null, id));
  const variante = structuredClone(preparees[1].fiche);
  variante.scenes[variante.scenes.length - 1].texteDit += ` ${PHRASE_BANQUE}`;
  const entree = (en: object) => ({ fiche: variante, contexte: contexteFab(variante), historique: [], dejaVu: { coche: true, le: "2026-10-14" }, sorties: [{ id: preparees[1].id, libelle: preparees[1].libelle, fiche: variante, options: preparees[1].options }], ...en });

  it("sans ficheReference : rapport identique à master (le fichier est comparé à lui-même, rien n'est signalé)", async () => {
    const sans = await controlerVideoTableau(entree({}));
    expect(sans.bloquants.filter((l) => l.libelle === "Phrase non choisie")).toEqual([]);
    expect(await controlerVideoTableau(entree({ ficheReference: undefined }))).toEqual(sans);
  }, 60_000);
  it("avec ficheReference (fiche de l'utilisateur) : la phrase non choisie est signalée", async () => {
    const avec = await controlerVideoTableau(entree({ ficheReference: f }));
    expect(avec.bloquants.some((l) => l.libelle === "Phrase non choisie" && l.raison.includes("revient tous les jours"))).toBe(true);
  }, 60_000);
});
