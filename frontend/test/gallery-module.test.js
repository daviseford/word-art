const Gallery = require('../src/aws-photo-gallery');

const {
  getCanvasPopUrl,
  getPage,
  getPaginationWindow,
  parsePageNumber,
  sortPhotosNewestFirst,
} = Gallery;

const makePhotos = count =>
  Array.from({ length: count }, (_, index) => ({ Key: `${index}.png` }));

describe('gallery pagination module', function () {
  describe('getPage', function () {
    it('renders only the requested page of photos', function () {
      const result = getPage(makePhotos(29), 2, 12);

      expect(result.page).to.equal(2);
      expect(result.pageCount).to.equal(3);
      expect(result.items.map(photo => photo.Key)).to.have.ordered.members([
        '12.png', '13.png', '14.png', '15.png', '16.png', '17.png', '18.png',
        '19.png', '20.png', '21.png', '22.png', '23.png',
      ]);
    });

    it('fills the first page from a larger collection', function () {
      const result = getPage(makePhotos(25), 1, 12);

      expect(result.page).to.equal(1);
      expect(result.pageCount).to.equal(3);
      expect(result.start).to.equal(0);
      expect(result.items).to.have.length(12);
      expect(result.items[0].Key).to.equal('0.png');
    });

    it('clamps pages beyond the collection to the last page', function () {
      const result = getPage(makePhotos(13), 99, 12);

      expect(result.page).to.equal(2);
      expect(result.items.map(photo => photo.Key)).to.have.ordered.members(['12.png']);
    });

    it('clamps zero, negative, and garbage pages to the first page', function () {
      const photos = makePhotos(13);

      expect(getPage(photos, 0, 12).page).to.equal(1);
      expect(getPage(photos, -4, 12).page).to.equal(1);
      expect(getPage(photos, 'wat', 12).page).to.equal(1);
      expect(getPage(photos, undefined, 12).page).to.equal(1);
    });

    it('treats an empty collection as one empty page', function () {
      const result = getPage([], 3, 12);

      expect(result.page).to.equal(1);
      expect(result.pageCount).to.equal(1);
      expect(result.items).to.deep.equal([]);
      expect(result.start).to.equal(0);
    });
  });

  describe('getPaginationWindow', function () {
    it('keeps the current page surrounded mid-range', function () {
      expect(getPaginationWindow(10, 20, 5)).to.have.ordered.members([8, 9, 10, 11, 12]);
    });

    it('clamps the window at the first and last pages', function () {
      expect(getPaginationWindow(1, 20, 5)).to.have.ordered.members([1, 2, 3, 4, 5]);
      expect(getPaginationWindow(20, 20, 5)).to.have.ordered.members([16, 17, 18, 19, 20]);
    });

    it('shrinks to the page count when fewer pages than the window exist', function () {
      expect(getPaginationWindow(2, 3, 5)).to.have.ordered.members([1, 2, 3]);
      expect(getPaginationWindow(1, 1, 5)).to.have.ordered.members([1]);
    });
  });

  describe('parsePageNumber', function () {
    it('accepts a positive integer page parameter', function () {
      expect(parsePageNumber('?page=3')).to.equal(3);
      expect(parsePageNumber('?page=7')).to.equal(7);
    });

    it('falls back to page one for missing or invalid parameters', function () {
      expect(parsePageNumber('')).to.equal(1);
      expect(parsePageNumber(undefined)).to.equal(1);
      expect(parsePageNumber('?page=wat')).to.equal(1);
      expect(parsePageNumber('?page=-2')).to.equal(1);
      expect(parsePageNumber('?page=0')).to.equal(1);
    });
  });

  describe('sortPhotosNewestFirst', function () {
    it('orders photos newest first without mutating the source list', function () {
      const photos = [
        { Key: 'older.png', LastModified: '2025-01-01T00:00:00Z' },
        { Key: 'newer.png', LastModified: '2026-01-01T00:00:00Z' },
        { Key: 'middle.png', LastModified: '2025-06-01T00:00:00Z' },
      ];

      const sorted = sortPhotosNewestFirst(photos);

      expect(sorted.map(photo => photo.Key)).to.have.ordered.members([
        'newer.png', 'middle.png', 'older.png',
      ]);
      expect(photos.map(photo => photo.Key)).to.have.ordered.members([
        'older.png', 'newer.png', 'middle.png',
      ]);
    });
  });

  describe('getCanvasPopUrl', function () {
    it('URL-encodes the image into the CanvasPop pull endpoint', function () {
      const url = getCanvasPopUrl('https://word-art-pngs.s3.amazonaws.com/my art.png');

      expect(url).to.match(/^https:\/\/store\.canvaspop\.com\/api\/pull\?image_url=/);
      expect(url).to.contain(
        'image_url=' + encodeURIComponent('https://word-art-pngs.s3.amazonaws.com/my art.png'),
      );
      expect(url).to.not.contain('my art.png');
      expect(url).to.contain('&access_key=');
    });
  });
});
