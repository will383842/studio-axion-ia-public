/**
 * LES 4 DÉFAUTS DE LA VIDÉO D'ESSAI v-667edcd8e3a8 (jugée « catastrophe » par Will le 15/10/2026), sur le témoin
 * reconstitué depuis la capture `maquettes/tableau-v2/references/tableau-actuel-video-essai-v-667edcd8e3a8.jpg` (même
 * texte écrit que la vidéo, texte dit repris de ses sous-titres) :
 *  (a) fin de TikTok et Shorts : « Enregistrez pour la retrouver » écrit en grand ET le bouton « Réservez un appel » :
 *      deux demandes. Une fin = UNE demande ;
 *  (b) chiffres dits mais retirés de l'écran (« dix minutes » → « des minutes », « Trois tâches » → « Tâches ») : sur
 *      l'exemple illustratif, le chiffre dit s'écrit (mention visible) ; ailleurs, la phrase tronquée est refusée ;
 *  (c) titre d'étape répété dans la phrase (« Faites rédiger / Faites rédiger les réponses… ») ;
 *  (d) étiquette de l'exemple répétée dans le texte (« Avant / Avant, chaque mail… »).
 */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { remettreEnForme } from "../../../src/moteurs/montage-tableau/decoupage";
import type { FicheTableau } from "../../../src/moteurs/montage-tableau/fiche";
import { sortiesDesReseaux } from "../../../src/moteurs/montage-tableau/formats-sortie";
import { regleGabarit3 } from "../../../src/moteurs/montage-tableau/gabarit-3";
import { mettreEnPage } from "../../../src/moteurs/montage-tableau/mise-en-page";
import { regleChiffresSources } from "../../../src/moteurs/montage-tableau/regles";
import { chiffresDits } from "../../../src/moteurs/montage-tableau/fidelite-texte";
import { STYLES_TABLEAU } from "../../../src/briques/tableau-scene/trois-styles/styles";
import { ficheTemoinV667Corrige } from "./fiches";
import { finDeLaSortie, sortiesRelues } from "../../../src/moteurs/montage-tableau/relecture";
import { choisirFinTableau } from "../../../src/services/tableau-fin";

const brute = JSON.parse(readFileSync(new URL("../temoins/fiche-temoin-v-667edcd8e3a8-reference-3.json", import.meta.url), "utf8")) as FicheTableau;
const temoin = remettreEnForme(brute, { motsDouleur: ["mails", "temps"] });
const contexte = { aujourdhui: "2026-10-15", sourcesChiffres: [], preuves: [], matieres: [], texteScript: temoin.scenes.map((s) => s.texteDit).join(" ") };
const textes = (f: FicheTableau, opts: Parameters<typeof mettreEnPage>[1] = {}) => mettreEnPage(f, opts).pages.map((p) => p.elements.map((e) => ({ sorte: e.gabarit?.sorte ?? e.type, texte: e.lignes.map((l) => l.texte).join(" ") })));
const DEMANDE = /\b(r[ée]servez|enregistrez|[ée]crivez|commentez|abonnez|partagez|envoyez|cliquez|t[ée]l[ée]chargez)\b/iu;

describe("(a) fin de TikTok et Shorts : une seule demande", () => {
  const sorties = sortiesDesReseaux(["verticaux"]);
  const choisirFin = choisirFinTableau({}, { sorties });
  const fins = (id: (typeof sorties)[number]) => finDeLaSortie(id, choisirFin(temoin.appelId ?? null, id), temoin);
  const [reels, liens] = sortiesRelues(temoin, sorties, fins);

  it("la variante TikTok et Shorts : la phrase de la fin, le site, et AUCUN bouton « Réservez un appel »", () => {
    const appel = textes(liens.fiche, { appel: liens.appel ?? undefined }).at(-1)!;
    const demandes = appel.filter((e) => DEMANDE.test(e.texte));
    expect(demandes.map((e) => e.texte)).toEqual(["Enregistrez pour la retrouver"]);
    expect(appel.some((e) => e.sorte === "bouton")).toBe(false);
    expect(appel.map((e) => e.texte).join(" ")).toContain("axion-ia.com");
  });

  it("les Reels (fin de la fiche) : une seule demande aussi, le bouton porte « Réservez un appel de diagnostic »", () => {
    const appel = textes(reels.fiche, { appel: reels.appel ?? undefined }).at(-1)!;
    expect(appel.filter((e) => DEMANDE.test(e.texte)).length).toBe(1);
  });

  it("une fiche dont l'appel est la seule ligne : il n'est pas écrit deux fois (titre ET bouton)", () => {
    const f: FicheTableau = { ...temoin, scenes: temoin.scenes.map((s, i, t) => (i === t.length - 1 ? { ...s, texteDit: "Réservez un appel de diagnostic.", elements: s.elements.filter((e) => e.type === "ligne" && e.bloc === "appel").map((e) => ({ ...e, ancre: 0 })) } : s)) };
    const appel = textes(f).at(-1)!;
    expect(appel.filter((e) => DEMANDE.test(e.texte)).length).toBe(1);
  });
});

