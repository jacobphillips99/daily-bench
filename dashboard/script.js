// Global variables
let allData = [];
let isDataLoaded = false;

// Separate data for the two sections
let allModelsData = [];
let individualModelData = [];

// Dynamic mobile detection functions
function isMobile() {
    return window.innerWidth <= 768;
}

function isSmallMobile() {
    return window.innerWidth <= 480;
}

function isPortrait() {
    return window.innerHeight > window.innerWidth;
}

// DOM elements for both sections
const allModelsElements = {
    providerSelect: document.getElementById('allModelsProviderSelect'),
    metricSelect: document.getElementById('allModelsMetricSelect'),
    scenarioSelect: document.getElementById('allModelsScenarioSelect'),
    timePeriodSelect: document.getElementById('allModelsTimePeriodSelect'),
    varianceMetricSelect: document.getElementById('allModelsVarianceMetricSelect'),
    varianceViewSelect: document.getElementById('allModelsVarianceViewSelect')
};

const individualElements = {
    modelSelect: document.getElementById('individualModelSelect'),
    scenarioSelect: document.getElementById('individualScenarioSelect'),
    metricSelect: document.getElementById('individualMetricSelect'),
    timePeriodSelect: document.getElementById('individualTimePeriodSelect'),
    rowLimitSelect: document.getElementById('rowLimitSelect')
};

const sharedElements = {
    status: document.getElementById('status'),
    dashboard: document.querySelector('.individual-model-dashboard'),
    lastUpdated: document.getElementById('lastUpdated')
};

// Mobile-optimized Plotly configuration
function getMobileConfig() {
    const mobile = isMobile();
    const smallMobile = isSmallMobile();

    return {
        responsive: true,
        displayModeBar: !smallMobile,
        modeBarButtonsToRemove: ['pan2d', 'lasso2d', 'select2d', 'autoScale2d', 'resetScale2d', 'zoom2d', 'zoomIn2d', 'zoomOut2d'],
        displaylogo: false,
        doubleClick: 'reset',
        showTips: false,
        toImageButtonOptions: {
            format: 'png',
            filename: 'chart',
            height: mobile ? (isPortrait() ? 400 : 300) : 500,
            width: mobile ? (isPortrait() ? 350 : 500) : 700,
            scale: 1
        }
    };
}

function getMobileLayout(baseLayout) {
    const mobile = isMobile();
    const smallMobile = isSmallMobile();
    const portrait = isPortrait();

    const mobileLayout = { ...baseLayout };

    if (mobile) {
        // Check if legend will be shown
        const hasLegend = mobileLayout.showlegend !== false &&
                         (!mobileLayout.legend || mobileLayout.legend.showlegend !== false);

        // Adjust margins for mobile - increase bottom margin to accommodate both x-axis title and legend
        const bottomMargin = hasLegend ?
            (smallMobile ? (portrait ? 120 : 100) : 110) : // Extra space for both x-axis title and legend
            (smallMobile ? (portrait ? 80 : 60) : 80);     // Space for x-axis title only

        mobileLayout.margin = {
            t: smallMobile ? 35 : 45,
            r: smallMobile ? 15 : 25,
            b: bottomMargin,
            l: smallMobile ? 35 : 50
        };

        // Adjust font sizes
        if (mobileLayout.title) {
            mobileLayout.title = {
                ...mobileLayout.title,
                font: { size: smallMobile ? 13 : 14 },
                // Wrap long titles on mobile
                text: typeof mobileLayout.title === 'string' ?
                    (mobileLayout.title.length > 50 ? mobileLayout.title.substring(0, 47) + '...' : mobileLayout.title) :
                    (mobileLayout.title.text && mobileLayout.title.text.length > 50 ? mobileLayout.title.text.substring(0, 47) + '...' : mobileLayout.title.text)
            };
        }

        if (mobileLayout.xaxis) {
            mobileLayout.xaxis = {
                ...mobileLayout.xaxis,
                title: {
                    text: typeof mobileLayout.xaxis.title === 'string' ? mobileLayout.xaxis.title : mobileLayout.xaxis.title?.text || '',
                    font: { size: smallMobile ? 10 : 11 },
                    standoff: 10 // Ensure the x-axis title has proper spacing
                },
                tickfont: { size: smallMobile ? 9 : 10 },
                automargin: false // Disable automargin to prevent interference with legend
            };
        }

        if (mobileLayout.yaxis) {
            mobileLayout.yaxis = {
                ...mobileLayout.yaxis,
                title: {
                    text: typeof mobileLayout.yaxis.title === 'string' ? mobileLayout.yaxis.title : mobileLayout.yaxis.title?.text || '',
                    font: { size: smallMobile ? 10 : 11 }
                },
                tickfont: { size: smallMobile ? 9 : 10 },
                automargin: true
            };
        }

        // Adjust legend for mobile - position it well below the x-axis title
        if (hasLegend) {
            mobileLayout.legend = {
                ...mobileLayout.legend,
                font: { size: smallMobile ? 8 : 9 },
                orientation: 'h', // Always horizontal on mobile to save vertical space
                x: 0.5,
                xanchor: 'center',
                y: -0.35, // Position further below chart to avoid x-axis title
                yanchor: 'top',
                bgcolor: 'rgba(255,255,255,0.95)',
                bordercolor: 'rgba(0,0,0,0.2)',
                borderwidth: 1
            };

            // Ensure legend is visible
            mobileLayout.showlegend = true;
        }

        // Ensure proper sizing
        mobileLayout.autosize = true;
        mobileLayout.width = undefined; // Let it be responsive
        mobileLayout.height = undefined; // Let it be responsive
    }

    return mobileLayout;
}

