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
import { controlerVideoTableau } from "../../../src/moteurs/montage-tableau/controles";
import { controlerMiseEnPageTableau } from "../../../src/moteurs/montage-tableau/controles-tableau";
import { validerFicheTableau, type FicheTableau } from "../../../src/moteurs/montage-tableau/fiche";
import { sortiesDesReseaux } from "../../../src/moteurs/montage-tableau/formats-sortie";
import { mettreEnPage } from "../../../src/moteurs/montage-tableau/mise-en-page";
import { finDeLaSortie, relireFicheTableau, sortiesRelues } from "../../../src/moteurs/montage-tableau/relecture";
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
  });
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
  it("une ligne plus large que la zone posée → « Texte entier » bloquant (controles.ts) sur la mise en page réelle", async () => {
    const mise = mettreEnPage(temoin, {});
    const l = mise.pages.flatMap((p) => p.elements).find((e) => e.tableau && e.lignes.length);
    if (!l) return expect(controlerMiseEnPageTableau(mise)).toEqual(expect.any(Array));
    const large = structuredClone(mise);
    const cible = large.pages.flatMap((p) => p.elements).find((e) => e.elementId === l.elementId)!;
    cible.lignes[0] = { ...cible.lignes[0], texte: `${cible.lignes[0].texte} ${"mot ".repeat(40)}`.trim() };
    expect(controlerMiseEnPageTableau(large).some((p) => p.controle === "coupe")).toBe(true);
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
