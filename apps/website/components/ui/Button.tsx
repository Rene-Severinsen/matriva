import Link from "next/link";
import type { ButtonHTMLAttributes, ComponentProps, ReactNode } from "react";

type SharedProps = {
  children: ReactNode;
  className?: string;
  variant?: "primary" | "secondary";
};

type LinkButtonProps = SharedProps &
  Omit<ComponentProps<typeof Link>, "children" | "className"> & {
    href: ComponentProps<typeof Link>["href"];
  };

type NativeButtonProps = SharedProps &
  Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children" | "className"> & {
    href?: never;
  };

type ButtonProps = LinkButtonProps | NativeButtonProps;

function isLinkButton(props: ButtonProps): props is LinkButtonProps {
  return props.href !== undefined;
}

function getClasses(
  variant: SharedProps["variant"] = "primary",
  className = "",
): string {
  return `button button--${variant} ${className}`.trim();
}

export function Button(props: ButtonProps) {
  if (isLinkButton(props)) {
    const { children, className, variant = "primary", ...linkProps } = props;

    return (
      <Link className={getClasses(variant, className)} {...linkProps}>
        {children}
      </Link>
    );
  }

  const {
    children,
    className,
    variant = "primary",
    type = "button",
    ...buttonProps
  } = props;

  return (
    <button
      type={type}
      className={getClasses(variant, className)}
      {...buttonProps}
    >
      {children}
    </button>
  );
}
