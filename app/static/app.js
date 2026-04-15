async function uploadDataset(event) {
  event.preventDefault();
  const fileInput = document.getElementById("file");
  const status = document.getElementById("upload-status");
  status.textContent = "Загрузка...";
  const formData = new FormData();
  formData.append("file", fileInput.files[0]);
  const response = await fetch("/api/datasets/upload", { method: "POST", body: formData });
  if (!response.ok) {
    const detail = await response.json().catch(() => ({}));
    status.textContent = "Ошибка: " + (detail.detail || response.statusText);
    return;
  }
  const data = await response.json();
  document.getElementById("dataset-id").value = data.id;
  status.textContent = "Готово, id: " + data.id;
}

async function startTraining() {
  const datasetId = document.getElementById("dataset-id").value.trim();
  const target = document.getElementById("target-column").value.trim() || "label";
  const status = document.getElementById("train-status");
  status.textContent = "Запуск...";
  const qs = new URLSearchParams({ target_column: target });
  const response = await fetch(`/api/datasets/${datasetId}/train?${qs.toString()}`, {
    method: "POST",
  });
  if (!response.ok) {
    const detail = await response.json().catch(() => ({}));
    status.textContent = "Ошибка: " + (detail.detail || response.statusText);
    return;
  }
  const data = await response.json();
  document.getElementById("job-id").value = data.id;
  status.textContent = "Задача создана, id: " + data.id;
  await refreshJob();
}

async function refreshJob() {
  const jobId = document.getElementById("job-id").value.trim();
  const pre = document.getElementById("job-json");
  if (!jobId) {
    pre.textContent = "Укажите ID задачи";
    return;
  }
  const response = await fetch(`/api/jobs/${jobId}`);
  if (!response.ok) {
    pre.textContent = "Ошибка загрузки статуса";
    return;
  }
  const data = await response.json();
  pre.textContent = JSON.stringify(data, null, 2);
  renderCharts(data);
}

function plotConfusionMatrix(targetEl, cm, title) {
  targetEl.innerHTML = "";
  if (!cm || !cm.matrix || !cm.labels) {
    return;
  }
  const labels = cm.labels;
  const z = cm.matrix;
  const text = z.map((row) => row.map((c) => String(c)));
  Plotly.newPlot(
    targetEl,
    [
      {
        type: "heatmap",
        z: z,
        x: labels,
        y: labels,
        text: text,
        texttemplate: "%{text}",
        colorscale: "Blues",
        reversescale: true,
        showscale: true,
      },
    ],
    {
      title: title,
      margin: { t: 48 },
      xaxis: { title: "Предсказано" },
      yaxis: { title: "Факт" },
    },
    { displayModeBar: false, responsive: true },
  );
  Plotly.Plots.resize(targetEl);
}

function correlationIsPlottable(corr) {
  if (!corr || corr.values == null || corr.columns == null) {
    return false;
  }
  const columns = Array.isArray(corr.columns) ? corr.columns : Object.values(corr.columns);
  const values = Array.isArray(corr.values) ? corr.values : Object.values(corr.values);
  const n = columns.length;
  if (n < 2) {
    return false;
  }
  if (!Array.isArray(values) || values.length !== n) {
    return false;
  }
  return values.every((row) => Array.isArray(row) && row.length === n);
}

function normalizeCorrelationForPlot(corr) {
  if (!correlationIsPlottable(corr)) {
    return null;
  }
  const columns = Array.isArray(corr.columns) ? corr.columns : Object.values(corr.columns);
  const values = Array.isArray(corr.values) ? corr.values : Object.values(corr.values);

  return { columns, values };
}

function resolveChartTaskType(m) {
  const raw = m.task_type != null ? String(m.task_type).toLowerCase().trim() : "";
  if (raw === "classification" || raw === "regression") {
    return raw;
  }
  const tm = m.test_metrics;
  const hasReg =
    (m.regression_scatter &&
      Array.isArray(m.regression_scatter.actual) &&
      m.regression_scatter.actual.length > 0) ||
    (tm && typeof tm === "object" && ("rmse" in tm || "r2" in tm || "mae" in tm));
  const hasCls = tm && typeof tm === "object" && ("accuracy" in tm || "f1_macro" in tm);
  if (hasReg && !hasCls) {
    return "regression";
  }
  if (hasCls && !hasReg) {
    return "classification";
  }
  if (hasReg) {
    return "regression";
  }
  if (hasCls) {
    return "classification";
  }

  return raw || "unknown";
}

