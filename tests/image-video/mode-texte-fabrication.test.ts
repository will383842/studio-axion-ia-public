/**
 * MODE TEXTE (R6b) · Répétition générale GRATUITE de bout en bout : texte libre → conception (simulateur) → carte →
 * réparation → écriture → scènes planifiées, SANS fichier image (aucune lecture de stockage) et sans appel payant.
 */
import { describe, expect, it, vi } from "vitest";
import { attendWillIV, avancerJusquAArretIV, etatInitialIV, reprendreIV, validerCarteIV, validerScriptIV, type DecisionCarteIV, type DecisionScriptIV, type EtatFabricationIV, type OutilsFabricationIV } from "@/moteurs/montage-image-video/fabrication";
import { estCleTexte, cleDuTexte, roleConceptionWorkflowIV } from "@/moteurs/montage-image-video/texte/conception";
import { lectureDeCarte } from "@/moteurs/montage-image-video/lecture/simulation";
import { appelerConceptionEnSimulation, CONCEPTION_DEMO, CONCEPTION_VIDE } from "@/moteurs/montage-image-video/texte/simulation";
import { carteFixe, demandeEssai, monde, outilsSimules } from "./doubles-fabrication";

const TEXTE = "Quand une facture client dépasse 30 jours, l'IA rédige une relance polie, l'envoie par e-mail et suit le paiement dans le tableur.";

/** Outils simulés où LIRE un fichier image est une faute : le mode texte n'en a aucun. */
function outilsTexte(reponses?: Parameters<typeof appelerConceptionEnSimulation>[0]) {
  const m = monde();
  const base = outilsSimules(carteFixe("C"), m);
  const lectures: string[] = [];
  const appelerConception = appelerConceptionEnSimulation(reponses);
  const o: OutilsFabricationIV = {
    ...base,
    // L'écriture simulée ne connaît que les images A à F (par l'empreinte de l'image) : on la fait parler comme pour C.
    ecriture: {
      ...base.ecriture,
      appeler: async (role, entree) => {
        const r = await base.ecriture.appeler(role, { ...entree, variable: entree.variable.replace(/<image-id>.*?<\/image-id>/, `<image-id>${carteFixe("C").image.empreinte}</image-id>`) });
        // La fiche porte l'empreinte de la carte VRAIMENT demandée (ici, celle du texte), comme le ferait l'IA.
        const empreinte = /<empreinte_carte>([\s\S]*?)<\/empreinte_carte>/.exec(entree.variable)?.[1];
        if (!r.ok || !empreinte) return r;
        const fiche = typeof r.texte === "string" ? JSON.parse(r.texte) : structuredClone(r.donnees as object);
        (fiche as { empreinteCarte: unknown }).empreinteCarte = JSON.parse(empreinte);
        return { ...r, ...(typeof r.texte === "string" ? { texte: JSON.stringify(fiche) } : { donnees: fiche }) };
      },
    },
    lireImageSource: async (cle) => {
      lectures.push(cle);
      throw new Error("aucun fichier image n'existe en mode texte");
    },
    lecture: {
      convertir: async () => {
        throw new Error("aucune conversion d'image en mode texte");
      },
      appeler: async (role, entree) => {
        m.appelsClaude.push({ role: role.id, variable: entree.variable });
        return appelerConception(role, entree);
      },
    },
  };
  return { o, m, lectures };
}

function demandeTexte(texte = TEXTE) {
  const c = carteFixe("C");
  return demandeEssai(c, { videoId: "v-texte", image: { cle: `texte:${cleDuTexte(texte)}` }, texte, plafondCentimes: 5000 });
}

const decisionCarte = (e: EtatFabricationIV): DecisionCarteIV => ({ proposition: e.propositionCarte!.empreinte, le: "2026-10-25T08:00:00.000Z" });
const decisionScript = (e: EtatFabricationIV): DecisionScriptIV => ({ proposition: e.propositionScript!.empreinte, choixFormules: Object.fromEntries(e.propositionScript!.formules.map((f) => [f.cle, "garder" as const])) });

vi.setConfig({ testTimeout: 120_000 });

