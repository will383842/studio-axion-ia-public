/**
 * ORG-07b (U-5, partie 2) : la sous-machine « texte validé → son maître + heure de chaque mot » de la brique
 * `voix-maitre`, avec des doubles seulement (aucun appel réel) : parcours complet, reprise après panne à chaque phase,
 * même texte = même empreinte, aucune lecture payée si le contrôle d'avant lecture (budget) refuse.
 */
import { describe, expect, it } from "vitest";
import { avancerVoixMaitre, ErreurVoixMaitre, type EtatVoixMaitre, type OutilsVoixMaitre } from "@/briques/voix-maitre/machine";
import { REGLES_NETTOYAGE_PAR_DEFAUT } from "@/briques/voix-maitre";
import { empreinteAudioMaitre } from "@/briques/empreinte-audio";
import type { CommandeFabrication, MotHorodate } from "@/domaine/types";
import type { DemandeRendu, EtatRendu, FournisseurAlignement, FournisseurVoix, ServiceRendu, StockageFichiers } from "@/fournisseurs/types";

const MOTS: MotHorodate[] = [
  { mot: "Bonjour", debutSec: 0.1, finSec: 0.6 },
  { mot: "maître", debutSec: 1.6, finSec: 2.1 },
  { mot: "Will", debutSec: 2.2, finSec: 2.6 },
];

interface Journal {
  appels: string[];
}

/** Doubles neufs (une « reprise » = des doubles neufs, comme un serveur qui redémarre). */
function doubles(journal: Journal, options: { calage?: boolean; texte?: string; copieRatee?: number; renduEchecs?: number } = {}) {
  const texte = options.texte ?? "Bonjour maître Will";
  let copiesRatees = options.copieRatee ?? 0;
  let echecsRendu = options.renduEchecs ?? 0;
  const soumises = new Map<string, DemandeRendu>();
  const voix = {
    id: "voix-double",
    type: "voix",
    nom: "Voix double",
    reelPrevu: "",
    mode: "simulation",
    capacites: { audioSeul: true, horodatageMots: true },
    async lire(d: { texte: string; idExterne: string }) {
      journal.appels.push(`voix.lire:${d.idExterne}`);
      return { fichierCle: "https://fournisseur.test/tmp.mp3", dureeSec: 3, cout: { centimes: 42, devise: "EUR" }, mots: MOTS, copieEnAttente: { adresse: "https://fournisseur.test/tmp.mp3", idDemande: "dem-1" } };
    },
    async copierSon(_a: string, idExterne: string, idDemande: string) {
      journal.appels.push(`voix.copierSon:${idExterne}:${idDemande}`);
      if (copiesRatees-- > 0) throw new Error("copie ratée (panne passagère)");
      return "studio/test/audio-maitre/v1/brut.mp3";
    },
  } as unknown as FournisseurVoix;
  const stockage = {
    async urlLecture(cle: string) {
      return `https://stockage.test/${cle}`;
    },
    async urlLectureDuree(cle: string) {
      return `https://stockage.test/${cle}`;
    },
    async urlDepotDuree(cle: string) {
      return `https://depot.test/${cle}`;
    },
  } as unknown as StockageFichiers;
  const aligneur = {
    mode: options.calage ? "reel" : "simulation",
    async soumettre(d: { idAlignement: string }) {
      journal.appels.push(`aligneur.soumettre:${d.idAlignement}`);
    },
    async suivre(id: string) {
      journal.appels.push(`aligneur.suivre:${id}`);
      return { statut: "termine", resultat: { mots: MOTS, motsNonAlignes: 0, modele: "double", dureeCalculSec: 0.1 } };
    },
  } as unknown as FournisseurAlignement;
  const rendu: ServiceRendu = {
    async soumettre(d) {
      journal.appels.push(`rendu.soumettre:${d.idRendu}`);
      soumises.set(d.idRendu, d);
      return { idRendu: d.idRendu };
    },
    async etat(id): Promise<EtatRendu> {
      journal.appels.push(`rendu.etat:${id}`);
      const d = soumises.get(id);
      if (!d) return { statut: "inconnu" };
      if (echecsRendu > 0) {
        echecsRendu--;
        return { statut: "echec", erreur: { code: "indisponible", reessayable: true, message: "Panne passagère." } };
      }
      return { statut: "termine", sortieCle: d.sortie.cle, mesures: d.parametres.mode === "appliquer" ? { dureeSec: 2 } : {} };
    },
  };
  const commande = { script: { texteComplet: texte }, distribution: [{ fournisseurVoix: "voix-double", idVoixFournisseur: "voix-42", reglagesVoix: { vitesse: 1, stabilite: 45, emotion: 30 } }], prononciations: [] } as unknown as CommandeFabrication;
  const outils: OutilsVoixMaitre = {
    voix: () => voix,
    stockage: () => stockage,
    aligneur: () => aligneur,
    rendu: () => rendu,
    renduEstSimule: () => false,
    cle: (nom) => `studio/test/audio-maitre/v1/base-${nom}`,
    idBase: "base",
    texte: () => texte,
    empreinte: () => empreinteAudioMaitre(commande),
    idVoix: "voix-42",
    reglages: { vitesse: 1, stabilite: 45, emotion: 30 },
    fournisseurVoix: "voix-double",
    caler: (motsEstimes) => !!options.calage || motsEstimes,
    regles: REGLES_NETTOYAGE_PAR_DEFAUT,
  };
  return outils;
}

