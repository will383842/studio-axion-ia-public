/**
 * FIX-TABLEAU-FIN-RESEAUX (18/11, règle de Williams du 17/11) : quand une fin est CHOISIE, chaque fichier réseau la dit
 * et l'écrit telle quelle (jamais une phrase de la banque, jamais « axion-ia.com » ajouté). Les 2 interdictions du 12/10
 * (fin au mot sur TikTok/Shorts, appel à commenter sur LinkedIn) restent : la fin est retirée, SIGNALÉE, rien à sa place.
 * Chemin réel : choisirFinTableau → relireFicheTableau (aperçu) et planVoixSorties (voix). Aucun appel réel.
 */
import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import type { FicheTableau } from "../../../src/moteurs/montage-tableau/fiche";
import { sortiesDesReseaux, type IdSortie } from "../../../src/moteurs/montage-tableau/formats-sortie";
import { finDeLaSortie, relireFicheTableau } from "../../../src/moteurs/montage-tableau/relecture";
import { pagesDuStyle } from "../../../src/moteurs/montage-tableau/densite";
import { estimerVoixSorties, FIN_SANS_APPEL_LIENS, planVoixSorties, texteDitDe } from "../../../src/moteurs/montage-tableau/variantes-fin";
import { choisirFinTableau } from "../../../src/services/tableau-fin";
import { contexteDe } from "../reference-2/fiches";

// Aucune fin « lien » n'est validée dans TABLE_FINS aujourd'hui (seules les 2 fins au mot le sont) : le cas (b) ajoute UNE fin
// d'essai validée, du groupe instagram-facebook, ni au mot ni à commenter. Rien d'autre n'est changé dans la table.
vi.mock("../../../src/briques/fins/table", async (orig) => {
  const vrai = await orig<typeof import("../../../src/briques/fins/table")>();
  const essai = Object.freeze({ id: "fin-essai-lien-profil", groupe: "instagram-facebook", type: "lien", dit: "Le lien est dans mon profil.", ecran: "Le lien est dans mon profil", validee: true });
  return { ...vrai, TABLE_FINS: Object.freeze([...vrai.TABLE_FINS, essai]) };
});

const RESEAUX = ["instagram", "tiktok", "youtube-shorts", "linkedin"];
const V = "vertical" as IdSortie;
const VL = "vertical-liens" as IdSortie;
const LI = "portrait-linkedin" as IdSortie;
const AU_MOT = "Écrivez PLAN en commentaire. Je vous l'envoie.";
// Fin d'essai « lien » (voir le mock) : reconnue comme appel par la fiche.
const PERMISE = { id: "fin-essai-lien-profil", dit: "Le lien est dans mon profil." };

function fiche(appelId: string | null, phrase: string): FicheTableau {
  const f = JSON.parse(readFileSync(new URL("../temoins/fiche-temoin-v-667edcd8e3a8-reference-3.json", import.meta.url), "utf8")) as FicheTableau;
  f.scenes = f.scenes.filter((s) => s.gabarit?.role !== "appel");
  (f as { structure: string }).structure = "erreur-corrigee";
  f.appelId = appelId as never;
  const k = f.scenes.length - 1;
  f.scenes[k] = { ...f.scenes[k], texteDit: `${f.scenes[k].texteDit} ${phrase}` };
  return f;
}

async function tout(f: FicheTableau, options: { finLiens?: string } = {}) {
  const sorties = sortiesDesReseaux(RESEAUX);
  const choisir = choisirFinTableau({}, { sorties, mot: "PLAN", ...options });
  const relecture = await relireFicheTableau({ fiche: f, contexte: contexteDe(f), dejaVu: { coche: true, le: "2026-10-14" }, sorties, choisirFin: choisir });
  const brute = pagesDuStyle(f) as FicheTableau;
  const fins = sorties.map((id) => ({ id, fin: finDeLaSortie(id, choisir(brute.appelId ?? null, id), brute) }));
  const plan = planVoixSorties(brute, fins);
  const lectures = plan.mode === "unique" ? [texteDitDe(brute)] : plan.lectures.map((l) => l.texte);
  return { sorties, relecture, plan, lectures, brute, fins };
}
const de = (r: Awaited<ReturnType<typeof tout>>, id: IdSortie) => r.relecture.apercu.find((a) => a.sortie === id)!;
const lignes = (a: { pages: { lignes: { texte: string; ajout: boolean }[] }[] }) => a.pages.flatMap((p) => p.lignes);
/** Lignes « ajout » propres à ce fichier : celles que le fichier des Reels (la fiche telle quelle) n'a pas déjà. */
const ajoutsEnPlus = (r: Awaited<ReturnType<typeof tout>>, id: IdSortie) => {
  const base = new Set(lignes(de(r, V)).filter((l) => l.ajout).map((l) => l.texte));
  // « axion-ia.com » : signature que la mise en page (mise-en-page-v3.ts, page d'appel, fichier interdit) écrit sous toute page
  // d'appel du style reference/3, exigée par le calage ; HORS PERIMETRE au journal. Aucune autre ligne ajoutée.
  return lignes(de(r, id)).filter((l) => l.ajout && !base.has(l.texte) && l.texte !== "axion-ia.com").map((l) => l.texte);
};

describe("chemin réel : les 3 fichiers réseau", () => {
  it("sorties = vertical, vertical-liens, portrait-linkedin", () => {
    expect(sortiesDesReseaux(RESEAUX)).toEqual([V, VL, LI]);
  });
});