// Initialize the application
document.addEventListener('DOMContentLoaded', function() {
    setupEventListeners();
    loadDefaultData();

    // Handle orientation changes with better timing
    window.addEventListener('orientationchange', function() {
        // Wait for orientation change to complete
        setTimeout(() => {
            if (isDataLoaded) {
                console.log('Orientation changed, redrawing charts...');
                updateAllModelsVisualization();
                updateIndividualModelVisualization();
            }
        }, 300); // Increased delay for orientation change
    });

    // Handle window resize with debouncing
    let resizeTimer;
    window.addEventListener('resize', function() {
        clearTimeout(resizeTimer);
        resizeTimer = setTimeout(() => {
            if (isDataLoaded) {
                console.log('Window resized, redrawing charts...');
                updateAllModelsVisualization();
                updateIndividualModelVisualization();
            }
        }, 250);
    });
});

function setupEventListeners() {
    // All models section listeners
    allModelsElements.providerSelect.addEventListener('change', updateAllModelsVisualization);
    allModelsElements.metricSelect.addEventListener('change', updateAllModelsVisualization);
    allModelsElements.scenarioSelect.addEventListener('change', updateAllModelsVisualization);
    allModelsElements.timePeriodSelect.addEventListener('change', updateAllModelsScatterplot);
    allModelsElements.varianceMetricSelect.addEventListener('change', updateVarianceChart);
    allModelsElements.varianceViewSelect.addEventListener('change', updateVarianceChart);

    // Individual model section listeners
    individualElements.modelSelect.addEventListener('change', updateIndividualModelVisualization);
    individualElements.scenarioSelect.addEventListener('change', updateIndividualModelVisualization);
    individualElements.metricSelect.addEventListener('change', updateIndividualModelVisualization);
    individualElements.timePeriodSelect.addEventListener('change', updateIndividualScatterplot);
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

    // Hide the status bar once data is loaded
    sharedElements.status.style.display = 'none';
}

function extractProvider(modelName) {
    if (!modelName || typeof modelName !== 'string') {
        return 'Unknown';
    }
    const slashIndex = modelName.indexOf('/');
    return slashIndex !== -1 ? modelName.substring(0, slashIndex) : 'Unknown';
}