describe("(b) chiffres dits, jamais une phrase tronquée", () => {
  it("l'exemple illustratif écrit les chiffres que la voix dit (« 10 minutes »), avec la mention visible", () => {
    const exemple = textes(temoin)[6];
    const tout = exemple.map((e) => e.texte).join(" ");
    expect(tout).toContain("Exemple illustratif");
    expect(tout).toMatch(/\b10 minutes\b/);
    expect(tout).not.toMatch(/\bdes minutes\b/);
  });

  it("B2 (critique #291) : « trois minutes » dit en fin de phrase, sans l'unité écrite, s'écrit « 3 min » ; chaque chiffre dit sur la page est écrit, dans chaque style", () => {
    const pageExemple = temoin.scenes.filter((s) => s.page === 7);
    const ditsPage = pageExemple.flatMap((s) => chiffresDits(s.texteDit));
    expect(ditsPage).toEqual([10, 3]);
    for (const f of [temoin, ...STYLES_TABLEAU.map((s) => ({ ...temoin, styleTableau: s })), ...STYLES_TABLEAU.map((s) => ficheTemoinV667Corrige(s))]) {
      const exemple = textes(f)[6];
      const tout = exemple.map((e) => e.texte).join(" ");
      expect(tout, f.styleTableau ?? "ivoire").toMatch(/\b3 min/i);
      for (const n of ditsPage) expect(tout, `${f.styleTableau ?? "ivoire"} : ${n}`).toMatch(new RegExp(`\\b${n}\\b`));
    }
    // Trois styles : l'« après » est construit comme l'« avant » : le chiffre seul (en très grand), puis l'unité et le texte en petit.
    for (const s of STYLES_TABLEAU) {
      const e = mettreEnPage(ficheTemoinV667Corrige(s), {}).pages[6].elements.find((x) => x.elementId === "e19")!;
      const grand = e.tableau!.lignes[0].taille;
      expect(e.lignes[0].texte, s).toMatch(/^3( MIN| min)?$/);
      expect(e.lignes.slice(1).map((l) => l.texte).join(" "), s).toMatch(/brouillon/);
      expect(Math.max(...e.tableau!.lignes.slice(1).map((l) => l.taille)), s).toBeLessThan(grand);
    }
  });

  it("D4 (critique #291) : sous le chiffre de l'« avant », jamais une phrase suspendue (« Chaque mail lui prenait ») : « par mail »", () => {
    for (const s of STYLES_TABLEAU) {
      const e = mettreEnPage(ficheTemoinV667Corrige(s), {}).pages[6].elements.find((x) => x.elementId === "e18")!;
      const reste = e.lignes.slice(1).map((l) => l.texte).join(" ");
      expect(reste, s).not.toMatch(/prenait\s*$/);
      expect(reste.toLowerCase(), s).toContain("par mail");
    }
  });

  it("sur l'exemple illustratif, un chiffre dit est permis sans source (la mention le signale) ; ailleurs, toujours refusé", () => {
    const f: FicheTableau = { ...temoin, scenes: temoin.scenes.map((s) => (s.id === "s07" ? { ...s, elements: s.elements.map((e) => (e.id === "e18" && e.type === "ligne" ? { ...e, texte: "Chaque mail lui prenait 10 minutes." } : e)) } : s.id === "s03" ? { ...s, elements: s.elements.map((e) => (e.id === "e05" && e.type === "ligne" ? { ...e, texte: "3 tâches à apprendre en premier." } : e)) } : s)) };
    const refus = regleChiffresSources(f, contexte).map((m) => m.sceneId);
    expect(refus).not.toContain("s07");
    expect(refus).toContain("s03");
  });

  it("hors exemple : « Tâches à apprendre… des minutes » (chiffres dits retirés) est refusé, avec quoi faire", () => {
    const refus = regleGabarit3(temoin).filter((m) => m.sceneId === "s03").map((m) => m.detail);
    expect(refus.join(" ")).toMatch(/« trois » .*retiré|retiré.*« trois »/u);
    expect(refus.join(" ")).toMatch(/« dix » .*retiré|retiré.*« dix »/u);
    expect(refus.join(" ")).toMatch(/reformulez/u);
  });
});

describe("(c) et (d) : jamais un doublon titre / phrase ou étiquette / texte", () => {
  it("(c) étape : la phrase ne reprend pas le titre (« Faites rédiger » puis « les réponses aux mails répétitifs. »)", () => {
    for (const page of textes(temoin)) {
      const titre = page.find((e) => e.sorte === "titre")?.texte;
      const phrase = page.find((e) => e.sorte === "phrase")?.texte;
      if (!titre || !phrase) continue;
      expect(phrase.toLowerCase().startsWith(titre.toLowerCase())).toBe(false);
    }
    expect(textes(temoin)[3].find((e) => e.sorte === "phrase")?.texte).toBe("les réponses aux mails répétitifs.");
  });

  it("(d) exemple : « Avant » et « Maintenant » ne sont pas répétés au début de leur texte", () => {
    const exemple = textes(temoin)[6];
    const lignes = exemple.filter((e) => e.sorte === "ligne").map((e) => e.texte);
    expect(lignes.length).toBe(2);
    for (const l of lignes) expect(l).not.toMatch(/^(avant|maintenant|après)\b/iu);
  });
});
