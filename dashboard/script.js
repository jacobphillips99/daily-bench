// Global variables
let allData = [];
let filteredData = [];
let isDataLoaded = false;

// DOM elements
const elements = {
    status: document.getElementById('status'),
    modelSelect: document.getElementById('modelSelect'),
    scenarioSelect: document.getElementById('scenarioSelect'),
    metricSelect: document.getElementById('metricSelect'),
    splitSelect: document.getElementById('splitSelect'),
    refreshBtn: document.getElementById('refreshBtn'),
    rowLimitSelect: document.getElementById('rowLimitSelect'),
    dashboard: document.querySelector('.dashboard'),
    lastUpdated: document.getElementById('lastUpdated')
};

// Initialize the application
document.addEventListener('DOMContentLoaded', function() {
    setupEventListeners();
    loadDefaultData();
});

function setupEventListeners() {
    elements.refreshBtn.addEventListener('click', loadDefaultData);
    
    // Filter change listeners
    elements.modelSelect.addEventListener('change', applyFilters);
    elements.scenarioSelect.addEventListener('change', applyFilters);
    elements.metricSelect.addEventListener('change', applyFilters);
    elements.splitSelect.addEventListener('change', applyFilters);
    elements.rowLimitSelect.addEventListener('change', updateDataTable);
}

function setStatus(message, type = 'info') {
    elements.status.innerHTML = message;
    elements.status.className = `status ${type}`;
}

function setLoading(isLoading) {
    if (isLoading) {
        setStatus('<span class="loading">Loading data...</span>', 'info');
        elements.dashboard.classList.remove('visible');
    }
}

async function loadDefaultData() {
    setLoading(true);
    
    try {
        // Try to load from the original results directory first
        const response = await fetch('../results/benchmark_summary.csv');
        if (response.ok) {
            const csvText = await response.text();
            processCSVData(csvText);
            setStatus('Data loaded successfully from results/benchmark_summary.csv', 'success');
        } else {
            throw new Error('CSV file not found in results directory');
        }
    } catch (error) {
        console.log('Could not load CSV from results directory:', error.message);
        
        // Fallback to local copy in dashboard directory
        try {
            const response = await fetch('benchmark_summary.csv');
            if (response.ok) {
                const csvText = await response.text();
                processCSVData(csvText);
                setStatus('Data loaded successfully from dashboard/benchmark_summary.csv (local copy)', 'success');
            } else {
                throw new Error('No CSV file found');
            }
        } catch (fallbackError) {
            console.log('Could not load local CSV either:', fallbackError.message);
            setStatus('No benchmark data found. Run "daily-bench extract" to generate the CSV file in results/, or copy it to the dashboard directory.', 'error');
            elements.dashboard.classList.remove('visible');
        }
    }
}

function processCSVData(csvText) {
    // Parse CSV using D3
    allData = d3.csvParse(csvText);
    
    // Convert numeric columns
    const numericColumns = ['count', 'sum', 'mean', 'min', 'max', 'std', 'variance', 'p25', 'p50', 'p75', 'p90', 'p95', 'p99'];
    allData.forEach(row => {
        // Parse timestamps
        if (row.run_timestamp) {
            row.run_timestamp = new Date(row.run_timestamp);
        }
        if (row.run_date) {
            row.run_date = new Date(row.run_date);
        }
        
        // Convert numeric columns
        numericColumns.forEach(col => {
            if (row[col] && row[col] !== '') {
                row[col] = +row[col];
            }
        });
    });
    
    isDataLoaded = true;
    updateFilters();
    applyFilters();
    elements.dashboard.classList.add('visible');
    elements.lastUpdated.textContent = new Date().toLocaleString();
}

function updateFilters() {
    // Get unique values for each filter
    const models = [...new Set(allData.map(d => d.model))].filter(Boolean).sort();
    const scenarios = [...new Set(allData.map(d => d.scenario_class))].filter(Boolean).sort();
    const metrics = [...new Set(allData.map(d => d.metric_name))].filter(Boolean).sort();
    const splits = [...new Set(allData.map(d => d.split))].filter(Boolean).sort();
    
    // Update select options
    updateSelectOptions(elements.modelSelect, models);
    updateSelectOptions(elements.scenarioSelect, scenarios);
    updateSelectOptions(elements.metricSelect, metrics);
    updateSelectOptions(elements.splitSelect, splits, true); // true = include "All" option
    
    // Set default selections if available
    if (models.length > 0 && !elements.modelSelect.value) {
        elements.modelSelect.value = models[0];
    }
    if (scenarios.length > 0 && !elements.scenarioSelect.value) {
        elements.scenarioSelect.value = scenarios[0];
    }
    if (metrics.length > 0 && !elements.metricSelect.value) {
        elements.metricSelect.value = metrics[0];
    }
}

