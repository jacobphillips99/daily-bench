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
        // First try to load from the dashboard directory (for deployed GitHub Pages)
        let response = await fetch('./benchmark_summary.csv');
        let source = 'dashboard/benchmark_summary.csv';
        
        // If that fails, try from the results directory (for local development)
        if (!response.ok) {
            response = await fetch('/results/benchmark_summary.csv');
            source = 'results/benchmark_summary.csv';
        }
        
        if (response.ok) {
            const csvText = await response.text();
            processCSVData(csvText);
            setStatus(`Data loaded successfully from ${source}`, 'success');
        } else {
            throw new Error('CSV file not found in either dashboard or results directory');
        }
    } catch (error) {
        console.log('Could not load CSV from either location:', error.message);
        setStatus('No benchmark data found. Run "daily-bench extract" to generate the CSV file in results/.', 'error');
        elements.dashboard.classList.remove('visible');
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
    // Don't set a default model - leave empty to show all models
    if (scenarios.length > 0 && !elements.scenarioSelect.value) {
        elements.scenarioSelect.value = '__AVERAGE__'; // Default to averaging mode
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
    
    // Add average option for scenario select
    if (selectElement.id === 'scenarioSelect') {
        selectElement.appendChild(new Option('📊 Average across all scenarios', '__AVERAGE__'));
    }
    
    options.forEach(option => {
        selectElement.appendChild(new Option(option, option));
    });
    
    // Restore previous selection if it still exists
    if (options.includes(currentValue) || currentValue === '__AVERAGE__') {
        selectElement.value = currentValue;
    }
}

function applyFilters() {
    if (!isDataLoaded) return;
    
    // Check if we're in averaging mode
    const isAveraging = elements.scenarioSelect.value === '__AVERAGE__';
    
    if (isAveraging) {
        // Calculate average across all scenarios for each model/metric/split/time combination
        filteredData = calculateScenarioAverages();
    } else {
        // Normal filtering
        filteredData = allData.filter(row => {
            if (elements.modelSelect.value && row.model !== elements.modelSelect.value) return false;
            if (elements.scenarioSelect.value && row.scenario_class !== elements.scenarioSelect.value) return false;
            if (elements.metricSelect.value && row.metric_name !== elements.metricSelect.value) return false;
            if (elements.splitSelect.value && row.split !== elements.splitSelect.value) return false;
            return true;
        });
    }
    
    updateVisualizations();
}

function calculateScenarioAverages() {
    // Filter data based on model, metric, and split (but not scenario)
    let baseFilteredData = allData.filter(row => {
        if (elements.modelSelect.value && row.model !== elements.modelSelect.value) return false;
        if (elements.metricSelect.value && row.metric_name !== elements.metricSelect.value) return false;
        if (elements.splitSelect.value && row.split !== elements.splitSelect.value) return false;
        return true;
    });
    
    // Group by model, metric, split, and timestamp to calculate averages across scenarios
    const grouped = d3.group(baseFilteredData, 
        d => `${d.model}|${d.metric_name}|${d.split}|${d.run_timestamp}`);
    
    const averagedData = [];
    
    grouped.forEach((group, key) => {
        const [model, metric_name, split, run_timestamp] = key.split('|');
        
        // Calculate averages across scenarios for each numeric metric
        const numericColumns = ['count', 'sum', 'mean', 'min', 'max', 'std', 'variance', 'p25', 'p50', 'p75', 'p90', 'p95', 'p99'];
        const averages = {};
        
        numericColumns.forEach(col => {
            const values = group.map(d => d[col]).filter(v => v !== undefined && v !== null && !isNaN(v));
            if (values.length > 0) {
                averages[col] = d3.mean(values);
            }
        });
        
        // Get unique scenarios included in this average
        const scenarios = [...new Set(group.map(d => d.scenario_class))].filter(Boolean);
        
        // Create averaged row
        const averagedRow = {
            model: model,
            scenario_class: `Average (${scenarios.length} scenarios)`,
            metric_name: metric_name,
            split: split,
            run_timestamp: run_timestamp === 'null' ? null : new Date(run_timestamp),
            run_date: run_timestamp === 'null' ? null : new Date(run_timestamp),
            run_id: group[0].run_id || group[0].run,
            ...averages,
            // Add metadata about the averaging
            _isAverage: true,
            _scenarioCount: scenarios.length,
            _scenarios: scenarios.join(', ')
        };
        
        averagedData.push(averagedRow);
    });
    
    return averagedData;
}

function updateVisualizations() {
    updateOverviewChart();
    updateTimeSeriesChart();
    updateSummaryStats();
    updateComparisonChart();
    updateDataTable();
}

function updateOverviewChart() {
    const chartDiv = document.getElementById('overviewChart');
    
    if (!isDataLoaded || allData.length === 0) {
        chartDiv.innerHTML = '<div class="empty-state"><h3>No data to display</h3><p>Loading benchmark data...</p></div>';
        return;
    }
    
    // For overview chart, always show all models with averaged scenarios
    // Filter only by metric and split (not by model or scenario)
    let overviewData = allData.filter(row => {
        if (elements.metricSelect.value && row.metric_name !== elements.metricSelect.value) return false;
        if (elements.splitSelect.value && row.split !== elements.splitSelect.value) return false;
        return true;
    });
    
    // Calculate the total unique scenarios in the filtered data
    const totalUniqueScenarios = [...new Set(overviewData.map(d => d.scenario_class))].filter(Boolean).length;
    
    // Calculate averages across scenarios for each model/metric/split/time combination
    const grouped = d3.group(overviewData, 
        d => `${d.model}|${d.metric_name}|${d.split}|${d.run_timestamp}`);
    
    const averagedData = [];
    grouped.forEach((group, key) => {
        const [model, metric_name, split, run_timestamp] = key.split('|');
        
        // Calculate averages across scenarios
        const meanValues = group.map(d => d.mean).filter(v => v !== undefined && v !== null && !isNaN(v));
        if (meanValues.length > 0) {
            const scenarios = [...new Set(group.map(d => d.scenario_class))].filter(Boolean);
            
            averagedData.push({
                model: model,
                metric_name: metric_name,
                split: split,
                run_timestamp: run_timestamp === 'null' ? null : new Date(run_timestamp),
                mean: d3.mean(meanValues),
                _scenarioCount: scenarios.length,
                _scenarios: scenarios.join(', ')
            });
        }
    });
    
    if (averagedData.length === 0) {
        chartDiv.innerHTML = '<div class="empty-state"><h3>No data to display</h3><p>No matching data found for the selected filters.</p></div>';
        return;
    }
    
    // Group by model and create traces
    const modelGroups = d3.group(averagedData, d => d.model);
    const colors = ['#667eea', '#48bb78', '#ed8936', '#e53e3e', '#9f7aea', '#38b2ac', '#d69e2e', '#805ad5', '#dd6b20'];
    let colorIndex = 0;
    
    const traces = [];
    modelGroups.forEach((modelData, modelName) => {
        // Group by timestamp
        const timeSeriesData = d3.group(modelData, d => d.run_timestamp);
        
        const x = [];
        const y = [];
        const text = [];
        
        timeSeriesData.forEach((values, timestamp) => {
            if (timestamp && timestamp !== 'null') {
                const meanValue = d3.mean(values, d => d.mean);
                if (meanValue !== undefined && meanValue !== null) {
                    x.push(timestamp);
                    y.push(meanValue);
                    const scenarioCount = values[0]._scenarioCount || 0;
                    text.push(`${modelName}<br>Avg across ${scenarioCount} scenarios<br>Score: ${meanValue.toFixed(4)}`);
                }
            }
        });
        
        if (x.length > 0) {
            const color = colors[colorIndex % colors.length];
            traces.push({
                x: x,
                y: y,
                text: text,
                mode: 'lines+markers',
                type: 'scatter',
                name: modelName,
                line: { color: color, width: 3 },
                marker: { color: color, size: 8 }
            });
            colorIndex++;
        }
    });
    
    const metricName = elements.metricSelect.value || 'Performance';
    // Use the total unique scenarios instead of taking from first group
    const scenarioCount = totalUniqueScenarios;
    
    const layout = {
        title: {
            text: `${metricName} - All Models Comparison (Avg across ${scenarioCount} scenarios)`,
            x: 0.5,
            font: { size: 16 }
        },
        xaxis: { 
            title: 'Date',
            type: 'date'
        },
        yaxis: { 
            title: metricName
        },
        margin: { t: 50, r: 50, b: 50, l: 80 },
        plot_bgcolor: '#f8f9fa',
        paper_bgcolor: 'white',
        showlegend: true,
        legend: {
            orientation: 'h',
            x: 0.5,
            xanchor: 'center',
            y: -0.15
        }
    };
    
    const config = {
        responsive: true,
        displayModeBar: true,
        modeBarButtonsToRemove: ['pan2d', 'lasso2d', 'select2d']
    };
    
    Plotly.newPlot(chartDiv, traces, layout, config);
}

function updateTimeSeriesChart() {
    const chartDiv = document.getElementById('timeSeriesChart');
    
    // Check if a specific model is selected
    const hasModelSelected = elements.modelSelect.value;
    
    if (!hasModelSelected) {
        chartDiv.innerHTML = '<div class="empty-state"><h3>Select a model to see detailed performance</h3><p>Choose a specific model from the dropdown above to view detailed performance data, including individual scenarios and additional metrics.</p></div>';
        return;
    }
    
    if (filteredData.length === 0) {
        chartDiv.innerHTML = '<div class="empty-state"><h3>No data to display</h3><p>No data found for the selected model and filters.</p></div>';
        return;
    }
    
    const isAveraging = elements.scenarioSelect.value === '__AVERAGE__';
    const titlePrefix = isAveraging ? 'Average ' : '';
    const titleSuffix = isAveraging ? ' (across scenarios)' : '';
    
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
                
                if (isAveraging) {
                    const scenarioCount = values[0]._scenarioCount || 0;
                    text.push(`${values.length} data points<br>Avg across ${scenarioCount} scenarios<br>Mean: ${meanValue.toFixed(4)}`);
                } else {
                    const scenario = values[0].scenario_class || 'Unknown';
                    text.push(`Scenario: ${scenario}<br>${values.length} data points<br>Mean: ${meanValue.toFixed(4)}`);
                }
            }
        }
    });
    
    const traces = [{
        x: x,
        y: y,
        text: text,
        mode: 'lines+markers',
        type: 'scatter',
        name: elements.modelSelect.value,
        line: { color: '#667eea', width: 3 },
        marker: { color: '#667eea', size: 8 }
    }];
    
    const chartTitle = `${titlePrefix}${elements.metricSelect.value || 'Metric'} - ${elements.modelSelect.value}${titleSuffix}`;
    
    const layout = {
        title: {
            text: chartTitle,
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
        paper_bgcolor: 'white',
        showlegend: false
    };
    
    const config = {
        responsive: true,
        displayModeBar: true,
        modeBarButtonsToRemove: ['pan2d', 'lasso2d', 'select2d']
    };
    
    Plotly.newPlot(chartDiv, traces, layout, config);
}

