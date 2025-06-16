// Global variables
let allData = [];
let isDataLoaded = false;

// Separate data for the two sections
let allModelsData = [];
let individualModelData = [];

// DOM elements for both sections
const allModelsElements = {
    metricSelect: document.getElementById('allModelsMetricSelect'),
    scenarioSelect: document.getElementById('allModelsScenarioSelect'),
    refreshBtn: document.getElementById('refreshBtn')
};

const individualElements = {
    modelSelect: document.getElementById('individualModelSelect'),
    scenarioSelect: document.getElementById('individualScenarioSelect'),
    metricSelect: document.getElementById('individualMetricSelect'),
    rowLimitSelect: document.getElementById('rowLimitSelect')
};

const sharedElements = {
    status: document.getElementById('status'),
    dashboard: document.querySelector('.individual-model-dashboard'),
    lastUpdated: document.getElementById('lastUpdated')
};

// Initialize the application
document.addEventListener('DOMContentLoaded', function() {
    setupEventListeners();
    loadDefaultData();
});

function setupEventListeners() {
    allModelsElements.refreshBtn.addEventListener('click', loadDefaultData);
    
    // All models section listeners
    allModelsElements.metricSelect.addEventListener('change', updateAllModelsVisualization);
    allModelsElements.scenarioSelect.addEventListener('change', updateAllModelsVisualization);
    
    // Individual model section listeners
    individualElements.modelSelect.addEventListener('change', updateIndividualModelVisualization);
    individualElements.scenarioSelect.addEventListener('change', updateIndividualModelVisualization);
    individualElements.metricSelect.addEventListener('change', updateIndividualModelVisualization);
    individualElements.rowLimitSelect.addEventListener('change', updateDataTable);
}

function setStatus(message, type = 'info') {
    sharedElements.status.innerHTML = message;
    sharedElements.status.className = `status ${type}`;
}

function setLoading(isLoading) {
    if (isLoading) {
        setStatus('<span class="loading">Loading data...</span>', 'info');
        sharedElements.dashboard.classList.remove('visible');
    }
}

async function loadDefaultData() {
    setLoading(true);
    
    try {
        // First try to load from the dashboard directory (for deployed GitHub Pages)
        console.log('Attempting to load CSV from dashboard directory: ./benchmark_summary.csv');
        let response = await fetch('./benchmark_summary.csv');
        let source = 'dashboard/benchmark_summary.csv';
        
        // If that fails, try from the results directory (for local development)
        if (!response.ok) {
            console.log(`Dashboard directory failed (${response.status}), trying results directory: /results/benchmark_summary.csv`);
            response = await fetch('/results/benchmark_summary.csv');
            source = 'results/benchmark_summary.csv';
        }
        
        if (response.ok) {
            console.log(`✅ CSV loaded successfully from: ${source}`);
            console.log(`Response status: ${response.status}, Content-Type: ${response.headers.get('content-type')}`);
            const csvText = await response.text();
            console.log(`CSV file size: ${csvText.length} characters`);
            processCSVData(csvText);
            setStatus(`Data loaded successfully from ${source}`, 'success');
        } else {
            console.log(`❌ Both locations failed. Dashboard: ./benchmark_summary.csv, Results: /results/benchmark_summary.csv`);
            throw new Error('CSV file not found in either dashboard or results directory');
        }
    } catch (error) {
        console.log('❌ Could not load CSV from either location:', error.message);
        setStatus('No benchmark data found. Run "daily-bench extract" to generate the CSV file in results/.', 'error');
        sharedElements.dashboard.classList.remove('visible');
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

        // Ensure metric_name is set (it might be 'name' in the CSV)
        if (row.name && !row.metric_name) {
            row.metric_name = row.name;
        }
    });
    
    // Log available columns for debugging
    console.log('Available columns:', Object.keys(allData[0] || {}));
    console.log('Sample row:', allData[0]);
    
    isDataLoaded = true;
    updateAllFilters();
    updateAllModelsVisualization();
    updateIndividualModelVisualization();
    sharedElements.lastUpdated.textContent = new Date().toLocaleString();
}

