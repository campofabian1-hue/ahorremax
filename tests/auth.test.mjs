import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { authDomainForHost } from '../app/firebase-config.mjs';

test('OAuth handler uses the same origin where it is available', () => {
  assert.equal(authDomainForHost('fcfinanzas.com'), 'fcfinanzas.com');
  assert.equal(authDomainForHost('ahorremax-c1e48.web.app'), 'ahorremax-c1e48.firebaseapp.com');
  assert.equal(authDomainForHost('campofabian1-hue.github.io'), 'ahorremax-c1e48.firebaseapp.com');
});

test('secondary publication URLs send visitors to the tested site', () => {
  const html = readFileSync(new URL('../app/index.html', import.meta.url), 'utf8');
  assert.match(html, /campofabian1-hue\.github\.io/);
  assert.match(html, /ahorremax-c1e48\.web\.app/);
  assert.match(html, /location\.replace\('https:\/\/fcfinanzas\.com\/app\/ahorremax\/'\)/);
});

function redirectMode(hostname, authDomain, userAgent, installed = false) {
  const source = readFileSync(new URL('../app/cloud.mjs', import.meta.url), 'utf8')
    .replace(/^import .*\n/m, '')
    .replace(/^export \{.*\};\n/m, '')
    .replace(/^export /gm, '');
  const context = {
    firebaseConfig: { apiKey: 'test', projectId: 'test', authDomain },
    providersReady: { google: true, facebook: false },
    webPushVapidKey: '',
    location: { protocol: 'https:', hostname },
    window: { matchMedia: () => ({ matches: installed }) },
    navigator: { userAgent, platform: '', maxTouchPoints: 0, standalone: false },
  };
  runInNewContext(source + '\nglobalThis.result=usesRedirect();', context);
  return context.result;
}

test('login redirects when the OAuth handler is on the same origin', () => {
  assert.equal(redirectMode('fcfinanzas.com', 'fcfinanzas.com', 'iPhone'), true);
  assert.equal(redirectMode('ahorremax-c1e48.web.app', 'ahorremax-c1e48.firebaseapp.com', 'Android', true), false);
  assert.equal(redirectMode('fcfinanzas.com', 'fcfinanzas.com', 'Desktop'), true);
  assert.equal(redirectMode('campofabian1-hue.github.io', 'ahorremax-c1e48.firebaseapp.com', 'iPhone'), false);
});