function plotCorrelationHeatmap(targetEl, corr, title) {
  targetEl.innerHTML = "";
  const normalized = normalizeCorrelationForPlot(corr);
  if (!normalized) {
    return;
  }
  const labels = normalized.columns;
  const z = normalized.values;
  const text = z.map((row) => row.map((v) => Number(v).toFixed(2)));
  Plotly.newPlot(
    targetEl,
    [
      {
        type: "heatmap",
        z: z,
        x: labels,
        y: labels,
        text: text,
        texttemplate: "%{text}",
        colorscale: "RdBu",
        reversescale: true,
        showscale: true,
        zauto: true,
      },
    ],
    {
      title: title,
      margin: { t: 48, l: 80, b: 80 },
      xaxis: { tickangle: -35 },
    },
    { displayModeBar: false, responsive: true },
  );
  Plotly.Plots.resize(targetEl);
}

function plotRegressionDiagnostics(targetEl, scatter, testMetrics) {
  targetEl.innerHTML = "";
  if (!scatter || !scatter.actual || !scatter.predicted) {
    return;
  }
  const a = scatter.actual.map(Number);
  const p = scatter.predicted.map(Number);
  if (a.length !== p.length || a.length === 0) {
    return;
  }
  const lo = Math.min(...a, ...p);
  const hi = Math.max(...a, ...p);
  const pad = (hi - lo) * 0.05 || 1;
  const axisMin = lo - pad;
  const axisMax = hi + pad;
  const rmse = testMetrics && testMetrics.rmse != null ? Number(testMetrics.rmse) : null;
  const mae = testMetrics && testMetrics.mae != null ? Number(testMetrics.mae) : null;
  const r2 = testMetrics && testMetrics.r2 != null ? Number(testMetrics.r2) : null;
  const lines = [];
  if (rmse != null && !Number.isNaN(rmse)) {
    lines.push(`RMSE: ${rmse.toFixed(4)}`);
  }
  if (mae != null && !Number.isNaN(mae)) {
    lines.push(`MAE: ${mae.toFixed(4)}`);
  }
  if (r2 != null && !Number.isNaN(r2)) {
    lines.push(`R²: ${r2.toFixed(4)}`);
  }
  const metricsText = lines.length > 0 ? lines.join("<br>") : "—";
  targetEl.style.width = "100%";
  targetEl.style.minHeight = "380px";
  Plotly.newPlot(
    targetEl,
    [
      {
        type: "scatter",
        mode: "markers",
        x: a,
        y: p,
        marker: { size: 10, color: "#264653", opacity: 0.75 },
        name: "Тест",
      },
      {
        type: "scatter",
        mode: "lines",
        x: [axisMin, axisMax],
        y: [axisMin, axisMax],
        line: { color: "#e76f51", dash: "dash", width: 2 },
        name: "Идеал (y = x)",
      },
    ],
    {
      title: "Регрессия: факт vs предсказание (тест)",
      margin: { t: 48 },
      xaxis: { title: "Факт", range: [axisMin, axisMax] },
      yaxis: { title: "Предсказано", range: [axisMin, axisMax] },
      showlegend: true,
      legend: { x: 0.02, y: 0.98, bgcolor: "rgba(255,255,255,0.85)" },
      annotations: [
        {
          xref: "paper",
          yref: "paper",
          x: 1.0,
          y: 0,
          xanchor: "right",
          yanchor: "bottom",
          showarrow: false,
          align: "right",
          text: metricsText,
          font: { size: 12 },
          bgcolor: "rgba(244,244,244,0.92)",
          borderpad: 8,
        },
      ],
    },
    { displayModeBar: false, responsive: true },
  );
  Plotly.Plots.resize(targetEl);
}

function plotRegressionMetricsBar(targetEl, testMetrics) {
  targetEl.innerHTML = "";
  if (!testMetrics) {
    return;
  }
  const names = ["RMSE", "MAE", "R²"];
  const keys = ["rmse", "mae", "r2"];
  const vals = keys.map((k) => (testMetrics[k] != null ? Number(testMetrics[k]) : null));
  if (vals.every((v) => v == null || Number.isNaN(v))) {
    return;
  }
  const text = vals.map((v) => (v != null && !Number.isNaN(v) ? v.toFixed(4) : "—"));
  targetEl.style.width = "100%";
  targetEl.style.minHeight = "300px";
  Plotly.newPlot(
    targetEl,
    [
      {
        type: "bar",
        x: names,
        y: vals.map((v) => (v != null && !Number.isNaN(v) ? v : 0)),
        text: text,
        textposition: "outside",
        marker: { color: ["#2a9d8f", "#e9c46a", "#e76f51"] },
      },
    ],
    {
      title: "Метрики на тестовой выборке",
      margin: { t: 48 },
      yaxis: { title: "Значение" },
    },
    { displayModeBar: false, responsive: true },
  );
  Plotly.Plots.resize(targetEl);
}

