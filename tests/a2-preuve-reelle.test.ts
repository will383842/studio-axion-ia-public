/**
 * LOT A2 (M5) — PREUVE RÉELLE, de bout en bout, avec le VRAI code des services et du moteur. SAUTÉE par défaut :
 * elle ne tourne qu'avec `A2_PREUVE_REELLE=1` (clés lues dans `~/.claude/secrets/studio.env`, jamais affichées).
 *
 *   Mes images (une capture de la console, validée, zones floutées) → Aperçu : cascade réelle (Mes images,
 *   réutilisation 0 €, Pexels / Pixabay en vrai, « à fabriquer ») → fabrication : UNE image + UN clip de 5 s chez
 *   fal.ai (plafond 0,40 $), rangés dans la Bibliothèque → rapport `docs/captures/m5-demo/preuve-m5.json`.
 *
 * Usage : `A2_PREUVE_REELLE=1 pnpm exec vitest run tests/a2-preuve-reelle.test.ts`
 */
import { copyFileSync, mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { hash } from "@node-rs/argon2";
import { describe, expect, it, vi } from "vitest";
import { mockHeaders, mockNavigation } from "./helpers/next-mocks";
import { chargerCles } from "../outils/demo-m5/cles";

const REEL = process.env.A2_PREUVE_REELLE === "1";
if (REEL) {
  chargerCles(["PEXELS_API_KEY", "PIXABAY_API_KEY", ...(process.env.A2_SANS_FAL === "1" ? [] : ["FAL_KEY"])]);
  process.env.FOURNISSEUR_ILLUSTRATION = "reel";
  process.env.FAL_PLAFOND_USD = "0.40";
  process.env.MOTEUR_AVOCAT = "montage-avocat";
}

vi.mock("next/headers", () => mockHeaders);
vi.mock("next/navigation", () => mockNavigation);
vi.mock("next/cache", () => ({ revalidatePath: () => undefined }));

const RACINE = process.cwd();
const SORTIE = join(RACINE, "docs", "captures", "m5-demo");

function dimensionsPng(chemin: string): { largeur: number; hauteur: number } {
  const b = readFileSync(chemin);
  return { largeur: b.readUInt32BE(16), hauteur: b.readUInt32BE(20) };
}

describe.skipIf(!REEL)("preuve réelle du lot M5 (Pexels, Pixabay, fal.ai)", () => {
  it(
    "cascade complète à l'Aperçu, puis une image + un clip fal.ai fabriqués et rangés dans la Bibliothèque",
    async () => {
      const { reinitialiserDepots, depots } = await import("@/donnees/memoire");
      const auth = await import("@/services/auth");
      const videos = await import("@/services/videos");
      const fabrication = await import("@/services/fabrication");
      const travaux = await import("@/services/travaux");
      const mesImages = await import("@/services/mes-images");
      const { fournisseur } = await import("@/services/_commun");
      process.env.SESSION_SECRET = "p".repeat(48);
      process.env.STUDIO_PASSWORD_HASH_B64 = Buffer.from(await hash("preuve-a2", { algorithm: 2, memoryCost: 19456, timeCost: 2, parallelism: 1 })).toString("base64");
      reinitialiserDepots();
      await auth.seConnecter("preuve-a2", false);
      const d = depots();
      expect((await fournisseur("illustration")).id).toBe("reel");
      mkdirSync(SORTIE, { recursive: true });

      // 1. Mes images : une vraie capture de la console du studio, importée puis validée (zones floutées).
      const source = join(RACINE, "docs", "captures", "reglages-budget-390.png");
      const dossierEssai = join(RACINE, "public", "essais", "mes-images");
      mkdirSync(dossierEssai, { recursive: true });
      copyFileSync(source, join(dossierEssai, "console-budget-studio.png"));
      const dims = dimensionsPng(source);
      const f = await d.fichiers.enregistrer({ id: "f-preuve-console", cleStockage: "/essais/mes-images/console-budget-studio.png", nom: "console-budget-studio.png", mime: "image/png", taille: 1, ...dims, origine: "depot", statut: "pret", creeLe: new Date().toISOString(), modifieLe: new Date().toISOString() });
      const { importees } = await mesImages.importerMesImages([{ fichierId: f.id, nom: "console-budget-studio.png", mime: "image/png", empreinte: "a".repeat(64), ...dims }]);
      const vue = await mesImages.validerMesImage(importees[0], { motsCles: ["console", "suivi", "budget", "tableau de bord"] });
      expect(vue.statut).toBe("prete");

      // 2. Une vidéo avocat dont chaque intention vise une marche de la cascade.
      const id = await videos.creerBrouillon("avocat", { scriptId: "script-2" });
      const video = (await d.videos.obtenir(id))!;
      const seg = (sid: string, texte: string, intentionIllustration?: string) => ({ id: sid, texte, ...(intentionIllustration ? { intentionIllustration } : {}) });
      await d.scripts.modifier(video.scriptId!, {
        blocs: [
          { id: "b1", blocRecette: "accroche", segments: [seg("s1", "Vous recevez un PV de 135 € ? Ne le payez pas tout de suite.")] },
          { id: "b2", blocRecette: "promesse", segments: [seg("s2", "Je vous explique pourquoi, en trente secondes, et c'est simple.")] },
          {
            id: "b3",
            blocRecette: "coeur",
            segments: [
              seg("s3", "Votre contestation part toujours avec un accusé de réception : c'est votre seule preuve.", "un accusé de réception de lettre recommandée"),
              seg("s4", "Sans ce papier, l'administration peut dire qu'elle n'a jamais rien reçu, et vous perdez."),
              seg("s5", "Relisez aussi le contrat de location du véhicule avant de signer quoi que ce soit.", "un contrat sur une table"),
              seg("s6", "Une seule erreur sur l'avis, une date ou une plaque, et le PV tombe."),
            ],
          },
          { id: "b4", blocRecette: "preuve", segments: [seg("s7", "Un client a gardé ses 2 500 € en billets, simplement comme ça.", "billets d'euros sur une table"), seg("s8", "Moi, je suis tout dans ma console de suivi du budget, chaque semaine.", "la console de suivi du budget")] },
          { id: "b5", blocRecette: "appel", segments: [seg("s9", "Gardez cette vidéo pour le prochain PV, et partagez-la.")] },
        ],
      });

      // 3. L'Aperçu : la cascade réelle (Pexels / Pixabay appelés en vrai, vidéo recopiée chez nous).
      const t0 = Date.now();
      const apercu = await fabrication.apercuFabrication(id);
      const dureeApercuMs = Date.now() - t0;
      const parPlan = apercu.plans
        .filter((p) => p.sourceImage === "illustration")
        .map((p) => ({ texte: p.texte, requete: p.illustration?.requete, origine: apercu.illustrations?.parPlan[p.id]?.origine, licence: apercu.illustrations?.parPlan[p.id]?.licence, element: p.illustrationNom }));
      const origines = parPlan.map((p) => p.origine);
      expect(origines).toEqual(expect.arrayContaining(["mes-images", "reutilisee", "banque", "a-fabriquer"]));
      const aFabriquer = apercu.illustrations!.resume.aFabriquer;
      expect(aFabriquer).toBe(1);

      // 4. La fabrication : le moteur fabrique l'illustration manquante chez fal.ai (une image, un clip de 5 s).
      const { travailId, versionId } = await fabrication.lancerFabrication(id, { confirme: true });
      const fin = Date.now() + 9 * 60_000;
      let travail = await d.travaux.obtenir(travailId);
      while (travail && travail.statut !== "termine" && travail.statut !== "echec" && Date.now() < fin) {
        await travaux.avancerTravaux();
        await new Promise((r) => setTimeout(r, 2500));
        travail = await d.travaux.obtenir(travailId);
      }
      expect(travail?.statut).toBe("termine");
      const etat = travail!.parametres?.illustrations as { plans: Record<string, { phase: string; image?: { fichierCle: string; coutUsdCentimes: number; modele: string }; clip?: { fichierCle: string; coutUsdCentimes: number; modele: string }; raison?: string }> };
      const fabriques = Object.values(etat?.plans ?? {});
      console.log("[preuve] illustrations :", JSON.stringify(fabriques.map((p) => ({ phase: p.phase, raison: p.raison }))), "étapes :", travail!.etapes.map((e) => `${e.cle}:${e.statut}`).join(" "));
      const fait = fabriques.find((p) => p.phase === "faite");
      expect(fait).toBeTruthy();

      // 5. L'élément créé est dans la Bibliothèque (pastille IA, licence), réutilisable à 0 €.
      const cree = await d.elements.trouver((e) => e.origine === "fabriquee" && e.fabrique === true);
      expect(cree).toBeTruthy();
      const depense = await d.depenses.lister((x) => x.videoId === id);
      const etape = travail!.etapes.find((e) => e.cle === "illustrations");
      const versPublic = (cle: string) => join(RACINE, "public", ...cle.replace(/^\//, "").split("/"));
      for (const [cle, nom] of [
        [fait!.image!.fichierCle, "fal-image.jpg"],
        [fait!.clip!.fichierCle, "fal-clip.mp4"],
      ] as const) {
        if (existsSync(versPublic(cle))) copyFileSync(versPublic(cle), join(SORTIE, nom));
      }
      const banque = parPlan.find((p) => p.origine === "banque");
      const elementBanque = await d.elements.trouver((e) => e.origine === "banque");
      if (elementBanque?.vignetteFichierId) {
        const v = await d.fichiers.obtenir(elementBanque.vignetteFichierId);
        if (v && existsSync(versPublic(v.cleStockage))) copyFileSync(versPublic(v.cleStockage), join(SORTIE, "banque-vignette.jpg"));
      }
      writeFileSync(
        join(SORTIE, "preuve-m5.json"),
        JSON.stringify(
          {
            date: new Date().toISOString(),
            apercu: { dureeMs: dureeApercuMs, plans: parPlan, resume: apercu.illustrations?.resume, coutEstime: apercu.estimation.total, lignes: apercu.estimation.lignes.filter((l) => /illustr/i.test(l.etape)) },
            banque: banque ? { ...banque, element: elementBanque && { nom: elementBanque.nom, licence: elementBanque.licence, empreinte: elementBanque.empreinte, motsCles: elementBanque.motsCles } } : null,
            fabrication: {
              versionId,
              etape: etape && { statut: etape.statut, coutReel: etape.coutReel },
              plans: fabriques.map((p) => ({ phase: p.phase, raison: p.raison, image: p.image && { modele: p.image.modele, coutUsdCentimes: p.image.coutUsdCentimes }, clip: p.clip && { modele: p.clip.modele, coutUsdCentimes: p.clip.coutUsdCentimes } })),
              coutUsd: fabriques.reduce((t, p) => t + (p.image?.coutUsdCentimes ?? 0) + (p.clip?.coutUsdCentimes ?? 0), 0) / 100,
              depenses: depense.map((x) => x.lignes.filter((l) => /illustr/i.test(l.etape))),
            },
            bibliotheque: cree && { id: cree.id, nom: cree.nom, type: cree.type, origine: cree.origine, licence: cree.licence, motsCles: cree.motsCles, utilisations: cree.utilisations, derniereVideoId: cree.derniereVideoId },
            mesImages: { nom: vue.nom, categorie: vue.categorie, statut: vue.statut, zones: vue.zones.length },
          },
          null,
          2,
        ),
      );
    },
    12 * 60_000,
  );
});
