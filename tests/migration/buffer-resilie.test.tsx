/**
 * Buffer est résilié : l'écran Migration n'annonce plus de résiliation à faire (ni date limite, ni compte à rebours),
 * et le mode d'envoi affiché dit « brouillon » tant que l'envoi part chez Zernio. Données fictives, aucun réseau.
 */
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { EcranMigration } from "@/components/migration/EcranMigration";
import { EtatBuffer } from "@/components/migration/Heros";
import { jalonsPour } from "@/components/migration/Frise";
import type { PostMigration } from "@/components/migration/logique";
import { mockHeaders, mockNavigation, reinitialiserRequete } from "../helpers/next-mocks";

vi.mock("next/link", () => ({ default: ({ href, children, ...r }: { href: string; children: React.ReactNode }) => <a href={href} {...r}>{children}</a> }));
vi.mock("next/headers", () => mockHeaders);
vi.mock("next/navigation", () => mockNavigation);
vi.mock("next/cache", () => ({ revalidatePath: () => undefined, revalidateTag: () => undefined }));

const MAINT = new Date("2026-11-10T09:00:00Z");
const post = (id: string, etat: PostMigration["etat"], datePrevue = "2026-11-15T10:00:00Z"): PostMigration => ({ id, reseau: "linkedin", titre: `Exemple ${id}`, datePrevue, etat });
const POSTS = [post("a", "laisse-buffer"), post("b", "verifie-zernio"), post("c", "a-verifier"), post("d", "restant", "2026-11-25T10:00:00Z")];
const texte = (h: string) => h.replace(/<[^>]+>/g, " ");

describe("Buffer résilié · écran Migration", () => {
  it("la carte dit la vérité, sans date ni compte à rebours", () => {
    const t = texte(renderToStaticMarkup(<EtatBuffer />));
    expect(t).toContain("Buffer est résilié.");
    expect(t).toContain("Toutes les publications passent par Zernio.");
    expect(t).not.toMatch(/jours?\b|Date limite|18\/11|20\/11|mercredi|vendredi/);
  });
  it("aucun état de l'écran n'annonce une résiliation à faire", () => {
    const vues = [
      renderToStaticMarkup(<EcranMigration vue={{ etat: "normal", donnees: { posts: POSTS, comptes: [] } }} maintenant={MAINT} />),
      renderToStaticMarkup(<EcranMigration vue={{ etat: "vide" }} maintenant={MAINT} />),
    ];
    for (const h of vues) {
      const t = texte(h);
      expect(t).not.toMatch(/Date limite|Critères pour résilier|Résiliation de Buffer|Prélèvement évité|sans votre ordre/);
      expect(t).toContain("Buffer est résilié");
    }
  });
  it("la frise ne garde aucun jalon de résiliation", () => {
    expect(jalonsPour(MAINT).map((j) => j.titre).join(" ")).not.toMatch(/Résiliation|Prélèvement/);
  });
});

describe("Buffer résilié · écran Migration sans date ni « avant la bascule »", () => {
  it("les plages de lots sont neutres et les intitulés inchangés", async () => {
    const { resumerLots } = await import("@/components/migration/logique");
    const lots = resumerLots(POSTS);
    expect(lots.map((l) => l.intitule)).toEqual(["Lot A · Instagram et Facebook", "Lot B · LinkedIn", "Lot C · tous réseaux"]);
    for (const l of lots) expect(l.plage).not.toMatch(/\d{1,2}\/\d{1,2}|novembre/);
    expect(lots[0].plage).toBe("posts déjà prévus");
    expect(lots[2].plage).toBe("posts à venir");
  });
  it("aucune date ni « avant la bascule » dans l'écran, comptages inchangés", () => {
    const t = texte(renderToStaticMarkup(<EcranMigration vue={{ etat: "normal", donnees: { posts: POSTS, comptes: [] } }} maintenant={MAINT} />));
    expect(t).not.toMatch(/20\/11|18 novembre|20 novembre|avant la bascule/);
    expect(t).toContain("laissé à Buffer (non repris, Buffer résilié)".replace("laissé", "laissés"));
    expect(t).toMatch(/1 restants/);
    expect(t).toMatch(/1 \+ 1 \+ 1 \+ 1 = 4 posts/);
  });
});

describe("Buffer résilié · mode d'envoi affiché", () => {
  beforeEach(async () => {
    const { hash } = await import("@node-rs/argon2");
    process.env.SESSION_SECRET = "s".repeat(48);
    process.env.STUDIO_PASSWORD_HASH_B64 = Buffer.from(await hash("essai-buffer-resilie", { algorithm: 2, memoryCost: 19456, timeCost: 2, parallelism: 1 })).toString("base64");
    const { reinitialiserDepots } = await import("@/donnees/memoire");
    reinitialiserDepots();
    reinitialiserRequete();
  });
  it("« programmer » en base + routage par défaut (Zernio) : on affiche « brouillon »", async () => {
    const { ecrireParametre } = await import("@/services/_commun");
    const { lireModeAffiche, lireModeBuffer } = await import("@/services/buffer");
    await ecrireParametre("buffer.mode", "programmer");
    expect(await lireModeBuffer()).toBe("programmer");
    expect(await lireModeAffiche()).toBe("brouillon");
  });
  it("« programmer » en base et un réseau routé vers Buffer : le réglage est dit tel quel", async () => {
    const { ecrireParametre } = await import("@/services/_commun");
    const { lireModeAffiche } = await import("@/services/buffer");
    await ecrireParametre("buffer.mode", "programmer");
    await ecrireParametre("publication.routage", { instagram: "buffer" });
    expect(await lireModeAffiche()).toBe("programmer");
  });
});