function updateAllFilters() {
    // Get unique values for each filter
    const models = [...new Set(allData.map(d => d.model))].filter(Boolean).sort();
    const providers = [...new Set(models.map(model => extractProvider(model)))].filter(Boolean).sort();
    const scenarios = [...new Set(allData.map(d => d.scenario_class))].filter(Boolean).sort();
    const metrics = [...new Set(allData.map(d => d.metric_name))].filter(Boolean).sort();

    // Update all models section options
    updateSelectOptions(allModelsElements.providerSelect, providers, true, false); // Include "All" option for providers
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
        if (selectElement.id === 'allModelsProviderSelect') {
            selectElement.appendChild(new Option('All providers', ''));
        } else {
            selectElement.appendChild(new Option(isScenario ? 'All scenarios' : 'All splits', ''));
        }
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

    // Filter data for all models section
    allModelsData = allData.filter(row => {
        // Filter by metric
        if (allModelsElements.metricSelect.value && row.metric_name !== allModelsElements.metricSelect.value) return false;

        // Filter by provider
        if (allModelsElements.providerSelect.value) {
            const modelProvider = extractProvider(row.model);
            if (modelProvider !== allModelsElements.providerSelect.value) return false;
        }

        return true;
    });

    // Handle scenario filtering/averaging
    if (allModelsElements.scenarioSelect.value === '__AVERAGE__') {
        allModelsData = calculateAllModelsScenarioAverages(allModelsData);
    } else if (allModelsElements.scenarioSelect.value) {
        allModelsData = allModelsData.filter(row => row.scenario_class === allModelsElements.scenarioSelect.value);
    }

    updateOverviewChart();
    updateAllModelsScatterplot();
    updateVarianceChart();
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
    updateIndividualScatterplot();
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
                line: { color: color, width: isMobile() ? 2 : 3 },
                marker: { color: color, size: isMobile() ? 5 : 8 }
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
    const providerInfo = allModelsElements.providerSelect.value ?
        ` (${allModelsElements.providerSelect.value} models)` : '';

    const layout = {
        title: {
            text: `${metricName} - All Models${providerInfo} (${scenarioInfo})`,
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
        plot_bgcolor: '#f8f9fa',
        paper_bgcolor: 'white',
        showlegend: true
    };

    const mobileLayout = getMobileLayout(layout);
    const config = getMobileConfig();

    // Clear the div first to ensure proper redraw
    chartDiv.innerHTML = '';

    Plotly.newPlot(chartDiv, traces, mobileLayout, config).then(() => {
        // Force resize after plot is ready
        if (isMobile()) {
            setTimeout(() => {
                Plotly.Plots.resize(chartDiv);
            }, 100);
        }
    });
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
        line: { color: '#667eea', width: isMobile() ? 2 : 3 },
        marker: { color: '#667eea', size: isMobile() ? 5 : 8 }
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
        plot_bgcolor: '#f8f9fa',
        paper_bgcolor: 'white',
        showlegend: false
    };

    const mobileLayout = getMobileLayout(layout);
    const config = getMobileConfig();

    // Clear the div first to ensure proper redraw
    chartDiv.innerHTML = '';

    Plotly.newPlot(chartDiv, traces, mobileLayout, config).then(() => {
        // Force resize after plot is ready
        if (isMobile()) {
            setTimeout(() => {
                Plotly.Plots.resize(chartDiv);
            }, 100);
        }
    });
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
            size: isMobile() ? 8 : 10,
            line: { color: '#38a169', width: 2 }
        },
        error_y: {
            type: 'data',
            array: errorY,
            visible: true,
            color: '#38a169',
            thickness: 2,
            width: isMobile() ? 4 : 6
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
        plot_bgcolor: '#f8f9fa',
        paper_bgcolor: 'white',
        showlegend: false
    };

    const mobileLayout = getMobileLayout(layout);
    const config = getMobileConfig();

    // Clear the div first to ensure proper redraw
    chartDiv.innerHTML = '';

    Plotly.newPlot(chartDiv, [trace], mobileLayout, config).then(() => {
        // Force resize after plot is ready
        if (isMobile()) {
            setTimeout(() => {
                Plotly.Plots.resize(chartDiv);
            }, 100);
        }
    });
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

