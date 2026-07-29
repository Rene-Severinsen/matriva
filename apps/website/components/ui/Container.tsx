import type { HTMLAttributes, ReactNode } from "react";

type ContainerProps = HTMLAttributes<HTMLDivElement> & {
  children: ReactNode;
};

export function Container({
  children,
  className = "",
  ...props
}: ContainerProps) {
  return (
    <div className={`site-container ${className}`.trim()} {...props}>
      {children}
    </div>
  );
}
