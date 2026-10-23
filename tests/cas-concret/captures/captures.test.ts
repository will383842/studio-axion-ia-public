/**
 * M6 · Plan de captures du vrai site, essais, repli par un dessin.
 */
import { describe, expect, it } from "vitest";
import { recrutementApporteurs } from "@/formats/cas-concret/catalogue/recrutement-apporteurs";
import type { CasConcret, ObjetCas } from "@/formats/cas-concret/cas";
import { VERSION_FICHE_ECRANS, type EcranCorps, type FicheEcrans } from "@/moteurs/montage-cas-concret/fiche";
import type { DemandeCapture, OutilsCaptures, ResultatCapture } from "@/moteurs/montage-cas-concret/outils";
import { appliquerCaptures, avancerCaptures, etatInitialCaptures, planCaptures } from "@/moteurs/montage-cas-concret/captures";

const commun = { fond: "sombre" as const, marque: "axion-ia.com", texteDit: "Elle s'inscrit toute seule.", avanceMs: 0, evenements: [], total: 6, puces: [] as string[] };
const etape = (id: string, numero: number, etapeCas: number | null, repli: ObjetCas = "telephone-notification"): EcranCorps =>
  ({
    ...commun,
    id,
    type: "etape",
    numero,
    titre: "L'étape",
    ligne: "Elle avance.",
    visuel: etapeCas === null ? { sorte: "objet", objet: "pile-notifications" } : { sorte: "ecran", etapeCas, repli },
  }) as EcranCorps;

const fiche = (): FicheEcrans => ({
  version: VERSION_FICHE_ECRANS, formatId: "cas-concret", videoId: "video-1", versionId: "version-1", habillage: "charte-duo/1", ratio: "9:16",
  offre: "integration", origine: "porte-a", posture: "chez-nous", casId: "recrutement-apporteurs", empreinteCas: "cas-0123456789abcdef-1a",
  ecrans: [etape("e01", 1, null), etape("e02", 2, 2), etape("e03", 3, 4, "calendrier")],
});

const ok = (mesures: Record<string, number> = {}): ResultatCapture => ({ ok: true, cle: "x", mime: "video/mp4", mesures });
function outils(reponse: (d: DemandeCapture, appel: number) => ResultatCapture | Promise<ResultatCapture>, deposees: string[] = []) {
  const appels: DemandeCapture[] = [];
  const o: OutilsCaptures = {
    capturer: async (d) => {
      appels.push(d);
      return reponse(d, appels.filter((a) => a.id === d.id).length);
    },
    existe: async (cle) => deposees.includes(cle),
  };
  return { o, appels };
}

describe("M6 · plan de captures", () => {
  it("une demande par écran réel, adresse et mouvement du cas, jamais comptée", () => {
    const d = planCaptures(fiche(), recrutementApporteurs);
    expect(d.map((x) => x.id)).toEqual(["e02", "e03"]);
    expect(d[0].page).toBe("https://axion-ia.com/fr/apporteur-affaires/video");
    expect(d[1].page).toBe("https://axion-ia.com/fr/appel");
    for (const x of d) {
      expect(x.parametres.sansMesure).toBe(true);
      expect(x.parametres.format).toBe("9:16");
    }
    expect(d[1].parametres.type).toBe("image");
    expect(d[0].cle).not.toBe(d[1].cle);
    expect(d[0].cle).toMatch(/^captures-cas-concret\/.+\.mp4$/);
    expect(d[1].cle).toMatch(/\.jpg$/);
  });

  it("la demande de frappe porte les valeurs fictives du cas", () => {
    const [frappe] = planCaptures(fiche(), recrutementApporteurs);
    expect(frappe.parametres).toMatchObject({ type: "video", mouvement: "frappe", saisies: [{ champ: "vsl-prenom", texte: "Camille" }, { champ: "vsl-email", texte: "camille@exemple.fr" }], cocher: ["vsl-consent"] });
  });

  it("clé stable : même page, mêmes paramètres, même clé", () => {
    expect(planCaptures(fiche(), recrutementApporteurs).map((d) => d.cle)).toEqual(planCaptures(fiche(), recrutementApporteurs).map((d) => d.cle));
  });

  it("adresse hors du site → aucune demande", () => {
    const cas = structuredClone(recrutementApporteurs) as CasConcret;
    const v = cas.etapes[3].visuel;
    if (v.sorte === "ecran") v.adresse = "https://exemple.org/fr/appel";
    expect(planCaptures(fiche(), cas).map((d) => d.id)).toEqual(["e02"]);
    if (v.sorte === "ecran") v.adresse = "https://axion-ia.com.evil.test/";
    expect(planCaptures(fiche(), cas).map((d) => d.id)).toEqual(["e02"]);
  });
});

