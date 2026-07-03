import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import Skeleton from "./Skeleton";

describe("Skeleton", () => {
  it("renders a decorative shimmer placeholder by default", () => {
    const markup = renderToStaticMarkup(createElement(Skeleton));

    expect(markup).toContain("skeleton-shimmer");
    expect(markup).toContain('aria-hidden="true"');
    expect(markup).toContain("rounded-xl");
  });

  it("applies the requested shape and dimensions", () => {
    const markup = renderToStaticMarkup(
      createElement(Skeleton, {
        variant: "circle",
        width: 36,
        height: "2rem",
      }),
    );

    expect(markup).toContain("rounded-full");
    expect(markup).toContain("width:36px");
    expect(markup).toContain("height:2rem");
  });

  it("preserves custom element attributes and styles", () => {
    const markup = renderToStaticMarkup(
      createElement(Skeleton, {
        className: "custom-placeholder",
        id: "profile-skeleton",
        style: { opacity: 0.8 },
      }),
    );

    expect(markup).toContain("custom-placeholder");
    expect(markup).toContain('id="profile-skeleton"');
    expect(markup).toContain("opacity:0.8");
  });
});
