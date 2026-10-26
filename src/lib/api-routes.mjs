/** @param {string} method @param {string[]} path */
export function allowedRoute(method, path) {
  const route = path.join("/");
  const id = "[0-9a-fA-F-]{36}";
  if (method === "GET")
    return (
      /^(me|staff|leads)$/.test(route) ||
      new RegExp(`^leads/${id}(/documents)?$`).test(route)
    );
  if (method === "PATCH")
    return new RegExp(`^leads/${id}/assignment$`).test(route);
  return (
    method === "POST" &&
    new RegExp(`^leads/${id}/documents/${id}/download$`).test(route)
  );
}
