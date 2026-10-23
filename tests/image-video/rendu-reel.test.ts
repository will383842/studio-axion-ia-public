/**
 * Rendu RÉEL des versions « Image → vidéo » (`src/services/image-video-rendu.ts`) sur un DOUBLE du serveur de rendu :
 * la fabrication complète (doubles du lot L15) passe par le vrai branchement du rendu — scènes par l'opération
 * `composition` existante, puis montage `complet` voix + bruitages + sous-titres — sans aucun appel payant ni réseau.
 * Couvre : succès, attente du serveur, échec puis « Réessayer » sans repayer (voix, Claude, scènes déjà rendues).
 */
import { describe, expect, it, vi } from "vitest";
import {
  attendWillIV,
  avancerJusquAArretIV,
  engageCentimes,
  etatInitialIV,
  reprendreIV,
  validerCarteIV,
  validerScriptIV,
  type EtatFabricationIV,
  type OutilsFabricationIV,
} from "@/moteurs/montage-image-video/fabrication";
import {
  COMPOSITIONS_RENDU_IV,
  CENTRE_SOUS_TITRES_IV_PCT,
  lireNoirEtFige,
  parametresDuBloc,
  segmentsSousTitresIV,
} from "@/services/image-video-rendu";
import { carteFixe, demandeEssai, monde, outilsSimules, type Monde } from "./doubles-fabrication";
import { outilsAvecRendu, ServeurDouble } from "./doubles-rendu";

vi.setConfig({ testTimeout: 120_000 });

const decisionCarte = (e: EtatFabricationIV) => ({ proposition: e.propositionCarte!.empreinte, le: "2026-10-15T08:00:00.000Z" });
const decisionScript = (e: EtatFabricationIV) => ({ proposition: e.propositionScript!.empreinte, choixFormules: Object.fromEntries(e.propositionScript!.formules.map((f) => [f.cle, "garder" as const])) });

/** Jusqu'à une fin (prête ou arrêtée) : portes franchies, attentes du serveur relues. */
async function jusquAuBout(e0: EtatFabricationIV, o: OutilsFabricationIV): Promise<{ etat: EtatFabricationIV; attentes: number }> {
  let e = await avancerJusquAArretIV(e0, o);
  let attentes = 0;
  for (let i = 0; i < 200 && e.etape !== "prete" && e.etape !== "refusee"; i++) {
    if (e.attente) {
      attentes++;
      e = await avancerJusquAArretIV(e, o);
    } else if (attendWillIV(e) === "carte") e = await avancerJusquAArretIV(validerCarteIV(e, decisionCarte(e)), o);
    else if (attendWillIV(e) === "script") e = await avancerJusquAArretIV(validerScriptIV(e, decisionScript(e)), o);
    else break;
  }
  return { etat: e, attentes };
}

const depart = (reseaux?: EtatFabricationIV["demande"]["reseaux"]) => etatInitialIV(demandeEssai(carteFixe("C"), reseaux ? { reseaux } : {}));

/* ------------------------------------------------------------------ */
/* Succès                                                                */
/* ------------------------------------------------------------------ */

