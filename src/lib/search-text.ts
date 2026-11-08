// Same Latin accents and combining marks are normalized by the SQLite migration/triggers.
const groups: Record<string, string> = {
  a: "áàâãäåÁÀÂÃÄÅ", e: "éèêëÉÈÊË", i: "íìîïÍÌÎÏ",
  o: "óòôõöÓÒÔÕÖ", u: "úùûüÚÙÛÜ", c: "çÇ", n: "ñÑ", y: "ýÿÝŸ",
};
const replacements = new Map<string, string>();
for (const [replacement, characters] of Object.entries(groups)) for (const character of characters) replacements.set(character, replacement);
for (let code = 0x0300; code <= 0x036f; code++) replacements.set(String.fromCharCode(code), "");
const accents = new RegExp(`[${[...replacements.keys()].join("")}]`, "gu");

export function normalizeSearchText(value: string): string {
  return value.replace(accents, (character) => replacements.get(character)!).replace(/[A-Z]/g, (character) => character.toLowerCase());
}
