/**
 * L2 · la mise dans la fiche et dans la chaîne : une fiche sans `mise` garde EXACTEMENT ses empreintes ; une ancienne
 * fiche se relit sans erreur ; la chaîne tire la mise au calage, l'écrit dans la fiche, l'ajoute à l'historique, la garde
 * à la reprise, l'hérite d'une version ; et (L3c) le rendu des écrans ne diffère de la v4 que par le `jeu` des dimensions actives.
 */
import { describe, expect, it } from "vitest";
import { jsonCanonique } from "@/briques/fiche-scenes";
import { trouverCas } from "@/formats/cas-concret/catalogue";
import { ficheParGabarit } from "@/moteurs/montage-cas-concret/ecriture";
import { fabriquerCasConcret } from "@/moteurs/montage-cas-concret/fabriquer";
import { cadreDeFicheEcrans, empreinteEcran, empreinteFicheEcrans, validerSchemaFiche, type FicheEcrans } from "@/moteurs/montage-cas-concret/fiche";
import type { OutilsVariete } from "@/moteurs/montage-cas-concret/outils";
import { ajouterAHistorique, DIMENSIONS_ACTIVES, jeuDeLEcran, mettre, schemaMise, tirer, TIRAGE_V4, type EntreeHistorique, type Mise } from "@/moteurs/montage-cas-concret/variete";
import { doubles, type Doubles } from "../fabriquer/doubles";

/** Une mise sans ce que pose L6 (mises en page, fonds alternés, raccords, combinaison). */
function sansL6(m: Mise): Mise {
  const { misesEnPage: _c, misesTypes: _t, ...tirage } = m.tirage;
  void [_c, _t];
  const ecrans = Object.fromEntries(
    Object.entries(m.ecrans).map(([k, v]) => {
      const { miseEnPage: _m, fondAlterne: _f, raccordEntree: _e, raccordSortie: _s, ...reste } = v;
      void [_m, _f, _e, _s];
      return [k, reste];
    }),
  );
  return { ...m, tirage, ecrans } as Mise;
}

const FIXE = { videoId: "video-cc", versionId: "v1", habillage: "charte-duo/1", origine: "porte-a" as const };
const ficheDe = (casId: string): FicheEcrans => ficheParGabarit(trouverCas(casId)!, FIXE);

/** La formule d'AVANT le lot L2 (FNV-1a 64 bits + longueur sur `{ cadre, ecran }`), recopiée telle quelle. */
function empreinteAvantL2(ecran: unknown, cadre: unknown): string {
  const t = jsonCanonique({ cadre, ecran });
  let a = 0x811c9dc5;
  let b = 0x01000193;
  for (let i = 0; i < t.length; i++) {
    const c = t.charCodeAt(i);
    a = Math.imul(a ^ c, 0x01000193) >>> 0;
    b = Math.imul(b ^ c, 0x0100019d) >>> 0;
  }
  return `ecran-${a.toString(16).padStart(8, "0")}${b.toString(16).padStart(8, "0")}-${t.length.toString(36)}`;
}

describe("L2 · fiche", () => {
  const fiche = ficheDe("recrutement-apporteurs");
  const cadre = cadreDeFicheEcrans(fiche);

  it("fiche sans mise : chaque empreinte d'écran est exactement celle d'avant", () => {
    for (const e of fiche.ecrans) expect(empreinteEcran(e, cadre)).toBe(empreinteAvantL2(e, cadre));
    expect(empreinteFicheEcrans(fiche)).toBe(empreinteFicheEcrans(structuredClone(fiche)));
  });

  it("le tirage d'un écran entre dans son empreinte seulement s'il est donné", () => {
    const mise = mettre(tirer({ videoId: "video-cc", canaux: ["facebook"], historique: [] }), fiche.ecrans);
    const e = fiche.ecrans[0]!;
    expect(empreinteEcran(e, cadre, undefined)).toBe(empreinteAvantL2(e, cadre));
    expect(empreinteEcran(e, cadre, mise.ecrans[e.id])).not.toBe(empreinteAvantL2(e, cadre));
  });

  it("ancienne fiche (sans mise) relue sans erreur, à l'identique ; fiche avec mise relue ; mise mal formée refusée", () => {
    const ancienne = JSON.parse(JSON.stringify(fiche));
    const r = validerSchemaFiche(ancienne);
    expect(r.ok).toBe(true);
    expect(r.ok && r.fiche).toEqual(ancienne);
    expect(r.ok && "mise" in r.fiche).toBe(false);

    const mise = mettre(tirer({ videoId: "video-cc", canaux: ["facebook"], historique: [] }), fiche.ecrans);
    const avec = validerSchemaFiche(JSON.parse(JSON.stringify({ ...fiche, mise })));
    expect(avec.ok && avec.fiche.mise).toEqual(mise);

    const fausse = validerSchemaFiche({ ...ancienne, mise: { version: "variete/1", tirage: { ...TIRAGE_V4, ouverture: "inconnue" }, ecrans: {} } });
    expect(fausse.ok).toBe(false);
  });
});

