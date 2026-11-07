import type { ReactNode } from "react";

export type CameraFrame = {
  widthMm: number;
  heightMm: number;
  windowX: number;
  windowY: number;
  windowW: number;
  windowH: number;
};

type Props = {
  frame: CameraFrame;
  overlayUrl: string | null;
  width: number;
  children: ReactNode;
  animate?: boolean;
};

export function MagnetFrame({ frame, overlayUrl, width, children, animate = false }: Props) {
  const height = Math.round(width * (frame.heightMm / frame.widthMm));
  return (
    <div className={animate ? "cam-frame-swap relative bg-paper" : "relative bg-paper"} style={{ width, height }}>
      <div
        className="absolute overflow-hidden"
        style={{
          left: `${frame.windowX * 100}%`,
          top: `${frame.windowY * 100}%`,
          width: `${frame.windowW * 100}%`,
          height: `${frame.windowH * 100}%`,
        }}
      >
        {children}
      </div>
      {overlayUrl ? (
        <img src={overlayUrl} alt="" aria-hidden="true" draggable={false} className="pointer-events-none absolute inset-0 h-full w-full" />
      ) : null}
    </div>
  );
}
