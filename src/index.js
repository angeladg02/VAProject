import './index.scss'; 
import f1Data from '../data/Dutch_Grand_Prix_Weighted.csv'; 
import * as d3 from 'd3';

import { drawScatterPlot, highlightScatter } from './Scatterplot.js';
import { drawParallelCoordinates, highlightParallel } from './ParallelCoordinates.js';
import { drawLapTimeDelta, highlightLapTime } from './LapTimeDelta.js';
import { drawStrategyBarChart, highlightStrategy } from './StrategyBarChart.js';

// Pre-processing
f1Data.forEach(d => {
    d.pca_x = +d.pca_x; d.pca_y = +d.pca_y;
    d.LapNumber = +d.LapNumber; d.LapTime_Sec = +d.LapTime_Sec;
    d.S1_Delta = +d.S1_Delta; d.S2_Delta = +d.S2_Delta; d.S3_Delta = +d.S3_Delta;
});

function updateAnalytics(selectedData) {
    const data = selectedData.length > 0 ? selectedData : f1Data;
    
    // 1. Conteggio
    d3.select("#stat-count").text(selectedData.length > 0 ? selectedData.length : "Tutti (" + f1Data.length + ")");
    
    // 2. Media tempi (La parte "Analytics" richiesta dall'esame)
    const avg = d3.mean(data, d => d.LapTime_Sec);
    d3.select("#stat-avg-time").text(avg.toFixed(3));
    
    // 3. Pilota più veloce nella selezione
    const bestLap = d3.min(data, d => d.LapTime_Sec);
    const bestDriver = data.find(d => d.LapTime_Sec === bestLap)?.Driver || "-";
    d3.select("#stat-best-driver").text(bestDriver);
}

function handleSelection(selectedData, sourceChart) {
    updateAnalytics(selectedData);
    const dataToHighlight = selectedData.length > 0 ? selectedData : f1Data;
    
    if (sourceChart !== 'scatter') highlightScatter(dataToHighlight);
    if (sourceChart !== 'parallel') highlightParallel(dataToHighlight);
    if (sourceChart !== 'laptime') highlightLapTime(dataToHighlight);
    if (sourceChart !== 'strategy') highlightStrategy(dataToHighlight);
}

// Inizializzazione
drawScatterPlot(f1Data, "#scatterplot-container", (d) => handleSelection(d, 'scatter'));
drawParallelCoordinates(f1Data, "#parallel-container", (d) => handleSelection(d, 'parallel'));
drawLapTimeDelta(f1Data, "#laptime-container", (d) => handleSelection(d, 'laptime'));
drawStrategyBarChart(f1Data, "#strategy-container", (d) => handleSelection(d, 'strategy'));

// Set iniziale analytics
updateAnalytics([]);