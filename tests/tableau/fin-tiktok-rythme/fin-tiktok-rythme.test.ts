/**
 * BLOCAGE RÉEL DU 14/10 (vidéo `v-9238deaab41e`, témoin `temoins/blocage-fin-tiktok-2026-10-14.json`) : la sortie
 * TikTok et Shorts (`vertical-liens`) s'arrêtait au calage, règle 16 du rythme, scène 10. La dernière scène n'avait
 * qu'un écran, celui de l'appel ; une fois l'appel retiré, l'écran « adresse seule » couvrait toute la phrase restante
 * (« Les dix réponses types… sur une page. »), et les mots de la scène étaient répartis jusqu'à la fin de la tenue de
 * l'écran de fin (2,9 s après la voix) : la ligne du dernier mot tombait après la voix, d'où un « trou » de plus de 4 s.
 * Les lignes ajoutées par Will n'y changeaient rien, et le message lui conseillait pourtant d'en ajouter.
 *
 * Ici, sans aucun appel payant : le témoin passe le calage de ses DEUX sorties sur leurs vraies voix ; la fin propre
 * garde un écran de contenu pour la phrase d'avant l'appel ; le calage répare le rythme avant de refuser ; le message
 * ne conseille jamais un geste qui ne peut pas réussir ; une sortie ratée n'emporte pas la sortie prête.
 */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { mots } from "../../../src/domaine/controles-script/texte";
import { calerFicheTableau } from "../../../src/moteurs/montage-tableau/calage";
import { fabriquerTableau } from "../../../src/moteurs/montage-tableau/fabriquer";
import type { FicheTableau } from "../../../src/moteurs/montage-tableau/fiche";
import { sortiesDesReseaux, type IdSortie } from "../../../src/moteurs/montage-tableau/formats-sortie";
import { mettreEnPage } from "../../../src/moteurs/montage-tableau/mise-en-page";
import { regleRythme, trousRythme, type ContexteTableau } from "../../../src/moteurs/montage-tableau/regles";
import { finDeLaSortie, relireFicheTableau, sortiesRelues } from "../../../src/moteurs/montage-tableau/relecture";
import { SITE_FIN } from "../../../src/moteurs/montage-tableau/variantes-fin";
import { choisirFinTableau } from "../../../src/services/tableau-fin";
import { doubles } from "../fabriquer/doubles";

interface MotVoix {
  mot: string;
  debutSec: number;
  finSec: number;
}
interface Temoin {
  fiche: FicheTableau;
  ficheCalee: FicheTableau;
  voix: { mots: MotVoix[]; dureeSec: number };
  voixTikTok: { mots: MotVoix[]; dureeSec: number };
  erreur: { messagePourWill: string };
}
const temoin = JSON.parse(readFileSync(new URL("../temoins/blocage-fin-tiktok-2026-10-14.json", import.meta.url), "utf8")) as Temoin;
const fiche = temoin.fiche;
const sorties = sortiesDesReseaux(["verticaux"]);
const coche = { coche: true, le: "2026-10-14" };
const choisirFin = choisirFinTableau({}, { sorties, mot: "REPONSES" });

/** Contexte des règles de la production : le texte de la fiche, sa démonstration validée. */
function contexteDe(f: FicheTableau): ContexteTableau {
  const ids = [...new Set(f.scenes.flatMap((s) => s.elements).flatMap((e) => (e.type === "preuve" ? [e.preuveId] : [])))];
  return {
    aujourdhui: "2026-10-14",
    sourcesChiffres: [],
    preuves: [],
    matieres: ids.map((id) => ({ id, type: "demonstration", statut: "validee", perimeLe: "2027-01-09" })),
    texteScript: f.scenes.map((s) => s.texteDit).join(" "),
  };
}

/** Les fiches des deux sorties, telles que la relecture et la fabrication les construisent. */
const [principale, liens] = sortiesRelues(fiche, sorties, (id) => finDeLaSortie(id, choisirFin(fiche.appelId ?? null, id)));

describe("le témoin du 14/10 passe le calage de ses deux sorties, sur leurs vraies voix", () => {
  it("vertical des Reels : la fiche, calée sur la voix avec l'appel", () => {
    const r = calerFicheTableau(principale.fiche, temoin.voix.mots, { contexte: contexteDe(principale.fiche), dureeSec: temoin.voix.dureeSec });
    expect(r.ok ? [] : r.problemes).toEqual([]);
  });

  it("vertical de TikTok et Shorts : la fiche sans appel, calée sur sa voix (qui s'arrête à « page. »)", () => {
    const r = calerFicheTableau(liens.fiche, temoin.voixTikTok.mots, { contexte: contexteDe(liens.fiche), dureeSec: temoin.voixTikTok.dureeSec });
    expect(r.ok ? [] : r.problemes).toEqual([]);
    if (!r.ok) return;
    expect(trousRythme(r.fiche)).toEqual([]);
  });
});

