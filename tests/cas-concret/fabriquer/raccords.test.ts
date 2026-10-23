/**
 * M8b (cas concret) : raccords après la chaîne. Contrôles lus dans les zones de la brique, « première image » sur le
 * corps seulement, durée totale (R21) avec les fins réellement planifiées, un seul comptage des mots, bande des
 * sous-titres du format. Doubles seulement, aucun appel réel ; aucune taille en pixels recopiée : tout est lu de la brique.
 */
import { describe, expect, it } from "vitest";
import { zonesEcran } from "@/briques/ecrans-motion";
import { TABLE_FINS_DIAGNOSTIC } from "@/briques/fins";
import { mots } from "@/domaine/controles-script/texte";
import { BANDE_SOUS_TITRES_CAS_CONCRET, BAS_FIL_CAS_CONCRET, ZONE_PLEINE_IMAGE_CAS_CONCRET, type ReseauCas } from "@/formats/cas-concret";
import { centreSousTitresPleineImagePct } from "@/moteurs/montage-cas-concret/zone-objets";
import { CATALOGUE, trouverCas } from "@/formats/cas-concret/catalogue";
import { zoneProtegeeCombinee } from "@/reseaux";
import { calerFiche } from "@/moteurs/montage-cas-concret/calage";
import { controlerVideoCasConcret, SEUILS_CAS_CONCRET } from "@/moteurs/montage-cas-concret/controles";
import { ecrireFiche, ficheParGabarit } from "@/moteurs/montage-cas-concret/ecriture";
import * as etapes from "@/moteurs/montage-cas-concret/etapes";
import { regrouperFins } from "@/moteurs/montage-cas-concret/etapes";
import { centreBandePct, fabriquerCasConcret } from "@/moteurs/montage-cas-concret/fabriquer";
import { motsLus, validerSchemaFiche, type FicheEcrans } from "@/moteurs/montage-cas-concret/fiche";
import { planDesFins } from "@/moteurs/montage-cas-concret/fins";
import type { OutilsEcriture } from "@/moteurs/montage-cas-concret/outils";
import { DUREE_TOTALE_REFUS_MS, dureeFinMs, regleDureeTotale, tempsEcrans } from "@/moteurs/montage-cas-concret/regles";
import { BANDE_SOUS_TITRES_CAS_CONCRET as BANDE_DES_COMPOSITIONS, exemplesEcrans, ZONE_QUATRE_RESEAUX } from "../../../studio-rendu/compositions/cas-concret/exemples";
import { doubles } from "./doubles";

const FIXE = { videoId: "video-cc", versionId: "v1", habillage: "charte-duo/1", origine: "porte-a" as const };
const QUATRE: ReseauCas[] = ["facebook", "instagram", "tiktok", "linkedin"];

