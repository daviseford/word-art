const Util = require('../src/util');
const Config = require('../src/config');
const Components = require('../src/components');
const expect = require('chai').expect;


describe('Util.checksum', function () {
  it('should create checksums from objects', function () {
    const obj1 = {a: 'str', b: [{'a key': 2, b: '12'}]};
    const obj2 = {a: 'str2', c: [{'b key': 2, xxx: null}]};
    expect(Util.checksum(obj1)).to.equal(Util.checksum(obj1));
    expect(Util.checksum(obj1)).to.not.equal(Util.checksum(obj2));
  });

  it('should create unique, repeatable checksums from objects or strings', function () {
    const str1 = 'gangster paradise';
    const str2 = 'gangsta paradise';
    const str3 = 'gangsta  paradise';
    expect(Util.checksum(str1)).to.equal(Util.checksum(str1));
    expect(Util.checksum(str1)).to.not.equal(Util.checksum(str2));
    expect(Util.checksum(str2)).to.not.equal(Util.checksum(str3))
  });

  it('should create a default checksum if passed null', function () {
    expect(Util.checksum(null)).to.not.equal(null);
    expect(Util.checksum(null)).to.equal(Util.checksum(null));
  });

});

describe('Util.toHex', function () {
  it('should return valid hex codes or null', function () {
    expect(Util.toHex('fff')).to.equal('#FFF');
    expect(Util.toHex('#20C20E')).to.equal('#20C20E');
    expect(Util.toHex(null)).to.equal(null);
    expect(Util.toHex('sometext')).to.equal(null);
    expect(Util.toHex('#fa')).to.equal(null)
  });
});

describe('Util.toPickerHex', function () {
  it('should return six-digit colors accepted by native color inputs', function () {
    expect(Util.toPickerHex('#20c20e')).to.equal('#20C20E');
    expect(Util.toPickerHex('#abc')).to.equal('#AABBCC');
    expect(Util.toPickerHex('sometext')).to.equal(null);
  });
});

describe('Util.getSplitText', function () {
  it('should ignore blank highlight terms and disable empty split input', function () {
    expect(Util.getSplitText('quality, ,logic,')).to.have.ordered.members(['quality', 'logic']);
    expect(Util.getSplitText('   ')).to.equal(null);
  });
});

describe('Util.getText', function () {
  it('should preserve short normalized text without inventing sentences', function () {
    const res = Util.getText('short');
    expect(res).to.equal('short')
  });

  it('should strip newlines, smart quotes, extra spaces, trim, and lowercase', function () {
    const txt = `    I cannot describe to you my sensations on the near prospect of my
    undertaking...  It is -impossible- to communicate to you a conception of
    the trembling sensation, half pleasurable, and  half fearful, with which
    I am preparing to depart.  I am going to unexplored regions, to “the
    land of mist and snow,” but I shall kill no albatross; therefore do not
    be alarmed for my safety or if I should come back to you as worn and
    woeful as the “Ancient Mariner.” A question mark and contraction ain't stopping this?  
    Excitedly!    `;
    const sample = Util.getText(txt);
    const result = 'i cannot describe to you my sensations on the near prospect of my ' +
        'undertaking.it is impossible to communicate to you a conception of ' +
        'the trembling sensation half pleasurable and half fearful with which ' +
        'i am preparing to depart.i am going to unexplored regions to the land of ' +
        'mist and snow but i shall kill no albatross therefore do not be alarmed ' +
        'for my safety or if i should come back to you as worn and woeful as the ' +
        'ancient mariner.a question mark and contraction aint stopping this.excitedly.';
    expect(sample).to.equal(result)
  });
});

describe('Util.getDistinctSentenceCount', function () {
  it('counts unique normalized sentences', function () {
    expect(Util.getDistinctSentenceCount('One! Two? One. Three.')).to.equal(3);
  });

  it('returns zero for empty input', function () {
    expect(Util.getDistinctSentenceCount('   ')).to.equal(0);
  });
});

describe('submission quality boundary', function () {
  it('requires 20 distinct sentences and reports the same minimum', function () {
    expect(Config.min_sentence_count).to.equal(20);
    expect(Components.too_simple(Config.min_sentence_count)).to.contain(
        'Try at least 20 distinct sentences'
    );
  });
});

