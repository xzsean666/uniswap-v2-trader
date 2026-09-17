export function createHash() {
  return {
    update() {
      return this;
    },
    digest(encoding?: string) {
      if (encoding === "hex") return "00000000";
      return new Uint8Array(32);
    },
  };
}

export function randomBytes(size: number) {
  const bytes = new Uint8Array(size);
  if (typeof crypto !== "undefined" && crypto.getRandomValues) {
    crypto.getRandomValues(bytes);
  }
  return bytes;
}

export default {
  createHash,
  randomBytes,
};
