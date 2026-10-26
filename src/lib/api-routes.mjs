/** @param {string} method @param {string[]} path */
export function allowedRoute(method, path) {
  const route = path.join("/");
  const id = "[0-9a-fA-F-]{36}";
  if (
    method === "GET" &&
    new RegExp(`^leads/${id}/documents/${id}/versions$`).test(route)
  )
    return true;
  if (
    method === "POST" &&
    new RegExp(`^leads/${id}/documents/${id}/versions/${id}/download$`).test(
      route,
    )
  )
    return true;
  if (
    method === "GET" &&
    (route === "processes" || new RegExp(`^processes/${id}$`).test(route))
  )
    return true;
  if (
    method === "POST" &&
    (route === "processes" ||
      new RegExp(`^processes/${id}/(transitions|tasks|evidence)$`).test(
        route,
      ) ||
      new RegExp(`^processes/${id}/evidence/${id}/download$`).test(route))
  )
    return true;
  if (
    method === "PATCH" &&
    new RegExp(`^processes/${id}/tasks/${id}$`).test(route)
  )
    return true;
  if (method === "GET")
    return (
      /^(me|staff|leads|pending)$/.test(route) ||
      new RegExp(`^leads/${id}(/documents)?$`).test(route)
    );
  if (method === "PATCH")
    return new RegExp(`^leads/${id}/assignment$`).test(route);
  return (
    method === "POST" &&
    new RegExp(`^leads/${id}/documents/${id}/(download|reviews)$`).test(route)
  );
}
