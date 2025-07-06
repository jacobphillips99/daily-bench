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
# From the project root, choose ONE of the following:
python dashboard/serve.py      # if your virtual environment is activated
uv run dashboard/serve.py      # if you prefer not to activate the venv
# The dashboard will open automatically at http://localhost:8000
```

### Data Setup

1. **Automatic**: Run `daily-bench extract` from the project root - it will automatically copy the CSV to `dashboard/benchmark_summary.csv`

2. **Manual**: Copy your CSV file to `dashboard/benchmark_summary.csv`

## GitHub Pages Deployment

Publishing the dashboard is automated for you!
The repository already includes a GitHub Actions workflow at
`.github/workflows/benchmark-and-deploy.yml` that:

1. Runs the scheduled (or manual) benchmarks.
2. Copies the generated `benchmark_summary.csv` into `dashboard/`.
3. Deploys the site to GitHub Pages.

To enable it, open your repository **Settings → Pages** and set the source to
**GitHub Actions**. Commit your changes and the workflow will handle the rest.

Prefer manual deployment? Just copy the `dashboard/` folder (including
`benchmark_summary.csv`) to the branch you've configured for Pages.

## Files

- `index.html` - Main dashboard page
- `style.css` - Styling
- `script.js` - JavaScript functionality
- `serve.py` - Simple development server
- `benchmark_summary.csv` - Your data (created automatically by `daily-bench extract`)

That's it! No build process, no dependencies, just open and use.
