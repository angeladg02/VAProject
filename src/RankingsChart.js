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
    const margin = { top: 20, right: 40, bottom: 30, left: 40 };
    const width = node.clientWidth - margin.left - margin.right;
    const height = node.clientHeight - margin.top - margin.bottom;

    const svg = container.append("svg")
        .attr("width", "100%")
        .attr("height", "100%")
        .append("g")
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
        .call(d3.axisBottom(xScale).ticks(10))
        .attr("color", "#888");

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

    dataByDriver.forEach((laps, driver) => {
         const teamColor = TEAM_COLORS[laps[0].Team] || "#888894";
        
        // Verifica se il pilota è tra quelli selezionati (per evidenziarlo)
        const isSelected = selectedStints.some(s => s.Driver === driver);

        linesGroup.append("path")
            .datum(laps)
            .attr("fill", "none")
            .attr("stroke", teamColor)
            .attr("stroke-width", isSelected ? 4 : 1.5)
            .attr("opacity", selectedStints.length > 0 && !isSelected ? 0.2 : 0.8)
            .attr("d", line)
            .style("cursor", "pointer")
            .on("mouseover", function(event) {
                if (!isSelected) d3.select(this).attr("stroke-width", 3).attr("opacity", 1);
                d3.select("#tooltip").classed("hidden", false)
                    .html(`<strong>Driver: ${driver}</strong>`)
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