/** Fait tourner la machine jusqu'au son maître ; rend les états gardés (sérialisés, comme dans le travail). */
async function jusquAuBout(o: OutilsVoixMaitre, depart: EtatVoixMaitre = { phase: "a-lire" }): Promise<EtatVoixMaitre[]> {
  const etats: EtatVoixMaitre[] = [];
  let etat = depart;
  for (let tour = 0; tour < 30 && etat.phase !== "faite"; tour++) {
    etat = JSON.parse(JSON.stringify(await avancerVoixMaitre(etat, o))) as EtatVoixMaitre;
    etats.push(etat);
  }
  return etats;
}

const lectures = (j: Journal) => j.appels.filter((a) => a.startsWith("voix.lire")).length;

describe("ORG-07b · brique voix-maitre : texte → son maître", () => {
  it("parcours complet avec doubles : un seul appel de voix, son maître nettoyé et mots horodatés", async () => {
    const j: Journal = { appels: [] };
    const etats = await jusquAuBout(doubles(j));
    expect(etats.map((e) => e.phase)).toEqual(["a-copier", "a-analyser", "analyse", "nettoyage", "faite"]);
    const fin = etats.at(-1)!;
    if (fin.phase !== "faite") throw new Error("inachevé");
    expect(fin.audio.fichierCle).toBe("studio/test/audio-maitre/v1/base-audio-maitre.wav");
    expect(fin.audio.dureeSec).toBe(2);
    expect(fin.audio.mots.map((m) => m.mot)).toEqual(["Bonjour", "maître", "Will"]);
    // Le blanc long (0,6 → 1,6 s) est raccourci : les mots qui suivent sont avancés.
    expect(fin.audio.coupures).toBeGreaterThan(0);
    expect(fin.audio.mots[1].debutSec).toBeLessThan(1.6);
    expect(fin.audio).toMatchObject({ reutilise: false, coutCentimes: 42, fournisseur: "voix-double", caracteres: "Bonjour maître Will".length });
    expect(fin.audio.empreinte).toMatch(/^am-/);
    expect(lectures(j)).toBe(1);
    expect(j.appels.filter((a) => a.startsWith("rendu.soumettre"))).toEqual(["rendu.soumettre:base-analyse", "rendu.soumettre:base-nettoyage"]);
  });

  it("calage réel : les phases a-aligner et alignement sont parcourues, puis l'analyse", async () => {
    const j: Journal = { appels: [] };
    const etats = await jusquAuBout(doubles(j, { calage: true }));
    // `alignement` terminé enchaîne l'analyse dans le même tour (comme avant l'extraction).
    expect(etats.map((e) => e.phase)).toEqual(["a-copier", "a-aligner", "alignement", "analyse", "nettoyage", "faite"]);
    expect(j.appels).toContain("aligneur.soumettre:base-alignement");
    const fin = etats.at(-1)!;
    expect(fin.phase === "faite" && fin.audio.alignement).toBeTruthy();
  });

  it("reprise après panne à CHAQUE phase : des doubles neufs finissent le travail sans relire la voix, même son maître", async () => {
    for (const calage of [false, true]) {
      const reference = await jusquAuBout(doubles({ appels: [] }, { calage }));
      const attendu = reference.at(-1)!;
      for (const etat of reference.slice(0, -1)) {
        const j: Journal = { appels: [] };
        const suite = await jusquAuBout(doubles(j, { calage }), etat);
        expect(lectures(j), `reprise depuis « ${etat.phase} »`).toBe(0);
        expect(suite.at(-1), `reprise depuis « ${etat.phase} »`).toEqual(attendu);
      }
    }
  });

  it("panne pendant la copie : le tour suivant refait la copie, jamais la lecture", async () => {
    const j: Journal = { appels: [] };
    const o = doubles(j, { copieRatee: 1 });
    const copie = await avancerVoixMaitre({ phase: "a-lire" }, o);
    expect(copie.phase).toBe("a-copier");
    await expect(avancerVoixMaitre(copie, o)).rejects.toThrow(/copie ratée/);
    const suite = await jusquAuBout(o, copie);
    expect(suite.at(-1)?.phase).toBe("faite");
    expect(lectures(j)).toBe(1);
    expect(j.appels.filter((a) => a.startsWith("voix.copierSon"))).toEqual(["voix.copierSon:voix-42:dem-1", "voix.copierSon:voix-42:dem-1"]);
  });

  it("échec passager du rendu : nouvelle demande (-e1) sans relire la voix ; rendu redémarré : même demande resoumise", async () => {
    const j: Journal = { appels: [] };
    const etats = await jusquAuBout(doubles(j, { renduEchecs: 1 }));
    expect(etats.at(-1)?.phase).toBe("faite");
    expect(j.appels).toContain("rendu.soumettre:base-analyse-e1");
    expect(lectures(j)).toBe(1);
  });

  it("stockage non relié : erreur typée injectée (ou celle de la brique), avant toute demande de rendu", async () => {
    const j: Journal = { appels: [] };
    const o = doubles(j);
    const etat = { phase: "a-analyser", brut: { fichierCle: "studio/x.mp3", dureeSec: 3, mots: MOTS, coutCentimes: 42, fournisseur: "voix-double", caracteres: 19 } } as const;
    const sansStockage: OutilsVoixMaitre = { ...o, stockage: () => ({ urlLecture: async () => "/local/x.mp3" }) as unknown as StockageFichiers };
    await expect(avancerVoixMaitre(etat, sansStockage)).rejects.toBeInstanceOf(ErreurVoixMaitre);
    class ErreurAppelant extends Error {}
    await expect(avancerVoixMaitre(etat, { ...sansStockage, erreurStockage: (m) => new ErreurAppelant(m) })).rejects.toBeInstanceOf(ErreurAppelant);
    expect(j.appels.filter((a) => a.startsWith("rendu."))).toEqual([]);
  });

  it("même texte = même empreinte ; texte différent = empreinte différente", async () => {
    const fin = async (texte: string) => {
      const e = (await jusquAuBout(doubles({ appels: [] }, { texte }))).at(-1)!;
      if (e.phase !== "faite") throw new Error("inachevé");
      return e.audio.empreinte;
    };
    expect(await fin("Bonjour maître Will")).toBe(await fin("Bonjour maître Will"));
    expect(await fin("Bonjour maître Will")).not.toBe(await fin("Au revoir maître Will"));
  });

  it("son maître déjà fait avec la même empreinte : repris sans lecture ni contrôle de budget", async () => {
    const j: Journal = { appels: [] };
    const o = doubles(j);
    const premier = (await jusquAuBout(o)).at(-1)!;
    if (premier.phase !== "faite") throw new Error("inachevé");
    let controles = 0;
    const repris = await avancerVoixMaitre({ phase: "a-lire" }, { ...o, existant: premier.audio, avantLecture: () => void controles++ });
    expect(repris.phase === "faite" && repris.audio).toMatchObject({ reutilise: true, coutCentimes: 0, caracteres: 0, empreinte: premier.audio.empreinte, fichierCle: premier.audio.fichierCle });
    expect(controles).toBe(0);
    expect(lectures(j)).toBe(1);
    // Empreinte différente : le son est relu.
    await avancerVoixMaitre({ phase: "a-lire" }, { ...o, existant: { ...premier.audio, empreinte: "am-autre" } });
    expect(lectures(j)).toBe(2);
  });

  it("budget refusé : aucun appel à la voix, l'erreur remonte telle quelle", async () => {
    const j: Journal = { appels: [] };
    const o = doubles(j);
    const refus = new Error("Plafond du mois atteint.");
    await expect(avancerVoixMaitre({ phase: "a-lire" }, { ...o, avantLecture: async () => Promise.reject(refus) })).rejects.toBe(refus);
    expect(j.appels).toEqual([]);
  });

  it("la brique n'importe rien de src/moteurs/", async () => {
    const { readdirSync, readFileSync } = await import("node:fs");
    const { join } = await import("node:path");
    const dossier = join(process.cwd(), "src/briques/voix-maitre");
    for (const f of readdirSync(dossier).filter((x) => x.endsWith(".ts"))) {
      const source = readFileSync(join(dossier, f), "utf8");
      expect(source, f).not.toMatch(/from\s+["'](@\/moteurs|\.\.\/\.\.\/moteurs)/);
      expect(source, f).not.toMatch(/from\s+["']@\/fournisseurs\/(heygen|elevenlabs|registre)|from\s+["']@\/fournisseurs["']/);
    }
  });
});