function updateAllFilters() {
    // Get unique values for each filter
    const models = [...new Set(allData.map(d => d.model))].filter(Boolean).sort();
    const scenarios = [...new Set(allData.map(d => d.scenario_class))].filter(Boolean).sort();
    const metrics = [...new Set(allData.map(d => d.metric_name))].filter(Boolean).sort();
    
    // Update all models section options
    updateSelectOptions(allModelsElements.metricSelect, metrics);
    updateSelectOptions(allModelsElements.scenarioSelect, scenarios, false, true); // Include "All" option for scenarios
    
    // Update individual model section options
    updateSelectOptions(individualElements.modelSelect, models);
    updateSelectOptions(individualElements.scenarioSelect, scenarios, false, true); // Include "All" option for scenarios
    updateSelectOptions(individualElements.metricSelect, metrics);
    
    // Set defaults for all models section
    if (metrics.length > 0 && !allModelsElements.metricSelect.value) {
        // Default to exact_match if available, otherwise first metric
        const defaultMetric = metrics.includes('exact_match') ? 'exact_match' : metrics[0];
        allModelsElements.metricSelect.value = defaultMetric;
    }
    
    // Set defaults for individual model section
    if (metrics.length > 0 && !individualElements.metricSelect.value) {
        // Default to exact_match if available, otherwise first metric
        const defaultMetric = metrics.includes('exact_match') ? 'exact_match' : metrics[0];
        individualElements.metricSelect.value = defaultMetric;
    }
}

