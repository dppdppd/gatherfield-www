const videos = document.querySelectorAll("video");

videos.forEach((video) => {
  video.addEventListener("mouseenter", () => {
    if (video.paused) {
      video.play().catch(() => undefined);
    }
  });
});


function initGatherfieldTumbleGraph() {
  const frame = document.querySelector("[data-gatherfield-tumble-graph]");
  if (!frame) return;

  const config = {
    brailleColumns: 2,
    brailleRows: 4,
    depth: 1,
    edgeLength: 0.82,
    projectionCenterX: 0.5,
    projectionCenterY: 0.52,
    nodeContrast: 3.2,
    nodeScale: 0.38,
    perspective: 3.2,
    samplingDetailScale: 0.62,
    unicodeColumns: 104,
    unicodeRows: 58,
  };
  const nodes = [
    { x: -1.65, y: -1.05, z: -1.05 },
    { x: 1.65, y: -1.05, z: -1.05 },
    { x: 0, y: -1.05, z: 1.6 },
    { x: 0, y: 1.35, z: 0 },
  ];
  const edges = [
    [3, 0],
    [0, 2],
    [2, 1],
    [1, 3],
  ];
  const brailleDots = [
    [0x01, 0x08],
    [0x02, 0x10],
    [0x04, 0x20],
    [0x40, 0x80],
  ];
  const thresholds = [
    [0.08, 0.55],
    [0.78, 0.32],
    [0.2, 0.68],
    [0.92, 0.43],
  ];
  const clamp = (value, min = 0, max = 1) => Math.max(min, Math.min(max, value));
  const baseAngle = 0.92;
  const spinRadiansPerSecond = 0.5;
  const sequence = {
    edges: edges.map(([from, to]) => ({ from, progress: 1, to })),
    nodes: new Set(edges.flatMap(([from, to]) => [from, to])),
  };

  const rotate = (point, angle) => {
    const yAngle = angle;
    const xAngle = angle * 0.58 + 0.45;
    const zAngle = angle * 0.22;
    const cy = Math.cos(yAngle);
    const sy = Math.sin(yAngle);
    const cx = Math.cos(xAngle);
    const sx = Math.sin(xAngle);
    const cz = Math.cos(zAngle);
    const sz = Math.sin(zAngle);
    const x1 = point.x * cy + point.z * sy;
    const z1 = -point.x * sy + point.z * cy;
    const y1 = point.y * cx - z1 * sx;
    const z2 = point.y * sx + z1 * cx;
    return {
      x: x1 * cz - y1 * sz,
      y: x1 * sz + y1 * cz,
      z: z2,
    };
  };

  const width = config.unicodeColumns * config.brailleColumns;
  const height = config.unicodeRows * config.brailleRows;
  const yProjectionScale = 0.13;
  const brailleAdvanceEm = 0.732;
  const brailleLetterSpacingEm = 0;
  const renderedCellWidthEm = brailleAdvanceEm + brailleLetterSpacingEm;
  const xProjectionScale =
    yProjectionScale *
    ((config.unicodeRows * config.brailleRows) / (config.unicodeColumns * config.brailleColumns)) *
    (0.88 / renderedCellWidthEm);

  const project = (point) => {
    const perspective = config.perspective / (config.perspective - point.z);
    return {
      depth: point.z,
      scale: perspective,
      x: width * config.projectionCenterX + point.x * perspective * width * xProjectionScale,
      y: height * config.projectionCenterY - point.y * perspective * height * yProjectionScale,
    };
  };
  const projectedPoints = (angle) =>
    nodes.map((node) =>
      project(
        rotate(
          {
            x: node.x * config.edgeLength,
            y: node.y * config.edgeLength,
            z: node.z * config.edgeLength,
          },
          angle,
        ),
      ),
    );
  const depthRange = (points) => {
    const depths = points.map((point) => point.depth);
    return { max: Math.max(...depths), min: Math.min(...depths) };
  };
  const normalizedDepth = (depth, range) => {
    const span = range.max - range.min;
    return span < 0.001 ? 0.5 : clamp((depth - range.min) / span);
  };
  const nodeRadius = (point) =>
    Math.max(config.samplingDetailScale < 1 ? 1.6 : 5, point.scale * 22 * config.nodeScale * config.samplingDetailScale);
  const nodeHit = (dot, points, visibleNodes) => {
    let hit = null;
    for (let index = 0; index < points.length; index += 1) {
      if (visibleNodes && !visibleNodes.has(index)) continue;
      const point = points[index];
      const radius = nodeRadius(point);
      const dx = dot.x - point.x;
      const dy = dot.y - point.y;
      const distanceRatio = Math.sqrt((dx * dx) / (radius * radius) + (dy * dy) / (radius * radius));
      if (distanceRatio < 1 && (!hit || point.depth > hit.point.depth)) {
        hit = { distanceRatio, point };
      }
    }
    return hit;
  };

  const sample = document.createElement("canvas");
  const edgeSample = document.createElement("canvas");
  sample.width = width;
  sample.height = height;
  edgeSample.width = width;
  edgeSample.height = height;
  const sampleContext = sample.getContext("2d", { willReadFrequently: true });
  const edgeSampleContext = edgeSample.getContext("2d", { willReadFrequently: true });
  if (!sampleContext || !edgeSampleContext) return;

  const drawGraph = (context, angle) => {
    const points = projectedPoints(angle);
    context.clearRect(0, 0, width, height);
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, width, height);
    const visibleNodes = sequence.nodes;
    const sortedNodes = points
      .map((point, index) => ({ point, index }))
      .filter((item) => visibleNodes.has(item.index))
      .sort((left, right) => left.point.depth - right.point.depth);
    for (const item of sortedNodes) {
      const point = item.point;
      const radius = nodeRadius(point);
      const gradient = context.createRadialGradient(
        point.x - radius * 0.34,
        point.y - radius * 0.38,
        radius * 0.18,
        point.x,
        point.y,
        radius,
      );
      gradient.addColorStop(0, "#05080a");
      gradient.addColorStop(1, "#4a5563");
      context.fillStyle = gradient;
      context.beginPath();
      context.arc(point.x, point.y, radius, 0, Math.PI * 2);
      context.fill();
      context.lineWidth = Math.max(1, radius * 0.09);
      context.strokeStyle = "#0f1720";
      context.stroke();
    }
  };

  const drawEdgeSample = (angle) => {
    const points = projectedPoints(angle);
    const range = depthRange(points);
    edgeSampleContext.clearRect(0, 0, width, height);
    edgeSampleContext.fillStyle = "#ffffff";
    edgeSampleContext.fillRect(0, 0, width, height);
    const sortedEdges = sequence.edges
      .map((edge) => ({
        ...edge,
        depth: (points[edge.from].depth + points[edge.to].depth) / 2,
      }))
      .sort((left, right) => left.depth - right.depth);
    for (const edge of sortedEdges) {
      const from = points[edge.from];
      const to = points[edge.to];
      const depthWeight = normalizedDepth(edge.depth, range);
      const darkness = 0.36 + depthWeight * (0.42 + config.depth * 0.34);
      const channel = Math.round(255 * (1 - clamp(darkness, 0, 0.92)));
      const alpha = 0.68 + depthWeight * 0.28;
      edgeSampleContext.strokeStyle = "rgba(" + channel + ", " + channel + ", " + channel + ", " + alpha + ")";
      edgeSampleContext.lineCap = "round";
      edgeSampleContext.lineWidth = Math.max(1.7, (1.7 + depthWeight * 2.2) * config.samplingDetailScale);
      edgeSampleContext.beginPath();
      edgeSampleContext.moveTo(from.x, from.y);
      edgeSampleContext.lineTo(to.x, to.y);
      edgeSampleContext.stroke();
    }
  };

  const createFrame = (angle) => {
    drawGraph(sampleContext, angle);
    drawEdgeSample(angle);
    const data = sampleContext.getImageData(0, 0, width, height).data;
    const edgeData = edgeSampleContext.getImageData(0, 0, width, height).data;
    const points = projectedPoints(angle);
    const range = depthRange(points);
    const rows = [];
    for (let cellY = 0; cellY < config.unicodeRows; cellY += 1) {
      const row = [];
      for (let cellX = 0; cellX < config.unicodeColumns; cellX += 1) {
        let dots = 0;
        for (let dotY = 0; dotY < config.brailleRows; dotY += 1) {
          for (let dotX = 0; dotX < config.brailleColumns; dotX += 1) {
            const dot = {
              x: cellX * config.brailleColumns + dotX,
              y: cellY * config.brailleRows + dotY,
            };
            const threshold = thresholds[dotY][dotX];
            const hit = nodeHit(dot, points, sequence.nodes);
            const offset = (dot.y * width + dot.x) * 4;
            const luminance = (data[offset] * 0.2126 + data[offset + 1] * 0.7152 + data[offset + 2] * 0.0722) / 255;
            if (hit) {
              const depthWeight = normalizedDepth(hit.point.depth, range);
              const depthBias = 1 + config.depth * (depthWeight - 0.5) * 1.25;
              const darkness = clamp(((0.94 - luminance) / 0.94) * config.nodeContrast * depthBias);
              if (darkness > threshold) dots |= brailleDots[dotY][dotX];
              continue;
            }
            const edgeLuminance =
              (edgeData[offset] * 0.2126 + edgeData[offset + 1] * 0.7152 + edgeData[offset + 2] * 0.0722) / 255;
            const lineDarkness = clamp(((0.96 - edgeLuminance) / 0.96) * (1.1 + config.depth * 0.68));
            if (lineDarkness > threshold * 0.56) dots |= brailleDots[dotY][dotX];
          }
        }
        row.push(dots === 0 ? " " : String.fromCharCode(0x2800 + dots));
      }
      rows.push(row.join(""));
    }
    return rows.join("\n");
  };

  const setFrame = (angle) => {
    frame.textContent = createFrame(angle);
  };
  const reducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
  setFrame(baseAngle);
  if (reducedMotion) return;

  const started = performance.now();
  const animate = (now) => {
    if (!document.body.contains(frame)) return;
    const elapsed = now - started;
    setFrame(baseAngle + (elapsed / 1000) * spinRadiansPerSecond);
    window.requestAnimationFrame(animate);
  };
  window.requestAnimationFrame(animate);
}

initGatherfieldTumbleGraph();