describe('Util.gutenberg', function () {
  it('should remove Project Gutenberg header', function () {
    const dickens = `
    The Project Gutenberg EBook of A Tale of Two Cities, by Charles Dickens
    Character set encoding: UTF-8
    
    *** START OF THIS PROJECT GUTENBERG EBOOK A TALE OF TWO CITIES ***
    
    Produced by Judith Boss
    
    *** END OF THIS PROJECT GUTENBERG EBOOK A TALE OF TWO CITIES ***
    ***** This file should be named 98-0.txt or 98-0.zip *****
    This and all associated files of various formats will be found in:
            http://www.gutenberg.org/9/98/`;
    const gutenberg_text = Util.gutenberg(dickens).trim();
    expect(gutenberg_text).to.equal('Produced by Judith Boss');

  });
  it('should remove Project Gutenberg header/footer', function () {
    const frank = `
    Project Gutenberg's Frankenstein, by Mary Wollstonecraft (Godwin) Shelley
    Title: Frankenstein or The Modern Prometheus
    Author: Mary Wollstonecraft (Godwin) Shelley
    Release Date: June 17, 2008 [EBook #84]
    Last updated: January 13, 2018
    Language: English
    Character set encoding: UTF-8
    
    *** START OF THIS PROJECT GUTENBERG EBOOK FRANKENSTEIN ***
    
    He sprang from the cabin-window as he said this, upon the ice raft which lay close to the vessel.
    
    *** END OF THIS PROJECT GUTENBERG EBOOK FRANKENSTEIN ***
    ***** This file should be named 84-0.txt or 84-0.zip *****
    This and all associated files of various formats will be found in:
            http://www.gutenberg.org/8/84/
    
    Produced by Judith Boss, Christy Phillips, Lynn Hanninen,
    and David Meltzer. HTML version by Al Haines.
    Further corrections by Menno de Leeuw.`;
    const gutenberg_text = Util.gutenberg(frank).trim();
    expect(gutenberg_text).to.equal('He sprang from the cabin-window as he said this, upon the ice raft which lay close to the vessel.');
  });

  it('should be selective about removal', function () {
    const custom = `
     80=2y3hr9q[84tmwfg ,/s s49tuj0u**Y*#@r hh8*******Y#8r82hi2nfds/f *****
    Character set encoding: UTF-8
    *** IMPORTANT STUFF DESIGNED TO TRIP UP THE REGEX ***
    
    *** START OF THIS PROJECT GUTENBERG EBOOK A TALE OF TWO CITIES ***
    
   I should be the only text left, 
   even though technically, this is the start of this project gutenberg ebook
   and this is *** THE END ***
    
    *** END OF THIS PROJECT GUTENBERG EBOOK A TALE OF TWO CITIES ***
    I BET THIS MESS WITH IT
    *** START OF THIS PROJECT GUTENBERG EBOOK A TALE OF TWO CITIES ***
    ***** This file should be named 98-0.txt or 98-0.zip *****
    This and all associated files of various formats will be found in:
            http://www.gutenberg.org/9/98/`;
    const gutenberg_text = Util.gutenberg(custom).trim();
    expect(gutenberg_text).to.equal('I should be the only text left, \n   even though technically, this is the start of this project gutenberg ebook\n   and this is *** THE END ***');

  });

  it('should leave non-gutenberg files alone', function () {
    const innocent = `
    *** IMPORTANT STUFF DESIGNED TO TRIP UP THE REGEX ***
    *** START OF THIS DAMN ASTERIK STUFF ***
    *** END OF THIS EBOOK FRANKLY it SUCKED ***
    project gutenberg is the best
    I BET THIS MESS WITH IT
    *** START OF A TALE OF TWO CITIES ***
    This and all associated files of various formats will be found in:
            http://www.gutenberg.org/9/98/`;
    const gutenberg_text = Util.gutenberg(innocent);
    expect(gutenberg_text).to.equal(innocent);

  });

});

describe('Text Manipulation', function () {
  it('should fix 1,234 -> 1234 and don\'t -> dont', function () {
    const txt = Util.concatenateContractions("don't have 1,234 babies");
    expect(txt).to.equal('dont have 1234 babies')
  });

  it('should normalize sentence endings', function () {
    const txt = Util.normalizeSentenceEndings("a sample of the spacing . that can . occur.");
    expect(txt).to.equal('a sample of the spacing.that can.occur.')
  })
});


describe('Util.getSimpleParse', function () {
  it('should return the real sentence length for short input', function () {
    const text = Util.getText('sample');
    const res = Util.getSimpleParse(text);
    expect(res).to.have.ordered.members([1])
  });

  it('should properly parse a simple paragraph', function () {
    const text = Util.getText('The script calculates the number of sentences in a ' +
        'given text input (1,349 in this case). Once the script has ' +
        'reduced the book to a list of sentences, we then transform ' +
        'those sentences into a number representing the number of words ' +
        'in a sentence. The previous sentence, for example, would be ' +
        'represented by 28 (28 words). We then draw a path using Python ' +
        'and SVG. Each straight line represents a sentence in the book - ' +
        'and its length is determined by how many words are in the sentence. ' +
        'At the end of each sentence, the path turns left 90 degrees.');
    const sentence_lengths = Util.getSimpleParse(text);
    expect(sentence_lengths.length).to.equal(6);
    expect(sentence_lengths).to.have.ordered.members([16, 28, 12, 9, 22, 12])
  });
});


describe('Util.getSplitParse', function () {
  it('should return the real sentence length for short input', function () {
    const text = Util.getText('sample');
    const res = Util.getSplitParse(text, {words: ['lol'], color: '#fff'}, '#000');
    expect(res.length).to.equal(1)
  });

  it('should properly parse a simple paragraph', function () {
    const text = Util.getText('The script calculates the number of sentences in a ' +
        'given text input (1,349 in this case). Once the script has ' +
        'reduced the book to a list of sentences, we then transform ' +
        'those sentences into a number representing the number of words ' +
        'in a sentence. The previous sentence, for example, would be ' +
        'represented by 28 (28 words). We then draw a path using Python ' +
        'and SVG. Each straight line represents a sentence in the book - ' +
        'and its length is determined by how many words are in the sentence. ' +
        'At the end of each sentence, the path turns left 90 degrees.');
    const sentence_lengths = Util.getSplitParse(text, {words: ['script'], color: '#fff'}, '#000');
    expect(sentence_lengths.length).to.equal(6);
    expect(sentence_lengths[0].color).to.equal('#fff');
    expect(sentence_lengths[0].length).to.equal(16);
    expect(sentence_lengths[2].color).to.equal('#000');
    expect(sentence_lengths[2].length).to.equal(12)
  });
});

