/**
 * S-08 · opération « changer-animation » : seule la mise de l'écran désigné change (la voix n'est jamais relue), par la VRAIE
 * `apercuRetoucheCasConcret` sur une fiche portant une mise tirée par `variete.ts` ; refus clairs ; ce que Claude voit.
 */
import { describe, expect, it } from "vitest";
import type { CommandeFabrication, Travail } from "@/domaine/types";
import { estimerRetoucheCasConcret } from "@/moteurs/montage-cas-concret";
import type { MoteurVideo, OperationMontage, ParentRetouche, ResultatFabrication } from "@/moteurs/types";
import { banc } from "../moteur/doubles";
import { TABLE_FINS_DIAGNOSTIC } from "@/briques/fins";
import { trouverCas } from "@/formats/cas-concret/catalogue";
import { variableDiscussion } from "@/moteurs/montage-cas-concret/discussion";
import { decrireFiche } from "@/briques/animation-element";
import { apercuRetoucheCasConcret, lireOperationRetoucheCasConcret, type ContexteRetoucheCasConcret } from "@/moteurs/montage-cas-concret/retouches";
import { dureesDesFins, ficheParGabarit } from "@/moteurs/montage-cas-concret/ecriture";
import { regrouperFins } from "@/moteurs/montage-cas-concret/etapes";
import type { FicheEcrans } from "@/moteurs/montage-cas-concret/fiche";
import { planDesFins } from "@/moteurs/montage-cas-concret/fins";
import { ENTREES, MOUVEMENTS_CAMERA, SORTIES, mettre, schemaTirageEcran, tirer, type Mise, type TirageEcran } from "@/moteurs/montage-cas-concret/variete";

const cas = trouverCas("recrutement-apporteurs")!;
const reseaux = ["facebook", "instagram", "tiktok", "linkedin"] as const;
const motSur = ["facebook", "instagram"] as const;
const contexte: ContexteRetoucheCasConcret = { cas, reseaux: [...reseaux], motSur: [...motSur], mot: cas.mot, ...(cas.motDit ? { motDit: cas.motDit } : {}), avecMot: true, table: TABLE_FINS_DIAGNOSTIC };
const plan = regrouperFins(planDesFins({ reseaux: [...reseaux], offre: cas.offre, ...(cas.nature ? { nature: cas.nature } : {}), mot: cas.mot, ...(cas.motDit ? { motDit: cas.motDit } : {}), avecMot: true, motSur: [...motSur], table: TABLE_FINS_DIAGNOSTIC }));
const sansMise: FicheEcrans = ficheParGabarit(cas, { videoId: "video-cc", versionId: "v1", habillage: "charte-duo/1", origine: "porte-a" }, dureesDesFins(plan.fins));
/** Une mise réelle (tirée par `variete.ts`) dont CHAQUE écran porte une animation différente de celle de son voisin. */
function ficheAvecMise(): FicheEcrans {
  const tirage = tirer({ videoId: "video-cc", canaux: [...reseaux], historique: [] });
  const base = mettre(tirage, sansMise.ecrans.map((e) => ({ id: e.id, type: e.type, fond: e.fond })));
  const ecrans: Mise["ecrans"] = {};
  sansMise.ecrans.forEach((e, i) => {
    const t = base.ecrans[e.id] as TirageEcran;
    ecrans[e.id] = { ...t, entree: ENTREES[i % ENTREES.length], sortie: SORTIES[i % SORTIES.length], camera: MOUVEMENTS_CAMERA[(i * 2) % MOUVEMENTS_CAMERA.length] };
  });
  return { ...sansMise, mise: { ...base, ecrans } };
}

const reglages = { mot: cas.mot, avecMot: true };
const fiche = ficheAvecMise();
// e03 : on s'assure que l'entrée posée est bien un changement.
const e03 = fiche.mise!.ecrans.e03;

