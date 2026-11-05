export function workspaceTagNames(tags: unknown): string[] {
  if (!Array.isArray(tags)) return [];
  return tags.flatMap((tag: unknown) => {
    const name = typeof tag === "object" && tag !== null && "name" in tag ? tag.name : tag;
    return typeof name === "string" && name.trim() ? [name] : [];
  });
}
