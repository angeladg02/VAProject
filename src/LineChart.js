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

// Modificato per ricevere un ARRAY di stint selezionati
export function drawLineChart(rawData, containerId, callbacks, selectedStints = []) {
    const data = rawData.map(d => ({
        ...d,
        LapNumber: +d.LapNumber,
        LapTime: +d.LapTimeSeconds,
        TyreLife: +d.TyreLife,
        Driver: d.Driver,
        Team: d.Team,
        IsSafetyCar: d.IsSafetyCar === "True" || d.IsSafetyCar === "true"
    })).filter(d => d.LapNumber > 0 && d.LapTime > 0);

    if (!data || data.length === 0) return; 

    // Funzioni di aiuto per capire se un pilota o un giro specifico sono tra i selezionati
    const hasSelection = selectedStints && selectedStints.length > 0;
    const isDriverSelected = (driver) => hasSelection && selectedStints.some(s => s.Driver === driver);
    const isLapInSelectedStints = (driver, lap) => hasSelection && selectedStints.some(s => s.Driver === driver && lap >= s.LapStart && lap <= s.LapEnd);

    const sortedLaps = data.map(d => d.LapTime).sort(d3.ascending);
    const minLap = sortedLaps[0];
    const p90Lap = d3.quantile(sortedLaps, 0.90); 

    const container = d3.select(containerId);
    container.selectAll("*").remove();

    const containerNode = container.node();
    const width = containerNode.clientWidth;
    const height = containerNode.clientHeight;
    
    const margin = { top: 20, right: 30, bottom: 30, left: 50 };
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;

    const svg = container.append("svg")
        .attr("width", "100%")
        .attr("height", "100%")
        .attr("viewBox", `0 0 ${width} ${height}`)
        .attr("preserveAspectRatio", "none")
        .style("display", "block");

    svg.append("defs").append("clipPath")
        .attr("id", "clip")
        .append("rect")
        .attr("width", innerWidth)
        .attr("height", innerHeight);

    const g = svg.append("g")
        .attr("transform", `translate(${margin.left},${margin.top})`);

    const xScale = d3.scaleLinear()
        .domain(d3.extent(data, d => d.LapNumber))
        .range([0, innerWidth]);

    const yScale = d3.scaleLinear()
        .domain([p90Lap, minLap - 0.5]) 
        .range([innerHeight, 0])
        .clamp(true);

    const maxTyreLife = d3.max(data, d => d.TyreLife) || 30;
    const rScale = d3.scaleLinear()
        .domain([0, maxTyreLife])
        .range([2, 6]); 

    g.append("g")
        .attr("class", "grid")
        .attr("color", "#333344")
        .attr("stroke-opacity", 0.3)
        .call(d3.axisLeft(yScale).ticks(8).tickSize(-innerWidth).tickFormat(""))
        .select(".domain").remove();

    g.append("g")
        .attr("transform", `translate(0,${innerHeight})`)
        .call(d3.axisBottom(xScale).tickFormat(d => `L${d}`))
        .attr("color", "#888894")
        .selectAll("text").style("fill", "#f5f5f5");

    g.append("g")
        .call(d3.axisLeft(yScale).ticks(8).tickFormat(d => d.toFixed(1) + "s"))
        .attr("color", "#888894")
        .selectAll("text").style("fill", "#f5f5f5");

    const plotArea = g.append("g").attr("clip-path", "url(#clip)");

    const scLaps = Array.from(new Set(data.filter(d => d.IsSafetyCar).map(d => d.LapNumber)));
    plotArea.selectAll(".sc-band")
        .data(scLaps)
        .enter()
        .append("rect")
        .attr("x", d => xScale(d - 0.5)) 
        .attr("y", 0)
        .attr("width", d => xScale(d + 0.5) - xScale(d - 0.5))
        .attr("height", innerHeight)
        .attr("fill", "#ffffff")
        .attr("opacity", 0.05);

    const lapsByDriver = d3.group(data, d => d.Driver);
    
    const lineGenerator = d3.line()
        .x(d => xScale(d.LapNumber))
        .y(d => yScale(d.LapTime))
        .defined(d => !isNaN(d.LapTime) && d.LapTime > 0)
        .curve(d3.curveMonotoneX); 

    const linesGroup = plotArea.append("g").attr("class", "lines-layer");
    const circlesGroup = plotArea.append("g").attr("class", "circles-layer");
    const tooltip = d3.select("#tooltip");

    lapsByDriver.forEach((laps, driver) => {
        const teamColor = TEAM_COLORS[laps[0].Team] || "#888894";
        
        // Verifica se questo specifico pilota è tra i selezionati per evidenziarne la linea
        const isThisDriverSelected = isDriverSelected(driver);

        linesGroup.append("path")
            .datum(laps)
            .attr("fill", "none")
            .attr("stroke", teamColor)
            .attr("stroke-width", hasSelection ? (isThisDriverSelected ? 2.5 : 1) : 1)
            .attr("opacity", hasSelection ? (isThisDriverSelected ? 1 : 0.1) : 0.4)
            .attr("d", lineGenerator)
            .style("transition", "all 0.3s ease"); 

        circlesGroup.selectAll(`.circle-${driver}`)
            .data(laps)
            .enter()
            .append("circle")
            .attr("cx", d => xScale(d.LapNumber))
            .attr("cy", d => yScale(d.LapTime))
            .attr("r", d => rScale(d.TyreLife))
            .attr("fill", teamColor)
            .attr("opacity", 0) // Sempre invisibili di base
            .attr("stroke", "#15151e")
            .attr("stroke-width", 1)
            .style("cursor", "pointer")
            .on("mouseover", function(event, d) {
                d3.select(this).attr("opacity", 1).attr("stroke", "#ffffff").attr("stroke-width", 2);
                tooltip.classed("hidden", false)
                    .html(`
                        <div style="margin-bottom:5px;"><strong>${d.Driver}</strong> - Lap ${d.LapNumber}</div>
                        <div>Lap Time: <strong>${d.LapTime.toFixed(3)}s</strong></div>
                        <div>Tyre Life: ${d.TyreLife} laps</div>
                    `)
                    .style("left", (event.pageX + 15) + "px")
                    .style("top", (event.pageY - 28) + "px");
            })
            .on("mouseout", function(event, d) {
                // Se il pallino appartiene a uno degli stint selezionati, resta acceso
                const isSelected = isLapInSelectedStints(d.Driver, d.LapNumber);
                d3.select(this)
                  .attr("stroke", "#15151e")
                  .attr("stroke-width", 1)
                  .attr("opacity", isSelected ? 1 : 0);
                tooltip.classed("hidden", true);
            });
    });

    // 7. DISEGNA LE REGRESSIONI PER TUTTI GLI STINT SELEZIONATI
    if (hasSelection) {
        // Alza e accende in modo fisso i pallini di TUTTI gli stint selezionati
        circlesGroup.selectAll("circle")
            .filter(d => isLapInSelectedStints(d.Driver, d.LapNumber))
            .attr("opacity", 1)
            .attr("stroke", "#ffffff")
            .attr("stroke-width", 1.5)
            .raise(); 

        // Cicla attraverso gli stint e disegna la retta e il poligono per ognuno
        selectedStints.forEach(stint => {
            if (!stint.LapStart || !stint.DegradationSlope) return;

            const startX = xScale(stint.LapStart);
            const endX = xScale(stint.LapEnd);
            
            const midLap = (stint.LapStart + stint.LapEnd) / 2;
            const startY = yScale(stint.AvgLapTime - (midLap - stint.LapStart) * stint.DegradationSlope);
            const endY = yScale(stint.AvgLapTime + (stint.LapEnd - midLap) * stint.DegradationSlope);

            // Disegna la retta tratteggiata per questo stint
            plotArea.append("line")
                .attr("x1", startX).attr("y1", startY)
                .attr("x2", endX).attr("y2", endY)
                .attr("stroke", "#ffffff") 
                .attr("stroke-width", 2.5)
                .attr("stroke-dasharray", "6,6");

            // Disegna la banda grigia per questo stint
            plotArea.append("polygon")
                .attr("points", `
                    ${startX},${startY - 15} 
                    ${endX},${endY - 15} 
                    ${endX},${endY + 15} 
                    ${startX},${startY + 15}
                `)
                .attr("fill", TEAM_COLORS[stint.Team] || "#ffffff")
                .attr("opacity", 0.15)
                .lower();
        });
        // ... [codice esistente del ciclo forEach] ...

    // CALCOLO DEL CROSSOVER POINT (se esattamente 2 stint sono selezionati)
    if (selectedStints.length === 2) {
        const s1 = selectedStints[0];
        const s2 = selectedStints[1];

        // y = m*x + q  =>  LapTime = DegradationSlope * Lap + q
        const m1 = s1.DegradationSlope;
        const mid1 = (s1.LapStart + s1.LapEnd) / 2;
        const q1 = s1.AvgLapTime - (m1 * mid1);

        const m2 = s2.DegradationSlope;
        const mid2 = (s2.LapStart + s2.LapEnd) / 2;
        const q2 = s2.AvgLapTime - (m2 * mid2);

        // Se le rette non sono parallele, calcola l'intersezione
        if (m1 !== m2) {
            // mx1 + q1 = mx2 + q2 => x = (q2 - q1) / (m1 - m2)
            const crossoverLap = (q2 - q1) / (m1 - m2);

            // Disegna il marker solo se il crossover avviene in un giro futuro e sensato
            if (crossoverLap > 0 && crossoverLap < 100) { 
                const cx = xScale(crossoverLap);

                // Disegna la linea verticale
                plotArea.append("line")
                    .attr("x1", cx)
                    .attr("y1", 0)
                    .attr("x2", cx)
                    .attr("y2", innerHeight)
                    .attr("stroke", "#ff00ff") // Colore magenta per risaltare
                    .attr("stroke-width", 2)
                    .attr("stroke-dasharray", "5,5");

                // Disegna l'etichetta di testo
                plotArea.append("text")
                    .attr("x", cx + 8)
                    .attr("y", 20)
                    .attr("fill", "#ff00ff")
                    .style("font-size", "14px")
                    .style("font-weight", "bold")
                    .text(`Crossover at Lap ${Math.round(crossoverLap)}`);
            }
        }
    }
    }
}