function updateAllModelsScatterplot() {
    const chartDiv = document.getElementById('allModelsScatterChart');

    if (!isDataLoaded || allModelsData.length === 0) {
        chartDiv.innerHTML = '<div class="empty-state"><h3>No data to display</h3><p>Select filters to view all models scatterplot.</p></div>';
        return;
    }

    const timePeriod = allModelsElements.timePeriodSelect.value;
    const processedData = processDataForScatterplot(allModelsData, timePeriod);

    if (processedData.length === 0) {
        chartDiv.innerHTML = '<div class="empty-state"><h3>No data to display</h3><p>No matching data found for the selected filters.</p></div>';
        return;
    }

    // Group by model for different colors
    const modelGroups = d3.group(processedData, d => d.model);
    const colors = ['#667eea', '#48bb78', '#ed8936', '#e53e3e', '#9f7aea', '#38b2ac', '#d69e2e', '#805ad5', '#dd6b20'];
    let colorIndex = 0;

    const traces = [];
    modelGroups.forEach((modelData, modelName) => {
        const color = colors[colorIndex % colors.length];

        traces.push({
            x: modelData.map(d => d.x),
            y: modelData.map(d => d.y),
            text: modelData.map(d => d.hoverText),
            mode: 'markers',
            type: 'scatter',
            name: modelName,
            marker: {
                color: color,
                size: isMobile() ? 4 : 6,
                opacity: 0.6
            }
        });
        colorIndex++;
    });

    const metricName = allModelsElements.metricSelect.value || 'Performance';
    const scenarioInfo = allModelsElements.scenarioSelect.value === '__AVERAGE__' ?
        'Avg across scenarios' :
        allModelsElements.scenarioSelect.value || 'All scenarios';
    const providerInfo = allModelsElements.providerSelect.value ?
        ` (${allModelsElements.providerSelect.value} models)` : '';

    const timePeriodLabel = timePeriod === 'week' ? 'Weekly Pattern' : 'Daily Pattern';

    // Configure x-axis based on time period
    let xAxisConfig;
    if (timePeriod === 'week') {
        xAxisConfig = {
            title: 'Day of Week',
            type: 'linear',
            tickmode: 'array',
            tickvals: [0, 1, 2, 3, 4, 5, 6, 7],
            ticktext: isMobile() ? ['S', 'M', 'T', 'W', 'T', 'F', 'S', 'S'] : ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
            range: [0, 7]
        };
    } else {
        xAxisConfig = {
            title: 'Time of Day (Hours)',
            type: 'linear',
            range: [0, 24],
            tickmode: 'linear',
            tick0: 0,
            dtick: isMobile() ? 6 : 4
        };
    }

    // Hide the zero-line / axis line
    xAxisConfig.zeroline = false;
    xAxisConfig.showline = false;
    xAxisConfig.linecolor = 'rgba(0,0,0,0)';

    const layout = {
        title: {
            text: `${metricName} - All Models${providerInfo} (${scenarioInfo}, ${timePeriodLabel})`,
            x: 0.5,
            font: { size: 16 }
        },
        xaxis: xAxisConfig,
        yaxis: {
            title: metricName,
            linecolor: 'rgba(0,0,0,0)',  // Make y-axis line transparent
            linewidth: 0,                 // Remove y-axis line width
            showline: false              // Explicitly hide the y-axis line
        },
        plot_bgcolor: '#f8f9fa',
        paper_bgcolor: 'white',
        showlegend: true
    };

    const mobileLayout = getMobileLayout(layout);
    const config = getMobileConfig();

    // Clear the div first to ensure proper redraw
    chartDiv.innerHTML = '';

    Plotly.newPlot(chartDiv, traces, mobileLayout, config).then(() => {
        // Force resize after plot is ready
        if (isMobile()) {
            setTimeout(() => {
                Plotly.Plots.resize(chartDiv);
            }, 100);
        }
    });
}

