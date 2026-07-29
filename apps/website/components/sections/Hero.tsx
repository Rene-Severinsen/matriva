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
            <p className="hero__eyebrow">Dit hjem. Samlet ét sted.</p>

            <h1 className="hero__title">
              Det hele.
              <br />
              Ét sted.
              <br />
              Dit hjem i overblik.
            </h1>

            <p className="hero__copy">
              Matriva samler dine dokumenter, vedligeholdelse og vigtige
              oplysninger om dit hus – så du sparer tid, undgår bekymringer og
              træffer de rigtige beslutninger.
            </p>

            <div className="hero__stores">
              <StoreBadge store="apple" />
              <StoreBadge store="google" />
            </div>

            <div className="hero__trust">
              <UsersIcon width="25" height="25" />
              <span>Udviklet til boligejere. Til hverdagen.</span>
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
