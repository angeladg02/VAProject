import * as d3 from 'd3';

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

export function drawRankingsChart(data, containerId, callbacks, selectedStints = []) {
    const container = d3.select(containerId);
    container.selectAll("*").remove();

    const node = container.node();
    const margin = { top: 10, right: 20, bottom: 15, left: 20 };
    const width = node.clientWidth - margin.left - margin.right;
    const height = node.clientHeight - margin.top - margin.bottom;

    // 1. Creiamo l'SVG, lo salviamo in una variabile e gli diamo il doppio click
    const svgBase = container.append("svg")
        .attr("width", "100%")
        .attr("height", "100%")
        .style("display", "block")
        .on("dblclick", function(event) {
            event.preventDefault(); 
            if (callbacks && callbacks.onReset) {
                callbacks.onReset();
            }
        });

    // 2. Aggiungiamo il gruppo <g> all'SVG appena creato (mantenendo la tua variabile "svg" per non rompere il resto del codice)
    const svg = svgBase.append("g")
        .attr("transform", `translate(${margin.left},${margin.top})`);

    // Scale
    const xScale = d3.scaleLinear()
        .domain(d3.extent(data, d => +d.LapNumber))
        .range([0, width]);
        

    // L'asse Y è invertito: la posizione 1 è in alto
    const yScale = d3.scaleLinear()
        .domain([1, d3.max(data, d => +d.Position)])
        .range([0, height]);

    // Assi
    svg.append("g")
        .attr("transform", `translate(0,${height})`)
        // Aggiungiamo .tickFormat(d => `L${d}`) per visualizzare "L1", "L2", ecc.
        .call(d3.axisBottom(xScale).ticks(10).tickFormat(d => `L${d}`))
        .attr("color", "#888"); // Colore scuro coerente con la tua richiesta precedente

    svg.append("g")
        .call(d3.axisLeft(yScale).ticks(10))
        .attr("color", "#888");
    // --- NUOVO: Configurazione del Brush X ---
    const brush = d3.brush() 
        .extent([[0, 0], [width, height]])
        .on("end", brushed);
    // Aggiungiamo il brush prima delle linee così i tooltips sulle linee continuano a funzionare in parte
    // (D3 brush intercetta i click, ma le linee sopra intercetteranno gli hover)
    svg.append("g")
        .attr("class", "brush")
        .call(brush);
    // ------------------------------------------

    // Line generator
    const line = d3.line()
        .x(d => xScale(+d.LapNumber))
        .y(d => yScale(+d.Position))
        .curve(d3.curveMonotoneX);

    // Raggruppiamo i dati per pilota
    const dataByDriver = d3.group(data, d => d.Driver);

    // Disegniamo i path per ogni pilota
    const linesGroup = svg.append("g").attr("class", "lines-group");

// 1. Definiamo una palette discreta di 20 colori ad alto contrasto
// Dal verde intenso (vincitore) al rosso intenso (ultimo)
const lampprechtPalette = [
    "#006400", "#228b22", "#32cd32", "#7cfc00", "#adff2f", // Verdi (Top 5)
    "#d4ff00", "#eeff00", "#ffff00", "#fff700", "#ffea00", // Gialli (P6-P10)
    "#ffcc00", "#ffaa00", "#ff8800", "#ff6600", "#ff4400", // Arancioni (P11-P15)
    "#ff0000", "#dd0000", "#bb0000", "#990000", "#7f0000"  // Rossi (Ultimi 5)
];

const getRankColor = (position) => {
    // La posizione 1 prende l'indice 0, la posizione 20 l'indice 19
    const index = Math.max(0, Math.min(position - 1, lampprechtPalette.length - 1));
    return lampprechtPalette[index];
};
 
    dataByDriver.forEach((laps, driver) => {
   // 1. Ripristiniamo isSelected (serve per l'interazione con gli altri grafici)
    const isSelected = selectedStints.some(s => s.Driver === driver);

    // 2. Troviamo la posizione finale (Logica Lampprecht)
    const lastLap = laps[laps.length - 1];
    const finalPos = +lastLap.Position;
    const driverColor = getRankColor(finalPos);

    linesGroup.append("path")
        .datum(laps)
        .attr("fill", "none")
        .attr("stroke", driverColor) // <--- Colore basato sul risultato finale
        .attr("stroke-width", isSelected ? 4 : 1.5)
        .attr("opacity", selectedStints.length > 0 && !isSelected ? 0.2 : 0.8)
        .attr("d", line)
        .style("cursor", "pointer")
        .on("mouseover", function(event) {
            if (!isSelected) d3.select(this).attr("stroke-width", 3).attr("opacity", 1);
            
            // --- LOGICA DISTACCO FINALE ---
            // 1. Identifichiamo l'ultimo giro della gara dai dati generali
            const lastLapNumber = d3.max(data, d => +d.LapNumber);
            const lastLapData = data.filter(d => +d.LapNumber === lastLapNumber);
            
            // 2. Troviamo il leader (vincitore) e il pilota corrente all'ultimo giro
            const winner = lastLapData.find(d => +d.Position === 1);
            const currentDriverFinal = lastLapData.find(d => d.Driver === driver);
            
            let timeInfo = "";
            if (currentDriverFinal && winner) {
                if (driver === winner.Driver) {
                    timeInfo = `<br/><strong>WINNER</strong>`;
                } else {
                    // Calcolo del distacco (Gap) usando il tempo di inizio dell'ultimo giro
                    const gap = currentDriverFinal.LapStartSeconds - winner.LapStartSeconds;
                    timeInfo = `<br/>Gap: +${gap.toFixed(3)}s`;
                }
            }
            // ------------------------------

            d3.select("#tooltip").classed("hidden", false)
                .html(`<strong>Driver: ${driver}</strong>${timeInfo}`) // Aggiunta info tempo
                .style("left", (event.pageX + 10) + "px")
                .style("top", (event.pageY - 20) + "px");
        })
        .on("mouseout", function() {
            if (!isSelected) d3.select(this).attr("stroke-width", 1.5).attr("opacity", selectedStints.length > 0 ? 0.2 : 0.8);
            d3.select("#tooltip").classed("hidden", true);
        });
});

    // --- NUOVO: Funzione per gestire l'evento di brush ---
   // --- Dentro RankingsChart.js, alla fine della funzione brushed ---
    function brushed(event) {
        if (!event.selection) {
            if (callbacks.onRankingBrush) {
                callbacks.onRankingBrush([], null, null); 
            }
            return;
        }

        // Ora event.selection contiene un rettangolo 2D: [[x0, y0], [x1, y1]]
        const [[x0, y0], [x1, y1]] = event.selection;

        // Troviamo il range di giri (Asse X)
        const minLap = Math.floor(xScale.invert(x0));
        const maxLap = Math.ceil(xScale.invert(x1));

        // Troviamo il range di posizioni (Asse Y)
        // Nota: y0 è il lato alto del quadrato, y1 il lato basso. 
        const posTop = yScale.invert(y0);    // es. Posizione 1 (in alto)
        const posBottom = yScale.invert(y1); // es. Posizione 5 (più in basso)

        const selectedDriversSet = new Set();
        data.forEach(d => {
            const lap = +d.LapNumber;
            const pos = +d.Position;
            
            // FILTRO MAGICO: Il pilota deve essere nel range di giri E nel range di posizioni!
            if (lap >= minLap && lap <= maxLap && pos >= posTop && pos <= posBottom) {
                selectedDriversSet.add(d.Driver);
            }
        });

        const selectedDrivers = Array.from(selectedDriversSet);

        if (callbacks.onRankingBrush) {
            callbacks.onRankingBrush(selectedDrivers, minLap, maxLap);
        }
    }
    // ------------------------------------------
}