/** Outils de variété en mémoire. */
function variete(historique: EntreeHistorique[] = [], heritee: Mise | null = null): OutilsVariete & { lignes: EntreeHistorique[]; ajouts: number } {
  const o = {
    lignes: [...historique],
    ajouts: 0,
    lireHistorique: async () => o.lignes,
    ajouter: async (e: EntreeHistorique) => {
      o.ajouts++;
      o.lignes = ajouterAHistorique(o.lignes, e);
    },
    miseHeritee: async () => heritee,
  };
  return o;
}

/** Propriétés des écrans soumis, sans les adresses signées des captures (un jeton neuf à chaque signature). */
const proprietesEcrans = (d: Doubles) => d.ecransSoumis().map((s) => JSON.parse(JSON.stringify((s.parametres as { proprietes: unknown }).proprietes).replace(/"src":"[^"]*"/g, '"src":""')) as object);

describe("L2 · chaîne", () => {
  it("sans outils de variété : aucune mise, fiche comme avant", async () => {
    const d = doubles();
    const cr = await fabriquerCasConcret(d.options);
    expect(cr.fiche.mise).toBeUndefined();
    expect(d.partage.journal.valeur?.mise).toBeUndefined();
  });

  it("au calage : la mise est tirée, écrite dans la fiche, notée une fois dans l'historique ; le rendu des écrans est celui de la v4", async () => {
    const temoin = doubles();
    await fabriquerCasConcret(temoin.options);

    const d = doubles();
    const v = variete();
    d.options.outils.variete = v;
    const cr = await fabriquerCasConcret(d.options);

    expect(schemaMise.safeParse(cr.fiche.mise).success).toBe(true);
    expect(Object.keys(cr.fiche.mise!.ecrans)).toEqual(cr.fiche.ecrans.map((e) => e.id));
    // L6 : le tirage porte en plus sa combinaison de mises en page (notée dans l'historique).
    const { misesEnPage, misesTypes: _misesTypes, ...tirage } = cr.fiche.mise!.tirage;
    void _misesTypes;
    expect(tirage).toEqual(tirer({ videoId: d.options.videoId, canaux: ["facebook", "instagram", "tiktok", "linkedin"], historique: [] }));
    expect(typeof misesEnPage).toBe("string");
    expect(v.ajouts).toBe(2);
    expect(v.lignes).toHaveLength(1);
    expect(v.lignes[0]!.videoId).toBe(d.options.videoId);
    expect(v.lignes[0]!.canaux).toEqual(["facebook", "instagram", "tiktok", "linkedin"]);
    expect(d.partage.journal.valeur?.mise?.notee).toBe(true);

    // L3c : les écrans ne diffèrent de la v4 QUE par leur `jeu` (dimensions actives seulement) ; un écran sans jeu garde
    // exactement ses propriétés et son empreinte de rendu ; 2 fonds forts au plus.
    const avec = proprietesEcrans(d) as Record<string, unknown>[];
    const sans = proprietesEcrans(temoin) as Record<string, unknown>[];
    expect(avec).toHaveLength(sans.length);
    expect(sans.some((p) => "jeu" in p)).toBe(false);
    const ids = d.ecransSoumis().map((s) => s.idRendu);
    const idsTemoin = temoin.ecransSoumis().map((s) => s.idRendu);
    avec.forEach((p, i) => {
      const { jeu, ...reste } = p;
      // L6 : un fond alterné remplace celui de la fiche ; le reste est inchangé.
      expect({ ...reste, fond: sans[i]!.fond }).toEqual(sans[i]);
      expect(reste.fond).toBe((jeu as { fondAlterne?: string } | undefined)?.fondAlterne ?? sans[i]!.fond);
      if (jeu === undefined) expect(ids[i]).toBe(idsTemoin[i]);
      else {
        expect(Object.keys(jeu as object).every((k) => (DIMENSIONS_ACTIVES as readonly string[]).includes(k))).toBe(true);
        expect(jeu).toEqual(jeuDeLEcran(cr.fiche.mise, String(p.id)));
        expect(ids[i]).not.toBe(idsTemoin[i]);
      }
    });
    expect(avec.filter((p) => (p.jeu as { fondFort?: boolean } | undefined)?.fondFort === true).length).toBeLessThanOrEqual(2);
    // Le tirage de ce témoin n'est pas la v4 : au moins un écran porte un jeu.
    expect(avec.some((p) => "jeu" in p)).toBe(true);
    // Le reste de la fiche est inchangé.
    const { mise: _m, ...sansMise } = cr.fiche;
    void _m;
    const cr2 = await fabriquerCasConcret(doubles().options);
    expect(sansMise).toEqual(cr2.fiche);
  });

  it("reprise (même journal) : la mise n'est ni retirée, ni notée deux fois", async () => {
    const d = doubles();
    const v = variete();
    d.options.outils.variete = v;
    const cr = await fabriquerCasConcret(d.options);
    // L'historique a changé entre-temps : la reprise garde la mise du journal.
    v.lignes = [...v.lignes, { ...v.lignes[0]!, videoId: "autre" }];
    const encore = await fabriquerCasConcret(d.options);
    expect(encore.fiche.mise).toEqual(cr.fiche.mise);
    expect(v.ajouts).toBe(2);
  });

  it("une version hérite de la mise d'une version précédente (déclinée sur ses écrans)", async () => {
    const tirage = { ...tirer({ videoId: "ailleurs", canaux: ["facebook"], historique: [] }) };
    const d = doubles();
    const v = variete([], { version: "variete/1", tirage, ecrans: {} });
    d.options.outils.variete = v;
    const cr = await fabriquerCasConcret(d.options);
    // L6 : hors mises en page (tirées sur le contenu calé de CETTE fiche), la mise est celle du tirage hérité.
    expect(sansL6(cr.fiche.mise!).tirage).toEqual(tirage);
    expect(sansL6(cr.fiche.mise!)).toEqual(sansL6(mettre(tirage, cr.fiche.ecrans)));
  });

  it("une fiche fournie qui a déjà une mise la garde (aucun nouveau tirage)", async () => {
    const fiche = ficheDe("recrutement-apporteurs");
    const mise = mettre({ ...TIRAGE_V4, graine: 7 }, fiche.ecrans);
    const d = doubles();
    d.options.entrees = { ...d.options.entrees, ficheCle: "studio/dev/fiches/video-cc.json" };
    d.options.lireFiche = async () => structuredClone({ ...fiche, mise });
    const v = variete();
    d.options.outils.variete = v;
    const cr = await fabriquerCasConcret(d.options);
    expect(cr.fiche.mise).toEqual(mise);
    expect(v.lignes[0]!.tirage).toEqual(mise.tirage);
  });

  it("une panne de l'historique ne bloque jamais la fabrication", async () => {
    const d = doubles();
    d.options.outils.variete = {
      lireHistorique: async () => {
        throw new Error("base en panne");
      },
      ajouter: async () => {
        throw new Error("base en panne");
      },
    };
    const cr = await fabriquerCasConcret(d.options);
    expect(cr.fiche.mise).toBeDefined();
    expect(d.partage.journal.valeur?.mise?.notee).toBe(false);
  });
});
