const fs = require('fs');
const path = require('path');

const Colors = require('../src/colors');
const Config = require('../src/config');
const Components = require('../src/components');
const Util = require('../src/util');

const contractPath = path.resolve(
  __dirname,
  '..',
  '..',
  'contract',
  'word-art-contract.json'
);
const contract = JSON.parse(fs.readFileSync(contractPath, 'utf8'));


describe('canonical Word Art contract', function () {
  it('loads the supported contract version and required sections', function () {
    expect(contract.schema).to.equal('word-art-contract');
    expect(contract.version).to.equal(1);

    [
      'palette',
      'quality',
      'request',
      'sentence_parsing',
      'turtle_path',
      'external_boundaries',
    ].forEach(section => expect(contract).to.have.property(section));
  });

  it('governs every frontend palette without replacing display metadata', function () {
    expect(contract.palette.governed_fields).to.have.ordered.members([
      'bg_color',
      'color',
      'node_colors',
      'split_color',
    ]);

    Colors.Combos.forEach(combo => {
      expect(combo.name).to.be.a('string').and.not.equal('');
      expect(combo.id).to.be.a('string').and.not.equal('');

      contract.palette.governed_fields.forEach(field => {
        expect(combo).to.have.property(field);
      });
      expect(Util.isHexCode(combo.bg_color), `${combo.name} background`).to.equal(true);
      expect(Util.isHexCode(combo.color), `${combo.name} line`).to.equal(true);
      expect(Util.isHexCode(combo.split_color), `${combo.name} highlight`).to.equal(true);
      expect(combo.node_colors).to.have.length(contract.palette.node_color_count);
      combo.node_colors.forEach(color => {
        expect(Util.isHexCode(color), `${combo.name} node`).to.equal(true);
      });
    });
  });

  it('keeps the frontend distinct-sentence quality gate aligned', function () {
    expect(contract.quality.frontend_gate.measure).to.equal(
      'distinct_normalized_sentences'
    );
    expect(Config.min_sentence_count).to.equal(
      contract.quality.minimum_segment_count
    );
    expect(Components.too_simple(Config.min_sentence_count)).to.contain(
      contract.quality.too_simple_message
    );
  });

  it('matches every frontend normalization and sentence example', function () {
    contract.sentence_parsing.frontend_examples.forEach(example => {
      const normalized = Util.getText(example.input);

      expect(normalized, example.name).to.equal(example.normalized);
      expect(Util.getSentenceStrings(normalized), example.name)
        .to.have.ordered.members(example.sentences);
      expect(Util.getSimpleParse(normalized), example.name)
        .to.have.ordered.members(example.lengths);
      expect(Util.getDistinctSentenceCount(example.input), example.name)
        .to.equal(example.distinct_count);
    });
  });

  it('matches the shared simple and color-split turtle examples', function () {
    const simple = contract.turtle_path.simple_example;
    expect(contract.turtle_path.command_cycle).to.have.ordered.members([
      'h -',
      'v ',
      'h ',
      'v -',
    ]);
    expect(Util.getSimplePathStr(simple.lengths)).to.equal(simple.path);

    const split = contract.turtle_path.split_example;
    const parsed = Util.getSplitParse(
      split.text,
      {
        words: split.highlight_words,
        color: split.highlight_color,
      },
      split.primary_color
    );
    expect(parsed).to.deep.equal(split.segments);
    expect(Util.getSimplePathStr(parsed.map(segment => segment.length)))
      .to.equal(split.path);
  });

  it('records external systems as documentation-only boundaries', function () {
    const png = contract.external_boundaries.png_conversion;
    const gallery = contract.external_boundaries.gallery;

    expect(png.ownership).to.equal('external_black_box');
    expect(png.request_fields).to.have.ordered.members(['url', 'bg_color']);
    expect(png.response_field).to.equal('svg_url');
    expect(png.executable_schema).to.equal(false);
    expect(gallery.ownership_repository).to.equal('daviseford-landing-page');
    expect(gallery.role).to.equal('external_consumer');
    expect(gallery.executable_schema).to.equal(false);
  });
});
