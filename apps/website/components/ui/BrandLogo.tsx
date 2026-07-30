import Image from "next/image";

type BrandLogoProps = {
  priority?: boolean;
};

export function BrandLogo({ priority = false }: BrandLogoProps) {
  return (
    <span className="brand-logo">
      <Image
        className="brand-logo__image"
        src="/brand/matriva-logo.png"
        alt="Matriva"
        width={2079}
        height={756}
        priority={priority}
      />
    </span>
  );
}