function updateIndividualScatterplot() {
    const chartDiv = document.getElementById('individualScatterChart');

    if (individualModelData.length === 0) {
        chartDiv.innerHTML = '<div class="empty-state"><h3>No data to display</h3><p>No data found for the selected model and filters.</p></div>';
        return;
    }

    const timePeriod = individualElements.timePeriodSelect.value;
    const processedData = processDataForScatterplot(individualModelData, timePeriod);

    if (processedData.length === 0) {
        chartDiv.innerHTML = '<div class="empty-state"><h3>No data to display</h3><p>No matching data found for the selected filters.</p></div>';
        return;
    }

    const traces = [{
        x: processedData.map(d => d.x),
        y: processedData.map(d => d.y),
        text: processedData.map(d => d.hoverText),
        mode: 'markers',
        type: 'scatter',
        name: individualElements.modelSelect.value,
        marker: {
            color: '#667eea',
            size: isMobile() ? 6 : 8,
            opacity: 0.7
        }
    }];

    const isAveraging = individualElements.scenarioSelect.value === '__AVERAGE__';
    const titlePrefix = isAveraging ? 'Average ' : '';
    const titleSuffix = isAveraging ? ' (across scenarios)' : '';
    const timePeriodLabel = timePeriod === 'week' ? 'Weekly Pattern' : 'Daily Pattern';

    // Configure x-axis based on time period
    let xAxisConfig;
    if (timePeriod === 'week') {
        xAxisConfig = {
            title: 'Day of Week',
            type: 'linear',
            tickmode: 'array',
            tickvals: [0, 1, 2, 3, 4, 5, 6, 7],
            ticktext: isMobile() ? ['S', 'M', 'T', 'W', 'T', 'F', 'S', 'S'] : ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
            range: [0, 7]
        };
    } else {
        xAxisConfig = {
            title: 'Time of Day (Hours)',
            type: 'linear',
            range: [0, 24],
            tickmode: 'linear',
            tick0: 0,
            dtick: isMobile() ? 6 : 4
        };
    }

    // Hide the zero-line / axis line
    xAxisConfig.zeroline = false;
    xAxisConfig.showline = false;
    xAxisConfig.linecolor = 'rgba(0,0,0,0)';

    const selectedMetric = individualElements.metricSelect.value;
    const chartTitle = `${titlePrefix}${selectedMetric || 'Metric'} - ${individualElements.modelSelect.value}${titleSuffix} (${timePeriodLabel})`;

    const layout = {
        title: {
            text: chartTitle,
            x: 0.5,
            font: { size: 16 }
        },
        xaxis: xAxisConfig,
        yaxis: {
            title: selectedMetric || 'Value',
            linecolor: 'rgba(0,0,0,0)',  // Make y-axis line transparent
            linewidth: 0,                 // Remove y-axis line width
            showline: false              // Explicitly hide the y-axis line
        },
        plot_bgcolor: '#f8f9fa',
        paper_bgcolor: 'white',
        showlegend: false
    };

    const mobileLayout = getMobileLayout(layout);
    const config = getMobileConfig();

    // Clear the div first to ensure proper redraw
    chartDiv.innerHTML = '';

    Plotly.newPlot(chartDiv, traces, mobileLayout, config).then(() => {
        // Force resize after plot is ready
        if (isMobile()) {
            setTimeout(() => {
                Plotly.Plots.resize(chartDiv);
            }, 100);
        }
    });
}

function processDataForScatterplot(data, timePeriod) {
    const processedData = [];

    if (timePeriod === 'week') {
        // Weekly view - show day of week + time of day (0-7 range)
        data.forEach(d => {
            if (d.run_timestamp && d.mean !== undefined && d.mean !== null && !isNaN(d.mean)) {
                const date = new Date(d.run_timestamp);
                const dayOfWeek = date.getDay(); // 0=Sunday, 1=Monday, ..., 6=Saturday
                const hourOfDay = date.getHours() + date.getMinutes() / 60 + date.getSeconds() / 3600; // Decimal hours
                const weekPosition = dayOfWeek + (hourOfDay / 24); // 0.0 = Sun 00:00, 1.0 = Mon 00:00, etc.

                const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

                processedData.push({
                    x: weekPosition,
                    y: d.mean,
                    model: d.model,
                    hoverText: `${dayNames[dayOfWeek]} ${date.toLocaleTimeString()}<br>` +
                             `Model: ${d.model}<br>` +
                             `Value: ${d.mean.toFixed(4)}<br>` +
                             `Scenario: ${d.scenario_class}<br>` +
                             `Original Date: ${new Date(d.run_timestamp).toLocaleDateString()}`
                });
            }
        });
    } else {
        // Daily view - collapse all data to time of day (0-24 hours)
        data.forEach(d => {
            if (d.run_timestamp && d.mean !== undefined && d.mean !== null && !isNaN(d.mean)) {
                const date = new Date(d.run_timestamp);
                const hourOfDay = date.getHours() + date.getMinutes() / 60 + date.getSeconds() / 3600; // Decimal hours

                processedData.push({
                    x: hourOfDay,
                    y: d.mean,
                    model: d.model,
                    hoverText: `Time: ${date.toLocaleTimeString()}<br>` +
                             `Model: ${d.model}<br>` +
                             `Value: ${d.mean.toFixed(4)}<br>` +
                             `Scenario: ${d.scenario_class}<br>` +
                             `Original Date: ${new Date(d.run_timestamp).toLocaleDateString()}`
                });
            }
        });
    }

    return processedData;
}

