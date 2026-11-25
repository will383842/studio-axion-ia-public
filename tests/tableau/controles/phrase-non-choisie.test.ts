/**
 * FIX-CONTROLES-IMAGE-AVANT-PRET-b : le Studio refuse une vidéo qui dirait ou écrirait une phrase que personne n'a écrite
 * ni choisie, ou dont un dessin n'est pas fini quand la page se tourne. Chemin réel : relireFicheTableau (les sorties
 * exactes de la fabrication), proprietesVfc3 (calage, mise en page, heures fines). Rien de payant.
 */
import { readFileSync, readdirSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";

/** Réglage du test « dessin inachevé » : la page dont le plan réel reçoit un contour posé après sa fin (0 : aucune). */
const coupe = vi.hoisted(() => ({ page: 0 }));
vi.mock("../../../src/briques/tableau-scene/reference/animation-3", async (original) => {
  const reel = await original<typeof import("../../../src/briques/tableau-scene/reference/animation-3")>();
  return {
    ...reel,
    planPage3: (...a: Parameters<typeof reel.planPage3>) => {
      const plan = reel.planPage3(...a);
      const modele = plan.actions.find((x) => x.trace === "contour");
      if (!coupe.page || a[0].page !== coupe.page || !modele) return plan;
      return { ...plan, actions: [...plan.actions, { ...modele, id: "dessin-coupe", partie: "croquis:test:0", debut: plan.finPage + 0.5, duree: 0.5 }] };
    },
  };
});
/** Réglage du test « texte hors cadre » : rallonge la 1re ligne du `tableau` de la mise en page réelle (l'élément touché est noté). */
const rallonge = vi.hoisted(() => ({ actif: false, cible: null as string | null }));
vi.mock("../../../src/moteurs/montage-tableau/mise-en-page", async (original) => {
  const reel = await original<typeof import("../../../src/moteurs/montage-tableau/mise-en-page")>();
  return {
    ...reel,
    mettreEnPage: (...a: Parameters<typeof reel.mettreEnPage>) => {
      const mise = reel.mettreEnPage(...a);
      if (!rallonge.actif) return mise;
      const e = mise.pages.flatMap((p) => p.elements).find((x) => x.tableau && x.lignes.length);
      if (e) {
        rallonge.cible = e.elementId;
        e.lignes[0] = { ...e.lignes[0], texte: `${e.lignes[0].texte} ${"mot ".repeat(40)}`.trim() };
      }
      return mise;
    },
  };
});
import { controlerVideoTableau } from "../../../src/moteurs/montage-tableau/controles";
import { controlerMiseEnPageTableau } from "../../../src/moteurs/montage-tableau/controles-tableau";
import { validerFicheTableau, type FicheTableau } from "../../../src/moteurs/montage-tableau/fiche";
import { apercuDesSorties } from "../../../src/moteurs/montage-tableau/apercu-sorties";
import { sortiesDesReseaux, type IdSortie } from "../../../src/moteurs/montage-tableau/formats-sortie";
import { pagesDuStyle } from "../../../src/moteurs/montage-tableau/densite";
import { finDeLaSortie, type FinRetenue, relireFicheTableau, sortiesRelues } from "../../../src/moteurs/montage-tableau/relecture";
import { choisirFinTableau } from "../../../src/services/tableau-fin";
import { contexteBanc, MOTS_DOULEUR_V6616 } from "../banc/fiches-banc";
import { ficheVfc3, proprietesVfc3 } from "../titre-seul/fiche-vfc3";

const dossier = new URL("../temoins/", import.meta.url);
const lire = (nom: string) => JSON.parse(readFileSync(new URL(nom, dossier), "utf8")) as FicheTableau;
/** Le témoin de l'essai (v-fc3ac0c1d171, « reference/3 ») : sa fiche est ACCEPTÉE par les règles (sinon le contrôle neuf ne tournerait pas). */
const temoin = ficheVfc3();
const contexteDe = (f: FicheTableau) => contexteBanc(f, MOTS_DOULEUR_V6616);
const sorties = sortiesDesReseaux(["instagram", "tiktok", "youtube-shorts", "linkedin"]);
const FINS: Record<string, object> = { aucune: {}, question: { finLiens: "QUESTION" }, lien: { finLiens: "LIEN_PROFIL" }, enregistrer: { finLiens: "ENREGISTRER" }, rdv: { finLiens: "RENDEZ_VOUS" } };
const relire = (fiche: FicheTableau, fin: object) => relireFicheTableau({ fiche, contexte: contexteDe(fiche), dejaVu: { coche: true, le: "2026-10-14" }, sorties, choisirFin: choisirFinTableau({}, { sorties, ...fin } as never) });
const neuf = (r: Awaited<ReturnType<typeof relire>>) => r.rapport.bloquants.filter((l) => /^(Phrase non choisie|Dessin inachevé)$/.test(l.libelle));

/** Les sorties exactes de la fabrication, puis une phrase injectée dans la dernière scène du vertical de TikTok. */
function controlerAvecPhraseInjectee(fin: object, phrase: string | null) {
  const choisir = choisirFinTableau({}, { sorties, ...fin } as never);
  const relues = sortiesRelues(temoin, sorties, (id) => finDeLaSortie(id, choisir(temoin.appelId ?? null, id), temoin));
  const sortiesRapport = relues.map((s) => {
    if (!phrase || s.id !== "vertical-liens") return { id: s.id, libelle: s.libelle, fiche: s.fiche, options: s.options };
    const scenes = s.fiche.scenes.map((x, i, t) => (i === t.length - 1 ? { ...x, texteDit: `${x.texteDit} ${phrase}` } : x));
    return { id: s.id, libelle: s.libelle, fiche: { ...s.fiche, scenes }, options: s.options };
  });
  return controlerVideoTableau({ fiche: temoin, contexte: contexteDe(temoin), historique: [], dejaVu: { coche: true, le: "2026-10-14" }, sorties: sortiesRapport });
}

describe("phrase non choisie : sur le chemin réel de la relecture", () => {
  it("fin TikTok non choisie injectée (« Et chez vous, quelle tâche revient tous les jours ? ») → bloquant", async () => {
    const r = await controlerAvecPhraseInjectee(FINS.aucune, "Et chez vous, quelle tâche revient tous les jours ?");
    const l = r.bloquants.find((x) => x.libelle === "Phrase non choisie");
    expect(l?.raison).toContain("« Et chez vous, quelle tâche revient tous les jours ?");
    expect(r.verdict).toBe("bloque");
  });
  it("« Aucune » (rien d'injecté) → aucun bloquant neuf", async () => {
    expect((await controlerAvecPhraseInjectee(FINS.aucune, null)).bloquants.filter((l) => l.libelle === "Phrase non choisie")).toEqual([]);
  });
  it("une fin CHOISIE (question de la banque) → rien", async () => {
    const r = await relire(temoin, FINS.question);
    expect(r.rapport.lignes.filter((l) => l.libelle === "Phrase non choisie")).toEqual([]);
  }, 15_000);
  it("une seconde phrase en plus de la fin choisie → bloquant", async () => {
    const r = await controlerAvecPhraseInjectee(FINS.question, "Abonnez-vous pour recevoir mes astuces.");
    expect(r.bloquants.some((l) => l.libelle === "Phrase non choisie")).toBe(true);
  });
});

describe("aucune vidéo saine refusée : les témoins « reference-3 » actuels, toutes les fins", () => {
  const accepte = (f: FicheTableau) => validerFicheTableau(f, contexteBanc(f, [])).ok;
  const temoins = [["v-fc3ac0c1d171 (essai)", temoin] as const, ...readdirSync(dossier).filter((n) => /reference-3\.json$/.test(n)).map((n) => [n, lire(n)] as const)];
  for (const [nom, f] of temoins)
    for (const [fin, opt] of Object.entries(FINS))
      it(`${nom} · fin ${fin} : 0 bloquant neuf`, async () => {
        const r = await relireFicheTableau({ fiche: f, contexte: nom.startsWith("v-fc3") ? contexteDe(f) : contexteBanc(f, []), dejaVu: { coche: true, le: "2026-10-14" }, sorties, choisirFin: choisirFinTableau({}, { sorties, ...opt } as never) });
        expect(neuf(r).map((l) => l.raison)).toEqual([]);
      }, 30_000);
  it("l'essai est bien contrôlé (fiche acceptée) : le balayage ci-dessus n'est pas vide", () => {
    expect(validerFicheTableau(temoin, contexteDe(temoin)).ok).toBe(true);
    expect(temoins.filter(([, f]) => accepte(f)).length).toBeGreaterThanOrEqual(1);
  });
});

describe("dessin inachevé : plans réels du calendrier (proprietesVfc3)", () => {
  const props = proprietesVfc3("paperboard", "vertical");
  const base = () => controlerVideoTableau({ fiche: temoin, contexte: contexteDe(temoin), historique: [], dejaVu: { coche: true, le: "2026-10-14" } });
  it("sans calage : le rapport reste celui d'avant (aucune ligne neuve)", async () => {
    expect((await base()).lignes.some((l) => l.libelle === "Dessin inachevé")).toBe(false);
  });
  it("calendrier calé : aucun dessin inachevé", async () => {
    const r = await controlerVideoTableau({ fiche: temoin, contexte: contexteDe(temoin), historique: [], dejaVu: { coche: true, le: "2026-10-14" }, proprietes: props });
    expect(r.bloquants.filter((l) => l.libelle === "Dessin inachevé")).toEqual([]);
  });
  it("un contour du plan réel posé APRÈS la fin de sa page → bloquant « Dessin inachevé : … page n »", async () => {
    // Le plan réel de la page 2 + un contour qui finit après la fin de la page (le dessin serait coupé par la page suivante).
    coupe.page = props.find((p) => p.styleReference && p.page.page === 2)!.page.page;
    const r = await controlerVideoTableau({ fiche: temoin, contexte: contexteDe(temoin), historique: [], dejaVu: { coche: true, le: "2026-10-14" }, proprietes: props });
    coupe.page = 0;
    expect(r.bloquants.find((l) => l.libelle === "Dessin inachevé")?.raison).toMatch(/^Dessin inachevé : .+ page 2 /);
    expect(r.verdict).toBe("bloque");
  });
});

describe("texte hors cadre : le contrôle existant est bloquant sur le témoin de l'essai", () => {
  it("une ligne plus large que la zone posée, dans la mise en page réelle du style de l'essai → « Texte entier » bloquant", async () => {
    // Le style de l'essai : la fiche réparée dans le style de sa série (comme la relecture), dont la mise en page porte `tableau`.
    const fiche = pagesDuStyle(temoin);
    rallonge.actif = true;
    rallonge.cible = null;
    let r;
    try {
      r = await controlerVideoTableau({ fiche, contexte: contexteDe(temoin), historique: [], dejaVu: { coche: true, le: "2026-10-14" } });
    } finally {
      rallonge.actif = false;
    }
    expect(rallonge.cible).not.toBeNull();
    const l = r.lignes.find((x) => x.libelle === "Texte entier");
    expect(l).toBeDefined();
    expect(l).toMatchObject({ etat: "echoue", bloquant: true });
    expect(r.bloquants.map((x) => x.libelle)).toContain("Texte entier");
    expect(r.verdict).toBe("bloque");
  });
  it("sans rallonge, la même mise en page : « Texte entier » réussi", async () => {
    const r = await controlerVideoTableau({ fiche: pagesDuStyle(temoin), contexte: contexteDe(temoin), historique: [], dejaVu: { coche: true, le: "2026-10-14" } });
    expect(r.lignes.find((x) => x.libelle === "Texte entier")?.etat).toBe("reussi");
  });
});

describe("phrase non choisie : le mot à commenter choisi par l'utilisateur n'est pas une phrase du Studio", () => {
  it("fin au mot « GUIDE » (saisi à la création) écrit en dernière ligne du vertical → aucun bloquant « Phrase non choisie »", async () => {
    const { contexteFormation, ficheFormation } = await import("../style-v2/temoin-formation");
    const fiche = ficheFormation();
    const fin = { id: "fin-if-mot-envoi", ecran: "Écrivez GUIDE en commentaire", type: "commentaire", mot: "GUIDE" };
    const { rapport } = await relireFicheTableau({ fiche, contexte: contexteFormation(), historique: [], sorties: ["vertical", "carre"], choisirFin: () => fin });
    expect(rapport.bloquants.filter((l) => l.libelle === "Phrase non choisie")).toEqual([]);
  });
});

/* ------------------------------------------------------------------ */
/* 2e relecture (18/11) : mot admis à l'identique, phrase dite choisie, préfixes resserrés */
/* ------------------------------------------------------------------ */

const FIN_GUIDE: FinRetenue = { id: "fin-if-mot-envoi", ecran: "Écrivez GUIDE en commentaire", type: "commentaire", mot: "GUIDE" };
const ligneEcrite = (texte: string) => ({ id: "e-test", type: "ligne" as const, texte, niveau: "texte" as const, role: "regle" as const, bloc: "detail" as const, ancre: 0 });

/**
 * Les sorties exactes de la fabrication (style « blocs/2 » de la formation, fin au mot choisie : la mise en page reçoit
 * `appel.mot`), avec une ligne écrite en plus dans la dernière scène de chaque fichier.
 */
async function controlerAvecLigne(texte: string, choisirFin: (id: IdSortie) => FinRetenue | undefined, reseaux = ["instagram", "tiktok", "linkedin"]) {
  const { contexteFormation, ficheFormation } = await import("../style-v2/temoin-formation");
  const fiche = ficheFormation();
  const s = sortiesDesReseaux(reseaux);
  const relues = sortiesRelues(fiche, s, (id) => finDeLaSortie(id, choisirFin(id), fiche));
  const sortiesRapport = relues.map((x) => ({ id: x.id, libelle: x.libelle, options: x.options, fiche: { ...x.fiche, scenes: x.fiche.scenes.map((sc, i, t) => (i === t.length - 1 ? { ...sc, elements: [...sc.elements, ligneEcrite(texte)] } : sc)) } }));
  expect(relues.some((x) => (x.options.appel as { mot?: string } | undefined)?.mot === "GUIDE") || !choisirFin("vertical")).toBe(true);
  return controlerVideoTableau({ fiche, contexte: contexteFormation(), historique: [], sorties: sortiesRapport });
}
const phraseNonChoisie = (r: Awaited<ReturnType<typeof controlerAvecLigne>>) => r.bloquants.filter((l) => l.libelle === "Phrase non choisie");

describe("point 1 : le mot choisi n'est admis qu'à l'identique", () => {
  const fin = (id: IdSortie) => (id === "vertical" ? FIN_GUIDE : undefined);
  it("fin au mot « GUIDE » + ligne écrite « Guidez vos partages » → bloquant « Phrase non choisie »", async () => {
    const r = await controlerAvecLigne("Guidez", fin, ["instagram"]);
    expect(phraseNonChoisie(r)[0]?.raison).toContain("« Guidez »");
    expect(phraseNonChoisie(await controlerAvecLigne("Guidez vos partages", fin, ["instagram"]))[0]?.raison).toContain("« Guidez vos partages »");
  });
  it("« Guides » et « Guidons » : refusés aussi ; « GUIDE » tel quel : admis", async () => {
    expect(phraseNonChoisie(await controlerAvecLigne("Guides", fin, ["instagram"]))).toHaveLength(1);
    expect(phraseNonChoisie(await controlerAvecLigne("Guidons", fin, ["instagram"]))).toHaveLength(1);
    expect(phraseNonChoisie(await controlerAvecLigne("GUIDE", fin, ["instagram"]))).toEqual([]);
  });
});

describe("point 2 : seule la phrase dite de la fin choisie de CETTE sortie est permise", () => {
  it("fin « question » intacte : aucun bloquant ; la phrase choisie REMPLACÉE par une autre → bloquant", async () => {
    const choisir = choisirFinTableau({}, { sorties, finLiens: "QUESTION" } as never);
    const relues = sortiesRelues(temoin, sorties, (id) => finDeLaSortie(id, choisir(temoin.appelId ?? null, id), temoin));
    const choisie = apercuDesSorties(temoin, relues).find((x) => x.sortie === "vertical-liens")!.phrasesAjoutees[0];
    expect(choisie).toBeTruthy();
    const avec = (texte: string) =>
      controlerVideoTableau({
        fiche: temoin,
        contexte: contexteDe(temoin),
        historique: [],
        dejaVu: { coche: true, le: "2026-10-14" },
        sorties: relues.map((x) => ({ id: x.id, libelle: x.libelle, options: x.options, fiche: x.id !== "vertical-liens" ? x.fiche : { ...x.fiche, scenes: x.fiche.scenes.map((sc) => ({ ...sc, texteDit: sc.texteDit.replace(choisie, texte) })) } })),
      });
    expect(relues.find((x) => x.id === "vertical-liens")!.fiche.scenes.some((sc) => sc.texteDit.includes(choisie))).toBe(true);
    const intacte = await avec(choisie);
    expect(intacte.bloquants.filter((l) => l.libelle === "Phrase non choisie")).toEqual([]);
    const r = await avec("Abonnez-vous et partagez cette vidéo à tous vos collègues.");
    const l = r.bloquants.find((x) => x.libelle === "Phrase non choisie");
    expect(l?.raison).toContain("« Abonnez-vous et partagez cette vidéo à tous vos collègues. » (dite");
    expect(r.verdict).toBe("bloque");
  });
});

describe("point 3 : la règle des préfixes est resserrée", () => {
  it("sur le témoin de l'essai (v-fc3) : « Partagez, commentez, appelez » posée dans la dernière scène, sans mot choisi → bloquant (TikTok et LinkedIn)", async () => {
    const relues = sortiesRelues(temoin, sorties, (id) => finDeLaSortie(id, undefined, temoin));
    const r = await controlerVideoTableau({
      fiche: temoin,
      contexte: contexteDe(temoin),
      historique: [],
      dejaVu: { coche: true, le: "2026-10-14" },
      sorties: relues.map((x) => ({ id: x.id, libelle: x.libelle, options: x.options, fiche: { ...x.fiche, scenes: x.fiche.scenes.map((sc, i, t) => (i === t.length - 1 ? { ...sc, elements: [...sc.elements, ligneEcrite("Partagez, commentez, appelez")] } : sc)) } })),
    });
    const l = r.bloquants.find((x) => x.libelle === "Phrase non choisie");
    expect(l?.raison).toContain("« Partagez, commentez, appelez »");
    expect(l?.raison).toMatch(/TikTok|Liens|LinkedIn|Portrait/i);
  });
  it("« Partagez, commentez, appelez » écrite sans être choisie → bloquant (TikTok et LinkedIn compris)", async () => {
    const r = await controlerAvecLigne("Partagez, commentez, appelez", () => undefined);
    expect(phraseNonChoisie(r)[0]?.raison).toContain("« Partagez, commentez, appelez »");
    expect(phraseNonChoisie(r)[0]?.raison).toMatch(/Vertical|Liens|TikTok|LinkedIn|Portrait|Carré/i);
  });
  it("une abréviation connue reste admise : « 10 MIN par mail » ; une fin choisie sans mot ne change rien", async () => {
    const { rapport } = await relireFicheTableau({ fiche: temoin, contexte: contexteDe(temoin), dejaVu: { coche: true, le: "2026-10-14" }, sorties, choisirFin: choisirFinTableau({}, { sorties } as never) });
    expect(rapport.bloquants.filter((l) => l.libelle === "Phrase non choisie")).toEqual([]);
  });
});
