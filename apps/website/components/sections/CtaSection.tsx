import { Container } from "@/components/ui/Container";
import { Button } from "@/components/ui/Button";
import { HouseMark } from "@/components/ui/Icons";

export function CtaSection() {
  return (
    <section className="cta-section" id="status">
      <Container>
        <div className="cta-band">
          <div className="cta-band__mark">
            <HouseMark width="46" height="46" />
          </div>

          <div>
            <h2>Matriva er under udvikling</h2>
            <p>
              Vi bygger Matriva til danske husejere, der vil have ét samlet
              overblik over bolig, dokumenter og vedligeholdelse.
            </p>
          </div>

          <Button href="#funktioner">Se funktionerne</Button>
        </div>
      </Container>
    </section>
  );
}
