"use client";

/**
 * CHAT DE RETOUCHE (lot R1) — composant réutilisable, NON BRANCHÉ par défaut : chaque générateur le pose sur la fiche
 * d'une vidéo livrée. Zone de saisie, historique, aperçu de l'impact en mots simples, bouton « Appliquer », retour à la
 * version d'avant. Aucun prix. `envoyer` est injectable (tests, autre route) ; par défaut `/api/retouche-chat`.
 */
import { useState } from "react";
import { Bouton } from "@/components/ui/Bouton";
import type { PlanValide } from "@/briques/plan-scenes/schema";
import type { OperationRetouche } from "@/briques/operations";
import { ApercuFamille } from "./ApercuFamille";
import { CollerOperations } from "./CollerOperations";
import { PHRASE_RENDU_NON_BRANCHE } from "@/services/retouche-chat/service";

export type EnvoiRetouche = (corps: Record<string, unknown>) => Promise<Record<string, unknown>>;

const envoiParDefaut: EnvoiRetouche = async (corps) => {
  const r = await fetch("/api/retouche-chat", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(corps) });
  return (await r.json()) as Record<string, unknown>;
};

interface Apercu {
  demande: string;
  operations: unknown[];
  impact: { phrase: string; scenes: string[]; total?: number };
  remarques: string[];
  /** T-EXT-53c (tutoriel) : ce qui change dans le film, étape par étape (« Étape 3 : zoom normal → plus serré »). */
  changements?: { etape: number; avant: string; apres: string }[];
  reglagesFilm?: unknown;
}

interface Message {
  auteur: "vous" | "studio";
  texte: string;
}

export function ChatRetouche({ videoId, versionInitialeId, generateur, envoyer = envoiParDefaut, coller }: { videoId: string; versionInitialeId?: string; /** Lot R3 : générateur de la vidéo (adaptateur de retouche propre à lui). */ generateur?: string; envoyer?: EnvoiRetouche; /** R1-09 : absent = rendu inchangé ; présent = zone « coller des opérations ». */ coller?: { plan: PlanValide } }) {
  const [saisie, setSaisie] = useState("");
  const [historique, setHistorique] = useState<Message[]>([]);
  const [apercu, setApercu] = useState<Apercu | null>(null);
  const [versions, setVersions] = useState<string[]>(versionInitialeId ? [versionInitialeId] : []);
  const [occupe, setOccupe] = useState(false);
  // T-EXT-46b : plan retouché prêt à fabriquer (tutoriel seulement), puis fabrication lancée.
  const [aFabriquer, setAFabriquer] = useState<VersionAFabriquer | null>(null);
  const [fabricationLancee, setFabricationLancee] = useState(false);
  const dire = (m: Message) => setHistorique((h) => [...h, m]);

  async function demander() {
    const demande = saisie.trim();
    if (!demande || occupe) return;
    setOccupe(true);
    dire({ auteur: "vous", texte: demande });
    setSaisie("");
    try {
      const a = (await envoyer({ action: "apercu", videoId, demande, ...(generateur ? { generateur } : {}) })) as unknown as Apercu;
      setApercu(a.operations?.length || a.changements?.length ? a : null);
      dire({ auteur: "studio", texte: [a.impact?.phrase, ...(a.remarques ?? [])].filter(Boolean).join(" ") });
    } catch {
      dire({ auteur: "studio", texte: "Je n'ai pas pu lire votre demande. Réessayez dans un instant." });
    } finally {
      setOccupe(false);
    }
  }

  async function appliquer() {
    if (!apercu || occupe) return;
    setOccupe(true);
    try {
      const r = await envoyer({ action: "appliquer", videoId, demande: apercu.demande, operations: apercu.operations, ...(apercu.reglagesFilm ? { reglagesFilm: apercu.reglagesFilm } : {}), ...(generateur ? { generateur } : {}) });
      const afabriquer = versionAFabriquer(generateur, apercu.demande, r);
      const remarques = remarquesAffichees(Array.isArray(r.remarques) ? (r.remarques as string[]) : [], afabriquer !== null);
      if (r.statut === "rendue" && typeof r.versionId === "string") {
        setVersions((v) => [...v, r.versionId as string]);
        dire({ auteur: "studio", texte: ["C'est fait : nouvelle version.", ...remarques].join(" ") });
      } else dire({ auteur: "studio", texte: remarques.join(" ") || "Rien n'a changé." });
      setAFabriquer(afabriquer);
      setApercu(null);
    } catch {
      dire({ auteur: "studio", texte: "La retouche n'est pas partie. Réessayez dans un instant." });
    } finally {
      setOccupe(false);
    }
  }

  async function revenir() {
    const avant = versions.at(-2);
    if (!avant || occupe) return;
    setOccupe(true);
    try {
      await envoyer({ action: "revenir", videoId, versionId: avant, ...(generateur ? { generateur } : {}) });
      setVersions((v) => v.slice(0, -1));
      dire({ auteur: "studio", texte: "Version d'avant remise." });
    } finally {
      setOccupe(false);
    }
  }

  /** T-EXT-46b : envoie le plan prêt à la route (`fabriquer`). Un refus s'affiche tel quel ; aucun montant ici. */
  async function fabriquer() {
    if (!aFabriquer || occupe) return;
    setOccupe(true);
    try {
      const r = await envoyer({ action: "fabriquer", generateur: GENERATEUR_FABRICABLE, videoId, demande: aFabriquer.demande, plan: aFabriquer.plan, ...(aFabriquer.reglagesFilm !== undefined ? { reglagesFilm: aFabriquer.reglagesFilm } : {}) });
      if (r.statut === "lancee") {
        setFabricationLancee(true);
        setAFabriquer(null);
      } else dire({ auteur: "studio", texte: typeof r.erreur === "string" && r.erreur ? r.erreur : "La nouvelle version n'a pas pu partir. Réessayez dans un instant." });
    } catch {
      dire({ auteur: "studio", texte: "La nouvelle version n'a pas pu partir. Réessayez dans un instant." });
    } finally {
      setOccupe(false);
    }
  }

  return (
    <section aria-label="Retoucher la vidéo" className="flex flex-col gap-3">
      <ol aria-live="polite" className="flex flex-col gap-2">
        {historique.map((m, i) => (
          <li key={i} className={m.auteur === "vous" ? "self-end rounded-lg bg-surface-2 px-3 py-2 text-sm" : "self-start rounded-lg border border-trait px-3 py-2 text-sm"}>
            {m.texte}
          </li>
        ))}
      </ol>
      {apercu ? (
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-sm text-texte-doux">{apercu.impact.phrase}</p>
          {apercu.changements?.length ? (
            <div className="w-full">
              <ul aria-label="Ce qui change" className="list-disc pl-5 text-sm">
                {apercu.changements.map((c, i) => (
                  <li key={i}>
                    {c.etape > 0 ? `Étape ${c.etape}` : "Toute la vidéo"} : {c.avant} → {c.apres}
                  </li>
                ))}
              </ul>
              <p className="text-sm text-texte-doux">Rien n&apos;est appliqué tant que vous n&apos;avez pas cliqué « Appliquer ».</p>
            </div>
          ) : null}
          {generateur ? <ApercuFamille generateur={generateur} operations={apercu.operations as OperationRetouche[]} impact={{ scenes: apercu.impact.scenes ?? [], total: apercu.impact.total ?? 0 }} /> : null}
          <Bouton onClick={appliquer} chargement={occupe}>
            Appliquer
          </Bouton>
        </div>
      ) : null}
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          void demander();
        }}
      >
        <label className="sr-only" htmlFor={`retouche-${videoId}`}>
          Que voulez-vous changer ?
        </label>
        <input id={`retouche-${videoId}`} value={saisie} onChange={(e) => setSaisie(e.target.value)} placeholder="Que voulez-vous changer ?" className="min-h-11 flex-1 rounded-lg border border-trait bg-surface-1 px-3 text-sm" />
        <Bouton type="submit" variante="secondaire" disabled={!saisie.trim() || occupe}>
          Envoyer
        </Bouton>
      </form>
      {coller ? <CollerOperations videoId={videoId} plan={coller.plan} envoyer={envoyer} {...(generateur ? { generateur } : {})} /> : null}
      <ZoneFabriquer videoId={videoId} pret={aFabriquer !== null} lancee={fabricationLancee} occupe={occupe} onFabriquer={fabriquer} />
      {versions.length > 1 ? (
        <Bouton variante="fantome" onClick={revenir} disabled={occupe}>
          Revenir à la version d&apos;avant
        </Bouton>
      ) : null}
    </section>
  );
}

