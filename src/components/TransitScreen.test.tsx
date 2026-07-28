import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import TransitScreen from "./TransitScreen";

describe("TransitScreen Component Tests", () => {
  it("returns null when active is false", () => {
    const markup = renderToStaticMarkup(
      createElement(TransitScreen, {
        active: false,
        fromDistrict: "downtown",
        toDistrict: "frontend",
      }),
    );
    expect(markup).toBe("");
  });

  it("renders BMTC Bus Interior by default", () => {
    const markup = renderToStaticMarkup(
      createElement(TransitScreen, {
        active: true,
        fromDistrict: "downtown",
        toDistrict: "frontend",
      }),
    );
    expect(markup).toContain("BMTC RED BUS");
    expect(markup).toContain("TICKET:");
    expect(markup).toContain("BENGALURU");
    expect(markup).toContain("MUMBAI");
  });

  it("renders Elevated Metro Line when transiting to Delhi (fullstack)", () => {
    const markup = renderToStaticMarkup(
      createElement(TransitScreen, {
        active: true,
        fromDistrict: "downtown",
        toDistrict: "fullstack",
      }),
    );
    expect(markup).toContain("Elevated Metro Line");
    expect(markup).toContain("Doors Closing");
  });

  it("renders Tuk-Tuk Auto Rickshaw when transiting to Hyderabad (backend)", () => {
    const markup = renderToStaticMarkup(
      createElement(TransitScreen, {
        active: true,
        fromDistrict: "downtown",
        toDistrict: "backend",
      }),
    );
    expect(markup).toContain("Tuk-Tuk Auto Rickshaw");
  });

  it("renders Rajdhani Express when transiting between Downtown and Frontend", () => {
    const markup = renderToStaticMarkup(
      createElement(TransitScreen, {
        active: true,
        fromDistrict: "frontend",
        toDistrict: "downtown",
      }),
    );
    expect(markup).toContain("Rajdhani Express");
    expect(markup).toContain("PLATFORM 3");
  });
});
