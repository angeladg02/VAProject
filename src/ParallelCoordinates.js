import * as d3 from 'd3';

const COMPOUND_COLORS = {
    "SOFT": "#e10600",
    "MEDIUM": "#ffeb3b",
    "HARD": "#ffffff",
    "INTERMEDIATE": "#4caf50",
    "WET": "#2196f3",
    "UNKNOWN": "#888888"
};

export function drawParallelCoordinates(rawData, containerId, callbacks, selectedStints = []) {
    // 1. AGGREGAZIONE DATI (Da Giri singoli a Medie per Stint)
    const stintsMap = new Map();
    let currentStint = null;
    let prevLap = null;

    // Ordina i dati per pilota e numero di giro
    const sortedData = rawData.slice().sort((a,b) => d3.ascending(a.Driver, b.Driver) || d3.ascending(+a.LapNumber, +b.LapNumber));

    sortedData.forEach(d => {
        const lapNum = +d.LapNumber;
        const tyreLife = +d.TyreLife;
        
        // Crea un nuovo stint se: cambia pilota, gomma più nuova (pit stop), o cambia mescola
        if (!currentStint || d.Driver !== prevLap.Driver || tyreLife < prevLap.TyreLife || d.Compound !== prevLap.Compound) {
            if (currentStint && currentStint.laps.length > 0) stintsMap.set(currentStint.id, currentStint);
            currentStint = {
                id: `${d.Driver}_${lapNum}`,
                Driver: d.Driver,
                Compound: d.Compound || "UNKNOWN",
                LapStart: lapNum,
                LapEnd: lapNum,
                laps: []
            };
        }
        
        currentStint.LapEnd = lapNum;
        
        // Aggiungiamo solo i giri validi (no outlap lentissimi) ai calcoli della media
        if (+d.Sector1Seconds > 0 && +d.Sector2Seconds > 0 && +d.Sector3Seconds > 0) {
            currentStint.laps.push({
                s1: +d.Sector1Seconds,
                s2: +d.Sector2Seconds,
                s3: +d.Sector3Seconds,
                speed: +d.SpeedST,
                temp: +d.TrackTemp
            });
        }
        prevLap = d;
    });
    if (currentStint && currentStint.laps.length > 0) stintsMap.set(currentStint.id, currentStint);

    // Calcola le medie per ogni stint
    const validData = Array.from(stintsMap.values()).map(s => {
        return {
            Driver: s.Driver,
            Compound: s.Compound,
            LapStart: s.LapStart,
            LapEnd: s.LapEnd,
            "Sector 1": d3.mean(s.laps, l => l.s1),
            "Sector 2": d3.mean(s.laps, l => l.s2),
            "Sector 3": d3.mean(s.laps, l => l.s3),
            "SpeedST": d3.mean(s.laps, l => l.speed),
            "Track Temp": d3.mean(s.laps, l => l.temp),
            StintLength: s.laps.length
        };
    }).filter(d => d.StintLength > 2); // Escludiamo stint finti o brevissimi (meno di 3 giri)

    if (!validData || validData.length === 0) return;
    const hasSelection = selectedStints && selectedStints.length > 0;

    // 2. SETUP CONTENITORE
    const container = d3.select(containerId);
    container.selectAll("*").remove();

    const containerNode = container.node();
    const width = containerNode.clientWidth || 800;
    const height = containerNode.clientHeight || 300;
    
    const margin = { top: 30, right: 50, bottom: 20, left: 50 };
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;

    const svg = container.append("svg")
        .attr("width", "100%")
        .attr("height", "100%")
        .style("display", "block");

    const g = svg.append("g")
        .attr("transform", `translate(${margin.left},${margin.top})`);

    // 3. I NUOVI ASSI
    const dimensions = ["Compound", "Sector 1", "Sector 2", "Sector 3", "SpeedST", "Track Temp"];

    // 4. SCALE
    const y = {};
    dimensions.forEach(dim => {
        if (dim === "Compound") {
            const compounds = Array.from(new Set(validData.map(d => d[dim])));
            y[dim] = d3.scalePoint().domain(compounds).range([innerHeight, 0]).padding(0.5);
        } else if (dim.includes("Sector")) {
            // Per i Tempi: i valori bassi (i più veloci/migliori) vanno posizionati in alto!
            y[dim] = d3.scaleLinear().domain(d3.extent(validData, d => d[dim])).range([0, innerHeight]); 
        } else {
            // Per Velocità e Temp: i valori più alti vanno in alto
            y[dim] = d3.scaleLinear().domain(d3.extent(validData, d => d[dim])).range([innerHeight, 0]);
        }
    });

    const x = d3.scalePoint().range([0, innerWidth]).padding(0.5).domain(dimensions);

    // 5. DISEGNO LINEE
    const lineGenerator = d => d3.line()(dimensions.map(p => [x(p), y[p](d[p])]));
    const tooltip = d3.select("#tooltip");

    const lines = g.append("g")
        .attr("class", "lines")
        .selectAll("path")
        .data(validData)
        .enter()
        .append("path")
        .attr("d", lineGenerator)
        .style("fill", "none")
        .style("stroke", d => COMPOUND_COLORS[d.Compound] || COMPOUND_COLORS["UNKNOWN"])
        .style("stroke-width", 1)
        .style("transition", "opacity 0.2s")
        .on("mouseover", function(event, d) {
            d3.select(this).style("stroke-width", 3).style("opacity", 1).raise();
            
            tooltip.classed("hidden", false)
                .html(`
                    <div style="margin-bottom:5px;"><strong>${d.Driver}</strong> - ${d.Compound}</div>
                    <div>Giri: ${d.LapStart} - ${d.LapEnd} (${d.StintLength} totali)</div>
                    <div>Avg Sec 1: <strong>${d["Sector 1"].toFixed(3)}s</strong></div>
                    <div>Avg Sec 2: <strong>${d["Sector 2"].toFixed(3)}s</strong></div>
                    <div>Avg Sec 3: <strong>${d["Sector 3"].toFixed(3)}s</strong></div>
                    <div>Avg Speed: <strong>${d["SpeedST"].toFixed(1)} km/h</strong></div>
                    <div>Avg Temp: <strong>${d["Track Temp"].toFixed(1)} °C</strong></div>
                `)
                .style("left", (event.pageX + 15) + "px")
                .style("top", (event.pageY - 28) + "px");
        })
        .on("mouseout", function() {
            updateLines(); 
            tooltip.classed("hidden", true);
        });

    // 6. DISEGNO DEGLI ASSI E LABEL
    const axes = g.selectAll(".axis")
        .data(dimensions)
        .enter().append("g")
        .attr("class", "axis")
        .attr("transform", d => `translate(${x(d)},0)`)
        .each(function(d) { d3.select(this).call(d3.axisLeft().scale(y[d]).ticks(5)); });

    axes.selectAll("text").style("fill", "#f5f5f5").style("font-size", "10px");
    axes.selectAll("path, line").style("stroke", "#888894");

    axes.append("text")
        .style("text-anchor", "middle")
        .attr("y", -15)
        .text(d => d)
        .style("fill", "#f5f5f5")
        .style("font-weight", "bold")
        .style("font-size", "11px")
        .style("cursor", "ew-resize");

    // 7. LOGICA DI BRUSHING MULTIPLO
    const selections = new Map();

    axes.append("g")
        .attr("class", "brush")
        .each(function(d) {
            d3.select(this).call(y[d].brush = d3.brushY()
                .extent([[-10, 0], [10, innerHeight]])
                .on("start brush end", brushed)
            );
        });

    function brushed({selection}, dim) {
        if (selection === null) {
            selections.delete(dim);
        } else {
            if (dim === "Compound") {
                const domain = y[dim].domain();
                const range = domain.map(d => y[dim](d));
                const selectedCompounds = domain.filter((d, i) => selection[0] <= range[i] && range[i] <= selection[1]);
                selections.set(dim, selectedCompounds);
            } else {
                selections.set(dim, selection.map(y[dim].invert));
            }
        }
        updateLines(true); 
    }

    // Identifica se questa linea è tra quelle cliccate negli altri grafici
    function isStintSelected(d) {
        if (!hasSelection) return false;
        // Controlla se c'è overlap tra lo stint aggregato e gli stint passati dalla selezione
        return selectedStints.some(s => s.Driver === d.Driver && Math.max(s.LapStart, d.LapStart) <= Math.min(s.LapEnd, d.LapEnd));
    }

    function isLineActive(d) {
        if (hasSelection && !isStintSelected(d)) return false;

        for (let [dim, sel] of selections) {
            if (dim === "Compound") {
                if (!sel.includes(d[dim])) return false;
            } else {
                const min = Math.min(sel[0], sel[1]);
                const max = Math.max(sel[0], sel[1]);
                if (d[dim] < min || d[dim] > max) return false;
            }
        }
        return true;
    }

    function updateLines(isUserBrushing = false) {
        lines.style("opacity", d => {
            if (selections.size === 0 && !hasSelection) return 0.25; // Opacità base leggibile
            return isLineActive(d) ? 0.9 : 0.02; 
        })
        .style("stroke-width", d => ((selections.size > 0 || hasSelection) && isLineActive(d) ? 2.5 : 1));

        // Se l'utente usa il brush del PCP, invia i dati aggregati a index.js
        if (isUserBrushing && callbacks && callbacks.onPCPBrush) {
            const activeStints = selections.size === 0 ? [] : validData.filter(isLineActive);
            callbacks.onPCPBrush(activeStints);
        }
    }

    updateLines();
}