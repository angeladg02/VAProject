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
    "Red Bull ": "#3671c6",
    "Aston Martin": "#229971",
    "Alpine": "#0093cc",
    "Williams": "#64c4ff",
    "RB": "#6692ff",
    "Kick Sauber": "#52e252",
    "Haas F1": "#ffffff"
};

// Cerca la funzione createLegends() e modificala come segue:
function createLegends() {
    // 1. Legenda Mescole
    const compoundContainer = document.getElementById('compound-legend');
    compoundContainer.innerHTML = ''; 

    // Rimosso il blocco relativo a teamContainer (Team Legend)


    // 3. EVENT LEGEND
    const eventContainer = document.getElementById('event-legend');
    eventContainer.innerHTML = `
        <div class="legend-item" style="margin-right: 15px;">
            <svg width="14" height="14"><polygon points="0,0 12,0 6,10" fill="#ff3b3b"/></svg>
            <span style="margin-left:5px;">Pit Stop </span>
        </div>
        <div class="legend-item">
            <svg width="14" height="14"><path d="M2 14 L2 2 L10 4 L10 10 L2 8 Z" fill="#ffd400"/></svg>
            <span style="margin-left:5px;">Safety Car</span>
        </div>
    `;

    // 4. Generazione Barrette Tyres
    Object.entries(COMPOUND_COLORS).forEach(([name, color], index) => {
        const wrapper = document.createElement('div');
        wrapper.className = 'compound-wear-row';
        wrapper.style.cssText = "margin-bottom: 4px; display: flex; flex-direction: column; gap: 1px;";
        wrapper.innerHTML = `
            <div style="display: flex; justify-content: space-between; font-size: 0.7rem; font-weight: bold;">
                <span>${name}</span>
                ${index === 0 ? '<span style="font-weight: normal; color : white;">New → Worn</span>' : ''}
            </div>
            <div class="wear-bar" style="width:100%; height: 7px; border-radius: 3px; background: linear-gradient(to right, ${color}, rgba(${hexToRgb(color)}, 0.15));"></div>
        `;
        compoundContainer.appendChild(wrapper);
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
    // Calcoliamo i dati extra necessari per l'overview
const validDeg = stintsData.filter(d => d.DegradationSlope > 0);
const avgDegradation = validDeg.length > 0 ? d3.mean(validDeg, d => d.DegradationSlope) : 0;
const validLaps = rawLapsData.filter(d => +d.LapTimeSeconds > 0);
const fastestLap = validLaps.reduce((min, p) => +p.LapTimeSeconds < +min.LapTimeSeconds ? p : min, validLaps[0]);
// 1. Calcoliamo il numero totale di giri della gara
const maxLaps = d3.max(rawLapsData, d => +d.LapNumber) || 0;

const globalOverviewHTML = `
    <div style="margin-bottom: 15px; padding-bottom: 15px; border-bottom: 1px solid #333344;">
    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
            <h1 style="color: #f30303; margin: 0; font-size: 1.4rem; text-transform: uppercase; letter-spacing: 1px;">
                Monza 2024
            </h1>
            <span style="background: #333344; color: #fff; padding: 6px 6px; border-radius: 6px; font-size: 1.0rem; white-space: nowrap;">
                ${maxLaps} LAPS
            </span>
            
        </div>
         <div style="background: rgba(162, 0, 255, 0.1); padding: 8px; border-radius: 4px; border: 1px solid rgba(162, 0, 255, 0.3); margin-bottom: 15px;">
            <div style="font-size: 0.65rem; color: #a200ff; text-transform: uppercase; font-weight: bold;">Fastest Lap</div>
            <div style="display: flex; justify-content: space-between; align-items: baseline; margin-top: 4px;">
                <span style="font-size: 0.85rem; font-weight: bold; color: #fff;">${fastestLap ? fastestLap.Driver : 'N/A'}</span>
                <span style="font-size: 0.85rem; font-family: monospace; color: #f5f5f5;">${fastestLap ? (+fastestLap.LapTimeSeconds).toFixed(3) + 's' : '-'}</span>
            </div>
        </div>
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 15px;">
            <div style="background: rgba(255,255,255,0.03); padding: 8px; border-radius: 4px; border-left: 2px solid #e10600;">
                <div style="font-size: 0.65rem; color: #888894; text-transform: uppercase;">Avg Degradation</div>
                <div style="font-size: 0.9rem; font-weight: bold; color: #fff;">${avgDegradation.toFixed(3)} <span style="font-size: 0.6rem; font-weight: normal;">s/l</span></div>
            </div>
            <div style="background: rgba(255,255,255,0.03); padding: 8px; border-radius: 4px; border-left: 2px solid #ffd400;">
                <div style="font-size: 0.65rem; color: #888894; text-transform: uppercase;">Pit Stops</div>
                <div style="font-size: 0.9rem; font-weight: bold; color: #fff;">${totalPitStops}</div>
            </div>
        </div>

       

        <div style="font-size: 0.95rem; color: #888894; display: flex; justify-content: space-between; margin-bottom: 8px;">
            <span>Track: <strong style="color: #eee;">${avgTrackTemp.toFixed(1)}°C</strong></span>
            <span>Air: <strong style="color: #eee;">${avgAirTemp.toFixed(1)}°C</strong></span>
        </div>

        <div style="margin-top: 10px; font-size: 0.95rem;">
            <strong style="display:block; margin-bottom: 6px; font-size: 0.7rem; color: #888894; text-transform: uppercase;">Compound Usage:</strong>
            <div style="display: flex; gap: 10px; font-family: monospace;">
                <span style="color:#e10600;">S: ${softCount}</span>
                <span style="color:#ffeb3b;">M: ${medCount}</span>
                <span style="color:#ffffff;">H: ${hardCount}</span>
            </div>
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
                <h3 style="color: #888894; font-size: 0.85rem; text-transform: uppercase;">GLOBAL PERFORMANCE</h3>
                <p style="font-size: 0.85rem;">Degrado Medio: <strong>${avgDegradation.toFixed(3)} s/giro</strong></p>
                ${fastestLap ? `<p style="font-size: 0.85rem;">Giro Veloce: <strong>${fastestLap.Driver}</strong> (${(+fastestLap.LapTimeSeconds).toFixed(3)}s al L${fastestLap.LapNumber})</p>` : ''}
               <!-- <p style="font-size: 0.8rem; color: #888894; margin-top: 15px;"><i>Usa il brush o clicca sui grafici per esplorare le strategie. Doppio click per ripristinare.</i></p> -->
            `;
        }
        // Incolla tutto insieme
        panel.innerHTML = globalOverviewHTML + '<div class="selection-details">' + specificHTML + '</div>';
    };

    // =========================================================
    // 3. CALLBACKS DEI GRAFICI AGGIORNATI
    // =========================================================
    const callbacks = {
      onStintClick: (selectedData) => {
    if (!selectedData || selectedData.length === 0) {
        callbacks.onReset();
        return;
    }

    let finalSelection = [];
    const driverName = selectedData[0].Driver;

    // CASO A: Click dal Ranking (selectedData ha info generali sul pilota, ma non StintID specifici)
    // O se vogliamo forzare la selezione completa del pilota
    if (!selectedData[0].StintID) {
        finalSelection = stintsData.filter(s => s.Driver === driverName);
    } 
    // CASO B: Click da Gantt, PCA o PCP (selectedData contiene già gli stint specifici)
    else {
        finalSelection = selectedData;
    }

    // AGGIORNIAMO TUTTI I GRAFICI con la selezione corretta (singola o multipla)
    drawStrategyGantt(stintsData, "#gantt-chart", callbacks, finalSelection);
    drawLineChart(rawLapsData, "#line-chart", callbacks, finalSelection);
    drawParallelCoordinates(rawLapsData, "#pcp-chart", callbacks, finalSelection);
    drawPCAChart(pcaData, "#pca-chart", callbacks, finalSelection);
    drawRankingsChart(rawLapsData, "#position-chart", callbacks, finalSelection);

    // Sidebar dinamica
    const isFullDriver = finalSelection.length > 1;
    let html = `
        <h3 style="color: #00ffcc;">${isFullDriver ? 'Profilo Pilota' : 'Dettaglio Stint'}</h3>
        <p>Pilota: <strong>${driverName}</strong></p>
        ${!isFullDriver ? `<p>Giri: ${finalSelection[0].LapStart} - ${finalSelection[0].LapEnd}</p>` : `<p>Stint totali: ${finalSelection.length}</p>`}
    `;
    updateSidebar(html);
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
        // RESET DI TUTTI I GRAFICI (incluso Rankings)
        drawStrategyGantt(stintsData, "#gantt-chart", callbacks, []);
        drawLineChart(rawLapsData, "#line-chart", callbacks, []);
        drawParallelCoordinates(rawLapsData, "#pcp-chart", callbacks, []);
        drawPCAChart(pcaData, "#pca-chart", callbacks, []);
        // AGGIUNTO: Reset del Ranking Chart per togliere evidenziazioni e nomi
        drawRankingsChart(rawLapsData, "#position-chart", callbacks, []);
        
        updateSidebar(""); 
        return;
    }

    // Filtriamo gli stint basandoci sui piloti brushati e il range temporale
    const selectedStints = stintsData.filter(stint => {
        const isRightDriver = selectedDrivers.includes(stint.Driver);
        const overlapsLaps = (stint.LapStart <= maxLap) && (stint.LapEnd >= minLap);
        return isRightDriver && overlapsLaps;
    });

    // RE-RENDER DI TUTTI I GRAFICI
    // Passando selectedStints a drawRankingsChart, scatterà la logica "isSelected" 
    // che disegnerà i nomi e aumenterà lo spessore delle linee brushatate.
    drawStrategyGantt(stintsData, "#gantt-chart", callbacks, selectedStints);
    drawLineChart(rawLapsData, "#line-chart", callbacks, selectedStints);
    drawParallelCoordinates(rawLapsData, "#pcp-chart", callbacks, selectedStints);
    drawPCAChart(pcaData, "#pca-chart", callbacks, selectedStints);
    
    // AGGIUNTO: Aggiorna se stesso per mostrare cartellini e highlight
    drawRankingsChart(rawLapsData, "#position-chart", callbacks, selectedStints);

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
