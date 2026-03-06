import * as d3 from 'd3';

// Colori ufficiali delle mescole F1
const COMPOUND_COLORS = {
    "SOFT": "#e10600",
    "MEDIUM": "#ffeb3b",
    "HARD": "#ffffff",
    "INTERMEDIATE": "#4caf50",
    "WET": "#2196f3",
    "UNKNOWN": "#888888"
};

// Array globale per tracciare le selezioni (Crossover point)
let selectedStints = [];

export function drawStrategyGantt(rawData, containerId, callbacks) {
    // 1. PULIZIA E PREPARAZIONE DATI
    const data = rawData.map(d => ({
        ...d,
        LapStart: +d.LapStart || 0,
        LapEnd: +d.LapEnd || 0,
        TotalLaps: +d.TotalLaps || 0,
        StintNumber: +d.StintNumber || 1,
        AvgLapTime: +d.AvgLapTime || 0,
        DegradationSlope: +d.DegradationSlope || 0,
        TyreLifeStart: +d.TyreLifeStart || 0
    })).filter(d => d.LapEnd > 0);

    // 2. SETUP CONTENITORE E DIMENSIONI
    const container = d3.select(containerId);
    container.selectAll("*").remove(); // Pulisce render precedenti

    const containerNode = container.node();
    const width = containerNode.clientWidth;
    const height = containerNode.clientHeight;
    
    // --> MIGLIORIA 1: Margin left aumentato a 65 per non tagliare i nomi lunghi
  // 1. Riduci il margine superiore (da 20 a 5)
const margin = { top: 5, right: 30, bottom: 30, left: 65 }; 
   const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;

    const svg = container.append("svg")
        .attr("width", "100%")
        .attr("height", "100%")
        .style("display", "block")
        .on("dblclick", function() {
            // SVUOTA L'ARRAY GLOBALE AL DOPPIO CLICK
            selectedStints = [];
            
            // Resetta i contorni di tutti gli stint
            svg.selectAll(".stint-rect")
                .attr("stroke", "#15151e")
                .attr("stroke-width", 1.5);
                
            // Propaga l'array vuoto agli altri grafici per resettare la dashboard
            if (callbacks && callbacks.onStintClick) {
                callbacks.onStintClick(selectedStints);
            }
        });

    // 3. DEFINIZIONE GRADIENTI PER DEGRADO GOMMA
    const defs = svg.append("defs");
    Object.keys(COMPOUND_COLORS).forEach(compound => {
        const gradient = defs.append("linearGradient")
            .attr("id", `grad-${compound}`)
            .attr("x1", "0%").attr("y1", "0%")
            .attr("x2", "100%").attr("y2", "0%");

        gradient.append("stop")
            .attr("offset", "0%")
            .attr("stop-color", COMPOUND_COLORS[compound])
            .attr("stop-opacity", 1); // Gomma fresca

        gradient.append("stop")
            .attr("offset", "100%")
            .attr("stop-color", COMPOUND_COLORS[compound])
            .attr("stop-opacity", 0.3); // Gomma usurata
    });

    const g = svg.append("g")
        .attr("transform", `translate(${margin.left},${margin.top})`);

    // 4. SCALE
    const drivers = Array.from(new Set(data.map(d => d.Driver)));
    const maxLap = d3.max(data, d => d.LapEnd);

    const xScale = d3.scaleLinear()
        .domain([1, maxLap])
        .range([0, innerWidth]);

    // --> MIGLIORIA 2: Padding ridotto a 0.15 per rendere le barre più "cicciotte"
   const yScale = d3.scaleBand()
    .domain(drivers)
    .range([0, innerHeight])
    .padding(0.15);

    // --> MIGLIORIA 4: Aggiunta Griglia Verticale (Disegnata PRIMA delle barre per stare sullo sfondo)
    g.append("g")
        .attr("class", "grid")
        .attr("color", "#333344")
        .attr("stroke-opacity", 0.3)
        .attr("stroke-dasharray", "3,3")
        .call(d3.axisBottom(xScale)
            .tickSize(innerHeight)
            .tickFormat("") 
            .ticks(Math.round(maxLap / 5)) // Mostra una linea verticale ogni ~5 giri
        )
        .select(".domain").remove(); // Rimuove la linea di base

    // 5. ASSI
    g.append("g")
        .attr("transform", `translate(0,${innerHeight})`)
        .call(d3.axisBottom(xScale)
            // --> MIGLIORIA 3: Ticks sull'asse X per evitare sovrapposizioni (uno ogni ~5 giri)
            .ticks(Math.round(maxLap / 5))
            .tickFormat(d => `L${d}`)
        )
        .attr("color", "#888894")
        .selectAll("text").style("fill", "#f5f5f5");

    g.append("g")
        .call(d3.axisLeft(yScale))
        .attr("color", "#888894")
        .selectAll("text")
        .style("fill", "#f5f5f5")
        .style("font-weight", "bold")
        .style("font-size", "12px");

    g.select(".domain").remove(); // Rimuove asse Y per pulizia visiva

    // 6. TOOLTIP
    const tooltip = d3.select("#tooltip");

    // 7. DISEGNO DEGLI STINT
    const stintsGroup = g.append("g").attr("class", "stints-layer");

    stintsGroup.selectAll(".stint-rect")
        .data(data)
        .enter()
        .append("rect")
        .attr("class", "stint-rect")
        .attr("x", d => xScale(d.LapStart))
        .attr("y", d => yScale(d.Driver))
        .attr("width", d => Math.max(0, xScale(d.LapEnd) - xScale(d.LapStart)))
        .attr("height", yScale.bandwidth())
        .attr("fill", d => `url(#grad-${d.Compound})`)
        .attr("stroke", "#15151e")
        .attr("stroke-width", 1.5)
        .style("cursor", "pointer")
        
        // INTERAZIONE: HOVER
        .on("mouseover", function(event, d) {
            d3.select(this).attr("stroke", "#ffffff").attr("stroke-width", 2);
            tooltip.classed("hidden", false)
                .html(`
                    <div style="margin-bottom:5px;"><strong>${d.Driver}</strong> - <span style="color:${COMPOUND_COLORS[d.Compound]}">${d.Compound}</span></div>
                    <div>Giri: ${d.LapStart} - ${d.LapEnd}</div>
                    <div>TyreLife Totale: ${d.TyreLifeStart + d.TotalLaps}</div>
                    <div>Lap Time Medio: ${d.AvgLapTime.toFixed(3)}s</div>
                    <div>Degrado: ${d.DegradationSlope.toFixed(3)} s/giro</div>
                `)
                .style("left", (event.pageX + 15) + "px")
                .style("top", (event.pageY - 28) + "px");
        })
        .on("mousemove", function(event) {
            tooltip.style("left", (event.pageX + 15) + "px").style("top", (event.pageY - 28) + "px");
        })
        .on("mouseout", function(event, d) {
            // FIX: Usiamo Driver e StintNumber invece di StintID
            const isSelected = selectedStints.some(s => s.Driver === d.Driver && s.StintNumber === d.StintNumber);
            d3.select(this).attr("stroke", isSelected ? "#00ff00" : "#15151e")
                           .attr("stroke-width", isSelected ? 3 : 1.5);
            tooltip.classed("hidden", true);
        })
        
        // INTERAZIONE: CLICK
        .on("click", function(event, d) {
            // FIX: Cerchiamo l'indice esatto usando Driver e StintNumber
            const index = selectedStints.findIndex(s => s.Driver === d.Driver && s.StintNumber === d.StintNumber);
            
            if (index > -1) {
                // SE ESISTE GIA': Lo rimuove (Deselezione)
                selectedStints.splice(index, 1); 
            } else {
                // SE NON ESISTE: Lo aggiunge (mantenendo un massimo di 2 stint per il Crossover)
                if (selectedStints.length >= 2) selectedStints.shift(); 
                selectedStints.push(d);
            }

            // Aggiorna contorno per evidenziare la nuova selezione/deselezione
            g.selectAll(".stint-rect")
                .attr("stroke", sd => selectedStints.some(s => s.Driver === sd.Driver && s.StintNumber === sd.StintNumber) ? "#00ff00" : "#15151e")
                .attr("stroke-width", sd => selectedStints.some(s => s.Driver === sd.Driver && s.StintNumber === sd.StintNumber) ? 3 : 1.5);

            if (callbacks && callbacks.onStintClick) {
                callbacks.onStintClick(selectedStints);
            }
        });

    // 8. IDENTIFICAZIONE PIT STOPS E DISEGNO MARKERS
    const pitStops = data.filter(d => {
        return data.some(n => n.Driver === d.Driver && n.StintNumber === d.StintNumber + 1);
    });

    const pitsGroup = g.append("g").attr("class", "pits-layer");

    const pitMarkers = pitsGroup.selectAll(".pit-marker")
        .data(pitStops)
        .enter()
        .append("g")
        .attr("class", "pit-marker")
        .attr("transform", d => `translate(${xScale(d.LapEnd)}, ${yScale(d.Driver)})`)
        .style("cursor", "pointer")
        .on("click", function(event, d) {
            if (callbacks && callbacks.onPitClick) {
                callbacks.onPitClick({ driver: d.Driver, lap: d.LapEnd });
            }
        });

    // Linea verticale nera di separazione
    pitMarkers.append("line")
        .attr("x1", 0).attr("y1", 0)
        .attr("x2", 0).attr("y2", yScale.bandwidth())
        .attr("stroke", "#15151e")
        .attr("stroke-width", 2);

    // Triangolo invertito rosso sopra la barra
    const triangle = d3.symbol().type(d3.symbolTriangle).size(30);
    pitMarkers.append("path")
        .attr("d", triangle)
        .attr("transform", "translate(0, -5) rotate(180)")
        .attr("fill", "#e10600")
        .on("mouseover", function(event, d) {
            d3.select(this).attr("fill", "#ffffff").attr("transform", "translate(0, -5) scale(1.5) rotate(180)");
            tooltip.classed("hidden", false)
                   .html(`<strong>Pit Stop</strong><br>Driver: ${d.Driver}<br>Giro: ${d.LapEnd}`)
                   .style("left", (event.pageX + 10) + "px")
                   .style("top", (event.pageY - 20) + "px");
        })
        .on("mouseout", function() {
            d3.select(this).attr("fill", "#e10600").attr("transform", "translate(0, -5) rotate(180)");
            tooltip.classed("hidden", true);
        });
}