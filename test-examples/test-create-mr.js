#!/usr/bin/env node

/**
 * Test script for the create_merge_request MCP tool
 * This script demonstrates how to use the new MR creation functionality
 */

import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Path to the built MCP server
const serverPath = join(__dirname, '../dist/index.js');

function testCreateMergeRequest() {
  console.log('🧪 Testing create_merge_request MCP tool...\n');

  const server = spawn('node', [serverPath], {
    stdio: ['pipe', 'pipe', 'pipe'],
    env: {
      ...process.env,
      API_BASE_URL: process.env.API_BASE_URL || 'https://gitlab.com/api/v4',
      API_TOKEN: process.env.API_TOKEN || 'test-token',
    }
  });

  let serverReady = false;

  server.stdout.on('data', (data) => {
    const response = data.toString();
    console.log('📤 Server response:', response);
    
    if (!serverReady) {
      console.log('✅ Server started successfully\n');
      serverReady = true;
      
      // Test 1: List available tools
      console.log('🔍 Test 1: Listing available tools...');
      const listToolsRequest = {
        jsonrpc: '2.0',
        id: 1,
        method: 'tools/list',
        params: {}
      };
      
      server.stdin.write(JSON.stringify(listToolsRequest) + '\n');
    }
  });

  server.stderr.on('data', (data) => {
    console.error('❌ Server error:', data.toString());
  });

  server.on('close', (code) => {
    console.log(`🏁 Server process exited with code ${code}`);
  });

  // Test 2: Create merge request with minimal parameters
  setTimeout(() => {
    if (serverReady) {
      console.log('\n🔍 Test 2: Creating MR with minimal parameters...');
      const createMRRequest = {
        jsonrpc: '2.0',
        id: 2,
        method: 'tools/call',
        params: {
          name: 'create_merge_request',
          arguments: {
            projectId: 'example/test-project',
            sourceBranch: 'feature/test-branch'
          }
        }
      };
      
      server.stdin.write(JSON.stringify(createMRRequest) + '\n');
    }
  }, 2000);

  // Test 3: Create merge request with full parameters
  setTimeout(() => {
    if (serverReady) {
      console.log('\n🔍 Test 3: Creating MR with full parameters...');
      const createMRFullRequest = {
        jsonrpc: '2.0',
        id: 3,
        method: 'tools/call',
        params: {
          name: 'create_merge_request',
          arguments: {
            projectId: '12345',
            sourceBranch: 'bugfix/fix-login-issue',
            targetBranch: 'develop',
            title: 'fix: Resolve login authentication bug',
            description: 'This MR fixes the issue where users could not log in with special characters in their passwords.',
            assigneeId: 123,
            reviewerIds: [456, 789],
            deleteSourceBranch: true,
            squash: false
          }
        }
      };
      
      server.stdin.write(JSON.stringify(createMRFullRequest) + '\n');
    }
  }, 4000);

  // Test 4: Test title generation for different branch types
  setTimeout(() => {
    if (serverReady) {
      console.log('\n🔍 Test 4: Testing different branch naming patterns...');
      
      const branchTests = [
        'feature/user-dashboard',
        'feat/api-improvements',
        'bugfix/security-patch', 
        'hotfix/critical-bug',
        'docs/update-readme',
        'refactor/clean-utils'
      ];

      branchTests.forEach((branch, index) => {
        setTimeout(() => {
          const testRequest = {
            jsonrpc: '2.0',
            id: 4 + index,
            method: 'tools/call',
            params: {
              name: 'create_merge_request',
              arguments: {
                projectId: 'test/branch-naming',
                sourceBranch: branch
              }
            }
          };
          
          console.log(`   Testing branch: ${branch}`);
          server.stdin.write(JSON.stringify(testRequest) + '\n');
        }, index * 1000);
      });
    }
  }, 6000);

  // Cleanup after tests
  setTimeout(() => {
    console.log('\n🎯 Test completed! Shutting down server...');
    server.kill();
  }, 15000);
}

// Check if API_TOKEN is set
if (!process.env.API_TOKEN) {
  console.log('⚠️  Warning: API_TOKEN not set. Tests will use mock token.');
  console.log('💡 Set API_TOKEN environment variable for actual GitLab API testing.\n');
}

// Run the test
testCreateMergeRequest();