describe("la fin propre garde un écran de contenu pour la phrase d'avant l'appel", () => {
  const s10 = liens.fiche.scenes.at(-1)!;

  it("s10 dit sa phrase sous un écran de contenu ; l'écran du site part sur son dernier mot", () => {
    expect(s10.texteDit).toBe("Les dix réponses types à préparer tiennent sur une page.");
    const n = mots(s10.texteDit).length;
    expect(s10.ecrans).toHaveLength(2);
    expect(s10.ecrans![0].moment).not.toBe("appel");
    expect(s10.ecrans![1]).toMatchObject({ moment: "appel", ancre: n - 1 });
    expect(s10.ecrans![1].gabarit).toBeUndefined();
    expect(s10.ecrans![1].motCommentaire).toBeUndefined();
    // Ce que Will a écrit pour la phrase reste à l'écran pendant qu'elle est dite.
    const ids = s10.elements.map((e) => e.id);
    expect(ids).toEqual(expect.arrayContaining(["e39", "s10l1"]));
    expect(ids).not.toContain("e40");
  });

  it("à la mise en page : un écran avec la phrase de Will, puis le site en grand, rien d'autre", () => {
    const ecrans = mettreEnPage(liens.fiche, liens.options).styleV2!.ecrans.filter((e) => e.sceneId === "s10");
    expect(ecrans).toHaveLength(2);
    expect(ecrans[0].moment).not.toBe("appel");
    expect(ecrans[0].textes.filter((t) => !t.horsContenu).map((t) => t.texte).join(" ")).toBe("Dix réponses types");
    expect(ecrans[1]).toMatchObject({ moment: "appel", gabarit: "appel-site", final: true });
    expect(ecrans[1].textes.filter((t) => !t.horsContenu).map((t) => t.texte)).toEqual([SITE_FIN]);
  });

  it("le vertical des Reels ne change pas", () => {
    expect(principale.fiche).toEqual(fiche);
  });
});

describe("relecture et fabrication simulée des deux verticaux, sur les minutages des vraies voix", () => {
  /** Lectures du témoin : le corps (sa voix s'arrête à « page. ») et la phrase de l'appel (fin de la voix complète). */
  function voixDuTemoin(d: ReturnType<typeof doubles>): void {
    const avant = d.outils.voix.voix;
    const appel = temoin.voix.mots.slice(temoin.voixTikTok.mots.length);
    const decalage = appel[0].debutSec - 0.1;
    d.outils.voix.voix = () => {
      const v = avant();
      return {
        ...v,
        async lire(demande) {
          const r = await v.lire(demande);
          const corps = mots(demande.texte).length === temoin.voixTikTok.mots.length;
          // Une autre phrase de fin (TikTok et Shorts, 14/10 : une demande de la banque) : ses mots, lus à 0,35 s d'écart.
          const autre = !corps && mots(demande.texte).length !== appel.length;
          const m = corps ? temoin.voixTikTok.mots : autre ? mots(demande.texte).map((mot, i) => ({ mot, debutSec: +(0.1 + i * 0.35).toFixed(2), finSec: +(0.4 + i * 0.35).toFixed(2) })) : appel.map((x) => ({ ...x, debutSec: +(x.debutSec - decalage).toFixed(4), finSec: +(x.finSec - decalage).toFixed(4) }));
          return { ...r, mots: m, dureeSec: +(m.at(-1)!.finSec + 0.6).toFixed(3) };
        },
      };
    };
  }

  it("aucun point à la relecture ; deux fichiers, l'un et l'autre prêts", async () => {
    const contexte = contexteDe(fiche);
    const relue = await relireFicheTableau({ fiche, contexte, sorties, choisirFin, dejaVu: coche });
    expect(relue.points).toEqual([]);
    const d = doubles(fiche);
    voixDuTemoin(d);
    const fab = await fabriquerTableau({ ...d.outils, contexte, sorties, choisirFin, dejaVu: coche });
    expect(fab.sorties.map((s) => s.format)).toEqual(["vertical", "vertical-liens"]);
    expect(fab.manquantes ?? []).toEqual([]);
  }, 60_000);
});