describe("M8b · bande des sous-titres du format", () => {
  it("une seule bande : celle des compositions (8 %), lue par les contrôles", () => {
    expect(BANDE_SOUS_TITRES_CAS_CONCRET).toBe(BANDE_DES_COMPOSITIONS);
    expect(SEUILS_CAS_CONCRET.bandeSousTitres).toBe(BANDE_SOUS_TITRES_CAS_CONCRET);
  });

  it("les sous-titres sont centrés dans la bande, au bas de la zone de texte", () => {
    const zone = zoneProtegeeCombinee("9:16", QUATRE)!;
    const z = zonesEcran(zone, 1080, 1920, BANDE_SOUS_TITRES_CAS_CONCRET);
    expect(z.sousTitres.y + z.sousTitres.hauteur).toBeCloseTo(z.texte.y + z.texte.hauteur, 6);
    expect(centreBandePct(zone)).toBeCloseTo(((z.sousTitres.y + z.sousTitres.hauteur / 2) / 1920) * 100, 2);
  });

  it("la chaîne pose les écrans dans la zone utile de la bande du format et y place les sous-titres", async () => {
    const d = doubles();
    await fabriquerCasConcret(d.options);
    // V4-2 (décision de Will, « option 1 comme la v4 ») : la zone est la zone PLEINE IMAGE du format, quels que soient
    // les réseaux visés, et non plus la zone sûre commune des quatre réseaux (qui réduisait tout au rapport 0,61).
    const z = zonesEcran(ZONE_PLEINE_IMAGE_CAS_CONCRET, 1080, 1920, BANDE_SOUS_TITRES_CAS_CONCRET);
    const ecran = d.ecransSoumis()[0].parametres as { proprietes: { zone: unknown; dessin: unknown; basFil: number } };
    expect(ecran.proprietes.zone).toEqual(z.utile);
    // Fidélité à la v4 : les objets s'arrêtent au-dessus des sous-titres (le bas du dessin = le bas de la zone utile).
    expect(ecran.proprietes.dessin).toEqual({ ...z.dessin, hauteur: z.utile.y + z.utile.hauteur - z.dessin.y });
    // Le fil des étapes passe sous les sous-titres, à 92 % de la hauteur (v4 : 1 764 px).
    expect(ecran.proprietes.basFil).toBeCloseTo(BAS_FIL_CAS_CONCRET * 1920, 6);
    const complet = d.compositionsSoumises()[0].parametres as { texte: { sousTitres: { positions: { milieuPct: number }; largeurMaxPx: number } } };
    // Sous-titres sur 960 px, comme la v4 (`#st` sur 60–1 020 px), et non sur la largeur de la zone sûre commune.
    expect(complet.texte.sousTitres.largeurMaxPx).toBe(960);
    // Sous-titres en haut de la bande (≈ 85 %, v4 83 %), sous tous les objets.
    expect(complet.texte.sousTitres.positions.milieuPct).toBeCloseTo(centreSousTitresPleineImagePct(), 1);
    expect(complet.texte.sousTitres.positions.milieuPct).toBeGreaterThan(((z.sousTitres.y + 30) / 1920) * 100);
  });
});

describe("M8b · première image : le corps seulement", () => {
  it("les fins gardent leurs contrôles, sans celui de l'accroche", () => {
    const tous = exemplesEcrans();
    const corps = tous.filter((p) => !["appel-mot", "promesse", "lien"].includes(p.type));
    const fin = tous.filter((p) => ["appel-mot", "promesse", "lien"].includes(p.type));
    const plan = planDesFins({ reseaux: ["facebook"], offre: "integration", nature: "automatisation", mot: "IA", avecMot: true, table: TABLE_FINS_DIAGNOSTIC });
    const id = plan.fins[0].id;
    const r = controlerVideoCasConcret({
      fiche: { ecrans: [] } as unknown as FicheEcrans,
      proprietes: { corps, fins: { [id]: fin } },
      mesuresParFin: {},
      journalCaptures: [],
      planDesFins: plan,
      bruitagesPoses: ["clic"],
      zone: { haut: ZONE_QUATRE_RESEAUX.haut / 100, droite: ZONE_QUATRE_RESEAUX.droite / 100, bas: ZONE_QUATRE_RESEAUX.bas / 100, gauche: ZONE_QUATRE_RESEAUX.gauche / 100 },
    });
    const pages = r.lignes.filter((l) => l.famille === "mise-en-page");
    expect(pages.filter((l) => l.etat === "echoue")).toEqual([]);
    expect(r.phrases.join(" ")).not.toMatch(/première image|Aucune accroche/i);
  });
});

describe("M8b · un seul comptage des mots", () => {
  it("un signe isolé n'est pas un mot : la fiche compte comme le calage", () => {
    for (const t of ["Avant : trier, relancer.", "Elle oublie ? Le rappel part — tout seul !", "100 % automatique"]) expect(motsLus(t)).toEqual(mots(t));
  });

  it("la fiche refuse un événement posé sur un signe isolé au-delà du dernier mot", () => {
    const f = ficheParGabarit(trouverCas("recrutement-apporteurs")!, FIXE);
    const e = f.ecrans.find((x) => / [:?!—] |[:?!—]$/.test(x.texteDit))!;
    expect(e).toBeDefined();
    const n = motsLus(e.texteDit).length;
    const abimee = { ...f, ecrans: f.ecrans.map((x) => (x.id === e.id ? { ...x, evenements: [{ cible: "ligne", surMot: n, avanceMs: 0 }] } : x)) };
    expect(validerSchemaFiche(abimee).ok).toBe(false);
  });

  it("la conversion de la chaîne a disparu ; la fiche simulée se cale telle quelle", () => {
    expect("surMotsDits" in etapes).toBe(false);
    const cas = trouverCas("recrutement-apporteurs")!;
    const f = ficheParGabarit(cas, FIXE);
    const plan = regrouperFins(planDesFins({ reseaux: ["facebook"], offre: cas.offre, mot: cas.mot, ...(cas.motDit ? { motDit: cas.motDit } : {}), avecMot: true, table: TABLE_FINS_DIAGNOSTIC }));
    const fin = plan.fins[0];
    let t = 0;
    const dits = [...f.ecrans, ...fin.ecrans].flatMap((e) => mots(e.texteDit)).map((m) => ({ mot: m, debutSec: (t += 0.3) - 0.3, finSec: t - 0.05 }));
    const r = calerFiche(f, fin, dits, { finApresDernierMotSec: 2.1 });
    expect(r.ok ? [] : r.problemes).toEqual([]);
  });
});

