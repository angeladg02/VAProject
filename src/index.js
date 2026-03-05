import './index.scss';
import * as d3 from 'd3';

//functionality import
import { drawStrategyGantt } from './StrategyGantt.js';
import { drawLineChart } from './LineChart.js';
import { drawParallelCoordinates } from './ParallelCoordinates.js';
import { drawPCAChart } from './PCAChart.js';

//data import
import rawStintsData from '../data/stints_features.csv'; 
import rawLapsData from '../data/laps_enriched.csv'; 
import pcaData from '../data/pca_data.json';

function initDashboard() {
    
    const stintsData = rawStintsData.map(d => ({ 
        ...d, LapStart: +d.LapStart, LapEnd: +d.LapEnd, StintNumber: +d.StintNumber, 
        AvgLapTime: +d.AvgLapTime, DegradationSlope: +d.DegradationSlope, 
        TyreLifeStart: +d.TyreLifeStart, TotalLaps: +d.TotalLaps 
    }));

    //draw lap time evolution
    drawLineChart(rawLapsData, "#line-chart", {});
    
    //draw parallel coordinates
    drawParallelCoordinates(rawLapsData, "#pcp-chart", {});

    //draw initial PCA
    drawPCAChart(pcaData, "#pca-chart", {});

    //for user interactions, modify here:
    const callbacks = {
        //if user clicks on stints (so on the Gantt chart)
        onStintClick: (selectedStints) => {
            //when the user selects a stint, we draw the linechart for that
            drawLineChart(rawLapsData, "#line-chart", {}, selectedStints);
            
            // Opzionale: puoi aggiornare anche il PCP per evidenziare i giri dello stint selezionato!
            //drawParallelCoordinates(rawLapsData, "#pcp-chart", {}, selectedStints);

            //to update the sidebar
            /*
            const panel = document.querySelector("#analytics-panel");
            if (selectedStints.length === 1) {
                panel.innerHTML = `
                    <h3>Dettaglio Stint</h3>
                    <p>Pilota: <strong>${selectedStints[0].Driver}</strong></p>
                    <p>Compound: ${selectedStints[0].Compound}</p>
                    <p>Degrado: ${(+selectedStints[0].DegradationSlope).toFixed(3)} s/giro</p>
                `;
            } else if (selectedStints.length > 1) {
                const listItems = selectedStints.map(s => 
                    `<li><strong>${s.Driver}</strong> (${s.Compound}): ${(+s.DegradationSlope).toFixed(3)} s/giro</li>`
                ).join(""); 
                panel.innerHTML = `
                    <h3>Analisi Comparata Multipla</h3>
                    <p>Confronto degrado:</p>
                    <ul>${listItems}</ul>
                `;
            } else {
                panel.innerHTML = `<p>Seleziona gli stint sul Gantt o i dati sulla PCA per aggiornare le statistiche.</p>`;
            }
                */
        },

        //if the user clicks on the pistops on the Gantt chart
        onPitClick: (pitData) => { /* ... */ }
    };
    //draw the gantt chart
    drawStrategyGantt(stintsData, "#gantt-chart", callbacks);
}

initDashboard();