describe("le calage répare le rythme sur la vraie voix avant de refuser", () => {
  it("lignes mal réparties dans une scène calée : ancres redistribuées, calage accepté", () => {
    // s06 : tous ses éléments au premier mot. Sur la vraie voix, le reste de la scène serait un silence de plus de 4 s.
    const serree: FicheTableau = { ...fiche, scenes: fiche.scenes.map((s) => (s.id === "s06" ? { ...s, elements: s.elements.map((e) => ("ancre" in e ? { ...e, ancre: 0 } : e)) } : s)) };
    const essai = { ...serree, scenes: serree.scenes.map((s, k) => ({ ...s, debutMs: temoin.ficheCalee.scenes[k].debutMs, finMs: temoin.ficheCalee.scenes[k].finMs })) };
    expect(trousRythme(essai).length).toBeGreaterThan(0);
    const r = calerFicheTableau(serree, temoin.voix.mots, { contexte: contexteDe(serree), dureeSec: temoin.voix.dureeSec });
    expect(r.ok ? [] : r.problemes).toEqual([]);
    if (!r.ok) return;
    expect(trousRythme(r.fiche)).toEqual([]);
    // Le texte dit et les textes écrits ne changent jamais.
    expect(r.fiche.scenes.map((s) => s.texteDit)).toEqual(serree.scenes.map((s) => s.texteDit));
    // Chaque élément calé suit l'ancre réparée.
    const s06 = r.fiche.scenes.find((s) => s.id === "s06")!;
    const ancres = new Set(s06.elements.flatMap((e) => ("ancre" in e ? [e.ancre] : [])));
    expect(ancres.size).toBeGreaterThan(1);
  });
});

describe("le message d'arrêt ne conseille jamais un geste qui ne peut pas réussir", () => {
  /** La fin propre telle que la construisait le code d'avant : l'écran du site sur toute la phrase, calée à la main. */
  const commeAvant = (): FicheTableau => {
    const f = structuredClone(liens.fiche);
    const s10 = f.scenes.at(-1)!;
    s10.ecrans = [s10.ecrans!.at(-1)!];
    delete s10.ecrans[0].ancre;
    // Une phrase longue sous l'écran du site : un vrai silence de plus de 4 s.
    s10.texteDit = "Les dix réponses types à préparer tiennent sur une page, avec les délais, les horaires, la zone, les prix et les pièces à fournir.";
    s10.elements = [{ id: "e39", type: "dessin", dessinId: "document", cote: "centre", ancre: 0 }];
    return f;
  };

  it("un silence sous l'écran du site : ni « ajoutez » ni « coupez », mais ce qui se passe", () => {
    const f = commeAvant();
    const res = regleRythme(f, contexteDe(f));
    expect(res.length).toBeGreaterThan(0);
    for (const m of res) {
      expect(m.detail).not.toMatch(/Ajoutez|Coupez/);
    }
  });

  it("quand il conseille d'ajouter une ligne, une ligne ajoutée comble bien le silence", () => {
    // s05 de la vidéo : une seule ligne au premier mot, aucune autre.
    const f: FicheTableau = { ...fiche, scenes: fiche.scenes.map((s) => (s.id === "s05" ? { ...s, ecrans: s.ecrans?.slice(0, 1).map((e) => ({ ...e, liste: undefined })), elements: s.elements.filter((e) => e.type !== "geste").slice(0, 1).map((e) => ({ ...e, ancre: 0 })) } : s)) };
    const res = regleRythme(f, contexteDe(f)).filter((m) => m.sceneId === "s05");
    expect(res.length).toBeGreaterThan(0);
    // Mesuré au lot B2b (165 mots/min) : le silence de s05 passe à 7,6 s (30,4 à 38,0 s), le message conseille « 2 lignes écrites ou
    // gestes » (une seule ligne au débit d'avant) ; le nombre suit la durée du silence.
    expect(res[0].detail).toMatch(/Ajoutez (une ligne écrite ou un geste|2 lignes écrites ou gestes) dans la scène 5/);
  });
});

describe("une sortie ratée n'emporte pas la sortie prête", () => {
  it("le vertical des Reels est livré ; TikTok et Shorts manque, et le rapport le dit", async () => {
    const contexte = contexteDe(fiche);
    const d = doubles(fiche);
    // La sortie TikTok et Shorts échoue au contrôle de ses scènes (le vertical passe).
    const controler = d.outils.preparation.controlerProprietes;
    let vus = 0;
    d.outils.preparation = { ...d.outils.preparation, controlerProprietes: (p) => (++vus > fiche.scenes.length ? ["Scène s10 · défaut provoqué pour l'essai."] : controler(p)) };
    const fab = await fabriquerTableau({ ...d.outils, contexte, sorties, choisirFin, dejaVu: coche });
    expect(fab.sorties.map((s) => s.format)).toEqual(["vertical"]);
    expect(fab.manquantes).toEqual([expect.objectContaining({ format: "vertical-liens" as IdSortie })]);
    expect((fab.alertes ?? []).map((a) => a.message).join(" ")).toMatch(/^Il manque .*TikTok et Shorts/);
  }, 60_000);

  it("aucune sortie prête : l'arrêt reste un échec", async () => {
    const contexte = contexteDe(fiche);
    const d = doubles(fiche);
    d.outils.preparation = { ...d.outils.preparation, controlerProprietes: () => ["défaut provoqué pour l'essai."] };
    await expect(fabriquerTableau({ ...d.outils, contexte, sorties, choisirFin, dejaVu: coche })).rejects.toThrow(/défaut provoqué/);
  }, 60_000);
});
