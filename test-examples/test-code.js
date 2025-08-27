// Test JavaScript code for code analysis
console.log("This is a debug statement");

var oldVariable = "should use let or const";

function longFunctionNameThatExceedsRecommendedLineLengthAndShouldBeBrokenIntoSmallerParts() {
    // TODO: Refactor this function
    if (true) {
        console.log("Nested console.log");
        eval("dangerous code"); // This is a security issue
    }
}

// Missing return type
function calculateSum(a, b) {
    return a + b;
}

// Arrow function without proper spacing
const arrowFunc = ()=>{
    return "test";
};

// Multiple issues on one line
var x=1;console.log(x);eval("test");

// Trailing whitespace issues    
const test = "value";    

// Very long line that exceeds the maximum recommended line length of 120 characters and should be refactored into smaller parts
const longVariableName = "This is a very long string that demonstrates a line length issue";

// More console statements
console.log("Debug 1");
console.log("Debug 2");
console.log("Debug 3");