describe("S-08 · changer-animation", () => {
  it("entrée « glisse » sur e03 : seule mise.ecrans.e03.entree change ; 1 écran refait, voix non relue", () => {
    expect(e03.entree).not.toBe("glissement");
    const a = apercuRetoucheCasConcret(fiche, [{ type: "changer-animation", ecranId: "e03", entree: "glisse" }], contexte);
    expect(a.refus).toEqual([]);
    expect(a.ok).toBe(true);
    expect(a.fiche).toEqual({ ...fiche, mise: { ...fiche.mise!, ecrans: { ...fiche.mise!.ecrans, e03: { ...e03, entree: "glissement" } } } });
    expect(schemaTirageEcran.safeParse(a.fiche.mise!.ecrans.e03).success).toBe(true);
    expect(a.ecransRefaits).toEqual(["e03"]);
    expect(a.corpsRelu).toBe(false);
    expect(a.finsRelues).toEqual([]);
    expect(a.textesARelire).toEqual([]);
    expect(a.caracteresARelire).toBe(0);
  });

  it("intensité : douce = aucun mouvement, forte = le plus marqué ; sortie directe permise", () => {
    const douce = apercuRetoucheCasConcret(fiche, [{ type: "changer-animation", ecranId: "e04", intensite: "douce" }], contexte);
    expect(douce.refus).toEqual([]);
    expect(douce.fiche.mise!.ecrans.e04.camera).toBe("aucun");
    const forte = apercuRetoucheCasConcret(fiche, [{ type: "changer-animation", ecranId: "e02", intensite: "forte", sortie: "flou" }], contexte);
    expect(forte.refus).toEqual([]);
    expect(forte.fiche.mise!.ecrans.e02.camera).toBe("punch-in");
    expect(forte.fiche.mise!.ecrans.e02.sortie).toBe("flou");
    expect(forte.textesARelire).toEqual([]);
  });

  it("vitesse : refus clair, rien changé", () => {
    const a = apercuRetoucheCasConcret(fiche, [{ type: "changer-animation", ecranId: "e03", vitesse: "rapide" }], contexte);
    expect(a.ok).toBe(false);
    expect(a.refus).toEqual(["La vitesse ne se règle pas encore sur un écran du cas concret."]);
    expect(a.fiche).toEqual(fiche);
  });

  it("valeur hors liste, aucun champ, écran inconnu, fiche sans mise : refus, rien changé", () => {
    expect(lireOperationRetoucheCasConcret({ type: "changer-animation", ecranId: "e03", entree: "tourbillon" })).toBeNull();
    const horsListe = apercuRetoucheCasConcret(fiche, [{ type: "changer-animation", ecranId: "e03", entree: "tourbillon" }], contexte);
    expect(horsListe.ok).toBe(false);
    expect(horsListe.fiche).toEqual(fiche);
    for (const op of [{ type: "changer-animation", ecranId: "e03" }, { type: "changer-animation", ecranId: "e99", entree: "zoom" }, { type: "changer-animation", ecranId: "e03", entree: "pop" }]) {
      const a = apercuRetoucheCasConcret(fiche, [op], contexte);
      expect(a.ok).toBe(false);
      expect(a.refus).toHaveLength(1);
      expect(a.fiche).toEqual(fiche);
    }
    const sans = apercuRetoucheCasConcret(sansMise, [{ type: "changer-animation", ecranId: "e03", entree: "zoom" }], contexte);
    expect(sans.ok).toBe(false);
    expect(sans.refus).toEqual(["L'animation de cette vidéo ne se règle pas écran par écran."]);
  });

  it("une animation déjà posée : « ne change rien »", () => {
    const a = apercuRetoucheCasConcret(fiche, [{ type: "changer-animation", ecranId: "e03", entree: "glisse" }, { type: "changer-animation", ecranId: "e03", entree: "glisse" }], contexte);
    expect(a.ok).toBe(true);
    const b = apercuRetoucheCasConcret(a.fiche, [{ type: "changer-animation", ecranId: "e03", entree: "glisse" }], contexte);
    expect(b.refus).toEqual(["Cette retouche ne change rien à la vidéo."]);
  });
});

describe("S-08 · ce que Claude voit", () => {
  it("avec une mise : chaque écran porte « · animation : … »", () => {
    const lignes = variableDiscussion("x", fiche, reglages).split("\n").filter((l) => /^e\d{2} · /.test(l));
    expect(lignes).toHaveLength(fiche.ecrans.length);
    for (const l of lignes) expect(l).toContain(" · animation : ");
    const t = fiche.mise!.ecrans.e03;
    expect(lignes[2]).toContain(" · animation : ");
    expect(lignes[2]).toContain(decrireFiche({ ...(t.entree === "glissement" ? { entree: "glisse" as const } : t.entree === "zoom-avant" ? { entree: "zoom" as const } : t.entree === "fondu-recul-v4" ? { entree: "fondu" as const } : {}), intensite: t.camera === "aucun" ? "douce" : t.camera === "punch-in" ? "forte" : "normale" }));
  });

  it("sans mise : la chaîne est celle d'avant", () => {
    const attendu = [`<demande>x</demande>`, `<ecrans>\n${sansMise.ecrans.map((e) => `${e.id} · ${e.type} · ${e.texteDit.replace(/\s+/g, " ").trim()}`).join("\n")}\n</ecrans>`, `<mot>${cas.mot}</mot>`].join("\n");
    expect(variableDiscussion("x", sansMise, reglages)).toBe(attendu);
  });
});