function updateSelectOptions(selectElement, options, includeAll = false) {
    const currentValue = selectElement.value;
    selectElement.innerHTML = '';
    
    if (includeAll) {
        selectElement.appendChild(new Option('All splits', ''));
    } else {
        selectElement.appendChild(new Option(`Select ${selectElement.labels[0].textContent.toLowerCase()}...`, ''));
    }
    
    options.forEach(option => {
        selectElement.appendChild(new Option(option, option));
    });
    
    // Restore previous selection if it still exists
    if (options.includes(currentValue)) {
        selectElement.value = currentValue;
    }
}

function applyFilters() {
    if (!isDataLoaded) return;
    
    filteredData = allData.filter(row => {
        if (elements.modelSelect.value && row.model !== elements.modelSelect.value) return false;
        if (elements.scenarioSelect.value && row.scenario_class !== elements.scenarioSelect.value) return false;
        if (elements.metricSelect.value && row.metric_name !== elements.metricSelect.value) return false;
        if (elements.splitSelect.value && row.split !== elements.splitSelect.value) return false;
        return true;
    });
    
    updateVisualizations();
}

function updateVisualizations() {
    updateTimeSeriesChart();
    updateSummaryStats();
    updateComparisonChart();
    updateDataTable();
}

function updateTimeSeriesChart() {
    const chartDiv = document.getElementById('timeSeriesChart');
    
    if (filteredData.length === 0) {
        chartDiv.innerHTML = '<div class="empty-state"><h3>No data to display</h3><p>Please select filters above to view the chart.</p></div>';
        return;
    }
    
    // Group data by run_timestamp and calculate mean for each timestamp
    const timeSeriesData = d3.group(filteredData, d => d.run_timestamp);
    
    const x = [];
    const y = [];
    const text = [];
    
    timeSeriesData.forEach((values, timestamp) => {
        if (timestamp && timestamp !== 'null') {
            const meanValue = d3.mean(values, d => d.mean);
            if (meanValue !== undefined && meanValue !== null) {
                x.push(timestamp);
                y.push(meanValue);
                text.push(`${values.length} data points<br>Mean: ${meanValue.toFixed(4)}`);
            }
        }
    });
    
    const trace = {
        x: x,
        y: y,
        text: text,
        mode: 'lines+markers',
        type: 'scatter',
        name: 'Performance',
        line: { color: '#667eea', width: 3 },
        marker: { color: '#667eea', size: 8 }
    };
    
    const layout = {
        title: {
            text: `${elements.metricSelect.value || 'Metric'} over Time`,
            x: 0.5,
            font: { size: 16 }
        },
        xaxis: { 
            title: 'Date',
            type: 'date'
        },
        yaxis: { 
            title: elements.metricSelect.value || 'Value'
        },
        margin: { t: 50, r: 50, b: 50, l: 80 },
        plot_bgcolor: '#f8f9fa',
        paper_bgcolor: 'white'
    };
    
    const config = {
        responsive: true,
        displayModeBar: true,
        modeBarButtonsToRemove: ['pan2d', 'lasso2d', 'select2d']
    };
    
    Plotly.newPlot(chartDiv, [trace], layout, config);
}

function updateSummaryStats() {
    const statsDiv = document.getElementById('summaryStats');
    
    if (filteredData.length === 0) {
        statsDiv.innerHTML = '<div class="empty-state"><h3>No data available</h3><p>Please select filters to view statistics.</p></div>';
        return;
    }
    
    // Calculate statistics
    const values = filteredData.map(d => d.mean).filter(v => v !== undefined && v !== null && !isNaN(v));
    const uniqueRuns = new Set(filteredData.map(d => d.run_id || d.run)).size;
    const dateRange = d3.extent(filteredData.map(d => d.run_timestamp)).filter(d => d);
    
    let statsHtml = '<div class="stats-grid">';
    
    if (values.length > 0) {
        const mean = d3.mean(values);
        const latest = values[values.length - 1];
        const trend = values.length > 1 ? (latest > values[0] ? 'up' : latest < values[0] ? 'down' : 'stable') : 'stable';
        
        statsHtml += `
            <div class="stat-card">
                <div class="stat-value trend-${trend}">${latest.toFixed(4)}</div>
                <div class="stat-label">Latest Value</div>
            </div>
            <div class="stat-card">
                <div class="stat-value">${mean.toFixed(4)}</div>
                <div class="stat-label">Average</div>
            </div>
            <div class="stat-card">
                <div class="stat-value">${d3.min(values).toFixed(4)}</div>
                <div class="stat-label">Minimum</div>
            </div>
            <div class="stat-card">
                <div class="stat-value">${d3.max(values).toFixed(4)}</div>
                <div class="stat-label">Maximum</div>
            </div>
        `;
    }
    
    statsHtml += `
        <div class="stat-card">
            <div class="stat-value">${uniqueRuns}</div>
            <div class="stat-label">Total Runs</div>
        </div>
        <div class="stat-card">
            <div class="stat-value">${filteredData.length}</div>
            <div class="stat-label">Data Points</div>
        </div>
    `;
    
    if (dateRange.length === 2 && dateRange[0] && dateRange[1]) {
        const daysDiff = Math.ceil((dateRange[1] - dateRange[0]) / (1000 * 60 * 60 * 24));
        statsHtml += `
            <div class="stat-card">
                <div class="stat-value">${daysDiff}</div>
                <div class="stat-label">Days Tracked</div>
            </div>
        `;
    }
    
    statsHtml += '</div>';
    
    statsDiv.innerHTML = statsHtml;
}

