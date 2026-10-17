import { act, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DAY_CHECK_INTERVAL_MS, DayChangeRefresh } from "./day-change-refresh";

const refresh = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));

/** 23:50 on 14 October in Brasília (UTC-3). */
const BEFORE_MIDNIGHT = new Date("2026-10-15T02:50:00Z");
const AFTER_MIDNIGHT = new Date("2026-10-15T03:00:30Z");

let visibility: DocumentVisibilityState = "visible";

function setVisibility(state: DocumentVisibilityState) {
  visibility = state;
  document.dispatchEvent(new Event("visibilitychange"));
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(BEFORE_MIDNIGHT);
  visibility = "visible";
  vi.spyOn(document, "visibilityState", "get").mockImplementation(() => visibility);
  refresh.mockReset();
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("DayChangeRefresh", () => {
  it("does nothing while the day is the one the server rendered", () => {
    render(<DayChangeRefresh today="2026-10-14" />);

    act(() => vi.advanceTimersByTime(DAY_CHECK_INTERVAL_MS * 3));
    act(() => window.dispatchEvent(new Event("focus")));

    expect(refresh).not.toHaveBeenCalled();
  });

  it("refreshes once on the interval after midnight", () => {
    render(<DayChangeRefresh today="2026-10-14" />);

    vi.setSystemTime(AFTER_MIDNIGHT);
    act(() => vi.advanceTimersByTime(DAY_CHECK_INTERVAL_MS));
    act(() => vi.advanceTimersByTime(DAY_CHECK_INTERVAL_MS * 5));
    act(() => window.dispatchEvent(new Event("focus")));

    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it("waits for the tab to become visible and refreshes then", () => {
    render(<DayChangeRefresh today="2026-10-14" />);
    act(() => setVisibility("hidden"));

    vi.setSystemTime(AFTER_MIDNIGHT);
    act(() => vi.advanceTimersByTime(DAY_CHECK_INTERVAL_MS * 10));
    expect(refresh).not.toHaveBeenCalled();

    act(() => setVisibility("visible"));
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it("refreshes when the window gets the focus on a new day", () => {
    render(<DayChangeRefresh today="2026-10-14" />);

    vi.setSystemTime(AFTER_MIDNIGHT);
    act(() => window.dispatchEvent(new Event("focus")));

    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it("stops once the server renders the new day, and refreshes again on the next one", () => {
    const { rerender } = render(<DayChangeRefresh today="2026-10-14" />);
    vi.setSystemTime(AFTER_MIDNIGHT);
    act(() => window.dispatchEvent(new Event("focus")));
    rerender(<DayChangeRefresh today="2026-10-15" />);

    act(() => vi.advanceTimersByTime(DAY_CHECK_INTERVAL_MS * 3));
    expect(refresh).toHaveBeenCalledTimes(1);

    vi.setSystemTime(new Date("2026-10-16T03:00:30Z"));
    act(() => vi.advanceTimersByTime(DAY_CHECK_INTERVAL_MS));
    expect(refresh).toHaveBeenCalledTimes(2);
  });

  it("stops listening when unmounted", () => {
    const { unmount } = render(<DayChangeRefresh today="2026-10-14" />);
    unmount();

    vi.setSystemTime(AFTER_MIDNIGHT);
    act(() => vi.advanceTimersByTime(DAY_CHECK_INTERVAL_MS));
    act(() => window.dispatchEvent(new Event("focus")));

    expect(refresh).not.toHaveBeenCalled();
  });
});
