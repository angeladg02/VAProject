import './index.scss';
import * as d3 from 'd3';

//functionality import
import { drawStrategyGantt } from './StrategyGantt.js';
import { drawLineChart } from './LineChart.js';
import { drawParallelCoordinates } from './ParallelCoordinates.js';
import { drawPCAChart } from './PCAChart.js';
import { drawRankingsChart } from './RankingsChart.js';
//data import
import rawStintsData from '../data/stints_features.csv'; 
import rawLapsData from '../data/laps_enriched.csv'; 
import pcaData from '../data/pca_data.json';

const COMPOUND_COLORS = {
    "SOFT": "#e10600",
    "MEDIUM": "#ffeb3b",
    "HARD": "#ffffff",
    "INTERMEDIATE": "#4caf50",
    "WET": "#2196f3",
   
};

const TEAM_COLORS = {
    "Ferrari": "#e8002d",
    "McLaren": "#ff8000",
    "Mercedes": "#27f4d2",
    "Red Bull Racing": "#3671c6",
    "Aston Martin": "#229971",
    "Alpine": "#0093cc",
    "Williams": "#64c4ff",
    "RB": "#6692ff",
    "Kick Sauber": "#52e252",
    "Haas F1 Team": "#ffffff"
};

function createLegends() {
    // Legenda Mescole
    const compoundContainer = document.getElementById('compound-legend');
    compoundContainer.innerHTML = ''; // Pulisce prima di ricreare
    Object.entries(COMPOUND_COLORS).forEach(([name, color]) => {
        const item = document.createElement('div');
        item.className = 'legend-item';
        item.innerHTML = `<span class="color-box" style="background-color: ${color}"></span>${name}`;
        compoundContainer.appendChild(item);
    });

    // Legenda Team
    const teamContainer = document.getElementById('team-legend');
    teamContainer.innerHTML = ''; // Pulisce prima di ricreare
    Object.entries(TEAM_COLORS).forEach(([name, color]) => {
        const item = document.createElement('div');
        item.className = 'legend-item';
        item.innerHTML = `<span class="color-box" style="background-color: ${color}"></span>${name}`;
        teamContainer.appendChild(item);
    });
}
function initDashboard() {
    
    const stintsData = rawStintsData.map(d => ({ 
        ...d, LapStart: +d.LapStart, LapEnd: +d.LapEnd, StintNumber: +d.StintNumber, 
        AvgLapTime: +d.AvgLapTime, DegradationSlope: +d.DegradationSlope, 
        TyreLifeStart: +d.TyreLifeStart, TotalLaps: +d.TotalLaps 
    }));

    //draw lap time evolution
   // drawLineChart(rawLapsData, "#line-chart", {});
    
    //draw parallel coordinates
    //drawParallelCoordinates(rawLapsData, "#pcp-chart", {});

    //draw initial PCA
    //drawPCAChart(pcaData, "#pca-chart", {});

    // Disegna il grafico delle posizioni iniziale
    //drawRankingsChart(rawLapsData, "#position-chart", callbacks, []);

    //for user interactions, modify here:
    const callbacks = {
        onStintClick: (selectedStints) => {
            
            // Sincronizza tutti e 4 i grafici passandogli l'array degli stint selezionati!
            drawLineChart(rawLapsData, "#line-chart", callbacks, selectedStints);
            drawParallelCoordinates(rawLapsData, "#pcp-chart", callbacks, selectedStints);
            drawPCAChart(pcaData, "#pca-chart", callbacks, selectedStints);
            drawStrategyGantt(stintsData, "#gantt-chart", callbacks, selectedStints);

            drawRankingsChart(rawLapsData, "#position-chart", callbacks, selectedStints);

            // Aggiorna il pannello Analytics nella Sidebar
            const panel = document.querySelector("#analytics-panel");
            
            if (selectedStints.length === 1) {
                panel.innerHTML = `
                    <h3 style="color: #00ffcc;">Dettaglio Stint</h3>
                    <p>Pilota: <strong>${selectedStints[0].Driver}</strong></p>
                    <p>Mescola: <strong style="color: ${selectedStints[0].Compound === 'SOFT' ? '#e10600' : selectedStints[0].Compound === 'MEDIUM' ? '#ffeb3b' : '#ffffff'}">${selectedStints[0].Compound}</strong></p>
                    <p>Giri: ${selectedStints[0].LapStart} - ${selectedStints[0].LapEnd}</p>
                    <p>Degrado: <strong>${(+selectedStints[0].DegradationSlope).toFixed(3)} s/giro</strong></p>
                `;
            } else if (selectedStints.length > 1) {
                const avgDeg = d3.mean(selectedStints, s => +s.DegradationSlope) || 0;
                const listItems = selectedStints.map(s => 
                    `<li><strong>${s.Driver}</strong> (${s.Compound}): ${(+s.DegradationSlope).toFixed(3)} s/l</li>`
                ).join(""); 
                
                panel.innerHTML = `
                    <h3 style="color: #00ffcc;">Analisi Comparata (${selectedStints.length} Stint)</h3>
                    <p>Degrado Medio: <strong>${avgDeg.toFixed(3)} s/giro</strong></p>
                    <ul style="padding-left: 20px; font-size: 0.9rem;">${listItems}</ul>
                `;
            } else {
                panel.innerHTML = `<p>Seleziona gli stint sul Gantt o i dati sulla PCA per aggiornare le statistiche.</p>`;
            }
        },

        // --- NUOVA INTERAZIONE: DAL PARALLEL COORDINATES AL RESTO ---
        onPCPBrush: (activeStints) => {
            if (activeStints.length === 0) {
                // Resettiamo tutti i grafici se si cancella il filtro
                drawStrategyGantt(stintsData, "#gantt-chart", callbacks, []);
                drawLineChart(rawLapsData, "#line-chart", callbacks, []);
                drawPCAChart(pcaData, "#pca-chart", callbacks, []);
                drawRankingsChart(rawLapsData,"#position-chart", callbacks,[]);
                
                document.querySelector("#analytics-panel").innerHTML = `<p>Seleziona i dati sulla PCA per aggiornare le statistiche.</p>`;
                return;
            }

            // Mappiamo i dati aggregati provenienti dal PCP sui veri Stint del dataset
            const selectedStints = stintsData.filter(stint => {
                return activeStints.some(active => 
                    active.Driver === stint.Driver && 
                    // Controlla l'intersezione matematica per trovare lo stint corrispondente
                    Math.max(active.LapStart, stint.LapStart) <= Math.min(active.LapEnd, stint.LapEnd)
                );
            });

            // Aggiorna gli altri 3 grafici
            drawStrategyGantt(stintsData, "#gantt-chart", callbacks, selectedStints);
            drawLineChart(rawLapsData, "#line-chart", callbacks, selectedStints);
            drawPCAChart(pcaData, "#pca-chart", callbacks, selectedStints);
            // Aggiorna anche il Rankings Chart quando usi il filtro PCP
            drawRankingsChart(rawLapsData, "#position-chart", callbacks, selectedStints);

            // Aggiorna il pannello Analytics
            // Aggiorna il pannello Analytics nella Sidebar
            const panel = document.querySelector("#analytics-panel");
            
            if (selectedStints.length === 1) {
                // ... [codice esistente per 1 stint] ...
            } else if (selectedStints.length === 2) {
                // LOGICA CROSSOVER POINT PER LA SIDEBAR
                const s1 = selectedStints[0];
                const s2 = selectedStints[1];

                const m1 = s1.DegradationSlope;
                const mid1 = (s1.LapStart + s1.LapEnd) / 2;
                const q1 = s1.AvgLapTime - (m1 * mid1);

                const m2 = s2.DegradationSlope;
                const mid2 = (s2.LapStart + s2.LapEnd) / 2;
                const q2 = s2.AvgLapTime - (m2 * mid2);

                let crossoverText = "Le strategie non si incrociano.";
                
                if (m1 !== m2) {
                    const crossoverLap = Math.round((q2 - q1) / (m1 - m2));
                    if (crossoverLap > 0) {
                        // Chi sorpassa? Chi ha la pendenza minore (m) sarà più veloce dopo il crossover (tempi sul giro più bassi)
                        const winner = m1 < m2 ? s1.Driver : s2.Driver;
                        const loser = m1 < m2 ? s2.Driver : s1.Driver;
                        crossoverText = `<strong>${winner}</strong> sorpassa <strong>${loser}</strong> al giro <strong>~${crossoverLap}</strong>`;
                    }
                }

                const deltaDeg = Math.abs(m1 - m2).toFixed(3);

                panel.innerHTML = `
                    <h3 style="color: #00ffcc;">Crossover Point</h3>
                    <p>${crossoverText}</p>
                    <p><strong>Compound:</strong> ${s1.Driver} (<span style="color: ${s1.Compound === 'SOFT' ? '#e10600' : s1.Compound === 'MEDIUM' ? '#ffeb3b' : '#ffffff'}">${s1.Compound}</span>) vs ${s2.Driver} (<span style="color: ${s2.Compound === 'SOFT' ? '#e10600' : s2.Compound === 'MEDIUM' ? '#ffeb3b' : '#ffffff'}">${s2.Compound}</span>)</p>
                    <p><strong>Delta Degrado:</strong> ${deltaDeg} s/giro</p>
                    <ul style="padding-left: 20px; font-size: 0.9rem;">
                        <li><strong>${s1.Driver}:</strong> ${m1.toFixed(3)} s/l</li>
                        <li><strong>${s2.Driver}:</strong> ${m2.toFixed(3)} s/l</li>
                    </ul>
                `;
            } else if (selectedStints.length > 2) {
                // ... [codice esistente per > 2 stint (se permesso)] ...
            } else {
                panel.innerHTML = `<p>Seleziona gli stint sul Gantt o i dati sulla PCA per aggiornare le statistiche.</p>`;
            }
        },

        // --- Dentro index.js, nei callbacks ---
        onRankingBrush: (selectedDrivers, minLap, maxLap) => {
            if (!selectedDrivers || selectedDrivers.length === 0) {
                drawStrategyGantt(stintsData, "#gantt-chart", callbacks, []);
                drawLineChart(rawLapsData, "#line-chart", callbacks, []);
                drawParallelCoordinates(rawLapsData, "#pcp-chart", callbacks, []);
                drawPCAChart(pcaData, "#pca-chart", callbacks, []);
                
                document.querySelector("#analytics-panel").innerHTML = `<p>Seleziona i dati sui grafici per aggiornare le statistiche.</p>`;
                return;
            }

            // ---> MODIFICA: Filtriamo gli stint controllando ANCHE l'intersezione matematica dei giri!
            const selectedStints = stintsData.filter(stint => {
                // 1. Il pilota deve essere tra quelli selezionati
                const isRightDriver = selectedDrivers.includes(stint.Driver);
                
                // 2. Lo stint deve sovrapporsi (anche parzialmente) al range selezionato dal brush
                const overlapsLaps = (stint.LapStart <= maxLap) && (stint.LapEnd >= minLap);

                return isRightDriver && overlapsLaps;
            });

            // Passiamo gli stint correttamente filtrati agli altri grafici
            drawStrategyGantt(stintsData, "#gantt-chart", callbacks, selectedStints);
            drawLineChart(rawLapsData, "#line-chart", callbacks, selectedStints);
            drawParallelCoordinates(rawLapsData, "#pcp-chart", callbacks, selectedStints);
            drawPCAChart(pcaData, "#pca-chart", callbacks, selectedStints);

            // Aggiorniamo la Sidebar
            const panel = document.querySelector("#analytics-panel");
            panel.innerHTML = `
                <h3 style="color: #00ffcc;">Analisi dal Ranking</h3>
                <p>Range di giri: <strong>${minLap} - ${maxLap}</strong></p>
                <p>Piloti coinvolti: <strong>${selectedDrivers.length}</strong></p>
                <p>Stint evidenziati: <strong>${selectedStints.length}</strong></p>
            `;
        },
        
        onPitClick: (pitData) => { /* ... */ }
    };
    //draw the gantt chart
    drawStrategyGantt(stintsData, "#gantt-chart", callbacks);
    // draw lap time evolution
    drawLineChart(rawLapsData, "#line-chart", callbacks); 
    
    // draw parallel coordinates
    drawParallelCoordinates(rawLapsData, "#pcp-chart", callbacks);

    // draw initial PCA
    drawPCAChart(pcaData, "#pca-chart", callbacks); // <-- Questo fa funzionare la PCA da subito!

    // Disegna il grafico delle posizioni iniziale
    drawRankingsChart(rawLapsData, "#position-chart", callbacks, []);

    // draw the gantt chart
    drawStrategyGantt(stintsData, "#gantt-chart", callbacks)
}

initDashboard();
createLegends();