/* ------------------------------------------------------------------ */
/* Le vrai moteur, outils doubles : seul l'écran e03 est rendu de nouveau */
/* ------------------------------------------------------------------ */

const T0 = Date.UTC(2026, 10, 19, 9, 0, 0);
const ctx = (travailId: string) => ({ travailId, versionId: `ver-${travailId}`, titre: "Essai", maintenant: T0 });
const ops = (o: unknown[]) => o as OperationMontage[];

async function avancerJusqua(moteur: MoteurVideo, commande: CommandeFabrication, depart: Travail) {
  let t = depart;
  let resultat: ResultatFabrication | undefined;
  for (let n = 0; n < 200; n++) {
    const r = await moteur.avancer(JSON.parse(JSON.stringify(t)) as Travail, commande, T0 + n * 1000);
    t = r.travail;
    resultat = r.resultat ?? resultat;
    if (t.statut === "termine" || t.statut === "echec") return { travail: t, resultat };
  }
  throw new Error(`Bloqué (${t.statut}).`);
}

describe("S-08 · le vrai moteur ne refait que l'écran dont l'animation change", () => {
  it("changer-animation e03 : 1 écran rendu (e03), aucune voix relue, 0 centime de voix", async () => {
    const b = banc({ motSur: ["facebook", "instagram"], retouches: true });
    const c = b.commande();
    const premiere = await avancerJusqua(b.moteur, c, await b.moteur.lancer(c, ctx("t-1")));
    expect(premiere.travail.statut).toBe("termine");
    // La vidéo reçoit une mise de variété (sa fiche la porte, comme une vidéo tirée par `variete.ts`) ; une 1re retouche (mot)
    // rend les écrans du corps avec elle : c'est la version de départ de la retouche d'animation.
    const projet = JSON.parse(JSON.stringify(premiere.resultat!.projetMontage)) as { casConcret: { fiche: FicheEcrans } };
    const miseDeb = ficheAvecMise().mise!;
    const tirageEcrans: Record<string, TirageEcran> = {};
    for (const e of projet.casConcret.fiche.ecrans) tirageEcrans[e.id] = miseDeb.ecrans[e.id] ?? Object.values(miseDeb.ecrans)[0];
    projet.casConcret.fiche = { ...projet.casConcret.fiche, mise: { ...miseDeb, ecrans: tirageEcrans } };
    const parent0: ParentRetouche = { versionId: "ver-t-1", projetMontage: projet as unknown as ParentRetouche["projetMontage"], pistes: [] };
    const r1 = await avancerJusqua(b.moteur, c, await b.moteur.retoucher({ commande: c, contexte: ctx("t-2"), planIds: [], consigne: "Mot", operations: ops([{ type: "changer-mot", mot: "RDV", motDit: "R.D.V." }]), parent: parent0 }));
    expect(r1.travail.statut).toBe("termine");
    const parent: ParentRetouche = { versionId: "ver-t-2", projetMontage: JSON.parse(JSON.stringify(r1.resultat!.projetMontage)), pistes: [] };
    const fichePortee = (parent.projetMontage!.casConcret as { fiche: FicheEcrans }).fiche;
    expect(fichePortee.mise?.ecrans.e03).toBeDefined();

    const lus = b.d.lus.length;
    const rendus = b.d.ecransSoumis().length;
    const operation = [{ type: "changer-animation", ecranId: "e03", entree: fichePortee.mise!.ecrans.e03.entree === "zoom-avant" ? "glisse" : "zoom" }];
    const { apercu } = estimerRetoucheCasConcret(c, operation, parent);
    expect(apercu?.ecransRefaits).toEqual(["e03"]);
    expect(apercu?.corpsRelu).toBe(false);
    const fin = await avancerJusqua(b.moteur, c, await b.moteur.retoucher({ commande: c, contexte: ctx("t-3"), planIds: [], consigne: "Animation", operations: ops(operation), parent }));
    expect(fin.travail.statut).toBe("termine");
    expect(b.d.lus.slice(lus)).toHaveLength(0);
    const ids = b.d.ecransSoumis().slice(rendus).map((d) => (d.parametres as { proprietes: { id: string } }).proprietes.id);
    expect(ids).toEqual(["e03"]);
  });
});
