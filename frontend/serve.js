const fs = require('fs');
const http = require('http');
const path = require('path');

const DEFAULT_DIST_DIR = path.join(__dirname, 'dist');
const CONTENT_TYPES = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.ico': 'image/x-icon',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
};


const resolveRequestPath = (requestUrl, distDir = DEFAULT_DIST_DIR) => {
  let pathname;

  try {
    pathname = decodeURIComponent((requestUrl || '/').split(/[?#]/)[0]);
  } catch (error) {
    return null;
  }

  const relativePath = pathname === '/'
    ? 'index.html'
    : pathname.replace(/^[/\\]+/, '');
  const root = path.resolve(distDir);
  const filePath = path.resolve(root, relativePath);

  if (!filePath.startsWith(`${root}${path.sep}`)) return null;
  return filePath;
};


const createServer = ({ distDir = DEFAULT_DIST_DIR } = {}) => {
  return http.createServer((request, response) => {
    if (!['GET', 'HEAD'].includes(request.method)) {
      response.writeHead(405, { 'Allow': 'GET, HEAD' });
      response.end('Method Not Allowed');
      return;
    }

    const filePath = resolveRequestPath(request.url, distDir);
    if (!filePath) {
      response.writeHead(400);
      response.end('Bad Request');
      return;
    }

    fs.readFile(filePath, (error, body) => {
      if (error) {
        const status = ['EISDIR', 'ENOENT'].includes(error.code) ? 404 : 500;
        response.writeHead(status);
        response.end(status === 404 ? 'Not Found' : 'Internal Server Error');
        return;
      }

      response.writeHead(200, {
        'Cache-Control': 'no-store',
        'Content-Type': CONTENT_TYPES[path.extname(filePath).toLowerCase()] || 'application/octet-stream',
      });
      response.end(request.method === 'HEAD' ? undefined : body);
    });
  });
};


if (require.main === module) {
  const port = Number(process.env.WORD_ART_PORT || 8080);
  const server = createServer();

  server.listen(port, '127.0.0.1', () => {
    console.log(`Word Art is available at http://127.0.0.1:${port}/`);
  });
}


module.exports = {
  createServer,
  resolveRequestPath,
};
