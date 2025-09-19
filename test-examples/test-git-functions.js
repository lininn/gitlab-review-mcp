#!/usr/bin/env node

/**
 * Test script for the new Git-related MCP tools
 * This script demonstrates how to use get_current_branch and get_project_info
 */

import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Path to the built MCP server
const serverPath = join(__dirname, '../dist/index.js');

function testGitFunctions() {
  console.log('🧪 Testing Git-related MCP tools...\n');

  const server = spawn('node', [serverPath], {
    stdio: ['pipe', 'pipe', 'pipe'],
  });

  let serverReady = false;
  let testCount = 0;

  server.stdout.on('data', (data) => {
    const response = data.toString();
    
    try {
      const parsed = JSON.parse(response);
      
      if (!serverReady && parsed.result && parsed.result.tools) {
        console.log('✅ Server started successfully');
        const tools = parsed.result.tools;
        
        // Check if new tools are available
        const gitTools = tools.filter(t => 
          t.name === 'get_current_branch' || t.name === 'get_project_info'
        );
        
        console.log(`\n🔍 Found ${gitTools.length} Git tools:`);
        gitTools.forEach(tool => {
          console.log(`  🆕 ${tool.name}: ${tool.description}`);
        });
        
        serverReady = true;
        runTests();
      } else if (parsed.result && testCount > 0) {
        console.log(`\n📋 Test ${testCount} Result:`);
        console.log(JSON.stringify(parsed.result, null, 2));
      }
    } catch (error) {
      // Ignore JSON parsing errors for non-JSON output
    }
  });

  server.stderr.on('data', (data) => {
    console.error('❌ Server error:', data.toString());
  });

  server.on('close', (code) => {
    console.log(`\n🏁 Server process exited with code ${code}`);
  });

  function runTests() {
    // Test 1: Get current branch info
    setTimeout(() => {
      testCount++;
      console.log('\n🔍 Test 1: Getting current branch info...');
      const getCurrentBranchRequest = {
        jsonrpc: '2.0',
        id: testCount + 1,
        method: 'tools/call',
        params: {
          name: 'get_current_branch',
          arguments: {
            workingDirectory: process.cwd()
          }
        }
      };
      
      server.stdin.write(JSON.stringify(getCurrentBranchRequest) + '\n');
    }, 1000);

    // Test 2: Get project info
    setTimeout(() => {
      testCount++;
      console.log('\n🔍 Test 2: Getting project info...');
      const getProjectInfoRequest = {
        jsonrpc: '2.0',
        id: testCount + 1,
        method: 'tools/call',
        params: {
          name: 'get_project_info',
          arguments: {
            workingDirectory: process.cwd(),
            remoteName: 'origin'
          }
        }
      };
      
      server.stdin.write(JSON.stringify(getProjectInfoRequest) + '\n');
    }, 3000);

    // Test 3: Get project info with different remote
    setTimeout(() => {
      testCount++;
      console.log('\n🔍 Test 3: Getting project info with upstream remote...');
      const getProjectInfoUpstreamRequest = {
        jsonrpc: '2.0',
        id: testCount + 1,
        method: 'tools/call',
        params: {
          name: 'get_project_info',
          arguments: {
            workingDirectory: process.cwd(),
            remoteName: 'upstream'
          }
        }
      };
      
      server.stdin.write(JSON.stringify(getProjectInfoUpstreamRequest) + '\n');
    }, 5000);

    // Cleanup after tests
    setTimeout(() => {
      console.log('\n🎯 Git tests completed! Shutting down server...');
      server.kill();
    }, 8000);
  }

  // Initial request to list tools
  const listToolsRequest = {
    jsonrpc: '2.0',
    id: 1,
    method: 'tools/list',
    params: {}
  };
  
  server.stdin.write(JSON.stringify(listToolsRequest) + '\n');
}

// Run the test
testGitFunctions();