function updateComparisonChart() {
    const chartDiv = document.getElementById('comparisonChart');
    
    if (filteredData.length === 0) {
        chartDiv.innerHTML = '<div class="empty-state"><h3>No data to compare</h3><p>Please select filters to view the comparison.</p></div>';
        return;
    }
    
    // Get the last 5 runs for comparison
    const runGroups = d3.group(filteredData, d => d.run_id || d.run);
    const sortedRuns = Array.from(runGroups.entries())
        .sort((a, b) => {
            const aDate = d3.max(a[1], d => d.run_timestamp) || new Date(0);
            const bDate = d3.max(b[1], d => d.run_timestamp) || new Date(0);
            return aDate - bDate;
        })
        .slice(-5); // Last 5 runs
    
    const x = [];
    const y = [];
    const text = [];
    
    sortedRuns.forEach(([runId, runData]) => {
        const meanValue = d3.mean(runData, d => d.mean);
        const runDate = d3.max(runData, d => d.run_timestamp);
        
        if (meanValue !== undefined && meanValue !== null) {
            x.push(runDate ? runDate.toLocaleDateString() : runId);
            y.push(meanValue);
            text.push(`Run: ${runId}<br>Value: ${meanValue.toFixed(4)}<br>Data points: ${runData.length}`);
        }
    });
    
    const trace = {
        x: x,
        y: y,
        text: text,
        type: 'bar',
        name: 'Recent Performance',
        marker: { 
            color: '#48bb78',
            opacity: 0.8,
            line: { color: '#38a169', width: 1 }
        }
    };
    
    const layout = {
        title: {
            text: 'Recent Performance Comparison',
            x: 0.5,
            font: { size: 16 }
        },
        xaxis: { 
            title: 'Run Date'
        },
        yaxis: { 
            title: elements.metricSelect.value || 'Value'
        },
        margin: { t: 50, r: 50, b: 100, l: 80 },
        plot_bgcolor: '#f8f9fa',
        paper_bgcolor: 'white'
    };
    
    const config = {
        responsive: true,
        displayModeBar: true,
        modeBarButtonsToRemove: ['pan2d', 'lasso2d', 'select2d']
    };
    
    Plotly.newPlot(chartDiv, [trace], layout, config);
}

function updateDataTable() {
    const tableDiv = document.getElementById('dataTable');
    const limit = parseInt(elements.rowLimitSelect.value) || filteredData.length;
    
    if (filteredData.length === 0) {
        tableDiv.innerHTML = '<div class="empty-state"><h3>No data to display</h3><p>Please select filters to view the data table.</p></div>';
        return;
    }
    
    // Sort by timestamp descending and limit rows
    const sortedData = [...filteredData]
        .sort((a, b) => {
            const aTime = a.run_timestamp || new Date(0);
            const bTime = b.run_timestamp || new Date(0);
            return bTime - aTime;
        })
        .slice(0, limit);
    
    // Define columns to show
    const columns = [
        { key: 'model', label: 'Model' },
        { key: 'scenario_class', label: 'Scenario' },
        { key: 'metric_name', label: 'Metric' },
        { key: 'split', label: 'Split' },
        { key: 'run_timestamp', label: 'Date & Time', format: (d) => d ? new Date(d).toLocaleString() : '-' },
        { key: 'mean', label: 'Mean', numeric: true, format: (d) => d !== undefined && d !== null ? d.toFixed(4) : '-' },
        { key: 'count', label: 'Count', numeric: true },
        { key: 'std', label: 'Std Dev', numeric: true, format: (d) => d !== undefined && d !== null ? d.toFixed(4) : '-' }
    ];
    
    let tableHtml = '<div class="data-table"><table><thead><tr>';
    columns.forEach(col => {
        tableHtml += `<th>${col.label}</th>`;
    });
    tableHtml += '</tr></thead><tbody>';
    
    sortedData.forEach(row => {
        tableHtml += '<tr>';
        columns.forEach(col => {
            const value = row[col.key];
            const formatted = col.format ? col.format(value) : (value || '-');
            const className = col.numeric ? 'numeric' : '';
            tableHtml += `<td class="${className}">${formatted}</td>`;
        });
        tableHtml += '</tr>';
    });
    
    tableHtml += '</tbody></table></div>';
    
    tableDiv.innerHTML = tableHtml;
} 