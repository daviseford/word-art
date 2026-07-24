'use strict';

const WordArtGallery = require('./aws-photo-gallery');

const start = () => WordArtGallery.init();

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', start);
} else {
  start();
}
