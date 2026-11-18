/** FIX-ECRAN-SCENES-COMPLET : l'aperçu vient de la même mise en page que la fabrication. Aucun appel réel. */
import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import { apercuDesSorties } from "../../../src/moteurs/montage-tableau/apercu-sorties";
import type { FicheTableau } from "../../../src/moteurs/montage-tableau/fiche";
import { sortiesDesReseaux, type IdSortie } from "../../../src/moteurs/montage-tableau/formats-sortie";
import { mettreEnPage } from "../../../src/moteurs/montage-tableau/mise-en-page";
import { finDeLaSortie, relireFicheTableau, sortiesRelues } from "../../../src/moteurs/montage-tableau/relecture";
import { choisirFinTableau } from "../../../src/services/tableau-fin";
import { contexteDe, ficheReference2 } from "../reference-2/fiches";

// Cas (e) : on peut faire lever `apercuDesSorties` pour obtenir la relecture « sans aperçu » (référence des verdicts).
const interrupteur = vi.hoisted(() => ({ lever: false }));
vi.mock("../../../src/moteurs/montage-tableau/apercu-sorties", async (orig) => {
  const vrai = await orig<typeof import("../../../src/moteurs/montage-tableau/apercu-sorties")>();
  return { ...vrai, apercuDesSorties: (...a: Parameters<typeof vrai.apercuDesSorties>) => { if (interrupteur.lever) throw new Error("aperçu en panne"); return vrai.apercuDesSorties(...a); } };
});

const lire = () => JSON.parse(readFileSync(new URL("../temoins/fiche-temoin-v-667edcd8e3a8-reference-3.json", import.meta.url), "utf8")) as FicheTableau;
const temoin = lire();
const TOUS = ["instagram", "facebook", "tiktok", "youtube", "youtube-shorts", "linkedin", "verticaux", "horizontaux"];

function relues(f: FicheTableau, reseaux: string[], mot?: string) {
  const sorties = sortiesDesReseaux(reseaux);
  const choisir = choisirFinTableau({}, { sorties, ...(mot ? { mot } : {}) });
  return sortiesRelues(f, sorties, (id) => finDeLaSortie(id, choisir(f.appelId ?? null, id), f));
}
const lignesDe = (a: { pages: { lignes: { texte: string }[] }[] }) => a.pages.flatMap((p) => p.lignes.map((l) => l.texte));

describe("(a) fin CHOISIE : la phrase ajoutée et le mot sont montrés", () => {
  const f = { ...temoin, appelId: "fin-if-mot-envoi" } as FicheTableau;
  const ap = apercuDesSorties(f, relues(f, ["instagram", "tiktok", "youtube-shorts"], "GUIDE"));
  it("vertical-liens : aucune phrase ajoutée ni « axion-ia.com » ajouté, fin retirée et signalée", () => {
    // 18/11 (Williams, règle du 17/11, FIX-TABLEAU-FIN-RESEAUX) : la fin choisie fait loi : fin au mot choisie, retirée de TikTok et Shorts (règle du 12/10), rien à sa place.
    const a = ap.find((x) => x.sortie === ("vertical-liens" as IdSortie))!;
    expect(a.phrasesAjoutees).toEqual([]);
    const derniere = a.pages[a.pages.length - 1];
    expect(derniere.lignes.some((l) => l.ajout && l.texte !== "axion-ia.com")).toBe(false);
    // `avisFin` est posé par `relireFicheTableau` (couvert par fin-choisie-par-reseau.test.ts) ; ici, la fin retenue qui le porte.
    const sorties = sortiesDesReseaux(["instagram", "tiktok", "youtube-shorts"]);
    const retenue = finDeLaSortie("vertical-liens" as IdSortie, choisirFinTableau({}, { sorties, mot: "GUIDE" })(f.appelId ?? null, "vertical-liens" as IdSortie), f);
    expect(retenue && "absente" in retenue && retenue.absente).toContain("Sur TikTok et Shorts, votre fin « Écrivez GUIDE en commentaire »");
  });
  it("vertical : GUIDE montré si et seulement si la mise en page le pose (constat au journal : reference/3 ne pose pas le mot)", () => {
    const a = ap.find((x) => x.sortie === ("vertical" as IdSortie))!;
    const r = relues(f, ["instagram", "tiktok", "youtube-shorts"], "GUIDE").find((x) => x.id === ("vertical" as IdSortie))!;
    const pose = mettreEnPage(r.fiche, r.options).pages.some((p) => p.elements.some((e) => e.lignes.some((l) => l.texte.includes("GUIDE"))));
    expect(lignesDe(a).some((t) => t.includes("GUIDE"))).toBe(pose);
  });
});

