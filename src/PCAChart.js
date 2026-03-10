import * as d3 from 'd3';

const COMPOUND_COLORS = {
    "SOFT": "#e10600",
    "MEDIUM": "#ffeb3b",
    "HARD": "#ffffff"
};

export function drawPCAChart(pcaData, containerId, callbacks, selectedStints = []) {
    const container = d3.select(containerId);
    container.selectAll("*").remove(); 
    container.style("position", "relative"); 

    if (!pcaData || !pcaData.stints) return;

    // 1. LETTURA DATI DAL JSON
    const data = pcaData.stints.map(d => ({
        ...d,
        PC1: +d.PC1,
        PC2: +d.PC2,
        StintLength: +d.TotalLaps
    }));

    const explainedVariance = pcaData.variance || [0, 0];

    const width = container.node().clientWidth;
    const height = container.node().clientHeight;
    if (width === 0 || height === 0) return;

    const margin = { top: 30, right: 30, bottom: 40, left: 50 };
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;

    const svg = container.append("svg")
        .attr("width", "100%")
        .attr("height", "100%")
        .style("display", "block") // (Aggiungi questa se manca, aiuta con i resize)
        // --- NUOVO: Listener per il Reset Globale ---
        .on("dblclick", function(event) {
            event.preventDefault(); // Evita selezioni di testo accidentali
            if (callbacks && callbacks.onReset) {
                callbacks.onReset();
            }
        });
        // --------------------------------------------

    const g = svg.append("g")
        .attr("transform", `translate(${margin.left},${margin.top})`);

    // 2. SCALE
    const xExt = d3.extent(data, d => d.PC1);
    const yExt = d3.extent(data, d => d.PC2);
    const padX = (xExt[1] - xExt[0]) * 0.15 || 1;
    const padY = (yExt[1] - yExt[0]) * 0.15 || 1;

    const xScale = d3.scaleLinear().domain([xExt[0] - padX, xExt[1] + padX]).range([0, innerWidth]);
    const yScale = d3.scaleLinear().domain([yExt[0] - padY, yExt[1] + padY]).range([innerHeight, 0]); 

    const rScale = d3.scaleLinear()
        .domain(d3.extent(data, d => d.StintLength)) // Prende il [minGiri, maxGiri]
        .range([3, 12]); // Traduce in un raggio visivo: stint corto = 3px, lungo = 12px
    // 3. ASSI
    g.append("g")
        .attr("transform", `translate(0,${innerHeight})`)
        .call(d3.axisBottom(xScale).ticks(6))
        .attr("color", "#888894")
        .append("text").attr("x", innerWidth).attr("y", 35)
        .attr("fill", "#f5f5f5").attr("text-anchor", "end")
        .text(`PC1:Strategy & Endurance`);

    g.append("g")
        .call(d3.axisLeft(yScale).ticks(6))
        .attr("color", "#888894")
        .append("text").attr("x", +100).attr("y", -15)
        .attr("fill", "#f5f5f5").attr("text-anchor", "end")
        .text(`PC2: Wear & Performance Loss`);

    // 4. BRUSH RETTANGOLARE (Sempre in secondo piano per non bloccare il mouse)
    const brush = d3.brush()
        .extent([[0, 0], [innerWidth, innerHeight]])
        .on("end", brushed);
    
    g.append("g").attr("class", "brush").call(brush);

    // 5. PUNTI (SCATTER PLOT SEMPLICE CON CERCHI)
    const tooltip = d3.select("#tooltip");

    const points = g.append("g").attr("class", "points").selectAll("circle.point")
        .data(data)
        .enter()
        .append("circle")
        .attr("class", "point")
        .attr("cx", d => xScale(d.PC1))
        .attr("cy", d => yScale(d.PC2))
        .attr("r", d => rScale(d.StintLength))
        .attr("fill", d => COMPOUND_COLORS[d.Compound] || "#888")
        .attr("stroke", d => {
            if (selectedStints.some(s => s.StintID === d.StintID)) return "#00ff00"; // Bordo verde se selezionato
            return d.Compound === "HARD" ? "#15151e" : "#ffffff";
        })
        .attr("stroke-width", d => selectedStints.some(s => s.StintID === d.StintID) ? 3 : 1)
        .style("opacity", d => (selectedStints.length === 0) ? 0.7 : (selectedStints.some(s => s.StintID === d.StintID) ? 1 : 0.15))
        .style("cursor", "pointer")
        .on("click", function(event, d) {
            if (callbacks && callbacks.onStintClick) callbacks.onStintClick([d]);
        })
        .on("mouseover", function(event, d) {
            d3.select(this).attr("stroke-width", 3).attr("stroke", "#ffffff").raise();
            
            tooltip.classed("hidden", false)
                .html(`
                    <div style="border-bottom: 1px solid #444; padding-bottom: 4px; margin-bottom: 4px;">
                        <strong>${d.Driver}</strong> - <span style="color:${COMPOUND_COLORS[d.Compound]}">${d.Compound}</span>
                    </div>
                    <div>Stint Length: <strong>${d.StintLength} laps</strong></div>
                    <div>Avg LapTime: ${(d.AvgLapTime || 0).toFixed(3)}s</div>
                    <div>Degradation: ${(d.DegradationSlope || 0).toFixed(3)} s/l</div>
                `)
                .style("left", (event.pageX + 15) + "px")
                .style("top", (event.pageY - 28) + "px");
        })
        .on("mouseout", function(event, d) {
            tooltip.classed("hidden", true);
            const isSelected = selectedStints.some(s => s.StintID === d.StintID);
            d3.select(this)
                .attr("stroke-width", isSelected ? 3 : 1)
                .attr("stroke", isSelected ? "#00ff00" : (d.Compound === "HARD" ? "#15151e" : "#ffffff"));
        });


    // 6. FUNZIONE BRUSHING (Filtro multiplo)
    // 6. FUNZIONE BRUSHING (Filtro multiplo combinato)
    function brushed(event) {
        const selection = event.selection;
        if (!selection) {
            // Se l'utente clicca a vuoto, resetta la vista PCA
            if (callbacks && callbacks.onStintClick) callbacks.onStintClick([]);
            return;
        }

        const [[x0, y0], [x1, y1]] = selection;

        // 1. Trova i punti fisicamente dentro il rettangolo del brush
        const geometricallySelected = data.filter(d => {
            const cx = xScale(d.PC1);
            const cy = yScale(d.PC2);
            return cx >= x0 && cx <= x1 && cy >= y0 && cy <= y1;
        });

        let finalSelection = [];

        // 2. LOGICA DI COMBINAZIONE
        if (selectedStints && selectedStints.length > 0) {
            // Se c'erano già stint selezionati (es. dal Gantt), facciamo l'INTERSEZIONE (AND)
            // Manteniamo solo i punti che sono nel brush E che erano già evidenziati
            finalSelection = geometricallySelected.filter(pcaPoint => 
                selectedStints.some(s => s.Driver === pcaPoint.Driver && s.StintNumber === pcaPoint.StintNumber)
            );

            // Opzionale: Se l'utente fa un brush su un'area dove non c'erano stint evidenziati, 
            // assumiamo che voglia fare una NUOVA selezione da zero (sovrascrittura intelligente)
            if (finalSelection.length === 0) {
                finalSelection = geometricallySelected;
            }
        } else {
            // Se non c'era nessuna selezione precedente, usiamo semplicemente i punti del brush
            finalSelection = geometricallySelected;
        }

        // 3. Propaga la selezione combinata al resto della dashboard
        if (callbacks && callbacks.onStintClick) {
            callbacks.onStintClick(finalSelection);
        }
    }
}