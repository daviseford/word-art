const expect = require('chai').expect;
const http = require('http');
const path = require('path');

const { createServer, resolveRequestPath } = require('../serve');


describe('local static server', function () {
  const distDir = path.join(__dirname, '..', 'dist');

  it('maps the root and asset URLs inside dist', function () {
    expect(resolveRequestPath('/', distDir)).to.equal(path.join(distDir, 'index.html'));
    expect(resolveRequestPath('/app.bundle.js?cache=1', distDir)).to.equal(path.join(distDir, 'app.bundle.js'));
  });

  it('rejects encoded path traversal and malformed URLs', function () {
    expect(resolveRequestPath('/%2e%2e/package.json', distDir)).to.equal(null);
    expect(resolveRequestPath('/%not-valid', distDir)).to.equal(null);
  });

  it('serves the built application', function (done) {
    const server = createServer({ distDir });

    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      http.get(`http://127.0.0.1:${address.port}/`, response => {
        let body = '';
        response.setEncoding('utf8');
        response.on('data', chunk => { body += chunk; });
        response.on('end', () => {
          server.close(() => {
            expect(response.statusCode).to.equal(200);
            expect(response.headers['content-type']).to.contain('text/html');
            expect(body).to.contain('<title>Word Art Generator</title>');
            done();
          });
        });
      }).on('error', error => server.close(() => done(error)));
    });
  });

  it('handles HEAD, missing files, and unsupported methods intentionally', function (done) {
    const server = createServer({ distDir });
    const cases = [
      { path: '/', method: 'HEAD', status: 200, body: '' },
      { path: '/missing.js', method: 'GET', status: 404, body: 'Not Found' },
      { path: '/', method: 'POST', status: 405, body: 'Method Not Allowed' },
    ];

    server.listen(0, '127.0.0.1', () => {
      const runNext = () => {
        const current = cases.shift();
        if (!current) {
          server.close(done);
          return;
        }

        const request = http.request({
          hostname: '127.0.0.1',
          port: server.address().port,
          path: current.path,
          method: current.method,
        }, response => {
          let body = '';
          response.setEncoding('utf8');
          response.on('data', chunk => { body += chunk; });
          response.on('end', () => {
            expect(response.statusCode).to.equal(current.status);
            expect(body).to.equal(current.body);
            runNext();
          });
        });
        request.on('error', error => server.close(() => done(error)));
        request.end();
      };

      runNext();
    });
  });
});
