/**
 * Light math text for labels that contain "_" or "^".
 * Plain strings (no "_" or "^") are left untouched so callers keep today's font.
 *
 *  _5 / _{16} → subscript;  ^2 / ^{n} → superscript.
 *  log, ln, sin, cos, tan stay upright; single-letter variables are italic.
 */

const FUNCS = ["log", "sin", "cos", "tan", "ln"];

function escapeXml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function mergeRun(runs, run) {
  if (!run.text) return;
  const prev = runs[runs.length - 1];
  if (prev && prev.italic === run.italic && prev.shift === run.shift) {
    prev.text += run.text;
    return;
  }
  runs.push({ text: run.text, italic: !!run.italic, shift: run.shift || null });
}

function pushToken(runs, text, italic, shift) {
  mergeRun(runs, { text, italic, shift: shift || null });
}

/** Tokenize a fragment that is already inside a script (or the base line). */
function appendStyled(runs, fragment, shift) {
  const s = String(fragment);
  let i = 0;
  while (i < s.length) {
    let fn = null;
    for (const name of FUNCS) {
      if (!s.startsWith(name, i)) continue;
      const next = s[i + name.length];
      if (next && /[A-Za-z]/.test(next)) continue;
      fn = name;
      break;
    }
    if (fn) {
      pushToken(runs, fn, false, shift);
      i += fn.length;
      continue;
    }
    const ch = s[i];
    if (/[A-Za-z]/.test(ch)) pushToken(runs, ch, true, shift);
    else pushToken(runs, ch, false, shift);
    i += 1;
  }
}

/**
 * @param {string} text
 * @returns {null | Array<{ text: string, italic: boolean, shift: null | "sub" | "sup" }>}
 *   null when the string has no "_" or "^" (caller renders it unchanged).
 */
export function parseMathRuns(text) {
  const s = text == null ? "" : String(text);
  if (!s.includes("_") && !s.includes("^")) return null;
  const runs = [];
  let i = 0;
  while (i < s.length) {
    const ch = s[i];
    if (ch === "_" || ch === "^") {
      const shift = ch === "_" ? "sub" : "sup";
      i += 1;
      let inner = "";
      if (s[i] === "{") {
        const end = s.indexOf("}", i + 1);
        if (end < 0) {
          inner = s.slice(i + 1);
          i = s.length;
        } else {
          inner = s.slice(i + 1, end);
          i = end + 1;
        }
      } else if (i < s.length) {
        inner = s[i];
        i += 1;
      }
      appendStyled(runs, inner, shift);
      continue;
    }
    let fn = null;
    for (const name of FUNCS) {
      if (!s.startsWith(name, i)) continue;
      const next = s[i + name.length];
      if (next && /[A-Za-z]/.test(next)) continue;
      fn = name;
      break;
    }
    if (fn) {
      pushToken(runs, fn, false, null);
      i += fn.length;
      continue;
    }
    if (/[A-Za-z]/.test(ch)) pushToken(runs, ch, true, null);
    else pushToken(runs, ch, false, null);
    i += 1;
  }
  return runs.length ? runs : null;
}

export function svgMathRuns(runs) {
  let out = "";
  for (const r of runs) {
    const bits = [];
    if (r.shift === "sub") bits.push('baseline-shift="sub"', 'font-size="72%"');
    else if (r.shift === "sup") bits.push('baseline-shift="super"', 'font-size="72%"');
    bits.push(`font-style="${r.italic ? "italic" : "normal"}"`);
    out += `<tspan ${bits.join(" ")}>${escapeXml(r.text)}</tspan>`;
  }
  return out;
}

/**
 * @param {string} text
 * @param {boolean} italicIfPlain  today's font-style when the string is not math
 * @returns {{ fontStyle: "italic" | "normal", inner: string, math: boolean }}
 */
export function svgTextInner(text, italicIfPlain) {
  const s = text == null ? "" : String(text);
  const runs = parseMathRuns(s);
  if (!runs) {
    return {
      fontStyle: italicIfPlain ? "italic" : "normal",
      inner: escapeXml(s),
      math: false,
    };
  }
  return { fontStyle: "normal", inner: svgMathRuns(runs), math: true };
}
