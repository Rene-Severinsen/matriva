import { Container } from "@/components/ui/Container";
import { HouseMark } from "@/components/ui/Icons";

export function Footer() {
  return (
    <footer className="footer" id="om-matriva">
      <Container>
        <div className="footer__grid">
          <div className="footer__about">
            <a href="#" className="brand">
              <span className="brand__mark">
                <HouseMark width="34" height="34" />
              </span>
              <span>Matriva</span>
            </a>

            <p className="footer__copy">
              Matriva hjælper boligejere med at samle dokumenter, planlægge
              vedligeholdelse og få det fulde overblik over deres hjem.
            </p>

            <div className="footer__socials" aria-label="Sociale medier">
              <a href="#" aria-label="Facebook">
                f
              </a>
              <a href="#" aria-label="Instagram">
                ◎
              </a>
              <a href="#" aria-label="LinkedIn">
                in
              </a>
            </div>
          </div>

          <div className="footer__column">
            <h3>Links</h3>
            <a href="#funktioner">Funktioner</a>
            <a href="#priser">Priser</a>
            <a href="#om-matriva">Om Matriva</a>
            <a href="#hjaelp">Hjælp</a>
          </div>

          <div className="footer__column">
            <h3>Juridisk</h3>
            <a href="#">Privatlivspolitik</a>
            <a href="#">Cookies</a>
            <a href="#">Vilkår og betingelser</a>
          </div>

          <div className="footer__column" id="hjaelp">
            <h3>Kontakt</h3>
            <a href="mailto:hej@matriva.dk">hej@matriva.dk</a>
            <span>CVR: 12345678</span>
          </div>
        </div>

        <div className="footer__bottom">
          © 2026 Matriva ApS. Alle rettigheder forbeholdes.
        </div>
      </Container>
    </footer>
  );
}