function updateVarianceChart() {
    const chartDiv = document.getElementById('allModelsVarianceChart');

    if (!isDataLoaded || allModelsData.length === 0) {
        chartDiv.innerHTML = '<div class="empty-state"><h3>No data to display</h3><p>Select filters to view model consistency analysis.</p></div>';
        return;
    }

    const varianceMetric = allModelsElements.varianceMetricSelect.value;
    const viewType = allModelsElements.varianceViewSelect.value;
    const mobile = isMobile();
    const smallMobile = isSmallMobile();

    let chartData = [];
    let chartTitle = '';
    let yAxisLabel = '';
    let traces = [];

    if (viewType === 'overall') {
        chartData = calculateOverallVarianceData(allModelsData, varianceMetric);
        chartTitle = `Overall Model Consistency (${getVarianceMetricLabel(varianceMetric)})`;
        yAxisLabel = getVarianceMetricLabel(varianceMetric);

        // Keep as bar chart for overall view
        traces = [{
            x: chartData.map(d => d.x),
            y: chartData.map(d => d.y),
            text: chartData.map(d => d.hoverText),
            type: 'bar',
            name: getVarianceMetricLabel(varianceMetric),
            marker: {
                color: chartData.map(d => d.color),
                opacity: 0.8,
                line: {
                    color: 'rgba(0,0,0,0.2)',
                    width: 1
                }
            }
        }];
    } else if (viewType === 'daily') {
        chartData = calculateDailyVarianceData(allModelsData, varianceMetric);
        chartTitle = `Daily Model Consistency Over Time (${getVarianceMetricLabel(varianceMetric)})`;
        yAxisLabel = getVarianceMetricLabel(varianceMetric);

        // Create line traces for each model
        const colors = ['#667eea', '#48bb78', '#ed8936', '#e53e3e', '#9f7aea', '#38b2ac', '#d69e2e', '#805ad5', '#dd6b20'];
        chartData.forEach((modelData, index) => {
            const color = colors[index % colors.length];

            // Truncate long model names for mobile legend
            const displayName = mobile && modelData.model.length > 20 ?
                modelData.model.substring(0, 17) + '...' : modelData.model;

            traces.push({
                x: modelData.timeSeries.map(d => d.date),
                y: modelData.timeSeries.map(d => d.value),
                text: modelData.timeSeries.map(d =>
                    `${modelData.model}<br>Date: ${d.date.toLocaleDateString()}<br>${getVarianceMetricLabel(varianceMetric)}: ${d.value.toFixed(4)}<br>Data Points: ${d.dataPoints}${d.additionalInfo}`
                ),
                mode: 'lines+markers',
                type: 'scatter',
                name: displayName,
                line: { color: color, width: mobile ? 2 : 3 },
                marker: { color: color, size: mobile ? 4 : 6 }
            });
        });
    } else if (viewType === 'weekly') {
        chartData = calculateWeeklyVarianceData(allModelsData, varianceMetric);
        chartTitle = `Weekly Model Consistency Over Time (${getVarianceMetricLabel(varianceMetric)})`;
        yAxisLabel = getVarianceMetricLabel(varianceMetric);

        // Create line traces for each model
        const colors = ['#667eea', '#48bb78', '#ed8936', '#e53e3e', '#9f7aea', '#38b2ac', '#d69e2e', '#805ad5', '#dd6b20'];
        chartData.forEach((modelData, index) => {
            const color = colors[index % colors.length];

            // Truncate long model names for mobile legend
            const displayName = mobile && modelData.model.length > 20 ?
                modelData.model.substring(0, 17) + '...' : modelData.model;

            traces.push({
                x: modelData.timeSeries.map(d => d.date),
                y: modelData.timeSeries.map(d => d.value),
                text: modelData.timeSeries.map(d => {
                    const weekLabel = `${d.date.toLocaleDateString()} - ${d.endDate.toLocaleDateString()}`;
                    return `${modelData.model}<br>Week: ${weekLabel}<br>${getVarianceMetricLabel(varianceMetric)}: ${d.value.toFixed(4)}<br>Data Points: ${d.dataPoints}${d.additionalInfo}`;
                }),
                mode: 'lines+markers',
                type: 'scatter',
                name: displayName,
                line: { color: color, width: mobile ? 2 : 3 },
                marker: { color: color, size: mobile ? 4 : 6 }
            });
        });
    }

    if (traces.length === 0) {
        chartDiv.innerHTML = '<div class="empty-state"><h3>No data to display</h3><p>Not enough data points to calculate variance metrics. Each model needs multiple runs per day/week to show consistency patterns.</p></div>';
        return;
    }

    const metricName = allModelsElements.metricSelect.value || 'Performance';
    const scenarioInfo = allModelsElements.scenarioSelect.value === '__AVERAGE__' ?
        'Avg across scenarios' :
        allModelsElements.scenarioSelect.value || 'All scenarios';
    const providerInfo = allModelsElements.providerSelect.value ?
        ` (${allModelsElements.providerSelect.value} models)` : '';

    // Adjust title for mobile
    const fullTitle = `${chartTitle} - ${metricName}${providerInfo} (${scenarioInfo})`;
    const mobileTitle = mobile && fullTitle.length > 60 ?
        `${chartTitle.split(' (')[0]} - ${metricName}` : fullTitle;

    const layout = {
        title: {
            text: mobileTitle,
            x: 0.5,
            font: { size: 16 }
        },
        xaxis: {
            title: viewType === 'overall' ? 'Model' : 'Date',
            tickangle: viewType === 'overall' ? -45 : 0,
            type: viewType === 'overall' ? 'category' : 'date',
            // For overall view, auto-adjust margins for long model names
            automargin: viewType === 'overall'
        },
        yaxis: {
            title: yAxisLabel
        },
        plot_bgcolor: '#f8f9fa',
        paper_bgcolor: 'white',
        showlegend: viewType !== 'overall', // Show legend for time series, hide for bar chart
        // Increase bottom margin for overall view to accommodate long model names
        margin: viewType === 'overall' ? {
            t: 60,
            r: 50,
            b: 150, // Extra space for rotated model names
            l: 80
        } : undefined
    };

    // Additional mobile optimizations for multi-line charts
    if (mobile && viewType !== 'overall' && traces.length > 6) {
        // If too many lines on mobile, adjust legend positioning and chart height
        layout.margin = {
            t: smallMobile ? 40 : 50,
            r: smallMobile ? 15 : 25,
            b: smallMobile ? 140 : 130, // Extra space for wrapped legend
            l: smallMobile ? 40 : 55
        };
    }

    const mobileLayout = getMobileLayout(layout);
    const config = getMobileConfig();

    // Clear the div first to ensure proper redraw
    chartDiv.innerHTML = '';

    Plotly.newPlot(chartDiv, traces, mobileLayout, config).then(() => {
        // Force resize after plot is ready
        if (isMobile()) {
            setTimeout(() => {
                Plotly.Plots.resize(chartDiv);
            }, 100);
        }
    });
}

