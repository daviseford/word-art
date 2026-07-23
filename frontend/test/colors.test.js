const expect = require('chai').expect;
const Colors = require('../src/colors');
const Util = require('../src/util');


describe('color presets', function () {
  it('use unique ids and valid colors', function () {
    const ids = Colors.Combos.map(combo => combo.id);

    expect(new Set(ids).size).to.equal(ids.length);
    Colors.Combos.forEach(combo => {
      expect(Util.isHexCode(combo.color), `${combo.name} line color`).to.equal(true);
      expect(Util.isHexCode(combo.bg_color), `${combo.name} background`).to.equal(true);
      expect(Util.isHexCode(combo.split_color), `${combo.name} highlight`).to.equal(true);
      expect(combo.node_colors).to.have.length(2);
      combo.node_colors.forEach(color => expect(Util.isHexCode(color), combo.name).to.equal(true));
    });
  });

  it('includes the new editorial palette collection', function () {
    const names = Colors.Combos.map(combo => combo.name);

    expect(names).to.include.members([
      'Letterpress',
      'Mesa After Rain',
      'Juniper & Brass',
      'Blue Hour',
    ]);
  });
});