function renderCharts(job) {
  const hist = document.getElementById("chart-hist");
  const featHist = document.getElementById("chart-feature-hist");
  const fi = document.getElementById("chart-fi");
  hist.innerHTML = "";
  featHist.innerHTML = "";
  fi.innerHTML = "";
  const m = job.metrics;
  if (!m) {
    return;
  }
  const taskType = resolveChartTaskType(m);
  if (taskType === "classification") {
    if (m.confusion_matrix) {
      plotConfusionMatrix(hist, m.confusion_matrix, "Матрица ошибок (тестовая выборка)");
    }
    if (normalizeCorrelationForPlot(m.correlation)) {
      plotCorrelationHeatmap(featHist, m.correlation, "Корреляция (таргет и признаки)");
    }
  } else if (taskType === "regression") {
    hist.style.width = "100%";
    const regWrap = document.createElement("div");
    regWrap.style.display = "grid";
    regWrap.style.gridTemplateColumns = "1fr";
    regWrap.style.gap = "1.5rem";
    regWrap.style.width = "100%";
    const scatterEl = document.createElement("div");
    scatterEl.style.minHeight = "380px";
    scatterEl.style.width = "100%";
    const barEl = document.createElement("div");
    barEl.style.minHeight = "320px";
    barEl.style.width = "100%";
    regWrap.appendChild(scatterEl);
    regWrap.appendChild(barEl);
    hist.appendChild(regWrap);
    plotRegressionDiagnostics(scatterEl, m.regression_scatter, m.test_metrics);
    plotRegressionMetricsBar(barEl, m.test_metrics);
    if (normalizeCorrelationForPlot(m.correlation)) {
      featHist.style.width = "100%";
      plotCorrelationHeatmap(featHist, m.correlation, "Корреляция (таргет и признаки)");
    }
  } else if (m.histogram) {
    legacyHistogramFallback(hist, featHist, m, taskType);
  }
  const imp = m.feature_importance || [];
  if (!imp.length) {
    return;
  }
  const labels = imp.map((row) => row.feature);
  const values = imp.map((row) => row.importance);
  Plotly.newPlot(
    fi,
    [{ type: "bar", x: values, y: labels, orientation: "h", marker: { color: "#e76f51" } }],
    { title: "Важность признаков (RandomForest)", margin: { t: 48 } },
    { displayModeBar: false, responsive: true },
  );
}

function legacyHistogramFallback(hist, featHist, m, taskType) {
  function histogramBarLabels(h) {
    const counts = h.counts || [];
    const bins = h.bins || [];
    const labels = h.x_labels;
    if (labels && labels.length === counts.length) {
      return labels;
    }
    const x = [];
    for (let i = 0; i < counts.length; i += 1) {
      const left = bins[i];
      const right = bins[i + 1];
      x.push(`${Number(left).toFixed(4)} – ${Number(right).toFixed(4)}`);
    }
    return x;
  }
  function plotHistogram(targetEl, h, title) {
    targetEl.innerHTML = "";
    if (!h || !h.counts || !h.bins) {
      return;
    }
    const counts = h.counts || [];
    const x = histogramBarLabels(h);
    Plotly.newPlot(
      targetEl,
      [{ type: "bar", x: x, y: counts, marker: { color: "#2a9d8f" } }],
      { title: title, margin: { t: 40 } },
      { displayModeBar: false, responsive: true },
    );
  }
  let mainTitle = "Гистограмма";
  if (taskType === "classification") {
    mainTitle = "Распределение классов: " + (m.histogram && m.histogram.column ? m.histogram.column : "");
  } else if (taskType === "regression") {
    mainTitle = "Остатки на тестовой выборке";
  } else if (m.histogram && m.histogram.column) {
    mainTitle = "Гистограмма: " + m.histogram.column;
  }
  plotHistogram(hist, m.histogram, mainTitle);
  if (m.feature_histogram) {
    plotHistogram(
      featHist,
      m.feature_histogram,
      "Гистограмма признака: " + (m.feature_histogram.column || ""),
    );
  }
}

document.getElementById("upload-form").addEventListener("submit", uploadDataset);
document.getElementById("train-btn").addEventListener("click", startTraining);
document.getElementById("refresh-job-btn").addEventListener("click", refreshJob);