function getVarianceMetricLabel(metric) {
    switch (metric) {
        case 'std': return 'Standard Deviation';
        case 'variance': return 'Variance';
        case 'range': return 'Range (Max - Min)';
        default: return 'Variance Metric';
    }
}

function calculateOverallVarianceData(data, metric) {
    // Group by model
    const modelGroups = d3.group(data, d => d.model);
    const colors = ['#667eea', '#48bb78', '#ed8936', '#e53e3e', '#9f7aea', '#38b2ac', '#d69e2e', '#805ad5', '#dd6b20'];
    let colorIndex = 0;

    const chartData = [];

    modelGroups.forEach((modelData, modelName) => {
        const values = modelData.map(d => d.mean).filter(v => v !== undefined && v !== null && !isNaN(v));

        if (values.length > 1) { // Need at least 2 points for variance
            let metricValue;
            let additionalInfo = '';

            switch (metric) {
                case 'std':
                    metricValue = d3.deviation(values);
                    break;
                case 'variance':
                    metricValue = d3.variance(values);
                    break;
                case 'range':
                    metricValue = d3.max(values) - d3.min(values);
                    additionalInfo = `<br>Min: ${d3.min(values).toFixed(4)}<br>Max: ${d3.max(values).toFixed(4)}`;
                    break;
                default:
                    metricValue = d3.deviation(values);
            }

            // Truncate long model names for display but keep full name in hover
            const displayName = modelName.length > 25 ? modelName.substring(0, 22) + '...' : modelName;

            chartData.push({
                x: displayName,
                y: metricValue,
                color: colors[colorIndex % colors.length],
                hoverText: `${modelName}<br>${getVarianceMetricLabel(metric)}: ${metricValue.toFixed(4)}<br>Data Points: ${values.length}${additionalInfo}`
            });
            colorIndex++;
        }
    });

    // Sort by metric value descending
    chartData.sort((a, b) => b.y - a.y);

    return chartData;
}

