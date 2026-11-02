import type { Metadata } from "next";
import { EcranATraiter } from "@/components/a-traiter/EcranATraiter";
import { EnTetePage } from "@/components/ui/EnTetePage";
import { exigerSession } from "@/services/auth";
import { gesteCarteFaite, gesteCarteIgnorer, gesteCarteStop, gesteLireATraiter } from "@/services/a-traiter-gestes";

export const metadata: Metadata = { title: "À traiter" };
export const dynamic = "force-dynamic";

/** À TRAITER À LA MAIN : un commentaire à la fois. Éteint par défaut (A_TRAITER_ENABLED) : la page l'écrit simplement. */
export default async function PageATraiter() {
  await exigerSession();
  const vue = await gesteLireATraiter();
  async function fait(id: string) {
    "use server";
    return gesteCarteFaite(id);
  }
  async function ignorer(id: string) {
    "use server";
    return gesteCarteIgnorer(id);
  }
  async function stop(id: string, compte: string) {
    "use server";
    return gesteCarteStop(id, compte);
  }
  return (
    <div>
      <EnTetePage titre="À traiter à la main" />
      <EcranATraiter vue={vue} services={{ fait, ignorer, stop }} compte="" />
    </div>
  );
}
