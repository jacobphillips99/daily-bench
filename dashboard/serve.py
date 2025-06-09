#!/usr/bin/env python3
"""
Simple development server for the Daily Bench Dashboard.
Run this script to serve the dashboard locally for testing.
"""

import http.server
import socketserver
import webbrowser
import sys
import os
from pathlib import Path

PORT = 8000

def main():
    """Start the development server."""
    
    # Change to the directory containing this script
    script_dir = Path(__file__).parent
    os.chdir(script_dir)
    
    # Check if required files exist
    required_files = ['index.html', 'style.css', 'script.js']
    missing_files = [f for f in required_files if not Path(f).exists()]
    
    if missing_files:
        print(f"Error: Missing required files: {', '.join(missing_files)}")
        print("Make sure you're running this script from the dashboard directory.")
        sys.exit(1)
    
    # Create results directory if it doesn't exist
    results_dir = Path('results')
    results_dir.mkdir(exist_ok=True)
    
    # Check for sample data
    sample_csv = results_dir / 'benchmark_summary.csv'
    if not sample_csv.exists():
        print(f"Note: No sample data found at {sample_csv}")
        print("You can upload a CSV file using the dashboard interface.")
    
    Handler = http.server.SimpleHTTPRequestHandler
    
    try:
        with socketserver.TCPServer(("", PORT), Handler) as httpd:
            print(f"Daily Bench Dashboard development server starting...")
            print(f"Serving at: http://localhost:{PORT}")
            print(f"Dashboard URL: http://localhost:{PORT}/")
            print(f"Directory: {script_dir}")
            print("\nPress Ctrl+C to stop the server")
            
            # Try to open the browser automatically
            try:
                webbrowser.open(f'http://localhost:{PORT}')
                print("Opening dashboard in your default browser...")
            except Exception:
                print("Could not open browser automatically. Please navigate to the URL above.")
            
            print("\n" + "="*50)
            httpd.serve_forever()
            
    except KeyboardInterrupt:
        print("\nServer stopped by user")
    except OSError as e:
        if e.errno == 48:  # Address already in use
            print(f"Error: Port {PORT} is already in use")
            print("Try stopping other web servers or use a different port")
        else:
            print(f"Error starting server: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main() 