import { describe, expect, it } from "vitest";
import {
  formatHomeChefResponseWindow,
  getDefaultHomeChefAcceptanceWindowMinutes,
  getHomeChefLeadTimeCategory,
} from "../../src/server/home-chef/lead-time";

const now = new Date("2026-06-05T12:00:00.000Z");

describe("home chef lead-time categorization", () => {
  it("classifies same-day requests under 12 hours", () => {
    expect(
      getHomeChefLeadTimeCategory({
        requestType: "recipe",
        requestedDate: new Date("2026-06-05T20:00:00.000Z"),
        now,
      }),
    ).toBe("same_day");
  });

  it("classifies 24 to 72 hour requests as short term", () => {
    expect(
      getHomeChefLeadTimeCategory({
        requestType: "occasion",
        requestedDate: new Date("2026-06-07T12:00:00.000Z"),
        now,
      }),
    ).toBe("short_term");
  });

  it("classifies requests seven or more days out as advance booking", () => {
    expect(
      getHomeChefLeadTimeCategory({
        requestType: "meal_plan",
        requestedDate: new Date("2026-06-15T12:00:00.000Z"),
        now,
      }),
    ).toBe("advance_booking");
  });

  it("classifies daily and weekly cooking as recurring", () => {
    expect(
      getHomeChefLeadTimeCategory({
        requestType: "weekly_cooking",
        requestedDate: new Date("2026-06-06T12:00:00.000Z"),
        now,
      }),
    ).toBe("recurring");
  });

  it("keeps unclear windows in custom review", () => {
    expect(
      getHomeChefLeadTimeCategory({
        requestType: "custom",
        requestedDate: null,
        now,
      }),
    ).toBe("custom");
  });

  it("provides default acceptance windows for every category", () => {
    expect(getDefaultHomeChefAcceptanceWindowMinutes("same_day")).toBe(30);
    expect(getDefaultHomeChefAcceptanceWindowMinutes("short_term")).toBe(180);
    expect(formatHomeChefResponseWindow(180)).toBe("3 hours");
  });
});
