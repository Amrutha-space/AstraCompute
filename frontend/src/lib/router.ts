export type AppRoute = "/" | "/access" | "/overview" | "/jobs" | "/benchmarks" | "/policies" | "/system";

export function normalizeRoute(pathname: string): AppRoute {
  if (pathname === "/access") {
    return "/access";
  }
  if (pathname === "/overview") {
    return "/overview";
  }
  if (pathname === "/jobs") {
    return "/jobs";
  }
  if (pathname === "/benchmarks") {
    return "/benchmarks";
  }
  if (pathname === "/policies") {
    return "/policies";
  }
  if (pathname === "/system") {
    return "/system";
  }
  return "/";
}

export function navigateTo(route: AppRoute, replace = false): void {
  if (replace) {
    window.history.replaceState({}, "", route);
  } else {
    window.history.pushState({}, "", route);
  }
  window.dispatchEvent(new PopStateEvent("popstate"));
}
