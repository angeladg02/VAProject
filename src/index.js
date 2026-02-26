import './index.scss'; 
import f1Data from '../data/Dutch_Grand_Prix_Weighted.csv'; 
import * as d3 from 'd3';

import { drawScatterPlot, highlightScatter } from './Scatterplot.js';
import { drawParallelCoordinates, highlightParallel } from './ParallelCoordinates.js';
import { drawLapTimeDelta, highlightLapTime, drawDegradationLine, calculateRegression } from './LapTimeDelta.js';
import { drawStrategyBarChart, highlightStrategy } from './StrategyBarChart.js';
import { drawBoxPlot } from './BoxPlot.js';

// Pre-processing
f1Data.forEach(d => {
    d.pca_x = +d.pca_x; d.pca_y = +d.pca_y;
    d.LapNumber = +d.LapNumber; d.LapTime_Sec = +d.LapTime_Sec;
    d.S1_Delta = +d.S1_Delta; d.S2_Delta = +d.S2_Delta; d.S3_Delta = +d.S3_Delta;
    d.TrackTemp = +d.TrackTemp; d.AirTemp = +d.AirTemp; d.TyreLife = +d.TyreLife;
});

/**
 * 1. AGGIORNAMENTO SIDEBAR (KPI & ANALYTICS)
 */
function updateAnalytics(selectedData) {
    const isSelectionEmpty = selectedData.length === 0;
    const data = isSelectionEmpty ? f1Data : selectedData;
    
    // Conteggio
    d3.select("#stat-count").text(isSelectionEmpty ? "Tutti (" + f1Data.length + ")" : selectedData.length);
    
    // Media tempi
    const avg = d3.mean(data, d => d.LapTime_Sec);
    d3.select("#stat-avg-time").text(avg ? avg.toFixed(3) : "0.000");
    
    // Pilota più veloce
    const bestLap = d3.min(data, d => d.LapTime_Sec);
    const bestDriver = data.find(d => d.LapTime_Sec === bestLap)?.Driver || "-";
    d3.select("#stat-best-driver").text(bestDriver);

    // Meteo (Details-on-demand)
    const avgTrack = d3.mean(data, d => d.TrackTemp);
    const avgAir = d3.mean(data, d => d.AirTemp);
    const isRaining = data.some(d => String(d.Rainfall).toLowerCase() === 'true');
    
    d3.select("#stat-track-temp").text(avgTrack ? `${avgTrack.toFixed(1)}°C` : "-°C");
    d3.select("#stat-air-temp").text(avgAir ? `${avgAir.toFixed(1)}°C` : "-°C");
    d3.select("#stat-rain-icon").text(isRaining ? "🌧️" : "☀️");

    // Modello Degrado Gomme (Regressione Lineare)
    if (!isSelectionEmpty && selectedData.length > 1) {
        const msPerLap = drawDegradationLine("#laptime-container", selectedData, f1Data);
        d3.select("#stat-degradation").text(msPerLap ? msPerLap.toFixed(1) : "0.0");
    } else {
        d3.selectAll(".regression-line").remove();
        d3.select("#stat-degradation").text("0.0");
    }
}

/**
 * 2. COORDINAZIONE (HANDLE SELECTION)
 */
function handleSelection(selectedData, sourceChart) {
    // Aggiorna Sidebar e Modelli
    updateAnalytics(selectedData);
    
    // Evidenzia i punti corrispondenti in tutti i grafici
    const dataToHighlight = selectedData.length > 0 ? selectedData : f1Data;
    
    if (sourceChart !== 'scatter') highlightScatter(dataToHighlight);
    if (sourceChart !== 'parallel') highlightParallel(dataToHighlight);
    if (sourceChart !== 'laptime') highlightLapTime(dataToHighlight);
    if (sourceChart !== 'strategy') highlightStrategy(dataToHighlight);

    // Aggiorna il Box Plot con i dati selezionati (o tutti se vuoto)
    const dataForBox = selectedData.length > 0 ? selectedData : f1Data;
    drawBoxPlot(dataForBox, "#boxplot-container");
}

/**
 * 3. INIZIALIZZAZIONE
 */
drawScatterPlot(f1Data, "#scatterplot-container", (d) => handleSelection(d, 'scatter'));
drawParallelCoordinates(f1Data, "#parallel-container", (d) => handleSelection(d, 'parallel'));
drawLapTimeDelta(f1Data, "#laptime-container", (d) => handleSelection(d, 'laptime'));
drawStrategyBarChart(f1Data, "#strategy-container", (d) => handleSelection(d, 'strategy'));

drawBoxPlot(f1Data, "#boxplot-container");

// Stato iniziale
updateAnalytics([]);