/**
 * FIX-FIN-NON-CHOISIE (décision de Williams, 17/11) : le Studio ne dit et n'écrit jamais une phrase que l'utilisateur
 * n'a pas écrite ou choisie. Avec « La phrase de fin » = « Aucune » (`appelId` absent ou null), aucune question dite,
 * aucun cartouche « Votre réponse en commentaire », dans aucun format (TikTok et Shorts compris), aucune lecture de
 * voix en plus. Un choix explicite (fin de la banque, réglage `finLiens`) garde son comportement.
 * Essai réel : vidéo `v-237723e651c6` (« L'erreur corrigée », 9:16, TikTok coché).
 */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import type { FicheTableau } from "../../../src/moteurs/montage-tableau/fiche";
import { sortiesDesReseaux, type IdSortie } from "../../../src/moteurs/montage-tableau/formats-sortie";
import { mettreEnPage } from "../../../src/moteurs/montage-tableau/mise-en-page";
import { FIN_AUCUNE_CHOISIE, finDeLaSortie, relireFicheTableau, sortiesRelues } from "../../../src/moteurs/montage-tableau/relecture";
import { planVoixSorties } from "../../../src/moteurs/montage-tableau/variantes-fin";
import { estimerFabrication } from "../../../src/moteurs/montage-tableau/fabriquer";
import { avisFinTikTok, choisirFinTableau } from "../../../src/services/tableau-fin";
import { contexteDe } from "../reference-2/fiches";

const lire = () => JSON.parse(readFileSync(new URL("../temoins/fiche-temoin-v-667edcd8e3a8-reference-3.json", import.meta.url), "utf8")) as FicheTableau;
const temoin = lire();
const TOUS = ["instagram", "facebook", "tiktok", "youtube", "youtube-shorts", "linkedin", "verticaux", "horizontaux"];
const RESEAUX: [string, string[]][] = [
  ["tiktok", ["tiktok"]],
  ["instagram, tiktok, shorts", ["instagram", "tiktok", "youtube-shorts"]],
  ["tous les réseaux", TOUS],
];
const textesPosees = (f: FicheTableau, opts: Parameters<typeof mettreEnPage>[1] = {}) => mettreEnPage(f, opts).pages.flatMap((p) => p.elements.flatMap((e) => e.lignes.map((l) => l.texte)));
const fiches: [string, FicheTableau][] = [
  ["témoin tel quel (demonstration)", temoin],
  ["structure « erreur-corrigee »", { ...temoin, structure: "erreur-corrigee" } as FicheTableau],
];

describe("(a) « Aucune » : chaque sortie reçoit la fin absente nommée, sur tous les réseaux", () => {
  for (const [nomF, f] of fiches)
    for (const [nomR, reseaux] of RESEAUX)
      it(`${nomF} · ${nomR}`, () => {
        const sorties = sortiesDesReseaux(reseaux);
        expect(sorties.length).toBeGreaterThan(0);
        const choisir = choisirFinTableau({}, { sorties });
        for (const id of sorties) expect(finDeLaSortie(id, choisir(null, id), f)).toEqual({ absente: FIN_AUCUNE_CHOISIE });
        expect(sorties).toContain(reseaux.includes("tiktok") || reseaux === TOUS ? "vertical-liens" : sorties[0]);
      });
});

describe("(b) aucune lecture de voix en plus, prix jamais supérieur à la voix unique", () => {
  // NB (journal) : la règle du 14/10 reste vraie (`appelDitDeLaSortie`) : TikTok, Shorts et LinkedIn ne disent jamais
  // l'appel de la fiche ; le plan est donc « raccord » (corps seul) et non « unique » pour ces sorties. Rien n'est AJOUTÉ.
  for (const [nomR, reseaux] of RESEAUX) {
    const sorties = sortiesDesReseaux(reseaux);
    const choisir = choisirFinTableau({}, { sorties });
    const fins = sorties.map((id) => ({ id, fin: finDeLaSortie(id, choisir(null, id), temoin) }));
    it(`${nomR} : aucune lecture « fin » (la question de TikTok n'est plus lue)`, () => {
      const plan = planVoixSorties(temoin, fins);
      if (plan.mode !== "unique") expect(plan.lectures.filter((l) => l.role === "fin" && l.texte !== "Réservez un appel de diagnostic.")).toEqual([]);
      if (plan.mode !== "unique") for (const l of plan.lectures) expect(temoin.scenes.map((s) => s.texteDit).join(" ")).toContain(l.texte);
    });
    it(`${nomR} : estimerFabrication ne dépasse pas la voix unique`, () => {
      const seule = estimerFabrication(temoin, 0.03, []);
      const avec = estimerFabrication(temoin, 0.03, [], { sorties: fins });
      expect(avec.centimes).toBeLessThanOrEqual(seule.centimes + (avec.surcoutCentimes ?? 0));
      expect(avec.caracteres).toBeLessThanOrEqual(seule.caracteres);
    });
  }
  it("Reels seuls : voix unique, prix de la voix unique, aucun surcoût", () => {
    const fins = [{ id: "vertical" as IdSortie, fin: finDeLaSortie("vertical", choisirFinTableau({}, { sorties: ["vertical"] })(null, "vertical"), temoin) }];
    expect(planVoixSorties(temoin, fins).mode).toBe("unique");
    const avec = estimerFabrication(temoin, 0.03, [], { sorties: fins });
    expect(avec.surcoutCentimes).toBeUndefined();
    expect(avec.centimes).toBe(estimerFabrication(temoin, 0.03, []).centimes);
  });
});

