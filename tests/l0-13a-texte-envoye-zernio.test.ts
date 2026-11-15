/**
 * L0-13a : couverture reportée depuis e2e-verif1-a2 (l'envoi Buffer n'existe plus). Ce que le fournisseur Zernio (faux client, aucun appel réel)
 * reçoit comme texte : en-tête de série en première ligne, mots-dièse LinkedIn et TikTok identiques à ceux du kit (au moins 3 pour TikTok),
 * jamais de mot-dièse « fourre-tout » (fyp, viral…).
 */
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { mockHeaders, mockNavigation, reinitialiserRequete } from "./helpers/next-mocks";
import { exemplesCommeVraies } from "./helpers/videos-reelles";
import { preparerMotDePasse } from "./helpers/g1a";
import type { CanalPublication, DemandePublication, FournisseurPublication } from "@/fournisseurs/types";

process.env.R2_ACCOUNT_ID = "compte-essai";
process.env.R2_ACCESS_KEY_ID = "ACCES-ESSAI";
process.env.R2_SECRET_ACCESS_KEY = "secret-essai";
process.env.R2_BUCKET = "seau-essai";
process.env.FOURNISSEUR_STOCKAGE = "r2";
process.env.ZERNIO_API_KEY = "exemple-cle-fictive-ne-pas-utiliser-0013";

vi.mock("next/headers", () => mockHeaders);
vi.mock("next/navigation", () => mockNavigation);

const { reinitialiserDepots, depots } = await import("@/donnees/memoire");
const auth = await import("@/services/auth");
const pub = await import("@/services/publications");
const series = await import("@/services/series");

const VIDEO = "v-15";
const AUTRE = "v-03";
const SERIE = "Droit en 1 minute";
const DEMAIN = new Date(Date.now() + 26 * 3600_000).toISOString();
const CANAUX: CanalPublication[] = [
  { id: "exemple-li", organisationId: "zernio", nom: "Exemple LinkedIn", service: "linkedin", deconnecte: false },
  { id: "exemple-tt", organisationId: "zernio", nom: "Exemple TT", service: "tiktok", deconnecte: false },
];
const motsDieseDe = (texte: string) => texte.match(/#[\p{L}\p{N}_]+/gu) ?? [];
const cle = (m: string) => m.replace(/^#/, "").toLowerCase();

let demandes: DemandePublication[] = [];
function faux(): FournisseurPublication {
  return {
    id: "zernio", type: "publication", nom: "Faux", reelPrevu: "Zernio", mode: "reel", capacites: { asynchrone: false, accordExige: false },
    async envoyer(d) {
      demandes.push(d);
      return { idExterne: `exemple-post-${demandes.length}`, via: "zernio" as const, statut: "brouillon" as const };
    },
    async listerCanaux() {
      return CANAUX;
    },
  };
}

beforeAll(async () => {
  await preparerMotDePasse("essai-l0-13a-texte");
});
beforeEach(async () => {
  vi.stubGlobal("fetch", () => Promise.reject(new Error("fetch interdit")));
  reinitialiserDepots();
  await exemplesCommeVraies(depots(), { plusExemples: true });
  reinitialiserRequete();
  await auth.seConnecter("essai-l0-13a-texte", false);
  demandes = [];
  for (const c of ["image", "son", "sousTitres", "mentionIA", "droits"] as const) await pub.cocherAvantDePublier(VIDEO, c, true);
});

describe("L0-13a · texte reçu par Zernio (couverture reportée d'e2e-verif1-a2)", () => {
  it("en-tête de série en première ligne, mots-dièse du kit, aucun « fyp »", async () => {
    const serie = await series.creerSerie(SERIE);
    expect((await series.rattacherVideo(AUTRE, serie.id)).episode).toBe(1);
    expect((await series.rattacherVideo(VIDEO, serie.id)).episode).toBe(2);

    const kit = (await pub.obtenirKit(VIDEO))!;
    expect(kit.serie).toMatchObject({ nom: SERIE, episode: 2, entete: `${SERIE} · ép. 2` });
    await pub.envoyerReel("zernio", faux(), kit, ["linkedin"], DEMAIN, { linkedin: ["exemple-li"] }, {}, false);
    await pub.envoyerReel("zernio", faux(), kit, ["tiktok"], DEMAIN, {}, {}, false, { consentementTiktok: true, niveauConfidentialiteTiktok: "SELF_ONLY" });
    expect(demandes).toHaveLength(2);
    const [li, tk] = demandes;
    for (const d of demandes) {
      expect(d.texte.split("\n")[0]).toBe(`${SERIE} · ép. 2`);
      expect(motsDieseDe(d.texte).some((m) => /fyp|viral|pourtoi|foryou/i.test(m))).toBe(false);
    }
    // Les mots-dièse du kit (famille LinkedIn / TikTok, fixés à l'écriture du kit : vérifiés dans e2e-verif1-a2) arrivent tels quels chez Zernio.
    const duKit = (r: "linkedin" | "tiktok") => kit.reseaux.find((x) => x.reseau === r)!.motsDiese.map(cle).sort();
    expect(motsDieseDe(li.texte).map(cle).sort()).toEqual(duKit("linkedin"));
    expect(motsDieseDe(tk.texte).map(cle).sort()).toEqual(duKit("tiktok"));
    expect(motsDieseDe(tk.texte).length).toBeGreaterThanOrEqual(3);
  });
});
