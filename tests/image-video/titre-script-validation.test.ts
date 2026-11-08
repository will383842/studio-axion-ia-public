/**
 * Lot F · « Image → vidéo » part d'un TITRE/IDÉE ou d'un SCRIPT collé (plus d'image).
 * - Titre ou idée : le script généré s'arrête pour Williams (lisible, modifiable), même en mode « automatique » ;
 *   « Valider et fabriquer » lance la suite. Cette pause n'est ni un échec ni un prix.
 * - Script collé : fabrication directe (le script fait foi), sans pause.
 * Tout est SIMULÉ : aucun appel réel.
 */
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { avancerJusquAArretIV, etatInitialIV, validerScriptIV, type DecisionScriptIV, type EtatFabricationIV } from "@/moteurs/montage-image-video/fabrication";
import { demandeDeLaCommande, lireEntreesImageVideo, PHRASE_SCRIPT_A_VALIDER } from "@/moteurs/montage-image-video";
import { cleDuTexte } from "@/moteurs/montage-image-video/texte/conception";
import { lectureDeCarte } from "@/moteurs/montage-image-video/lecture/simulation";
import { appelerConceptionEnSimulation } from "@/moteurs/montage-image-video/texte/simulation";
import { ENTREES_VISIBLES, ENTREE_PAR_DEFAUT } from "@/components/formats/image-video/entrees";
import { carteFixe, demandeEssai, monde, outilsSimules } from "./doubles-fabrication";

vi.setConfig({ testTimeout: 120_000 });
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: () => undefined, push: () => undefined }), usePathname: () => "/image-video" }));

const IDEE = "Une PME répond à ses clients la nuit grâce à un chatbot";
const SCRIPT =
  "Vingt-trois heures quatorze. Un client vous écrit. Vous dormez, lui attend. Sauf si quelqu'un lui répond tout de suite. Le chatbot lit la demande, puis la réponse part en quatre secondes. Le ticket se ferme tout seul. Un e-mail propre part à la bonne équipe. Une alerte tombe sur Telegram. Le client est prévenu : réponse sous deux heures. Votre client a toujours une réponse.";

function outils() {
  const m = monde();
  const base = outilsSimules(carteFixe("C"), m);
  const conception = appelerConceptionEnSimulation(lectureDeCarte(carteFixe("C")));
  return {
    ...base,
    // L'écriture simulée ne connaît que les images A à F : on la fait parler comme pour C, avec l'empreinte de la carte demandée.
    ecriture: {
      ...base.ecriture,
      appeler: async (role: Parameters<typeof base.ecriture.appeler>[0], entree: Parameters<typeof base.ecriture.appeler>[1]) => {
        const r = await base.ecriture.appeler(role, { ...entree, variable: entree.variable.replace(/<image-id>.*?<\/image-id>/, `<image-id>${carteFixe("C").image.empreinte}</image-id>`) });
        const empreinte = /<empreinte_carte>([\s\S]*?)<\/empreinte_carte>/.exec(entree.variable)?.[1];
        if (!r.ok || !empreinte) return r;
        const fiche = typeof r.texte === "string" ? JSON.parse(r.texte) : structuredClone(r.donnees as object);
        (fiche as { empreinteCarte: unknown }).empreinteCarte = JSON.parse(empreinte);
        return { ...r, ...(typeof r.texte === "string" ? { texte: JSON.stringify(fiche) } : { donnees: fiche }) };
      },
    },
    lecture: { convertir: async () => { throw new Error("aucune image"); }, appeler: async (r: Parameters<typeof conception>[0], e: Parameters<typeof conception>[1]) => conception(r, e) } };
}
const demande = (texte: string, plus = {}) => demandeEssai(carteFixe("C"), { videoId: "v-iv", image: { cle: `texte:${cleDuTexte(texte)}` }, texte, validationCarte: "automatique", plafondCentimes: 5000, ...plus });
const decision = (e: EtatFabricationIV): DecisionScriptIV => ({ proposition: e.propositionScript!.empreinte, choixFormules: Object.fromEntries(e.propositionScript!.formules.map((f) => [f.cle, "garder" as const])) });

