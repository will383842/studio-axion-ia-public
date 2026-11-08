"use client";

/**
 * CHAT DE RETOUCHE (lot R1) — composant réutilisable, NON BRANCHÉ par défaut : chaque générateur le pose sur la fiche
 * d'une vidéo livrée. Zone de saisie, historique, aperçu de l'impact en mots simples, bouton « Appliquer », retour à la
 * version d'avant. Aucun prix. `envoyer` est injectable (tests, autre route) ; par défaut `/api/retouche-chat`.
 */
import { useState } from "react";
import { Bouton } from "@/components/ui/Bouton";

export type EnvoiRetouche = (corps: Record<string, unknown>) => Promise<Record<string, unknown>>;

const envoiParDefaut: EnvoiRetouche = async (corps) => {
  const r = await fetch("/api/retouche-chat", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(corps) });
  return (await r.json()) as Record<string, unknown>;
};

interface Apercu {
  demande: string;
  operations: unknown[];
  impact: { phrase: string; scenes: string[] };
  remarques: string[];
}

interface Message {
  auteur: "vous" | "studio";
  texte: string;
}

export function ChatRetouche({ videoId, versionInitialeId, envoyer = envoiParDefaut }: { videoId: string; versionInitialeId?: string; envoyer?: EnvoiRetouche }) {
  const [saisie, setSaisie] = useState("");
  const [historique, setHistorique] = useState<Message[]>([]);
  const [apercu, setApercu] = useState<Apercu | null>(null);
  const [versions, setVersions] = useState<string[]>(versionInitialeId ? [versionInitialeId] : []);
  const [occupe, setOccupe] = useState(false);
  const dire = (m: Message) => setHistorique((h) => [...h, m]);

  async function demander() {
    const demande = saisie.trim();
    if (!demande || occupe) return;
    setOccupe(true);
    dire({ auteur: "vous", texte: demande });
    setSaisie("");
    try {
      const a = (await envoyer({ action: "apercu", videoId, demande })) as unknown as Apercu;
      setApercu(a.operations?.length ? a : null);
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
      const r = await envoyer({ action: "appliquer", videoId, demande: apercu.demande, operations: apercu.operations });
      const remarques = Array.isArray(r.remarques) ? (r.remarques as string[]) : [];
      if (r.statut === "rendue" && typeof r.versionId === "string") {
        setVersions((v) => [...v, r.versionId as string]);
        dire({ auteur: "studio", texte: ["C'est fait : nouvelle version.", ...remarques].join(" ") });
      } else dire({ auteur: "studio", texte: remarques.join(" ") || "Rien n'a changé." });
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
      await envoyer({ action: "revenir", videoId, versionId: avant });
      setVersions((v) => v.slice(0, -1));
      dire({ auteur: "studio", texte: "Version d'avant remise." });
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
      {versions.length > 1 ? (
        <Bouton variante="fantome" onClick={revenir} disabled={occupe}>
          Revenir à la version d&apos;avant
        </Bouton>
      ) : null}
    </section>
  );
}
