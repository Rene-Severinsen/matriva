import { Container } from "@/components/ui/Container";
import { HouseMark } from "@/components/ui/Icons";
import { StoreBadge } from "@/components/ui/StoreBadge";

export function CtaSection() {
  return (
    <section className="cta-section" id="venteliste">
      <Container>
        <div className="cta-band">
          <div className="cta-band__mark">
            <HouseMark width="46" height="46" />
          </div>

          <div>
            <h2>Klar til at få styr på dit hjem?</h2>
            <p>Download Matriva i dag – eller skriv dig på ventelisten.</p>
          </div>

          <div className="cta-band__stores">
            <StoreBadge store="apple" />
            <StoreBadge store="google" />
          </div>
        </div>
      </Container>
    </section>
  );
}
