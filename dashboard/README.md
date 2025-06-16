# Daily Bench Dashboard

A simple static website for visualizing model performance data from the daily-bench benchmarking system.

## Quick Start

### Local Testing

**Option 1: Open directly in browser**
```bash
# Just open the HTML file
open index.html  # macOS
# or double-click index.html in file explorer
```

**Option 2: Use Python's built-in server**
```bash
cd dashboard
python -m http.server 8000
# Then open http://localhost:8000
```

**Option 3: Use the included server script**
```bash
cd dashboard
python serve.py
# Opens automatically in browser at http://localhost:8000
```

### Data Setup

1. **Automatic**: Run `daily-bench extract` from the project root - it will automatically copy the CSV to `dashboard/benchmark_summary.csv`

2. **Manual**: Copy your CSV file to `dashboard/benchmark_summary.csv`

## GitHub Pages Deployment

### Method 1: Simple Upload
1. Copy the `dashboard` folder contents to your GitHub repo
2. Go to Settings → Pages → Select source branch
3. Your site will be at `https://username.github.io/repo-name`

### Method 2: Subdirectory
1. Keep dashboard in a subfolder
2. Set GitHub Pages source to the `dashboard` folder
3. Your site will be at `https://username.github.io/repo-name`

### Method 3: Automated (with GitHub Actions)
Create `.github/workflows/dashboard.yml`:
```yaml
name: Deploy Dashboard
on:
  push:
    paths: ['results/**', 'dashboard/**']

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Copy results to dashboard
        run: cp results/benchmark_summary.csv dashboard/
      - name: Deploy to GitHub Pages
        uses: peaceiris/actions-gh-pages@v3
        with:
          github_token: ${{ secrets.GITHUB_TOKEN }}
          publish_dir: dashboard
```

## Files

- `index.html` - Main dashboard page
- `style.css` - Styling
- `script.js` - JavaScript functionality
- `serve.py` - Simple development server
- `benchmark_summary.csv` - Your data (created automatically by `daily-bench extract`)

That's it! No build process, no dependencies, just open and use.
