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
    // 1. AGGREGAZIONE E CALCOLO ANALYTICS
    const stintsMap = new Map();
    let currentStint = null;
    let prevLap = null;

    const bestS1 = d3.min(rawData, d => +d.Sector1Seconds > 0 ? +d.Sector1Seconds : Infinity);
    const bestS2 = d3.min(rawData, d => +d.Sector2Seconds > 0 ? +d.Sector2Seconds : Infinity);
    const bestS3 = d3.min(rawData, d => +d.Sector3Seconds > 0 ? +d.Sector3Seconds : Infinity);

    const sortedData = rawData.slice().sort((a,b) => d3.ascending(a.Driver, b.Driver) || d3.ascending(+a.LapNumber, +b.LapNumber));

    sortedData.forEach(d => {
        const lapNum = +d.LapNumber;
        const tyreLife = +d.TyreLife;
        
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
        if (+d.Sector1Seconds > 0 && +d.Sector2Seconds > 0 && +d.Sector3Seconds > 0) {
            currentStint.laps.push({ 
                s1: +d.Sector1Seconds, 
                s2: +d.Sector2Seconds, 
                s3: +d.Sector3Seconds, 
                speed: +d.SpeedST, 
                time: +d.LapTimeSeconds
            });
        }
        prevLap = d;
    });
    if (currentStint && currentStint.laps.length > 0) stintsMap.set(currentStint.id, currentStint);

    const validData = Array.from(stintsMap.values()).map(s => {
        const avgS1 = d3.mean(s.laps, l => l.s1);
        const avgS2 = d3.mean(s.laps, l => l.s2);
        const avgS3 = d3.mean(s.laps, l => l.s3);

        return {
            StintID: s.id,
            Driver: s.Driver,
            Compound: s.Compound,
            LapStart: s.LapStart,
            LapEnd: s.LapEnd,
            StintLength: s.laps.length,
            "S1 Delta": avgS1 - bestS1,
            "S2 Delta": avgS2 - bestS2,
            "S3 Delta": avgS3 - bestS3,
            "Speed ST": d3.mean(s.laps, l => l.speed),
            "Consistency Std": d3.deviation(s.laps, l => l.time) || 0
        };
    }).filter(d => d.StintLength > 2);

    if (!validData || validData.length === 0) return;
    const hasSelection = selectedStints && selectedStints.length > 0;

    // 2. SETUP CONTENITORE
    const container = d3.select(containerId);
    container.selectAll("*").remove();
    const node = container.node();
    const width = node.clientWidth || 800;
    const height = node.clientHeight || 300;
    const margin = { top: 35, right: 25, bottom: 15, left: 25 };
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;

    const svg = container.append("svg")
        .attr("width", "100%")
        .attr("height", "100%")
        .on("dblclick", (event) => {
            event.preventDefault();
            if (callbacks?.onReset) callbacks.onReset();
        });

    const g = svg.append("g").attr("transform", `translate(${margin.left},${margin.top})`);

    // 3. SCALE
    const dimensions = ["StintLength", "S1 Delta", "S2 Delta", "S3 Delta", "Speed ST", "Consistency Std"];

    const y = {};
    dimensions.forEach(dim => {
        const extent = d3.extent(validData, d => d[dim]);
        if (dim.includes("Delta") || dim.includes("Std")) {
            y[dim] = d3.scaleLinear().domain(extent).range([0, innerHeight]); 
        } else {
            y[dim] = d3.scaleLinear().domain(extent).range([innerHeight, 0]);
        }
    });

    const x = d3.scalePoint().range([0, innerWidth]).padding(0.8).domain(dimensions);
    const lineGenerator = d => d3.line()(dimensions.map(p => [x(p), y[p](d[p])]));
    const tooltip = d3.select("#tooltip");

    // 4. DISEGNO LINEE
    const lines = g.append("g")
        .attr("class", "lines")
        .selectAll("path")
        .data(validData)
        .enter()
        .append("path")
        .attr("d", lineGenerator)
        .style("fill", "none")
        .style("stroke", d => COMPOUND_COLORS[d.Compound] || COMPOUND_COLORS["UNKNOWN"])
        .style("stroke-width", 1.5)
        .style("opacity", 0.4)
        .style("cursor", "pointer")
        .on("mouseover", function(event, d) {
            d3.select(this).style("stroke-width", 4).style("opacity", 1).raise();

            tooltip.classed("hidden", false)
                .html(`
                    <div style="border-left:3px solid ${COMPOUND_COLORS[d.Compound] || '#888'}; padding-left:8px;">
                        <div style="font-weight:600; font-size:0.9rem; display:flex; justify-content:space-between;">
                            <span>${d.Driver} <span style="font-weight:400; color:#aaa;">(${d.Compound})</span></span>
                            <span style="color:#aaa; font-weight:400; font-size:0.75rem;">L${d.LapStart}-${d.LapEnd}</span>
                        </div>
                        <div style="display:grid; grid-template-columns:1fr 1fr 1fr; gap:4px 8px; font-size:0.72rem; background:rgba(255,255,255,0.03); padding:6px; border-radius:4px; margin-top:4px;">
                            <div style="color:#00ffcc;">S1: <b>+${d["S1 Delta"].toFixed(3)}s</b></div>
                            <div style="color:#00ffcc;">S2: <b>+${d["S2 Delta"].toFixed(3)}s</b></div>
                            <div style="color:#00ffcc;">S3: <b>+${d["S3 Delta"].toFixed(3)}s</b></div>
                            <div style="grid-column:span 3; border-top:1px solid #444; margin:2px 0;"></div>
                            <div>Speed: <b>${d["Speed ST"] ? d["Speed ST"].toFixed(0) : "N/A"}</b></div>
                            <div style="grid-column:span 2;">Consistency: <b>${d["Consistency Std"].toFixed(3)}s</b></div>
                        </div>
                    </div>
                `);
            updatePCPTooltipPosition(event);
        })
        .on("mousemove", (event) => updatePCPTooltipPosition(event))
        .on("mouseout", function() { 
            updateLines(); 
            tooltip.classed("hidden", true); 
        })
        .on("click", (event, d) => callbacks?.onStintClick?.([d]));

    // 5. ASSI E BRUSH
    const selections = new Map();

    const axes = g.selectAll(".axis")
        .data(dimensions)
        .enter().append("g")
        .attr("class", "axis")
        .attr("transform", d => `translate(${x(d)},0)`)
        .each(function(d) { d3.select(this).call(d3.axisLeft(y[d]).ticks(5)); });

    axes.selectAll("text").style("fill", "#888").style("font-size", "10px");
    axes.selectAll("path, line").style("stroke", "#888");

    axes.append("text")
        .style("text-anchor", "middle")
        .attr("y", -15)
        .text(d => d)
        .style("fill", "#888")
        .style("font-weight", "bold")
        .style("font-size", "11px");

    axes.append("g")
        .attr("class", "brush")
        .each(function(d) {
            d3.select(this).call(
                d3.brushY()
                  .extent([[-15, 0], [15, innerHeight]])
                  .on("start brush end", (e) => brushed(e, d))
            );
        });

    function brushed(event, dim) {
        const selection = event.selection;
        if (!selection) selections.delete(dim);
        else {
            const val1 = y[dim].invert(selection[0]);
            const val2 = y[dim].invert(selection[1]);
            selections.set(dim, [Math.min(val1, val2), Math.max(val1, val2)]);
        }
        // Forza propagazione real-time per aggiornare i boxplot nella sidebar
        updateLines(true); 
    }

    function updateLines(propagateToDashboard = false) {
        lines.style("opacity", d => {
            const active = Array.from(selections).every(([dim, sel]) => d[dim] >= sel[0] && d[dim] <= sel[1]);
            const externalMatch = hasSelection && selectedStints.some(s => 
                s.Driver === d.Driver && Math.max(s.LapStart, d.LapStart) <= Math.min(s.LapEnd, d.LapEnd)
            );

            if (selections.size === 0 && !hasSelection) return 0.4;
            if (hasSelection && !externalMatch) return 0.05;
            return active ? 0.9 : 0.05;
        })
        .style("stroke-width", d => {
            const active = Array.from(selections).every(([dim, sel]) => d[dim] >= sel[0] && d[dim] <= sel[1]);
            return ((selections.size > 0 || hasSelection) && active ? 2.5 : 1.5);
        });

        if (propagateToDashboard && callbacks?.onPCPBrush) {
            const filtered = validData.filter(d => 
                Array.from(selections).every(([dim, sel]) => d[dim] >= sel[0] && d[dim] <= sel[1])
            );
            callbacks.onPCPBrush(selections.size === 0 ? [] : filtered);
        }
    }

    function updatePCPTooltipPosition(event) {
        const tooltip = d3.select("#tooltip");
        const node = tooltip.node();
        if (!node) return;
        const rect = node.getBoundingClientRect();
        const padding = 20;
        const verticalDistance = 120; 
        
        let tx = event.pageX - (rect.width / 2);
        let ty = event.pageY - rect.height - verticalDistance;

        if (event.clientY < (rect.height + verticalDistance + padding)) {
            ty = event.pageY + verticalDistance; 
        }

        if (tx < padding) tx = padding;
        if (tx + rect.width > window.innerWidth - padding) {
            tx = window.innerWidth - rect.width - padding;
        }

        tooltip.style("left", tx + "px").style("top", ty + "px").style("transform", "none");
    }

    updateLines();
}