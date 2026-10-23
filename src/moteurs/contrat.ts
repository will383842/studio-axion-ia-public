/**
 * TESTS DE CONTRAT PARTAGÉS (AV2.2-12).
 * `testerMoteurVideo(moteur, fabriquerCommande)` : la simulation les passe dès V1,
 * chaque futur moteur réel devra les passer aussi (forme des travaux, dépendances,
 * erreurs typées `reessayable`, reprise ciblée, une sortie par ratio, coûts en LigneCout, « Arrêter » — lot M1b).
 * À appeler depuis un fichier *.test.ts (dépend de vitest).
 */
import { describe, expect, it } from "vitest";
import type { CommandeFabrication, Ratio } from "@/domaine/types";
import type { MoteurVideo } from "./types";

const T0 = Date.UTC(2026, 9, 1, 9, 0, 0);

async function avancerJusquA(moteur: MoteurVideo, commande: CommandeFabrication, travail: Awaited<ReturnType<MoteurVideo["lancer"]>>, depuis: number, condition: (s: string) => boolean) {
  let t = travail;
  let resultat;
  for (let ms = depuis; ms < depuis + 10 * 60_000; ms += 500) {
    const r = await moteur.avancer(t, commande, ms);
    t = r.travail;
    resultat = r.resultat ?? resultat;
    if (condition(t.statut)) return { travail: t, resultat, maintenant: ms };
  }
  throw new Error(`Le travail n'a pas atteint l'état attendu (dernier : ${t.statut}).`);
}

/** Un ratio que le moteur sait produire et que la commande n'a pas encore. */
function ratioAjoutable(moteur: MoteurVideo, c: CommandeFabrication): Ratio {
  return moteur.capacites.ratios.find((r) => !c.ratios.includes(r)) ?? moteur.capacites.ratios[0];
}

/** Écart admis entre la durée réelle (vraie voix) et l'estimation du texte : 20 %, au moins 3 s. */
export function toleranceDuree(dureeCibleSec: number): number {
  return Math.max(3, dureeCibleSec * 0.2);
}

/**
 * `options.sansPrix` (plan facecam v4, ajout pur) : moteur d'un format sans prix (`estimer()` rend 0). Les montants
 * sont alors tous nuls au lieu de « une retouche coûte plus de 0 et moins que la vidéo ». Absent : contrat inchangé.
 */
