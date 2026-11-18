/**
 * V4-2 · mission E : une fin par réseau (décision de Will du 14/10, « c'est la fin qu'il fallait faire attention »).
 * Une fabrication pour les quatre réseaux produit une sortie par groupe de réseaux de même fin, chacune avec la fin de
 * la banque pour CE réseau ; chaque sortie passe SÉPARÉMENT le contrôle de la fin de la voix ; un lien suivi par réseau.
 * Doubles seulement, aucun appel réel (voix simulée : les sons sont fabriqués ici).
 *
 * Écart avec les références v10 (`docs/formats/v4-reference/PUBLIER.md`), DIT et non corrigé : la banque validée
 * (`src/briques/fins/banque.ts`, à ne pas modifier) a remplacé le 12/10 « Le lien vous attend en premier commentaire » et
 * « Le lien est dans la bio » par « Le lien est en commentaire. » (Facebook), « Le lien est en premier commentaire. »
 * (LinkedIn) et « Le lien est dans mon profil. » (Instagram, TikTok). Facebook et LinkedIn ne disent donc pas
 * exactement la même phrase : trois sorties et non deux, tant que Will n'a pas tranché.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { suiteDeFins } from "@/briques/fins";
import { TABLE_FINS_DIAGNOSTIC } from "@/briques/fins/table-diagnostic";
import { FINS_DIAGNOSTIC, type ReseauCas } from "@/formats/cas-concret";
import { fabriquerCasConcret } from "@/moteurs/montage-cas-concret/fabriquer";
import { ecransDeFin } from "@/moteurs/montage-cas-concret/fins";
import { doubles } from "../fabriquer/doubles";

/** WAV PCM 16 bits mono. */
function wav(x: Float32Array, frequence: number): Uint8Array {
  const b = Buffer.alloc(44 + x.length * 2);
  b.write("RIFF", 0);
  b.writeUInt32LE(36 + x.length * 2, 4);
  b.write("WAVEfmt ", 8);
  b.writeUInt32LE(16, 16);
  b.writeUInt16LE(1, 20);
  b.writeUInt16LE(1, 22);
  b.writeUInt32LE(frequence, 24);
  b.writeUInt32LE(frequence * 2, 28);
  b.writeUInt16LE(2, 32);
  b.writeUInt16LE(16, 34);
  b.write("data", 36);
  b.writeUInt32LE(x.length * 2, 40);
  x.forEach((v, i) => b.writeInt16LE(Math.round(Math.max(-1, Math.min(1, v)) * 32767), 44 + i * 2));
  return new Uint8Array(b);
}
/** Voix dite jusqu'au bout : 150 s qui s'éteignent doucement (0,3 s), puis 1 s de silence. */
function voixEntiere(): Uint8Array {
  const f = 8000;
  const x = new Float32Array(151 * f);
  for (let i = 0; i < 150 * f; i++) x[i] = 0.3 * Math.min(1, (150 - i / f) / 0.3) * Math.sin((2 * Math.PI * 200 * i) / f);
  return wav(x, f);
}
const COUPEE = new Uint8Array(readFileSync(join(__dirname, "sons/v4-fin-coupee.wav")));
const derniereFin = (texte: string) => texte.trim().split(/(?<=[.!?])\s+/).at(-1);
/** La fin « diagnostic + lien » d'un réseau, tirée de la banque (la fin elle-même, sans passer par le plan). */
function finDiagnostic(r: ReseauCas, cas: { mot: string; motDit?: string }): string {
  const appels = suiteDeFins(r, [...FINS_DIAGNOSTIC[r]], { mot: cas.mot, ...(cas.motDit ? { motDit: cas.motDit } : {}) }, TABLE_FINS_DIAGNOSTIC);
  return ecransDeFin(appels, cas.mot).map((e) => e.texteDit).join(" ");
}

