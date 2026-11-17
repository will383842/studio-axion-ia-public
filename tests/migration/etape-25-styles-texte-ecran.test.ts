/**
 * C2-U13 : migration 25, cinq styles de texte à l'écran (dont « Pastille Axion »), INACTIVE tant que
 * `STYLES_TEXTE_ECRAN_INSTALLES` vaut `false`. Phrase de référence écrite ici, aucune voix. Aucune dépense.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/cache", () => ({ revalidatePath: () => undefined }));
vi.mock("@/services/auth", async (original) => ({ ...(await original<typeof import("@/services/auth")>()), exigerSession: async () => ({ id: "s-essai" }) }));

const { reinitialiserDepots, depots } = await import("@/donnees/memoire");
const donnees = await import("@/donnees/styles-texte-ecran");
const { etape25StylesTexteEcran } = await import("@/services/migrations/etape-25-styles-texte-ecran");
const { migrerDonnees } = await import("@/services/migrations");
const sousTitres = await import("@/briques/sous-titres");
const { controlerSousTitres, donneesCalque } = sousTitres;
const { modifierValeurAction } = await import("@/app/(studio)/bibliotheque/actions");
const { sceneAuTemps } = await import("@/briques/sous-titres/scene");
const { STYLE_SOUS_TITRES_AVOCAT, STYLE_SOUS_TITRES_MINIMAL } = await import("@/donnees/elements-avocat");

const T1 = "2026-11-17T08:00:00.000Z";
const T2 = "2026-11-17T09:00:00.000Z";
const IDS = ["st-axion-surligne-v1", "st-axion-pave-v1", "st-axion-outils-v1", "st-axion-varie-v1", "st-pastille-axion-v1"];

beforeEach(() => reinitialiserDepots());

const instantane = async () => {
  const d = depots();
  return JSON.stringify({ e: await d.elements.lister(), p: await d.parametres.lister(), v: await d.videos.lister() });
};

describe("C2-U13 · constante et données", () => {
  it("la constante est fausse dans le code (seul `true` allume)", () => {
    expect(donnees.STYLES_TEXTE_ECRAN_INSTALLES).toBe(false);
  });

  it("cinq éléments « style-sous-titres », ids stables, aucun défaut de format, licence de propriété", () => {
    const els = donnees.elementsStylesTexteEcran(T1);
    expect(els.map((e) => e.id)).toEqual(IDS);
    expect(els.map((e) => e.nom)).toEqual(["Axion surligné", "Axion pavé", "Axion outils", "Axion varié", "Pastille Axion"]);
    for (const e of els) {
      expect(e.type).toBe("style-sous-titres");
      expect(e.valeur.type).toBe("style-sous-titres");
      expect(e.formatsParDefaut).toEqual([]);
      expect(e.licence).toMatchObject({ type: "propriete", usageCommercial: true });
      expect(e.creeLe).toBe(T1);
    }
  });

  it("réglages de texte à l'écran de chaque style", () => {
    const v = Object.fromEntries(donnees.elementsStylesTexteEcran(T1).map((e) => [e.id, e.valeur as import("@/domaine/types").ValeurStyleSousTitres]));
    expect(v["st-axion-surligne-v1"]).toMatchObject({ gabarit: "karaoke", texteEcran: { marqueur: { teinte: "terracotta", cible: "expression" } } });
    expect(v["st-axion-pave-v1"]).toMatchObject({ gabarit: "karaoke", texteEcran: { pave: { mots: "forts-et-chiffres" } } });
    expect(v["st-axion-outils-v1"]).toMatchObject({ gabarit: "minimal", texteEcran: { outils: "etiquette" } });
    expect(v["st-axion-varie-v1"]).toMatchObject({ gabarit: "karaoke", texteEcran: { varier: true } });
    expect(v["st-pastille-axion-v1"].pastille).toBe("axion");
    expect(v["st-pastille-axion-v1"].texteEcran).toBeUndefined();
  });

  it("chaque style se dessine sans débordement (9:16, 4:5, 16:9) et sans lever", () => {
    const phrase = "Vos mails perso sur Gmail : 3 clients ont tout perdu en 2026";
    const { fabriquerSousTitres } = sousTitres;
    for (const e of donnees.elementsStylesTexteEcran(T1)) {
      const style = e.valeur as import("@/domaine/types").ValeurStyleSousTitres;
      for (const ratio of ["9:16", "4:5", "16:9"] as const) {
        const base = style.gabarit === "minimal" ? ("minimal" as const) : ("karaoke" as const);
        const segments = fabriquerSousTitres({ texte: phrase, dureeSec: 8, style, base, ratio, emphase: ["Gmail", "clients"] });
        expect(segments.length).toBeGreaterThan(0);
        const d = donneesCalque({ segments, base, ratio, style });
        const debord = (x: typeof d) => controlerSousTitres(x).filter((a) => a.code === "debordement-sous-titres").length;
        if (ratio === "16:9") {
          // Le 16:9 déborde déjà avec les styles de base (70 px nominaux) : ces styles ne font pas pire qu'eux.
          const b = style.gabarit === "minimal" ? STYLE_SOUS_TITRES_MINIMAL : STYLE_SOUS_TITRES_AVOCAT;
          const sb = fabriquerSousTitres({ texte: phrase, dureeSec: 8, style: b, base, ratio, emphase: ["Gmail", "clients"] });
          expect(debord(d), `${e.id} ${ratio}`).toBeLessThanOrEqual(debord(donneesCalque({ segments: sb, base, ratio, style: b })));
        } else expect(debord(d), `${e.id} ${ratio}`).toBe(0);
        expect(sceneAuTemps(d, segments[0].debutSec + 0.2)).not.toBeNull();
        if (e.id === "st-pastille-axion-v1") expect(d.pastille).toBeDefined();
      }
    }
  });
});

describe("C2-U13 · migration 25", () => {
  it("constante fausse (le vrai code) : rend null et n'écrit rien", async () => {
    const avant = await instantane();
    expect(await etape25StylesTexteEcran(depots(), T1)).toBeNull();
    expect(await instantane()).toBe(avant);
  });

  it("seul `true` strict allume (valeurs « vraies » d'un autre type : rien)", async () => {
    const avant = await instantane();
    for (const v of [1, "true", {}, [], undefined, null] as unknown[]) expect(await etape25StylesTexteEcran(depots(), T1, v as boolean)).toBeNull();
    expect(await instantane()).toBe(avant);
  });

  it("constante vraie (simulée) : cinq éléments ; second passage : null", async () => {
    const n = (await depots().elements.lister()).length;
    expect(await etape25StylesTexteEcran(depots(), T1, true)).toEqual({ stylesAjoutes: IDS });
    expect((await depots().elements.lister()).length).toBe(n + 5);
    for (const id of IDS) expect(await depots().elements.obtenir(id)).toBeTruthy();
    const apres = await instantane();
    expect(await etape25StylesTexteEcran(depots(), T2, true)).toBeNull();
    expect(await instantane()).toBe(apres);
  });

  it("n'écrit jamais sur un élément existant (renommé, réglé ou rangé par Williams)", async () => {
    await etape25StylesTexteEcran(depots(), T1, true);
    await depots().elements.modifier(IDS[0], { nom: "Mon surligné", archiveLe: T1 });
    await depots().elements.supprimer(IDS[1]);
    expect(await etape25StylesTexteEcran(depots(), T2, true)).toEqual({ stylesAjoutes: [IDS[1]] });
    expect(await depots().elements.obtenir(IDS[0])).toMatchObject({ nom: "Mon surligné", archiveLe: T1 });
  });

  it("n'ajoute aucune vidéo, aucun fichier, aucun réglage ; les éléments existants ne bougent pas", async () => {
    const d = depots();
    const avant = { v: JSON.stringify(await d.videos.lister()), f: JSON.stringify(await d.fichiers.lister()), p: JSON.stringify(await d.parametres.lister()), e: JSON.stringify(await d.elements.lister()) };
    await etape25StylesTexteEcran(d, T1, true);
    expect(JSON.stringify(await d.videos.lister())).toBe(avant.v);
    expect(JSON.stringify(await d.fichiers.lister())).toBe(avant.f);
    expect(JSON.stringify(await d.parametres.lister())).toBe(avant.p);
    const apres = (await d.elements.lister()).filter((e) => !IDS.includes(e.id));
    expect(JSON.stringify(apres)).toBe(avant.e);
  });

  it("aucun des cinq n'est le style par défaut d'un format (rien ne change pour les vidéos existantes)", async () => {
    await etape25StylesTexteEcran(depots(), T1, true);
    for (const e of await depots().elements.lister((x) => IDS.includes(x.id))) expect(e.formatsParDefaut).toEqual([]);
    // Les défauts d'avant sont identiques : les styles par défaut d'un format restent les mêmes éléments.
    const parDefaut = (await depots().elements.lister((x) => x.type === "style-sous-titres" && x.formatsParDefaut.length > 0)).map((e) => e.id).sort();
    reinitialiserDepots();
    const reference = (await depots().elements.lister((x) => x.type === "style-sous-titres" && x.formatsParDefaut.length > 0)).map((e) => e.id).sort();
    expect(parDefaut).toEqual(reference);
  });
});

describe("C2-U13 · migrerDonnees (démarrage)", () => {
  it("éteinte : le démarrage n'installe aucun des cinq styles, ne dit rien de plus, et un second démarrage est identique", async () => {
    const r1 = await migrerDonnees(depots(), T1);
    for (const id of IDS) expect(await depots().elements.obtenir(id)).toBeFalsy();
    expect(r1.lots?.["styles-texte-ecran"]).toBeUndefined();
    const avant = await instantane();
    await migrerDonnees(depots(), T2);
    expect(JSON.stringify({ e: await depots().elements.lister(), v: await depots().videos.lister() })).toBe(JSON.stringify({ e: JSON.parse(avant).e, v: JSON.parse(avant).v }));
  });
});

describe("C2-U13 · aller-retour par l'action de la Bibliothèque (A2-12)", () => {
  it("modifierValeurAction réécrit le texte à l'écran d'un style installé, puis le rétablit à l'identique", async () => {
    await etape25StylesTexteEcran(depots(), T1, true);
    const id = "st-axion-surligne-v1";
    const origine = (await depots().elements.obtenir(id))!.valeur as import("@/domaine/types").ValeurStyleSousTitres;
    const change = { ...origine, texteEcran: { marqueur: { teinte: "ardoise" as const, cible: "mot-dit" as const } } };
    expect((await modifierValeurAction(id, change)).ok).toBe(true);
    expect((await depots().elements.obtenir(id))!.valeur).toEqual(change);
    expect((await modifierValeurAction(id, origine)).ok).toBe(true);
    expect((await depots().elements.obtenir(id))!.valeur).toEqual(donnees.elementsStylesTexteEcran(T1)[0].valeur);
    // Un type de réglage qui ne correspond pas est refusé, l'élément ne bouge pas.
    expect((await modifierValeurAction(id, { type: "profil-son" } as never)).ok).toBe(false);
    expect((await depots().elements.obtenir(id))!.valeur).toEqual(origine);
  });
});
