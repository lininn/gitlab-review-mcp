// Test JavaScript code for code analysis
import fs from 'fs'; // Unused import
import path from 'path';

function main() {
    // TODO: Add proper error handling
    console.log("This should use a proper logger");

    // Very long line that exceeds common recommendations and should be refactored
    const veryLongVariableName = "This is a very long string that demonstrates a line length issue in JavaScript code";

    // Multiple console.log statements
    console.log("Debug 1");
    console.log("Debug 2");
    console.log("Debug 3");

    // FIXME: This function is too complex
    if (true) {
        if (true) {
            if (true) {
                console.log("Deeply nested code");
            }
        }
    }

    // Trailing whitespace   
    const result = "value";   

    return result;
}

main();