describe("V4-2 · une sortie par groupe de réseaux, chacune avec SA fin", () => {
  it("4 réseaux → Facebook « en commentaire », LinkedIn « en premier commentaire », Instagram et TikTok ensemble « dans mon profil »", async () => {
    const d = doubles();
    // 17/11 (Williams) : sans choix, aucune fin ; ce test teste la fin elle-même.
    const parReseau = Object.fromEntries((["facebook", "instagram", "tiktok", "linkedin"] as const).map((r) => [r, finDiagnostic(r, d.options.cas)]));
    const parReseaux: Record<string, string> = { facebook: parReseau.facebook, "instagram+tiktok": parReseau.instagram, linkedin: parReseau.linkedin };
    expect(parReseau.instagram).toBe(parReseau.tiktok);
    expect(Object.keys(parReseaux).sort()).toEqual(["facebook", "instagram+tiktok", "linkedin"]);
    expect(derniereFin(parReseaux.facebook)).toBe("Le lien est en commentaire.");
    expect(derniereFin(parReseaux.linkedin)).toBe("Le lien est en premier commentaire.");
    expect(derniereFin(parReseaux["instagram+tiktok"])).toBe("Le lien est dans mon profil.");
    // Le lien d'Instagram et de TikTok n'est jamais annoncé en commentaire (non cliquable là-bas), et inversement.
    expect(parReseaux["instagram+tiktok"]).not.toMatch(/commentaire/);
    for (const r of ["facebook", "linkedin"]) expect(parReseaux[r]).not.toMatch(/profil|bio/);
    // 17/11 (Williams) : sans choix, aucune fin. La fabrication (le mot coché et branché sur Facebook et Instagram) garde une
    // sortie par groupe de réseaux de même fin, chacune avec SA fin ; TikTok et LinkedIn, sans mot branché, n'ont aucune fin.
    const f = doubles({ avecMot: true, motSur: ["facebook", "instagram"] });
    const cr = await fabriquerCasConcret(f.options);
    const fins = Object.fromEntries(cr.plan.fins.map((x) => [x.reseaux.join("+"), x.ecrans.map((e) => e.texteDit).join(" ")]));
    expect(Object.keys(fins).sort()).toEqual(["facebook", "instagram", "tiktok+linkedin"]);
    expect(derniereFin(fins.facebook)).toBe("Je vous envoie la structure complète.");
    expect(fins.instagram).toBe("Abonnez-vous et écrivez I.A. en commentaire : je vous l'envoie.");
    expect(fins["tiktok+linkedin"]).toBe("");
    // Une composition complète par sortie, et le texte de chaque sortie finit par SA fin.
    expect(cr.fins.map((x) => x.reseaux.join("+")).sort()).toEqual(["facebook", "instagram", "tiktok+linkedin"]);
    // Le texte dit de chaque composition, lu dans ses sous-titres (mot par mot).
    type Segments = { texte: { sousTitres: { segments: { mots: { mot: string }[] }[] } } };
    const dits = f.compositionsSoumises().map((c) => (c.parametres as Segments).texte.sousTitres.segments.flatMap((s) => s.mots.map((m) => m.mot)).join(" "));
    expect(dits).toHaveLength(3);
    expect(dits.filter((t) => t.endsWith("Je vous envoie la structure complète."))).toHaveLength(1);
    expect(dits.filter((t) => t.endsWith("je vous l'envoie."))).toHaveLength(1);
  });

  it("un réseau seul n'a que sa fin (Instagram : le profil)", async () => {
    const d = doubles({ reseaux: ["instagram"] });
    const cr = await fabriquerCasConcret(d.options);
    expect(cr.fins).toHaveLength(1);
    // 17/11 (Williams) : sans choix, aucune fin ; ce test teste la fin elle-même.
    expect(derniereFin(finDiagnostic("instagram", d.options.cas))).toBe("Le lien est dans mon profil.");
  });

  it("liens suivis : un par réseau, `utm_source` du réseau, `utm_medium=video`, une campagne par réseau (code de version, ADR 0002)", async () => {
    const d = doubles();
    const cr = await fabriquerCasConcret(d.options);
    expect(Object.keys(cr.liens).sort()).toEqual(["facebook", "instagram", "linkedin", "tiktok"]);
    const campagnes = new Set<string>();
    for (const [r, lien] of Object.entries(cr.liens)) {
      const u = new URL(lien);
      expect(u.searchParams.get("utm_source")).toBe(r);
      expect(u.searchParams.get("utm_medium")).toBe("video");
      campagnes.add(u.searchParams.get("utm_campaign")!);
      // ADR 0002 : `utm_campaign` = code de version du réseau (« <numéro>-CC-<réseau> »), pas une campagne commune.
      expect(u.searchParams.get("utm_campaign")).toMatch(/^\d{4}-CC-[A-Z]{2}$/);
    }
    // Une campagne par réseau, toutes du même numéro de version.
    expect(campagnes.size).toBe(4);
    expect(new Set([...campagnes].map((c) => c.split("-")[0])).size).toBe(1);
  });

  it("`utm_content` = l'activité du PUBLIC VISÉ du cas (sa cible), non l'identifiant du cas", async () => {
    const d = doubles();
    // « recrutement-apporteurs » parle à un dirigeant (client) : son identifiant contient « apporteur », pas son public.
    expect(d.options.cas.id).toContain("apporteur");
    const cr = await fabriquerCasConcret(d.options);
    for (const lien of Object.values(cr.liens)) expect(new URL(lien).searchParams.get("utm_content")).toBe("clients");

    const formateurs = doubles();
    formateurs.options.cas = { ...formateurs.options.cas, cible: "Un formateur indépendant qui prépare ses sessions le soir." };
    const crF = await fabriquerCasConcret(formateurs.options);
    for (const lien of Object.values(crF.liens)) expect(new URL(lien).searchParams.get("utm_content")).toBe("formateurs");
  });
});