describe("(b) « Aucune » : rien d'ajouté sauf le site", () => {
  const ap = apercuDesSorties(temoin, relues(temoin, ["instagram", "tiktok", "youtube-shorts"]));
  it("aucune phrase ajoutée, aucune ligne « commentaire »", () => {
    for (const a of ap) {
      expect(a.phrasesAjoutees).toEqual([]);
      expect(lignesDe(a).join(" ")).not.toMatch(/commentaire/i);
    }
  });
  it("la page d'appel : seule ligne ajoutée = axion-ia.com", () => {
    for (const a of ap) {
      const ajouts = a.pages[a.pages.length - 1].lignes.filter((l) => l.ajout).map((l) => l.texte.toLowerCase());
      expect(ajouts).toEqual(["axion-ia.com"]);
    }
    expect(ap.some((a) => a.pages.some((p) => p.lignes.some((l) => l.ajout && /axion-ia\.com/i.test(l.texte))))).toBe(true);
  });
});

describe("(c) exhaustivité : rien d'omis, rien d'inventé", () => {
  for (const [nom, f] of [["témoin", temoin], ["erreur-corrigee", { ...temoin, structure: "erreur-corrigee" } as FicheTableau], ["fin choisie", { ...temoin, appelId: "fin-if-mot-envoi" } as FicheTableau]] as [string, FicheTableau][])
    it(nom, () => {
      const rel = relues(f, TOUS, "GUIDE");
      const ap = apercuDesSorties(f, rel);
      expect(ap.length).toBe(rel.length);
      rel.forEach((s, i) => {
        const attendu = mettreEnPage(s.fiche, s.options).pages.flatMap((p) =>
          p.elements.flatMap((e) => {
            const g = (e.gabarit as { texte?: { texte?: string } } | undefined)?.texte?.texte?.trim();
            const l = e.lignes.map((x) => x.texte).join(" ").trim();
            return [...(l ? [l] : []), ...(g ? [g] : [])];
          }),
        );
        expect(lignesDe(ap[i])).toEqual(attendu);
      });
    });
});

describe("(d) une ligne non posée par la mise en page n'est pas promise", () => {
  it("page d'appel à 3 lignes : l'aperçu ne montre que ce que la mise en page écrit", () => {
    const f = structuredClone(temoin) as FicheTableau;
    const derniere = f.scenes[f.scenes.length - 1];
    const inedit = "Ligne neuve jamais posée zzq";
    derniere.elements.push({ id: "e98", type: "ligne", texte: "Deuxième demande de la page", niveau: "texte", role: "regle", bloc: "phrase-cle", ancre: 0 } as never, { id: "e99", type: "ligne", texte: inedit, niveau: "texte", role: "regle", bloc: "phrase-cle", ancre: 0 } as never);
    const rel = relues(f, ["instagram"]);
    const posees = mettreEnPage(rel[0].fiche, rel[0].options).pages.flatMap((p) => p.elements.flatMap((e) => e.lignes.map((l) => l.texte))).join(" ");
    const ap = apercuDesSorties(f, rel);
    expect(posees.includes(inedit)).toBe(false);
    expect(lignesDe(ap[0]).join(" ")).not.toContain(inedit);
  });
});

describe("(e) relireFicheTableau rend `apercu`", () => {
  it("fiche valide : un aperçu par sortie, verdict inchangé", async () => {
    const sorties = sortiesDesReseaux(["instagram", "tiktok"]);
    const choisirFin = choisirFinTableau({}, { sorties });
    const r = await relireFicheTableau({ fiche: lire(), contexte: contexteDe(temoin), dejaVu: { coche: true, le: "2026-10-14" }, sorties, choisirFin });
    expect(r.apercu.map((a) => a.sortie)).toEqual(sorties);
    expect(typeof r.ok).toBe("boolean");
    expect(Array.isArray(r.points)).toBe(true);
  }, 30_000);
  it("verdicts (ok, rapport, points) identiques avec ou sans aperçu, sur 2 témoins ; aperçu [] si le calcul lève", async () => {
    const sorties = sortiesDesReseaux(["instagram", "tiktok"]);
    const choisirFin = choisirFinTableau({}, { sorties });
    for (const f of [lire(), ficheReference2("relances")]) {
      const e = { fiche: f, contexte: contexteDe(temoin), dejaVu: { coche: true, le: "2026-10-14" }, sorties, choisirFin };
      interrupteur.lever = false;
      const avec = await relireFicheTableau(e);
      interrupteur.lever = true;
      try {
        const sans = await relireFicheTableau(e);
        expect(sans.apercu).toEqual([]);
        expect({ ok: avec.ok, rapport: avec.rapport, points: avec.points }).toEqual({ ok: sans.ok, rapport: sans.rapport, points: sans.points });
      } finally {
        interrupteur.lever = false;
      }
      expect(avec.apercu.length).toBe(sorties.length);
    }
  }, 60_000);
  it("fiche illisible : apercu [] sans exception", async () => {
    const r = await relireFicheTableau({ fiche: { n: "importe quoi" }, contexte: contexteDe(temoin), sorties: ["vertical"] });
    expect(r.apercu).toEqual([]);
    expect(r.ok).toBe(false);
  }, 30_000);
});
