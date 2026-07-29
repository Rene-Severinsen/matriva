"use client";

import { useState } from "react";

import { Button } from "@/components/ui/Button";
import { Container } from "@/components/ui/Container";
import { HouseMark } from "@/components/ui/Icons";

const links = [
  ["Funktioner", "#funktioner"],
  ["Priser", "#priser"],
  ["Om Matriva", "#om-matriva"],
  ["Hjælp", "#hjaelp"],
];

export function Header() {
  const [open, setOpen] = useState(false);

  return (
    <header className="header">
      <Container className="header__inner">
        <a href="#" className="brand" aria-label="Matriva forside">
          <span className="brand__mark">
            <HouseMark width="36" height="36" />
          </span>
          <span>Matriva</span>
        </a>

        <nav className="header__nav" aria-label="Primær navigation">
          {links.map(([label, href]) => (
            <a key={href} href={href}>
              {label}
            </a>
          ))}
        </nav>

        <div className="header__actions">
          <Button href="#venteliste">Download app</Button>

          <button
            className="header__menu-button"
            type="button"
            aria-label="Åbn menu"
            aria-expanded={open}
            onClick={() => setOpen((value) => !value)}
          >
            <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true">
              <path
                d={open ? "M6 6l12 12M18 6 6 18" : "M4 7h16M4 12h16M4 17h16"}
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              />
            </svg>
          </button>
        </div>

        <nav
          className="mobile-menu"
          data-open={open}
          aria-label="Mobilnavigation"
        >
          {links.map(([label, href]) => (
            <a key={href} href={href} onClick={() => setOpen(false)}>
              {label}
            </a>
          ))}
          <Button href="#venteliste" onClick={() => setOpen(false)}>
            Download app
          </Button>
        </nav>
      </Container>
    </header>
  );
}
