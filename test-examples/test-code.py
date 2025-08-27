# Test Python code for code analysis
import os
import sys
import unused_module

def main():
    # TODO: Add proper error handling
    print("This should use logging instead")
    
    # Very long line that exceeds PEP 8 recommendations and should be refactored into smaller parts
    very_long_variable_name = "This is a very long string that demonstrates a line length issue in Python code"
    
    # Multiple print statements
    print("Debug 1")
    print("Debug 2")
    print("Debug 3")
    
    # FIXME: This function is too complex
    if True:
        if True:
            if True:
                print("Deeply nested code")
    
    # Trailing whitespace    
    result = "value"    
    
    return result

if __name__ == "__main__":
    main()
