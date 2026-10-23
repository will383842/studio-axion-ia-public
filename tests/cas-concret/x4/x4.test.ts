/**
 * X4 · Alignements demandés par l'Usine et par le tableau animé : le mot éteint par défaut, le code de version dans
 * `utm_content`, la recette de la voix du tableau (mêmes valeurs, comparées), toujours la voix HeyGen en service, une
 * seule `voixDeReference`.
 */
import { readFileSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { mockHeaders, mockNavigation } from "../../helpers/next-mocks";

vi.mock("next/headers", () => mockHeaders);
vi.mock("next/navigation", () => mockNavigation);
vi.mock("next/cache", () => ({ revalidatePath: () => undefined, revalidateTag: () => undefined }));

const { reinitialiserDepots, depots } = await import("@/donnees/memoire");
const { RECETTE_VOIX_TABLEAU, planRaccordVoix: planTableau, parametresRaccord: parametresTableau } = await import("@/moteurs/montage-tableau/recette-voix");
const { RECETTE_VOIX_CAS_CONCRET, planRaccordVoix, parametresRaccord } = await import("@/moteurs/montage-cas-concret/recette-voix");
const { lireEntreesCasConcret } = await import("@/moteurs/montage-cas-concret/etapes");
const { liensSuivis, codeVersionCasConcret } = await import("@/moteurs/montage-cas-concret/fins");
const { fabriquerCasConcret } = await import("@/moteurs/montage-cas-concret/fabriquer");
const { ContenuVotreVideo, PHRASE_AVEC_MOT } = await import("@/components/formats/cas-concret/entree/FeuilleVotreVideo");
const { versVueCas } = await import("@/components/formats/cas-concret/entree/vue");
const { CATALOGUE } = await import("@/formats/cas-concret/catalogue");
const { empreinteCas } = await import("@/formats/cas-concret/cas");
const { FOURNISSEUR_VOIX_CAS_CONCRET, fournisseurVoixPermis } = await import("@/formats/cas-concret");
const casConcret = await import("@/services/cas-concret");
const voixService = await import("@/services/cas-concret-voix");
const b = await import("@/services/cas-concret-branchements");
const { doubles } = await import("../fabriquer/doubles");

import type { CommandeFabrication, MotHorodate } from "@/domaine/types";

const texte = (html: string) => html.replace(/<[^>]+>/g, " ").replace(/&#x27;|&#39;/g, "'").replace(/\s+/g, " ");

describe("X4 · le mot à commenter, éteint par défaut", () => {
  it("la feuille : « Avec le mot », décoché par défaut, et sa seule phrase", () => {
    const source = readFileSync("src/components/formats/cas-concret/entree/FeuilleVotreVideo.tsx", "utf8");
    expect(source).toMatch(/useState\(false\);/);
    expect(source).not.toMatch(/const \[avecMot, setAvecMot\] = useState\(true\)/);
    const cas = versVueCas(CATALOGUE[0], empreinteCas(CATALOGUE[0]), true);
    // X6 : la phrase de X4 accompagne l'option quand elle est active (le mot branché sur un réseau coché).
    const mots = { branches: { [cas.mot.toUpperCase()]: ["facebook" as const] }, charges: [] };
    const html = renderToStaticMarkup(createElement(ContenuVotreVideo, { cas, essai: false, reseaux: ["facebook"], onReseaux: () => undefined, mot: cas.mot, onMot: () => undefined, avecMot: false, onAvecMot: () => undefined, mots, onValider: () => undefined }));
    expect(PHRASE_AVEC_MOT).toBe("À cocher seulement si vous envoyez vous-même le document à chaque personne qui écrit le mot.");
    expect(texte(html)).toContain("Avec le mot");
    expect(texte(html)).toContain(PHRASE_AVEC_MOT);
    expect(texte(html)).not.toContain("Sans le mot");
    expect(html).toMatch(/role="switch"[^>]*aria-checked="false"|aria-checked="false"[^>]*role="switch"/);
  });

  it("sans action de Will, la commande donne la suite « sans le mot »", () => {
    expect(lireEntreesCasConcret({ casConcret: { casId: "recrutement-apporteurs", porte: "A", reseaux: ["facebook"], essai: false } }).avecMot).toBe(false);
    expect(lireEntreesCasConcret({ casConcret: { casId: "recrutement-apporteurs", porte: "A", reseaux: ["facebook"], essai: false, avecMot: true } }).avecMot).toBe(true);
  });

  it("l'estimation de la page part sans le mot", () => {
    // X7 : l'estimation reçoit aussi l'empreinte vue ou l'essai (refus avant le prix) ; toujours sans le mot.
    const page = readFileSync("src/app/(studio)/cas-concret/page.tsx", "utf8");
    // K3 : les deux appels (validés / à valider) sont fusionnés dans `preparerPageCas` ; il ne reste qu'UN appel textuel, qui sert les deux
    // listes (essai ou empreinte vue) et ne passe JAMAIS le mot (3e argument = false).
    expect(page.match(/estimerCas\(c\.cas\.id, RESEAUX, (true|false)[,)]/g)).toEqual(["estimerCas(c.cas.id, RESEAUX, false,"]);
    expect(page).toMatch(/preparerPageCas\(valides, aValider,/);
    expect(page).toContain("essai ? { essai: true } : { empreinteVue: c.empreinte }");
  });
});

describe("X4 · lien suivi : code de version dans utm_campaign, activité dans utm_content (ADR 0002)", () => {
  it("« 0042-CC-FB » est la campagne ; la fixture V04 de l'ADR est reproduite", () => {
    expect(codeVersionCasConcret(42, "facebook")).toBe("0042-CC-FB");
    const l = liensSuivis(["facebook", "instagram", "tiktok", "linkedin"], 42);
    for (const [reseau, code] of [["facebook", "FB"], ["instagram", "IG"], ["tiktok", "TT"], ["linkedin", "LI"]] as const) {
      const u = new URL(l[reseau]);
      expect(u.searchParams.get("utm_campaign")).toBe(`0042-CC-${code}`);
      expect(u.searchParams.get("utm_content")).toBe("clients");
    }
    expect(liensSuivis(["facebook"], 42)["facebook"]).toBe("https://axion-ia.com/fr/diagnostic?utm_source=facebook&utm_medium=video&utm_campaign=0042-CC-FB&utm_content=clients");
  });

  it("sans numéro de version, une erreur claire (jamais des liens absents en silence)", () => {
    expect(() => liensSuivis(["facebook"], undefined)).toThrow(/numéro de la version est introuvable/);
  });

  it("la fabrication s'arrête avant toute dépense quand le numéro de version manque", async () => {
    const d = doubles();
    d.options.numeroVersion = undefined;
    await expect(fabriquerCasConcret(d.options)).rejects.toThrow(/numéro de la version est introuvable/);
    expect(d.lus).toHaveLength(0);
  });

  it("la chaîne pose le numéro de version reçu dans les liens et les textes de publication", async () => {
    const d = doubles();
    d.options.numeroVersion = 7;
    d.options.entrees = { ...d.options.entrees, codeSuivi: "cc-recrutement-apporteurs-abc123" };
    const cr = await fabriquerCasConcret(d.options);
    expect(new URL(cr.liens.facebook).searchParams.get("utm_campaign")).toBe("0007-CC-FB");
    expect(new URL(cr.liens.linkedin).searchParams.get("utm_campaign")).toBe("0007-CC-LI");
    expect(new URL(cr.liens.facebook).searchParams.get("utm_content")).toBe("clients");
  });
});

describe("X4 · la recette de la voix du cas concret : gelée (1,1 / 0,20 s / 1,08), le tableau a la sienne", () => {
  it("les valeurs sont celles du tableau, sauf vitesse, blanc de phrase et atempo", () => {
    const { id: _a, ...nous } = RECETTE_VOIX_CAS_CONCRET;
    // La porte de bruit du tableau (14/10/2026, souffle entendu dans les blancs) est un AJOUT propre au tableau : le
    // cas concret garde sa recette (`src/moteurs/montage-cas-concret/recette-voix.ts`, non touchée).
    // Le rythme du tableau (lot B2a, recette « voix-tableau/3 » : HeyGen 1,0, `atempo` 1,0, blanc de phrase 0,30 s) lui est
    // propre aussi : le cas concret garde HeyGen 1,1, `atempo` 1,08 et 0,20 s.
    const { id: _b, porte: _p, ...tableau } = RECETTE_VOIX_TABLEAU;
    void _a;
    void _b;
    void _p;
    expect(nous).toEqual({ ...tableau, synthese: { ...tableau.synthese, vitesse: 1.1 }, resserrage: { ...tableau.resserrage, blancPhraseSec: 0.2 }, filtres: { ...tableau.filtres, atempo: 1.08 } });
    expect(RECETTE_VOIX_CAS_CONCRET.synthese).toEqual({ fournisseur: "heygen", moteur: "starfish", vitesse: 1.1, locale: "fr-FR" });
    expect(RECETTE_VOIX_CAS_CONCRET.resserrage).toEqual({ gardeSec: 0.035, blancMotsSec: 0.1, blancVirguleSec: 0.13, blancPhraseSec: 0.2, fonduMs: 6, queueSec: 0.45 });
    expect(RECETTE_VOIX_CAS_CONCRET.filtres).toEqual({ atempo: 1.08, passeHaut: "highpass=f=70", compresseur: "acompressor=threshold=-20dB:ratio=3:attack=5:release=80:makeup=3", volume: "loudnorm=I=-14:TP=-1.5:LRA=7" });
    expect(RECETTE_VOIX_CAS_CONCRET.fin).toEqual({ fonduSortieSec: 0.22, silenceSec: 0.8 });
  });

  it("le calcul recopié rend le même plan que le tableau pour le corps ; raccord corps+fin figé à 0,20/1,08 s", () => {
    const mot = (m: string, d: number, f: number): MotHorodate => ({ mot: m, debutSec: d, finSec: f }) as MotHorodate;
    const corps = { mots: [mot("On", 0.2, 0.4), mot("recrute,", 0.45, 0.9), mot("vite.", 1.6, 2.0), mot("Voilà.", 3.1, 3.5)], dureeSec: 4.2 };
    const fin = { mots: [mot("Faites", 0.3, 0.8), mot("votre", 0.85, 1.1), mot("diagnostic.", 1.6, 2.3)], dureeSec: 3 };
    const nous = planRaccordVoix(corps, fin);
    // Comparé au calcul du tableau avec les valeurs du cas concret (le tableau est passé à `atempo` 1,0 et 0,30 s au lot B2a).
    const recetteTableau108 = { ...RECETTE_VOIX_TABLEAU, resserrage: { ...RECETTE_VOIX_TABLEAU.resserrage, blancPhraseSec: 0.2 }, filtres: { ...RECETTE_VOIX_TABLEAU.filtres, atempo: 1.08 } } as unknown as typeof RECETTE_VOIX_TABLEAU;
    // Le blanc du raccord du tableau suit son blanc de phrase (0,30 s depuis le lot B2a) : on compare donc le corps seul.
    expect(planRaccordVoix(corps)).toEqual(planTableau(corps, undefined, recetteTableau108));
    // Hors la porte de bruit, ajout propre au tableau (14/10/2026).
    const { porte: _porte, ...tableau } = parametresTableau(planTableau(corps, undefined, recetteTableau108), recetteTableau108);
    void _porte;
    expect(parametresRaccord(planRaccordVoix(corps))).toEqual(tableau);
    const filtres = String(parametresRaccord(nous).filtres);
    expect(filtres).toBe("atempo=1.08,highpass=f=70,acompressor=threshold=-20dB:ratio=3:attack=5:release=80:makeup=3,loudnorm=I=-14:TP=-1.5:LRA=7");
    expect(filtres.match(/loudnorm/g)).toHaveLength(1);
    // Le raccord : 0,20 s de blanc entre le dernier mot du corps et le premier de la fin.
    const k = 1.08;
    expect(+((nous.mots[4].debutSec - nous.mots[3].finSec) * k).toFixed(3)).toBe(0.2);
    // Figé EN DUR (lot B2b, relecture B2a : la recette partagée du cas concret ne doit pas bouger avec celle du tableau) :
    // écart entre le dernier mot du corps et le premier mot de la fin = 0,20 / 1,08 s, quelle que soit la recette du tableau.
    expect(nous.mots[4].debutSec - nous.mots[3].finSec).toBeCloseTo(0.2 / 1.08, 3);
    expect(+(nous.mots[4].debutSec - nous.mots[3].finSec).toFixed(3)).toBe(0.185);
    expect(RECETTE_VOIX_CAS_CONCRET.resserrage.blancPhraseSec).toBe(0.2);
    expect(RECETTE_VOIX_CAS_CONCRET.filtres.atempo).toBe(1.08);
  });

  it("la chaîne raccorde les sons BRUTS du corps et de chaque fin par la recette, un traitement par fin", async () => {
    const d = doubles();
    const cr = await fabriquerCasConcret(d.options);
    expect(d.assemblages).toHaveLength(cr.fins.length);
    for (const a of d.assemblages) {
      expect(a.recette).toBeDefined();
      expect(a.recette!.parametres).toMatchObject({ mode: "recette", fonduMs: 6, fonduSortieSec: 0.22, silenceFinSec: 0.8 });
      expect(String(a.recette!.parametres.filtres).match(/loudnorm/g)).toHaveLength(1);
      expect((a.recette!.parametres.morceaux as { source?: number }[]).some((m) => m.source === 1)).toBe(true);
    }
  });

  it("notre contrôle des prises est gardé tel quel (450 ms hors ponctuation)", async () => {
    const { ECART_MAX_MS, NIVEAU_PAUSE_MAX_DB } = await import("@/moteurs/montage-cas-concret/voix");
    expect([ECART_MAX_MS, NIVEAU_PAUSE_MAX_DB]).toEqual([450, -38]);
  });
});

describe("X4 · toujours la voix HeyGen en service, une seule règle", () => {
  beforeEach(() => reinitialiserDepots());
  const moi = async () => (await depots().personnages.lister((p) => p.nature === "moi"))[0];

  it("le format désigne HeyGen explicitement ; aucun autre fournisseur n'est permis (simulation : essais seulement)", () => {
    expect(FOURNISSEUR_VOIX_CAS_CONCRET).toBe("heygen");
    expect(["heygen", "simulation", "elevenlabs", "openai", ""].map(fournisseurVoixPermis)).toEqual([true, true, false, false, false]);
  });

  it("une voix d'un autre fournisseur désignée pour l'avocat n'est jamais choisie, ni par la feuille ni par le lancement", async () => {
    const m = await moi();
    await depots().personnages.modifier(m.id, { voixParFormat: { avocat: "voix-will" } } as never);
    expect(await casConcret.voixDeReference()).not.toBeNull();
    expect((await voixService.etatVoixCasConcret()).prete).toBe(true);
    await depots().voix.modifier("voix-will", { fournisseur: "elevenlabs" } as never);
    expect(await casConcret.voixDeReference()).toBeNull();
    expect((await voixService.etatVoixCasConcret()).prete).toBe(false);
  });

  it("les outils réels refusent une voix d'un autre fournisseur, même inscrite dans la commande", async () => {
    await depots().voix.modifier("voix-will", { fournisseur: "elevenlabs" } as never);
    const c = { distribution: [{ role: "voix", source: "double", personnageId: "p-will", fournisseurVoix: "elevenlabs", voixId: "voix-will" }], videoId: "v", entrees: {}, bruitagesDisponibles: [], medias: [] } as unknown as CommandeFabrication;
    // L1-05 (décision de Will du 18/10) : refus par le contrôle commun, qui dit que rien n'a été dépensé.
    await expect(b.outilsCasConcret(c, "tr")).rejects.toThrow(/rien n'a été dépensé/);
  });

  it("les outils réels lisent la voix désignée à la vitesse de la recette (1,1)", async () => {
    const c = { distribution: [{ role: "voix", source: "double", personnageId: "p-will", fournisseurVoix: "simulation", voixId: "voix-will" }], videoId: "v", entrees: {}, bruitagesDisponibles: [], medias: [] } as unknown as CommandeFabrication;
    const o = await b.outilsCasConcret(c, "tr");
    expect(o.voix.reglages?.vitesse).toBe(RECETTE_VOIX_CAS_CONCRET.synthese.vitesse);
  });

  it("une seule fonction : la feuille lit `voixDeReference` de cas-concret.ts", () => {
    const source = readFileSync("src/services/cas-concret-voix.ts", "utf8");
    expect(source).toContain("voixDeReference");
    expect(source).not.toContain("voixPourFormat");
    expect(readFileSync("src/services/cas-concret.ts", "utf8")).toContain("export async function voixDeReference");
  });
});
