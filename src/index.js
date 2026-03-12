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


function createLegends() {
    //legenda mescole
    const compoundContainer = document.getElementById('compound-legend');
    compoundContainer.innerHTML = ''; 

    //legenda eventi
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

    //legenda gomme
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

    // Estrazione Temperature
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

    // ---> AGGIUNGI QUESTA RIGA: Calcolo della media globale <---
    const globalAvgLapTime = d3.mean(validLaps, d => +d.LapTimeSeconds);

    const globalOverviewHTML = `
        <div style="margin-bottom: 8px; padding-bottom: 8px; border-bottom: 1px solid #333344;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                <h1 style="color: #f30303; margin: 0; font-size: 1.2rem; text-transform: uppercase; letter-spacing: 1px;">
                    Monza 2024
                </h1>
                <span style="background: #333344; color: #fff; padding: 4px 6px; border-radius: 6px; font-size: 0.9rem; white-space: nowrap;">
                    ${maxLaps} LAPS
                </span>
            </div>
            <div style="background: rgba(162, 0, 255, 0.1); padding: 6px; border-radius: 4px; border: 1px solid rgba(162, 0, 255, 0.3); margin-bottom: 8px;">
                <div style="font-size: 0.60rem; color: #a200ff; text-transform: uppercase; font-weight: bold;">Fastest Lap</div>
                <div style="display: flex; justify-content: space-between; align-items: baseline; margin-top: 2px;">
                    <span style="font-size: 0.8rem; font-weight: bold; color: #fff;">${fastestLap ? fastestLap.Driver : 'N/A'}</span>
                    <span style="font-size: 0.8rem; font-family: monospace; color: #f5f5f5;">${fastestLap ? (+fastestLap.LapTimeSeconds).toFixed(3) + 's' : '-'}</span>
                </div>
            </div>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 8px;">
                <div style="background: rgba(255,255,255,0.03); padding: 6px; border-radius: 4px; border-left: 2px solid #e10600;">
                    <div style="font-size: 0.60rem; color: #888894; text-transform: uppercase;">Avg Degradation</div>
                    <div style="font-size: 0.85rem; font-weight: bold; color: #fff;">${avgDegradation.toFixed(3)} <span style="font-size: 0.6rem; font-weight: normal;">s/l</span></div>
                </div>
                <div style="background: rgba(255,255,255,0.03); padding: 6px; border-radius: 4px; border-left: 2px solid #ffd400;">
                    <div style="font-size: 0.60rem; color: #888894; text-transform: uppercase;">Pit Stops</div>
                    <div style="font-size: 0.85rem; font-weight: bold; color: #fff;">${totalPitStops}</div>
                </div>
            </div>

            <div style="font-size: 0.85rem; color: #888894; display: flex; justify-content: space-between; margin-bottom: 6px;">
                <span>Track: <strong style="color: #eee;">${avgTrackTemp.toFixed(1)}°C</strong></span>
                <span>Air: <strong style="color: #eee;">${avgAirTemp.toFixed(1)}°C</strong></span>
            </div>

            <div style="margin-top: 6px; font-size: 0.85rem; display: flex; align-items: center;">
                <strong style="margin-right: 8px; font-size: 0.65rem; color: #888894; text-transform: uppercase;">Compounds:</strong>
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
const getComparativeStatsHTML = (selectedLaps, globalAvg) => {
        if (!selectedLaps || selectedLaps.length === 0) return '';
        
        const localAvg = d3.mean(selectedLaps, d => +d.LapTimeSeconds);
        const delta = localAvg - globalAvg;
        const isFaster = delta < 0;

        return `
            <div style="margin-top: 10px; border-top: 1px dashed #333344; padding-top: 10px;">
                <h3 style="color: #00ffcc; font-size: 0.85rem; text-transform: uppercase; margin-bottom: 5px;">Comparazione Tempi</h3>
                
                <div style="display: flex; align-items: center; justify-content: space-between;">
                    <div style="width: 40%; font-size: 0.8rem; padding-right: 5px;">
                        <div style="color: #888894; font-size: 0.7rem; text-transform: uppercase;">Media Selezione</div>
                        <div style="font-size: 1.1rem; font-weight: bold; color: #fff; margin-bottom: 5px;">${localAvg.toFixed(3)}s</div>
                        
                        <div style="color: ${isFaster ? '#4caf50' : '#e10600'}; font-weight: bold; font-size: 0.85rem;">
                            ${isFaster ? '▼' : '▲'} ${Math.abs(delta).toFixed(3)}s
                        </div>
                        <div style="font-size: 0.65rem; color: #888894;">vs Globale</div>
                    </div>
                    
                    <div id="sidebar-boxplot-container" style="width: 60%; height: 140px;"></div>
                </div>
            </div>
        `;
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

            if (!selectedData[0].StintID) {
                finalSelection = stintsData.filter(s => s.Driver === driverName);
            } else {
                finalSelection = selectedData;
            }

            drawStrategyGantt(stintsData, "#gantt-chart", callbacks, finalSelection);
            drawLineChart(rawLapsData, "#line-chart", callbacks, finalSelection);
            drawParallelCoordinates(rawLapsData, "#pcp-chart", callbacks, finalSelection);
            drawPCAChart(pcaData, "#pca-chart", callbacks, finalSelection);
            drawRankingsChart(rawLapsData, "#position-chart", callbacks, finalSelection);

            // -----------------------------------------------------------------
            // NUOVA LOGICA: SE ESATTAMENTE 2 STINT SONO SELEZIONATI
            // -----------------------------------------------------------------
            if (finalSelection.length === 2 && finalSelection[0].StintID) {
                const s1 = finalSelection[0];
                const s2 = finalSelection[1];
                
                // Estraiamo i giri esatti per ciascuno dei due stint
                const laps1 = validLaps.filter(d => d.Driver === s1.Driver && +d.LapNumber >= s1.LapStart && +d.LapNumber <= s1.LapEnd);
                const laps2 = validLaps.filter(d => d.Driver === s2.Driver && +d.LapNumber >= s2.LapStart && +d.LapNumber <= s2.LapEnd);

                const avg1 = d3.mean(laps1, d => +d.LapTimeSeconds);
                const avg2 = d3.mean(laps2, d => +d.LapTimeSeconds);
                const delta = Math.abs(avg1 - avg2);
                const fasterDriver = avg1 < avg2 ? s1.Driver : s2.Driver;
                
                // Creiamo le etichette per l'asse X usando Driver e prima lettera della Mescola (es. "VER (S)")
                const label1 = `${s1.Driver} (${s1.Compound[0]})`;
                const label2 = `${s2.Driver} (${s2.Compound[0]})`;

                let specificHTML = `
                    <div style="margin-top: 10px; border-top: 1px dashed #333344; padding-top: 10px;">
                        <h3 style="color: #00ffcc; font-size: 0.85rem; text-transform: uppercase; margin-bottom: 5px;">Testa a Testa (Pace)</h3>
                        
                        <div style="display: flex; align-items: center; justify-content: space-between;">
                            <div style="width: 40%; font-size: 0.8rem; padding-right: 5px;">
                                <div style="font-size: 0.85rem; font-weight: bold; color: #fff; margin-bottom: 5px;">${label1}<br>vs<br>${label2}</div>
                                <div style="color: #4caf50; font-weight: bold; font-size: 0.80rem; margin-top: 5px;">
                                    ${fasterDriver}
                                </div>
                                <div style="font-size: 0.70rem; color: #888894;">più veloce di ${delta.toFixed(3)}s</div>
                            </div>
                            
                            <div id="sidebar-boxplot-container" style="width: 60%; height: 140px;"></div>
                        </div>
                    </div>
                `;
                
                updateSidebar(specificHTML);
                
                // Coloriamo i boxplot in base al Compound (Mescola) dei due stint
                const color1 = s1.Compound === 'SOFT' ? '#e10600' : s1.Compound === 'MEDIUM' ? '#ffeb3b' : '#ffffff';
                const color2 = s2.Compound === 'SOFT' ? '#e10600' : s2.Compound === 'MEDIUM' ? '#ffeb3b' : '#ffffff';

                // Disegniamo il Boxplot passandogli i due stint. Opacità 0.8 per entrambi perché sono i due focus dell'analisi!
                drawComparativeBoxplot(laps1, laps2, label1, label2, color1, color2, 0.8, 0.8, "#sidebar-boxplot-container");
                
            } else {
                // -----------------------------------------------------------------
                // LOGICA STANDARD (1 STINT O CLUSTER MULTIPLI) -> Mostra "Globale vs Selezione"
                // -----------------------------------------------------------------
                const isFullDriver = finalSelection.length > 1;
                let html = `
                    <h3 style="color: #00ffcc; font-size: 0.95rem;">${isFullDriver ? 'Profilo Pilota' : 'Dettaglio Stint'}</h3>
                    <p style="font-size: 0.85rem;">Pilota: <strong>${driverName}</strong></p>
                `;
                
                const selectedLaps = validLaps.filter(d => finalSelection.some(s => d.Driver === s.Driver && +d.LapNumber >= s.LapStart && +d.LapNumber <= s.LapEnd));
                
                html += getComparativeStatsHTML(selectedLaps, globalAvgLapTime);
                updateSidebar(html);
                
                if (selectedLaps.length > 0) {
                    drawComparativeBoxplot(validLaps, selectedLaps, "Globale", "Selezione", "#888894", "#00ffcc", 0.15, 0.8, "#sidebar-boxplot-container");
                }
            }
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
                drawRankingsChart(rawLapsData, "#position-chart", callbacks, []);
                updateSidebar(""); 
                return;
            }

            const selectedStints = stintsData.filter(stint => {
                const isRightDriver = selectedDrivers.includes(stint.Driver);
                const overlapsLaps = (stint.LapStart <= maxLap) && (stint.LapEnd >= minLap);
                return isRightDriver && overlapsLaps;
            });

            const selectedLaps = validLaps.filter(d => 
                selectedDrivers.includes(d.Driver) && 
                +d.LapNumber >= minLap && +d.LapNumber <= maxLap
            );

            // Re-render dei grafici
            drawStrategyGantt(stintsData, "#gantt-chart", callbacks, selectedStints);
            drawLineChart(rawLapsData, "#line-chart", callbacks, selectedStints);
            drawParallelCoordinates(rawLapsData, "#pcp-chart", callbacks, selectedStints);
            drawPCAChart(pcaData, "#pca-chart", callbacks, selectedStints);
            drawRankingsChart(rawLapsData, "#position-chart", callbacks, selectedStints);

            // CREIAMO SOLO L'HTML DELLE STATISTICHE E DEL BOXPLOT (Senza il testo extra)
            let specificHTML = getComparativeStatsHTML(selectedLaps, globalAvgLapTime);

            updateSidebar(specificHTML);

            if (selectedLaps.length > 0) {
                // Passiamo 0.15 di opacità per il globale (grigio) e 0.8 per la selezione (verde acqua)
                drawComparativeBoxplot(
                    validLaps, selectedLaps, 
                    "Globale", "Selezione", 
                    "#888894", "#00ffcc", 
                    0.15, 0.8, 
                    "#sidebar-boxplot-container"
                );
            }
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

// =========================================================
// FUNZIONE PER IL BOXPLOT COMPARATIVO (ANALYTICS)
// =========================================================
// =========================================================
// FUNZIONE PER IL BOXPLOT COMPARATIVO (VERTICALE)
// =========================================================
// =========================================================
// FUNZIONE PER IL BOXPLOT COMPARATIVO (MIGLIORATO)
// =========================================================
// =========================================================
// FUNZIONE PER IL BOXPLOT COMPARATIVO (UNIVERSALE)
// =========================================================
function drawComparativeBoxplot(data1, data2, label1, label2, color1, color2, opacity1, opacity2, containerSelector) {
    const container = d3.select(containerSelector);
    container.selectAll("*").remove(); 

    if (!data1 || !data2 || data1.length === 0 || data2.length === 0) return;

    function getBoxplotStats(data) {
        let vals = data.map(d => +d.LapTimeSeconds).filter(d => d > 0).sort(d3.ascending);
        if(vals.length === 0) return null;

        const fastest = vals[0];
        vals = vals.filter(v => v <= fastest * 1.10); // Rimuove outlier (es. Pit stop)

        const q1 = d3.quantile(vals, 0.25);
        const median = d3.quantile(vals, 0.50);
        const q3 = d3.quantile(vals, 0.75);
        const iqr = q3 - q1;
        
        const minVal = Math.max(vals[0], q1 - 1.5 * iqr);
        const maxVal = Math.min(vals[vals.length - 1], q3 + 1.5 * iqr);
        const outliers = vals.filter(v => v < minVal || v > maxVal);

        return { q1, median, q3, iqr, min: minVal, max: maxVal, outliers, vals };
    }

    const stats1 = getBoxplotStats(data1);
    const stats2 = getBoxplotStats(data2);

    if (!stats1 || !stats2) return;

    const node = container.node();
    const width = node ? node.getBoundingClientRect().width : 160;
    const height = 140; 
    const margin = { top: 5, right: 5, bottom: 20, left: 35 };

    const svg = container.append("svg")
        .attr("width", width)
        .attr("height", height);

    const yMin = Math.min(d3.min(stats1.vals), d3.min(stats2.vals)) - 0.2;
    const yMax = Math.max(d3.max(stats1.vals), d3.max(stats2.vals)) + 0.2;

    const yScale = d3.scaleLinear()
        .domain([yMin, yMax])
        .range([height - margin.bottom, margin.top]);

    const xScale = d3.scaleBand()
        .domain([label1, label2]) // Usa le etichette passate come parametro
        .range([margin.left, width - margin.right])
        .paddingInner(0.3)
        .paddingOuter(0.2);

    // Griglia
    svg.append("g")
        .attr("class", "grid")
        .attr("transform", `translate(${margin.left},0)`)
        .call(d3.axisLeft(yScale).ticks(4).tickSize(-(width - margin.left - margin.right)).tickFormat(""))
        .selectAll("line").attr("stroke", "rgba(255,255,255,0.05)").attr("stroke-dasharray", "3,3");

    // Asse Y
    svg.append("g")
        .attr("transform", `translate(${margin.left},0)`)
        .call(d3.axisLeft(yScale).ticks(4).tickFormat(d => d.toFixed(1) + "s"))
        .selectAll("text").style("fill", "#888894").style("font-family", "monospace").style("font-size", "9px");

    // Asse X (Nomi dinamici)
    svg.append("g")
        .attr("transform", `translate(0,${height - margin.bottom})`)
        .call(d3.axisBottom(xScale))
        .selectAll("text").style("fill", "#fff").style("font-size", "9px").style("font-weight", "bold");

    svg.selectAll(".domain").remove();

    function drawBox(stats, name, color, opacity) {
        const x = xScale(name);
        const w = xScale.bandwidth();
        const center = x + w / 2;
        const g = svg.append("g");

        g.append("line").attr("x1", center).attr("x2", center).attr("y1", yScale(stats.min)).attr("y2", yScale(stats.max)).attr("stroke", color).attr("stroke-width", 1.5).attr("stroke-opacity", 0.7);
        const whiskerWidth = w / 3;
        g.append("line").attr("x1", center - whiskerWidth).attr("x2", center + whiskerWidth).attr("y1", yScale(stats.max)).attr("y2", yScale(stats.max)).attr("stroke", color).attr("stroke-width", 1.5);
        g.append("line").attr("x1", center - whiskerWidth).attr("x2", center + whiskerWidth).attr("y1", yScale(stats.min)).attr("y2", yScale(stats.min)).attr("stroke", color).attr("stroke-width", 1.5);

        g.append("rect").attr("x", x).attr("width", w).attr("y", yScale(stats.q3)).attr("height", Math.max(1, yScale(stats.q1) - yScale(stats.q3))).attr("fill", color).attr("fill-opacity", opacity).attr("stroke", color).attr("stroke-width", 1.5);
        
        // Mediana
        g.append("line").attr("x1", x).attr("x2", x + w).attr("y1", yScale(stats.median)).attr("y2", yScale(stats.median)).attr("stroke", "#1e1e24").attr("stroke-width", 2.5);

        // Outlier
        g.selectAll(".outlier").data(stats.outliers).enter().append("circle").attr("class", "outlier").attr("cx", center).attr("cy", d => yScale(d)).attr("r", 2.5).attr("fill", color).attr("fill-opacity", 0.3).attr("stroke", color).attr("stroke-width", 1);
    }

    // Disegna usando i colori e le opacità passate come parametri
    drawBox(stats1, label1, color1, opacity1);
    drawBox(stats2, label2, color2, opacity2);
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
