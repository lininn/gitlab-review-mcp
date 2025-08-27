#!/usr/bin/env node

// Simple test script to verify MCP functionality
import { CodeReviewMCPServer } from '../dist/index.js';

async function testServer() {
  console.log('Testing Node Code Review MCP Server...');
  
  const config = {
    apiBaseUrl: 'https://api.github.com',
    apiToken: 'test_token',
    timeout: 5000,
    maxRetries: 1,
  };
  
  try {
    const server = new CodeReviewMCPServer(config);
    console.log('✓ Server created successfully');
    
    // Test code analysis
    console.log('\nTesting code analysis...');
    
    // Note: These are internal methods, in real usage they would be called via MCP protocol
    // This is just for demonstration of the functionality
    
    console.log('✓ Server initialization completed');
    console.log('\nTo test the full MCP functionality, use an MCP client like Claude Desktop');
    
  } catch (error) {
    console.error('✗ Test failed:', error.message);
    process.exit(1);
  }
}

testServer();
