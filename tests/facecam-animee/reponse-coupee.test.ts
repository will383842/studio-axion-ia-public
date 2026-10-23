/**
 * FACE CAMÉRA ANIMÉE v4 — réponse du réalisateur COUPÉE par max_tokens (relevé du 17/10, v-0b4613576e9b : 3 essais payés
 * 0,46 € chacun, tous « Forme : (racine) — Invalid input: expected object, received null »). Rejoue la chaîne réelle :
 * flux SSE de l'API (pensée, JSON coupé, stop_reason max_tokens) → `envoyerMessage` → `lireSortie` → `reponseRealisateurDe`
 * → `realiser`. AUCUN appel réseau.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { envoyerMessage } from "@/fournisseurs/claude/client";
import { lireSortie } from "@/fournisseurs/claude/inscription";
import { construireRequete } from "@/generateur/roles/types";
import { MAX_JETONS_REALISATEUR_V4, roleRealisateurV4 } from "@/moteurs/montage-facecam-animee/realisateur/role-v4";
import { realiser, type EntreeRealisateur } from "@/moteurs/montage-facecam-animee/realisateur";
import { reponseRealisateurDe } from "@/services/facecam-animee";
import { MOTS } from "./plan-reference";

const ENTREE: EntreeRealisateur = {
  mots: MOTS,
  dureeSec: 22,
  prise: { src: "prise.mp4", finSec: 20 },
  fin: { debut: 20, marque: "Axion-IA", adresse: "axion-ia.com", motCle: "DIAGNOSTIC", tuiles: ["loupe"] },
};

function flux(texte: string, stop: string, sortie: number): typeof fetch {
  const ev = (type: string, data: unknown) => `event: ${type}\ndata: ${JSON.stringify(data)}\n\n`;
  const corps =
    ev("message_start", { message: { id: "m1", model: "claude-opus-5-5", usage: { input_tokens: 9000, output_tokens: 1 } } }) +
    ev("content_block_start", { content_block: { type: "text", text: "" } }) +
    ev("content_block_delta", { delta: { type: "text_delta", text: texte } }) +
    ev("message_delta", { delta: { stop_reason: stop }, usage: { output_tokens: sortie } }) +
    ev("message_stop", {});
  return (async () => new Response(corps, { status: 200 })) as unknown as typeof fetch;
}

const role = roleRealisateurV4();
async function appelerClaude(f: typeof fetch) {
  const reponse = await envoyerMessage(construireRequete(role, { contexte: {}, variable: "x" }), { cle: "cle-test", fetch: f });
  return { reponse, lu: lireSortie(role, reponse) };
}

afterEach(() => vi.restoreAllMocks());

describe("réponse du réalisateur coupée par max_tokens", () => {
  it("le plafond laisse la place à la pensée et le journal garde la raison d'arrêt, les jetons et le début du texte", async () => {
    expect(MAX_JETONS_REALISATEUR_V4).toBeGreaterThan(24_000);
    const avertir = vi.spyOn(console, "warn").mockImplementation(() => {});
    const { lu } = await appelerClaude(flux('{"cartes":[],"fenetres":[],"elementsV4":[{"type":"cou', "max_tokens", 24_000));
    expect(lu.donnees).toBeUndefined();
    expect(lu.invalide).toMatch(/COUPÉE.*max_tokens.*24000/);
    const ligne = String(avertir.mock.calls[0]![0]);
    expect(ligne).toContain("stopReason=max_tokens");
    expect(ligne).toContain("jetons sortie=24000");
    expect(ligne).toContain('{"cartes":[]');
  });

  it("texte qui n'est pas du JSON (fin normale) : motif distinct, raison d'arrêt dite", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const { lu } = await appelerClaude(flux("Voici mon plan, mais je ne peux pas.", "end_turn", 50));
    expect(lu.invalide).toMatch(/n'est pas du JSON.*end_turn/);
  });

  it("`reponseRealisateurDe` transmet le motif, et `realiser` le redit à Claude au lieu de « received null »", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const { lu, reponse } = await appelerClaude(flux('{"cartes":[', "max_tokens", 24_000));
    const messages: string[] = [];
    const r = await realiser(ENTREE, {
      appeler: async (req) => {
        messages.push(req.message);
        return reponseRealisateurDe({ ok: true, simule: false, donnees: lu.donnees, invalide: lu.invalide, texte: reponse.texte } as never);
      },
    });
    expect(messages).toHaveLength(3);
    expect(messages[1]).toContain("COUPÉE");
    expect(messages[1]).toContain("réfléchis BEAUCOUP moins");
    expect(messages[1]).not.toContain("received null");
    expect(r.version).toBe("simple");
    expect(r.erreurs!.join(" ")).toContain("COUPÉE");
  });
});