/** T-EXT-46b : seul le tutoriel sait fabriquer une version depuis ce chat (table fermée côté route). */
const GENERATEUR_FABRICABLE = "tutoriel-outil";

export interface VersionAFabriquer {
  demande: string;
  plan: unknown;
  /** Réglages du film demandés (non vides), à envoyer avec la fabrication. */
  reglagesFilm?: unknown;
}

/** T-EXT-46b : le plan à fabriquer, seulement pour une issue « plan-pret » du tutoriel qui porte son plan ; sinon `null`. */
export function versionAFabriquer(generateur: string | undefined, demande: string, reponse: Record<string, unknown>): VersionAFabriquer | null {
  if (generateur !== GENERATEUR_FABRICABLE || reponse.statut !== "plan-pret") return null;
  const plan = reponse.plan;
  if (!plan || typeof plan !== "object") return null;
  return reponse.reglagesFilm ? { demande, plan, reglagesFilm: reponse.reglagesFilm } : { demande, plan };
}

/** T-EXT-46b : quand le bouton de fabrication est là, la phrase « son rendu se branchera… » serait contradictoire : elle n'est pas affichée (aucune phrase nouvelle). */
export function remarquesAffichees(remarques: readonly string[], fabricable: boolean): string[] {
  return remarques.filter((m) => !(fabricable && m === PHRASE_RENDU_NON_BRANCHE));
}

/** T-EXT-46b : bouton « Fabriquer cette version », puis la phrase et le lien de suivi. Aucun montant. Rien si rien à fabriquer. */
export function ZoneFabriquer({ videoId, pret, lancee, occupe, onFabriquer }: { videoId: string; pret: boolean; lancee: boolean; occupe: boolean; onFabriquer: () => void }) {
  if (!pret && !lancee) return null;
  return (
    <div className="flex flex-wrap items-center gap-2">
      {lancee ? (
        <p role="status" className="text-sm">
          La nouvelle version se fabrique. Les versions d&apos;avant restent disponibles.{" "}
          <a href={`/tutoriel-outil/suivi/${encodeURIComponent(videoId)}`} className="font-semibold underline underline-offset-4">
            Suivre la fabrication
          </a>
        </p>
      ) : null}
      {pret ? (
        <Bouton onClick={onFabriquer} chargement={occupe}>
          Fabriquer cette version
        </Bouton>
      ) : null}
    </div>
  );
}