describe("V4-2 · le contrôle de la fin de la voix, sortie par sortie", () => {
  it("toutes les sorties dites jusqu'au bout : la fabrication passe", async () => {
    // 17/11 (Williams) : sans choix, aucune fin ; le mot coché et branché sur Facebook et Instagram rétablit trois sorties.
    const d = doubles({ avecMot: true, motSur: ["facebook", "instagram"] });
    const entiere = voixEntiere();
    d.options.outils.voix.lireSon = async (cle) => (d.assemblages.some((a) => a.sortieCle === cle) ? entiere : null);
    const cr = await fabriquerCasConcret(d.options);
    expect(cr.fins).toHaveLength(3);
  });

  it("LOT A : la voix coupée sur la SEULE sortie LinkedIn : cette sortie est nommée « à vérifier », la vidéo est faite", async () => {
    // 17/11 (Williams) : sans choix, aucune fin ; LinkedIn n'a plus de fin à contrôler (le mot n'y est pas branchable). La
    // voix coupée est celle de la SEULE sortie Instagram (mot branché), les autres sorties sont dites jusqu'au bout.
    const d = doubles({ avecMot: true, motSur: ["facebook", "instagram"] });
    const entiere = voixEntiere();
    // Les assemblages de la recette suivent l'ordre du plan : Facebook, Instagram, TikTok + LinkedIn (les copies WAV des
    // sons bruts, faites avant pour mesurer leurs blancs, ne comptent pas).
    d.options.outils.voix.lireSon = async (cle) => {
      const i = d.assemblages.filter((a) => a.recette).findIndex((a) => a.sortieCle === cle);
      return i < 0 ? null : i === 1 ? COUPEE : entiere;
    };
    const r = await fabriquerCasConcret(d.options);
    expect(r.reservesVoix).toHaveLength(1);
    expect(r.reservesVoix[0]).toMatch(/^Voix de la fin pour Instagram · .*coupée net/);
    expect(r.reservesVoix[0]).not.toMatch(/Facebook|LinkedIn|TikTok/);
    expect(d.ecransSoumis().length).toBeGreaterThan(0);
  });
});
