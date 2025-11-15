import { AmbientBackground } from "@/components/AmbientBackground";

const Explore = () => {
  return (
    <div className="relative min-h-screen overflow-hidden bg-theme-canvas text-theme-primary">
      <AmbientBackground />
      <div className="relative z-10 mx-auto flex min-h-screen w-full max-w-5xl flex-col gap-12 px-4 py-12 sm:px-6 lg:px-8">
        <header className="space-y-2">
          <p className="text-xs uppercase tracking-[0.35em] text-purple-200/80">Utforska</p>
          <h1 className="text-3xl font-semibold tracking-tight text-theme-primary sm:text-4xl">Upptäck nya favoriter</h1>
          <p className="max-w-2xl text-sm text-theme-secondary sm:text-base">
            Vi bygger en kuraterad feed med trendande flaskor, druvor och guider. Under tiden kan du fortsätta skanna etiketter och
            spara dina fynd.
          </p>
        </header>

        <section className="rounded-3xl border border-theme-card bg-theme-elevated/70 p-6 backdrop-blur-sm sm:p-10">
          <h2 className="text-xl font-semibold text-theme-primary sm:text-2xl">Personliga rekommendationer</h2>
          <p className="mt-3 text-sm text-theme-secondary sm:text-base">
            Här kommer du snart att se vinsläpp från Systembolaget, tips från sommelierer och data från din historik. Vi arbetar på
            att koppla samman Supabase med en social graf för att göra rekommendationerna smartare för varje skanning.
          </p>
        </section>

        <section className="grid gap-6 sm:grid-cols-2">
          {["Druvskolan", "Regionguider"].map(title => (
            <div key={title} className="rounded-3xl border border-theme-card bg-theme-elevated/70 p-6 backdrop-blur-sm">
              <h3 className="text-lg font-semibold text-theme-primary">{title}</h3>
              <p className="mt-2 text-sm text-theme-secondary">
                Snart hittar du djupdykande artiklar som hjälper dig att förstå ursprung, klimat och smakprofiler.
              </p>
            </div>
          ))}
        </section>
      </div>
    </div>
  );
};

export default Explore;