describe("M6 · exécution des captures", () => {
  it("capture déjà déposée non redemandée", async () => {
    const demandes = planCaptures(fiche(), recrutementApporteurs);
    const { o, appels } = outils(() => ok({ mouvement: 2 }), [demandes[0].cle]);
    const etat = await avancerCaptures(etatInitialCaptures(demandes), o);
    expect(appels.map((a) => a.id)).toEqual(["e03"]);
    expect(etat.termine).toBe(true);
    expect(etat.resultats.e02.ok).toBe(true);
  });

  it("un échec réessayable est retenté une fois, pas plus ; un refus n'est pas retenté", async () => {
    const demandes = planCaptures(fiche(), recrutementApporteurs);
    const r = outils((d) => (d.id === "e02" ? { ok: false, raison: "délai", reessayable: true } : { ok: false, raison: "refus", reessayable: false }));
    const etat = await avancerCaptures(etatInitialCaptures(demandes), r.o);
    expect(r.appels.filter((a) => a.id === "e02")).toHaveLength(2);
    expect(r.appels.filter((a) => a.id === "e03")).toHaveLength(1);
    expect(etat.termine).toBe(true);
  });

  it("un deuxième essai qui réussit est gardé", async () => {
    const demandes = planCaptures(fiche(), recrutementApporteurs);
    const { o } = outils((d, n) => (n === 1 ? { ok: false, raison: "délai", reessayable: true } : ok({ mouvement: 2 })), []);
    const etat = await avancerCaptures(etatInitialCaptures(demandes), o);
    expect(etat.resultats.e02.ok).toBe(true);
  });

  it("une exception de l'outil ne remonte jamais", async () => {
    const demandes = planCaptures(fiche(), recrutementApporteurs);
    const { o } = outils(() => {
      throw new Error("réseau coupé");
    });
    const etat = await avancerCaptures(etatInitialCaptures(demandes), o);
    expect(etat.termine).toBe(true);
    expect(etat.resultats.e02.ok).toBe(false);
  });

  it("une reprise ne refait pas ce qui est fait", async () => {
    const demandes = planCaptures(fiche(), recrutementApporteurs);
    const premier = outils(() => ok({ mouvement: 2 }));
    const etat = await avancerCaptures(etatInitialCaptures(demandes), premier.o);
    const second = outils(() => ok({ mouvement: 2 }));
    await avancerCaptures(etat, second.o);
    expect(second.appels).toHaveLength(0);
  });
});

describe("M6 · repli par un dessin", () => {
  const appliquer = async (reponse: (d: DemandeCapture) => ResultatCapture) => {
    const demandes = planCaptures(fiche(), recrutementApporteurs);
    const etat = await avancerCaptures(etatInitialCaptures(demandes), outils(reponse).o);
    return appliquerCaptures(fiche(), etat);
  };

  it("captures réussies → la fiche est inchangée, les clés sont rendues", async () => {
    const r = await appliquer((d) => ({ ok: true, cle: d.cle, mime: "video/mp4", mesures: d.parametres.mouvement === "frappe" ? { mouvement: 2 } : ({} as Record<string, number>) }));
    expect(r.fiche).toEqual(fiche());
    expect(r.journal).toEqual([]);
    expect(Object.keys(r.captures)).toEqual(["e02", "e03"]);
  });

  it("échec → repli et ligne de journal", async () => {
    const r = await appliquer((d) => (d.id === "e03" ? { ok: false, raison: "délai", reessayable: true } : ok({ mouvement: 2 })));
    const e3 = r.fiche.ecrans[2];
    expect(e3.type === "etape" && e3.visuel).toEqual({ sorte: "objet", objet: "calendrier" });
    expect(r.journal).toHaveLength(1);
    expect(r.journal[0]).toMatch(/^Écran réel remplacé par un dessin : /);
    expect(r.captures.e03).toBeUndefined();
    expect(r.fiche.ecrans[1]).toEqual(fiche().ecrans[1]);
  });

  it("frappe rendue avec mouvement 0 → repli", async () => {
    const r = await appliquer((d) => (d.parametres.mouvement === "frappe" ? ok({ mouvement: 0 }) : ok()));
    const e2 = r.fiche.ecrans[1];
    expect(e2.type === "etape" && e2.visuel).toEqual({ sorte: "objet", objet: "telephone-notification" });
    expect(r.journal[0]).toContain("Écran réel remplacé par un dessin");
  });

  it("refus ou capture presque uniforme → repli", async () => {
    const r = await appliquer((d) => (d.id === "e02" ? { ok: false, raison: "refusée", reessayable: false } : ok({ uniformite: 0.995 })));
    expect(r.journal).toHaveLength(2);
    expect(r.fiche.ecrans.every((e) => e.type !== "etape" || e.visuel.sorte === "objet")).toBe(true);
  });

  it("aucun texte du journal ne porte d'identifiant technique d'écran", async () => {
    const r = await appliquer(() => ({ ok: false, raison: "x", reessayable: false }));
    for (const l of r.journal) expect(l).not.toMatch(/\be0\d\b/);
  });

  it("résultat absent → repli, sans erreur", () => {
    const demandes = planCaptures(fiche(), recrutementApporteurs);
    const r = appliquerCaptures(fiche(), { demandes, resultats: {} });
    expect(r.journal).toHaveLength(2);
  });
});
