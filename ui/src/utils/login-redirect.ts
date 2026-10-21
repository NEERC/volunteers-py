/**
 * The page to return to after login: a path of this app, "/" for anything else
 * (absolute and protocol-relative URLs, the login page itself).
 */
export function safeRedirect(redirect: unknown): string {
  if (
    typeof redirect !== "string" ||
    !redirect.startsWith("/") ||
    redirect.startsWith("//") ||
    redirect.startsWith("/\\") ||
    redirect.startsWith("/login")
  ) {
    return "/";
  }
  return redirect;
}