/** Écriture simulée (gabarit), budget toujours accordé. */
const outilsSimules: OutilsEcriture = {
  appeler: async (role, entree) => ({ ok: true, simule: true, donnees: role.simuler?.(entree) }),
  budget: { reserver: async () => ({ ok: true }) },
};

describe("M8b · durée totale (R21) avec les vraies fins", () => {
  const choix: ReseauCas[][] = [...QUATRE.map((r) => [r]), QUATRE];
  for (const cas of CATALOGUE) {
    for (const avecMot of [true, false]) {
      it(`${cas.id}, ${avecMot ? "avec" : "sans"} le mot : aucune fiche simulée refusée par R21, la plus courte tient de 35 à 65 s`, async () => {
        for (const reseaux of choix) {
          const plan = regrouperFins(planDesFins({ reseaux, offre: cas.offre, mot: cas.mot, ...(cas.motDit ? { motDit: cas.motDit } : {}), avecMot, table: TABLE_FINS_DIAGNOSTIC }));
          if (!plan.fins.length) continue;
          const controle = { fins: plan.fins };
          const r = await ecrireFiche({ ...FIXE, cas, controle }, outilsSimules);
          expect(r.ok ? [] : r.refus, `${reseaux.join(", ")}`).toEqual([]);
          if (!r.ok) continue;
          expect(regleDureeTotale(r.fiche, { cas, texteScript: "", ...controle })).toEqual([]);
          const t = tempsEcrans(r.fiche.ecrans);
          const corps = t[t.length - 1].finMs - t[0].debutMs;
          const plusCourte = corps + Math.min(...plan.fins.map((f) => dureeFinMs(f)));
          const plusLongue = corps + Math.max(...plan.fins.map((f) => dureeFinMs(f)));
          expect(plusCourte, `${reseaux.join(", ")}`).toBeGreaterThanOrEqual(DUREE_TOTALE_REFUS_MS.min);
          expect(plusLongue, `${reseaux.join(", ")}`).toBeLessThanOrEqual(DUREE_TOTALE_REFUS_MS.max);
        }
      });
    }
  }

  it("la consigne envoyée dit la durée des fins prévues", async () => {
    const cas = trouverCas("email-difficile")!;
    const plan = regrouperFins(planDesFins({ reseaux: QUATRE, offre: cas.offre, mot: cas.mot, avecMot: true, table: TABLE_FINS_DIAGNOSTIC }));
    const vus: string[] = [];
    await ecrireFiche({ ...FIXE, cas, controle: { fins: plan.fins } }, { ...outilsSimules, appeler: async (role, e) => (vus.push(e.variable), { ok: true, simule: true, donnees: role.simuler?.(e) }) });
    expect(vus[0]).toMatch(/<duree_fins>/);
  });
});

describe("M8b · la chaîne de bout en bout", () => {
  it("recrutement-apporteurs, 4 réseaux : rapport « Bon » (aucun bloquant)", async () => {
    const d = doubles();
    const cr = await fabriquerCasConcret(d.options);
    expect(cr.rapport.bloquants.map((l) => l.raison)).toEqual([]);
    expect(cr.rapport.verdict).toBe("ok");
  });

  it("formation, 4 réseaux : la fiche simulée n'est plus refusée pour sa durée", async () => {
    const d = doubles({ casId: "email-difficile" });
    const cr = await fabriquerCasConcret(d.options);
    expect(cr.rapport.verdict).toBe("ok");
  });

});
