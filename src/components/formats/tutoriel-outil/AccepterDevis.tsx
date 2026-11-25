"use client";

/**
 * AUD-7 · « Accepter le devis » : les limites de la vidéo en phrases (aucun montant) et un seul bouton. L'empreinte du devis
 * montré part avec le clic : si le devis a changé entre-temps, l'action refuse.
 */
import { useRouter } from "next/navigation";
import { useState } from "react";
import { accepterDevisAction } from "@/app/(studio)/tutoriel-outil/actions-devis";
import { Bouton } from "@/components/ui/Bouton";

type Retour = { ok: true; donnees: { statut: "ok" | "refusee"; phrase: string } } | { ok: false; message: string };

export const surAcceptation = async (videoId: string, empreinte: string, accepter: (v: string, e: string) => Promise<Retour> = accepterDevisAction) => {
  const r = await accepter(videoId, empreinte);
  return r.ok ? { reussi: r.donnees.statut === "ok", phrase: r.donnees.phrase } : { reussi: false, phrase: r.message };
};

export function AccepterDevis({ videoId, phrases, empreinte }: { videoId: string; phrases: string[]; empreinte: string }) {
  const router = useRouter();
  const [occupe, setOccupe] = useState(false);
  const [message, setMessage] = useState<{ reussi: boolean; phrase: string } | null>(null);

  async function accepter() {
    setOccupe(true);
    try {
      const r = await surAcceptation(videoId, empreinte);
      setMessage(r);
      if (r.reussi) router.refresh();
    } catch {
      setMessage({ reussi: false, phrase: "Ça n'a pas pu se faire. Réessayez dans un instant." });
    } finally {
      setOccupe(false);
    }
  }

  return (
    <section className="space-y-3 rounded-carte border border-trait bg-surface-1 p-4">
      <h2 className="text-lg text-texte">Ce que la fabrication utilisera</h2>
      <ul className="space-y-1 text-[15px] text-texte">
        {phrases.map((p, i) => (
          <li key={i}>{p}</li>
        ))}
      </ul>
      <p className="text-sm text-texte-doux">Accepter vaut accord de ces limites, pas plus.</p>
      {message && (
        <p role="status" className={message.reussi ? "text-sm text-texte" : "rounded-carte bg-brique-doux px-4 py-3 text-[15px] font-semibold text-brique"}>
          {message.phrase}
        </p>
      )}
      <Bouton variante="principal" taille="lg" pleineLargeur disabled={occupe} onClick={() => void accepter()}>
        J&apos;accepte et je lance
      </Bouton>
    </section>
  );
}
