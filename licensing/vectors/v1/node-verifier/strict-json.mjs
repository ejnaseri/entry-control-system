// Independent strict JSON reader for the Node golden-vector consumer.
// It does not share issuer or protocol-generation code.

const decoder = new TextDecoder("utf-8", { fatal: true });

function syntax(label, message) {
  throw new Error(`${label}: ${message}`);
}

class JsonReader {
  constructor(text, label) {
    this.text = text;
    this.label = label;
    this.offset = 0;
    this.items = 0;
  }

  parse() {
    this.skipWhitespace();
    const value = this.value(0);
    this.skipWhitespace();
    if (this.offset !== this.text.length) syntax(this.label, `trailing JSON at offset ${this.offset}`);
    return value;
  }

  bump(depth) {
    if (depth > 64) syntax(this.label, "JSON depth exceeds 64");
    this.items += 1;
    if (this.items > 1_000_000) syntax(this.label, "JSON item count exceeds 1000000");
  }

  value(depth) {
    this.bump(depth);
    const character = this.text[this.offset];
    if (character === "{") return this.object(depth + 1);
    if (character === "[") return this.array(depth + 1);
    if (character === '"') return this.string();
    if (character === "t") return this.literal("true", true);
    if (character === "f") return this.literal("false", false);
    if (character === "n") return this.literal("null", null);
    if (character === "-" || (character >= "0" && character <= "9")) return this.number();
    syntax(this.label, `invalid JSON value at offset ${this.offset}`);
  }

  object(depth) {
    this.offset += 1;
    this.skipWhitespace();
    const output = {};
    const names = new Set();
    if (this.text[this.offset] === "}") {
      this.offset += 1;
      return output;
    }
    for (;;) {
      if (this.text[this.offset] !== '"') syntax(this.label, `object key expected at offset ${this.offset}`);
      const key = this.string();
      if (names.has(key)) syntax(this.label, `duplicate object key ${JSON.stringify(key)}`);
      names.add(key);
      this.skipWhitespace();
      if (this.text[this.offset++] !== ":") syntax(this.label, `colon expected at offset ${this.offset - 1}`);
      this.skipWhitespace();
      output[key] = this.value(depth);
      this.skipWhitespace();
      const delimiter = this.text[this.offset++];
      if (delimiter === "}") return output;
      if (delimiter !== ",") syntax(this.label, `object delimiter expected at offset ${this.offset - 1}`);
      this.skipWhitespace();
    }
  }

  array(depth) {
    this.offset += 1;
    this.skipWhitespace();
    const output = [];
    if (this.text[this.offset] === "]") {
      this.offset += 1;
      return output;
    }
    for (;;) {
      output.push(this.value(depth));
      this.skipWhitespace();
      const delimiter = this.text[this.offset++];
      if (delimiter === "]") return output;
      if (delimiter !== ",") syntax(this.label, `array delimiter expected at offset ${this.offset - 1}`);
      this.skipWhitespace();
    }
  }

  string() {
    const start = this.offset;
    this.offset += 1;
    for (;;) {
      if (this.offset >= this.text.length) syntax(this.label, "unterminated JSON string");
      const code = this.text.charCodeAt(this.offset++);
      if (code === 0x22) break;
      if (code < 0x20) syntax(this.label, "unescaped control character in JSON string");
      if (code === 0x5c) {
        if (this.offset >= this.text.length) syntax(this.label, "truncated JSON escape");
        const escape = this.text[this.offset++];
        if (escape === "u") {
          const hex = this.text.slice(this.offset, this.offset + 4);
          if (!/^[0-9a-fA-F]{4}$/.test(hex)) syntax(this.label, "invalid JSON Unicode escape");
          this.offset += 4;
        } else if (!'"\\/bfnrt'.includes(escape)) syntax(this.label, "invalid JSON escape");
      }
    }
    try {
      return JSON.parse(this.text.slice(start, this.offset));
    } catch {
      syntax(this.label, "invalid JSON string encoding");
    }
  }

  number() {
    const remaining = this.text.slice(this.offset);
    const match = /^-?(?:0|[1-9][0-9]*)(?:\.[0-9]+)?(?:[eE][+-]?[0-9]+)?/.exec(remaining);
    if (!match) syntax(this.label, `invalid JSON number at offset ${this.offset}`);
    this.offset += match[0].length;
    const value = Number(match[0]);
    if (!Number.isFinite(value)) syntax(this.label, "non-finite JSON number");
    return value;
  }

  literal(token, value) {
    if (this.text.slice(this.offset, this.offset + token.length) !== token) syntax(this.label, `invalid JSON literal at offset ${this.offset}`);
    this.offset += token.length;
    return value;
  }

  skipWhitespace() {
    while ([" ", "\t", "\r", "\n"].includes(this.text[this.offset])) this.offset += 1;
  }
}

export function parseStrictPrettyJson(input, label, maximumBytes = 16 * 1024 * 1024) {
  const bytes = Buffer.from(input);
  if (bytes.length < 2 || bytes.length > maximumBytes) syntax(label, "JSON size is outside its bound");
  if (bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) syntax(label, "UTF-8 BOM is forbidden");
  let text;
  try {
    text = decoder.decode(bytes);
  } catch {
    syntax(label, "JSON is not valid UTF-8");
  }
  if (text.includes("\r") || !text.endsWith("\n") || text.endsWith("\n\n")) syntax(label, "JSON must use LF and exactly one final LF");
  const value = new JsonReader(text.slice(0, -1), label).parse();
  const canonical = `${JSON.stringify(value, null, 2)}\n`;
  if (canonical !== text) syntax(label, "JSON is not canonical pretty formatting");
  return value;
}

export function jsonDeepEqual(left, right) {
  if (left === right) return true;
  if (Array.isArray(left) || Array.isArray(right)) {
    return Array.isArray(left) && Array.isArray(right) && left.length === right.length && left.every((value, index) => jsonDeepEqual(value, right[index]));
  }
  if (left && right && typeof left === "object" && typeof right === "object") {
    const leftKeys = Object.keys(left).sort();
    const rightKeys = Object.keys(right).sort();
    return leftKeys.length === rightKeys.length && leftKeys.every((key, index) => key === rightKeys[index] && jsonDeepEqual(left[key], right[key]));
  }
  return false;
}
