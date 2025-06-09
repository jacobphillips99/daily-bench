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

class DashboardHandler(http.server.SimpleHTTPRequestHandler):
    """Custom handler to serve dashboard files and redirect root to dashboard."""
    
    def end_headers(self):
        # Add CORS headers for local development
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        super().end_headers()
    
    def do_GET(self):
        # Redirect root to dashboard
        if self.path == '/':
            self.path = '/dashboard/'
        elif self.path == '/dashboard' or self.path == '/dashboard/':
            self.path = '/dashboard/index.html'
        
        return super().do_GET()

def main():
    """Start the development server."""
    
    # Get the project root (parent of dashboard directory)
    script_dir = Path(__file__).parent
    project_root = script_dir.parent
    os.chdir(project_root)
    
    # Check if required files exist in the dashboard directory
    dashboard_dir = project_root / 'dashboard'
    required_files = ['index.html', 'style.css', 'script.js']
    missing_files = [f for f in required_files if not (dashboard_dir / f).exists()]
    
    if missing_files:
        print(f"Error: Missing required files in dashboard/: {', '.join(missing_files)}")
        print("Make sure the dashboard files exist.")
        sys.exit(1)
    
    # Create results directory if it doesn't exist
    results_dir = project_root / 'results'
    results_dir.mkdir(exist_ok=True)
    
    # Check for sample data
    sample_csv = results_dir / 'benchmark_summary.csv'
    if sample_csv.exists():
        print(f"✓ Found benchmark data at {sample_csv}")
    else:
        print(f"⚠ No benchmark data found at {sample_csv}")
        print("Run 'daily-bench extract' to generate the data file.")

    try:
        with socketserver.TCPServer(("", PORT), DashboardHandler) as httpd:
            print(f"\nDaily Bench Dashboard development server starting...")
            print(f"Serving at: http://localhost:{PORT}")
            print(f"Dashboard URL: http://localhost:{PORT}/dashboard/")
            print(f"Project root: {project_root}")
            print("\nPress Ctrl+C to stop the server")
            
            # Try to open the browser automatically
            try:
                webbrowser.open(f'http://localhost:{PORT}/dashboard/')
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