export function testerMoteurVideo(moteur: MoteurVideo, fabriquerCommande: () => Promise<CommandeFabrication>, options: { sansPrix?: boolean } = {}) {
  describe(`contrat MoteurVideo — ${moteur.id}`, () => {
    it("déclare ses capacités", () => {
      expect(moteur.capacites.dureeMaxSec).toBeGreaterThan(0);
      expect(moteur.capacites.ratios.length).toBeGreaterThan(0);
      expect(moteur.capacites.langues.length).toBeGreaterThan(0);
    });

    it("estime en LigneCout, total cohérent, en centimes", async () => {
      const c = await fabriquerCommande();
      const e = await moteur.estimer(c);
      expect(e.dureeFabricationSec).toBeGreaterThan(0);
      expect(e.lignes.length).toBeGreaterThan(0);
      for (const l of e.lignes) {
        expect(Number.isInteger(l.total.centimes)).toBe(true);
        expect(l.total.centimes).toBeGreaterThanOrEqual(0);
      }
      expect(e.total.centimes).toBe(e.lignes.reduce((s, l) => s + l.total.centimes, 0));
    });

    it("décrit un graphe d'étapes sans dépendance inconnue", async () => {
      const c = await fabriquerCommande();
      const etapes = moteur.etapes(c);
      const cles = etapes.map((e) => e.cle);
      expect(new Set(cles).size).toBe(cles.length);
      for (const e of etapes) for (const d of e.dependDe) expect(cles).toContain(d);
    });

    it("saute une brique coupée", async () => {
      const c = await fabriquerCommande();
      const sans = { ...c, briques: { ...c.briques, etalonnage: false, "sous-titres": false } };
      const cles = moteur.etapes(sans).map((e) => e.cle);
      expect(cles).not.toContain("etalonnage");
      expect(cles).not.toContain("sous-titres");
    });

    it("brique « son » coupée : pas de mixage facturé ; sans personnage, ni voix ni étape son", async () => {
      const c = await fabriquerCommande();
      const sansSon = { ...c, briques: { ...c.briques, son: false } };
      expect((await moteur.estimer(sansSon)).lignes.map((l) => l.etape)).not.toContain("Mixage");
      const muet = { ...sansSon, distribution: [] };
      expect((await moteur.estimer(muet)).lignes.map((l) => l.etape)).not.toContain("Voix");
      expect(moteur.etapes(muet).map((e) => e.cle)).not.toContain("son");
    });

    it("une retouche et un format ajouté coûtent moins que la vidéo entière", async () => {
      const c = await fabriquerCommande();
      const entiere = (await moteur.estimer(c)).total.centimes;
      const retouche = await moteur.estimerRetouche(c, [c.plans[0]?.id ?? "p"]);
      if (options.sansPrix) {
        expect(entiere).toBe(0);
        expect(retouche.total.centimes).toBe(0);
        expect((await moteur.estimerReexport(c, ratioAjoutable(moteur, c))).total.centimes).toBe(0);
        return;
      }
      expect(retouche.total.centimes).toBeGreaterThan(0);
      expect(retouche.total.centimes).toBeLessThan(entiere);
      // Un ratio des CAPACITÉS du moteur absent de la commande (B.0 §24 : plus de 16:9 en dur).
      const format = await moteur.estimerReexport(c, ratioAjoutable(moteur, c));
      // Lot M4 : un moteur peut le rendre GRATUIT (recomposé depuis les pistes gardées, aucun fournisseur payant, B.9).
      expect(format.total.centimes).toBeGreaterThanOrEqual(0);
      expect(format.total.centimes).toBeLessThan(entiere);
    });

    it("lance un travail idempotent, puis le mène à « termine » avec une sortie par ratio", async () => {
      const c = await fabriquerCommande();
      const travail = await moteur.lancer(c, { travailId: "t-contrat", versionId: "ver-contrat", titre: "Essai", maintenant: T0 });
      expect(travail.id).toBe("t-contrat");
      expect(travail.cibleId).toBe(c.videoId);
      expect(travail.cleIdempotence).toContain(c.videoId);
      expect(["en_file", "en_cours"]).toContain(travail.statut);
      const fin = await avancerJusquA(moteur, c, travail, T0, (s) => s === "termine" || s === "echec");
      expect(fin.travail.statut).toBe("termine");
      expect(fin.travail.progression).toBe(100);
      expect(fin.resultat).toBeDefined();
      expect(fin.resultat!.sorties.map((s) => s.ratio).sort()).toEqual([...c.ratios].sort());
      expect(fin.resultat!.noteQualite.globale).toBeGreaterThan(0);
      expect(fin.resultat!.lignesReelles.every((l) => l.nature === "reel")).toBe(true);
    });

    it("un échec d'étape est typé et réessayable ; « Réessayer » ne relance que l'étape en échec et ses suites", async () => {
      const c = { ...(await fabriquerCommande()), simulerEchecEtape: "montage" };
      const travail = await moteur.lancer(c, { travailId: "t-echec", versionId: "ver-echec", titre: "Essai", maintenant: T0 });
      const enEchec = await avancerJusquA(moteur, c, travail, T0, (s) => s === "echec" || s === "termine");
      expect(enEchec.travail.statut).toBe("echec");
      expect(enEchec.travail.erreur?.reessayable).toBe(true);
      expect(enEchec.travail.erreur?.messagePourWill).toBeTruthy();
      const terminees = enEchec.travail.etapes.filter((e) => e.statut === "terminee").map((e) => e.cle);
      expect(terminees.length).toBeGreaterThan(0);

      const repris = await moteur.reessayer(enEchec.travail, enEchec.maintenant);
      expect(repris.tentatives).toBe(enEchec.travail.tentatives + 1);
      // Les étapes déjà faites ne sont pas refaites.
      for (const cle of terminees) expect(repris.etapes.find((e) => e.cle === cle)?.statut).toBe("terminee");
      const fin = await avancerJusquA(moteur, c, repris, enEchec.maintenant, (s) => s === "termine" || s === "echec");
      expect(fin.travail.statut).toBe("termine");
    });

    it("retouche, réexport et maquette renvoient des objets exploitables", async () => {
      const c = await fabriquerCommande();
      const ctx = { travailId: "t-r", versionId: "ver-r", titre: "Retouche", maintenant: T0 };
      const r = await moteur.retoucher({ commande: c, contexte: ctx, planIds: [c.plans[0]?.id ?? "p"], consigne: "Plus lent" });
      expect(r.type).toBe("retouche");
      const x = await moteur.reexporter({ commande: c, contexte: { ...ctx, travailId: "t-x" }, cible: { ratio: ratioAjoutable(moteur, c) } });
      expect(x.type).toBe("reexport");
      const m = await moteur.maquette(c);
      // La maquette avocat est composée dans le navigateur : pas de fichier vidéo (B.1). S'il y en a un, c'est un mp4.
      if (m.fichierCle) expect(m.fichierCle).toMatch(/\.mp4$/);
      // La maquette entend la vraie voix : sa durée diffère de l'estimation du texte, dans une tolérance (B.0 §18).
      expect(Math.abs(m.dureeSec - c.dureeCibleSec)).toBeLessThanOrEqual(toleranceDuree(c.dureeCibleSec));
    });

    it("« Arrêter » : travail annulé, seules les étapes terminées gardent leur coût, plus rien n'avance (lot M1b)", async () => {
      if (!moteur.annuler) return; // facultatif dans le contrat : un moteur sans annulation est arrêté par le service
      const c = await fabriquerCommande();
      const travail = await moteur.lancer(c, { travailId: "t-arret", versionId: "ver-arret", titre: "Essai", maintenant: T0 });
      // Avancer jusqu'à la première étape terminée, sans finir.
      let t = travail;
      let ms = T0;
      for (; ms < T0 + 10 * 60_000; ms += 250) {
        t = (await moteur.avancer(t, c, ms)).travail;
        if (t.etapes.some((e) => e.statut === "terminee") || t.statut === "termine") break;
      }
      expect(t.statut).not.toBe("termine");
      const terminees = t.etapes.filter((e) => e.statut === "terminee").map((e) => e.cle);
      expect(terminees.length).toBeGreaterThan(0);
      const arrete = await moteur.annuler(t, ms);
      expect(arrete.statut).toBe("annule");
      expect(arrete.etapes.filter((e) => e.statut === "terminee").map((e) => e.cle)).toEqual(terminees);
      for (const e of arrete.etapes) {
        if (e.statut === "terminee") expect(e.coutReel?.centimes ?? 0).toBeGreaterThanOrEqual(0);
        else expect(e.coutReel?.centimes ?? 0).toBe(0);
      }
      // Idempotent, et l'état annulé n'est jamais réécrit par un avancement.
      expect((await moteur.annuler(arrete, ms + 1000)).statut).toBe("annule");
      const apres = await moteur.avancer(arrete, c, ms + 10 * 60_000);
      expect(apres.travail.statut).toBe("annule");
      expect(apres.resultat).toBeUndefined();
    });

    it("accepte une commande sans distribution sans lever d'erreur (estimer, etapes)", async () => {
      const c = { ...(await fabriquerCommande()), distribution: [] };
      await expect(moteur.estimer(c)).resolves.toBeDefined();
      expect(() => moteur.etapes(c)).not.toThrow();
    });
  });
}
