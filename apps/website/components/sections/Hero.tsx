import { Container } from "@/components/ui/Container";
import { PhoneMockup } from "@/components/ui/PhoneMockup";
import { StoreBadge } from "@/components/ui/StoreBadge";
import { UsersIcon } from "@/components/ui/Icons";

export function Hero() {
  return (
    <section className="hero">
      <Container>
        <div className="hero__grid">
          <div className="hero__content">
            <p className="hero__eyebrow">Dit hus. Samlet ét sted.</p>

            <h1 className="hero__title">
              Få styr på dit hus.
              <br />
              Uden at holde styr på det hele selv.
            </h1>

            <p className="hero__copy">
              Matriva samler boligens oplysninger, dokumenter og
              vedligeholdelse, så du ved, hvad der er gjort, hvad der mangler,
              og hvad der bør ske næste gang.
            </p>

            <div className="hero__stores">
              <StoreBadge store="apple" />
              <StoreBadge store="google" />
            </div>
            <p className="hero__release-note">
              Matriva udvikles til iPhone og Android.
            </p>

            <div className="hero__trust">
              <UsersIcon width="25" height="25" />
              <span>Bygget til husejere – til den løbende drift af huset.</span>
            </div>
          </div>

          <div className="hero__visual">
            <div className="hero__house" />
            <PhoneMockup />
          </div>
        </div>
      </Container>
    </section>
  );
}
