const Util = require('./util');
const Config = require('./config');

const get_main_opts = () => {
  const input_text = $('#input_text');
  input_text.val(input_text.val().trim()); // Strip whitespace
  const text = Util.getText(input_text.val());
  const color = Util.toHex($('#input_line_color').val());
  const bg_color = Util.toHex($('#input_line_bg_color').val());
  const node_colors = Util.getNodeColors($('#input_node_colors').val());
  const split = {
    words: Util.getSplitText($('#input_split_words').val()),
    color: Util.toHex($('#input_split_color').val())
  };
  // console.log(text)
  const simple_pre_parsed = Util.getSimpleParse(text);
  const simple_path = Util.getSimplePathStr(simple_pre_parsed);
  const split_pre_parsed = split.words ? Util.getSplitParse(text, split, color) : null;

  const standard_opts = {
    text,
    simple_path,
    split_pre_parsed,
    color,
    node_colors,
    version: Config.version,
    bg_color,
  };

  /* Remove empty fields (they'll get default values on the back end if needed) */
  const essential_opts = Util.removeEmptyKeys(standard_opts);

  /* Check if split needs to be included */
  if (split.words) {
    essential_opts['split'] = split
  }

  /* Reduce the size of the network request by removing the text */
  if ((simple_path.length > 0 && !essential_opts['split']) || split_pre_parsed.length > 0) {
    delete essential_opts['text']
  }
  return essential_opts
};


module.exports = {
  get_main_opts,
}
