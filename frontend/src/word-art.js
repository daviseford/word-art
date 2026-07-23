const Util = require('./util');
const Form = require('./form');
const Colors = require('./colors');
const Components = require('./components');
const Config = require('./config');

$(document).ready(() => {
  const form = $('#word_art_form');
  const results_div = $('#display_results');
  const loading_div = $('#display_loading');
  const preset_select = $('#preset_color_select');
  const preset_div = $('#preset_color_swatch');
  const color_input_fields = ['input_line_bg_color', 'input_split_color', 'input_line_color'];

  /* Add our preset options to the select menu */
  preset_select.html(Components.getPresetOptions(Config.default_preset))
  preset_select.change(function (event) {
    const preset = event.currentTarget.value || null;
    const config = Colors.Combos.find(combo => combo.id === preset);
    if (config) {
      $('#input_line_color').val(config.color);
      $('#input_line_bg_color').val(config.bg_color);
      $('#input_node_colors').val(config.node_colors.join(', '));
      $('#input_split_color').val(config.split_color);
      preset_div.html(Components.makeSwatchHTML(config));
      color_input_fields.forEach(input => $(`#${input}`).change())
      console.log(`Updated with color preset ${config.name}.`);
    } else {
      preset_div.html(null);
    }
  });

  const start_load = () => {
    form.hide(0);
    results_div.hide(0);
    loading_div.html(Components.svg_loading()).show(0)
  };

  const end_load = () => {
    loading_div.html(null).hide(0);
    results_div.show(0);
    form.show(0);
  };

  const bindColorPicker = (textInputId, pickerInputId) => {
    const textInput = $(`#${textInputId}`);
    const pickerInput = $(`#${pickerInputId}`);
    const syncPicker = () => {
      const color = Util.toPickerHex(textInput.val());
      if (color) pickerInput.val(color);
    };

    textInput.on('input change', syncPicker);
    pickerInput.on('input change', event => {
      textInput.val(event.target.value.toUpperCase()).trigger('input');
    });
    syncPicker();
  };

  bindColorPicker('input_line_color', 'input_line_color_picker');
  bindColorPicker('input_line_bg_color', 'input_line_bg_color_picker');
  bindColorPicker('input_split_color', 'input_split_color_picker');
  color_input_fields.concat(['input_node_colors']).forEach(input => {
    $(`#${input}`).on('input', () => {
      preset_select.val('');
      preset_div.empty();
    });
  });
  preset_select.val(Config.default_preset).trigger('change');

  const input_text = $('#input_text');
  const sentence_count = $('#sentence_count');
  const update_sentence_count = () => {
    const count = Util.getDistinctSentenceCount(input_text.val());
    sentence_count
      .text(`${count} distinct sentence${count === 1 ? '' : 's'}`)
      .toggleClass('is-ready', count >= Config.min_sentence_count);
  };
  let sentence_count_timer;
  input_text.on('input', () => {
    clearTimeout(sentence_count_timer);
    sentence_count_timer = setTimeout(update_sentence_count, 100);
  });
  update_sentence_count();

  form.submit((e) => {
    e.stopPropagation();
    e.preventDefault();
    $("html, body").animate({ scrollTop: 0 }, "slow"); // smooth scroll to top

    // https://stackoverflow.com/questions/1184624/convert-form-data-to-javascript-object-with-jquery
    const distinct_sentence_count = Util.getDistinctSentenceCount(input_text.val());
    if (distinct_sentence_count < Config.min_sentence_count) {
      results_div.html(Components.too_simple(Config.min_sentence_count)).show(0);
      input_text.focus();
      return;
    }

    const essential_opts = Form.get_main_opts();
    start_load();
    essential_opts.checksum = Util.checksum(essential_opts);

    $.ajax({
      url: Config.generate_svg_endpoint,
      method: 'post', data: JSON.stringify(essential_opts),
      processData: false, headers: { 'Accept': 'application/json' },
      dataType: 'json',
    }).then(res => {
      if (res.s3_url) {
        results_div.html(Components.svg_success(res.s3_url));
        if (!res.duplicate) {
          generatePNG(res.s3_url, essential_opts.bg_color)
        } else {
          results_div.html(Components.png_success(res.s3_url))
        }
      } else {
        results_div.html(Components.svg_error(res.err))
      }
      end_load()
    }).catch(err => {
      if (err.statusText === 'error') {
        const expected_url = `${Config.svg_bucket}${essential_opts.checksum}.svg`;
        results_div.html(Components.long_load_screen(expected_url));
      } else {
        const message = err.responseJSON && err.responseJSON.err
          ? err.responseJSON.err
          : err.statusText;
        results_div.html(Components.svg_error(message));
      }
      end_load()
    })
  });


  const generatePNG = (url, bg_color) => {
    $.ajax({
      url: Config.generate_png_endpoint,
      method: 'post',
      data: JSON.stringify({ url, bg_color }),
      processData: false,
      headers: {
        'Accept': 'application/json'
      },
      dataType: 'json',
    }).then(res => {
      console.log(res);
      results_div.html(Components.png_success(res.svg_url))
    }).catch(() => results_div.html(Components.svg_error('The PNG preview could not be generated. Your SVG is still ready.')))
  }

});
