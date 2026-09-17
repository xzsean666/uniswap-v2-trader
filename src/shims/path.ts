export function resolve(...args: string[]) {
  return args.filter(Boolean).join("/");
}

export function dirname(p: string) {
  const parts = p.split("/");
  return parts.slice(0, -1).join("/") || "/";
}

export function join(...args: string[]) {
  return args.filter(Boolean).join("/");
}

export default {
  resolve,
  dirname,
  join,
};
