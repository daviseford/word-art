const Util = {};
const exclamations = ['Dope!', 'Sick!', 'Wow!', 'Really nice work -',
  'Incredible!!!', "That's tight -", 'Wicked sick!', 'My friend, you have astonished me.',
  'Could it be? YES!', "Honestly, I'm impressed -", "Superlative!", "Can you believe it?",
  'Outstanding!', '[Generic Positive Expression]!', 'I can tell you are smart -',];

/**
 * Remove common Project Gutenberg watermarks
 * @param txt
 * @returns {string}
 */
Util.gutenberg = (txt) => {
  const start_delim = '*** START OF THIS PROJECT GUTENBERG EBOOK';
  const end_delim = '*** END OF THIS PROJECT GUTENBERG EBOOK';
  // Remove everything before and including start_delim
  if (txt.includes(end_delim)) {
    txt = txt.split(end_delim)[0]
  }
  if (txt.includes(start_delim)) {
    let delim = txt.match(/^.+?(?=START OF THIS PROJECT GUTENBERG EBOOK [\w\s]+\*\*\*)(.+)$/gm);
    if (!delim) return txt;
    delim = delim[0];
    const slice_before_index = txt.indexOf(delim) + delim.length;
    txt = txt.slice(slice_before_index);
  }
  return txt
};

/**
 * Mega stripper
 * @param txt
 */
Util.stripPunctuationChars = (txt) => {
  return txt.replace(/[\n\r‘’\u2018\u2019\u201A\'“”\u201C\u201D\u201E\"\u02C6\u2039<\u203A>\u02DC\u00A0\u2013\u2014,:;\-\+\\\/\(\)\*]/gm, ' ')
};

/**
 * Fixes two common contractions
 * 1,234 -> 1234
 * ain't -> aint
 * @param txt
 * @returns {string}
 */
Util.concatenateContractions = (txt) => {
  return txt.replace(/(\w)[\u2019'](\w)|(\d),(\d)/gm, (a, b, c, d, e) => b ? b + c : d + e);
};

/**
 * Removes extraneous spacing around sentence beginnings/endings
 * and replaces !? and ... with .
 * @param txt
 * @returns {string}
 */
Util.normalizeSentenceEndings = (txt) => {
  return txt.replace(/\u2026/gm, ".")   // special ellipsis
      .replace(/([!?]|\.{2,})/gm, ".")  // replace !?... with . to save time parsing later
      .replace(/\s{2,}/gm, " ")         // anything above 1 space is unnecessary
      .replace(/\s+\./gm, ".")          // removes the extra space in "end of sentence ."
      .replace(/\.\s+/gm, ".")          // removes the extra space in ".  start of sentence"
};

/**
 * Removes unnecessary characters from a string
 * @param txt
 * @returns {string}
 */
Util.stripText = (txt) => {
  txt = Util.gutenberg(txt).trim().toLowerCase()
  txt = Util.concatenateContractions(txt)
  txt = Util.stripPunctuationChars(txt)
  txt = Util.normalizeSentenceEndings(txt)
  return txt
};

Util.getText = (txt) => {
  return Util.stripText(txt);
};

Util.getSentenceStrings = (txt) => txt.split('.').map(x => x.trim()).filter(Boolean);

Util.getDistinctSentenceCount = (txt) => {
  const normalized = Util.getText(txt);
  return new Set(Util.getSentenceStrings(normalized)).size;
};

Util.getSimpleParse = (txt) => {
  return Util.getSentenceStrings(txt).map(x => x.split(/\s+/).length)
};

Util.getSimplePathStr = (array_of_ints) => {
  /* Turn left 90 degrees each time */
  const behavior_ref = ['h -', 'v ', 'h ', 'v -'];
  let count = 0;
  return array_of_ints.reduce((a, i) => {
    const move = `${behavior_ref[count]}${i}`;
    count = count === 3 ? 0 : count + 1;
    return `${a} ${move}`;
  }, 'M50 20j')
};


Util.getSplitParse = (input_text, split_dict, primary_color) => {
  const sentences = Util.getSentenceStrings(input_text);
  const default_color = primary_color || "#14B6D4";
  return sentences.map(words => {
    let segment_color = default_color;
    split_dict['words'].forEach(word => {
      if (words.includes(word.toLowerCase())) {
        segment_color = split_dict['color'] || "#F22F00"
      }
    });
    return {'color': segment_color, 'length': words.split(' ').length}
  })
};

/**
 * Checks if a string is a valid hex code.
 * Also tries inserting a '#' sign if one doesn't exist
 * @param txt
 * @returns {string|null}
 */
Util.toHex = (txt) => {
  txt = txt ? txt.trim().toUpperCase() : '';
  if (txt.includes('#') && Util.isHexCode(txt)) return txt;
  return Util.isHexCode(`#${txt}`) ? `#${txt}` : null;
};

/**
 * Normalizes a hex color for a native color input, which requires six digits.
 * @param txt
 * @returns {string|null}
 */
Util.toPickerHex = (txt) => {
  const hex = Util.toHex(txt);
  if (!hex) return null;
  return hex.length === 4
    ? `#${hex.slice(1).split('').map(character => character + character).join('')}`
    : hex;
};

/**
 * Remove empty top-level keys from an object
 * @param obj
 * @returns {{}}
 */
Util.removeEmptyKeys = (obj) => {
  return Object.keys(obj).reduce((a, key) => {
    if (!obj[key] || obj[key] === '') return a;
    a[key] = obj[key];
    return a
  }, {});
};

/* Nifty one liners */
Util.getExpression = () => Util.getRandomEntry(exclamations);
Util.getNodeColors = (txt) => txt ? txt.split(',').map(x => Util.toHex(x) ? Util.toHex(x) : '#F26101') : null;
Util.getRandomEntry = (arr) => arr[Math.floor(Math.random() * arr.length)];
Util.getSplitText = (txt) => {
  const words = txt ? txt.split(',').map(x => x.trim().toLowerCase()).filter(Boolean) : [];
  return words.length > 0 ? words : null;
};
Util.isHexCode = (txt) => /(^#[0-9A-F]{6}$)|(^#[0-9A-F]{3}$)/i.test(txt);
Util.extensionSVGtoPNG = (filename) => filename.replace(/.svg/g, '.png');
Util.extensionPNGtoSVG = (filename) => filename.replace(/.png/g, '.svg');
Util.getFileName = (url) => url.substring(url.lastIndexOf('/') + 1);

Util.checksum = (any) => {
  any = !any ? '0000000000000000' : any;
  if (typeof any === 'string') {
    return any.split('').reduce((a, s, i) => a + (any.charCodeAt(i) * (i + 1)), 0x12345678).toString();
  } else {
    return Util.checksum(JSON.stringify(any).replace(/\s+/g, ''))
  }
};

module.exports = Util;
