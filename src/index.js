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
    // Legenda Mescole (Sostituisce la vecchia lista Tyre)
    const compoundContainer = document.getElementById('compound-legend');
    compoundContainer.innerHTML = ''; 

    // Spiegazione testuale rapida
    const explanation = document.createElement('p');
    explanation.style.cssText = "font-size: 0.75rem; color: #888; margin-bottom: 12px; line-height: 1.2;";
    explanation.innerText = "L'opacità decrescente indica l'usura (fresca → consumata).";
    compoundContainer.appendChild(explanation);

    // Creazione delle barre per ogni mescola definita in COMPOUND_COLORS
    Object.entries(COMPOUND_COLORS).forEach(([name, color]) => {
        const wrapper = document.createElement('div');
        wrapper.className = 'compound-wear-row';
        wrapper.style.cssText = "margin-bottom: 10px; display: flex; flex-direction: column; gap: 4px;";

        wrapper.innerHTML = `
            <div style="display: flex; justify-content: space-between; font-size: 0.75rem; font-weight: bold;">
                <span>${name}</span>
                <span style="font-weight: normal; opacity: 0.6;">Fresca → Consumata</span>
            </div>
            <div class="wear-bar" style="
                height: 8px; 
                border-radius: 4px; 
                background: linear-gradient(to right, ${color} 100%, ${color} 30%);
                opacity: 0.9;
                background: linear-gradient(to right, ${color}, rgba(${hexToRgb(color)}, 0.2));
            "></div>
        `;
        compoundContainer.appendChild(wrapper);
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

    // =========================================================
    // 1. CALCOLO STATISTICHE GLOBALI (FISSE PER LA SIDEBAR)
    // =========================================================
    const totalStints = stintsData.length;
    // Pit stops = tutti gli stint successivi al primo
    const totalPitStops = stintsData.filter(d => d.StintNumber > 1).length;

    // Estrazione Temperature (ignoriamo i valori a 0 o invalidi)
    const validTrackTemps = rawLapsData.filter(d => +d.TrackTemp > 0).map(d => +d.TrackTemp);
    const avgTrackTemp = validTrackTemps.length ? d3.mean(validTrackTemps) : 0;

    const validAirTemps = rawLapsData.filter(d => +d.AirTemp > 0).map(d => +d.AirTemp);
    const avgAirTemp = validAirTemps.length ? d3.mean(validAirTemps) : 0;

    // Conteggio Distribuzione Mescole
    const compoundCounts = d3.rollup(stintsData, v => v.length, d => d.Compound);
    const softCount = compoundCounts.get("SOFT") || 0;
    const medCount = compoundCounts.get("MEDIUM") || 0;
    const hardCount = compoundCounts.get("HARD") || 0;
    const intCount = compoundCounts.get("INTERMEDIATE") || 0;
    const wetCount = compoundCounts.get("WET") || 0;

    // Generiamo l'HTML statico che rimarrà sempre in cima al pannello Analytics
    const globalOverviewHTML = `
        <div style="margin-bottom: 15px; padding-bottom: 15px; border-bottom: 1px solid #333344;">
            <h3 style="color: #00ffcc; margin-top: 0; font-size: 0.95rem; text-transform: uppercase;">Race Overview</h3>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; font-size: 0.85rem;">
                <div>Stints: <strong style="color: #fff;">${totalStints}</strong></div>
                <div>Pit Stops: <strong style="color: #fff;">${totalPitStops}</strong></div>
                <div>Track: <strong style="color: #fff;">${avgTrackTemp.toFixed(1)}°C</strong></div>
                <div>Air: <strong style="color: #fff;">${avgAirTemp.toFixed(1)}°C</strong></div>
            </div>
            <div style="margin-top: 10px; font-size: 0.85rem;">
                <strong style="display:block; margin-bottom: 4px;">Tyres Distribution:</strong>
                <span style="color:#e10600; font-weight:bold;">S: ${softCount}</span> |
                <span style="color:#ffeb3b; font-weight:bold;">M: ${medCount}</span> |
                <span style="color:#ffffff; font-weight:bold;">H: ${hardCount}</span>
                ${intCount > 0 ? `| <span style="color:#4caf50; font-weight:bold;">I: ${intCount}</span>` : ''}
                ${wetCount > 0 ? `| <span style="color:#2196f3; font-weight:bold;">W: ${wetCount}</span>` : ''}
            </div>
        </div>
    `;

    // =========================================================
    // 2. FUNZIONE HELPER PER AGGIORNARE LA SIDEBAR
    // =========================================================
    // Questa funzione unisce i dati globali fissi con i dettagli dinamici del brush
    const updateSidebar = (specificHTML = "") => {
        const panel = document.querySelector("#analytics-panel");
        
        // Se non c'è nessuna selezione, mostriamo dati medi extra come riempitivo
        if (!specificHTML) {
            const validDeg = stintsData.filter(d => d.DegradationSlope > 0);
            const avgDegradation = validDeg.length > 0 ? d3.mean(validDeg, d => d.DegradationSlope) : 0;
            const validLaps = rawLapsData.filter(d => +d.LapTimeSeconds > 0);
            const fastestLap = validLaps.reduce((min, p) => +p.LapTimeSeconds < +min.LapTimeSeconds ? p : min, validLaps[0]);

            specificHTML = `
                <h3 style="color: #888894; font-size: 0.85rem; text-transform: uppercase;">Performance Globale</h3>
                <p style="font-size: 0.85rem;">Degrado Medio: <strong>${avgDegradation.toFixed(3)} s/giro</strong></p>
                ${fastestLap ? `<p style="font-size: 0.85rem;">Giro Veloce: <strong>${fastestLap.Driver}</strong> (${(+fastestLap.LapTimeSeconds).toFixed(3)}s al L${fastestLap.LapNumber})</p>` : ''}
                <p style="font-size: 0.8rem; color: #888894; margin-top: 15px;"><i>Usa il brush o clicca sui grafici per esplorare le strategie. Doppio click per ripristinare.</i></p>
            `;
        }
        // Incolla tutto insieme
        panel.innerHTML = globalOverviewHTML + '<div class="selection-details">' + specificHTML + '</div>';
    };

    // =========================================================
    // 3. CALLBACKS DEI GRAFICI AGGIORNATI
    // =========================================================
    const callbacks = {
        onStintClick: (selectedStints) => {
            drawLineChart(rawLapsData, "#line-chart", callbacks, selectedStints);
            drawParallelCoordinates(rawLapsData, "#pcp-chart", callbacks, selectedStints);
            drawPCAChart(pcaData, "#pca-chart", callbacks, selectedStints);
            drawStrategyGantt(stintsData, "#gantt-chart", callbacks, selectedStints);
            drawRankingsChart(rawLapsData, "#position-chart", callbacks, selectedStints);

            let specificHTML = "";
            if (selectedStints.length === 1) {
                specificHTML = `
                    <h3 style="color: #00ffcc; font-size: 0.95rem;">Dettaglio Stint</h3>
                    <p style="font-size: 0.85rem;">Pilota: <strong>${selectedStints[0].Driver}</strong></p>
                    <p style="font-size: 0.85rem;">Mescola: <strong style="color: ${selectedStints[0].Compound === 'SOFT' ? '#e10600' : selectedStints[0].Compound === 'MEDIUM' ? '#ffeb3b' : '#ffffff'}">${selectedStints[0].Compound}</strong></p>
                    <p style="font-size: 0.85rem;">Giri: ${selectedStints[0].LapStart} - ${selectedStints[0].LapEnd}</p>
                    <p style="font-size: 0.85rem;">Degrado: <strong>${(+selectedStints[0].DegradationSlope).toFixed(3)} s/giro</strong></p>
                `;
            } else if (selectedStints.length > 1) {
                const avgDeg = d3.mean(selectedStints, s => +s.DegradationSlope) || 0;
                const listItems = selectedStints.map(s => 
                    `<li><strong>${s.Driver}</strong> (${s.Compound}): ${(+s.DegradationSlope).toFixed(3)} s/l</li>`
                ).join(""); 
                specificHTML = `
                    <h3 style="color: #00ffcc; font-size: 0.95rem;">Analisi Comparata (${selectedStints.length} Stint)</h3>
                    <p style="font-size: 0.85rem;">Degrado Medio: <strong>${avgDeg.toFixed(3)} s/giro</strong></p>
                    <ul style="padding-left: 20px; font-size: 0.85rem;">${listItems}</ul>
                `;
            }
            updateSidebar(specificHTML);
        },

        onPCPBrush: (activeStints) => {
            if (activeStints.length === 0) {
                drawStrategyGantt(stintsData, "#gantt-chart", callbacks, []);
                drawLineChart(rawLapsData, "#line-chart", callbacks, []);
                drawPCAChart(pcaData, "#pca-chart", callbacks, []);
                drawRankingsChart(rawLapsData,"#position-chart", callbacks,[]);
                
                updateSidebar(""); // Stringa vuota ripristina i dati di default
                return;
            }

            const selectedStints = stintsData.filter(stint => {
                return activeStints.some(active => 
                    active.Driver === stint.Driver && 
                    Math.max(active.LapStart, stint.LapStart) <= Math.min(active.LapEnd, stint.LapEnd)
                );
            });

            drawStrategyGantt(stintsData, "#gantt-chart", callbacks, selectedStints);
            drawLineChart(rawLapsData, "#line-chart", callbacks, selectedStints);
            drawPCAChart(pcaData, "#pca-chart", callbacks, selectedStints);
            drawRankingsChart(rawLapsData, "#position-chart", callbacks, selectedStints);

            let specificHTML = "";
            if (selectedStints.length === 1) {
                // ... [uguale a onStintClick per 1 stint] ...
                 specificHTML = `
                    <h3 style="color: #00ffcc; font-size: 0.95rem;">Dettaglio Stint</h3>
                    <p style="font-size: 0.85rem;">Pilota: <strong>${selectedStints[0].Driver}</strong></p>
                    <p style="font-size: 0.85rem;">Mescola: <strong style="color: ${selectedStints[0].Compound === 'SOFT' ? '#e10600' : selectedStints[0].Compound === 'MEDIUM' ? '#ffeb3b' : '#ffffff'}">${selectedStints[0].Compound}</strong></p>
                    <p style="font-size: 0.85rem;">Giri: ${selectedStints[0].LapStart} - ${selectedStints[0].LapEnd}</p>
                `;
            } else if (selectedStints.length === 2) {
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
                        const winner = m1 < m2 ? s1.Driver : s2.Driver;
                        const loser = m1 < m2 ? s2.Driver : s1.Driver;
                        crossoverText = `<strong>${winner}</strong> sorpassa <strong>${loser}</strong> al giro <strong>~${crossoverLap}</strong>`;
                    }
                }

                const deltaDeg = Math.abs(m1 - m2).toFixed(3);
                specificHTML = `
                    <h3 style="color: #00ffcc; font-size: 0.95rem;">Crossover Point</h3>
                    <p style="font-size: 0.85rem;">${crossoverText}</p>
                    <p style="font-size: 0.85rem;"><strong>Delta Degrado:</strong> ${deltaDeg} s/giro</p>
                    <ul style="padding-left: 20px; font-size: 0.85rem;">
                        <li><strong>${s1.Driver}:</strong> ${m1.toFixed(3)} s/l</li>
                        <li><strong>${s2.Driver}:</strong> ${m2.toFixed(3)} s/l</li>
                    </ul>
                `;
            } else {
                specificHTML = `
                    <h3 style="color: #00ffcc; font-size: 0.95rem;">Cluster Selezionato</h3>
                    <p style="font-size: 0.85rem;">Stint evidenziati: <strong>${selectedStints.length}</strong></p>
                `;
            }
            updateSidebar(specificHTML);
        },

        onRankingBrush: (selectedDrivers, minLap, maxLap) => {
            if (!selectedDrivers || selectedDrivers.length === 0) {
                drawStrategyGantt(stintsData, "#gantt-chart", callbacks, []);
                drawLineChart(rawLapsData, "#line-chart", callbacks, []);
                drawParallelCoordinates(rawLapsData, "#pcp-chart", callbacks, []);
                drawPCAChart(pcaData, "#pca-chart", callbacks, []);
                
                updateSidebar(""); // Ripristina stringa vuota
                return;
            }

            const selectedStints = stintsData.filter(stint => {
                const isRightDriver = selectedDrivers.includes(stint.Driver);
                const overlapsLaps = (stint.LapStart <= maxLap) && (stint.LapEnd >= minLap);
                return isRightDriver && overlapsLaps;
            });

            drawStrategyGantt(stintsData, "#gantt-chart", callbacks, selectedStints);
            drawLineChart(rawLapsData, "#line-chart", callbacks, selectedStints);
            drawParallelCoordinates(rawLapsData, "#pcp-chart", callbacks, selectedStints);
            drawPCAChart(pcaData, "#pca-chart", callbacks, selectedStints);

            let specificHTML = `
                <h3 style="color: #00ffcc; font-size: 0.95rem;">Analisi dal Ranking</h3>
                <p style="font-size: 0.85rem;">Range di giri: <strong>${minLap} - ${maxLap}</strong></p>
                <p style="font-size: 0.85rem;">Piloti coinvolti: <strong>${selectedDrivers.length}</strong></p>
                <p style="font-size: 0.85rem;">Stint evidenziati: <strong>${selectedStints.length}</strong></p>
            `;
            updateSidebar(specificHTML);
        },

        onReset: () => {
            drawStrategyGantt(stintsData, "#gantt-chart", callbacks, []);
            drawLineChart(rawLapsData, "#line-chart", callbacks, []);
            drawParallelCoordinates(rawLapsData, "#pcp-chart", callbacks, []);
            drawPCAChart(pcaData, "#pca-chart", callbacks, []);
            drawRankingsChart(rawLapsData, "#position-chart", callbacks, []);

            updateSidebar(""); // Mostrerà i dati globali + le stat di performance medie
        },

        onPitClick: (pitData) => { /* ... */ }
    };

    // ... [Il tuo codice per il primo rendering iniziale dei grafici rimane qui intatto] ...

    // FORZIAMO L'INIZIALIZZAZIONE DELLA SIDEBAR
    callbacks.onReset();
}

initDashboard();
createLegends();

// Funzione di utilità per gestire il gradiente con RGBA (da aggiungere in fondo a index.js o fuori dalla funzione)
function hexToRgb(hex) {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `${r}, ${g}, ${b}`;
}
