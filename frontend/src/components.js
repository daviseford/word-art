const Util = require('./util');
const Colors = require('./colors');
const Config = require('./config');
const Components = {};

const escapeHtml = (value) => String(value || '').replace(/[&<>'"]/g, character => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
}[character]));

Components.long_load_screen = (url) => `
  <div class="result-message result-message--info">
    <p>Your composition is taking longer than usual.</p>
    <a href="${escapeHtml(url)}">Check for the SVG in a minute →</a>
  </div>`;

Components.svg_loading = () => `
  <div class="result-message result-message--loading" role="status">
    <span class="loading-mark" aria-hidden="true"></span>
    <p>Drawing your sentence path…</p>
  </div>`;

Components.svg_success = (svg_url) => `
  <div class="result-message result-message--success">
    <p>Your SVG is ready. The PNG preview is rendering now.</p>
    <a class="result-action" href="${escapeHtml(svg_url)}" target="_blank" rel="noopener">Download SVG</a>
    ${Components.png_generating()}
  </div>`;

Components.png_success = (svg_url) => {
  const png_filename = Util.extensionSVGtoPNG(Util.getFileName(svg_url));
  const png_url = `${Config.png_bucket}${png_filename}`;
  return `
    <div class="result-message result-message--success">
      <p>${escapeHtml(Util.getExpression())} Your composition is ready.</p>
      <div class="result-actions">
        <a class="result-action" href="${escapeHtml(svg_url)}" target="_blank" rel="noopener">Download SVG</a>
        ${Components.png_download(png_url)}
        ${Components.canvaspop_button(png_url)}
      </div>
      ${Components.preview(png_url)}
    </div>`;
};

Components.svg_error = (err) => `
  <div class="result-message result-message--error" role="alert">
    <p>${escapeHtml(err || 'The composition could not be generated.')}</p>
  </div>`;

Components.too_simple = (minimum) => Components.svg_error(
  `Your prompt is too simple. Try at least ${minimum} distinct sentences`
);

Components.png_generating = () => `
  <span class="result-action result-action--quiet">
    <span class="loading-mark loading-mark--small" aria-hidden="true"></span> Rendering PNG
  </span>`;

Components.png_download = (png_url) => `
  <a class="result-action" href="${escapeHtml(png_url)}" target="_blank" rel="noopener" download>Download PNG</a>`;

Components.canvaspop_button = (png_url) => `
  <a class="result-action result-action--quiet" href="${escapeHtml(Components.get_canvaspop_url(png_url))}" target="_blank" rel="noopener">Buy a print</a>`;

Components.get_canvaspop_url = (url) => `https://store.canvaspop.com/api/pull?image_url=${encodeURIComponent(url)}&access_key=15549806e27b7565977dabf10b992dbd`;

Components.preview = (png_url) => `
  <a class="result-preview" href="${escapeHtml(png_url)}" target="_blank" rel="noopener">
    <img src="${escapeHtml(png_url)}" alt="Your generated Word Art composition">
  </a>`;

Components.makeSwatchHTML = (config_obj) => `
  <div class="palette-preview" aria-label="Selected palette" role="list">
    ${[
      { colors: [config_obj.bg_color], name: 'Canvas' },
      { colors: [config_obj.color], name: 'Path' },
      { colors: config_obj.node_colors, name: 'Start / end' },
      { colors: [config_obj.split_color], name: 'Highlight' },
    ].map(item => `
      <div class="palette-preview__color" role="listitem">
        <span class="palette-preview__swatches" aria-hidden="true">
          ${item.colors.map(color => `<i style="background-color:${escapeHtml(color)}"></i>`).join('')}
        </span>
        <span class="palette-preview__label">
          <strong>${item.name}</strong>
          <small>${item.colors.map(escapeHtml).join(' / ')}</small>
        </span>
      </div>`).join('')}
  </div>`;

Components.getPresetOptions = (selectedId) => {
  const opts = Colors.Combos.map(combo => {
    const selected = combo.id === selectedId ? ' selected' : '';
    return `<option value="${escapeHtml(combo.id)}"${selected}>${escapeHtml(combo.name)}</option>`;
  });
  opts.unshift('<option value="">Custom colors</option>');
  return opts.join('');
};

module.exports = Components;