function updateSelectOptions(selectElement, options, includeAll = false, isScenario = false) {
    const currentValue = selectElement.value;
    selectElement.innerHTML = '';
    
    // Add default option
    if (includeAll) {
        selectElement.appendChild(new Option(isScenario ? 'All scenarios' : 'All splits', ''));
    } else if (selectElement.id === 'individualModelSelect') {
        selectElement.appendChild(new Option('Choose a model to analyze...', ''));
    } else {
        selectElement.appendChild(new Option(`Select ${selectElement.labels[0].textContent.toLowerCase()}...`, ''));
    }
    
    // Add average option for scenario selects
    if (isScenario) {
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

function updateAllModelsVisualization() {
    if (!isDataLoaded) return;
    
    // Filter data for all models section - no model filtering, always show all models
    allModelsData = allData.filter(row => {
        if (allModelsElements.metricSelect.value && row.metric_name !== allModelsElements.metricSelect.value) return false;
        return true;
    });
    
    // Handle scenario filtering/averaging
    if (allModelsElements.scenarioSelect.value === '__AVERAGE__') {
        allModelsData = calculateAllModelsScenarioAverages(allModelsData);
    } else if (allModelsElements.scenarioSelect.value) {
        allModelsData = allModelsData.filter(row => row.scenario_class === allModelsElements.scenarioSelect.value);
    }
    
    updateOverviewChart();
}

function updateIndividualModelVisualization() {
    if (!isDataLoaded) return;
    
    // Check if a model is selected
    if (!individualElements.modelSelect.value) {
        sharedElements.dashboard.classList.remove('visible');
        return;
    }
    
    // Filter data for individual model section
    individualModelData = allData.filter(row => {
        if (row.model !== individualElements.modelSelect.value) return false;
        if (individualElements.metricSelect.value && row.metric_name !== individualElements.metricSelect.value) return false;
        return true;
    });
    
    // Handle scenario filtering/averaging
    if (individualElements.scenarioSelect.value === '__AVERAGE__') {
        individualModelData = calculateIndividualModelScenarioAverages(individualModelData);
    } else if (individualElements.scenarioSelect.value) {
        individualModelData = individualModelData.filter(row => row.scenario_class === individualElements.scenarioSelect.value);
    }
    
    updateTimeSeriesChart();
    updateSummaryStats();
    updateComparisonChart();
    updateDataTable();
    
    sharedElements.dashboard.classList.add('visible');
}

function calculateAllModelsScenarioAverages(data) {
    // Get all unique scenarios first
    const allScenarios = [...new Set(data.map(d => d.scenario_class))].filter(Boolean);
    const totalScenarioCount = allScenarios.length;
    
    console.log('🔍 Debug - All scenarios in filtered data:', allScenarios);
    console.log('🔍 Debug - Total scenario count:', totalScenarioCount);
    
    // Group by model, metric, and timestamp only (no split)
    const grouped = d3.group(data, 
        d => `${d.model}|${d.metric_name}|${d.run_timestamp}`);
    
    // First pass: find the maximum number of scenarios for any timestamp
    let maxScenarioCount = 0;
    grouped.forEach((group, key) => {
        const scenarioCount = [...new Set(group.map(d => d.scenario_class))].filter(Boolean).length;
        const scenarios = [...new Set(group.map(d => d.scenario_class))].filter(Boolean);
        console.log(`🔍 Debug - ${key} has ${scenarioCount} scenarios:`, scenarios);
        maxScenarioCount = Math.max(maxScenarioCount, scenarioCount);
    });
    
    console.log('🔍 Debug - Max scenario count found:', maxScenarioCount);
    console.log('🔍 Debug - Missing scenario analysis:');
    
    // Show which scenarios are missing where
    grouped.forEach((group, key) => {
        const scenarios = [...new Set(group.map(d => d.scenario_class))].filter(Boolean);
        const missingScenarios = allScenarios.filter(s => !scenarios.includes(s));
        if (missingScenarios.length > 0) {
            console.log(`  ${key} is missing: ${missingScenarios.join(', ')}`);
        }
    });
    
    const averagedData = [];
    
    grouped.forEach((group, key) => {
        const [model, metric_name, run_timestamp] = key.split('|');
        
        // Only include groups that have the maximum number of scenarios
        const currentScenarioCount = [...new Set(group.map(d => d.scenario_class))].filter(Boolean).length;
        if (currentScenarioCount !== maxScenarioCount) {
            console.log(`🔍 Debug - Skipping ${key} because it has ${currentScenarioCount} scenarios instead of ${maxScenarioCount}`);
            return; // Skip this timestamp as it doesn't have all scenarios
        }
        
        // Calculate averages across scenarios for each numeric metric
        const numericColumns = ['count', 'sum', 'mean', 'min', 'max', 'std', 'variance', 'p25', 'p50', 'p75', 'p90', 'p95', 'p99'];
        const averages = {};
        
        numericColumns.forEach(col => {
            const values = group.map(d => d[col]).filter(v => v !== undefined && v !== null && !isNaN(v));
            if (values.length > 0) {
                averages[col] = d3.mean(values);
            }
        });
        
        // Create averaged row
        const averagedRow = {
            model: model,
            scenario_class: `Average (${maxScenarioCount} scenarios)`,
            metric_name: metric_name,
            split: 'combined', // Since we're ignoring splits
            run_timestamp: run_timestamp === 'null' ? null : new Date(run_timestamp),
            run_date: run_timestamp === 'null' ? null : new Date(run_timestamp),
            run_id: group[0].run_id || group[0].run,
            ...averages,
            // Add metadata about the averaging
            _isAverage: true,
            _scenarioCount: maxScenarioCount,
            _scenarios: allScenarios.join(', ')
        };
        
        averagedData.push(averagedRow);
    });
    
    console.log('🔍 Debug - Final averaged data points:', averagedData.length);
    return averagedData;
}

function calculateIndividualModelScenarioAverages(data) {
    return calculateAllModelsScenarioAverages(data); // Same logic, different data input
}

function updateOverviewChart() {
    const chartDiv = document.getElementById('overviewChart');
    
    if (!isDataLoaded || allModelsData.length === 0) {
        chartDiv.innerHTML = '<div class="empty-state"><h3>No data to display</h3><p>Select filters to view all models comparison.</p></div>';
        return;
    }
    
    // Calculate the total unique scenarios in the filtered data
    const isAveraging = allModelsElements.scenarioSelect.value === '__AVERAGE__';
    const totalUniqueScenarios = isAveraging ? 
        allModelsData[0]?._scenarioCount || 0 :
        [...new Set(allModelsData.map(d => d.scenario_class))].filter(Boolean).length;
    
    // Group by model and timestamp to handle multiple points per timestamp
    const modelTimestampGroups = d3.group(allModelsData, 
        d => d.model,
        d => d.run_timestamp ? d.run_timestamp.getTime() : 0
    );
    
    const colors = ['#667eea', '#48bb78', '#ed8936', '#e53e3e', '#9f7aea', '#38b2ac', '#d69e2e', '#805ad5', '#dd6b20'];
    let colorIndex = 0;
    
    const traces = [];
    modelTimestampGroups.forEach((timestampGroups, modelName) => {
        // First pass: find the maximum number of data points for this model
        let maxDataPoints = 0;
        timestampGroups.forEach((group, timestamp) => {
            if (timestamp === 0) return;
            const values = group.map(d => d.mean).filter(v => v !== undefined && v !== null && !isNaN(v));
            maxDataPoints = Math.max(maxDataPoints, values.length);
        });
        
        const processedData = [];
        
        timestampGroups.forEach((group, timestamp) => {
            if (timestamp === 0) return; // Skip invalid timestamps
            
            const values = group.map(d => d.mean).filter(v => v !== undefined && v !== null && !isNaN(v));
            
            // Only include timestamps that have the maximum number of data points
            if (values.length > 0 && values.length === maxDataPoints) {
                const meanValue = d3.mean(values);
                const stdDev = values.length > 1 ? d3.deviation(values) : 0;
                const scenarios = [...new Set(group.map(d => d.scenario_class))].filter(Boolean);
                
                processedData.push({
                    timestamp: new Date(timestamp),
                    mean: meanValue,
                    stdDev: stdDev,
                    count: values.length,
                    scenarios: scenarios
                });
            }
        });
        
        // Sort by timestamp
        processedData.sort((a, b) => a.timestamp - b.timestamp);
        
        if (processedData.length > 0) {
            const color = colors[colorIndex % colors.length];
            const x = processedData.map(d => d.timestamp);
            const y = processedData.map(d => d.mean);
            const text = processedData.map(d => 
                `${modelName}<br>Mean: ${d.mean.toFixed(4)}`
            );
            
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
    
    if (traces.length === 0) {
        chartDiv.innerHTML = '<div class="empty-state"><h3>No data to display</h3><p>No matching data found for the selected filters.</p></div>';
        return;
    }
    
    const metricName = allModelsElements.metricSelect.value || 'Performance';
    const scenarioInfo = isAveraging ? 
        `Avg across ${totalUniqueScenarios} scenarios` :
        allModelsElements.scenarioSelect.value || 'All scenarios';
    
    const layout = {
        title: {
            text: `${metricName} - All Models (${scenarioInfo})`,
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
        margin: { t: 50, r: 50, b: 80, l: 80 },
        plot_bgcolor: '#f8f9fa',
        paper_bgcolor: 'white',
        showlegend: true,
        legend: {
            orientation: 'h',
            x: 0.5,
            xanchor: 'center',
            y: -0.2
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
    
    if (individualModelData.length === 0) {
        chartDiv.innerHTML = '<div class="empty-state"><h3>No data to display</h3><p>No data found for the selected model and filters.</p></div>';
        return;
    }
    
    const isAveraging = individualElements.scenarioSelect.value === '__AVERAGE__';
    const titlePrefix = isAveraging ? 'Average ' : '';
    const titleSuffix = isAveraging ? ' (across scenarios)' : '';
    
    // Group by timestamp to handle multiple points per timestamp
    const timestampGroups = d3.group(individualModelData, 
        d => d.run_timestamp ? d.run_timestamp.getTime() : 0
    );
    
    // First pass: find the maximum number of data points across all timestamps
    let maxDataPoints = 0;
    timestampGroups.forEach((group, timestamp) => {
        if (timestamp === 0) return;
        const values = group.map(d => d.mean).filter(v => v !== undefined && v !== null && !isNaN(v));
        maxDataPoints = Math.max(maxDataPoints, values.length);
    });
    
    // Process each timestamp group to get a single point
    const processedData = [];
    timestampGroups.forEach((group, timestamp) => {
        if (timestamp === 0) return; // Skip invalid timestamps
        
        const values = group.map(d => d.mean).filter(v => v !== undefined && v !== null && !isNaN(v));
        
        // Only include timestamps that have the maximum number of data points
        if (values.length > 0 && values.length === maxDataPoints) {
            const meanValue = d3.mean(values);
            const stdDev = values.length > 1 ? d3.deviation(values) : 0;
            
            processedData.push({
                timestamp: new Date(timestamp),
                mean: meanValue,
                stdDev: stdDev,
                count: values.length,
                scenarios: isAveraging ? group[0]._scenarios : group[0].scenario_class
            });
        }
    });
    
    // Sort by timestamp
    processedData.sort((a, b) => a.timestamp - b.timestamp);
    
    const x = processedData.map(d => d.timestamp);
    const y = processedData.map(d => d.mean);
    const text = processedData.map(d => {
        if (isAveraging) {
            return `Mean: ${d.mean.toFixed(4)}`;
        } else {
            return `Scenario: ${d.scenarios}<br>Mean: ${d.mean.toFixed(4)}`;
        }
    });
    
    const traces = [{
        x: x,
        y: y,
        text: text,
        mode: 'lines+markers',
        type: 'scatter',
        name: individualElements.modelSelect.value,
        line: { color: '#667eea', width: 3 },
        marker: { color: '#667eea', size: 8 }
    }];
    
    const selectedMetric = individualElements.metricSelect.value;
    const chartTitle = `${titlePrefix}${selectedMetric || 'Metric'} - ${individualElements.modelSelect.value}${titleSuffix}`;
    
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
            title: selectedMetric || 'Value'
        },
        margin: { t: 50, r: 50, b: 100, l: 80 },
        plot_bgcolor: '#f8f9fa',
        paper_bgcolor: 'white',
        showlegend: true,
        legend: {
            orientation: 'h',
            x: 0.5,
            xanchor: 'center',
            y: -0.25
        }
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
    
    if (individualModelData.length === 0) {
        statsDiv.innerHTML = '<div class="empty-state"><h3>No data available</h3><p>No data found for the selected model and filters.</p></div>';
        return;
    }
    
    // Check if we're showing averaged data
    const isAveraging = individualElements.scenarioSelect.value === '__AVERAGE__';
    
    // Calculate statistics
    const values = individualModelData.map(d => d.mean).filter(v => v !== undefined && v !== null && !isNaN(v));
    const uniqueRuns = new Set(individualModelData.map(d => d.run_id || d.run)).size;
    const dateRange = d3.extent(individualModelData.map(d => d.run_timestamp)).filter(d => d);
    
    let statsHtml = '<div class="stats-grid">';
    
    // Add header explaining what we're showing for the selected model
    if (isAveraging) {
        const scenarioCount = individualModelData.length > 0 ? individualModelData[0]._scenarioCount : 0;
        statsHtml = `<div class="averaging-header">
            <h4>📊 ${individualElements.modelSelect.value} - averages across ${scenarioCount} scenarios</h4>
            <p>Performance statistics for ${individualElements.modelSelect.value} averaged across all available scenarios.</p>
        </div>` + statsHtml;
    } else {
        const scenarioName = individualElements.scenarioSelect.value || 'selected scenario';
        statsHtml = `<div class="averaging-header">
            <h4>📊 ${individualElements.modelSelect.value} - ${scenarioName}</h4>
            <p>Performance statistics for ${individualElements.modelSelect.value} on the selected scenario.</p>
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
            <div class="stat-value">${individualModelData.length}</div>
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
    if (isAveraging && individualModelData.length > 0) {
        const scenarioCount = individualModelData[0]._scenarioCount;
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
    
    if (individualModelData.length === 0) {
        chartDiv.innerHTML = '<div class="empty-state"><h3>No data to compare</h3><p>No data found for the selected model and filters.</p></div>';
        return;
    }
    
    // Group data by date instead of by run_id
    const dateGroups = d3.group(individualModelData, d => {
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
                `Runs: ${dayData.length}`
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
    
    const isAveraging = individualElements.scenarioSelect.value === '__AVERAGE__';
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
            title: individualElements.metricSelect.value || 'Value'
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
    const limit = parseInt(individualElements.rowLimitSelect.value) || individualModelData.length;
    
    if (individualModelData.length === 0) {
        tableDiv.innerHTML = '<div class="empty-state"><h3>No data to display</h3><p>No data found for the selected model and filters.</p></div>';
        return;
    }
    
    // Sort by timestamp descending and limit rows
    const sortedData = [...individualModelData]
        .sort((a, b) => {
            const aTime = a.run_timestamp || new Date(0);
            const bTime = b.run_timestamp || new Date(0);
            return bTime - aTime;
        })
        .slice(0, limit);
    
    // Check if we're in averaging mode to adjust columns
    const isAveraging = individualElements.scenarioSelect.value === '__AVERAGE__';
    
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