'use strict';

(function (root, factory) {
  var gallery = factory();
  if (typeof module === 'object' && module.exports) module.exports = gallery;
  if (root) {
    root.WordArtGallery = gallery;
    root.viewAlbum = gallery.init;
    root.get_canvaspop_url = gallery.getCanvasPopUrl;
  }
})(typeof window !== 'undefined' ? window : null, function () {
  var BUCKET_URL = 'https://word-art-pngs.s3.amazonaws.com/';
  var PAGE_SIZE = 12;
  var dateFormatter = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' });

  function getPage(items, requestedPage, pageSize) {
    var size = pageSize || PAGE_SIZE;
    var pageCount = Math.max(1, Math.ceil(items.length / size));
    var page = Math.min(Math.max(Number(requestedPage) || 1, 1), pageCount);
    var start = (page - 1) * size;
    return {
      items: items.slice(start, start + size),
      page: page,
      pageCount: pageCount,
      start: start,
    };
  }

  function getPaginationWindow(page, pageCount, visibleCount) {
    var count = Math.min(visibleCount || 5, pageCount);
    var start = Math.max(1, page - Math.floor(count / 2));
    start = Math.min(start, pageCount - count + 1);
    return Array.from({ length: count }, function (_, index) { return start + index; });
  }

  function parsePageNumber(search) {
    var value = new URLSearchParams(search || '').get('page');
    return /^\d+$/.test(value || '') && Number(value) > 0 ? Number(value) : 1;
  }

  function sortPhotosNewestFirst(photos) {
    return photos.slice().sort(function (a, b) {
      return new Date(b.LastModified) - new Date(a.LastModified);
    });
  }

  function xmlText(element, selector) {
    var match = element.querySelector(selector);
    return match ? match.textContent : '';
  }

  async function listAllPhotos(fetchImpl) {
    var request = fetchImpl || fetch;
    var photos = [];
    var continuationToken = null;

    do {
      var params = new URLSearchParams({ 'list-type': '2', 'max-keys': '1000' });
      if (continuationToken) params.set('continuation-token', continuationToken);
      var response = await request(BUCKET_URL + '?' + params.toString());
      if (!response.ok) throw new Error('The gallery could not be loaded right now.');

      var documentNode = new DOMParser().parseFromString(await response.text(), 'application/xml');
      if (documentNode.querySelector('parsererror, Error')) {
        throw new Error('The gallery returned an unreadable response.');
      }
      Array.from(documentNode.querySelectorAll('Contents')).forEach(function (content) {
        var key = xmlText(content, 'Key');
        if (key.toLowerCase().endsWith('.png')) {
          photos.push({ Key: key, LastModified: xmlText(content, 'LastModified') });
        }
      });
      continuationToken = xmlText(documentNode, 'NextContinuationToken') || null;
    } while (continuationToken);

    return sortPhotosNewestFirst(photos);
  }

  function getCanvasPopUrl(url) {
    return 'https://store.canvaspop.com/api/pull?image_url=' + encodeURIComponent(url) +
      '&access_key=15549806e27b7565977dabf10b992dbd';
  }

  function element(tag, className, text) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (text) node.textContent = text;
    return node;
  }

  function photoUrl(key) {
    return BUCKET_URL + key.split('/').map(encodeURIComponent).join('/');
  }

  function createPhotoCard(photo, index) {
    var url = photoUrl(photo.Key);
    var article = element('article', 'gallery-card');
    var mediaLink = element('a', 'gallery-card__media');
    mediaLink.href = url;
    mediaLink.target = '_blank';
    mediaLink.rel = 'noopener';

    var image = element('img', 'gallery-card__image');
    image.src = url;
    image.alt = 'Word Art composition ' + photo.Key.replace(/\.png$/i, '');
    image.loading = index < 3 ? 'eager' : 'lazy';
    image.decoding = 'async';
    mediaLink.appendChild(image);

    var body = element('div', 'gallery-card__body');
    var meta = element('div', 'gallery-card__meta');
    meta.appendChild(element('h3', null, photo.Key.replace(/\.png$/i, '')));
    var time = element('time', null, dateFormatter.format(new Date(photo.LastModified)));
    time.dateTime = photo.LastModified;
    meta.appendChild(time);

    var actions = element('div', 'gallery-card__actions');
    var download = element('a', 'gallery-action', 'Download');
    download.href = url;
    download.download = photo.Key;
    var print = element('a', 'gallery-action gallery-action--quiet', 'Buy a print');
    print.href = getCanvasPopUrl(url);
    print.target = '_blank';
    print.rel = 'noopener';
    actions.append(download, print);
    body.append(meta, actions);
    article.append(mediaLink, body);
    return article;
  }

  function pageButton(label, page, currentPage, disabled, onSelect) {
    var button = element('button', 'pagination__button', label);
    button.type = 'button';
    button.disabled = disabled;
    if (page === currentPage && !disabled) button.setAttribute('aria-current', 'page');
    button.addEventListener('click', function () { onSelect(page); });
    return button;
  }

  function renderPagination(container, page, pageCount, onSelect) {
    container.replaceChildren();
    if (pageCount <= 1) return;
    container.appendChild(pageButton('Previous', page - 1, page, page === 1, onSelect));
    getPaginationWindow(page, pageCount, 5).forEach(function (number) {
      container.appendChild(pageButton(String(number), number, page, false, onSelect));
    });
    container.appendChild(pageButton('Next', page + 1, page, page === pageCount, onSelect));
  }

  function init() {
    var app = document.getElementById('app');
    var pagination = document.getElementById('gallery-pagination');
    var status = document.getElementById('gallery-status');
    if (!app || !pagination || !status) return;

    app.innerHTML = '<div class="gallery-loading" role="status">Loading the latest compositions…</div>';
    listAllPhotos().then(function (photos) {
      function selectPage(requestedPage, shouldScroll) {
        var pageData = getPage(photos, requestedPage, PAGE_SIZE);
        var grid = element('div', 'gallery-grid');
        pageData.items.forEach(function (photo, index) {
          grid.appendChild(createPhotoCard(photo, index));
        });
        app.replaceChildren(grid);
        renderPagination(pagination, pageData.page, pageData.pageCount, function (page) {
          selectPage(page, true);
        });

        var first = photos.length ? pageData.start + 1 : 0;
        var last = pageData.start + pageData.items.length;
        status.textContent = 'Showing ' + first + '–' + last + ' of ' + photos.length + ' compositions';
        var url = new URL(window.location.href);
        url.searchParams.set('page', pageData.page);
        window.history.replaceState({}, '', url);
        if (shouldScroll) {
          document.getElementById('gallery').scrollIntoView({
            behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
          });
        }
      }

      selectPage(parsePageNumber(window.location.search), false);
    }).catch(function (error) {
      app.innerHTML = '<p class="gallery-error">' + error.message + ' Please try again shortly.</p>';
      status.textContent = 'Gallery unavailable';
    });
  }

  return {
    getCanvasPopUrl: getCanvasPopUrl,
    getPage: getPage,
    getPaginationWindow: getPaginationWindow,
    init: init,
    listAllPhotos: listAllPhotos,
    parsePageNumber: parsePageNumber,
    sortPhotosNewestFirst: sortPhotosNewestFirst,
  };
});
