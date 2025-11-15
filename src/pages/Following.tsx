import { AmbientBackground } from "@/components/AmbientBackground";
import { Button } from "@/components/ui/button";

const Following = () => {
  return (
    <div className="relative min-h-screen overflow-hidden bg-theme-canvas text-theme-primary">
      <AmbientBackground />
      <div className="relative z-10 mx-auto flex min-h-screen w-full max-w-5xl flex-col gap-10 px-4 py-12 sm:px-6 lg:px-8">
        <header className="space-y-2">
          <p className="text-xs uppercase tracking-[0.35em] text-purple-200/80">Följer</p>
          <h1 className="text-3xl font-semibold tracking-tight text-theme-primary sm:text-4xl">Bygg din vincrew</h1>
          <p className="max-w-2xl text-sm text-theme-secondary sm:text-base">
            Snart kan du följa sommelierer, vänner och våra AI-kuratorer. Du får pushnotiser när någon delar ett nytt vintips.
          </p>
        </header>

        <section className="rounded-3xl border border-theme-card bg-theme-elevated/70 p-6 backdrop-blur-sm sm:p-10">
          <h2 className="text-xl font-semibold text-theme-primary sm:text-2xl">Social funktionalitet på gång</h2>
          <p className="mt-3 text-sm text-theme-secondary sm:text-base">
            Vi kopplar ihop Supabase-profiler med WineSnap-historiken så att du kan dela analyser, kommentera och spara listor
            tillsammans.
          </p>

          <Button className="mt-6 w-full rounded-full bg-gradient-to-r from-[#7B3FE4] via-[#8451ED] to-[#B095FF] text-theme-primary sm:w-auto">
            Bli först att testa
          </Button>
        </section>
      </div>
    </div>
  );
};

export default Following;