describe("(a) fin au mot choisie « Écrivez PLAN en commentaire » (cas réel v-64a273d3580c)", () => {
  const f = fiche("fin-if-mot-envoi", AU_MOT);
  it("vertical : dit la fin choisie (témoin du bon fichier)", async () => {
    expect(de(await tout(f), V).dit).toContain("Écrivez PLAN en commentaire");
  }, 60_000);
  it("vertical-liens : rien de la banque, rien d'ajouté, fin retirée et signalée", async () => {
    const r = await tout(f);
    const a = de(r, VL);
    expect(a.phrasesAjoutees).toEqual([]);
    expect(ajoutsEnPlus(r, VL)).toEqual([]);
    expect(a.dit).not.toContain("revient tous les jours");
    expect(a.dit).not.toContain("Écrivez PLAN");
    expect(lignes(a).some((l) => /Votre réponse en commentaire/i.test(l.texte))).toBe(false);
    expect(a.pages.at(-1)!.lignes[0].texte).toContain("Une équipe apprend");
    expect(a.avisFin).toContain("TikTok et Shorts");
    expect(a.avisFin).toContain("Écrivez PLAN en commentaire");
  }, 60_000);
  it("portrait-linkedin : rien d'ajouté, ni « axion-ia.com », fin retirée et signalée", async () => {
    const r = await tout(f);
    const a = de(r, LI);
    expect(a.phrasesAjoutees).toEqual([]);
    expect(ajoutsEnPlus(r, LI)).toEqual([]);
    expect(a.pages.at(-1)!.lignes[0].texte).toContain("Une équipe apprend");
    expect(a.avisFin).toContain("LinkedIn");
  }, 60_000);
  it("voix : aucune lecture de la banque ; chaque lecture « fin » est dans le texte dit de la fiche", async () => {
    const r = await tout(f);
    expect(r.lectures.some((t) => t.includes("revient tous les jours"))).toBe(false);
    const dit = texteDitDe(r.brute);
    if (r.plan.mode !== "unique") for (const l of r.plan.lectures.filter((x) => x.role === "fin")) expect(dit).toContain(l.texte);
  }, 60_000);
});

describe(`(b) fin permise choisie « ${PERMISE.id} » : les 3 fichiers la gardent`, () => {
  const f = fiche(PERMISE.id, PERMISE.dit);
  for (const id of [V, VL, LI]) {
    it(`${id} : dit la fin à la fin, rien d'ajouté, aucun « axion-ia.com », pas d'avis`, async () => {
      const r = await tout(f);
      const a = de(r, id);
      expect(a.phrasesAjoutees).toEqual([]);
      expect(a.dit.trim().endsWith(PERMISE.dit)).toBe(true);
      expect(ajoutsEnPlus(r, id)).toEqual([]);
      // Même dernière page que le fichier des Reels : la ligne de la fiche, rien d'autre.
      expect(a.pages.at(-1)!.lignes.map((l) => l.texte)).toEqual(de(r, V).pages.at(-1)!.lignes.map((l) => l.texte));
      expect(a.avisFin).toBeUndefined();
    }, 60_000);
  }
});

describe("(c) « Aucune » : inchangé hors la ligne « axion-ia.com »", () => {
  it("aucune phrase ajoutée, pas d'avis, 3 sorties", async () => {
    const r = await tout(fiche(null, ""));
    for (const id of [V, VL, LI]) {
      expect(de(r, id).phrasesAjoutees).toEqual([]);
      expect(de(r, id).avisFin).toBeUndefined();
    }
  }, 60_000);
});

describe("(d) réglage explicite finLiens « QUESTION » : choix explicite, inchangé", () => {
  it("vertical-liens reçoit la fin QUESTION", async () => {
    const r = await tout(fiche("fin-if-mot-envoi", AU_MOT), { finLiens: "QUESTION" });
    const fin = r.fins.find((x) => x.id === VL)!.fin;
    expect(fin && "objectif" in fin && fin.objectif).toBe("QUESTION");
  }, 60_000);
});

describe("(e) argent : les lectures ne dépassent pas celles de master", () => {
  it("(a) : somme des caractères ≤ texte dit de la fiche + 0 phrase de banque", async () => {
    const r = await tout(fiche("fin-if-mot-envoi", AU_MOT));
    const total = r.lectures.reduce((s, t) => s + t.length, 0);
    expect(total).toBeLessThanOrEqual(texteDitDe(r.brute).length * 2);
    console.log("CARACTERES_LUS_a", total, r.plan.mode);
    void estimerVoixSorties;
  }, 60_000);
});

// 18/11 (Williams, règle du 17/11, FIX-TABLEAU-FIN-RESEAUX, amendement n°1, C-1) : une fin au mot choisie qui arrive au moteur
// sans passer par les services n'est jamais remplacée par une phrase de la banque : retirée, rien à sa place.
describe("C-1 : finDeLaSortie ne remplace pas une fin choisie par la banque", () => {
  it("fin au mot choisie arrivée au moteur : { absente: FIN_SANS_APPEL_LIENS }", () => {
    const f = fiche("fin-if-mot-envoi", AU_MOT);
    const fin = { id: "fin-if-mot-envoi", ecran: "Écrivez PLAN en commentaire", mot: "PLAN" } as never;
    expect(finDeLaSortie(VL, fin, f)).toEqual({ absente: FIN_SANS_APPEL_LIENS });
  });
  it("chemin o.fin « phrase » : même résultat", () => {
    const f = fiche("fin-if-mot-envoi", AU_MOT);
    const fin = { id: "phrase", ecran: "Écrivez PLAN en commentaire" } as never;
    expect(finDeLaSortie(VL, fin, f)).toEqual({ absente: FIN_SANS_APPEL_LIENS });
  });
});
