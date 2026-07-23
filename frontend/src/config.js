const Config = {
  version: 2,
  min_sentence_count: 20,
  default_preset: 'letterpress',
  generate_svg_endpoint: `https://gy2aa8c57c.execute-api.us-east-1.amazonaws.com/dev/`,
  generate_png_endpoint: `https://x9m83oo0kd.execute-api.us-east-1.amazonaws.com/dev/`,
  svg_bucket: `https://s3.amazonaws.com/word-art-svgs/`,
  png_bucket: `https://s3.amazonaws.com/word-art-pngs/`,
};

module.exports = Config;