describe("rendu réel sur le serveur existant : succès", () => {
  it("scènes par l'opération `composition` (compositions du format), puis UN montage `complet` par version : voix, bruitages, sous-titres", async () => {
    const m = monde();
    const serveur = new ServeurDouble();
    const { etat } = await jusquAuBout(depart(), outilsAvecRendu(m, serveur));
    expect(etat.refus).toBeUndefined();
    expect(etat.etape).toBe("prete");

    // Aucune opération nouvelle : seulement `composition` (sans mode pour les scènes, `complet` pour le montage).
    expect(new Set(serveur.soumises.map((d) => d.operation))).toEqual(new Set(["composition"]));
    const compositions = new Set(serveur.scenes().map((d) => (d.parametres as { composition: string }).composition));
    for (const c of compositions) expect(Object.values(COMPOSITIONS_RENDU_IV)).toContain(c);
    expect(compositions.has(COMPOSITIONS_RENDU_IV.toile) || compositions.has(COMPOSITIONS_RENDU_IV.ecran)).toBe(true);
    // Une scène identique (le corps commun aux versions) n'est rendue qu'une fois.
    const cles = serveur.scenes().map((d) => d.sortie.cle);
    expect(new Set(cles).size).toBe(cles.length);

    const versions = Object.keys(etat.rendus ?? {});
    expect(serveur.montages()).toHaveLength(versions.length);
    for (const d of serveur.montages()) {
      expect(d.entrees.voix).toMatch(/^https:\/\/stockage\.test\//);
      expect(Object.keys(d.entrees).filter((n) => n.startsWith("bruitage-")).length).toBeGreaterThan(0);
      expect(Object.keys(d.entrees).filter((n) => n.startsWith("illu-")).length).toBeGreaterThan(0);
      const p = d.parametres as { mode: string; texte: { sousTitres?: { segments: unknown[] } }; son: { lufs: number } };
      expect(p.texte.sousTitres?.segments.length).toBeGreaterThan(0);
      // Sous-titres VARIÉS (15/10) : le montage commun reçoit les accents de la brique (Impact), au centre de la bande.
      const accents = (p.texte.sousTitres?.segments ?? []).filter((s) => (s as { style?: string }).style === "impact" || (s as { style?: string }).style === "bandeau");
      expect(accents.length).toBeGreaterThan(0);
      for (const s of accents) expect((s as { position?: string }).position).toBe("milieu");
      expect(p.mode).toBe("complet");
      expect(p.son.lufs).toBe(-14);
      expect(JSON.stringify(p.texte)).toContain(String(CENTRE_SOUS_TITRES_IV_PCT));
      // Jamais de musique.
      expect(Object.keys(d.entrees).some((n) => /musique/.test(n))).toBe(false);
    }
    // Livraison : le fichier du montage, avec les mesures du serveur et les mesures locales (Q24).
    for (const l of etat.livraison ?? []) {
      if (l.version === "aucune") continue;
      expect(serveur.montages().map((d) => d.sortie.cle)).toContain(l.fichierCle);
    }
    for (const r of Object.values(etat.rendus ?? {})) {
      expect(r.mesures).toMatchObject({ lufs: -14.1, noirMaxSec: 0, figeMaxSec: 0.2 });
      // Image figée jugée avec la voix (décision de Will du 17/10) : mesure « hors voix » posée par le rendu.
      expect(r.mesures?.figeHorsVoixMaxSec).toBeGreaterThanOrEqual(0);
      expect(r.mesures?.figeHorsVoixMaxSec).toBeLessThanOrEqual(0.2);
      expect(r.empreinte).toMatch(/^final-/);
    }
    expect(etat.controles?.verdict?.ok).toBe(true);
  });

  it("le serveur fait attendre : la fabrication rend la main (attente), puis reprend sans soumettre deux fois", async () => {
    const m = monde();
    const serveur = new ServeurDouble({ enCours: 2 });
    const { etat, attentes } = await jusquAuBout(depart(["youtube-shorts"]), outilsAvecRendu(m, serveur));
    expect(etat.etape).toBe("prete");
    expect(attentes).toBeGreaterThan(0);
    const ids = serveur.soumises.map((d) => d.idRendu);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

/* ------------------------------------------------------------------ */
/* Échec, puis reprise sans repayer                                     */
/* ------------------------------------------------------------------ */

describe("rendu réel : échec puis « Réessayer » sans repayer", () => {
  it("montage raté : arrêt réessayable avec une phrase simple ; la reprise ne relit ni la voix ni Claude et ne refait aucune scène", async () => {
    const m = monde();
    let panne = true;
    const serveur = new ServeurDouble({ echoue: (d) => panne && (d.parametres as { mode?: string }).mode === "complet" });
    const o = outilsAvecRendu(m, serveur);
    const arret = (await jusquAuBout(depart(["youtube-shorts"]), o)).etat;
    expect(arret.etape).toBe("refusee");
    expect(arret.refus).toMatchObject({ etape: "rendu", code: "IV_PANNE", reessayable: true });
    expect(arret.refus!.message).toMatch(/montage final de la vidéo pour youtube-shorts n'a pas abouti/);
    // Jamais le message brut du serveur.
    expect(arret.refus!.message).not.toMatch(/chrome|idRendu|139/);

    const lus = [...m.lus];
    const payesAvant = (x: Monde) => x.appelsClaude.filter((a) => a.role === "lecture-image" || a.role === "ecriture-image-video").length;
    const claudeAvant = payesAvant(m);
    const reservations = arret.caisse.reservations.map((r) => r.cle);
    const scenesAvant = serveur.scenes().length;
    const montagesAvant = serveur.montages().map((d) => d.idRendu);

    panne = false;
    const fin = (await jusquAuBout(reprendreIV(arret), o)).etat;
    expect(fin.etape).toBe("prete");
    // Voix et appels Claude d'avant le rendu : jamais refaits ; les réservations d'avant restent les mêmes.
    expect(m.lus).toEqual(lus);
    expect(payesAvant(m)).toBe(claudeAvant);
    expect(fin.caisse.reservations.map((r) => r.cle).slice(0, reservations.length)).toEqual(reservations);
    expect(engageCentimes(fin)).toBeLessThanOrEqual(fin.caisse.plafondCentimes);
    // Scènes déjà déposées : reprises telles quelles ; le montage raté repart sous un AUTRE identifiant.
    expect(serveur.scenes()).toHaveLength(scenesAvant);
    const nouveaux = serveur.montages().map((d) => d.idRendu).filter((id) => !montagesAvant.includes(id));
    expect(nouveaux.length).toBeGreaterThan(0);
    expect(nouveaux.every((id) => /-e1$/.test(id))).toBe(true);
  });

  it("scène ratée : arrêt qui la situe (n sur N) ; la reprise ne rend que les scènes manquantes", async () => {
    const m = monde();
    let cible: string | null = null;
    const serveur: ServeurDouble = new ServeurDouble({
      echoue: (d): boolean => {
        if ((d.parametres as { mode?: string }).mode) return false;
        // La 3e scène soumise tombe en panne au premier essai.
        cible ??= serveur.scenes()[2]?.sortie.cle ?? null;
        return d.sortie.cle === cible && !/-e\d+$/.test(d.idRendu);
      },
    });
    const o = outilsAvecRendu(m, serveur);
    const arret = (await jusquAuBout(depart(["youtube-shorts"]), o)).etat;
    expect(arret.refus).toMatchObject({ etape: "rendu", code: "IV_PANNE", reessayable: true });
    expect(arret.refus!.message).toMatch(/Le rendu d'une scène de la vidéo pour youtube-shorts n'a pas abouti \(scène \d+ sur \d+\)/);
    const deposees = new Set(serveur.deposes);
    const avant = serveur.scenes().length;

    const fin = (await jusquAuBout(reprendreIV(arret), o)).etat;
    expect(fin.etape).toBe("prete");
    const reprises = serveur.scenes().slice(avant);
    // Aucune scène déjà déposée n'est soumise de nouveau.
    expect(reprises.every((d) => !deposees.has(d.sortie.cle))).toBe(true);
    expect(reprises.some((d) => d.sortie.cle === cible && /-e1$/.test(d.idRendu))).toBe(true);
  });
});

describe("rendu réel : écran que la composition v4 ne sait pas montrer", () => {
  it("image A : la mise en scène découpe ses écrans trop chargés, plus aucun refus au rendu", async () => {
    const m = monde();
    const serveur = new ServeurDouble();
    const { etat } = await jusquAuBout(etatInitialIV(demandeEssai(carteFixe("A"), { reseaux: ["youtube-shorts"] })), outilsAvecRendu(m, serveur, outilsSimules(carteFixe("A"), m)));
    expect(etat.refus?.code).not.toBe("IV_RENDU");
    expect(serveur.soumises.length).toBeGreaterThan(0);
  });

  it("dernier filet : un écran « titre » de 3 lignes (2 au plus) est refusé NET avant tout envoi, non réessayable tel quel, sans identifiant", async () => {
    const m = monde();
    const serveur = new ServeurDouble();
    const o = outilsAvecRendu(m, serveur, outilsSimules(carteFixe("A"), m));
    const rendre = o.rendre;
    // Une ligne de temps dont un écran v4 porte 3 lignes (la mise en scène n'en produit plus) : le rendu la refuse.
    o.rendre = (d) => {
      const blocs = d.ligne.blocs.map((b) => (b.sorte === "ecran" && b.ecran.type === "titre" ? { ...b, ecran: { ...b.ecran, lignes: ["Une", "Deux", "Trois"] } } : b));
      return rendre({ ...d, ligne: { ...d.ligne, blocs } });
    };
    const { etat } = await jusquAuBout(etatInitialIV(demandeEssai(carteFixe("A"), { reseaux: ["youtube-shorts"] })), o);
    expect(etat.refus).toMatchObject({ etape: "rendu", code: "IV_RENDU", reessayable: false });
    expect(etat.refus!.message).toMatch(/trop chargé.*rien n'a été envoyé au rendu/);
    expect(etat.refus!.phrases!.some((p) => /écran n° \d+ : 3 lignes de texte, 2 au plus/.test(p))).toBe(true);
    expect(etat.refus!.phrases!.join(" ")).not.toMatch(/\be\d{2}\b/);
    expect(serveur.soumises).toEqual([]);
  });
});

/* ------------------------------------------------------------------ */
/* Pièces pures                                                          */
/* ------------------------------------------------------------------ */

describe("pièces pures du rendu", () => {
  it("images noires et figées lues dans le journal de FFmpeg (figée jusqu'à la fin comprise)", () => {
    const journal = [
      "[blackdetect @ 0x1] black_start:0 black_end:0.08 black_duration:0.08",
      "[freezedetect @ 0x2] lavfi.freezedetect.freeze_start: 3.2",
      "[freezedetect @ 0x2] lavfi.freezedetect.freeze_duration: 0.36",
      "[freezedetect @ 0x2] lavfi.freezedetect.freeze_end: 3.56",
      "[freezedetect @ 0x2] lavfi.freezedetect.freeze_start: 41.1",
    ].join("\n");
    expect(lireNoirEtFige(journal, 42)).toEqual({ noirMaxSec: 0.08, figeMaxSec: 0.9 });
    expect(lireNoirEtFige("", 10)).toEqual({ noirMaxSec: 0, figeMaxSec: 0 });
  });

  it("sous-titres : le mot fort est « en valeur » ; propriétés des blocs dans la durée du bloc", () => {
    const ligne = {
      sousTitres: { groupes: [{ id: "g1", debutSec: 0, finSec: 1, mots: [{ mot: "Gagnez", debutSec: 0, finSec: 0.4, orange: false }, { mot: "*temps*", debutSec: 0.4, finSec: 1, orange: true }] }], bande: { haut: 0.6, bas: 0.67 }, taille: 0.036, ombre: false as const },
    };
    expect(segmentsSousTitresIV(ligne)[0].mots).toEqual([
      { mot: "Gagnez", debutSec: 0, finSec: 0.4 },
      { mot: "*temps*", debutSec: 0.4, finSec: 1, enValeur: true },
    ]);
    const p = parametresDuBloc({ id: "b1", debut: 10, fin: 12.5, sorte: "objets", fond: "ivoire", entetes: [], objets: [] }, { largeur: 1080, hauteur: 1920, fps: 25, repere: null });
    expect(p).toMatchObject({ composition: "ImageVideoObjets", proprietes: { dureeSec: 2.5, largeur: 1080, fond: "ivoire" } });
  });

  it("dernier bloc écran allongé par la mise en scène (fin > finMs) : la scène dure toute sa place au montage", () => {
    // La mise en scène allonge `fin` du dernier bloc jusqu'à la fin de la vidéo sans toucher `ecran.finMs`.
    const ecran = { id: "fin-1", type: "titre" as const, fond: "ivoire" as const, lignes: ["Écrivez *AUDIT*"], debutMs: 40_000, finMs: 42_000, evenements: [{ cible: "appel", ms: 40_100 }] };
    const ligne = { largeur: 1080, hauteur: 1920, fps: 30, repere: null };
    const p = parametresDuBloc({ id: "b9", debut: 40, fin: 45.5, sorte: "ecran", ecran } as never, ligne).proprietes as { debutMs: number; finMs: number };
    expect(p.finMs - p.debutMs).toBe(5_500);
    expect(p.debutMs).toBe(40_000);
    // Un bloc non allongé garde sa durée.
    const q = parametresDuBloc({ id: "b8", debut: 40, fin: 42, sorte: "ecran", ecran } as never, ligne).proprietes as { debutMs: number; finMs: number };
    expect(q.finMs - q.debutMs).toBe(2_000);
  });
});
