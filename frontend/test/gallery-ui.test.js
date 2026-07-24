const fs = require('fs');
const path = require('path');

describe('gallery interface', function () {
  const template = fs.readFileSync(
    path.resolve(__dirname, '..', 'src', 'word-art-gallery.html'),
    'utf8',
  );
  const styles = fs.readFileSync(
    path.resolve(__dirname, '..', 'src', 'gallery.css'),
    'utf8',
  );

  it('opens directly on the collection', function () {
    expect(template).to.not.match(/class="gallery-hero/);
    expect(template).to.not.contain('Every book leaves a shape');
    expect(template).to.match(/<main>\s*<section class="gallery-collection"/);
  });

  it('lets keyboard users skip straight to the gallery', function () {
    expect(template).to.contain('<a class="skip-link" href="#gallery">');
    expect(template).to.contain('id="gallery"');
  });

  it('declares the live page canonical URL', function () {
    expect(template).to.contain(
      '<link rel="canonical" href="https://daviseford.com/pages/word-art-gallery.html">',
    );
  });

  it('cache-busts both browser assets from one build version', function () {
    const versionExpression = '<%= htmlWebpackPlugin.options.assetVersion %>';

    expect(template).to.contain(`href="/word-art/gallery.css?v=${versionExpression}"`);
    expect(template).to.contain(`src="/word-art/gallery.bundle.js?v=${versionExpression}"`);
  });

  it('boots from the bundle rather than an inline script', function () {
    expect(template).to.not.contain('WordArtGallery.init()');
  });

  it('announces loading progress and pagination accessibly', function () {
    expect(template).to.match(/<p id="gallery-status"[^>]*aria-live="polite"/);
    expect(template).to.match(/<nav id="gallery-pagination"[^>]*aria-label="Gallery pages"/);
  });

  it('invites visitors to create their own art', function () {
    expect(template).to.contain('<a href="/word-art/">Create your own</a>');
    expect(template).to.not.contain('<a href="/word-art/">Create</a>');
  });

  it('gates hover styling behind hover-capable pointers', function () {
    const rules = styles.replace(/\/\*[\s\S]*?\*\//g, '');
    const gateIndex = rules.indexOf('@media (hover: hover)');

    expect(gateIndex).to.be.above(-1);
    expect(rules.slice(0, gateIndex)).to.not.contain(':hover');
    expect(rules.slice(gateIndex)).to.contain('.gallery-card__media:hover');
    expect(rules.slice(gateIndex)).to.contain('.pagination__button:hover:not(:disabled)');
  });
});