function calculateDailyVarianceData(data, metric) {
    // Group by model first, then by date
    const modelGroups = d3.group(data, d => d.model);
    const allModels = [];

    modelGroups.forEach((modelData, modelName) => {
        const dateGroups = d3.group(modelData, d => d.run_date ? d.run_date.toDateString() : 'Unknown');
        const modelTimeSeries = [];

        dateGroups.forEach((dayData, dateStr) => {
            if (dateStr === 'Unknown') return;

            // Get all runs for this model on this day
            const values = dayData.map(d => d.mean).filter(v => v !== undefined && v !== null && !isNaN(v));

            // Only calculate variance if we have multiple data points for this model on this day
            if (values.length > 1) {
                let metricValue;
                let additionalInfo = '';

                switch (metric) {
                    case 'std':
                        metricValue = d3.deviation(values);
                        break;
                    case 'variance':
                        metricValue = d3.variance(values);
                        break;
                    case 'range':
                        metricValue = d3.max(values) - d3.min(values);
                        additionalInfo = `<br>Min: ${d3.min(values).toFixed(4)}<br>Max: ${d3.max(values).toFixed(4)}`;
                        break;
                    default:
                        metricValue = d3.deviation(values);
                }

                const date = new Date(dateStr);
                modelTimeSeries.push({
                    date: date,
                    value: metricValue,
                    dataPoints: values.length,
                    additionalInfo: additionalInfo
                });
            }
        });

        // Only include models that have at least some variance data
        if (modelTimeSeries.length > 0) {
            // Sort by date
            modelTimeSeries.sort((a, b) => a.date - b.date);

            allModels.push({
                model: modelName,
                timeSeries: modelTimeSeries
            });
        }
    });

    return allModels;
}

function calculateWeeklyVarianceData(data, metric) {
    // Group by model first, then by week
    const modelGroups = d3.group(data, d => d.model);
    const allModels = [];

    modelGroups.forEach((modelData, modelName) => {
        const weekGroups = d3.group(modelData, d => {
            if (!d.run_date) return 'Unknown';
            const date = new Date(d.run_date);
            // Get the Monday of the week
            const monday = new Date(date);
            monday.setDate(date.getDate() - date.getDay() + 1);
            return monday.toDateString();
        });

        const modelTimeSeries = [];

        weekGroups.forEach((weekData, weekStart) => {
            if (weekStart === 'Unknown') return;

            // Get all runs for this model during this week
            const values = weekData.map(d => d.mean).filter(v => v !== undefined && v !== null && !isNaN(v));

            // Only calculate variance if we have multiple data points for this model during this week
            if (values.length > 1) {
                let metricValue;
                let additionalInfo = '';

                switch (metric) {
                    case 'std':
                        metricValue = d3.deviation(values);
                        break;
                    case 'variance':
                        metricValue = d3.variance(values);
                        break;
                    case 'range':
                        metricValue = d3.max(values) - d3.min(values);
                        additionalInfo = `<br>Min: ${d3.min(values).toFixed(4)}<br>Max: ${d3.max(values).toFixed(4)}`;
                        break;
                    default:
                        metricValue = d3.deviation(values);
                }

                const startDate = new Date(weekStart);
                const endDate = new Date(startDate);
                endDate.setDate(startDate.getDate() + 6);

                modelTimeSeries.push({
                    date: startDate,
                    endDate: endDate,
                    value: metricValue,
                    dataPoints: values.length,
                    additionalInfo: additionalInfo
                });
            }
        });

        // Only include models that have at least some variance data
        if (modelTimeSeries.length > 0) {
            // Sort by week start date
            modelTimeSeries.sort((a, b) => a.date - b.date);

            allModels.push({
                model: modelName,
                timeSeries: modelTimeSeries
            });
        }
    });

    return allModels;
}