describe("mode texte · la fabrication saute la lecture d'image", () => {
  it("texte → carte à valider : une conception, aucun fichier lu, provenance texte, mention d'exemple", async () => {
    const { o, m, lectures } = outilsTexte();
    const e = await avancerJusquAArretIV(etatInitialIV(demandeTexte()), o);
    expect(e.refus).toBeUndefined();
    expect(e.etape).toBe("carte-a-valider");
    expect(lectures).toEqual([]);
    expect(m.appelsClaude.map((a) => a.role)).toEqual([roleConceptionWorkflowIV.id]);
    const carte = e.propositionCarte!.carte;
    expect(estCleTexte(carte.image.cle)).toBe(true);
    expect(carte.noeuds).toHaveLength(CONCEPTION_DEMO.noeuds.length);
    expect(carte.pied).toContain("Exemple de situation type.");
    expect(e.propositionCarte!.controle.ok).toBe(true);
    // La réservation passe par la caisse de la vidéo (même chemin que la lecture d'image).
    expect(e.caisse.reservations.length).toBe(1);
    expect(m.depenses[0].etape).toBe("lecture");
    expect(m.depenses[0].appelId).toContain("conception");
  });

  it("de bout en bout : carte validée → script écrit → scènes planifiées, la vidéo est prête, sans image source", async () => {
    // Conception « à la façon de C » : mêmes blocs que l'image C, pour que l'écriture simulée (A à F) ait son script.
    const { o: o0, lectures } = outilsTexte(lectureDeCarte(carteFixe("C")));
    // La relecture finale : on note ce qui part à l'IA (images jointes et consigne).
    const relectures: { images: number; variable: string }[] = [];
    const o: OutilsFabricationIV = { ...o0, controles: { ...o0.controles, appeler: async (role, entree) => (role.id.includes("relecture") && relectures.push({ images: entree.images?.length ?? 0, variable: entree.variable }), o0.controles.appeler(role, entree)) } };
    let e = await avancerJusquAArretIV(etatInitialIV(demandeTexte()), o);
    e = await avancerJusquAArretIV(validerCarteIV(e, decisionCarte(e)), o);
    expect(e.refus).toBeUndefined();
    expect(attendWillIV(e)).toBe("script");
    e = await avancerJusquAArretIV(validerScriptIV(e, decisionScript(e)), o);
    for (let i = 0; i < 20 && e.etape !== "prete" && e.etape !== "refusee" && e.attente; i++) e = await avancerJusquAArretIV(e, o);
    expect(e.refus).toBeUndefined();
    expect(e.etape).toBe("prete");
    expect(e.scenes?.length ?? 0).toBeGreaterThan(0);
    expect(lectures).toEqual([]);
    // Aucune image source jointe : toutes les images viennent de la vidéo, et la consigne le dit.
    expect(relectures.length).toBeGreaterThan(0);
    for (const r of relectures) {
      expect(r.images).toBe((r.variable.match(/<image nom=/g) ?? []).length);
      expect(r.variable).toContain("AUCUNE image source");
    }
  });

  it("texte absurde : refus clair, rien n'est avancé, reformulation possible (non réessayable tel quel)", async () => {
    const { o } = outilsTexte(CONCEPTION_VIDE);
    const e = await avancerJusquAArretIV(etatInitialIV(demandeTexte("blablabla blabla bla")), o);
    expect(e.etape).toBe("refusee");
    expect(e.refus?.etape).toBe("lecture");
    expect(e.refus?.reessayable).toBe(false);
    expect(e.refus?.message).toMatch(/automatisation/);
  });

  it("panne de l'IA : refus réessayable, rien de perdu", async () => {
    const { o } = outilsTexte({ ok: false, arret: "panne", message: "Claude ne répond pas" });
    const e = await avancerJusquAArretIV(etatInitialIV(demandeTexte()), o);
    expect(e.etape).toBe("refusee");
    expect(e.refus?.reessayable).toBe(true);
  });

  it("« Refaire » après une panne de conception : nouvelle réservation, et le plafond bas ne bloque plus", async () => {
    const panne = outilsTexte({ ok: false, arret: "panne", message: "Claude ne répond pas" });
    const e1 = await avancerJusquAArretIV(etatInitialIV(demandeTexte()), panne.o);
    expect(e1.etape).toBe("refusee");
    const avant = e1.caisse.reservations.length;
    // Même texte, l'IA répond cette fois : la reprise relance la conception (compte à part, jamais gratuite).
    const bon = outilsTexte();
    const e2 = await avancerJusquAArretIV(reprendreIV(e1), bon.o);
    expect(e2.refus).toBeUndefined();
    expect(e2.etape).toBe("carte-a-valider");
    expect(e2.caisse.reservations.length).toBe(avant + 1);
    expect(new Set(e2.caisse.reservations.map((r) => r.cle)).size).toBe(e2.caisse.reservations.length);
    // Plafond trop bas : avertissement seulement, la conception part.
    const bas = outilsTexte();
    const e3 = await avancerJusquAArretIV(etatInitialIV({ ...demandeTexte(), plafondCentimes: 1 }), bas.o);
    expect(e3.refus).toBeUndefined();
    expect(bas.m.appelsClaude.length).toBeGreaterThan(0);
  });
});
