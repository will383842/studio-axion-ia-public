"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { rangerVideoAction } from "@/app/(studio)/ecrire/sujets/actions";
import { Champ } from "@/components/ui/Champ";
import { EtatVide } from "@/components/ui/EtatVide";
import { FeuilleBas } from "@/components/ui/FeuilleBas";
import { Icone } from "@/components/ui/Icone";
import { LogoReseau } from "@/components/ui/LogoReseau";
import { notifier } from "@/components/ui/Toast";
import { analyserRequeteCode } from "@/domaine/classement-generateur";
import type { ReseauDeclinaison } from "@/domaine/types";

interface VersionLibre {
  id: string;
  code: string;
  reseau: ReseauDeclinaison;
  sujet: string;
  numero?: number;
}

function versionCorrespond(v: VersionLibre, q: string): boolean {
  const t = q.trim();
  if (!t) return true;
  const r = analyserRequeteCode(t);
  if (r && "prefixeCode" in r) return v.code === r.prefixeCode || v.code.startsWith(`${r.prefixeCode}-`);
  if (r && "numero" in r) return v.numero === r.numero;
  return v.sujet.toLowerCase().includes(t.toLowerCase());
}

/** Liste « À ranger » et feuille de choix d'une version en un toucher (recherche « 42 », « 0042-AV-TT » ou un mot). */
export function ListeARanger({ videos, versions }: { videos: { id: string; titre: string; vignette: string | null; format: string }[]; versions: VersionLibre[] }) {
  const router = useRouter();
  const [choix, setChoix] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [enCours, demarrer] = useTransition();
  const video = videos.find((v) => v.id === choix);
  const proposees = versions.filter((v) => versionCorrespond(v, q));

  if (!videos.length) return <EtatVide icone="archive" titre="Tout est rangé" phrase="Chaque vidéo a son réseau et son code." />;

  return (
    <>
      <ul className="space-y-2">
        {videos.map((v) => (
          <li key={v.id}>
            <button type="button" onClick={() => setChoix(v.id)} className="flex min-h-20 w-full items-center gap-3 rounded-carte border border-trait bg-surface-1 p-3 text-left hover:border-trait-fort">
              <span className="relative aspect-[9/16] w-11 shrink-0 overflow-hidden rounded-lg border border-trait bg-surface-2">
                {v.vignette && <Image src={v.vignette} alt="" fill sizes="44px" className="object-cover" />}
              </span>
              <span className="min-w-0 flex-1">
                <span className="line-clamp-2 font-semibold leading-snug text-texte">{v.titre}</span>
                <span className="block text-xs text-texte-faible">{v.format}</span>
              </span>
              <span className="inline-flex min-h-11 items-center gap-1.5 rounded-full bg-orange-doux px-3 text-sm font-semibold text-orange-vif">
                <Icone nom="archive" size={15} />
                Ranger
              </span>
            </button>
          </li>
        ))}
      </ul>
      <FeuilleBas ouverte={!!choix} onOuverteChange={(o) => !o && setChoix(null)} titre="Ranger sous…" description={video?.titre}>
        <Champ libelle="Chercher" libelleMasque icone="loupe" placeholder="42, 0042-AV-TT, un mot…" value={q} onChange={(e) => setQ(e.target.value)} />
        <ul className="mt-3 space-y-2">
          {proposees.map((v) => (
            <li key={v.id}>
              <button
                type="button"
                disabled={enCours}
                onClick={() =>
                  demarrer(async () => {
                    const r = await rangerVideoAction(choix!, v.id);
                    if (!r.ok) {
                      notifier.erreur(r.message);
                      return;
                    }
                    notifier.succes(`Rangée sous ${v.code}`);
                    setChoix(null);
                    router.refresh();
                  })
                }
                className="flex min-h-14 w-full items-center gap-3 rounded-champ border border-trait bg-surface-2 px-3 text-left hover:border-orange"
              >
                <LogoReseau reseau={v.reseau} />
                <span className="min-w-0 flex-1">
                  <span className="block font-mono text-sm text-texte">{v.code}</span>
                  <span className="block truncate text-xs text-texte-faible">{v.sujet}</span>
                </span>
              </button>
            </li>
          ))}
          {!proposees.length && <li className="py-6 text-center text-sm text-texte-faible">Aucune version libre ne correspond.</li>}
        </ul>
      </FeuilleBas>
    </>
  );
}