describe("(c) rien n'est ajouté ni dit ni écrit (sortiesRelues)", () => {
  const sorties = sortiesDesReseaux(TOUS);
  const choisir = choisirFinTableau({}, { sorties });
  const relues = sortiesRelues(temoin, sorties, (id) => finDeLaSortie(id, choisir(null, id), temoin));
  const dit = (f: FicheTableau) => f.scenes.map((s) => s.texteDit).join(" ");
  for (const s of relues)
    it(`${s.id} : texte dit tiré de la fiche (jamais de phrase ajoutée), aucune phrase d'appel écrite en plus`, () => {
      expect(dit(temoin).startsWith(dit(s.fiche).replace(/\s+$/, ""))).toBe(true);
      const lignes = textesPosees(s.fiche, s.options);
      expect(lignes.filter((t) => /commentaire|chez vous|enregistrez|envoyez/i.test(t))).toEqual([]);
    });
  it("les Reels : la page d'appel garde la ligne d'appel de la fiche ; TikTok et Shorts : le site, sans phrase ajoutée", () => {
    const texteAppel = (id: string) => {
      const r = relues.find((x) => x.id === id)!;
      return mettreEnPage(r.fiche, r.options).pages.at(-1)!.elements.flatMap((e) => e.lignes.map((l) => l.texte)).join(" ");
    };
    expect(texteAppel("vertical")).toContain("Réservez un appel de diagnostic");
    expect(texteAppel("vertical-liens")).toContain("axion-ia.com");
    expect(texteAppel("vertical-liens")).not.toMatch(/commentaire|chez vous|tâche revient/i);
  });
});

describe("(d) non-régression : un choix explicite garde son comportement", () => {
  const sorties = sortiesDesReseaux(["instagram", "tiktok", "youtube-shorts"]);
  it("appelId « fin-if-mot-envoi » + mot : vertical-liens ne reçoit rien de la banque (fin retirée, signalée)", () => {
    const f = { ...temoin, appelId: "fin-if-mot-envoi" } as FicheTableau;
    const choisir = choisirFinTableau({}, { sorties, mot: "DEVIS" });
    const fin = finDeLaSortie("vertical-liens" as IdSortie, choisir(f.appelId ?? null, "vertical-liens" as IdSortie), f);
    // 18/11 (Williams, règle du 17/11, FIX-TABLEAU-FIN-RESEAUX) : la fin choisie fait loi
    expect(fin).toEqual({ absente: avisFinTikTok("Écrivez DEVIS en commentaire") });
  });
  it("réglage forcé finLiens « QUESTION » avec appelId null : objectif QUESTION (choix explicite)", () => {
    const choisir = choisirFinTableau({}, { sorties, finLiens: "QUESTION" });
    const fin = finDeLaSortie("vertical-liens" as IdSortie, choisir(null, "vertical-liens" as IdSortie), temoin);
    expect("objectif" in fin! && fin.objectif).toBe("QUESTION");
  });
});

describe("(e) relireFicheTableau : plus de message trompeur « Écrivez {MOT} »", () => {
  it("aucun point ne cite « Écrivez {MOT} »", async () => {
    const sorties = sortiesDesReseaux(TOUS);
    const choisirFin = choisirFinTableau({}, { sorties });
    const r = await relireFicheTableau({ fiche: lire(), contexte: contexteDe(temoin), dejaVu: { coche: true, le: "2026-10-14" }, sorties, choisirFin });
    expect(r.points.map((p) => p.message).filter((m) => /Écrivez \{MOT\}/.test(m))).toEqual([]);
    expect(JSON.stringify(r.rapport)).not.toMatch(/Écrivez \{MOT\}/);
  }, 30_000);
});