describe("titre ou idée : le script généré attend Williams avant toute fabrication", () => {
  it("la commande d'un texte (non collé) demande la validation du script, même en mode automatique", () => {
    const e = lireEntreesImageVideo({ imageVideo: { imageCle: "texte:x", texte: IDEE, reseaux: ["instagram"] } });
    const d = demandeDeLaCommande({ videoId: "v", entrees: { imageVideo: { imageCle: "texte:x", texte: IDEE, reseaux: ["instagram"] } }, reglages: { validationCarte: "automatique" } } as never, "ver-1");
    expect(e.texte).toBe(IDEE);
    expect(d.scriptAValider).toBe(true);
    const colle = demandeDeLaCommande({ videoId: "v", entrees: { imageVideo: { imageCle: "texte:x", texte: SCRIPT, scriptColle: true, reseaux: ["instagram"] } }, reglages: { validationCarte: "automatique" } } as never, "ver-1");
    expect(colle.scriptAValider).toBeUndefined();
  });

  it("titre → script généré affiché → modification → validation → fabrication", async () => {
    const o = outils();
    const arret = await avancerJusquAArretIV(etatInitialIV(demande(IDEE, { scriptAValider: true })), o);
    // Pause : le script est proposé, rien n'est mis de côté, la voix n'est pas encore payée.
    expect(arret.etape).toBe("script-a-valider");
    expect(arret.miseDeCote).toBeUndefined();
    expect(arret.propositionScript?.fiche.ecrans.length).toBeGreaterThan(0);
    expect(arret.script).toBeUndefined();
    // Williams modifie un mot, puis valide.
    const fiche = structuredClone(arret.propositionScript!.fiche);
    fiche.ecrans[1] = { ...fiche.ecrans[1]!, texteDit: `${fiche.ecrans[1]!.texteDit}` };
    const valide = validerScriptIV(arret, { ...decision(arret), fiche });
    expect(valide.script).toBeDefined();
    const fin = await avancerJusquAArretIV(valide, o);
    expect(fin.etape).not.toBe("script-a-valider");
    expect(fin.etape).not.toBe("refusee");
  });

  it("sans l'indicateur, le comportement automatique d'avant ne change pas (lot, essais)", async () => {
    const arret = await avancerJusquAArretIV(etatInitialIV(demande(IDEE)), outils());
    expect(arret.etape).not.toBe("script-a-valider");
  });
});

describe("script collé : fabrication directe", () => {
  it("aucune pause : le script de Williams passe tel quel jusqu'à la voix", async () => {
    const arret = await avancerJusquAArretIV(etatInitialIV(demande(SCRIPT, { scriptColle: true })), outils());
    expect(arret.etape).not.toBe("script-a-valider");
    expect(arret.script).toBeDefined();
  });
});

describe("l'entrée par image n'existe plus dans le formulaire", () => {
  it("deux entrées seulement : un titre ou une idée, un script ; aucune image", () => {
    expect(ENTREES_VISIBLES.map((x) => x.valeur)).toEqual(["texte", "script"]);
    expect(ENTREES_VISIBLES.map((x) => x.libelle).join(" ")).not.toMatch(/image/i);
    expect(ENTREE_PAR_DEFAUT).toBe("texte");
  });

  it("la pause de validation ne parle pas de prix", () => {
    expect(PHRASE_SCRIPT_A_VALIDER).not.toMatch(/prix|€/i);
  });
});

describe("interface sans prix", () => {
  it("le formulaire (titre/idée ou script) n'affiche ni prix ni image", async () => {
    const { Depot } = await import("@/components/formats/image-video/Depot");
    const html = renderToStaticMarkup(createElement(Depot, { montants: { 1: 120, 2: 240, 3: 360, 4: 480 } }));
    expect(html).not.toMatch(/€|au plus|prix/i);
    expect(html).not.toMatch(/Déposez|image/i);
    expect(html).toMatch(/Titre ou idée/);
  });
});
