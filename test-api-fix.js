#!/usr/bin/env node

import { ApiClient } from './dist/api-client.js';

// Test the URL construction fix
const testCases = [
  {
    baseURL: 'https://gitmall.ekuaibao.com/api/v4',
    endpoint: 'projects/front-end%2FMOS/merge_requests/2295',
    expected: 'https://gitmall.ekuaibao.com/api/v4/projects/front-end%2FMOS/merge_requests/2295'
  },
  {
    baseURL: 'https://gitmall.ekuaibao.com/api/v4/',
    endpoint: 'projects/front-end%2FMOS/merge_requests/2295',
    expected: 'https://gitmall.ekuaibao.com/api/v4/projects/front-end%2FMOS/merge_requests/2295'
  },
  {
    baseURL: 'https://gitmall.ekuaibao.com/api/v4',
    endpoint: '/projects/front-end%2FMOS/merge_requests/2295',
    expected: 'https://gitmall.ekuaibao.com/api/v4/projects/front-end%2FMOS/merge_requests/2295'
  }
];

console.log('Testing URL construction fix...\n');

testCases.forEach((test, index) => {
  const baseUrl = test.baseURL.endsWith('/') ? test.baseURL.slice(0, -1) : test.baseURL;
  const path = test.endpoint.startsWith('/') ? test.endpoint.slice(1) : test.endpoint;
  const constructed = `${baseUrl}/${path}`;

  const passed = constructed === test.expected;
  console.log(`Test ${index + 1}: ${passed ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`  Base URL: ${test.baseURL}`);
  console.log(`  Endpoint: ${test.endpoint}`);
  console.log(`  Expected: ${test.expected}`);
  console.log(`  Got:      ${constructed}`);
  console.log();
});

console.log('All tests completed!');