function updateSummaryStats() {
    const statsDiv = document.getElementById('summaryStats');
    
    if (filteredData.length === 0) {
        statsDiv.innerHTML = '<div class="empty-state"><h3>No data available</h3><p>Please select filters to view statistics.</p></div>';
        return;
    }
    
    // Check if a specific model is selected
    const hasModelSelected = elements.modelSelect.value;
    
    if (!hasModelSelected) {
        statsDiv.innerHTML = '<div class="empty-state"><h3>Select a model for detailed statistics</h3><p>Choose a specific model from the dropdown above to view detailed performance statistics and trends.</p></div>';
        return;
    }
    
    if (filteredData.length === 0) {
        statsDiv.innerHTML = '<div class="empty-state"><h3>No data available</h3><p>No data found for the selected model and filters.</p></div>';
        return;
    }
    
    // Check if we're showing averaged data
    const isAveraging = elements.scenarioSelect.value === '__AVERAGE__';
    
    // Calculate statistics
    const values = filteredData.map(d => d.mean).filter(v => v !== undefined && v !== null && !isNaN(v));
    const uniqueRuns = new Set(filteredData.map(d => d.run_id || d.run)).size;
    const dateRange = d3.extent(filteredData.map(d => d.run_timestamp)).filter(d => d);
    
    let statsHtml = '<div class="stats-grid">';
    
    // Add header explaining what we're showing for the selected model
    if (isAveraging) {
        const scenarioCount = filteredData.length > 0 ? filteredData[0]._scenarioCount : 0;
        statsHtml = `<div class="averaging-header">
            <h4>📊 ${elements.modelSelect.value} - averages across ${scenarioCount} scenarios</h4>
            <p>Performance statistics for ${elements.modelSelect.value} averaged across all available scenarios.</p>
        </div>` + statsHtml;
    } else {
        const scenarioName = elements.scenarioSelect.value || 'selected scenario';
        statsHtml = `<div class="averaging-header">
            <h4>📊 ${elements.modelSelect.value} - ${scenarioName}</h4>
            <p>Performance statistics for ${elements.modelSelect.value} on the selected scenario.</p>
        </div>` + statsHtml;
    }
    
    if (values.length > 0) {
        const mean = d3.mean(values);
        const latest = values[values.length - 1];
        const trend = values.length > 1 ? (latest > values[0] ? 'up' : latest < values[0] ? 'down' : 'stable') : 'stable';
        
        statsHtml += `
            <div class="stat-card">
                <div class="stat-value trend-${trend}">${latest.toFixed(4)}</div>
                <div class="stat-label">${isAveraging ? 'Latest Avg' : 'Latest Value'}</div>
            </div>
            <div class="stat-card">
                <div class="stat-value">${mean.toFixed(4)}</div>
                <div class="stat-label">${isAveraging ? 'Overall Avg' : 'Average'}</div>
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
            <div class="stat-label">${isAveraging ? 'Avg Points' : 'Data Points'}</div>
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
    
    // Add scenario count for averaging mode
    if (isAveraging && filteredData.length > 0) {
        const scenarioCount = filteredData[0]._scenarioCount;
        statsHtml += `
            <div class="stat-card">
                <div class="stat-value">${scenarioCount}</div>
                <div class="stat-label">Scenarios Averaged</div>
            </div>
        `;
    }
    
    statsHtml += '</div>';
    
    statsDiv.innerHTML = statsHtml;
}

function updateComparisonChart() {
    const chartDiv = document.getElementById('comparisonChart');
    
    // Check if a specific model is selected
    const hasModelSelected = elements.modelSelect.value;
    
    if (!hasModelSelected) {
        chartDiv.innerHTML = '<div class="empty-state"><h3>Select a model for comparison analysis</h3><p>Choose a specific model from the dropdown above to view daily performance comparison and trends.</p></div>';
        return;
    }
    
    if (filteredData.length === 0) {
        chartDiv.innerHTML = '<div class="empty-state"><h3>No data to compare</h3><p>No data found for the selected model and filters.</p></div>';
        return;
    }
    
    // Group data by date instead of by run_id
    const dateGroups = d3.group(filteredData, d => {
        if (d.run_date) {
            return d.run_date.toDateString(); // Group by date string
        }
        return 'Unknown Date';
    });
    
    // Get the last 7 days for comparison
    const sortedDays = Array.from(dateGroups.entries())
        .filter(([dateStr, _]) => dateStr !== 'Unknown Date')
        .sort((a, b) => new Date(a[0]) - new Date(b[0]))
        .slice(-7); // Last 7 days
    
    if (sortedDays.length === 0) {
        chartDiv.innerHTML = '<div class="empty-state"><h3>No dated data available</h3><p>Cannot create comparison chart without date information.</p></div>';
        return;
    }
    
    const x = [];
    const y = [];
    const errorY = [];
    const text = [];
    
    sortedDays.forEach(([dateStr, dayData]) => {
        const values = dayData.map(d => d.mean).filter(v => v !== undefined && v !== null && !isNaN(v));
        
        if (values.length > 0) {
            const meanValue = d3.mean(values);
            const stdDev = values.length > 1 ? d3.deviation(values) : 0;
            const date = new Date(dateStr);
            
            x.push(date.toLocaleDateString());
            y.push(meanValue);
            errorY.push(stdDev);
            text.push(
                `Date: ${date.toLocaleDateString()}<br>` +
                `Mean: ${meanValue.toFixed(4)}<br>` +
                `Std Dev: ${stdDev.toFixed(4)}<br>` +
                `Runs: ${dayData.length}<br>` +
                `Data points: ${values.length}`
            );
        }
    });
    
    const trace = {
        x: x,
        y: y,
        text: text,
        type: 'scatter',
        mode: 'markers',
        name: 'Daily Average',
        marker: { 
            color: '#48bb78',
            size: 10,
            line: { color: '#38a169', width: 2 }
        },
        error_y: {
            type: 'data',
            array: errorY,
            visible: true,
            color: '#38a169',
            thickness: 2,
            width: 6
        }
    };
    
    const isAveraging = elements.scenarioSelect.value === '__AVERAGE__';
    const chartTitle = isAveraging ? 
        'Daily Average Performance Comparison (±1 Std Dev, across scenarios)' : 
        'Daily Performance Comparison (±1 Std Dev)';
    
    const layout = {
        title: {
            text: chartTitle,
            x: 0.5,
            font: { size: 16 }
        },
        xaxis: { 
            title: 'Date'
        },
        yaxis: { 
            title: elements.metricSelect.value || 'Value'
        },
        margin: { t: 60, r: 50, b: 100, l: 80 },
        plot_bgcolor: '#f8f9fa',
        paper_bgcolor: 'white',
        showlegend: false
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
    
    // Check if a specific model is selected
    const hasModelSelected = elements.modelSelect.value;
    
    if (!hasModelSelected) {
        tableDiv.innerHTML = '<div class="empty-state"><h3>Select a model to view detailed data</h3><p>Choose a specific model from the dropdown above to view the raw performance data in table format.</p></div>';
        return;
    }
    
    if (filteredData.length === 0) {
        tableDiv.innerHTML = '<div class="empty-state"><h3>No data to display</h3><p>No data found for the selected model and filters.</p></div>';
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
    
    // Check if we're in averaging mode to adjust columns
    const isAveraging = elements.scenarioSelect.value === '__AVERAGE__';
    
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
    
    // Add scenario details column if in averaging mode
    if (isAveraging) {
        columns.splice(2, 0, { 
            key: '_scenarios', 
            label: 'Scenarios Included', 
            format: (d) => d ? (d.length > 50 ? d.substring(0, 50) + '...' : d) : '-' 
        });
    }
    
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